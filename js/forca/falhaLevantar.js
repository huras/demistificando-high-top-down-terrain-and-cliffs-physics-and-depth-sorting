/**
 * Tentativa de lift sem força — strain + shake visual.
 */
import { normalizarForca } from "./forcaEspecie.js";
import { normalizarPeso } from "./pesoCarga.js";

const FAIL_BASE = 0.56;
const FAIL_POR_DEFICIT = 0.11;
const FAIL_MIN = 0.5;
const FAIL_MAX = 0.82;

const LIFT_END = 0.28;
const SHAKE_START = 0.2;
const SHAKE_END = 0.8;
const DROP_START = 0.72;
const LIFT_MAX_BASE = 0.22;
const SHAKE_AMP = 0.12;
const SHAKE_HZ_LIGHT = 20;
const SHAKE_HZ_HEAVY = 9;

const ZERO_MOTION = Object.freeze({ lift: 0, shakeX: 0, shakeY: 0 });
const ZERO_DELTA = Object.freeze({ dx: 0, dy: 0 });

/**
 * @param {number} forcaTier
 * @param {number} pesoTier
 */
export function podeLevantar(forcaTier, pesoTier) {
  return normalizarForca(forcaTier) >= normalizarPeso(pesoTier);
}

/**
 * @param {number} forcaTier
 * @param {number} pesoTier
 */
export function deficitForca(forcaTier, pesoTier) {
  return Math.max(0, normalizarPeso(pesoTier) - normalizarForca(forcaTier));
}

/**
 * @param {number} forcaTier
 * @param {number} pesoTier
 */
export function duracaoFalhaSec(forcaTier, pesoTier) {
  const deficit = Math.max(1, deficitForca(forcaTier, pesoTier));
  return Math.max(
    FAIL_MIN,
    Math.min(FAIL_MAX, FAIL_BASE + (deficit - 1) * FAIL_POR_DEFICIT),
  );
}

/**
 * @param {object | null | undefined} action
 */
export function ehFalhaGrab(action) {
  return !!(action && action.failed);
}

/**
 * @param {object | null | undefined} o
 */
export function mundoOcultoForca(o) {
  return !!(o && (o.forcaCarregado || o.strengthCarried || (o.drawAlpha ?? 1) < 0.05));
}

/**
 * @param {number} pesoTier
 */
export function inerciaFalha(pesoTier) {
  const w = normalizarPeso(pesoTier);
  return 1 / (0.36 + w * w * 0.64);
}

/**
 * @param {object | null | undefined} action
 */
export function progressoFalha(action) {
  if (!ehFalhaGrab(action)) return 0;
  return Math.max(
    0,
    Math.min(1, action.elapsedSec / Math.max(1e-4, action.durationSec)),
  );
}

function easeOutCubic(t) {
  const x = 1 - t;
  return 1 - x * x * x;
}

function easeInCubic(t) {
  return t * t * t;
}

/**
 * @param {object | null | undefined} action
 */
export function amostrarMotionFalha(action) {
  if (!ehFalhaGrab(action)) return ZERO_MOTION;
  const u = progressoFalha(action);
  const deficit = Math.max(1, deficitForca(action.strengthTier, action.weightTier));
  const inertia = inerciaFalha(action.weightTier);
  const liftMax = LIFT_MAX_BASE / (0.72 + deficit * 0.38);
  const amp = SHAKE_AMP * inertia;
  const massT = (normalizarPeso(action.weightTier) - 1) * 0.5;
  const hz = SHAKE_HZ_LIGHT + (SHAKE_HZ_HEAVY - SHAKE_HZ_LIGHT) * massT;
  const seed = (action.startedAtSec ?? 0) * 12.9898;

  let lift = 0;
  if (u <= LIFT_END) lift = easeOutCubic(u / LIFT_END) * liftMax;
  else if (u < DROP_START) {
    lift = liftMax + Math.sin(action.elapsedSec * 36 + seed) * liftMax * 0.08 * inertia;
  } else {
    const drop = (u - DROP_START) / Math.max(1e-4, 1 - DROP_START);
    lift = liftMax * (1 - easeInCubic(drop));
  }

  let shakeX = 0;
  let shakeY = 0;
  if (u >= SHAKE_START && u <= SHAKE_END) {
    const s = (u - SHAKE_START) / (SHAKE_END - SHAKE_START);
    const envelope = Math.sin(s * Math.PI);
    const ticks = Math.floor(action.elapsedSec * hz + seed);
    const dir = ticks & 1 ? -1 : 1;
    shakeX = dir * amp * envelope;
    shakeY = ((ticks >> 1) & 1 ? -0.28 : 0.16) * amp * envelope;
  }
  return { lift, shakeX, shakeY };
}

/**
 * @param {object | null | undefined} action
 * @param {object | null | undefined} thing
 * @param {number} [cellSize]
 */
export function deltaTelaFalha(action, thing, cellSize = 16) {
  if (!ehFalhaGrab(action) || !thing) return ZERO_DELTA;
  if (action.prop !== thing && action.enemy !== thing) return ZERO_DELTA;
  const motion = amostrarMotionFalha(action);
  const cs = cellSize > 0 ? cellSize : 16;
  return {
    dx: Math.round(motion.shakeX * cs),
    dy: Math.round(-(motion.lift + motion.shakeY) * cs),
  };
}
