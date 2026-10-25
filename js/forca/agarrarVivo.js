/**
 * Strength em Pokémon vivos: lift calmo, struggle agro.
 */

export const STRUGGLE_SEC = 0.16;

const ZERO_DELTA = Object.freeze({ dx: 0, dy: 0 });

function tiposDe(entity) {
  const types =
    entity?.tipos ??
    entity?.types ??
    entity?.especie?.tipos ??
    entity?.especie?.types ??
    [];
  return (Array.isArray(types) ? types : []).map((t) => String(t).toLowerCase());
}

/**
 * @param {object | null | undefined} e
 */
export function ehFantasma(e) {
  return tiposDe(e).includes("ghost");
}

/**
 * Selvagem vivo levantável (Ghost nunca).
 * @param {object | null | undefined} e
 */
export function ehVivoLevantavel(e) {
  if (!e || e.capturado || e.forcaCarregado) return false;
  if (e.morto || (e.hp ?? 0) <= 0) return false;
  if (e.ungrabbable || e.noGrab) return false;
  if (ehFantasma(e)) return false;
  return true;
}

/**
 * Agro de campo.
 * @param {object | null | undefined} e
 */
export function ehAgroForca(e) {
  if (!e || e.morto || (e.hp ?? 0) <= 0) return false;
  if (e.modo === "agro" || e.mode === "agro") return true;
  const alvo = e.alvo ?? e.target ?? e._pendingAgroTarget;
  if (alvo && alvo !== e && !alvo.morto && (alvo.hp ?? 0) > 0) return true;
  return false;
}

/**
 * @param {object | null | undefined} action
 */
export function ehStruggleGrab(action) {
  return !!(action && action.struggle);
}

/**
 * @param {object} action
 */
export function marcarStruggle(action) {
  if (!action) return action;
  action.struggle = true;
  action.failed = false;
  action.durationSec = STRUGGLE_SEC;
  action.elapsedSec = Math.min(action.elapsedSec ?? 0, STRUGGLE_SEC * 0.28);
  return action;
}

/**
 * @param {object | null | undefined} enemy
 */
export function travarVivoNoLift(enemy) {
  if (!enemy) return;
  enemy._forcaSendoLevantado = true;
  enemy.vx = 0;
  enemy.vy = 0;
}

/**
 * @param {object | null | undefined} enemy
 */
export function soltarVivoDoLift(enemy) {
  if (!enemy) return;
  delete enemy._forcaSendoLevantado;
}

/**
 * @param {object | null | undefined} action
 * @param {object | null | undefined} thing
 * @param {number} [cellSize]
 */
export function deltaTelaStruggle(action, thing, cellSize = 16) {
  if (!ehStruggleGrab(action) || !thing || action.enemy !== thing) return ZERO_DELTA;
  const u = Math.max(
    0,
    Math.min(1, action.elapsedSec / Math.max(1e-4, action.durationSec)),
  );
  const seed = (action.startedAtSec ?? 0) * 19.17;
  const ticks = Math.floor(action.elapsedSec * 28 + seed);
  const dir = ticks & 1 ? -1 : 1;
  const envelope = Math.sin(u * Math.PI);
  const amp = 0.16 + envelope * 0.1;
  const cs = cellSize > 0 ? cellSize : 16;
  return {
    dx: Math.round(dir * amp * cs),
    dy: Math.round(-((ticks >> 1) & 1 ? 0.12 : 0.22) * envelope * cs),
  };
}
