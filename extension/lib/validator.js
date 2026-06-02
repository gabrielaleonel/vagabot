const CIDADES_SP = [
  "são paulo", "sao paulo", "são bernardo", "sao bernardo",
  "santo andré", "santo andre", "são caetano", "sao caetano",
  "diadema", "osasco", "campinas", "barueri",
  "guarulhos", "taboão", "taboao", "embu",
  "itapecerica", "cotia", "carapicuíba", "jundiaí", "jundiai",
  "sorocaba", "ribeirão preto", "ribeirao preto", "são josé dos campos", "sao jose dos campos",
  "são josé do rio preto", "sao jose do rio preto", "mogi das cruzes",
  "mauá", "maua", "santo andré", "santo andre",
  "americana", "piracicaba", "baixada santista", "santos",
  "são vicente", "sao vicente", "praia grande", "guarujá", "guaruja",
  "abc", "abc paulista", "grande são paulo", "grande sao paulo",
  "interior de são paulo", "interior de sao paulo",
  "capital", "sp", "estado de são paulo", "estado de sao paulo",
  "são paulo - sp", "sao paulo - sp", "sp - brasil",
  "brasil", "brazil", "remoto", "home office", "home-office",
  "e-commerce", "ecommerce"
];

function validarLocalizacaoSP(local) {
  if (!local || !local.trim()) return { valido: true, motivo: "Localização não informada — aceito por precaução" };
  const t = local.toLowerCase().trim();
  const temSP = CIDADES_SP.some(c => t.includes(c));
  if (temSP) return { valido: true, motivo: `Localização em SP: "${local}"` };
  return { valido: false, motivo: `Localização fora de SP ignorada: "${local}"` };
}

function parseDiasAtras(dataTexto) {
  if (!dataTexto || !dataTexto.trim()) return -1;
  const t = dataTexto.toLowerCase().trim();

  // "Publicada hoje", "Posted today"
  if (t.includes("hoje") || t.includes("today")) return 0;

  // "Publicada ontem", "Posted yesterday"
  if (t.includes("ontem") || t.includes("yesterday")) return 1;

  // "há 1 hora", "há 5 horas", "1 hour ago", "3 hours ago", "Publicada há 1 hora"
  const horasMatch = t.match(/(?:há|ha|posted)\s*(\d+)\s*horas?|(\d+)\s*hours?\s*ago/i);
  if (horasMatch) return 0;

  // "há 1 dia", "há 3 dias", "1 day ago", "3 days ago", "Publicada há 3 dias"
  const diasMatch = t.match(/(?:há|ha|posted)\s*(\d+)\s*dias?|(\d+)\s*days?\s*ago/i);
  if (diasMatch) {
    const d = parseInt(diasMatch[1] || diasMatch[2]);
    if (!isNaN(d)) return d;
  }

  // "1 dia", "2 dias" (alone, no "há" prefix)
  const diasAlone = t.match(/^(\d+)\s*dias?$/);
  if (diasAlone) return parseInt(diasAlone[1]);

  // "há 1 semana", "há 2 semanas", "1 week ago", "2 weeks ago", "Publicada há 1 semana"
  const semanasMatch = t.match(/(?:há|ha|posted)\s*(\d+)\s*semanas?|(\d+)\s*weeks?\s*ago/i);
  if (semanasMatch) {
    const s = parseInt(semanasMatch[1] || semanasMatch[2]);
    if (!isNaN(s)) return s * 7;
  }

  // "semana passada", "last week"
  if (t.includes("semana passada") || t.includes("last week")) return 7;

  // "1 semana" (alone)
  const semAlone = t.match(/^(\d+)\s*semana/);
  if (semAlone) return parseInt(semAlone[1]) * 7;

  // "há 1 mês", "1 month ago", "mês passado", "last month"
  const mesesMatch = t.match(/(?:há|ha)\s*(\d+)\s*mês|(\d+)\s*months?\s*ago/i);
  if (mesesMatch) return 31;
  if (t.includes("mês passado") || t.includes("last month") || t.includes("mês") || t.includes("month")) return 31;

  // minutos, momentos — 0 dias
  if (t.includes("minuto") || t.includes("minute") || t.includes("momento") || t.includes("now") || t.includes("agora")) return 0;

  // "há 1 minuto" etc — catch-all for "há X"
  const haMatch = t.match(/(?:há|ha|posted)\s*(\d+)\s*/i);
  if (haMatch) {
    const num = parseInt(haMatch[1]);
    if (num <= 24) return 0; // provavelmente horas
    return num; // dias
  }

  return -1;
}

