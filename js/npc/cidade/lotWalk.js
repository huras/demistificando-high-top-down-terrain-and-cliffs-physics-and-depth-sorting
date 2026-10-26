/**
 * Andar no lote — wait / burst / LOD por câmera.
 * Z segue o voxel (`snapChaoNpc`); degraus >1 bloco são rejeitados.
 */
import { alturaSobPes } from "../../fisica/colisao.js";
import { PERFIL_ANDAR } from "../catalogo/identidade.js";
import { snapChaoNpc } from "../locomocao.js";
import { npcPerfCount } from "../perf.js";
import { avancarAnimPeople } from "../render/peopleAnim.js";
import { hashStr, mulberry32, pickIndex } from "../rng.js";
import {
  NPC_IDLE_FACE_LOD_REACH,
  NPC_LOOK_REACH,
  garantirIdleFace,
  tickIdleFace,
} from "./idleFace.js";
import { construirMascaraLote } from "./lotMask.js";

/** Diferença máxima de altura (blocos) entre tiles do lote. */
const LOT_DEGRAU_MAX = 1;

export const LOT_WALK_CAMERA_PAD = 4;

export const LOT_WALK_PERFIS = Object.freeze({
  [PERFIL_ANDAR.CHILD]: Object.freeze({
    speed: 3.2,
    waitMin: 0.35,
    waitMax: 1.6,
    burstMin: 1,
    burstMax: 3,
  }),
  [PERFIL_ANDAR.ADULT]: Object.freeze({
    speed: 2.2,
    waitMin: 1.4,
    waitMax: 4.2,
    burstMin: 1,
    burstMax: 2,
  }),
  [PERFIL_ANDAR.ELDER]: Object.freeze({
    speed: 1.35,
    waitMin: 4,
    waitMax: 10,
    burstMin: 1,
    burstMax: 1,
  }),
});

const CARDINAIS = Object.freeze([
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
]);

function tune(perfil) {
  return LOT_WALK_PERFIS[perfil] || LOT_WALK_PERFIS[PERFIL_ANDAR.ADULT];
}

function hashFrac(seed) {
  return ((seed >>> 0) % 10000) / 10000;
}

function inAabb(x, y, aabb, pad = LOT_WALK_CAMERA_PAD) {
  if (!aabb) return true;
  return (
    x >= aabb.minX - pad &&
    x <= aabb.maxX + pad &&
    y >= aabb.minY - pad &&
    y <= aabb.maxY + pad
  );
}

function waitDelay(walk, t) {
  walk.roll = (walk.roll | 0) + 1;
  const rng = mulberry32((walk.seed ^ Math.imul(walk.roll, 0x85ebca6b)) >>> 0);
  return t.waitMin + rng() * Math.max(0, t.waitMax - t.waitMin);
}

function rollBurst(walk, t) {
  const span = Math.max(0, (t.burstMax | 0) - (t.burstMin | 0));
  walk.roll = (walk.roll | 0) + 1;
  const rng = mulberry32((walk.seed ^ Math.imul(walk.roll, 0x9e3779b1)) >>> 0);
  return (t.burstMin | 0) + pickIndex(rng, span + 1);
}

function alturaTileOk(npc, nx, ny) {
  const ref = npc.elevacao ?? npc.z;
  const zAqui = Number.isFinite(ref) ? ref : 0;
  const zLa = alturaSobPes(nx + 0.5, ny + 0.5, zAqui || undefined);
  if (!(zLa > 0)) return false;
  if (!(zAqui > 0)) return true;
  return Math.abs(zLa - zAqui) <= LOT_DEGRAU_MAX;
}

function pickStepDir(walk, tx, ty, mask, player, npc) {
  walk.roll = (walk.roll | 0) + 1;
  const rng = mulberry32((walk.seed ^ Math.imul(walk.roll, 0xc2b2ae35)) >>> 0);
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  for (const idx of order) {
    const dir = CARDINAIS[idx];
    const nx = tx + dir.x;
    const ny = ty + dir.y;
    if (!mask.has(nx, ny)) continue;
    if (
      player &&
      Math.floor(player.x) === nx &&
      Math.floor(player.y) === ny
    ) {
      continue;
    }
    if (npc && !alturaTileOk(npc, nx, ny)) continue;
    return dir;
  }
  return null;
}

function garantirWalk(npc) {
  if (npc._lotWalk) return npc._lotWalk;
  const seed = hashStr(npc.id ?? npc.peopleSeed ?? "lot-walk");
  npc._lotWalk = {
    seed,
    wait: 0.4 + hashFrac(seed) * 2.2,
    roll: 0,
    burst: 0,
    stepping: false,
    fromX: npc.x,
    fromY: npc.y,
    toX: npc.x,
    toY: npc.y,
    t: 0,
    speed: 2.2,
    lodOut: false,
    snapped: false,
  };
  return npc._lotWalk;
}

