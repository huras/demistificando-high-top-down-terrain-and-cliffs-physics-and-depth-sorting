/**
 * Ícones de minimapa por dex — mesmos assets do Pokemon AI
 * (`sprites/pokemon/{gen}/minimap/{dex}.png` via /ref/).
 * Shiny: retrato square; fallback pro ícone normal.
 */
import { POKEMON } from "../config.js";

/** @type {{ slug: string, min: number, max: number }[]} */
const GERACOES = [
  { slug: "gen1", min: 1, max: 151 },
  { slug: "gen2", min: 152, max: 251 },
  { slug: "gen3", min: 252, max: 386 },
  { slug: "gen4", min: 387, max: 493 },
  { slug: "gen5", min: 494, max: 649 },
  { slug: "gen6", min: 650, max: 721 },
  { slug: "gen7", min: 722, max: 809 },
  { slug: "gen8", min: 810, max: 905 },
  { slug: "gen9", min: 906, max: 1025 },
];

/** @type {Map<number, string>} */
const DEX_PARA_GEN = new Map();
for (const g of GERACOES) {
  for (let d = g.min; d <= g.max; d++) DEX_PARA_GEN.set(d, g.slug);
}

const RAIZ = "/ref/sprites/pokemon/";

/** @type {Map<string, HTMLImageElement>} */
const cache = new Map();
/** LRU: chave mais recente no final. */
const ordem = [];
/** @type {Map<string, Set<() => void>>} */
const ouvintes = new Map();

function normalizarDex(dex) {
  const n = dex | 0;
  return n > 0 ? n : 0;
}

function chave(dex, shiny) {
  const id = normalizarDex(dex);
  if (!id) return "";
  return shiny ? `${id}s` : String(id);
}

function tocarLru(k) {
  const i = ordem.indexOf(k);
  if (i >= 0) ordem.splice(i, 1);
  ordem.push(k);
  const lim = Math.max(48, POKEMON.CACHE_MINIMAP | 0);
  while (ordem.length > lim) {
    const velho = ordem.shift();
    if (velho && velho !== k) cache.delete(velho);
  }
}

function notificar(k) {
  const set = ouvintes.get(k);
  if (!set?.size) return;
  const fns = [...set];
  set.clear();
  for (const fn of fns) fn();
}

/**
 * URL do ícone de minimapa (não-shiny).
 * @param {number|string} dex
 * @returns {string | null}
 */
export function urlIconeMinimap(dex) {
  const id = normalizarDex(dex);
  if (!id) return null;
  const gen = DEX_PARA_GEN.get(id);
  if (!gen) return null;
  return `${RAIZ}${gen}/minimap/${id}.png`;
}

function urlResolvida(dex, shiny) {
  const id = normalizarDex(dex);
  if (!id) return null;
  if (shiny) return `/ref/sprites/pokemon-portraits/shiny/${id}.png`;
  return urlIconeMinimap(id);
}

function imgPronta(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

/**
 * Enfileira load (dedupe). Idempotente.
 * @param {number|string} dex
 * @param {boolean} [shiny]
 * @param {() => void} [aoPronto]
 * @returns {HTMLImageElement | null}
 */
export function enfileirarIconeMinimap(dex, shiny = false, aoPronto) {
  const id = normalizarDex(dex);
  const k = chave(id, shiny);
  if (!id || !k) return null;

  if (typeof aoPronto === "function") {
    let set = ouvintes.get(k);
    if (!set) {
      set = new Set();
      ouvintes.set(k, set);
    }
    set.add(aoPronto);
  }

  let img = cache.get(k);
  if (img) {
    tocarLru(k);
    if (imgPronta(img)) notificar(k);
    return img;
  }

  const url = urlResolvida(id, shiny);
  if (!url || typeof Image === "undefined") return null;

  img = new Image();
  img.decoding = "async";
  img.onload = () => {
    tocarLru(k);
    notificar(k);
  };
  img.onerror = () => {
    cache.delete(k);
    notificar(k);
    if (shiny) enfileirarIconeMinimap(id, false);
  };
  img.src = url;
  cache.set(k, img);
  tocarLru(k);
  return img;
}

/**
 * @param {number|string} dex
 * @param {boolean} [shiny]
 * @returns {HTMLImageElement | null} só se já estiver decodificado
 */
export function espiarIconeMinimap(dex, shiny = false) {
  const k = chave(dex, shiny);
  if (!k) return null;
  const img = cache.get(k);
  if (imgPronta(img)) {
    tocarLru(k);
    return img;
  }
  if (shiny) {
    const normal = cache.get(chave(dex, false));
    if (imgPronta(normal)) return normal;
  }
  return null;
}

/**
 * Pede o ícone (inicia load se preciso) e devolve a Image em voo ou pronta.
 * Paridade com `pedirRetrato`, mas aponta pros assets de minimapa do Pokemon AI.
 * @param {number|string} dex
 * @param {boolean} [shiny]
 * @returns {HTMLImageElement | null}
 */
export function pedirIconeMinimap(dex, shiny = false) {
  const id = normalizarDex(dex);
  if (!id) return null;
  const pronto = espiarIconeMinimap(id, shiny);
  if (pronto) return pronto;
  return enfileirarIconeMinimap(id, shiny);
}
