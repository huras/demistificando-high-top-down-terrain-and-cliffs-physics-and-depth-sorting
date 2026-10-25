/**
 * Cone + alcance com histerese (enter apertado, exit folgado).
 */

export const PORTAO_PEDRA = {
  enterReach: 2.85,
  exitReach: 3.25,
  enterToward: -0.15,
  exitToward: -0.35,
  enterClose2: 1.1,
  exitClose2: 1.6,
  enterClose: Math.sqrt(1.1),
  exitClose: Math.sqrt(1.6),
};

export const PORTAO_CORPO = {
  enterReach: 2.95,
  exitReach: 3.35,
  enterToward: -0.2,
  exitToward: -0.4,
  enterClose2: 1.2,
  exitClose2: 1.7,
  enterClose: Math.sqrt(1.2),
  exitClose: Math.sqrt(1.7),
};

const SCORE = { dist2: 0, toward: 0 };

/**
 * @param {{ x: number, y: number }} body
 * @param {{ x?: number, y?: number, dirX?: number, dirY?: number } | null} facing
 */
export function facingDe(body, facing) {
  let fx = Number(facing?.x ?? facing?.dirX ?? body?.dirX) || 0;
  let fy = Number(facing?.y ?? facing?.dirY ?? body?.dirY) || 1;
  const fl = Math.hypot(fx, fy) || 1;
  return { x: fx / fl, y: fy / fl };
}

function towardOf(body, facing, tx, ty) {
  const f = facingDe(body, facing);
  return (tx - body.x) * f.x + (ty - body.y) * f.y;
}

/**
 * @returns {{ dist2: number, toward: number } | null}
 */
export function scoreCone(body, facing, tx, ty, gate, mode) {
  const exit = mode === "exit";
  const reach = exit ? gate.exitReach : gate.enterReach;
  const dx = tx - body.x;
  const dy = ty - body.y;
  const dist2 = dx * dx + dy * dy;
  if (dist2 > reach * reach) return null;
  const toward = towardOf(body, facing, tx, ty);
  const towardMin = exit ? gate.exitToward : gate.enterToward;
  const close2 = exit ? gate.exitClose2 : gate.enterClose2;
  if (toward < towardMin && dist2 > close2) return null;
  SCORE.dist2 = dist2;
  SCORE.toward = toward;
  return SCORE;
}

/**
 * @returns {{ dist2: number, toward: number } | null}
 */
export function scoreConeSuperficie(body, facing, tx, ty, surfaceDist, gate, mode) {
  const exit = mode === "exit";
  const reach = exit ? gate.exitReach : gate.enterReach;
  if (surfaceDist > reach) return null;
  const toward = towardOf(body, facing, tx, ty);
  const towardMin = exit ? gate.exitToward : gate.enterToward;
  const close = exit ? gate.exitClose : gate.enterClose;
  if (toward < towardMin && surfaceDist > close) return null;
  SCORE.dist2 = surfaceDist * surfaceDist;
  SCORE.toward = toward;
  return SCORE;
}
