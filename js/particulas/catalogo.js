/**
 * Catálogo data-driven de presets de partículas.
 * Defaults embutidos = comportamento legado; JSON sobrescreve no boot.
 */

const IDS_ELEMENTO = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

/** @type {Record<string, object>} */
const ELEMENTOS_PADRAO = {
  normal: {
    primaria: "#a8a878",
    secundaria: "#c6c6a7",
    nucleo: "#f0f0e8",
    rastro: { taxa: 20, vida: 0.3, dispersao: 0.8 },
    impacto: { particulas: 24, raio: 0.42, duracao: 0.35, gravidade: 0 },
  },
  fire: {
    primaria: "#f08030",
    secundaria: "#f8d030",
    nucleo: "#fff4c8",
    rastro: { taxa: 28, vida: 0.4, dispersao: 1.4 },
    impacto: { particulas: 36, raio: 0.54, duracao: 0.45, gravidade: 2.2 },
  },
  water: {
    primaria: "#6890f0",
    secundaria: "#98d8d8",
    nucleo: "#d0f0ff",
    rastro: { taxa: 22, vida: 0.35, dispersao: 0.6 },
    impacto: { particulas: 30, raio: 0.46, duracao: 0.4, gravidade: 3.2 },
  },
  electric: {
    primaria: "#f8d030",
    secundaria: "#fff080",
    nucleo: "#ffffc0",
    rastro: { taxa: 32, vida: 0.2, dispersao: 2 },
    impacto: { particulas: 40, raio: 0.5, duracao: 0.3, gravidade: 0 },
  },
  grass: {
    primaria: "#78c850",
    secundaria: "#a8e060",
    nucleo: "#e0ffc0",
    rastro: { taxa: 18, vida: 0.45, dispersao: 1 },
    impacto: { particulas: 28, raio: 0.44, duracao: 0.5, gravidade: 1.6 },
  },
  ice: {
    primaria: "#98d8d8",
    secundaria: "#c0f0f0",
    nucleo: "#e8ffff",
    rastro: { taxa: 16, vida: 0.5, dispersao: 0.5 },
    impacto: { particulas: 32, raio: 0.48, duracao: 0.55, gravidade: 0 },
  },
  fighting: {
    primaria: "#c03028",
    secundaria: "#e85850",
    nucleo: "#ffc8c0",
    rastro: { taxa: 24, vida: 0.25, dispersao: 1.6 },
    impacto: { particulas: 34, raio: 0.52, duracao: 0.35, gravidade: 1.1 },
  },
  poison: {
    primaria: "#a040a0",
    secundaria: "#c060c0",
    nucleo: "#f0c0f0",
    rastro: { taxa: 20, vida: 0.55, dispersao: 0.9 },
    impacto: { particulas: 30, raio: 0.46, duracao: 0.6, gravidade: -0.8 },
  },
  ground: {
    primaria: "#e0c068",
    secundaria: "#c8a848",
    nucleo: "#fff0c0",
    rastro: { taxa: 14, vida: 0.4, dispersao: 1.2 },
    impacto: { particulas: 36, raio: 0.56, duracao: 0.5, gravidade: 2.8 },
  },
  flying: {
    primaria: "#a890f0",
    secundaria: "#c8b0f8",
    nucleo: "#f0e8ff",
    rastro: { taxa: 26, vida: 0.3, dispersao: 1.8 },
    impacto: { particulas: 26, raio: 0.4, duracao: 0.35, gravidade: -0.55 },
  },
  psychic: {
    primaria: "#f85888",
    secundaria: "#f898a8",
    nucleo: "#ffe0e8",
    rastro: { taxa: 24, vida: 0.45, dispersao: 1.5 },
    impacto: { particulas: 32, raio: 0.48, duracao: 0.45, gravidade: 0 },
  },
  bug: {
    primaria: "#a8b820",
    secundaria: "#c8d830",
    nucleo: "#f0ffc0",
    rastro: { taxa: 22, vida: 0.35, dispersao: 1.1 },
    impacto: { particulas: 28, raio: 0.42, duracao: 0.4, gravidade: 1.4 },
  },
  rock: {
    primaria: "#b8a038",
    secundaria: "#d0c060",
    nucleo: "#fff8d0",
    rastro: { taxa: 12, vida: 0.35, dispersao: 0.7 },
    impacto: { particulas: 38, raio: 0.52, duracao: 0.4, gravidade: 3.8 },
  },
  ghost: {
    primaria: "#705898",
    secundaria: "#9070b8",
    nucleo: "#e0d0f8",
    rastro: { taxa: 18, vida: 0.6, dispersao: 1.3 },
    impacto: { particulas: 26, raio: 0.44, duracao: 0.55, gravidade: -0.4 },
  },
  dragon: {
    primaria: "#7038f8",
    secundaria: "#9070ff",
    nucleo: "#e0d0ff",
    rastro: { taxa: 26, vida: 0.4, dispersao: 1.6 },
    impacto: { particulas: 40, raio: 0.58, duracao: 0.5, gravidade: 0 },
  },
  dark: {
    primaria: "#705848",
    secundaria: "#907868",
    nucleo: "#d0c0b0",
    rastro: { taxa: 16, vida: 0.45, dispersao: 0.8 },
    impacto: { particulas: 30, raio: 0.46, duracao: 0.45, gravidade: 0.8 },
  },
  steel: {
    primaria: "#b8b8d0",
    secundaria: "#d8d8e8",
    nucleo: "#ffffff",
    rastro: { taxa: 14, vida: 0.3, dispersao: 0.4 },
    impacto: { particulas: 34, raio: 0.44, duracao: 0.35, gravidade: 0 },
  },
  fairy: {
    primaria: "#ee99ac",
    secundaria: "#ffb8c8",
    nucleo: "#fff0f4",
    rastro: { taxa: 28, vida: 0.5, dispersao: 1.4 },
    impacto: { particulas: 32, raio: 0.46, duracao: 0.5, gravidade: -0.3 },
  },
};

