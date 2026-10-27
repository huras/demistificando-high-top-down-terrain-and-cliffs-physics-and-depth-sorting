/**
 * Arremesso balístico de pedras / corpos (Força).
 */
import { alturaSobPes } from "../fisica/colisao.js";
import { aplicarDanoLivre } from "../pokemon/combate/executor.js";
import { selvagensAtivos } from "../pokemon/populacao.js";
import { restaurarPokemon, restaurarProp } from "./carregar.js";
import { tentarEncaixarPedraLetra } from "../letras/runtime.js";

const THROW_SPEED = 11.2;
const THROW_SPEED_MIN = 2.05;
const AIM_CLOSE = 0.5;
const AIM_FAR = 5.4;
const POWER_FLOOR = 0.16;
const VZ0 = 5.65;
const GRAV = 13.5;
const H_DRAG = 1.22;
const MAX_AGE = 3.15;
const ROLL_DRAG = 7.4;
const ROLL_STOP = 0.12;
const ROLL_MAX = 2.05;
const ROLL_DRAG_BODY = 4.35;
const ROLL_STOP_BODY = 0.055;
const ROLL_MAX_BODY = 3.25;
const HIT_PAD = 0.42;
const POWER_DEFAULT = 35;
const PREVIEW_DT = 1 / 90;
const CHARGE_MS_DEFAULT = 950;

export {
  AIM_CLOSE as FORCA_AIM_PERTO,
  AIM_FAR as FORCA_AIM_LONGE,
  CHARGE_MS_DEFAULT as FORCA_CARGA_MS,
};

let nextId = 1;

/**
 * @param {object} carrier
 * @param {number} aimTx
 * @param {number} aimTy
 */
export function calcularLancamento(carrier, aimTx, aimTy) {
  const sx = carrier.x;
  const sy = carrier.y;
  const dx = Number(aimTx) - sx;
  const dy = Number(aimTy) - sy;
  const rawLen = Math.hypot(dx, dy);
  let ndx;
  let ndy;
  if (rawLen > 0.1) {
    ndx = dx / rawLen;
    ndy = dy / rawLen;
  } else {
    const fx = Number(carrier.dirX) || 0;
    const fy = Number(carrier.dirY) || 1;
    const fl = Math.hypot(fx, fy) || 1;
    ndx = fx / fl;
    ndy = fy / fl;
  }
  const distForPower = rawLen > 0.1 ? rawLen : AIM_CLOSE * 0.65;
  const span = AIM_FAR - AIM_CLOSE;
  const tLin = span > 1e-6 ? (distForPower - AIM_CLOSE) / span : 0;
  const power = Math.min(1, Math.max(POWER_FLOOR, tLin));
  const speed = THROW_SPEED_MIN + power * (THROW_SPEED - THROW_SPEED_MIN);
  const vz = VZ0 * (0.52 + 0.48 * power);
  return { sx, sy, vx: ndx * speed, vy: ndy * speed, vz, power };
}

/**
 * @param {number} chargeProgress
 */
export function alcanceMaxArremesso(chargeProgress) {
  const p = Math.max(0, Math.min(1, Number(chargeProgress) || 0));
  return AIM_CLOSE + p * (AIM_FAR - AIM_CLOSE);
}

/**
 * @param {object} carrier
 * @param {{
 *   chargeProgress?: number,
 *   pointer?: { x?: number, y?: number } | null,
 * }} [opts]
 */
export function resolverMiraArremesso(carrier, opts = {}) {
  const sx = carrier?.x ?? 0;
  const sy = carrier?.y ?? 0;
  const charge = Math.max(0, Math.min(1, Number(opts.chargeProgress) || 0));
  const maxDist = alcanceMaxArremesso(charge);
  const ptr = opts.pointer;
  let dirX;
  let dirY;
  let dist = maxDist;

  if (ptr && Number.isFinite(ptr.x) && Number.isFinite(ptr.y)) {
    const dx = ptr.x - sx;
    const dy = ptr.y - sy;
    const raw = Math.hypot(dx, dy);
    if (raw > 0.2) {
      dirX = dx / raw;
      dirY = dy / raw;
      dist = Math.max(AIM_CLOSE, Math.min(maxDist, raw));
    }
  }

  if (dirX == null) {
    const fx = Number(carrier?.dirX) || 0;
    const fy = Number(carrier?.dirY) || 1;
    const fl = Math.hypot(fx, fy) || 1;
    dirX = fx / fl;
    dirY = fy / fl;
  }

  return { x: sx + dirX * dist, y: sy + dirY * dist, maxDist };
}

