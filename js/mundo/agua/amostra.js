/**
 * Amostra de água sob os pés. Profundidade é a lâmina em repouso;
 * imersão é o quanto os pés estão abaixo da superfície.
 * Pântano fica preso no vau. A cor segue a família.
 */
import { AGUA_LIMIAR_VADO } from "../../config.js";
import { colunaAgua } from "./fluxo.js";
import { FLUIDO, familiaDaColuna, fluidoDe } from "./fluidos.js";

const SECA = Object.freeze({
  superficie: 0,
  fundo: 0,
  profundidade: 0,
  imersao: 0,
  fluxoX: 0,
  fluxoY: 0,
  caindo: false,
  pisoQueda: 0,
  fluido: 0,
  familia: null,
});

export function amostraAgua(x, y, elevPes = 0) {
  const col = colunaAgua(x, y);
  if (col.superficie <= 0) return SECA;
  const elev = Number.isFinite(elevPes) ? elevPes : 0;
  const familia = familiaDaColuna(col.fluido);
  let profundidade = col.profundidade;
  if (familia.raso) profundidade = Math.min(profundidade, AGUA_LIMIAR_VADO);
  return {
    superficie: col.superficie,
    fundo: col.fundo,
    profundidade,
    imersao: Math.max(0, col.superficie - elev),
    fluxoX: col.fluxoX,
    fluxoY: col.fluxoY,
    caindo: col.caindo && familia.queda,
    pisoQueda: col.pisoQueda,
    fluido: col.fluido || FLUIDO.AGUA,
    familia,
  };
}

/** 0 = raso (ciano), 1 = fundo (azul). */
export function tomAgua(profundidade) {
  const t = Math.max(0, Math.min(1, ((profundidade || 1) - 1) / 2));
  return t;
}

export function rgbAgua(profundidade, fluido = FLUIDO.AGUA) {
  const fam = fluidoDe(fluido) || familiaDaColuna(FLUIDO.AGUA);
  const t = tomAgua(profundidade);
  const r = Math.round(fam.lamina[0] + (fam.fundo[0] - fam.lamina[0]) * t);
  const g = Math.round(fam.lamina[1] + (fam.fundo[1] - fam.lamina[1]) * t);
  const b = Math.round(fam.lamina[2] + (fam.fundo[2] - fam.lamina[2]) * t);
  return { r, g, b };
}

export function cssAgua(profundidade, alpha = 0.72, fluido = FLUIDO.AGUA) {
  const { r, g, b } = rgbAgua(profundidade, fluido);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
