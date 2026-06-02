(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const keywordsEl = $("keywords");
  const btnStart = $("btn-start");
  const btnStop = $("btn-stop");
  const progressoEl = $("progresso");
  const historicoEl = $("historico");
  const statusText = $("status-text");
  const statusDot = $("status-dot");
  const statEncontradas = $("stat-encontradas");
  const statCandidatadas = $("stat-candidatadas");
  const statHistorico = $("stat-historico");
  const filtroDataEl = $("filtro-data");
  const chipDataEl = $("chip-data");

  function filtroDataLabel(val) {
    if (val === "0") return "Qualquer data";
    if (val === "1") return "24 horas";
    return val + " dias";
  }

  filtroDataEl.addEventListener("change", () => {
    const v = filtroDataEl.value;
    chipDataEl.innerHTML = `<span class="icon">📅</span> ${filtroDataLabel(v)}`;
    chrome.storage.local.set({ filtro_data: v });
  });

  let running = false;
  let historicoInterval = null;
  let encontradas = 0;
  let candidatadas = 0;

  /* ── Platform chips ── */
  document.querySelectorAll(".platform-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const cb = chip.querySelector("input[type=checkbox]");
      cb.checked = !cb.checked;
      chip.classList.toggle("active", cb.checked);
    });
  });

  /* ── Terminal log ── */
  let terminalInited = false;
  function logTerminal(msg, tipo) {
    if (!terminalInited) {
      progressoEl.innerHTML = "";
      terminalInited = true;
    }
    const linha = document.createElement("div");
    linha.className = "line" + (tipo ? " " + tipo : "");
    linha.textContent = msg;
    progressoEl.appendChild(linha);
    progressoEl.scrollTop = progressoEl.scrollHeight;
    if (progressoEl.children.length > 50) {
      progressoEl.removeChild(progressoEl.firstChild);
    }
  }

  /* ── Status ── */
  function setStatus(rodando) {
    running = rodando;
    if (rodando) {
      statusText.textContent = "running";
      statusDot.className = "status-dot running";
      btnStart.disabled = true;
      btnStop.disabled = false;
    } else {
      statusText.textContent = "stopped";
      statusDot.className = "status-dot stopped";
      btnStart.disabled = false;
      btnStop.disabled = true;
    }
  }

  /* ── History ── */
  async function carregarHistorico() {
    try {
      const vagas = await chrome.runtime.sendMessage({ acao: "get_historico" });
      if (!vagas || vagas.length === 0) {
        historicoEl.innerHTML = `<div class="history-empty">
          <span class="icon">○</span>
          <span>Nenhuma vaga processada ainda</span>
        </div>`;
        statHistorico.textContent = "0";
        return;
      }
      statHistorico.textContent = vagas.length;
      const max = Math.min(vagas.length, 50);
      historicoEl.innerHTML = vagas.slice(0, max).map((v, idx) => {
        const badgeClass = v.status === "Candidatura enviada" ? "badge-candidatado" :
                          v.status === "Redirecionamento externo" ? "badge-nao_candidatado" :
                          v.status === "Falha ao enviar" ? "badge-erro" : "badge-nao_candidatado";
        const badgeText = v.status === "Candidatura enviada" ? "✓ enviada" :
                         v.status === "Redirecionamento externo" ? "→ externo" :
                         v.status === "Falha ao enviar" ? "✗ falha" : "─";
        const jobId = v.id || Date.now() + idx;
        return `<div class="history-item">
          <span class="title"><a href="${v.url}" target="_blank">${v.titulo || "—"}</a></span>
          <span class="company">${v.empresa || ""}</span>
          <span class="badge ${badgeClass}">${badgeText}</span>
          <button class="btn-remove" data-id="${jobId}" title="Remover">✕</button>
        </div>`;
      }).join("");

      historicoEl.querySelectorAll(".btn-remove").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = parseInt(btn.dataset.id);
          await chrome.runtime.sendMessage({ acao: "remover_vaga", id });
          carregarHistorico();
        });
      });
    } catch {}
  }

  /* ── Start ── */
  btnStart.addEventListener("click", iniciar);

  function iniciar() {
    const keywords = keywordsEl.value
      .split("\n")
      .map(k => k.trim())
      .filter(k => k.length > 0 && !k.startsWith("#"));

    if (keywords.length === 0) {
      logTerminal("informe pelo menos uma palavra-chave", "error");
      return;
    }
    const linkedin = $("check-linkedin").checked;
    const gupy = $("check-gupy").checked;
    if (!linkedin && !gupy) {
      logTerminal("selecione pelo menos uma plataforma", "error");
      return;
    }

    encontradas = 0;
    candidatadas = 0;
    statEncontradas.textContent = "0";
    statCandidatadas.textContent = "0";

    setStatus(true);
    logTerminal(`iniciando busca: ${keywords.length} keywords`);

    const filtroData = parseInt(filtroDataEl.value) || 7;
    chrome.storage.local.set({ ultima_keywords: keywordsEl.value, filtro_data: filtroDataEl.value });
    chrome.runtime.sendMessage({
      acao: "iniciar",
      palavrasChave: keywords,
      plataformas: { linkedin, gupy },
      filtroData
    });

    if (!historicoInterval) {
      historicoInterval = setInterval(carregarHistorico, 3000);
    }
  }

  /* ── Stop ── */
  btnStop.addEventListener("click", parar);

  function parar() {
    chrome.runtime.sendMessage({ acao: "parar" });
    setStatus(false);
    logTerminal("busca interrompida pelo usuario", "error");
  }

  /* ── Keyboard shortcuts ── */
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!btnStart.disabled) iniciar();
    }
    if (e.key === "Escape") {
      if (!btnStop.disabled) parar();
    }
  });

  /* ── Listen messages ── */
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.acao === "progresso") {
      const texto = msg.texto || "";

      if (msg.stats) {
        encontradas = msg.stats.encontradas || encontradas;
        candidatadas = msg.stats.candidatadas || candidatadas;
        statEncontradas.textContent = encontradas;
        statCandidatadas.textContent = candidatadas;
      }

      const tipo = texto.startsWith("Concluído") ? "done" :
                   texto.includes("interrompida") ? "error" : null;
      logTerminal(texto, tipo);

      if (tipo === "done") {
        setStatus(false);
      }
    }
  });

  /* ── Init ── */
  chrome.storage.local.get(["ultima_keywords", "filtro_data"], r => {
    if (r.ultima_keywords) {
      keywordsEl.value = r.ultima_keywords;
    }
    if (r.filtro_data) {
      const v = r.filtro_data;
      if (["0","1","3","7","14","30"].includes(v)) {
        filtroDataEl.value = v;
        chipDataEl.innerHTML = `<span class="icon">📅</span> ${filtroDataLabel(v)}`;
      }
    }
  });

  carregarHistorico();
  historicoInterval = setInterval(carregarHistorico, 3000);
  logTerminal("pronto • ⌘⏎ para iniciar");
})();