/**
 * @param {object} carrier
 * @param {object} carry
 * @param {number} aimTx
 * @param {number} aimTy
 */
export function criarArremesso(carrier, carry, aimTx, aimTy) {
  const { sx, sy, vx, vy, vz } = calcularLancamento(carrier, aimTx, aimTy);
  const zSolo = alturaSobPes(sx, sy, (carrier.z ?? 0) + 1) || carrier.z || 0;
  return {
    id: nextId++,
    kind: carry.kind === "faintedWild" ? "faintedWild" : "rock",
    x: sx,
    y: sy,
    z: zSolo + 0.26,
    zSolo,
    vx,
    vy,
    vz,
    age: 0,
    phase: "air",
    rollAge: 0,
    bounces: 0,
    hitDone: false,
    carry,
    thrower: carrier ?? null,
  };
}

/**
 * @param {object} carrier
 * @param {object} carry
 * @param {number} aimTx
 * @param {number} aimTy
 */
export function amostrarArcoArremesso(carrier, carry, aimTx, aimTy) {
  if (!carrier || !carry) return null;
  const fainted = carry.kind === "faintedWild";
  const rollDragK = fainted ? ROLL_DRAG_BODY : ROLL_DRAG;
  const rollStop = fainted ? ROLL_STOP_BODY : ROLL_STOP;
  const rollMax = fainted ? ROLL_MAX_BODY : ROLL_MAX;
  const { sx, sy, vx: vx0, vy: vy0, vz: vz0 } = calcularLancamento(carrier, aimTx, aimTy);
  const zSolo0 = alturaSobPes(sx, sy, (carrier.z ?? 0) + 1) || carrier.z || 0;
  let vx = vx0;
  let vy = vy0;
  let vz = vz0;
  let x = sx;
  let y = sy;
  let z = 0.26;
  /** @type {Array<{ x: number, y: number, z: number }>} */
  const points = [{ x, y, z: zSolo0 + z }];
  let phase = "air";
  let rollAge = 0;
  let t = 0;
  while (t < MAX_AGE + rollMax + 0.25) {
    t += PREVIEW_DT;
    if (phase === "air") {
      const prevZ = z;
      const drag = Math.exp(-H_DRAG * PREVIEW_DT);
      vx *= drag;
      vy *= drag;
      vz -= GRAV * PREVIEW_DT;
      x += vx * PREVIEW_DT;
      y += vy * PREVIEW_DT;
      z += vz * PREVIEW_DT;
      const solo = alturaSobPes(x, y, zSolo0 + 2) || zSolo0;
      points.push({ x, y, z: solo + Math.max(0, z) });
      if ((t > 0.05 && z <= 0.02 && vz <= 0.15) || (prevZ > 0.04 && z < -0.08)) {
        z = 0;
        vz = 0;
        phase = "roll";
      }
    } else {
      rollAge += PREVIEW_DT;
      const rDrag = Math.exp(-rollDragK * PREVIEW_DT);
      vx *= rDrag;
      vy *= rDrag;
      x += vx * PREVIEW_DT;
      y += vy * PREVIEW_DT;
      const solo = alturaSobPes(x, y, zSolo0 + 2) || zSolo0;
      points.push({ x, y, z: solo });
      if (Math.hypot(vx, vy) < rollStop || rollAge > rollMax) break;
    }
    if (phase === "air" && t > MAX_AGE) break;
  }
  return { points, landX: x, landY: y };
}

