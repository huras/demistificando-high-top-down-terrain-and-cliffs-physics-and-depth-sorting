/**
 * Catálogo data-driven de efeitos de combate (BattleParticles).
 * Seed mínimo sync; JSON em /assets/efeitos/catalogo.json sobrescreve no boot.
 */

const TILE_BP = 96;
function tam(frame, escalaPx) {
  return (frame * escalaPx) / TILE_BP;
}

/** Seed sync — paridade com assets/efeitos/catalogo.json (folha + disparo). */
const DEFAULTS = {
  versao: 1,
  aliases: {
    ember: "ember",
    razorLeaf: "razor-leaf",
    "razor-leaf": "razor-leaf",
    bubble: "bubble",
    bubblebeam: "bubblebeam",
    bubbleBeam: "bubblebeam",
    flamethrower: "flamethrower",
    gust: "gust",
    wingAttack: "gust",
    "wing-attack": "gust",
    waterGun: "water-gun",
    "water-gun": "water-gun",
    swift: "swift",
    solarBeam: "solar-beam",
    "solar-beam": "solar-beam",
    hyperBeam: "hyper-beam",
    "hyper-beam": "hyper-beam",
    waterPulse: "water-pulse",
    "water-pulse": "water-pulse",
    waterCannon: "water-cannon",
    "water-cannon": "water-cannon",
    iceBeam: "ice-beam",
    "ice-beam": "ice-beam",
    psybeam: "psybeam",
    thunder: "thunder",
    thunderShock: "thunder-shock",
    "thunder-shock": "thunder-shock",
    spark: "spark",
    growl: "growl",
    tailWhip: "tail-whip",
    "tail-whip": "tail-whip",
    scratch: "scratch",
    tackle: "tackle",
    quickAttack: "quick-attack",
    "quick-attack": "quick-attack",
    bodySlam: "body-slam",
    "body-slam": "body-slam",
    leechSeed: "leech-seed",
    "leech-seed": "leech-seed",
    absorb: "absorb",
    poisonPowder: "poison-powder",
    "poison-powder": "poison-powder",
    sleepPowder: "sleep-powder",
    "sleep-powder": "sleep-powder",
    stunSpore: "stun-spore",
    "stun-spore": "stun-spore",
    spore: "spore",
    thunderWave: "thunder-wave",
    "thunder-wave": "thunder-wave",
    willOWisp: "will-o-wisp",
    "will-o-wisp": "will-o-wisp",
  },
  efeitos: {
    ember: {
      id: "ember",
      nome: "Ember",
      kind: "projetil",
      elemento: "fire",
      folha: {
        url: "assets/effects/golpes/ember.png",
        fw: 32,
        fh: 32,
        frames: 5,
        duracaoFrame: 0.08,
        animar: false,
        escalaVoo: tam(32, 6.6),
        escalaImpacto: tam(32, 2.2),
        aponta: "cima",
        offsetAngulo: Math.PI,
        vertical: false,
        impacto: "folha",
        frameImpacto: 0,
      },
      disparo: { tipo: "leque", n: 3, graus: 8 },
    },
    "razor-leaf": {
      id: "razor-leaf",
      nome: "Razor Leaf",
      kind: "projetil",
      elemento: "grass",
      folha: {
        url: "assets/effects/golpes/razor-leaf.png",
        fw: 16,
        fh: 16,
        frames: 9,
        duracaoFrame: 0.06,
        animar: true,
        giro: 4.8,
        escalaVoo: tam(16, 4.5),
        escalaImpacto: tam(16, 4.5),
        aponta: "direita",
        offsetAngulo: 0,
        vertical: false,
        impacto: "cravar",
        duracaoImpacto: 0.95,
      },
      disparo: { tipo: "leque", n: 3, graus: 8, vel: 1170 / 96, giro: 4.8 },
    },
    bubble: {
      id: "bubble",
      nome: "Bubble",
      kind: "projetil",
      elemento: "water",
      folha: {
        url: "assets/effects/golpes/bubble.png",
        fw: 32,
        fh: 32,
        frames: 5,
        duracaoFrame: 0.07,
        animar: false,
        escalaVoo: tam(32, 2.2),
        escalaImpacto: tam(32, 2.6),
        aponta: "direita",
        offsetAngulo: 0,
        vertical: true,
        impacto: "folha",
        frameImpacto: 1,
      },
      disparo: { tipo: "leque", n: 2, graus: 10, vel: (1170 / 96) * 0.85, amp: 22 / 96, freq: 2.1 },
    },
    bubblebeam: {
      id: "bubblebeam",
      nome: "Bubble Beam",
      kind: "jato",
      elemento: "water",
      folha: {
        url: "assets/effects/golpes/bubble.png",
        fw: 32,
        fh: 32,
        frames: 5,
        duracaoFrame: 0.07,
        animar: true,
        escalaVoo: tam(32, 2.2),
        escalaImpacto: tam(32, 2.6),
        aponta: "direita",
        offsetAngulo: 0,
        vertical: true,
        impacto: "folha",
        frameImpacto: 1,
      },
      disparo: { tipo: "jato", n: 8, dur: 0.55, intervalo: 0.075, graus: 6, vel: (1170 / 96) * 0.7 },
    },
    flamethrower: {
      id: "flamethrower",
      nome: "Flamethrower",
      kind: "jato",
      elemento: "fire",
      folha: {
        url: "assets/effects/golpes/flamethrower.png",
        fw: 32,
        fh: 32,
        frames: 4,
        duracaoFrame: 0.07,
        animar: true,
        escalaVoo: tam(32, 0.85),
        escalaImpacto: tam(32, 2.8),
        aponta: "direita",
        offsetAngulo: 0,
        vertical: true,
        impacto: "folha",
        frameImpacto: 0,
      },
      disparo: { tipo: "jato", n: 8, dur: 0.55, intervalo: 0.07, graus: 8, vel: 1170 / 96, cresce: 6, distCresce: 7 },
    },
    gust: {
      id: "gust",
      nome: "Gust",
      kind: "projetil",
      elemento: "flying",
      folha: {
        url: "assets/effects/golpes/gust.png",
        fw: 64,
        fh: 64,
        frames: 1,
        duracaoFrame: 0.14,
        animar: false,
        escalaVoo: tam(64, 1.2),
        escalaImpacto: tam(64, 1.2),
        aponta: "direita",
        offsetAngulo: 0,
        vertical: true,
        flipIntervalo: 0.14,
        impacto: "flipFade",
        duracaoImpacto: 0.32,
      },
      disparo: { tipo: "leque", n: 1, graus: 0, amp: 34 / 96, freq: 3.2 },
      elf: { rastro: "Wind_01", impacto: "Burst_02", orbe: "Wind_01" },
    },
    "water-gun": {
      id: "water-gun",
      nome: "Water Gun",
      kind: "projetil",
      elemento: "water",
      visual: "orbe",
      folha: null,
      disparo: { tipo: "unico", vel: (1170 / 96) * 1.05 },
      orbe: { escala: 0.38, rastro: true, elf: "Stream_01", rastroElf: "Water_01" },
      elf: { orbe: "Stream_01", rastro: "Water_01", impacto: "Water_01" },
    },
    swift: {
      id: "swift",
      nome: "Swift",
      kind: "projetil",
      elemento: "normal",
      visual: "estrela",
      folha: null,
      disparo: { tipo: "leque", n: 5, graus: 18, vel: (1170 / 96) * 1.1 },
      orbe: { escala: 0.32, estrela: true, elf: "Sparkle_01" },
      elf: { orbe: "Sparkle_01", rastro: "Glow_01", impacto: "Burst_01" },
    },
    spark: {
      id: "spark",
      nome: "Spark",
      kind: "projetil",
      elemento: "electric",
      visual: "faisca",
      folha: null,
      disparo: { tipo: "unico", vel: (1170 / 96) * 1.05 },
      orbe: { escala: 0.3, faisca: true, elf: "Sparkle_02" },
      elf: { orbe: "Sparkle_02", rastro: "Thunder_01", impacto: "Thunder_02" },
    },
    "solar-beam": {
      id: "solar-beam",
      nome: "Solar Beam",
      kind: "feixe",
      elemento: "grass",
      feixe: {
        largura: 0.55,
        alcance: 15,
        carga: 0.65,
        sobrecarga: 1.25,
        grossuraExtra: true,
        modo: "stretch",
        textura: "Ray_02",
        lengthScale: 3,
        primaria: "#78c850",
        secundaria: "#a8e060",
        nucleo: "#e0ffc0",
      },
    },
    "hyper-beam": {
      id: "hyper-beam",
      nome: "Hyper Beam",
      kind: "feixe",
      elemento: "normal",
      feixe: {
        largura: 0.7,
        alcance: 15,
        carga: 0.4,
        sobrecarga: 1.25,
        fadiga: 1,
        grossuraExtra: true,
        modo: "stretch",
        textura: "Ray_01",
        lengthScale: 3.2,
        primaria: "#a8a878",
        secundaria: "#f0f0e8",
        nucleo: "#ffffff",
      },
    },
    "water-pulse": {
      id: "water-pulse",
      nome: "Water Pulse",
      kind: "feixe",
      elemento: "water",
      feixe: {
        largura: 0.48,
        alcance: 10,
        carga: 0.2,
        pulso: true,
        modo: "stretch",
        textura: "Stream_01",
        lengthScale: 2.5,
        primaria: "#6890f0",
        secundaria: "#98d8d8",
        nucleo: "#d0f0ff",
      },
    },
    "water-cannon": {
      id: "water-cannon",
      nome: "Water Cannon",
      kind: "feixe",
      elemento: "water",
      feixe: {
        largura: 0.35,
        alcance: 11,
        duracao: 2,
        intervalo: 0.33,
        modo: "stretch",
        textura: "Water_01",
        lengthScale: 2.8,
        primaria: "#6890f0",
        secundaria: "#98d8d8",
        nucleo: "#ffffff",
      },
    },
    "ice-beam": {
      id: "ice-beam",
      nome: "Ice Beam",
      kind: "feixe",
      elemento: "ice",
      feixe: {
        largura: 0.35,
        alcance: 10,
        duracao: 0.68,
        intervalo: 0.33,
        gelo: true,
        modo: "stretch",
        textura: "Ray_03",
        lengthScale: 3,
        primaria: "#98d8d8",
        secundaria: "#c0f0f0",
        nucleo: "#e8ffff",
      },
    },
    psybeam: {
      id: "psybeam",
      nome: "Psybeam",
      kind: "feixe",
      elemento: "psychic",
      feixe: {
        largura: 0.4,
        alcance: 10,
        duracao: 1,
        intervalo: 0.33,
        ondular: true,
        modo: "stretch",
        textura: "Ray_04",
        lengthScale: 3,
        primaria: "#f85888",
        secundaria: "#f8a0b8",
        nucleo: "#ffe0f0",
      },
    },
    "thunder-shock": {
      id: "thunder-shock",
      nome: "Thunder Shock",
      kind: "raio",
      elemento: "electric",
      raio: { quantidade: 1, alcance: 10, jagged: true },
      feixe: {
        largura: 0.28,
        alcance: 10,
        duracao: 0.68,
        modo: "stretch",
        // Thunder_03: origem esquerda → impacto direita (sprite horizontal)
        textura: "Thunder_03",
        lengthScale: 3,
        primaria: "#f8d030",
        secundaria: "#fff080",
        nucleo: "#ffffc0",
      },
    },
    thunder: {
      id: "thunder",
      nome: "Thunder",
      kind: "raio",
      elemento: "electric",
      raio: { quantidade: 1, alcance: 8, ceu: true },
      feixe: {
        largura: 2.7,
        alcance: 8,
        duracao: 0.55,
        modo: "stretch",
        // Thunder_02: origem esquerda → impacto direita (trovão)
        textura: "Thunder_02",
        lengthScale: 3.5,
        primaria: "#f8d030",
        secundaria: "#fff080",
        nucleo: "#ffffff",
      },
    },
    growl: {
      id: "growl",
      nome: "Growl",
      kind: "status",
      elemento: "normal",
      status: { variante: "growl", alcance: 7, duracao: 0.72 },
    },
    "tail-whip": {
      id: "tail-whip",
      nome: "Tail Whip",
      kind: "status",
      elemento: "normal",
      status: { variante: "tail", alcance: 5.5, duracao: 0.72 },
    },
    scratch: {
      id: "scratch",
      nome: "Scratch",
      kind: "melee",
      elemento: "normal",
      melee: { variante: "scratch", alcance: 3 },
    },
    tackle: {
      id: "tackle",
      nome: "Tackle",
      kind: "melee",
      elemento: "normal",
      melee: { variante: "investida", alcance: 2.5 },
    },
    "quick-attack": {
      id: "quick-attack",
      nome: "Quick Attack",
      kind: "melee",
      elemento: "normal",
      melee: { variante: "investida", rapido: true, alcance: 5 },
    },
    "body-slam": {
      id: "body-slam",
      nome: "Body Slam",
      kind: "melee",
      elemento: "normal",
      melee: { variante: "investida", alcance: 3 },
    },
    "poison-powder": {
      id: "poison-powder",
      nome: "Poison Powder",
      kind: "status",
      elemento: "poison",
      status: { variante: "poison", alcance: 5 },
    },
    "sleep-powder": {
      id: "sleep-powder",
      nome: "Sleep Powder",
      kind: "status",
      elemento: "grass",
      status: { variante: "sleep", alcance: 5 },
    },
    "stun-spore": {
      id: "stun-spore",
      nome: "Stun Spore",
      kind: "status",
      elemento: "grass",
      status: { variante: "paralysis", alcance: 5 },
    },
    spore: {
      id: "spore",
      nome: "Spore",
      kind: "status",
      elemento: "grass",
      status: { variante: "sleep", alcance: 5 },
    },
    "thunder-wave": {
      id: "thunder-wave",
      nome: "Thunder Wave",
      kind: "status",
      elemento: "electric",
      status: { variante: "paralysis", alcance: 6 },
    },
    "will-o-wisp": {
      id: "will-o-wisp",
      nome: "Will-O-Wisp",
      kind: "status",
      elemento: "fire",
      status: { variante: "burn", alcance: 6 },
    },
    "leech-seed": {
      id: "leech-seed",
      nome: "Leech Seed",
      kind: "projetil",
      elemento: "grass",
      visual: "semente",
      folha: null,
      disparo: { tipo: "unico", vel: 10 },
      orbe: { escala: 0.22, cor: "#78c850" },
    },
    absorb: {
      id: "absorb",
      nome: "Absorb",
      kind: "status",
      elemento: "grass",
      status: { variante: "absorb", alcance: 5, duracao: 0.85 },
    },
    "ice-block": {
      id: "ice-block",
      nome: "Ice Block",
      kind: "overlay",
      elemento: "ice",
      folha: {
        url: "assets/effects/golpes/ice-block.png",
        fw: 0,
        fh: 0,
        frames: 1,
        duracaoFrame: 1,
        animar: false,
        escalaVoo: 1.1,
        escalaImpacto: 1.1,
        aponta: "direita",
        offsetAngulo: 0,
        vertical: true,
        impacto: "folha",
        frameImpacto: 0,
      },
    },
  },
};

