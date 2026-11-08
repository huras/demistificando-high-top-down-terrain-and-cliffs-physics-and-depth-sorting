/**
 * Passo balístico compartilhado: ricochete em face de cliff/terrace,
 * aterrissa só em piso real. Mutação in-place, zero alloc no hot path.
 */
import {
  PROJETIL_ALTURA_COLISAO,
  PROJETIL_ATRITO_PAREDE,
  PROJETIL_MAX_STEP_UP,
  PROJETIL_RESTITUICAO,
} from "../config.js";
import { alturaSobPes, corpoColideSolido } from "./colisao.js";

/**
 * @typedef {{
 *   raio?: number,
 *   floorOffset?: number,
 *   maxStepUp?: number,
 *   restituicao?: number,
 *   atritoParede?: number,
 *   alturaColisao?: number,
 *   gravidade?: number,
 *   dragH?: number,
 *   rollMul?: number,
 *   modo?: "air" | "roll",
 * }} OptsPassoProjetil
 */

/**
 * True se a coluna destino é face de parede pro projetil (não piso caminhável).
 * @param {number} nx
 * @param {number} ny
 * @param {number} z
 * @param {number} soloAntes
 * @param {number} maxStep
 * @param {number} alturaCol
 */
function ehFaceParede(nx, ny, z, soloAntes, maxStep, alturaCol) {
  const elevRef = Math.max(z, soloAntes) + 1;
  const solo = alturaSobPes(nx, ny, elevRef) || 0;
  if (solo - soloAntes > maxStep && z < solo - 1e-3) return true;
  const cx = Math.floor(nx);
  const cy = Math.floor(ny);
  // Sólido na faixa vertical do projetil (meio da face).
  if (corpoColideSolido(cx, cy, z, alturaCol, Math.floor(z))) return true;
  return false;
}

/**
 * Integra um passo e resolve parede/chão.
 * Mutates `p`: x,y,z,vx,vy,vz,zSolo?,bounces?
 *
 * @param {object} p
 * @param {number} dt
 * @param {OptsPassoProjetil} [opts]
 * @returns {"none" | "floor" | "wall"}
 */
export function resolverPassoProjetil(p, dt, opts = {}) {
  if (!p || !(dt > 0)) return "none";

  const modo = opts.modo === "roll" ? "roll" : "air";
  const raio = opts.raio ?? 0.02;
  const floorOff = opts.floorOffset ?? 0;
  const maxStep = opts.maxStepUp ?? PROJETIL_MAX_STEP_UP;
  const rest = opts.restituicao ?? PROJETIL_RESTITUICAO;
  const atrito = opts.atritoParede ?? PROJETIL_ATRITO_PAREDE;
  const alturaCol = opts.alturaColisao ?? PROJETIL_ALTURA_COLISAO;
  const grav = opts.gravidade ?? 0;
  const dragH = opts.dragH ?? 0;
  const rollMul = opts.rollMul ?? 1;

  let vx = Number(p.vx) || 0;
  let vy = Number(p.vy) || 0;
  let vz = Number(p.vz) || 0;

  if (dragH > 0) {
    const d = Math.exp(-dragH * dt);
    vx *= d;
    vy *= d;
  }
  if (modo === "air" && grav > 0) vz -= grav * dt;
  if (modo === "roll") vz = 0;

  const x0 = p.x;
  const y0 = p.y;
  const z0 = p.z;
  const soloAntes =
    alturaSobPes(x0, y0, (Number.isFinite(z0) ? z0 : 0) + 0.35) ||
    p.zSolo ||
    0;

  let x = x0;
  let y = y0;
  let z = modo === "air" ? z0 + vz * dt : z0;
  let hit = "none";

  const mul = modo === "roll" ? rollMul : 1;
  const dx = vx * dt * mul;
  const dy = vy * dt * mul;

  if (dx !== 0) {
    const nx = x0 + dx;
    if (ehFaceParede(nx, y0, z, soloAntes, maxStep, alturaCol)) {
      vx *= -rest;
      vy *= atrito;
      hit = "wall";
      if (typeof p.bounces === "number") p.bounces += 1;
    } else {
      x = nx;
    }
  }
  if (dy !== 0) {
    const ny = y0 + dy;
    if (ehFaceParede(x, ny, z, soloAntes, maxStep, alturaCol)) {
      vy *= -rest;
      vx *= atrito;
      hit = "wall";
      if (typeof p.bounces === "number") p.bounces += 1;
    } else {
      y = ny;
    }
  }

  const elevSolo = Math.max(z, soloAntes) + 1;
  const solo = alturaSobPes(x, y, elevSolo) || soloAntes;

  p.vx = vx;
  p.vy = vy;
  p.vz = vz;
  p.x = x;
  p.y = y;
  p.zSolo = solo;

  if (modo === "roll") {
    // Nunca gruda em terrace mais alto após wall; piso/descida ok.
    if (hit === "wall") {
      p.z = soloAntes + floorOff;
      p.zSolo = soloAntes;
    } else {
      p.z = solo + floorOff;
    }
    return hit;
  }

  // Air: aterrissa só se o piso sob o pé está ao alcance (não face).
  // limiar = topo do piso + offset do raio do projetil; `raio` é folga de contato.
  const pisoOk = solo - soloAntes <= maxStep + 1e-3 || z + raio >= solo - 1e-3;
  if (
    hit !== "wall" &&
    pisoOk &&
    z <= solo + floorOff + raio &&
    vz <= 0.15
  ) {
    p.z = solo + floorOff;
    p.vz = 0;
    return "floor";
  }

  p.z = z;
  return hit;
}
