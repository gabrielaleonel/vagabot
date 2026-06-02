const STORAGE_KEY = "historico_vagas";
const PROCESSED_KEY = "processedJobs";
let isRunning = false;
let controller = null;
let processedJobs = new Set();
let filtroDataAtual = 7;

async function carregarProcessadas() {
  try {
    const r = await chrome.storage.local.get(PROCESSED_KEY);
    const arr = r[PROCESSED_KEY] || [];
    processedJobs = new Set(arr);
    log("BACKGROUND", `Cache carregado: ${processedJobs.size} URLs já processadas`);
  } catch {
    processedJobs = new Set();
  }
}

async function salvarProcessadas() {
  await chrome.storage.local.set({ [PROCESSED_KEY]: [...processedJobs] });
}

function isProcessada(url) {
  return processedJobs.has(url);
}

async function marcarProcessada(url) {
  processedJobs.add(url);
  if (processedJobs.size % 10 === 0) await salvarProcessadas();
}

async function getHistorico() {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || [];
}

async function salvarVaga(vaga) {
  const h = await getHistorico();
  h.unshift({ ...vaga, id: Date.now(), data: new Date().toISOString().split("T")[0] });
  await chrome.storage.local.set({ [STORAGE_KEY]: h.slice(0, 500) });
}

function delay(ms) {
  return new Promise((resolve, reject) => {
    if (!isRunning || (controller && controller.signal.aborted)) {
      reject(new DOMException("Busca interrompida", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      if (!isRunning || (controller && controller.signal.aborted)) {
        reject(new DOMException("Busca interrompida", "AbortError"));
      } else {
        resolve();
      }
    }, ms);
  });
}

async function enviarProgresso(msg, stats) {
  try { await chrome.runtime.sendMessage({ acao: "progresso", texto: msg, ...(stats ? { stats } : {}) }); } catch {}
}

function verificarCancelamento() {
  if (!isRunning) throw new DOMException("Busca interrompida pelo usuário", "AbortError");
}

async function navegarExtrair(tabId, acao, timeoutMs = 20000, dadosExtras = {}) {
  try {
    await chrome.tabs.sendMessage(tabId, { acao: "ping" });
  } catch {
    return { vagas: [], erro: "Content script não disponível" };
  }
  const msgCompleto = { acao, filtroData: filtroDataAtual, ...dadosExtras };
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ vagas: [], erro: "Timeout" }), timeoutMs);
    chrome.tabs.sendMessage(tabId, msgCompleto, (resposta) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        resolve({ vagas: [], erro: chrome.runtime.lastError.message });
      } else {
        resolve(resposta || { vagas: [] });
      }
    });
  });
}

async function abrirAba(url) {
  verificarCancelamento();
  const tab = await chrome.tabs.create({ url, active: false });
  return tab;
}

async function fecharAba(tab) {
  try { await chrome.tabs.remove(tab.id); } catch {}
}

async function confirmarBotaoCandidatar(tabId, timeoutMs = 12000) {
  try { await chrome.tabs.sendMessage(tabId, { acao: "ping" }); } catch { return { temBotao: false, tipo: null }; }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ temBotao: false, tipo: null }), timeoutMs);
    chrome.tabs.sendMessage(tabId, { acao: "check_apply" }, (resposta) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) resolve({ temBotao: false, tipo: null });
      else resolve({ temBotao: resposta?.temBotao === true, tipo: resposta?.tipo || null });
    });
  });
}

async function tentarAutoApply(tabId, timeoutMs = 25000) {
  try { await chrome.tabs.sendMessage(tabId, { acao: "ping" }); } catch { return false; }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    chrome.tabs.sendMessage(tabId, { acao: "aplicar_agora" }, (resposta) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) resolve(false);
      else resolve(resposta?.status === "aplicada");
    });
  });
}

