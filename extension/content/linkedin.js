(function () {
  "use strict";

  const SELETORES_CARD_VAGA = [
    'li[data-occludable-job-id]',
    'div.job-card-container',
    'div[data-job-id]',
    'article.job-card'
  ];

  const SELETORES_TITULO = [
    'a.job-card-list__title',
    'a[data-anonymize="job-title"]',
    'h3[id*="job-title"]',
    'a[href*="/jobs/view"]'
  ];

  const SELETORES_EMPRESA = [
    'a.job-card-container__company-name',
    'span[data-anonymize="company-name"]',
    'span.job-card-container__primary-description'
  ];

  const SELETORES_LOCAL = [
    'li.job-card-container__metadata-item',
    'span.job-card-container__metadata-item',
    '[data-testid="job-card-location"]'
  ];

  const SELETORES_DATA = [
    'time.job-card-container__listed-state',
    'time[datetime]',
    '[data-testid="job-card-posted-date"]'
  ];

  const SELETORES_MODALIDADE = [
    'span.job-card-container__workplace-type',
    '[data-testid="job-card-workplace-type"]'
  ];

  const SELETORES_LINK = [
    'a.job-card-list__title',
    'a[data-anonymize="job-title"]',
    'a[href*="/jobs/view"]'
  ];

  function buscarBotoes(seletorCss, fnFiltro) {
    try {
      const els = document.querySelectorAll(seletorCss);
      return Array.from(els).filter(btn => {
        const v = validarElemento(btn);
        if (!v.valido) return false;
        return fnFiltro(btn);
      });
    } catch { return []; }
  }

  function buscarBotoesApply() {
    return buscarBotoes('button, a', btn => {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const txt = (btn.textContent || '').toLowerCase();
      const id = (btn.id || '').toLowerCase();
      const cls = (btn.className || '').toLowerCase();
      const dataTc = (btn.getAttribute('data-tracking-control-name') || '').toLowerCase();
      return (
        aria.includes('candidatar') || aria.includes('apply') ||
        txt.includes('candidatar') || txt.includes('apply') ||
        cls.includes('jobs-apply-button') ||
        dataTc.includes('apply')
      );
    });
  }

  function buscarEasyApply() {
    return buscarBotoes('button', btn => {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const txt = (btn.textContent || '').toLowerCase();
      const dataTc = (btn.getAttribute('data-tracking-control-name') || '').toLowerCase();
      return (
        dataTc.includes('easy_apply') ||
        aria.includes('easy apply') ||
        txt.includes('easy apply') ||
        txt.includes('candidatura simplificada')
      );
    });
  }

  function buscarExternal() {
    return buscarBotoes('button, a', btn => {
      const dataTc = (btn.getAttribute('data-tracking-control-name') || '').toLowerCase();
      const href = (btn.getAttribute('href') || '').toLowerCase();
      const txt = (btn.textContent || '').toLowerCase();
      return (
        dataTc.includes('external_job') ||
        href.includes('/jobsx/') ||
        (txt.includes('candidatar') && dataTc.includes('external'))
      );
    });
  }

  function buscarBotaoEnviar() {
    return buscarBotoes('button', btn => {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const txt = (btn.textContent || '').toLowerCase();
      return (
        aria.includes('enviar') || aria.includes('send') ||
        txt.includes('enviar') || txt.includes('submit')
      );
    });
  }

  function buscarBotaoProximo() {
    return buscarBotoes('button', btn => {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const txt = (btn.textContent || '').toLowerCase();
      return (
        txt.includes('próximo') || txt.includes('próximo') ||
        txt.includes('next') || aria.includes('next') ||
        aria.includes('próximo')
      );
    });
  }

  let isRunning = false;
  let observer = null;
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

  function verificarCancelamento() {
    if (!isRunning) {
      console.log("[LINKEDIN] Busca interrompida pelo usuário");
      limparTimers();
      if (observer) { observer.disconnect(); observer = null; }
      return false;
    }
    return true;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function log(msg, dados = null) {
    if (dados) console.log(`[LINKEDIN] ${msg}`, dados);
    else console.log(`[LINKEDIN] ${msg}`);
  }

  function validarContextoVaga(elemento) {
    if (!elemento) return { valido: false, motivo: "Elemento nulo" };
    const v = validarElemento(elemento);
    if (!v.valido) return v;
    const texto = elemento.textContent.toLowerCase();
    if (texto.includes("vendedor") || texto.includes("telemarketing")) {
      return { valido: false, motivo: "Palavra negativa no cartão" };
    }
    return { valido: true, motivo: "Contexto de vaga válido" };
  }

  function extrairVagas(diasMax) {
    if (!verificarCancelamento()) return [];
    log(`Extraindo vagas da página atual (filtro data: ${diasMax === 0 ? "qualquer" : diasMax + " dias"})`);

    const vagas = [];
    const cards = tentarSeletoresTodos(SELETORES_CARD_VAGA);
    log(`${cards.length} cards encontrados`);

    for (let i = 0; i < cards.length; i++) {
      if (!verificarCancelamento()) break;
      const card = cards[i];

      const ctx = validarContextoVaga(card);
      if (!ctx.valido) { log(`Card ${i}: ${ctx.motivo}`); continue; }

      const elLink = tentarSeletores(SELETORES_LINK, card);
      if (!elLink) { log(`Card ${i}: Nenhum link encontrado`); continue; }

      const vLink = validarElemento(elLink);
      if (!vLink.valido) { log(`Card ${i}: Link inválido - ${vLink.motivo}`); continue; }

      const url = elLink.href || elLink.getAttribute("href");
      if (!url) { log(`Card ${i}: Link sem href`); continue; }
      if (!validarLinkVaga(url)) { log(`Card ${i}: Link não é de vaga: ${url}`); continue; }

      const titulo = (elLink.textContent || "").trim();
      if (!titulo) { log(`Card ${i}: Título vazio`); continue; }

      const filtro = filtrarPorPalavras(titulo);
      if (!filtro.valido) { log(`Card ${i}: ${filtro.motivo}`); continue; }

      const empresa = tentarSeletores(SELETORES_EMPRESA, card);
      const local = tentarSeletores(SELETORES_LOCAL, card);
      const data = tentarSeletores(SELETORES_DATA, card);
      const modalidade = tentarSeletores(SELETORES_MODALIDADE, card);

      const textoLocal = local ? (local.textContent || "").trim() : "";
      const textoData = data ? (data.textContent || "").trim() : "";

      const locOk = validarLocalizacaoSP(textoLocal);
      if (!locOk.valido) { log(`Card ${i}: ${locOk.motivo}`); continue; }

      const dateOk = validarDataPublicacao(textoData, diasMax);
      if (!dateOk.valido) { log(`Card ${i}: ${dateOk.motivo}`); continue; }

      const vaga = {
        titulo,
        empresa: empresa ? (empresa.textContent || "").trim() : "",
        local: textoLocal,
        data: textoData,
        modalidade: modalidade ? (modalidade.textContent || "").trim() : "",
        url,
        plataforma: "linkedin"
      };

      vagas.push(vaga);
      log(`Vaga extraída: ${vaga.titulo} - ${vaga.empresa}`);
    }

    return vagas;
  }

  async function aplicarVaga() {
    if (!verificarCancelamento()) return { status: "erro", motivo: "Cancelado" };
    log("Iniciando processo de candidatura Easy Apply");

    return new Promise((resolve) => {
      let submitted = false;

      agendar(async () => {
        if (!isRunning) { resolve({ status: "erro" }); return; }
        log("Procurando botão de candidatar...");

        const botoes = buscarBotoesApply();
        for (const btn of botoes) {
          if (!isRunning) { resolve({ status: "erro" }); return; }
          log(`Clicando: "${(btn.textContent || '').trim()}"`);
          btn.click();
          break;
        }

        let tentativas = 0;
        const MAX = 20;
        const id = setInterval(() => {
          if (!isRunning) { clearInterval(id); if (!submitted) resolve({ status: "erro" }); return; }
          tentativas++;
          log(`Tentativa ${tentativas}/${MAX} de envio`);

          const btnsEnviar = buscarBotaoEnviar();
          for (const btn of btnsEnviar) {
            if (!isRunning) break;
            log(`Clicando em enviar: "${(btn.textContent || '').trim()}"`);
            btn.click();
            clearInterval(id);
            submitted = true;
            log("Candidatura enviada com sucesso!");
            resolve({ status: "aplicada" });
            return;
          }

          const btnsProx = buscarBotaoProximo();
          let clicou = false;
          for (const btn of btnsProx) {
            if (!isRunning) break;
            log(`Clicando em próximo: "${(btn.textContent || '').trim()}"`);
            btn.click();
            clicou = true;
            break;
          }
          if (!clicou && tentativas > 3) {
            log("Nenhum botão de próximo ou enviar encontrado");
          }
          if (tentativas >= MAX) {
            clearInterval(id);
            if (!submitted) resolve({ status: "erro" });
          }
        }, 2500);
      }, 1000);
    });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.acao === "ping") {
      sendResponse({ status: "ok" });
      return false;
    }

    if (msg.acao === "extrair_linkedin") {
      isRunning = true;
      const df = typeof msg.filtroData === "number" ? msg.filtroData : 7;
      filtroDataAtual = df;
      log(`Mensagem extrair_linkedin recebida (filtro data: ${df})`);
      const vagas = extrairVagas(df);
      isRunning = false;
      sendResponse({ vagas });
      return false;
    }

    if (msg.acao === "aplicar_agora") {
      isRunning = true;
      aplicarVaga().then(r => {
        isRunning = false;
        sendResponse(r);
      });
      return true;
    }

    if (msg.acao === "check_apply") {
      log("Verificando tipo de candidatura...");
      let tipo = null;

      const easyBtns = buscarEasyApply();
      if (easyBtns.length > 0) {
        tipo = "easy_apply";
        log(`Easy Apply disponível: "${(easyBtns[0].textContent || '').trim()}"`);
      }

      if (!tipo) {
        const extBtns = buscarExternal();
        if (extBtns.length > 0) {
          tipo = "external";
          log(`Redirecionamento externo detectado: "${(extBtns[0].textContent || '').trim()}"`);
        }
      }

      if (!tipo) {
        const genBtns = buscarBotoesApply();
        if (genBtns.length > 0) {
          tipo = "external";
          log(`Botão de candidatura genérico — tratado como external: "${(genBtns[0].textContent || '').trim()}"`);
        }
      }

      if (!tipo) log("Nenhum botão de candidatura encontrado");
      sendResponse({ temBotao: tipo !== null, tipo });
      return false;
    }
  });

  log("Content script LinkedIn carregado");
})();
