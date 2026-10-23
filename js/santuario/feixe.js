/**
 * Transição simples de feixe (enter/exit).
 */
import { shrineMapColor } from "./catalogo.js";

/** @type {{ t: number, dur: number, kind: string, element: string, onDone: (() => void)|null } | null} */
let feixe = null;

export function feixeAtivo() {
  return !!feixe;
}

export function iniciarFeixe(element, kind, onDone, dur = 0.85) {
  feixe = {
    t: 0,
    dur,
    kind: kind || "enter",
    element: String(element || "normal"),
    onDone: onDone || null,
  };
}

export function tickFeixe(dt) {
  if (!feixe) return;
  feixe.t += dt;
  if (feixe.t < feixe.dur) return;
  const done = feixe.onDone;
  feixe = null;
  done?.();
}

export function estadoFeixeVisual() {
  if (!feixe) return null;
  const u = Math.min(1, feixe.t / feixe.dur);
  return {
    u,
    kind: feixe.kind,
    color: shrineMapColor(feixe.element),
    lift: feixe.kind === "enter" ? u * 1.2 : (1 - u) * 1.2,
  };
}