async function processarVagas(vagas) {
  let confirmadas = 0;
  for (const vaga of vagas) {
    if (!isRunning) break;
    verificarCancelamento();

    if (isProcessada(vaga.url)) {
      log("BACKGROUND", `Já processada anteriormente: ${vaga.titulo}`);
      continue;
    }

    const plataforma = vaga.url.includes("linkedin") ? "linkedin" : "gupy";
    await enviarProgresso(`Verificando: ${vaga.titulo} - ${vaga.empresa}`);

    let tab = null;
    try { tab = await abrirAba(vaga.url); } catch (e) {
      if (e.name === "AbortError") break;
      log("BACKGROUND", `Erro ao abrir aba: ${e.message}`);
      await marcarProcessada(vaga.url);
      continue;
    }

    await delay(5000);
    if (!isRunning) { await fecharAba(tab); break; }

    const { temBotao, tipo } = await confirmarBotaoCandidatar(tab.id);

    let status = null;
    if (temBotao && tipo === "easy_apply" && plataforma === "linkedin") {
      log("BACKGROUND", `Easy Apply detectado — tentando candidatura: ${vaga.titulo}`);
      await delay(2000);
      const aplicada = await tentarAutoApply(tab.id);
      status = aplicada ? "Candidatura enviada" : "Falha ao enviar";
      if (aplicada) confirmadas++;
      log("BACKGROUND", aplicada ? `✓ Candidatura enviada: ${vaga.titulo}` : `✗ Falha no envio: ${vaga.titulo}`);
    } else if (temBotao) {
      status = "Redirecionamento externo";
      confirmadas++;
      log("BACKGROUND", `→ Redirecionamento externo: ${vaga.titulo}`);
    } else {
      log("BACKGROUND", `✗ Sem candidatura: ${vaga.titulo}`);
    }

    await fecharAba(tab);
    await marcarProcessada(vaga.url);

    if (status) {
      await salvarVaga({ ...vaga, plataforma, status });
    }

    if (processedJobs.size % 10 === 0 || temBotao) await salvarProcessadas();

    if (status) {
      await enviarProgresso(`${status === "Candidatura enviada" ? "✓" : status === "Redirecionamento externo" ? "→" : "✗"} ${vaga.titulo}: ${status}`);
    }
  }
  await salvarProcessadas();
  return confirmadas;
}

function pararBusca() {
  isRunning = false;
  if (controller) {
    controller.abort();
    controller = null;
  }
}

function filtroDataLabel(dias) {
  if (dias === 0) return "Qualquer data";
  if (dias === 1) return "24 horas";
  return `${dias} dias`;
}

