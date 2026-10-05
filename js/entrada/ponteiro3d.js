/**
 * Mouse-look 3D com pointer lock no viewport.
 */

let ligado = false;
let acumuladoX = 0;
let acumuladoY = 0;
let elementoAlvo = null;

function aoMover(ev) {
  if (document.pointerLockElement !== elementoAlvo) return;
  acumuladoX += ev.movementX || 0;
  acumuladoY += ev.movementY || 0;
}

function aoClique() {
  if (!ligado || !elementoAlvo) return;
  if (document.pointerLockElement === elementoAlvo) return;
  elementoAlvo.requestPointerLock?.();
}

/**
 * Liga mouse-look no elemento (canvas 3D / viewport).
 */
export function ligarPonteiro3d(el) {
  if (!el || ligado) return;
  elementoAlvo = el;
  ligado = true;
  el.addEventListener("click", aoClique);
  document.addEventListener("mousemove", aoMover);
}

export function desligarPonteiro3d() {
  if (!ligado) return;
  ligado = false;
  if (elementoAlvo) {
    elementoAlvo.removeEventListener("click", aoClique);
  }
  document.removeEventListener("mousemove", aoMover);
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  elementoAlvo = null;
  acumuladoX = 0;
  acumuladoY = 0;
}

/** Consome deltas do frame (pixels). */
export function consumirMovimentoMouse() {
  const dx = acumuladoX;
  const dy = acumuladoY;
  acumuladoX = 0;
  acumuladoY = 0;
  return { dx, dy };
}

export function ponteiroTravado() {
  return !!elementoAlvo && document.pointerLockElement === elementoAlvo;
}
