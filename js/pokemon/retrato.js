import { POKEMON } from "../config.js";

const cache = new Map();
/** LRU: chave mais recente no final. */
const ordem = [];

function chave(dex, shiny) {
  return shiny ? `${dex | 0}s` : String(dex | 0);
}

function tocarLru(k) {
  const i = ordem.indexOf(k);
  if (i >= 0) ordem.splice(i, 1);
  ordem.push(k);
  const lim = Math.max(24, POKEMON.CACHE_RETRATO | 0);
  while (ordem.length > lim) {
    const velho = ordem.shift();
    if (velho && velho !== k) cache.delete(velho);
  }
}

/**
 * @param {number} dex
 * @param {boolean} [shiny]
 * @returns {HTMLImageElement | null} img pronta, em voo, ou null se dex inválido
 */
export function pedirRetrato(dex, shiny) {
  const id = dex | 0;
  if (!id) return null;
  const k = chave(id, shiny);
  let img = cache.get(k);
  if (img) {
    tocarLru(k);
    if (img.complete && img.naturalWidth > 0) return img;
    if (img.complete && shiny) return pedirRetrato(id, false);
    return img;
  }
  img = new Image();
  img.decoding = "async";
  img.src = shiny
    ? `/ref/sprites/pokemon-portraits/shiny/${id}.png`
    : `/ref/sprites/pokemon-portraits/${id}.png`;
  cache.set(k, img);
  tocarLru(k);
  return img;
}
