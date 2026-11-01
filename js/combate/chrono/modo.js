/**
 * Modo de combate no overworld: realtime (BOTW) ou chrono (Paper Mario / Chrono).
 */
import { MODO_COMBATE_CAMPO } from "../../config.js";

const OUVINTES = new Set();

let modo = MODO_COMBATE_CAMPO === "chrono" ? "chrono" : "realtime";

function sincronizarBody() {
  if (typeof document === "undefined" || !document.body) return;
  document.body.dataset.combate = modo;
}

sincronizarBody();

export function modoCombateCampo() {
  return modo;
}

export function modoChronoCampo() {
  return modo === "chrono";
}

export function definirModoCombateCampo(proximo) {
  const alvo = proximo === "chrono" ? "chrono" : "realtime";
  if (alvo === modo) return modo;
  modo = alvo;
  sincronizarBody();
  for (const fn of OUVINTES) fn(modo);
  return modo;
}

export function aoMudarModoCombate(fn) {
  OUVINTES.add(fn);
  return () => OUVINTES.delete(fn);
}
