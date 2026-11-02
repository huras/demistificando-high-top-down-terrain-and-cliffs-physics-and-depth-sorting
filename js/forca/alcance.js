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
 * Preferir dirX/dirY. `body` passado como facing tem x/y = posição mundo —
 * não pode ganhar de dir* (senão o cone congela apontando pra origem).
 * @param {{ x: number, y: number, dirX?: number, dirY?: number }} body
 * @param {{ x?: number, y?: number, dirX?: number, dirY?: number } | null} facing
 */
export function facingDe(body, facing) {
  const src = facing || body;
  let fx;
  let fy;
  if (src && Number.isFinite(src.dirX) && Number.isFinite(src.dirY)) {
    fx = src.dirX;
    fy = src.dirY;
  } else if (
    src &&
    src !== body &&
    Number.isFinite(src.x) &&
    Number.isFinite(src.y)
  ) {
    // Vetor unitário explícito {x,y} (não é o corpo).
    fx = src.x;
    fy = src.y;
  } else {
    fx = Number(body?.dirX);
    fy = Number(body?.dirY);
  }
  if (!Number.isFinite(fx)) fx = 0;
  if (!Number.isFinite(fy)) fy = 0;
  const fl = Math.hypot(fx, fy);
  if (fl < 1e-6) return { x: 0, y: 1 };
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