const PASSO_PADRAO = {
  andar: {
    intervalo: 0.4,
    bolas: 1,
    tam0: 0.36,
    tam1: 0.86,
    espalha: 0.16,
    dur: 0.58,
    atras: 0.14,
    alfa: 0.55,
  },
  correr: {
    intervalo: 0.12,
    bolas: 2,
    tam0: 0.42,
    tam1: 1.12,
    espalha: 0.36,
    dur: 0.7,
    atras: 0.22,
    alfa: 0.68,
  },
};

const CAMPO_PADRAO = {
  fagulha: {
    baseBaixa: 0.28,
    baseAlta: 1.05,
    espalha: 0.25,
    alturaExtraBaixa: 0.35,
    alturaExtraAlta: 1.3,
    velMin: 0.15,
    velExtra: 0.35,
    vzMin: 0.4,
    vzExtra: 0.7,
    vidaMin: 0.4,
    vidaExtra: 0.3,
    chanceFuma: 0.4,
    chanceQuente: 0.7,
    corFumaR: 0.32,
    corFumaG: 0.28,
    corFumaB: 0.24,
    corQuenteR: 1,
    corQuenteG: 0.42,
    corQuenteB: 0.08,
    corMornaR: 0.95,
    corMornaG: 0.72,
    corMornaB: 0.2,
  },
  fagulhaForte: {
    vzExtra: 1.4,
    vidaMin: 0.55,
    vidaExtra: 0.35,
  },
  lasca: {
    zMin: 0.35,
    zExtra: 0.2,
    velMin: 0.8,
    velExtra: 1.6,
    vzMin: 1.4,
    vzExtra: 1.6,
    vidaMin: 0.32,
    vidaExtra: 0.22,
    corR: 0.62,
    corG: 0.56,
    corB: 0.48,
    grav: 5,
  },
};

