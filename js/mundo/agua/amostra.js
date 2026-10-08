/**
 * Amostra de água sob os pés. Profundidade é a lâmina em repouso;
 * imersão é o quanto os pés estão abaixo da superfície.
 */
import { colunaAgua } from "./fluxo.js";

const SECA = Object.freeze({
  superficie: 0,
  fundo: 0,
  profundidade: 0,
  imersao: 0,
  fluxoX: 0,
  fluxoY: 0,
  caindo: false,
  pisoQueda: 0,
});

export function amostraAgua(x, y, elevPes = 0) {
  const col = colunaAgua(x, y);
  if (col.superficie <= 0) return SECA;
  const elev = Number.isFinite(elevPes) ? elevPes : 0;
  return {
    superficie: col.superficie,
    fundo: col.fundo,
    profundidade: col.profundidade,
    imersao: Math.max(0, col.superficie - elev),
    fluxoX: col.fluxoX,
    fluxoY: col.fluxoY,
    caindo: col.caindo,
    pisoQueda: col.pisoQueda,
  };
}

/** 0 = raso (ciano), 1 = fundo (azul). */
export function tomAgua(profundidade) {
  const t = Math.max(0, Math.min(1, ((profundidade || 1) - 1) / 2));
  return t;
}

export function rgbAgua(profundidade) {
  const t = tomAgua(profundidade);
  const r = Math.round(126 + (26 - 126) * t);
  const g = Math.round(200 + (79 - 200) * t);
  const b = Math.round(227 + (138 - 227) * t);
  return { r, g, b };
}

export function cssAgua(profundidade, alpha = 0.72) {
  const { r, g, b } = rgbAgua(profundidade);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
