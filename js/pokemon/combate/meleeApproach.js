/**
 * Lunge de contato (port mínimo do Pokemon AI).
 * Dash/jumpKick/grabSlam ficam pra depois — basic + contact usam lunge.
 */
import { RAIO_POKEMON } from "../../config.js";

export const APPROACH = Object.freeze({
  LUNGE: "lunge",
  DASH: "dash",
});

/** Knobs alinhados ao Pokemon AI CONFIG.combat */
export const BASIC_MELEE = Object.freeze({
  power: 18,
  tipo: "normal",
  reach: 1,
  flash: 0.12,
  cooldown: 0.55,
  approach: APPROACH.LUNGE,
});

export const APPROACH_CFG = Object.freeze({
  lungeDistance: 0.55,
  lungeMinDistance: 0.22,
  lungeDuration: 0.16,
  lungeReachBonus: 0.55,
});

export const ENGAGE_CFG = Object.freeze({
  strafe: 0.18,
  radial: 1.55,
  switchMin: 1.4,
  switchMax: 3.0,
});

export const AI_MELEE_CONTACT_PAD = 0.28;
export const MELEE_RANGE_TOLERANCE = 0.1;

export function raioCorpo(ator) {
  return ator?.raioCorpo > 0 ? ator.raioCorpo : RAIO_POKEMON;
}

export function bodyRadiiPad(a, b) {
  return raioCorpo(a) + raioCorpo(b);
}

export function meleeContactStopDistance(attacker, target, pad = AI_MELEE_CONTACT_PAD) {
  return bodyRadiiPad(attacker, target) + Math.max(0.05, pad ?? AI_MELEE_CONTACT_PAD);
}

export function contactHitDistance(attacker, target, engageGap) {
  return bodyRadiiPad(attacker, target) + Math.max(0, engageGap ?? 0);
}

export function contactAttackHitDistance(attacker, target, engageGap, tolerance = MELEE_RANGE_TOLERANCE) {
  const exact = contactHitDistance(attacker, target, engageGap);
  return exact * (1 + Math.max(0, tolerance ?? MELEE_RANGE_TOLERANCE));
}

export function contactEngageRange(reach = BASIC_MELEE.reach) {
  return Math.max(0.2, reach) + APPROACH_CFG.lungeReachBonus;
}

export function meleeApproachGoal(from, target, standOff) {
  if (!from || !target) return null;
  const stop = Math.max(0.15, standOff ?? bodyRadiiPad(from, target));
  const dx = from.x - target.x;
  const dy = from.y - target.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    const fx = from.dirX || 0;
    const fy = from.dirY || 1;
    const fl = Math.hypot(fx, fy) || 1;
    return { x: target.x - (fx / fl) * stop, y: target.y - (fy / fl) * stop };
  }
  return {
    x: target.x + (dx / dist) * stop,
    y: target.y + (dy / dist) * stop,
  };
}

export function aiMeleeApproachGoal(from, target) {
  return meleeApproachGoal(from, target, meleeContactStopDistance(from, target));
}

export function aiShouldKeepClosing(attacker, target) {
  if (!attacker || !target) return false;
  const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
  return d > meleeContactStopDistance(attacker, target) + 0.12;
}

export function aiContactInRange(attacker, target, reach = BASIC_MELEE.reach) {
  if (!attacker || !target) return false;
  const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
  return d <= contactAttackHitDistance(attacker, target, reach);
}

function tickEngageStrafe(entity, dt) {
  let s = entity._combatEngage;
  if (!s) {
    const seed = ((entity.especie?.dex ?? 1) * 17 + Math.floor((entity.x ?? 0) * 8)) | 0;
    s = entity._combatEngage = { dir: seed % 2 === 0 ? 1 : -1, timer: 1.2 };
  }
  s.timer -= dt;
  if (s.timer <= 0) {
    if (Math.random() < 0.45) s.dir = -s.dir;
    const lo = ENGAGE_CFG.switchMin;
    const hi = ENGAGE_CFG.switchMax;
    s.timer = lo + Math.random() * Math.max(0.15, hi - lo);
  }
  return s;
}