const AGUA_PADRAO = {
  onda: {
    intervalo: 0.12,
    intervaloParado: 0.55,
    vida: 0.9,
    rx: 0.7,
    cresce: 2.6,
    ry: 0.38,
    atras: 0.25,
    passo: 0.022,
    imersaoMin: 0.12,
    offsetLamina: 0.18,
  },
  gota: {
    vida: 0.35,
    grav: 14,
    rajada: 5,
    pinga: 0.4,
    molhaSeg: 5,
  },
  pegada: {
    carga: 6,
    dist: 0.62,
    intervalo: 0.14,
    vel: 0.2,
    vida: 6.2,
    tam: 0.28,
    lateral: 0.14,
    cheio: 0.55,
  },
  nado: {
    bobA: 0.05,
    bobB: 0.03,
    bobParado: 0.62,
  },
};

const BOLA_PADRAO = {
  envio: {
    raio: 0.4,
    vidaAnel: 0.45,
    vidaFlash: 0.4,
    brancoR: 255,
    brancoG: 252,
    brancoB: 240,
    vermelhoR: 248,
    vermelhoG: 113,
    vermelhoB: 113,
    faiscaConta: 18,
    faiscaVida: 0.48,
    faiscaVelMin: 2.8,
    faiscaVelMax: 7.2,
    faiscaTamMin: 0.05,
    faiscaTamMax: 0.13,
  },
  recolher: {
    raio: 0.4,
    vidaAnel: 0.42,
    vidaFlash: 0.35,
    brancoR: 255,
    brancoG: 248,
    brancoB: 230,
    vermelhoR: 239,
    vermelhoG: 68,
    vermelhoB: 68,
    faiscaConta: 20,
    faiscaVida: 0.5,
    faiscaVelMin: 1.8,
    faiscaVelMax: 4.6,
    faiscaTamMin: 0.04,
    faiscaTamMax: 0.11,
    puxa: 14,
  },
  shiny: {
    douradoR: 250,
    douradoG: 204,
    douradoB: 21,
    arrasto: 3.8,
  },
};

function clonar(v) {
  return JSON.parse(JSON.stringify(v));
}

function mesclarObj(base, extra) {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return clonar(base);
  const out = clonar(base);
  for (const k of Object.keys(extra)) {
    const ev = extra[k];
    if (ev && typeof ev === "object" && !Array.isArray(ev) && out[k] && typeof out[k] === "object") {
      out[k] = mesclarObj(out[k], ev);
    } else if (ev !== undefined) {
      out[k] = ev;
    }
  }
  return out;
}

