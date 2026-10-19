/**
 * Pintura do terreno do mapa em buffer. A mesma conta vale
 * no script de build e em qualquer ferramenta que reassar.
 */
import { amostraMapa } from "./amostra.js";

const pixel = { h: 0, u: 0, r: 0, g: 0, b: 0 };

export function pintarFaixa(data, altura, costa, y0, y1, lado, origemX, origemY, passo, comMote) {
  for (let y = y0; y < y1; y++) {
    const wy = origemY + (y + 0.5) * passo;
    const o = y * lado;
    for (let x = 0; x < lado; x++) {
      const wx = origemX + (x + 0.5) * passo;
      amostraMapa(wx, wy, comMote, pixel);
      const i = (o + x) * 4;
      data[i] = pixel.r;
      data[i + 1] = pixel.g;
      data[i + 2] = pixel.b;
      data[i + 3] = 255;
      altura[o + x] = pixel.h;
      costa[o + x] = pixel.u;
    }
  }
}

export function sombrearLinha(data, altura, costa, y, lado, passo) {
  const yN = y > 0 ? y - 1 : y;
  const yS = y + 1 < lado ? y + 1 : y;
  const o = y * lado;
  const oN = yN * lado;
  const oS = yS * lado;
  const luzX = -0.55;
  const luzY = -0.55;
  const luzZ = 0.85;
  const luzLen = Math.hypot(luzX, luzY, luzZ);
  for (let x = 0; x < lado; x++) {
    const xW = x > 0 ? x - 1 : x;
    const xE = x + 1 < lado ? x + 1 : x;
    const u = costa[o + x];
    let dx = (altura[o + xE] - altura[o + xW]) / (2 * passo);
    let dy = (altura[oS + x] - altura[oN + x]) / (2 * passo);
    if (u < 0.34) {
      dx *= 0.15;
      dy *= 0.15;
    }
    const nx = -dx;
    const ny = -dy;
    const nz = 1;
    const len = Math.hypot(nx, ny, nz);
    const ndot = Math.max(0, (nx * luzX + ny * luzY + nz * luzZ) / (len * luzLen));
    let ganho = 0.58 + 0.55 * ndot;
    if (u < 0.34) ganho = 0.72 + 0.22 * (u / 0.34) + 0.12 * ndot;
    const i = (o + x) * 4;
    let r = data[i] * ganho;
    let g = data[i + 1] * ganho;
    let b = data[i + 2] * ganho;
    const uE = costa[o + xE];
    const uW = costa[o + xW];
    const uN = costa[oN + x];
    const uS = costa[oS + x];
    if (u < 0.5 && (uE > 0.72 || uW > 0.72 || uN > 0.72 || uS > 0.72)) {
      r += (232 - r) * 0.62;
      g += (238 - g) * 0.62;
      b += (228 - b) * 0.62;
    }
    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}
