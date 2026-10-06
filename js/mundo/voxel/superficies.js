/**
 * Consultas O(1) sobre o run sólido contíguo do topo da coluna.
 * Gameplay continua heightmap (uma superfície); overhang = baseTopo > 0.
 */
import { chunkCarregadoEm, baseTopoEm, superficieEm } from "./storeMundo.js";

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