function corOk(c) {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizarElemento(id, raw, padrao) {
  const base = padrao || ELEMENTOS_PADRAO.normal;
  const el = {
    id,
    primaria: corOk(raw?.primaria) ? raw.primaria : base.primaria,
    secundaria: corOk(raw?.secundaria) ? raw.secundaria : base.secundaria,
    nucleo: corOk(raw?.nucleo) ? raw.nucleo : base.nucleo,
    rastro: {
      taxa: num(raw?.rastro?.taxa, base.rastro.taxa),
      vida: num(raw?.rastro?.vida, base.rastro.vida),
      dispersao: num(raw?.rastro?.dispersao, base.rastro.dispersao),
    },
    impacto: {
      particulas: num(raw?.impacto?.particulas, base.impacto.particulas),
      raio: num(raw?.impacto?.raio, base.impacto.raio),
      duracao: num(raw?.impacto?.duracao, base.impacto.duracao),
      gravidade: num(raw?.impacto?.gravidade, base.impacto.gravidade ?? 0),
    },
  };
  return el;
}

function construirPadrao() {
  const elementos = {};
  for (let i = 0; i < IDS_ELEMENTO.length; i++) {
    const id = IDS_ELEMENTO[i];
    elementos[id] = normalizarElemento(id, ELEMENTOS_PADRAO[id], ELEMENTOS_PADRAO[id]);
  }
  return {
    versao: 1,
    combate: { elementos },
    passo: clonar(PASSO_PADRAO),
    campo: clonar(CAMPO_PADRAO),
    agua: clonar(AGUA_PADRAO),
    bola: clonar(BOLA_PADRAO),
  };
}

/** Defaults congelados para reset no editor. */
export const DEFAULTS_PARTICULAS = Object.freeze(construirPadrao());

/** @type {ReturnType<typeof construirPadrao>} */
let dados = clonar(DEFAULTS_PARTICULAS);

/** @type {Promise<object> | null} */
let promessa = null;

/**
 * Normaliza e aplica um objeto de catálogo (editor / fetch).
 * @param {object} bruto
 */
export function aplicarCatalogoParticulas(bruto) {
  const base = construirPadrao();
  if (!bruto || typeof bruto !== "object") {
    dados = base;
    return dados;
  }
  base.versao = (num(bruto.versao, 1) | 0) || 1;

  const srcEl = bruto.combate?.elementos || {};
  for (let i = 0; i < IDS_ELEMENTO.length; i++) {
    const id = IDS_ELEMENTO[i];
    base.combate.elementos[id] = normalizarElemento(
      id,
      srcEl[id],
      ELEMENTOS_PADRAO[id],
    );
  }

  base.passo = {
    andar: mesclarObj(PASSO_PADRAO.andar, bruto.passo?.andar),
    correr: mesclarObj(PASSO_PADRAO.correr, bruto.passo?.correr),
  };
  base.campo = {
    fagulha: mesclarObj(CAMPO_PADRAO.fagulha, bruto.campo?.fagulha),
    fagulhaForte: mesclarObj(CAMPO_PADRAO.fagulhaForte, bruto.campo?.fagulhaForte),
    lasca: mesclarObj(CAMPO_PADRAO.lasca, bruto.campo?.lasca),
  };
  base.agua = {
    onda: mesclarObj(AGUA_PADRAO.onda, bruto.agua?.onda),
    gota: mesclarObj(AGUA_PADRAO.gota, bruto.agua?.gota),
    pegada: mesclarObj(AGUA_PADRAO.pegada, bruto.agua?.pegada),
    nado: mesclarObj(AGUA_PADRAO.nado, bruto.agua?.nado),
  };
  base.bola = {
    envio: mesclarObj(BOLA_PADRAO.envio, bruto.bola?.envio),
    recolher: mesclarObj(BOLA_PADRAO.recolher, bruto.bola?.recolher),
    shiny: mesclarObj(BOLA_PADRAO.shiny, bruto.bola?.shiny),
  };
  dados = base;
  return dados;
}

export function catalogoParticulas() {
  return dados;
}

export function defaultsParticulas() {
  return clonar(DEFAULTS_PARTICULAS);
}

export function idsElemento() {
  return IDS_ELEMENTO;
}

/**
 * @param {string} tipo
 */
export function elementoDe(tipo) {
  return dados.combate.elementos[tipo] || dados.combate.elementos.normal;
}

/**
 * @param {"andar"|"correr"} modo
 */
export function presetPasso(modo) {
  return modo === "correr" ? dados.passo.correr : dados.passo.andar;
}

/**
 * @param {"fagulha"|"fagulhaForte"|"lasca"} id
 */
export function presetCampo(id) {
  return dados.campo[id] || dados.campo.fagulha;
}

/**
 * @param {"onda"|"gota"|"pegada"|"nado"} secao
 */
export function presetAgua(secao) {
  return dados.agua[secao] || dados.agua.onda;
}

/**
 * @param {"envio"|"recolher"|"shiny"} id
 */
export function presetBola(id) {
  return dados.bola[id] || dados.bola.envio;
}

export function carregarCatalogoParticulas() {
  if (promessa) return promessa;
  promessa = fetch("/assets/particulas/catalogo.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      if (json) aplicarCatalogoParticulas(json);
      return dados;
    })
    .catch(() => dados);
  return promessa;
}

/** Recarrega do disco (editor após salvar / hot). */
export function recarregarCatalogoParticulas() {
  promessa = null;
  return carregarCatalogoParticulas();
}
