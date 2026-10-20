/**
 * Botões no viewport com cursor livre.
 * A mira do arco pede pointer lock só no gesto do RMB (mouse-look).
 */

let ligado = false;
let acumuladoX = 0;
let acumuladoY = 0;
let direito = false;
let esquerdo = false;
let soltouEsquerdo = false;
let elementoAlvo = null;
/** @type {(() => boolean) | null} */
let predicadoTravaMira = null;

function noViewport(ev) {
  if (!elementoAlvo) return false;
  const t = ev.target;
  return t === elementoAlvo || (typeof elementoAlvo.contains === "function" && elementoAlvo.contains(t));
}

function aoMover(ev) {
  if (document.pointerLockElement !== elementoAlvo) return;
  acumuladoX += ev.movementX || 0;
  acumuladoY += ev.movementY || 0;
}

function aoBotaoBaixo(ev) {
  if (!ligado || !elementoAlvo) return;
  const travado = document.pointerLockElement === elementoAlvo;
  if (!travado && !noViewport(ev)) return;

  if (ev.button === 2) {
    direito = true;
    // Pointer lock precisa do gesto do usuário — não dá pra pedir no rAF.
    if (!travado && predicadoTravaMira?.()) {
      ev.preventDefault();
      elementoAlvo.requestPointerLock?.();
    }
  }
  if (ev.button === 0) esquerdo = true;
}

function aoBotaoCima(ev) {
  if (ev.button === 2) {
    direito = false;
    soltarTravaMira();
  }
  if (ev.button === 0) {
    if (esquerdo) soltouEsquerdo = true;
    esquerdo = false;
  }
}

function aoTravaMudou() {
  if (document.pointerLockElement === elementoAlvo) return;
  // Escape / perda da trava: encerra mira e zera botões.
  direito = false;
  esquerdo = false;
  soltouEsquerdo = false;
  acumuladoX = 0;
  acumuladoY = 0;
}

/**
 * Liga o acompanhamento dos botões no elemento (canvas 3D / viewport).
 */
export function ligarPonteiro3d(el) {
  if (!el || ligado) return;
  elementoAlvo = el;
  ligado = true;
  document.addEventListener("mousemove", aoMover);
  document.addEventListener("mousedown", aoBotaoBaixo);
  document.addEventListener("mouseup", aoBotaoCima);
  document.addEventListener("pointerlockchange", aoTravaMudou);
}

export function desligarPonteiro3d() {
  if (!ligado) return;
  ligado = false;
  document.removeEventListener("mousemove", aoMover);
  document.removeEventListener("mousedown", aoBotaoBaixo);
  document.removeEventListener("mouseup", aoBotaoCima);
  document.removeEventListener("pointerlockchange", aoTravaMudou);
  soltarTravaMira();
  elementoAlvo = null;
  acumuladoX = 0;
  acumuladoY = 0;
  direito = false;
  esquerdo = false;
  soltouEsquerdo = false;
}

/**
 * Quando true no RMB, pede pointer lock no mesmo gesto (mira do arco).
 * @param {(() => boolean) | null} fn
 */
export function definirPredicadoTravaMira(fn) {
  predicadoTravaMira = typeof fn === "function" ? fn : null;
}

/** Solta a trava pedida pela mira (troca de slot, UI, etc.). */
export function soltarTravaMira() {
  if (elementoAlvo && document.pointerLockElement === elementoAlvo) {
    document.exitPointerLock?.();
  }
}

/** Consome deltas do frame (pixels). Só acumula com pointer lock (mira). */
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

/** Botão direito segurado a partir do viewport (não exige lock). */
export function botaoDireitoSegurado() {
  return direito;
}

/** Botão esquerdo segurado a partir do viewport (não exige lock). */
export function botaoEsquerdoSegurado() {
  return esquerdo;
}

/** True uma vez ao soltar o esquerdo. */
export function consumirSolturaEsquerda() {
  const soltou = soltouEsquerdo;
  soltouEsquerdo = false;
  return soltou;
}
