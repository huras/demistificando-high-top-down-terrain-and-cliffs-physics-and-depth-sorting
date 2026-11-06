/**
 * Mira de construção: cursor no alcance; sem mira, joga pra frente do facing.
 */
import { ALCANCE_CONSTRUIR } from "../config.js";

/** Só no fallback sem cursor — evita ghost colado nos pés. */
const MIN_AHEAD = 3.2;

/**
 * @param {{ x: number, y: number, dirX?: number, dirY?: number } | null | undefined} corpo
 * @param {number} aimX
 * @param {number} aimY
 * @returns {{ x: number, y: number }}
 */
export function clampMiraConstrucao(corpo, aimX, aimY) {
  const temCursor = Number.isFinite(aimX) && Number.isFinite(aimY);
  let x = temCursor ? aimX : corpo?.x ?? 0;
  let y = temCursor ? aimY : corpo?.y ?? 0;
  if (!corpo || !Number.isFinite(corpo.x) || !Number.isFinite(corpo.y)) {
    return { x, y };
  }

  let dx = x - corpo.x;
  let dy = y - corpo.y;
  let dist = Math.hypot(dx, dy);

  // Sem mira de cursor: empurra pra frente do facing.
  if (!temCursor) {
    let fx = Number(corpo.dirX);
    let fy = Number(corpo.dirY);
    if (!Number.isFinite(fx)) fx = 0;
    if (!Number.isFinite(fy)) fy = 0;
    let fl = Math.hypot(fx, fy);
    if (fl < 1e-6) {
      fx = 0;
      fy = -1;
      fl = 1;
    } else {
      fx /= fl;
      fy /= fl;
    }
    const ahead = Math.min(MIN_AHEAD + 1.2, ALCANCE_CONSTRUIR * 0.4);
    x = corpo.x + fx * ahead;
    y = corpo.y + fy * ahead;
    dx = x - corpo.x;
    dy = y - corpo.y;
    dist = Math.hypot(dx, dy);
  }

  const reach = ALCANCE_CONSTRUIR;
  if (dist > reach && dist > 1e-6) {
    const s = reach / dist;
    x = corpo.x + dx * s;
    y = corpo.y + dy * s;
  }
  return { x, y };
}

export function emAlcanceConstrucao(corpo, x, y) {
  if (!corpo) return false;
  const dx = x - corpo.x;
  const dy = y - corpo.y;
  return dx * dx + dy * dy <= ALCANCE_CONSTRUIR * ALCANCE_CONSTRUIR;
}
