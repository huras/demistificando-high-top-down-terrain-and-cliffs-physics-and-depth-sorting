import { amostrarRegiao, biomaDominante } from "./catalogo.js";
import { dentroDoKanto } from "../regiao/amostraKanto.js";

let cacheX = 1e9;
let cacheY = 1e9;
let cacheRgb = [0.49, 0.81, 0.42];

function corDe(bioma) {
  const hex = bioma?.cor || "#7dce6a";
  const [r, g, b] = rgbDeHex(hex);
  return [r / 255, g / 255, b / 255];
}

function misturaEm(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  if (x !== cacheX || y !== cacheY) {
    cacheX = x;
    cacheY = y;
    if (dentroDoKanto(x, y)) {
      const bioma = biomaDominante(x, y);
      cacheRgb = bioma ? corDe(bioma) : [0.49, 0.81, 0.42];
    } else {
      const reg = amostrarRegiao(x, y);
      if (!reg) {
        cacheRgb = [0.49, 0.81, 0.42];
      } else {
        const a = corDe(reg.a);
        const b = corDe(reg.b);
        const t = reg.dominio;
        cacheRgb = [
          a[0] * t + b[0] * (1 - t),
          a[1] * t + b[1] * (1 - t),
          a[2] * t + b[2] * (1 - t),
        ];
      }
    }
  }
  return cacheRgb;
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

/** Cor do bioma em 0..1. Na borda, mistura com o vizinho. Parede um pouco mais escura. */
export function rgbBioma(wx, wy, parede = false) {
  const [r, g, b] = misturaEm(wx, wy);
  const esc = parede ? 0.78 : 1;
  return [r * esc, g * esc, b * esc];
}

export function hexBioma(wx, wy, parede = false) {
  const [r, g, b] = rgbBioma(wx, wy, parede);
  return hexDe(r * 255, g * 255, b * 255);
}

export function cssBioma(wx, wy, parede, alpha) {
  const [r, g, b] = rgbBioma(wx, wy, parede);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}
