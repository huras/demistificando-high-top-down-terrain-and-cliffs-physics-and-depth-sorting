/**
 * Dual-grid de cliff (half-cell) — layout Pokemon AI / wang 4-cantos.
 *
 * Vertice (vx, vy) olha NW/NE/SW/SE. Tile em (vx-0.5, vy-0.5).
 * Single-cliff 5x3: cada nivel de altura = uma camada empilhada.
 * (altura 2 = 2 singles; nao usa banda UNDER do double-cliff.)
 */

import {
  ROLE_EDGE_E,
  ROLE_EDGE_N,
  ROLE_EDGE_S,
  ROLE_EDGE_W,
  ROLE_IN_NE,
  ROLE_IN_NW,
  ROLE_IN_SE,
  ROLE_IN_SW,
  ROLE_OUT_NE,
  ROLE_OUT_NW,
  ROLE_OUT_SE,
  ROLE_OUT_SW,
} from "../config.js";

export const CANTOS_DUAL = Object.freeze([
  Object.freeze({ dx: -1, dy: -1, bit: 1 }), // NW
  Object.freeze({ dx: 0, dy: -1, bit: 2 }), // NE
  Object.freeze({ dx: -1, dy: 0, bit: 4 }), // SW
  Object.freeze({ dx: 0, dy: 0, bit: 8 }), // SE
]);

/** mask → roles do sheet single-cliff (15 = platô cheio → sem tile). */
const ROLES_POR_MASCARA = Object.freeze({
  1: Object.freeze(["OUT_SE"]),
  2: Object.freeze(["OUT_SW"]),
  3: Object.freeze(["EDGE_S"]),
  4: Object.freeze(["OUT_NE"]),
  5: Object.freeze(["EDGE_E"]),
  6: Object.freeze(["OUT_SW", "OUT_NE"]),
  7: Object.freeze(["IN_SE"]),
  8: Object.freeze(["OUT_NW"]),
  9: Object.freeze(["OUT_SE", "OUT_NW"]),
  10: Object.freeze(["EDGE_W"]),
  11: Object.freeze(["IN_SW"]),
  12: Object.freeze(["EDGE_N"]),
  13: Object.freeze(["IN_NE"]),
  14: Object.freeze(["IN_NW"]),
});

const IDS = Object.freeze({
  OUT_NW: ROLE_OUT_NW,
  EDGE_N: ROLE_EDGE_N,
  OUT_NE: ROLE_OUT_NE,
  IN_SE: ROLE_IN_SE,
  IN_SW: ROLE_IN_SW,
  EDGE_W: ROLE_EDGE_W,
  EDGE_E: ROLE_EDGE_E,
  OUT_SW: ROLE_OUT_SW,
  EDGE_S: ROLE_EDGE_S,
  OUT_SE: ROLE_OUT_SE,
  IN_NE: ROLE_IN_NE,
  IN_NW: ROLE_IN_NW,
});

/** Roles com face sul visivel (destaque de escalada). */
export const ROLE_SUL = Object.freeze({
  OUT_SW: true,
  EDGE_S: true,
  OUT_SE: true,
});

export function rolesDaMascara(mask) {
  return ROLES_POR_MASCARA[mask] ?? null;
}

export function idDoRole(nome) {
  const id = IDS[nome];
  return id == null ? -1 : id;
}

/** Sheet preferido: single empilhavel; double so fallback legado. */
export function sheetCliffDoAtlas(atlas) {
  if (!atlas) return null;
  return atlas.cliffSimples || atlas.cliffDuplo || null;
}

/**
 * Empacota alturas dos 4 cantos (1x alturaEm por canto).
 * @returns {{ h: number[], max: number } | null}
 */
export function amostrarCantos(vx, vy, alturaEm) {
  const h = [0, 0, 0, 0];
  let max = 0;
  for (let i = 0; i < 4; i++) {
    const c = CANTOS_DUAL[i];
    const v = alturaEm(vx + c.dx, vy + c.dy) | 0;
    h[i] = v;
    if (v > max) max = v;
  }
  if (max <= 0) return null;
  return { h, max };
}

export function mascaraDosCantos(hCantos, nivel) {
  let mask = 0;
  for (let i = 0; i < 4; i++) {
    if (hCantos[i] >= nivel) mask |= CANTOS_DUAL[i].bit;
  }
  return mask;
}

/** Primeiro canto alto no nivel — pra escolher skin de chao sob magenta. */
export function indiceCantoAlto(hCantos, nivel) {
  for (let i = 0; i < 4; i++) {
    if (hCantos[i] >= nivel) return i;
  }
  return -1;
}