/** @type {typeof DEFAULTS | null} */
let dados = null;
/** @type {Promise<object> | null} */
let promessa = null;

function clonar(v) {
  return JSON.parse(JSON.stringify(v));
}

function mesclarObj(base, extra) {
  if (!extra || typeof extra !== "object") return clonar(base);
  const out = clonar(base);
  for (const k of Object.keys(extra)) {
    const v = extra[k];
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = mesclarObj(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {object} [bruto]
 */
export function aplicarCatalogoEfeitos(bruto) {
  const base = clonar(DEFAULTS);
  if (!bruto || typeof bruto !== "object") {
    dados = base;
    return dados;
  }
  base.versao = bruto.versao ?? base.versao;
  if (bruto.aliases && typeof bruto.aliases === "object") {
    base.aliases = { ...base.aliases, ...bruto.aliases };
  }
  if (bruto.efeitos && typeof bruto.efeitos === "object") {
    for (const id of Object.keys(bruto.efeitos)) {
      const atual = base.efeitos[id];
      base.efeitos[id] = atual ? mesclarObj(atual, bruto.efeitos[id]) : clonar(bruto.efeitos[id]);
    }
  }
  dados = base;
  return dados;
}

export function catalogoEfeitos() {
  if (!dados) aplicarCatalogoEfeitos(null);
  return dados;
}

export function defaultsEfeitos() {
  return clonar(DEFAULTS);
}

/**
 * @param {string} chave
 */
export function idEfeito(chave) {
  if (!chave) return "";
  const cat = catalogoEfeitos();
  if (cat.aliases[chave]) return cat.aliases[chave];
  if (cat.efeitos[chave]) return chave;
  return "";
}

/**
 * @param {string} chave
 */
export function efeitoDe(chave) {
  const id = idEfeito(chave);
  if (!id) return null;
  return catalogoEfeitos().efeitos[id] || null;
}

/**
 * Folha no formato legado de folhasGolpe.
 * @param {string} chave
 */
export function folhaDoEfeito(chave) {
  const ef = efeitoDe(chave);
  if (!ef?.folha) return null;
  const f = ef.folha;
  return {
    url: f.url,
    frames: f.frames || 1,
    duracao: f.duracaoFrame || 0.08,
    animar: !!f.animar,
    giro: f.giro || 0,
    escalaVoo: f.escalaVoo || 0.4,
    escalaImpacto: f.escalaImpacto || f.escalaVoo || 0.4,
    aponta: f.aponta || "direita",
    offsetAngulo: f.offsetAngulo || 0,
    vertical: !!f.vertical,
    impacto: f.impacto || "folha",
    frameImpacto: f.frameImpacto || 0,
    duracaoImpacto: f.duracaoImpacto || 0.9,
    flipIntervalo: f.flipIntervalo || 0,
    fw: f.fw || 0,
    fh: f.fh || 0,
  };
}

/**
 * @param {string} chave
 */
export function disparoDoEfeito(chave) {
  const ef = efeitoDe(chave);
  return ef?.disparo || null;
}

export function listaEfeitos() {
  const cat = catalogoEfeitos();
  return Object.keys(cat.efeitos).map((id) => cat.efeitos[id]);
}

export function carregarCatalogoEfeitos() {
  if (promessa) return promessa;
  aplicarCatalogoEfeitos(null);
  promessa = fetch("/assets/efeitos/catalogo.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      if (json) aplicarCatalogoEfeitos(json);
      return dados;
    })
    .catch(() => dados);
  return promessa;
}

export function recarregarCatalogoEfeitos() {
  promessa = null;
  return carregarCatalogoEfeitos();
}