async function iniciarBusca(palavrasChave, plataformas, filtroData = 7) {
  if (isRunning) return;
  await carregarProcessadas();
  isRunning = true;
  filtroDataAtual = filtroData;
  controller = new AbortController();
  let totalEncontradas = 0;
  let totalConfirmadas = 0;

  log("BACKGROUND", "Busca iniciada", { palavrasChave, plataformas, filtroData });
  log("BACKGROUND", `Filtros ativos: Localização=SP, Data=${filtroDataLabel(filtroData)}`);
  await enviarProgresso(`📍 SP · 📅 ${filtroDataLabel(filtroData)} | Iniciando busca...`);

  for (const kw of palavrasChave) {
    if (!isRunning) break;
    try { verificarCancelamento(); } catch { break; }

      if (plataformas.linkedin) {
        log("BACKGROUND", `LinkedIn: buscando "${kw}"`);
        await enviarProgresso(`LinkedIn: "${kw}"`);
        const tprMap = { 1: "r86400", 3: "r259200", 7: "r604800", 14: "r1209600", 30: "r2592000" };
        const tpr = tprMap[filtroData] || "";
        const tprParam = tpr ? `&f_TPR=${tpr}` : "";
        let tab = null;
        try {
          tab = await abrirAba(
            `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(kw)}&location=S%C3%A3o%20Paulo&geoId=104747419${tprParam}&f_E=1`
          );
        } catch (e) {
          if (e.name === "AbortError") break;
          continue;
        }

      await delay(7000);
      if (!isRunning) { await fecharAba(tab); break; }

      const resultado = await navegarExtrair(tab.id, "extrair_linkedin", 15000);
      await fecharAba(tab);

      if (resultado.vagas && resultado.vagas.length > 0) {
        totalEncontradas += resultado.vagas.length;
        log("BACKGROUND", `LinkedIn: ${resultado.vagas.length} vagas listadas para "${kw}"`);
        await enviarProgresso(`LinkedIn: ${resultado.vagas.length} listadas em "${kw}"`, { encontradas: totalEncontradas, candidatadas: totalConfirmadas });
        const c = await processarVagas(resultado.vagas);
        totalConfirmadas += c;
      } else {
        log("BACKGROUND", `LinkedIn: nenhuma vaga para "${kw}"`);
      }
    }

    if (plataformas.gupy) {
      log("BACKGROUND", `Gupy: buscando "${kw}"`);
      await enviarProgresso(`Gupy: "${kw}"`);

      let resultado = { vagas: [] };
      let tab = null;
      try {
        tab = await abrirAba(`https://portal.gupy.io/job-search?term=${encodeURIComponent(kw)}&type=internship`);
      } catch (e) {
        if (e.name === "AbortError") break;
        continue;
      }

      await delay(9000);
      if (!isRunning) { await fecharAba(tab); break; }

      resultado = await navegarExtrair(tab.id, "extrair_gupy", 20000, { keyword: kw });
      await fecharAba(tab);

      if (!resultado.vagas || resultado.vagas.length === 0) {
        if (!isRunning) break;
        await enviarProgresso(`Gupy Google: "${kw}"`);
        try {
          tab = await abrirAba(
            `https://www.google.com/search?q=site:portal.gupy.io+${encodeURIComponent(kw)}+estágio+São+Paulo&tbs=qdr:w`
          );
        } catch (e) {
          if (e.name === "AbortError") break;
          continue;
        }

        await delay(6000);
        if (!isRunning) { await fecharAba(tab); break; }
        resultado = await navegarExtrair(tab.id, "extrair_gupy", 12000, { keyword: kw });
        await fecharAba(tab);
      }

      if (resultado.vagas && resultado.vagas.length > 0) {
        totalEncontradas += resultado.vagas.length;
        log("BACKGROUND", `Gupy: ${resultado.vagas.length} vagas listadas para "${kw}"`);
        await enviarProgresso(`Gupy: ${resultado.vagas.length} listadas em "${kw}"`, { encontradas: totalEncontradas, candidatadas: totalConfirmadas });
        const c = await processarVagas(resultado.vagas);
        totalConfirmadas += c;
      }
    }
  }

  await salvarProcessadas();
  pararBusca();
  const msg = `${totalEncontradas} listadas, ${totalConfirmadas} com candidatura disponível.`;
  log("BACKGROUND", `Busca concluída: ${msg}`);
  await enviarProgresso(`Concluído! ${msg}`, { encontradas: totalEncontradas, candidatadas: totalConfirmadas });
}

chrome.runtime.onMessage.addListener((mensagem, sender, enviarResposta) => {
  if (mensagem.acao === "iniciar") {
    iniciarBusca(mensagem.palavrasChave, mensagem.plataformas, mensagem.filtroData || 7);
    enviarResposta({ status: "iniciada" });
    return false;
  }
  if (mensagem.acao === "parar") {
    pararBusca();
    enviarResposta({ status: "parada" });
    return false;
  }
  if (mensagem.acao === "get_historico") {
    getHistorico().then(enviarResposta);
    return true;
  }
  if (mensagem.acao === "remover_vaga") {
    (async () => {
      const h = await getHistorico();
      const filtrado = h.filter(v => v.id !== mensagem.id);
      await chrome.storage.local.set({ [STORAGE_KEY]: filtrado });
      enviarResposta({ status: "removida" });
    })();
    return true;
  }
});

function log(tag, mensagem, dados = null) {
  const prefixo = `[${tag}]`;
  if (dados) console.log(`${prefixo} ${mensagem}`, dados);
  else console.log(`${prefixo} ${mensagem}`);
}