function pousar(thrown) {
  const carry = thrown.carry;
  const x = thrown.x;
  const y = thrown.y;
  if (carry?.kind === "faintedWild" && carry.enemy) {
    restaurarPokemon(carry.enemy, x, y);
  } else if (carry?.prop) {
    restaurarProp(carry.prop, x, y);
    if (carry.prop.letterPuzzleLoose) tentarEncaixarPedraLetra(carry.prop);
  }
}

function tentarAcerto(thrown, poder) {
  if (thrown.hitDone || thrown.phase !== "air") return;
  const r = Math.max(
    0.35,
    thrown.carry?.halfW ?? 0.45,
    thrown.carry?.enemy?.r ?? 0,
  );
  const lista = selvagensAtivos();
  for (let i = 0; i < lista.length; i++) {
    const alvo = lista[i];
    if (!alvo || alvo.morto || alvo.capturado || alvo.forcaCarregado) continue;
    if (alvo === thrown.carry?.enemy) continue;
    const ar = Math.max(0.3, alvo.r || 0.34);
    const d = Math.hypot(alvo.x - thrown.x, alvo.y - thrown.y);
    if (d > r + ar + HIT_PAD) continue;
    const pe = alvo.z ?? 0;
    if (Math.abs((thrown.z ?? pe) - pe) > 2.2) continue;
    thrown.hitDone = true;
    const atacante = thrown.thrower?.stats
      ? thrown.thrower
      : {
          tipos: ["normal"],
          stats: { level: 20, atk: 45, def: 45, spa: 45, spd: 45, spe: 45 },
          x: thrown.x,
          y: thrown.y,
        };
    try {
      aplicarDanoLivre(atacante, alvo, poder, "normal", "physical", Date.now(), null);
    } catch {
      /* combate opcional */
    }
    thrown.x = alvo.x;
    thrown.y = alvo.y;
    thrown.vx *= 0.35;
    thrown.vy *= 0.35;
    thrown.vz = Math.min(thrown.vz, 0);
    return;
  }
}

/**
 * @param {object[]} lista
 * @param {number} dt
 * @param {number} [poder]
 */
export function atualizarArremessos(lista, dt, poder = POWER_DEFAULT) {
  for (let i = lista.length - 1; i >= 0; i--) {
    const t = lista[i];
    t.age += dt;
    const fainted = t.kind === "faintedWild";
    const rollDragK = fainted ? ROLL_DRAG_BODY : ROLL_DRAG;
    const rollStop = fainted ? ROLL_STOP_BODY : ROLL_STOP;
    const rollMax = fainted ? ROLL_MAX_BODY : ROLL_MAX;

    if (t.phase === "air") {
      const drag = Math.exp(-H_DRAG * dt);
      t.vx *= drag;
      t.vy *= drag;
      t.vz -= GRAV * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z += t.vz * dt;
      tentarAcerto(t, poder);
      const solo = alturaSobPes(t.x, t.y, (t.zSolo ?? 0) + 3) || t.zSolo || 0;
      t.zSolo = solo;
      if ((t.age > 0.05 && t.z <= solo + 0.02 && t.vz <= 0.15) || t.age > MAX_AGE) {
        t.z = solo;
        t.vz = 0;
        t.phase = "roll";
      }
    } else {
      t.rollAge = (t.rollAge || 0) + dt;
      const rDrag = Math.exp(-rollDragK * dt);
      t.vx *= rDrag;
      t.vy *= rDrag;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      const solo = alturaSobPes(t.x, t.y, (t.zSolo ?? 0) + 3) || t.zSolo || 0;
      t.z = solo;
      t.zSolo = solo;
      if (Math.hypot(t.vx, t.vy) < rollStop || t.rollAge > rollMax) {
        pousar(t);
        lista.splice(i, 1);
      }
    }
  }
}

export function limparArremessos(lista) {
  for (let i = 0; i < lista.length; i++) {
    const t = lista[i];
    if (t?.carry) pousar(t);
  }
  lista.length = 0;
}