function validarDataPublicacao(dataTexto, diasMax = 7) {
  if (!dataTexto || !dataTexto.trim()) return { valido: true, motivo: "Data não informada — aceito por precaução" };

  // diasMax === 0 significa "qualquer data" — aceitar tudo
  if (diasMax === 0) return { valido: true, motivo: `Filtro de data desligado — aceito` };

  const dias = parseDiasAtras(dataTexto);

  if (dias === -1) {
    // Tenta parse de data ISO
    const t = dataTexto.toLowerCase().trim();
    const isoMatch = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const data = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
      const diff = Date.now() - data.getTime();
      const diffDias = diff / (24 * 60 * 60 * 1000);
      if (diffDias > diasMax) return { valido: false, motivo: `Vaga de ${isoMatch[0]} — ${Math.round(diffDias)} dias, excede filtro de ${diasMax} dias` };
      return { valido: true, motivo: `Vaga de ${isoMatch[0]} — dentro do filtro de ${diasMax} dias` };
    }
    return { valido: true, motivo: "Data não reconhecida — aceito por precaução" };
  }

  if (dias <= diasMax) {
    return { valido: true, motivo: `Vaga publicada há ${dias} dia(s) — dentro do filtro de ${diasMax} dias` };
  }

  return { valido: false, motivo: `Vaga publicada há ${dias} dia(s) — excede filtro de ${diasMax} dias` };
}

const PALAVRAS_POSITIVAS = [
  "suporte técnico", "help desk", "service desk",
  "analista de suporte", "suporte de sistemas",
  "infraestrutura", "estágio ti", "estágio suporte",
  "estágio desenvolvimento", "desenvolvimento de software",
  "engenharia de software", "cibersegurança",
  "estagiária", "estagiário", "estágio",
  "desenvolvedora", "desenvolvedor", "programadora",
  "analista de sistemas", "qa", "qualidade de software",
  "testes", "automação", "dados", "bi", "cloud",
  "redes", "segurança", "banco de dados", "sql",
  "front-end", "back-end", "full stack", "mobile"
];

const PALAVRAS_NEGATIVAS = [
  "vendedor", "telemarketing", "consultor comercial",
  "corretor", "motorista", "enfermagem",
  "professor", "operador de caixa", "auxiliar de limpeza",
  "copeira", "porteiro", "zelador", "cozinheira",
  "garçom", "atendente", "recepcionista",
  "auxiliar administrativo", "office boy", "jovem aprendiz",
  "padaria", "açougue", "mercearia", "supermercado",
  "call center", "sac", "televendas"
];

function validarElemento(elemento) {
  if (!elemento) return { valido: false, motivo: "Elemento nulo" };
  try {
    const estilo = window.getComputedStyle(elemento);
    if (estilo.display === "none") return { valido: false, motivo: "Elemento oculto (display:none)" };
    if (estilo.visibility === "hidden") return { valido: false, motivo: "Elemento invisível (visibility:hidden)" };
    if (elemento.offsetWidth === 0 || elemento.offsetHeight === 0) {
      return { valido: false, motivo: "Elemento sem tamanho (width/height = 0)" };
    }
    return { valido: true, motivo: "Elemento visível e válido" };
  } catch (e) {
    return { valido: false, motivo: `Erro ao validar: ${e.message}` };
  }
}

function validarLinkVaga(href) {
  if (!href) return false;
  const url = href.toLowerCase();
  if (url.includes("/jobs/") || url.includes("/vagas/")) return true;
  if (url.includes("linkedin.com") && url.includes("jobs")) return true;
  if (url.includes("gupy.io") && (url.includes("jobs") || url.includes("vagas"))) return true;
  return false;
}

function filtrarPorPalavras(titulo) {
  if (!titulo) return { valido: false, motivo: "Título vazio" };
  const t = titulo.toLowerCase();

  const positiva = PALAVRAS_POSITIVAS.some(p => t.includes(p));
  if (!positiva) return { valido: false, motivo: `Nenhuma palavra-chave positiva encontrada em: "${t}"` };

  const negativa = PALAVRAS_NEGATIVAS.some(n => t.includes(n));
  if (negativa) return { valido: false, motivo: `Palavra-chave negativa encontrada em: "${t}"` };

  return { valido: true, motivo: "Filtro aprovado" };
}

function tentarSeletores(seletores, scope = document) {
  for (const seletor of seletores) {
    try {
      const el = scope.querySelector(seletor);
      if (el) return el;
    } catch (e) {
      console.warn(`[Validator] Seletor inválido: ${seletor}`, e.message);
    }
  }
  return null;
}

function tentarSeletoresTodos(seletores, scope = document) {
  for (const seletor of seletores) {
    try {
      const lista = scope.querySelectorAll(seletor);
      if (lista.length > 0) return lista;
    } catch (e) {
      console.warn(`[Validator] Seletor inválido: ${seletor}`, e.message);
    }
  }
  return [];
}

function log(tag, mensagem, dados = null) {
  const cor = tag === "LINKEDIN" ? "\x1b[34m" :
              tag === "GUPY" ? "\x1b[32m" :
              tag === "POPUP" ? "\x1b[35m" :
              tag === "BACKGROUND" ? "\x1b[33m" : "\x1b[37m";
  const prefixo = `[${tag}]`;
  if (dados) {
    console.log(`${prefixo} ${mensagem}`, dados);
  } else {
    console.log(`${prefixo} ${mensagem}`);
  }
}
