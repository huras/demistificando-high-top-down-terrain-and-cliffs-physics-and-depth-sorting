import { biomaDominante } from "./catalogo.js";

/**
 * Os dois gelos do Unity são quase brancos e somem em cima da grama.
 * O azul claro só existe na tela, para separar um do outro.
 */
const COR_VISUAL = {
  Ice_Hight_Steps_a: "#d4e8f4",
  Ice_Canyons_a: "#7eb4d4",
};

let cacheX = 1e9;
let cacheY = 1e9;
let cacheBioma = null;

function biomaEm(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  if (x !== cacheX || y !== cacheY) {
    cacheX = x;
    cacheY = y;
    cacheBioma = biomaDominante(x, y);
  }
  return cacheBioma;
}

function rgbDeHex(hex) {
  const cru = (hex || "#7dce6a").replace("#", "");
  const h = cru.length === 3 ? cru.replace(/./g, (c) => c + c) : cru.slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexDe(r, g, b) {
  const h = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Cor do bioma em 0..1. Parede um pouco mais escura que o topo. */
export function rgbBioma(wx, wy, parede = false) {
  const b = biomaEm(wx, wy);
  const hex = (b && COR_VISUAL[b.id]) || b?.cor || "#7dce6a";
  const [r, g, bb] = rgbDeHex(hex);
  const esc = parede ? 0.78 : 1;
  return [(r / 255) * esc, (g / 255) * esc, (bb / 255) * esc];
}

export function hexBioma(wx, wy, parede = false) {
  const [r, g, b] = rgbBioma(wx, wy, parede);
  return hexDe(r * 255, g * 255, b * 255);
}

export function cssBioma(wx, wy, parede, alpha) {
  const [r, g, b] = rgbBioma(wx, wy, parede);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}
