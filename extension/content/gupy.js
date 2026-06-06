(function () {
  "use strict";

  let isRunning = false;

  function log(msg, dados = null) {
    if (dados) console.log(`[GUPY] ${msg}`, dados);
    else console.log(`[GUPY] ${msg}`);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function verificarCancelamento() {
    if (!isRunning) {
      log("Busca interrompida");
      return false;
    }
    return true;
  }

  const CARD_SELECTORS = [
    'a[data-testid="job-card"]',
    'a[class*="job-card"]',
    'a[class*="JobCard"]',
    'a[class*="sc-"]',
    '[data-testid*="job-card"]',
    '[class*="job-card"]',
    '[class*="JobCard"]',
    'a[href*="/job/"]',
    'a[href*="/vagas/"]',
  ];

  const TITLE_SELECTORS = [
    '[data-testid="job-title"]',
    'h2[class*="job-title"]',
    'h2[class*="JobTitle"]',
    'h2',
    'h3',
  ];

  const COMPANY_SELECTORS = [
    '[data-testid="job-company"]',
    '[data-testid="company-name"]',
    'p[class*="company"]',
    'span[class*="company"]',
    'p[class*="Company"]',
    '[class*="company-name"]',
  ];

  const LOCATION_SELECTORS = [
    '[data-testid="job-location"]',
    '[class*="location"]',
    '[class*="Location"]',
    '[class*="locality"]',
  ];

  const MODALITY_SELECTORS = [
    '[data-testid="job-modality"]',
    '[class*="modality"]',
    '[class*="Modality"]',
    '[class*="remote"]',
    '[class*="hybrid"]',
    '[class*="presential"]',
    '[class*="on-site"]',
  ];

  function queryFirst(selectors, scope = document) {
    for (const sel of selectors) {
      try {
        const el = scope.querySelector(sel);
        if (el) return el;
      } catch (e) {
        // seletor invalido
      }
    }
    return null;
  }

  function queryAll(selectors, scope = document) {
    for (const sel of selectors) {
      try {
        const list = scope.querySelectorAll(sel);
        if (list.length > 0) return list;
      } catch (e) {
        // seletor invalido
      }
    }
    return [];
  }

  const SEARCH_INPUT_SELECTORS = [
    'input[data-testid="search-input"]',
    'input[placeholder*="Buscar"]',
    'input[placeholder*="Search"]',
    'input[type="search"]',
    'input[aria-label*="Buscar"]',
    'input[aria-label*="vagas"]',
    'input[aria-label*="Vagas"]',
  ];

  const SEARCH_BUTTON_SELECTORS = [
    'button[data-testid="search-button"]',
    'button[aria-label*="Buscar"]',
    'button[type="submit"]',
    'button[class*="search"]',
    'button[class*="Search"]',
  ];

  function obterCards() {
    return queryAll(CARD_SELECTORS);
  }

  async function realizarBusca(keyword) {
    log(`Buscando "${keyword}" na caixa de pesquisa...`);

    await delay(1000);
    if (!verificarCancelamento()) return false;

    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("term") === keyword) {
        log(`URL ja contem o termo "${keyword}" — verificando resultados`);
        return true;
      }
    } catch {}

    let searchInput = null;
    for (const sel of SEARCH_INPUT_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el) { searchInput = el; break; }
      } catch {}
    }

    if (!searchInput) {
      log("Caixa de busca nao encontrada na pagina");
      return false;
    }

    searchInput.focus();
    searchInput.click();
    await delay(300);
    if (!verificarCancelamento()) return false;

    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(searchInput, keyword);
    } else {
      searchInput.value = keyword;
    }

    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new Event("change", { bubbles: true }));

    await delay(200);
    if (!verificarCancelamento()) return false;

    searchInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, cancelable: true
    }));

    for (const sel of SEARCH_BUTTON_SELECTORS) {
      try {
        const btn = document.querySelector(sel);
        if (btn) {
          const estilo = window.getComputedStyle(btn);
          if (estilo.display !== "none" && estilo.visibility !== "hidden") {
            btn.click();
            log("Botao de busca clicado");
            break;
          }
        }
      } catch {}
    }

    log(`Keyword "${keyword}" inserida e Enter pressionado`);
    return true;
  }

  async function aguardarCards(timeoutMs = 25000) {
    log("Aguardando carregamento dos resultados...");
    const inicio = Date.now();

    while (Date.now() - inicio < timeoutMs) {
      if (!verificarCancelamento()) return { ok: false, motivo: "cancelado" };

      const cards = obterCards();
      if (cards.length > 0) {
        log(`${cards.length} card(s) encontrado(s)`);
        return { ok: true, quantidade: cards.length };
      }

      const vazio = document.querySelector(
        '[class*="no-result"], [class*="NoResult"], [class*="empty"], [data-testid*="no-result"]'
      );
      if (vazio && vazio.offsetParent !== null) {
        log("Pagina indica que nao ha resultados para esta busca");
        return { ok: false, motivo: "sem_resultados" };
      }

      await delay(600);
    }

    log("Timeout: resultados nao carregaram dentro do prazo");
    return { ok: false, motivo: "timeout" };
  }

  async function rolarParaMais(maxScrolls = 15) {
    log("Rolando pagina para carregar mais vagas...");
    let scrolls = 0;
    let ultimoTotal = 0;
    let estagnado = 0;

    while (scrolls < maxScrolls) {
      if (!verificarCancelamento()) return;

      const cards = obterCards();
      const total = cards.length;

      if (total > ultimoTotal) {
        log(`Scroll #${scrolls + 1}: ${total} vagas (${total - ultimoTotal} novas)`);
        ultimoTotal = total;
        estagnado = 0;
      } else {
        estagnado++;
      }

      window.scrollBy(0, 1000);
      await delay(1500);

      scrolls++;

      const noFim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
      if (noFim) {
        await delay(2500);
        if (obterCards().length <= total && estagnado >= 1) {
          log("Fim da pagina alcancado");
          break;
        }
      }

      if (estagnado >= 3) {
        log("Nenhuma nova vaga carregada apos 3 scrolls - interrompendo");
        break;
      }
    }

    log(`Scroll concluido: ${obterCards().length} vagas no total`);
  }

  function extrairVaga(card, keyword) {
    let url = card.href || card.getAttribute("href") || "";
    if (!url) return null;
    if (!url.startsWith("http")) {
      try { url = new URL(url, window.location.origin).href; } catch { return null; }
    }
    if (!url.includes("gupy.io")) return null;

    const elTitulo = queryFirst(TITLE_SELECTORS, card);
    let titulo = elTitulo ? (elTitulo.textContent || "").trim() : "";
    if (!titulo) {
      const texto = (card.textContent || "").trim();
      titulo = texto.split("\n")[0].trim();
    }
    if (!titulo || titulo.length < 3) return null;

    const elEmpresa = queryFirst(COMPANY_SELECTORS, card);
    let empresa = elEmpresa ? (elEmpresa.textContent || "").trim() : "";
    if (empresa === titulo) empresa = "";

    const elLocal = queryFirst(LOCATION_SELECTORS, card);
    let local = elLocal ? (elLocal.textContent || "").trim() : "";
    if (local === titulo || local === empresa) local = "";

    const elMod = queryFirst(MODALITY_SELECTORS, card);
    let modalidade = elMod ? (elMod.textContent || "").trim() : "";
    if (modalidade === titulo || modalidade === empresa || modalidade === local) modalidade = "";

    return {
      titulo,
      empresa,
      local,
      modalidade,
      url,
      origem: "gupy",
      keyword
    };
  }

  async function executarExtracao(keyword) {
    if (!verificarCancelamento()) return [];

    log(`Iniciando extracao para keyword: "${keyword}"`);

    const searchOk = await realizarBusca(keyword);
    if (!searchOk) {
      log(`Nao foi possivel buscar por "${keyword}"`);
      return [];
    }

    if (!verificarCancelamento()) return [];

    const espera = await aguardarCards(30000);
    if (!espera.ok) {
      log(`Sem resultados para "${keyword}": ${espera.motivo}`);
      return [];
    }

    if (!verificarCancelamento()) return [];

    await rolarParaMais(15);

    if (!verificarCancelamento()) return [];

    const cards = obterCards();
    log(`Processando ${cards.length} card(s)...`);

    const vagas = [];
    const urlsVistas = new Set();

    for (let i = 0; i < cards.length; i++) {
      if (!verificarCancelamento()) break;

      const card = cards[i];

      try {
        const estilo = window.getComputedStyle(card);
        if (estilo.display === "none" || estilo.visibility === "hidden") continue;
      } catch { continue; }

      const vaga = extrairVaga(card, keyword);
      if (!vaga) continue;

      if (urlsVistas.has(vaga.url)) continue;
      urlsVistas.add(vaga.url);

      if (typeof validarLocalizacaoSP === "function") {
        const locOk = validarLocalizacaoSP(vaga.local);
        if (!locOk.valido) {
          log(`[${vagas.length + 1}/${cards.length}] ${vaga.titulo}: ${locOk.motivo}`);
          continue;
        }
      }

      vagas.push(vaga);
      log(`[${vagas.length}/${cards.length}] ${vaga.titulo}${vaga.empresa ? ` - ${vaga.empresa}` : ""}`);
    }

    log(`Total: ${vagas.length} vagas extraidas para "${keyword}"`);
    return vagas;
  }

  function handleExtrair(keyword, sendResponse) {
    isRunning = true;
    log("=".repeat(45));
    log(`EXTRAIR GUPY | keyword: "${keyword}"`);
    log("=".repeat(45));

    executarExtracao(keyword)
      .then(vagas => {
        log(`Enviando ${vagas.length} vagas para o background`);
        sendResponse({ vagas });
      })
      .catch(err => {
        log(`Erro fatal: ${err.message}`);
        sendResponse({ vagas: [], erro: err.message });
      })
      .finally(() => {
        isRunning = false;
      });
  }

  function handleCheckApply(sendResponse) {
    const botoesSelectores = [
      'button[data-testid="apply-button"]',
      'button[class*="apply"]',
      'button[class*="Apply"]',
      'button[aria-label*="Candidatar"]',
      'button[aria-label*="Inscrever"]',
      'button[aria-label*="candidatar"]',
      'a[class*="apply"]',
      'a[class*="Apply"]',
    ];

    let temBotao = false;
    for (const sel of botoesSelectores) {
      try {
        const botoes = document.querySelectorAll(sel);
        for (const btn of botoes) {
          const estilo = window.getComputedStyle(btn);
          if (estilo.display === "none" || estilo.visibility === "hidden") continue;
          const texto = (btn.textContent || btn.getAttribute("aria-label") || "").toLowerCase();
          if (texto.includes("candidatar") || texto.includes("inscrever") || texto.includes("apply")) {
            temBotao = true;
            break;
          }
        }
      } catch {}
      if (temBotao) break;
    }

    log(temBotao ? "Botao de candidatura encontrado" : "Nenhum botao de candidatura");
    sendResponse({ temBotao, tipo: temBotao ? "external" : null });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.acao === "ping") {
      sendResponse({ status: "ok" });
      return false;
    }

    if (msg.acao === "extrair_gupy") {
      handleExtrair(msg.keyword || "", sendResponse);
      return true;
    }

    if (msg.acao === "check_apply") {
      handleCheckApply(sendResponse);
      return false;
    }

    if (msg.acao === "aplicar_agora") {
      log("Auto-apply nao suportado para Gupy");
      sendResponse({ status: "erro", motivo: "Auto-apply nao suportado para Gupy" });
      return false;
    }
  });

  log("Content script Gupy carregado");
})();