/** Soft hold no anel de melee. */
export function combatEngageSteer(entity, target, dt = 1 / 60) {
  if (!entity || !target) return { x: 0, y: 0 };
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy);
  const stop = meleeContactStopDistance(entity, target);
  const nx = dist > 1e-5 ? dx / dist : entity.dirX || 1;
  const ny = dist > 1e-5 ? dy / dist : entity.dirY || 0;
  const nLen = Math.hypot(nx, ny) || 1;
  const ux = nx / nLen;
  const uy = ny / nLen;
  const s = tickEngageStrafe(entity, dt);
  const mag = ENGAGE_CFG.strafe;
  const radial = Math.max(-1, Math.min(1, (dist - stop) * ENGAGE_CFG.radial));
  const onRing = Math.abs(radial) < 0.14;
  const tang = onRing ? mag * 0.35 : mag;
  return {
    x: -uy * s.dir * tang + ux * radial * mag,
    y: ux * s.dir * tang + uy * radial * mag,
  };
}

export function approachForMove(def) {
  if (!def) return null;
  if (def.forma === "radius") return null;
  if (def.approach) return def.approach;
  if (def.forma === "contact" || def.key === "basico" || def.key === "basicAttack") {
    return APPROACH.LUNGE;
  }
  return null;
}

export function isInMeleeApproach(entity) {
  return entity?.meleeApproach != null;
}

export function isCombatMotionLocked(entity) {
  return isInMeleeApproach(entity);
}

function easeLunge(t) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

function computeLungeEnd(attacker, target, facing) {
  const cfg = APPROACH_CFG;
  let fx = facing?.x ?? attacker.dirX ?? 1;
  let fy = facing?.y ?? attacker.dirY ?? 0;
  const fl = Math.hypot(fx, fy) || 1;
  fx /= fl;
  fy /= fl;

  let travel = cfg.lungeDistance;
  if (target) {
    const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
    const stop = meleeContactStopDistance(attacker, target) * 0.85;
    travel = Math.max(cfg.lungeMinDistance, Math.min(cfg.lungeDistance, Math.max(0, d - stop)));
  }
  return {
    x: attacker.x + fx * travel,
    y: attacker.y + fy * travel,
    travel,
  };
}

/**
 * @returns {boolean} false se já há approach ativo
 */
export function beginMeleeApproach(attacker, def, target, onImpact) {
  const kind = approachForMove(def);
  if (!kind) {
    onImpact?.();
    return true;
  }
  if (isInMeleeApproach(attacker)) return false;

  const dx = (target?.x ?? attacker.x + attacker.dirX) - attacker.x;
  const dy = (target?.y ?? attacker.y + attacker.dirY) - attacker.y;
  const len = Math.hypot(dx, dy) || 1;
  const facing = { x: dx / len, y: dy / len };
  const end = computeLungeEnd(attacker, target, facing);

  // Já no bolso: impacto imediato, sem travel.
  if (target && !aiShouldKeepClosing(attacker, target) && end.travel < APPROACH_CFG.lungeMinDistance * 1.05) {
    onImpact?.();
    return true;
  }

  attacker.vx = 0;
  attacker.vy = 0;
  attacker.andando = false;
  attacker.meleeApproach = {
    kind,
    target: target ?? null,
    fromX: attacker.x,
    fromY: attacker.y,
    toX: end.x,
    toY: end.y,
    timer: 0,
    duration: APPROACH_CFG.lungeDuration,
    onImpact,
    impacted: false,
    facing,
  };
  attacker.dirX = facing.x;
  attacker.dirY = facing.y;
  return true;
}

export function tickMeleeApproach(entity, dt) {
  const ap = entity?.meleeApproach;
  if (!ap) return false;

  if (ap.target && (ap.target.morto || ap.target.capturado || ap.target.hp <= 0)) {
    clearMeleeApproach(entity);
    entity.vx = 0;
    entity.vy = 0;
    return false;
  }

  ap.timer += dt;
  const t = ap.duration > 0 ? ap.timer / ap.duration : 1;
  const eased = easeLunge(t);
  const prevX = entity.x;
  const prevY = entity.y;
  entity.x = ap.fromX + (ap.toX - ap.fromX) * eased;
  entity.y = ap.fromY + (ap.toY - ap.fromY) * eased;
  entity.dirX = ap.facing.x;
  entity.dirY = ap.facing.y;
  if (dt > 1e-6) {
    entity.vx = (entity.x - prevX) / dt;
    entity.vy = (entity.y - prevY) / dt;
  }
  entity.andando = true;

  if (t >= 1 && !ap.impacted) {
    ap.impacted = true;
    const cb = ap.onImpact;
    entity.meleeApproach = null;
    entity.vx = 0;
    entity.vy = 0;
    entity.andando = false;
    cb?.();
  }
  return true;
}

export function clearMeleeApproach(entity) {
  if (!entity) return;
  entity.meleeApproach = null;
}
