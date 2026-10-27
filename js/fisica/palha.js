/**
 * Zona macia da straw bed: −50% velocidade, sem disco de colisão.
 */
import { listarLaresProximos } from "../pokemon/laresMapa.js";
import {
  PALHA_RAIO,
  PALHA_RAIO_SYNC,
  PALHA_VEL_MUL,
} from "../mundo/overworld/catalogoPalha.js";

/** @type {{ x: number, y: number }[]} */
let lares = [];
let cacheX = Number.NaN;
let cacheY = Number.NaN;
const R2 = PALHA_RAIO * PALHA_RAIO;
const REBUILD = 10;

/**
 * Atualiza cache de lares próximos (chamado pelo render e pela física).
 * @param {number} px
 * @param {number} py
 * @param {{ x: number, y: number }[] | null} [lista]
 */
export function sincronizarPalha(px, py, lista = null) {
  if (lista) {
    lares = lista;
    cacheX = px;
    cacheY = py;
    return;
  }
  const dx = px - cacheX;
  const dy = py - cacheY;
  if (lares.length && Number.isFinite(cacheX) && dx * dx + dy * dy < REBUILD * REBUILD) {
    return;
  }
  lares = listarLaresProximos(px, py, PALHA_RAIO_SYNC, { soTerrestre: true });
  cacheX = px;
  cacheY = py;
}

export function fatorPalhaEm(x, y) {
  for (let i = 0; i < lares.length; i++) {
    const lar = lares[i];
    const dx = lar.x - x;
    const dy = lar.y - y;
    if (dx * dx + dy * dy <= R2) return PALHA_VEL_MUL;
  }
  return 1;
}

/** Multiplica `_velAgua` se o corpo estiver no disco da palha. */
export function aplicarMulPalha(corpo) {
  if (!corpo || corpo._velAgua == null) return;
  sincronizarPalha(corpo.x, corpo.y);
  const f = fatorPalhaEm(corpo.x, corpo.y);
  if (f < 1) corpo._velAgua *= f;
}

export function laresPalhaCache() {
  return lares;
}
