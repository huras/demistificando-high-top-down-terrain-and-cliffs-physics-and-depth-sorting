/**
 * Volume suave da batalha Chrono no overworld (substitui limitarArena 0,0).
 */
import { CHRONO } from "../../config.js";

let ativo = false;
let cx = 0;
let cy = 0;
let raio = CHRONO.RAIO_VOLUME;

export function volumeChronoAtivo() {
  return ativo;
}

export function definirVolumeChrono(x, y, r = CHRONO.RAIO_VOLUME) {
  ativo = true;
  cx = x;
  cy = y;
  raio = Math.max(4, Number(r) || CHRONO.RAIO_VOLUME);
}

export function limparVolumeChrono() {
  ativo = false;
}

export function centroVolumeChrono() {
  return ativo ? { x: cx, y: cy, raio } : null;
}

/** Empurra o ator de volta pro disco da batalha, se o volume estiver ligado. */
export function limitarVolumeChrono(ator) {
  if (!ativo || !ator) return;
  const dx = ator.x - cx;
  const dy = ator.y - cy;
  const d = Math.hypot(dx, dy);
  if (d <= raio || d < 1e-6) return;
  const k = raio / d;
  ator.x = cx + dx * k;
  ator.y = cy + dy * k;
}
