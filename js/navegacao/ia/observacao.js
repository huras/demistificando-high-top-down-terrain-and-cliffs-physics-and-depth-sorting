import { RAIO_CORPO, VELOCIDADE_MAX } from "../../config.js";
import { ALCANCE_RAIO, ANGULOS, ENTRADAS, HORIZONTE } from "./constantes.js";

/** Buffer único. Quem chama escreve e a rede lê em seguida. */
export const entrada = new Float32Array(ENTRADAS);
export const saida = new Float32Array(3);
export const raios = new Float32Array(8);

function distanciaRaio(x, y, ux, uy, discos, n) {
  let melhor = ALCANCE_RAIO;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const cx = discos[o] - x;
    const cy = discos[o + 1] - y;
    const raio = discos[o + 3] + RAIO_CORPO;
    const t = cx * ux + cy * uy;
    if (t < 0 || t > melhor) continue;
    const ex = cx - ux * t;
    const ey = cy - uy * t;
    const d2 = ex * ex + ey * ey;
    const rr = raio * raio;
    if (d2 > rr) continue;
    const hit = t - Math.sqrt(rr - d2);
    if (hit < melhor) melhor = hit > 0 ? hit : 0;
  }
  return melhor;
}

/** Oito raios no referencial do posto. 1 = livre, 0 = encostado. */
export function preencherRaios(x, y, fx, fy, discos, n, buf) {
  const dst = buf || raios;
  const lx = -fy;
  const ly = fx;
  for (let k = 0; k < 8; k++) {
    const c = Math.cos(ANGULOS[k]);
    const s = Math.sin(ANGULOS[k]);
    const ux = c * fx + s * lx;
    const uy = c * fy + s * ly;
    dst[k] = distanciaRaio(x, y, ux, uy, discos, n) / ALCANCE_RAIO;
  }
  return dst;
}

/**
 * 0 distância, 1 à frente, 2 lado já escolhido, 3 dz,
 * 4–11 raios, 12 água, 13 queda, 14 velocidade, 15 erro até parar.
 */
export function observar(dist, dz, amostras, agua, queda, vel, distSeguir, lado, buf) {
  const dst = buf || entrada;
  const d = dist > 0 ? dist : 0;
  dst[0] = Math.max(0, Math.min(1, d / HORIZONTE));
  dst[1] = d > 0.05 ? 1 : 0;
  dst[2] = Math.max(-1, Math.min(1, lado || 0));
  dst[3] = Math.max(-1, Math.min(1, dz / 8));
  for (let i = 0; i < 8; i++) dst[4 + i] = amostras[i];
  dst[12] = agua > 0 ? 1 : 0;
  dst[13] = Math.max(0, Math.min(1, queda || 0));
  dst[14] = Math.max(0, Math.min(2, (vel || 0) / VELOCIDADE_MAX));
  dst[15] = Math.max(-1, Math.min(1, (d - distSeguir) / HORIZONTE));
  return dst;
}
