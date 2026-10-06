/**
 * Consultas O(1) sobre o run sólido do topo e a camada sob overhang.
 */
import { PULO_EPS_POUSO } from "../../config.js";
import {
  baseTopoEm,
  chunkCarregadoEm,
  superficieBaixaEm,
  superficieEm,
} from "./storeMundo.js";

/** Menor lz do run sólido do topo (−1 se coluna vazia). */
export function baseTopoColuna(cx, cy) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return -1;
  return baseTopoEm(x, y);
}

/** Espessura do run do topo (blocos). Deck fino = 1; montanha sólida = altura. */
export function espessuraTopo(cx, cy) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return 0;
  const surf = superficieEm(x, y) | 0;
  if (surf <= 0) return 0;
  const base = baseTopoEm(x, y);
  if (base < 0) return 0;
  return surf - base;
}

/** True se há ar abaixo do run sólido do topo (deck / overhang). */
export function colunaTemArInterno(cx, cy) {
  const base = baseTopoColuna(cx, cy);
  return base > 0;
}

/** Walk height sob o deck (0 se coluna sólida). */
export function superficieBaixa(cx, cy) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return 0;
  return superficieBaixaEm(x, y) | 0;
}

/**
 * Maior superfície caminhável com face ≤ elevRef + eps.
 * Em overhang: chão sob o deck OU o deck, conforme a elevação.
 * Em coluna sólida: só o topo.
 */
export function superficieSobElevacao(cx, cy, elevRef, eps = PULO_EPS_POUSO) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return 0;
  const topo = superficieEm(x, y) | 0;
  if (topo <= 0) return 0;

  const e = elevRef + eps;
  if (!colunaTemArInterno(x, y)) {
    return topo;
  }

  const chao = superficieBaixaEm(x, y) | 0;
  let best = 0;
  if (chao > 0 && chao <= e) best = chao;
  if (topo <= e) best = Math.max(best, topo);
  // Ainda abaixo do deck e acima do chão: piso é o chão (queda / andar sob).
  if (best === 0 && chao > 0) return chao;
  return best;
}

/**
 * Teto (underside do deck) acima de elevRef, ou +Infinity se livre.
 * Usado pra não atravessar a ponte pulando por baixo.
 */
export function tetoSobreElevacao(cx, cy, elevRef) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return Infinity;
  if (!colunaTemArInterno(x, y)) return Infinity;
  const base = baseTopoEm(x, y);
  if (base < 0) return Infinity;
  if (elevRef < base - 1e-4) return base;
  return Infinity;
}

/**
 * Queda visual/climbável: Δ superfície, mas em overhang limita à espessura do deck.
 * Colunas sólidas (sem ar interno) mantêm a queda heightmap completa.
 */
export function quedaVisualFace(cx, cy, dx, dy) {
  const x = cx | 0;
  const y = cy | 0;
  const z = superficieEm(x, y) | 0;
  if (z <= 0) return 0;
  const zn = chunkCarregadoEm(x + dx, y + dy)
    ? superficieEm(x + dx, y + dy) | 0
    : 0;
  const queda = z - zn;
  if (queda <= 0) return 0;
  if (!colunaTemArInterno(x, y)) return queda;
  const esp = espessuraTopo(x, y);
  return Math.min(queda, Math.max(1, esp));
}
