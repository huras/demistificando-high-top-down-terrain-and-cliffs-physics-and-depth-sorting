/**
 * Catálogo das texturas Elemental Free (Desktop).
 */

/** @type {object | null} */
let dados = null;
/** @type {Promise<object> | null} */
let promessa = null;

const FALLBACK = {
  versao: 1,
  quentes: [],
  porTipo: {
    fire: { rastro: "Flame_01", impacto: "Explode_01", anel: "Ring_01", faisca: "Sparkle_01" },
    water: { rastro: "Stream_01", impacto: "Water_01", anel: "Ring_02", faisca: "Sparkle_02" },
    electric: { rastro: "Thunder_01", impacto: "Thunder_02", anel: "Ring_01", faisca: "Sparkle_01" },
    ice: { rastro: "Ice_01", impacto: "Ice_01", anel: "Ring_03", faisca: "SnowFlake_01" },
    grass: { rastro: "Glow_01", impacto: "Burst_01", anel: "Ring_02", faisca: "Sparkle_02" },
    normal: { rastro: "Glow_01", impacto: "Burst_01", anel: "Ring_01", faisca: "Sparkle_01" },
    psychic: { rastro: "Ray_02", impacto: "Glow_01", anel: "Ring_02", faisca: "Sparkle_03" },
    flying: { rastro: "Wind_01", impacto: "Burst_02", anel: "Ring_01", faisca: "Sparkle_01" },
  },
  texturas: {},
};

export function catalogoElemental() {
  return dados || FALLBACK;
}

/**
 * @param {string} id Fire_01 | elf:Fire_01
 */
export function texturaElemental(id) {
  if (!id) return null;
  const chave = String(id).replace(/^elf:/, "");
  return catalogoElemental().texturas[chave] || null;
}

/**
 * Layout da folha (cols × rows). Thunder=1×4, Fire=2×2, Burst=1×1…
 * @param {string} id
 * @returns {{ cols: number, rows: number, frames: number, anim: string }}
 */
export function layoutElemental(id) {
  const meta = texturaElemental(id);
  const cols = Math.max(1, meta?.cols || 1);
  const rows = Math.max(1, meta?.rows || 1);
  return {
    cols,
    rows,
    frames: Math.max(1, meta?.frames || cols * rows),
    anim: meta?.anim || (cols * rows > 1 ? "flipbook" : "estatico"),
  };
}

/**
 * Índice de tile a partir da idade da partícula / sorteio.
 * @param {string} id
 * @param {number} idade
 * @param {number} vida
 * @param {number} [frameFixo] se >=0, mantém (variacao)
 */
export function frameElemental(id, idade, vida, frameFixo = -1) {
  const lay = layoutElemental(id);
  if (lay.frames <= 1) return 0;
  if (lay.anim === "variacao") {
    if (frameFixo >= 0) return Math.min(lay.frames - 1, frameFixo);
    return Math.floor(Math.random() * lay.frames);
  }
  if (lay.anim === "estatico") return 0;
  const u = Math.max(0, Math.min(0.999, idade / Math.max(1e-4, vida)));
  return Math.min(lay.frames - 1, Math.floor(u * lay.frames));
}

/**
 * Folha no formato pool: "elf:Fire_01"
 * @param {string} id
 */
export function folhaElf(id) {
  if (!id) return "";
  const chave = String(id).replace(/^elf:/, "");
  return texturaElemental(chave) ? `elf:${chave}` : "";
}

/**
 * @param {string} tipo
 * @param {"rastro"|"impacto"|"anel"|"faisca"} papel
 */
export function folhaElfDoTipo(tipo, papel) {
  const mapa = catalogoElemental().porTipo[tipo] || catalogoElemental().porTipo.normal;
  const id = mapa?.[papel];
  return folhaElf(id);
}

export function listaTexturasElemental() {
  const t = catalogoElemental().texturas || {};
  return Object.keys(t).map((id) => t[id]);
}

/**
 * Folhas Elemental ligadas a um efeito do catálogo.
 * @param {object|null|undefined} ef
 * @param {"orbe"|"rastro"|"impacto"|"faisca"|"anel"} papel
 */
export function folhaElfDoEfeito(ef, papel) {
  if (!ef) return "";
  let id = "";
  if (papel === "orbe") id = ef.elf?.orbe || ef.orbe?.elf || "";
  else if (papel === "rastro") id = ef.elf?.rastro || ef.orbe?.rastroElf || "";
  else if (papel === "impacto") id = ef.elf?.impacto || "";
  else if (papel === "faisca") id = ef.elf?.faisca || "";
  else if (papel === "anel") id = ef.elf?.anel || "";
  return folhaElf(id);
}

export function carregarCatalogoElemental() {
  if (promessa) return promessa;
  promessa = fetch("/assets/efeitos/elemental.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      if (json && typeof json === "object") dados = json;
      else dados = FALLBACK;
      return dados;
    })
    .catch(() => {
      dados = FALLBACK;
      return dados;
    });
  return promessa;
}
