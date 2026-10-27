/**
 * Classificação de tile pra habitat (terra vs água) — sem await.
 */
import { colunaAgua } from "../../mundo/agua/fluxo.js";
import { alturaEm, dentroDoMapa } from "../../mundo/altura.js";
import { alturaDoRelevo, nivelMarBlocos } from "../../mundo/bioma/catalogo.js";
import { HABITAT } from "./kinds.js";

const PROF_UNDERSEA = 3;

/**
 * @param {number} x
 * @param {number} y
 * @returns {{
 *   molhado: boolean,
 *   caindo: boolean,
 *   profundidade: number,
 *   superficie: number,
 *   fundo: number,
 *   zSeco: number,
 * }}
 */
export function infoTileHabitat(x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (dentroDoMapa(tx, ty)) {
    const z = alturaEm(tx, ty);
    const agua = colunaAgua(tx, ty);
    if (agua.profundidade >= 1 && !agua.caindo) {
      return {
        molhado: true,
        caindo: false,
        profundidade: agua.profundidade,
        superficie: agua.superficie,
        fundo: agua.fundo,
        zSeco: z,
      };
    }
    return {
      molhado: false,
      caindo: !!agua.caindo,
      profundidade: 0,
      superficie: 0,
      fundo: 0,
      zSeco: z,
    };
  }
  const h = alturaDoRelevo(tx, ty) | 0;
  const nivel = nivelMarBlocos();
  if (h < nivel) {
    const prof = nivel - h;
    return {
      molhado: true,
      caindo: false,
      profundidade: prof,
      superficie: nivel,
      fundo: h,
      zSeco: h,
    };
  }
  return {
    molhado: false,
    caindo: false,
    profundidade: 0,
    superficie: 0,
    fundo: 0,
    zSeco: h,
  };
}

/**
 * Kind aquático preferido no tile (superfície vs undersea).
 * @param {ReturnType<typeof infoTileHabitat>} tile
 * @param {number} [h] hash pra jitter
 */
export function kindAguaDoTile(tile, h = 0) {
  if (!tile?.molhado || tile.caindo) return null;
  if (tile.profundidade >= PROF_UNDERSEA) {
    // ~55% undersea em água funda.
    return (h >>> 0) % 100 < 55 ? HABITAT.UNDERSEA : HABITAT.SURFACE;
  }
  if (tile.profundidade >= 1) return HABITAT.SURFACE;
  return null;
}

/**
 * Z de spawn do lar aquático.
 * @param {string} kind
 * @param {ReturnType<typeof infoTileHabitat>} tile
 */
export function zDoLarAquatico(kind, tile) {
  if (!tile?.molhado) return 0;
  if (kind === HABITAT.UNDERSEA) {
    return Math.max(0, (tile.fundo || 0) + 0.35);
  }
  return Math.max(0.5, (tile.superficie || 0) - 0.15);
}

export { PROF_UNDERSEA };
