/**
 * Botões no viewport com cursor livre.
 * A mira ranged pede pointer lock só no gesto do RMB (mouse-look).
 *
 * Ao ganhar pointer lock, alguns browsers disparam mouseup sintético.
 * Engolimos só a soltura logo após o lock; soltura real dispara normalmente.
 */

let ligado = false;
let acumuladoX = 0;
let acumuladoY = 0;
let direito = false;
let esquerdo = false;
let soltouEsquerdo = false;
let soltouDireito = false;
/** Intenção de mira (RMB) enquanto o gesto vale. */
let miraIntent = false;
/** Timestamp (ms) em que o pointer lock foi adquirido; 0 = sem lock recente. */
let lockDesde = 0;
let elementoAlvo = null;
/** @type {(() => boolean) | null} */
let predicadoTravaMira = null;

const ENGOLIR_SOLTURA_MS = 120;

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
    if (predicadoTravaMira?.()) {
      miraIntent = true;
      if (!travado) {
        ev.preventDefault();
        elementoAlvo.requestPointerLock?.();
      }
    }
  }
  if (ev.button === 0) esquerdo = true;
}

function aoBotaoCima(ev) {
  if (ev.button === 2) {
    const agora = performance.now();
    // mouseup fantasma logo após adquirir o lock — mantém a mira
    if (
      miraIntent &&
      lockDesde > 0 &&
      agora - lockDesde < ENGOLIR_SOLTURA_MS &&
      document.pointerLockElement === elementoAlvo
    ) {
      direito = true;
      return;
    }
    if (direito || miraIntent) soltouDireito = true;
    direito = false;
    miraIntent = false;
  }
  if (ev.button === 0) {
    if (esquerdo) soltouEsquerdo = true;
    esquerdo = false;
  }
}

function aoTravaMudou() {
  if (document.pointerLockElement === elementoAlvo) {
    if (miraIntent) {
      direito = true;
      lockDesde = performance.now();
    } else {
      // Soltou antes do lock completar — não fica preso na mira
      lockDesde = 0;
      document.exitPointerLock?.();
    }
    return;
  }
  // Escape / perda da trava: encerra mira sem disparar.
  direito = false;
  miraIntent = false;
  lockDesde = 0;
  esquerdo = false;
  soltouEsquerdo = false;
  soltouDireito = false;
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
  miraIntent = false;
  lockDesde = 0;
  esquerdo = false;
  soltouEsquerdo = false;
  soltouDireito = false;
}

/**
 * Quando true no RMB, pede pointer lock no mesmo gesto (mira ranged).
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

/** Zera estado dos botões sem depender do pointerlockchange. */
export function zerarBotoesMira() {
  direito = false;
  miraIntent = false;
  lockDesde = 0;
  esquerdo = false;
  soltouEsquerdo = false;
  soltouDireito = false;
  acumuladoX = 0;
  acumuladoY = 0;
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

/** Botão direito / intenção de mira (não exige lock). */
export function botaoDireitoSegurado() {
  return direito || miraIntent;
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

/** True uma vez ao soltar o direito (disparo carregado). */
export function consumirSolturaDireita() {
  const soltou = soltouDireito;
  soltouDireito = false;
  return soltou;
}
