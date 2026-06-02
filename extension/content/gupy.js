(function () {
  "use strict";

  const SELETORES_CARD_VAGA_GUPY = [
    'a[data-testid="job-card"]',
    'div[data-testid="job-card"]',
    'a[class*="job-card"]',
    'div[class*="job-card"]',
    'div[class*="JobCard"]',
    'a[href*="/jobs/"]'
  ];

  const SELETORES_TITULO_GUPY = [
    '[data-testid="job-title"]',
    'h2[class*="job-title"]',
    'h2[class*="JobTitle"]',
    'h3[class*="title"]',
    'a[data-testid="job-card"] h2',
    'a[class*="job-card"] h2',
    'div[class*="job-card"] h2',
    'div[class*="job-card"] h3'
  ];

  const SELETORES_EMPRESA_GUPY = [
    '[data-testid="job-company"]',
    'span[class*="company"]',
    'span[class*="Company"]',
    'p[class*="company"]'
  ];

  const SELETORES_LOCAL_GUPY = [
    '[data-testid="job-location"]',
    'span[class*="location"]',
    'span[class*="Location"]',
    'p[class*="location"]',
    'div[class*="location"]'
  ];

  const SELETORES_DATA_GUPY = [
    '[data-testid="job-published"]',
    'time[datetime]',
    'span[class*="date"]',
    'span[class*="Date"]',
    'p[class*="date"]'
  ];

  const SELETORES_MODALIDADE_GUPY = [
    '[data-testid="job-modality"]',
    'span[class*="modality"]',
    'span[class*="remote"]',
    'span[class*="hybrid"]',
    'span[class*="presential"]'
  ];

  const SELETORES_LINK_GUPY = [
    'a[data-testid="job-card"]',
    'a[class*="job-card"]',
    'a[href*="/jobs/"]',
    'a[href*="/vagas/"]'
  ];

  const SELETORES_CAIXA_BUSCA = [
    'input[data-testid="search-input"]',
    'input[placeholder*="Buscar"]',
    'input[placeholder*="Search"]',
    'input[type="search"]',
    'input[aria-label*="Buscar"]',
    'input[aria-label*="Search"]'
  ];

  const SELETORES_BOTAO_APLICAR_GUPY = [
    'button[data-testid="apply-button"]',
    'button[class*="apply"]',
    'button[class*="Apply"]',
    'button[aria-label*="Candidatar"]',
    'button[aria-label*="Inscrever"]',
    'button:has(span:contains("Candidatar"))',
    'button:has(span:contains("Inscrever"))',
    'a[class*="apply"]',
    'a[class*="Apply"]'
  ];

  const SELETORES_BOTAO_ENVIAR_GUPY = [
    'button[data-testid="submit-application"]',
    'button[class*="submit"]',
    'button[class*="Submit"]',
    'button[aria-label*="Enviar"]',
    'button[aria-label*="Concluir"]',
    'button:has(span:contains("Enviar"))',
    'button:has(span:contains("Concluir"))',
    'button[data-testid="form-submit"]',
    'button[type="submit"]'
  ];

  const SELETORES_RESULTADO_GOOGLE = [
    'div.g',
    'div[class*="yuRUbf"]',
    'a[href*="portal.gupy.io"]'
  ];

  let isRunning = false;
  let timers = [];
  let filtroDataAtual = 7;

  function limparTimers() {
    timers.forEach(t => { try { clearTimeout(t); clearInterval(t); } catch {} });
    timers = [];
  }

  function agendar(fn, ms) {
    const id = setTimeout(() => {
      if (!isRunning) return;
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function agendarIntervalo(fn, ms) {
    const id = setInterval(() => {
      if (!isRunning) { clearInterval(id); return; }
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function verificarCancelamento() {
    if (!isRunning) {
      log("Busca interrompida pelo usuário");
      limparTimers();
      return false;
    }
    return true;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function log(msg, dados = null) {
    if (dados) console.log(`[GUPY] ${msg}`, dados);
    else console.log(`[GUPY] ${msg}`);
  }

  function validarContextoVaga(elemento) {
    if (!elemento) return { valido: false, motivo: "Elemento nulo" };
    const v = validarElemento(elemento);
    if (!v.valido) return v;
    const texto = elemento.textContent.toLowerCase();
    if (texto.includes("vendedor") || texto.includes("telemarketing") || texto.includes("professor")) {
      return { valido: false, motivo: "Palavra negativa no cartão" };
    }
    return { valido: true, motivo: "Contexto de vaga válido" };
  }

  function extrairVagasGupy(diasMax) {
    if (!verificarCancelamento()) return [];
    log(`Extraindo vagas do Gupy (portal direto, filtro data: ${diasMax === 0 ? "qualquer" : diasMax + " dias"})`);

    const vagas = [];
    const cards = tentarSeletoresTodos(SELETORES_CARD_VAGA_GUPY);
    log(`${cards.length} cards encontrados`);

    for (let i = 0; i < cards.length; i++) {
      if (!verificarCancelamento()) break;
      const card = cards[i];

      const ctx = validarContextoVaga(card);
      if (!ctx.valido) { log(`Card ${i}: ${ctx.motivo}`); continue; }

      const elLink = card.tagName === "A" ? card : tentarSeletores(SELETORES_LINK_GUPY, card);
      if (!elLink) { log(`Card ${i}: Nenhum link encontrado`); continue; }

      const vLink = validarElemento(elLink);
      if (!vLink.valido) { log(`Card ${i}: Link inválido - ${vLink.motivo}`); continue; }

      const url = elLink.href || elLink.getAttribute("href");
      if (!url) { log(`Card ${i}: Link sem href`); continue; }
      if (!url.includes("gupy.io")) { log(`Card ${i}: Link não é gupy: ${url}`); continue; }

      const titulo = tentarSeletores(SELETORES_TITULO_GUPY, card);
      const texto = titulo ? (titulo.textContent || "").trim() : "";
      if (!texto) continue;

      const filtro = filtrarPorPalavras(texto);
      if (!filtro.valido) { log(`Card ${i}: ${filtro.motivo}`); continue; }

      const empresa = tentarSeletores(SELETORES_EMPRESA_GUPY, card);
      const local = tentarSeletores(SELETORES_LOCAL_GUPY, card);
      const data = tentarSeletores(SELETORES_DATA_GUPY, card);
      const modalidade = tentarSeletores(SELETORES_MODALIDADE_GUPY, card);

      const textoLocal = local ? (local.textContent || "").trim() : "";
      const textoData = data ? (data.textContent || "").trim() : "";

      const locOk = validarLocalizacaoSP(textoLocal);
      if (!locOk.valido) { log(`Card ${i}: ${locOk.motivo}`); continue; }

      const dateOk = validarDataPublicacao(textoData, diasMax);
      if (!dateOk.valido) { log(`Card ${i}: ${dateOk.motivo}`); continue; }

      vagas.push({
        titulo: texto,
        empresa: empresa ? (empresa.textContent || "").trim() : "",
        local: textoLocal,
        data: textoData,
        modalidade: modalidade ? (modalidade.textContent || "").trim() : "",
        url,
        plataforma: "gupy"
      });
      log(`Vaga extraída: ${texto} - ${vagas[vagas.length-1].empresa}`);
    }

    return vagas;
  }

  function extrairVagasGoogle() {
    if (!verificarCancelamento()) return [];
    log("Extraindo vagas do Google (fallback Gupy)");

    const vagas = [];
    const resultados = document.querySelectorAll('a[href*="portal.gupy.io"]');
    log(`${resultados.length} links Gupy encontrados no Google`);

    const visitados = new Set();

    for (const link of resultados) {
      if (!verificarCancelamento()) break;
      const url = link.href || "";
      if (!url.includes("gupy.io")) continue;
      if (visitados.has(url)) continue;
      visitados.add(url);

      const vLink = validarElemento(link);
      if (!vLink.valido) continue;

      let texto = (link.textContent || link.getAttribute("aria-label") || "").trim();
      const pai = link.closest("div.g, div[class*='yuRUbf']");
      if (!texto && pai) {
        const h3 = pai.querySelector("h3");
        texto = h3 ? (h3.textContent || "").trim() : "";
      }
      if (!texto) continue;

      const filtro = filtrarPorPalavras(texto);
      if (!filtro.valido) { log(`Google link: ${filtro.motivo}`); continue; }

      vagas.push({
        titulo: texto,
        empresa: "",
        local: "",
        data: "",
        modalidade: "",
        url,
        plataforma: "gupy"
      });
      log(`Vaga extraída (Google): ${texto}`);
    }

    return vagas;
  }

  async function aplicarVagaGupy() {
    if (!verificarCancelamento()) return { status: "erro", motivo: "Cancelado" };
    log("Iniciando candidatura automática Gupy");

    agendar(() => {
      if (!isRunning) return;
      log("Procurando botão de candidatar...");
      const botoes = tentarSeletoresTodos(SELETORES_BOTAO_APLICAR_GUPY);
      if (botoes.length === 0) { log("Nenhum botão de candidatura encontrado"); return; }

      for (const btn of botoes) {
        if (!isRunning) return;
        const v = validarElemento(btn);
        if (!v.valido) { log(`Botão inválido: ${v.motivo}`); continue; }
        const txt = (btn.textContent || btn.getAttribute("aria-label") || "").toLowerCase();
        if (txt.includes("candidatar") || txt.includes("inscrever")) {
          log(`Clicando: "${txt}" (visível: sim)`);
          btn.click();
          break;
        }
      }
    }, 2000);

    agendar(() => {
      if (!isRunning) return;
      log("Procurando botão de enviar...");
      let tentativas = 0;
      const MAX = 20;

      const intervalId = agendarIntervalo(() => {
        if (!isRunning) { clearInterval(intervalId); return; }
        tentativas++;
        log(`Envio tentativa ${tentativas}/${MAX}`);

        const botoes = tentarSeletoresTodos(SELETORES_BOTAO_ENVIAR_GUPY);
        for (const btn of botoes) {
          if (!isRunning) break;
          const v = validarElemento(btn);
          if (!v.valido) continue;
          const txt = (btn.textContent || btn.getAttribute("aria-label") || "").toLowerCase();
          if (txt.includes("enviar") || txt.includes("concluir") || txt.includes("submit")) {
            log(`Clicando em enviar: "${txt}"`);
            btn.click();
            log("Candidatura Gupy enviada com sucesso!");
            clearInterval(intervalId);
            return;
          }
        }

        if (tentativas >= MAX) {
          clearInterval(intervalId);
          log("Máximo de tentativas de envio atingido");
        }
      }, 3000);
    }, 5000);

    return { status: "processando" };
  }

  function buscarNoGupy(keyword, sendResponse, diasMax) {
    let vagas = [];
    const isGoogle = window.location.hostname.includes("google");

    if (isGoogle) {
      agendar(() => {
        vagas = extrairVagasGoogle(diasMax);
        log(`${vagas.length} vagas encontradas no Google`);
        sendResponse({ vagas });
      }, 3000);
      return;
    }

    // Portal Gupy direto — insere keyword e faz scroll
    if (keyword) {
      const caixa = tentarSeletores(SELETORES_CAIXA_BUSCA);
      if (caixa && validarElemento(caixa).valido) {
        caixa.value = "";
        caixa.focus();
        caixa.value = keyword;
        const ev = new Event("input", { bubbles: true });
        caixa.dispatchEvent(ev);
        log(`Keyword "${keyword}" inserida na caixa de busca`);
      }
    }

    // Scroll progressivo
    let scrolls = 0;
    const scrollId = agendarIntervalo(() => {
      if (!isRunning) { clearInterval(scrollId); return; }
      scrolls++;
      window.scrollBy(0, 900);
      log(`Scroll ${scrolls}/6 para carregar vagas`);
      if (scrolls >= 6) {
        clearInterval(scrollId);
      }
    }, 2000);

    // Extrai após scroll
    agendar(() => {
      clearInterval(scrollId);
      vagas = extrairVagasGupy(diasMax);
      log(`${vagas.length} vagas encontradas no Gupy portal`);
      sendResponse({ vagas });
    }, 18000);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.acao === "ping") {
      sendResponse({ status: "ok" });
      return false;
    }

    if (msg.acao === "extrair_gupy") {
      isRunning = true;
      const df = typeof msg.filtroData === "number" ? msg.filtroData : 7;
      filtroDataAtual = df;
      log(`Mensagem extrair_gupy recebida (keyword: "${msg.keyword}", filtro data: ${df})`);
      buscarNoGupy(msg.keyword || "", sendResponse, df);
      return true;
    }

    if (msg.acao === "aplicar_agora") {
      isRunning = true;
      aplicarVagaGupy().then(r => sendResponse(r));
      return true;
    }

    if (msg.acao === "check_apply") {
      log("Verificando botão de candidatura Gupy...");
      const botoes = tentarSeletoresTodos(SELETORES_BOTAO_APLICAR_GUPY);
      const temBotao = Array.from(botoes).some(btn => {
        const v = validarElemento(btn);
        if (!v.valido) return false;
        const txt = (btn.textContent || btn.getAttribute("aria-label") || "").toLowerCase();
        return txt.includes("candidatar") || txt.includes("inscrever") || txt.includes("apply");
      });
      log(temBotao ? "Botão de candidatura Gupy encontrado" : "Nenhum botão de candidatura Gupy");
      sendResponse({ temBotao, tipo: temBotao ? "external" : null });
      return false;
    }
  });

  log("Content script Gupy carregado");
})();
