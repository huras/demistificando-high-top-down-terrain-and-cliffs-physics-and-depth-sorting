/**
 * Consultas O(1) sobre o run sólido do topo e a camada sob overhang.
 * Deck = laje sólida: passa por baixo sem colidir; bate a cabeça no underside;
 * só pousa em cima vindo de cima (não é plataforma one-way).
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
 * Maior superfície caminhável na camada correta.
 * @param elevAnterior elevação no frame anterior — impede “subir” pro deck por baixo.
 */
export function superficieSobElevacao(
  cx,
  cy,
  elevRef,
  eps = PULO_EPS_POUSO,
  elevAnterior = null,
) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return 0;
  const topo = superficieEm(x, y) | 0;
  if (topo <= 0) return 0;

  if (!colunaTemArInterno(x, y)) {
    return topo;
  }

  const chao = superficieBaixaEm(x, y) | 0;
  const base = baseTopoEm(x, y);
  const prev = elevAnterior != null ? elevAnterior : elevRef;

  // Ainda sob o underside (ou veio de baixo neste frame): só o chão.
  // Não promove pro deck — laje sólida, não one-way.
  const veioDeBaixo = prev < base - 1e-4;
  const aindaSob = elevRef < base - 1e-4;
  if (veioDeBaixo || aindaSob) {
    return chao > 0 ? chao : 0;
  }

  // Em cima / caindo no deck (já estava na camada de cima).
  const noOuAcima = elevRef >= topo - eps;
  const estavaNoOuAcima = prev >= topo - eps;
  if (noOuAcima || estavaNoOuAcima) {
    return topo;
  }

  // Ar entre chão e underside
  if (chao > 0 && elevRef + eps >= chao) return chao;
  return chao > 0 ? chao : 0;
}

/**
 * Underside do deck (teto) se a coluna tem overhang; senão +Infinity.
 */
export function tetoDeck(cx, cy) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return Infinity;
  if (!colunaTemArInterno(x, y)) return Infinity;
  const base = baseTopoEm(x, y);
  return base < 0 ? Infinity : base;
}

/**
 * @deprecated use tetoDeck + elevAnterior em aplicarTetoOverhang
 */
export function tetoSobreElevacao(cx, cy, elevRef) {
  const teto = tetoDeck(cx, cy);
  if (!Number.isFinite(teto)) return Infinity;
  if (elevRef < teto - 1e-4) return teto;
  return Infinity;
}

/**
 * Queda visual/climbável: Δ superfície, mas em overhang limita à espessura do deck.
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
