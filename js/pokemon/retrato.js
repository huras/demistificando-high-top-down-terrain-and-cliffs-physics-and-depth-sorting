import { POKEMON } from "../config.js";

const cache = new Map();
const ordem = [];

function chave(dex, shiny) {
  return shiny ? `${dex | 0}s` : String(dex | 0);
}

export function pedirRetrato(dex, shiny) {
  const id = dex | 0;
  if (!id) return null;
  const k = chave(id, shiny);
  let img = cache.get(k);
  if (img) {
    if (img.complete && img.naturalWidth > 0) return img;
    if (img.complete && shiny) return pedirRetrato(id, false);
    return null;
  }
  img = new Image();
  img.src = shiny
    ? `/ref/sprites/pokemon-portraits/shiny/${id}.png`
    : `/ref/sprites/pokemon-portraits/${id}.png`;
  cache.set(k, img);
  ordem.push(k);
  while (ordem.length > POKEMON.CACHE_RETRATO) {
    const velho = ordem.shift();
    if (velho !== k) cache.delete(velho);
  }
  return null;
}
