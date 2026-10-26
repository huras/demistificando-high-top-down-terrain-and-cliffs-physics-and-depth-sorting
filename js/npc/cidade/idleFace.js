/**
 * Soft-look + glance idle para NPCs parados.
 */
import { hashStr, mulberry32, pickIndex } from "../rng.js";

export const NPC_LOOK_REACH = 3.2;
export const NPC_IDLE_FACE_MIN_SEC = 10;
export const NPC_IDLE_FACE_MAX_SEC = 20;
export const NPC_IDLE_FACE_LOD_REACH = 28;

const LOOK_REACH_SQ = NPC_LOOK_REACH * NPC_LOOK_REACH;
const LOD_REACH_SQ = NPC_IDLE_FACE_LOD_REACH * NPC_IDLE_FACE_LOD_REACH;

const CARDINAIS = Object.freeze([
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
]);

function hashFrac(seed) {
  return ((seed >>> 0) % 10000) / 10000;
}

function idleDelaySec(idle) {
  const glance = (idle.glance | 0) + 1;
  idle.glance = glance;
  const rng = mulberry32((idle.seed ^ Math.imul(glance, 0x85ebca6b)) >>> 0);
  return (
    NPC_IDLE_FACE_MIN_SEC +
    rng() * (NPC_IDLE_FACE_MAX_SEC - NPC_IDLE_FACE_MIN_SEC)
  );
}

function cardinalIndex(facing) {
  const fx = facing?.x ?? 0;
  const fy = facing?.y ?? 0;
  const ax = Math.abs(fx);
  const ay = Math.abs(fy);
  if (ay >= ax) return fy >= 0 ? 0 : 1;
  return fx >= 0 ? 2 : 3;
}

function pickIdleCardinal(idle, facing) {
  const rng = mulberry32(
    (idle.seed ^ Math.imul((idle.glance | 0) + 1, 0x9e3779b1)) >>> 0,
  );
  const cur = cardinalIndex(facing);
  let idx = pickIndex(rng, 3);
  if (idx >= cur) idx += 1;
  return CARDINAIS[idx];
}

export function garantirIdleFace(bag, seedKey) {
  if (bag._idleFace) return bag._idleFace;
  const seed = hashStr(seedKey ?? "npc");
  bag._idleFace = {
    seed,
    nextAt: 1 + hashFrac(seed) * (NPC_IDLE_FACE_MAX_SEC - 1),
    glance: 0,
    looking: false,
    lodOut: false,
  };
  return bag._idleFace;
}

/**
 * @returns {"look"|"idle"|"none"}
 */
export function tickIdleFace({
  facing,
  idle,
  x,
  y,
  playerX,
  playerY,
  dt = 0,
  lookReach = NPC_LOOK_REACH,
}) {
  if (!facing || !idle) return "none";
  const dx = playerX - x;
  const dy = playerY - y;
  const distSq = dx * dx + dy * dy;
  const reachSq = lookReach * lookReach;

  if (distSq > LOD_REACH_SQ) {
    if (!idle.lodOut) {
      idle.lodOut = true;
      idle.nextAt = idleDelaySec(idle);
    }
    idle.looking = false;
    return "none";
  }
  if (idle.lodOut) {
    idle.lodOut = false;
    idle.nextAt = idleDelaySec(idle);
  }

  if (distSq <= reachSq) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ay >= ax) {
      facing.x = 0;
      facing.y = dy >= 0 ? 1 : -1;
    } else {
      facing.x = dx >= 0 ? 1 : -1;
      facing.y = 0;
    }
    idle.looking = true;
    return "look";
  }

  idle.looking = false;
  idle.nextAt -= dt;
  if (idle.nextAt > 0) return "none";
  const next = pickIdleCardinal(idle, facing);
  facing.x = next.x;
  facing.y = next.y;
  idle.nextAt = idleDelaySec(idle);
  return "idle";
}

/** Índice de linha do sheet Platinum (down/up/right/left → 0..3 mapeado no crop). */
export function linhaFacing(facing) {
  const fx = facing?.x ?? 0;
  const fy = facing?.y ?? 1;
  if (Math.abs(fy) >= Math.abs(fx)) return fy >= 0 ? 0 : 1;
  return fx >= 0 ? 2 : 3;
}