function garantirMask(npc) {
  if (npc._lotMask) return npc._lotMask;
  if (!npc.casa) return null;
  npc._lotMask = construirMascaraLote(npc.casa);
  return npc._lotMask;
}

/**
 * @param {object} npc
 * @param {object} player
 * @param {number} dt
 * @param {{ minX:number,maxX:number,minY:number,maxY:number }|null} cameraAabb
 */
export function tickLotWalk(npc, player, dt, cameraAabb) {
  if (!npc || npc.perfilAndar === PERFIL_ANDAR.STILL || npc.modo === "parado") {
    return tickParado(npc, player, dt);
  }

  const mask = garantirMask(npc);
  if (!mask) return tickParado(npc, player, dt);

  const walk = garantirWalk(npc);
  const perfil = npc.perfilAndar || PERFIL_ANDAR.ADULT;
  const t = tune(perfil);

  if (!inAabb(npc.x, npc.y, cameraAabb)) {
    if (!walk.lodOut) {
      walk.lodOut = true;
      if (walk.stepping) {
        npc.x = walk.toX;
        npc.y = walk.toY;
        walk.stepping = false;
      }
      npc.vx = 0;
      npc.vy = 0;
      npc.andando = false;
      snapChaoNpc(npc);
    }
    return;
  }
  walk.lodOut = false;
  npcPerfCount("lotWalkSim");

  if (!walk.snapped) {
    const near = mask.nearest(npc.x, npc.y);
    if (near) {
      npc.x = near.tx + 0.5;
      npc.y = near.ty + 0.5;
    }
    walk.snapped = true;
    snapChaoNpc(npc);
  }

  if (walk.stepping) {
    walk.t += (dt * walk.speed) / Math.max(0.01, Math.hypot(walk.toX - walk.fromX, walk.toY - walk.fromY) || 1);
    if (walk.t >= 1) {
      npc.x = walk.toX;
      npc.y = walk.toY;
      walk.stepping = false;
      npc.vx = 0;
      npc.vy = 0;
      npc.andando = false;
      walk.burst -= 1;
      if (walk.burst <= 0) walk.wait = waitDelay(walk, t);
    } else {
      const u = walk.t;
      npc.x = walk.fromX + (walk.toX - walk.fromX) * u;
      npc.y = walk.fromY + (walk.toY - walk.fromY) * u;
      npc.vx = (walk.toX - walk.fromX) * walk.speed;
      npc.vy = (walk.toY - walk.fromY) * walk.speed;
      npc.andando = true;
      if (!npc.facing) npc.facing = { x: 0, y: 1 };
      npc.facing.x = Math.sign(walk.toX - walk.fromX);
      npc.facing.y = Math.sign(walk.toY - walk.fromY);
    }
    snapChaoNpc(npc);
    avancarAnim(npc, dt);
    return;
  }

  if (walk.wait > 0) {
    walk.wait -= dt;
    npc.vx = 0;
    npc.vy = 0;
    npc.andando = false;
    tickParado(npc, player, dt);
    return;
  }

  if (walk.burst <= 0) walk.burst = rollBurst(walk, t);
  const tx = Math.floor(npc.x);
  const ty = Math.floor(npc.y);
  const dir = pickStepDir(walk, tx, ty, mask, player, npc);
  if (!dir) {
    walk.wait = waitDelay(walk, t);
    walk.burst = 0;
    tickParado(npc, player, dt);
    return;
  }
  walk.stepping = true;
  walk.fromX = tx + 0.5;
  walk.fromY = ty + 0.5;
  walk.toX = tx + dir.x + 0.5;
  walk.toY = ty + dir.y + 0.5;
  walk.t = 0;
  walk.speed = t.speed;
  if (!npc.facing) npc.facing = { x: 0, y: 1 };
  npc.facing.x = dir.x;
  npc.facing.y = dir.y;
}

function tickParado(npc, player, dt) {
  if (!npc.facing) npc.facing = { x: 0, y: 1 };
  const idle = garantirIdleFace(npc, npc.id ?? npc.peopleSeed ?? "npc");
  tickIdleFace({
    facing: npc.facing,
    idle,
    x: npc.x,
    y: npc.y,
    playerX: player?.x ?? npc.x,
    playerY: player?.y ?? npc.y,
    dt,
    lookReach: NPC_LOOK_REACH,
  });
  npc.andando = false;
  npc.vx = 0;
  npc.vy = 0;
  snapChaoNpc(npc);
  avancarAnim(npc, dt);
}

function avancarAnim(npc, dt) {
  avancarAnimPeople(npc, dt);
}

export { NPC_IDLE_FACE_LOD_REACH };
