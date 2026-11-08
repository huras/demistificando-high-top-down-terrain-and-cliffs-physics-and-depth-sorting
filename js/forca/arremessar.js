/**
 * Arremesso balístico de pedras / corpos (Força).
 * Hit/dano/knockback: ver impactoArremesso.js.
 */
import { alturaSobPes } from "../fisica/colisao.js";
import { resolverPassoProjetil } from "../fisica/colisaoProjetil.js";
import { restaurarPokemon, restaurarProp } from "./carregar.js";
import {
  iniciarEncaixePedraLetra,
  temBuracoNoAlcance,
} from "../letras/runtime.js";
import { pesoDoPokemon } from "./alvos.js";
import { normalizarPeso, pesoDoProp, PESO_MIN } from "./pesoCarga.js";
import { tentarAcertoArremesso } from "./impactoArremesso.js";

const THROW_SPEED = 11.2;
const THROW_SPEED_MIN = 1.55;
const AIM_CLOSE = 1;
const AIM_FAR = 5.4;
const POWER_FLOOR = 0.08;
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
  // Sem cursor: joga no mínimo à frente (não no alcance carregado — isso
  // fazia o “mínimo” parecer 3–4 tiles enquanto a carga subia).
  let dist = AIM_CLOSE;

  if (ptr && Number.isFinite(ptr.x) && Number.isFinite(ptr.y)) {
    const dx = ptr.x - sx;
    const dy = ptr.y - sy;
    const raw = Math.hypot(dx, dy);
    if (raw > 1e-4) {
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
 * @param {object | null | undefined} carry
 */
function pesoDoCarry(carry) {
  if (carry?.weightTier != null) return normalizarPeso(carry.weightTier, PESO_MIN);
  if (carry?.prop) return pesoDoProp(carry.prop);
  if (carry?.enemy) return pesoDoPokemon(carry.enemy);
  return PESO_MIN;
}

/**
 * @param {object} carrier
 * @param {object} carry
 * @param {number} aimTx
 * @param {number} aimTy
 */
export function criarArremesso(carrier, carry, aimTx, aimTy) {
  const { sx, sy, vx, vy, vz, power } = calcularLancamento(carrier, aimTx, aimTy);
  // Telecinese: parte da posição atual do anexo (já flutuando).
  const held = carry?.prop || carry?.enemy;
  const startX = Number.isFinite(held?.x) ? held.x : sx;
  const startY = Number.isFinite(held?.y) ? held.y : sy;
  const zSolo = alturaSobPes(startX, startY, (carrier.z ?? 0) + 1) || carrier.z || 0;
  const zHeld = Number(held?.z);
  const zStart = Number.isFinite(zHeld) ? Math.max(zSolo + 0.26, zHeld) : zSolo + 0.26;
  const halfW = Math.max(
    0.35,
    Number(carry?.halfW) || 0,
    Number(carry?.prop?.r) || 0,
    Number(carry?.enemy?.r) || 0,
    0.45,
  );
  return {
    id: nextId++,
    kind: carry.kind === "faintedWild" ? "faintedWild" : "rock",
    x: startX,
    y: startY,
    z: zStart,
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
    weightTier: pesoDoCarry(carry),
    launchPower: power,
    halfW,
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
  /** Estado mutável — mesma física do runtime (inclui ricochete). */
  const p = {
    x: sx,
    y: sy,
    z: zSolo0 + 0.26,
    zSolo: zSolo0,
    vx: vx0,
    vy: vy0,
    vz: vz0,
    bounces: 0,
  };
  /** @type {Array<{ x: number, y: number, z: number }>} */
  const points = [{ x: p.x, y: p.y, z: p.z }];
  let phase = "air";
  let rollAge = 0;
  let t = 0;
  while (t < MAX_AGE + rollMax + 0.25) {
    t += PREVIEW_DT;
    if (phase === "air") {
      const hit = resolverPassoProjetil(p, PREVIEW_DT, {
        modo: "air",
        gravidade: GRAV,
        dragH: H_DRAG,
        raio: 0.02,
      });
      points.push({ x: p.x, y: p.y, z: p.z });
      if ((t > 0.05 && hit === "floor") || t > MAX_AGE) {
        p.vz = 0;
        phase = "roll";
      }
    } else {
      rollAge += PREVIEW_DT;
      resolverPassoProjetil(p, PREVIEW_DT, {
        modo: "roll",
        dragH: rollDragK,
      });
      points.push({ x: p.x, y: p.y, z: p.z });
      if (Math.hypot(p.vx, p.vy) < rollStop || rollAge > rollMax) break;
    }
  }
  return { points, landX: p.x, landY: p.y };
}

function pousar(thrown) {
  const carry = thrown.carry;
  const x = thrown.x;
  const y = thrown.y;
  if (carry?.kind === "faintedWild" && carry.enemy) {
    restaurarPokemon(carry.enemy, x, y);
  } else if (carry?.prop) {
    restaurarProp(carry.prop, x, y);
    if (carry.prop.letterPuzzleLoose) {
      iniciarEncaixePedraLetra(carry.prop, { fromX: x, fromY: y, fromZ: carry.prop.z });
    }
  }
}

/**
 * Pedra de letra perto do buraco: corta o voo e inicia o tween.
 * @param {object} thrown
 * @returns {boolean}
 */
function magnetizarLetra(thrown) {
  const prop = thrown?.carry?.prop;
  if (!prop?.letterPuzzleLoose) return false;
  if (!temBuracoNoAlcance(prop, thrown.x, thrown.y)) return false;
  const z = Number.isFinite(thrown.z) ? thrown.z : prop.z;
  return iniciarEncaixePedraLetra(prop, {
    fromX: thrown.x,
    fromY: thrown.y,
    fromZ: z,
  });
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
      const hit = resolverPassoProjetil(t, dt, {
        modo: "air",
        gravidade: GRAV,
        dragH: H_DRAG,
        raio: 0.02,
      });
      if (magnetizarLetra(t)) {
        lista.splice(i, 1);
        continue;
      }
      tentarAcertoArremesso(t, poder);
      if ((t.age > 0.05 && hit === "floor") || t.age > MAX_AGE) {
        t.z = t.zSolo ?? t.z;
        t.vz = 0;
        t.phase = "roll";
      }
    } else {
      t.rollAge = (t.rollAge || 0) + dt;
      resolverPassoProjetil(t, dt, {
        modo: "roll",
        dragH: rollDragK,
      });
      if (magnetizarLetra(t)) {
        lista.splice(i, 1);
        continue;
      }
      tentarAcertoArremesso(t, poder);
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
