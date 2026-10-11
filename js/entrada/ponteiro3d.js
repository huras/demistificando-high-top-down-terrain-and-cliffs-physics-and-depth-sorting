/**
 * Mouse-look 3D com pointer lock no viewport.
 */

let ligado = false;
let acumuladoX = 0;
let acumuladoY = 0;
let direito = false;
let esquerdoAgora = false;
let elementoAlvo = null;

function aoMover(ev) {
  if (document.pointerLockElement !== elementoAlvo) return;
  acumuladoX += ev.movementX || 0;
  acumuladoY += ev.movementY || 0;
}

function aoBotaoBaixo(ev) {
  if (document.pointerLockElement !== elementoAlvo) return;
  if (ev.button === 2) direito = true;
  if (ev.button === 0) esquerdoAgora = true;
}

function aoBotaoCima(ev) {
  if (ev.button === 2) direito = false;
}

function aoTravaMudou() {
  if (document.pointerLockElement !== elementoAlvo) {
    direito = false;
    acumuladoX = 0;
    acumuladoY = 0;
  }
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
  document.addEventListener("mousedown", aoBotaoBaixo);
  document.addEventListener("mouseup", aoBotaoCima);
  document.addEventListener("pointerlockchange", aoTravaMudou);
}

export function desligarPonteiro3d() {
  if (!ligado) return;
  ligado = false;
  if (elementoAlvo) {
    elementoAlvo.removeEventListener("click", aoClique);
  }
  document.removeEventListener("mousemove", aoMover);
  document.removeEventListener("mousedown", aoBotaoBaixo);
  document.removeEventListener("mouseup", aoBotaoCima);
  document.removeEventListener("pointerlockchange", aoTravaMudou);
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  elementoAlvo = null;
  acumuladoX = 0;
  acumuladoY = 0;
  direito = false;
  esquerdoAgora = false;
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

/** Botão direito segurado, só com o mouse travado no viewport. */
export function botaoDireitoSegurado() {
  return direito && ponteiroTravado();
}

/** True uma vez por clique esquerdo com o ponteiro travado. */
export function consumirCliqueEsquerdo() {
  const disparo = esquerdoAgora && ponteiroTravado();
  esquerdoAgora = false;
  return disparo;
}
