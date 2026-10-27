/**
 * Puzzle de letra (paridade Pokemon AI): meteoritos no chão formam o glifo;
 * 3 buracos + pedras soltas próximas.
 */
import {
  LETTER_ORDER,
  getLetterGrid,
  getScaledLetterGrid,
  listLetterGrids,
} from "./grades.js";

/** Paridade Pokemon AI: meteorito lunar + plaza shrine-floor-a. */
export const LETRA_SPRITE = "small-moon-meteorite";
export const LETRA_ESCALA = 2;
export const LETRA_BURACOS = 3;
export const LETRA_SOLTAS_MIN = 2;
export const LETRA_SOLTAS_MAX = 6;
export const LETRA_ALCANCE_ENCAIXE = 1.35;
export const LETRA_VEG_CLEAR = 1;
export const LETRA_PLAZA_PISO = "shrine-floor-a";
export const LETRA_ARC_CONNECT_MS = 480;
/** Folga ao redor do glifo pra pedras soltas (células). */
export const LETRA_PAD_SOLTAS = 6;
/** Anel de avental (degraus) ao redor do sítio achatado. */
export const LETRA_AVENTAL = 2;
/** Desnível máximo aceito no sítio ao ancorar. */
export const LETRA_DESNIVEL_MAX = 3;

export {
  LETTER_ORDER,
  getLetterGrid,
  getScaledLetterGrid,
  listLetterGrids,
};

export function letraPuzzleId(letter) {
  return `letter:kanto:${String(letter || "").toUpperCase()}`;
}

export function parseLetraPuzzleId(id) {
  const parts = String(id || "").split(":");
  if (parts[0] !== "letter" || parts.length < 3) return null;
  return { packId: parts[1], letter: parts.slice(2).join(":") };
}

export function letraQuota() {
  return LETTER_ORDER.length;
}

/** Grade escalada pronta pra layout no mundo. */
export function gradeDaLetra(letter) {
  return getScaledLetterGrid(letter, LETRA_ESCALA);
}
