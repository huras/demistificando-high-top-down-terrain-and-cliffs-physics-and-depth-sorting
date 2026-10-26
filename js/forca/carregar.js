/**
 * Canal de lift, estado de carregamento e mobilidade.
 */
import { RAIO_BASE_PEDRA, RAIO_POKEMON } from "../config.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { reindexarEm } from "../mundo/bioma/propsBioma.js";
import { forcaDoCarrier, poderForca, FORCA_HUMANO } from "./forcaEspecie.js";
import { normalizarPeso } from "./pesoCarga.js";
import { podeLevantar, duracaoFalhaSec } from "./falhaLevantar.js";
import { acharAlvoForca } from "./alvos.js";
import {
  STRUGGLE_SEC,
  ehAgroForca,
  ehVivoLevantavel,
  travarVivoNoLift,
} from "./agarrarVivo.js";

/**
 * @param {object} carrier
 * @param {{ humanoTier?: number } | null} cfg
 */
export function resolverTierCarrier(carrier, cfg = null) {
  return forcaDoCarrier(carrier, cfg);
}

/**
 * @param {number} strengthTier
 * @param {number} weightTier
 * @param {number} [spriteCount]
 */
export function duracaoGrabSec(strengthTier, weightTier, spriteCount = 2) {
  const sp = Math.max(1, spriteCount | 0);
  const power = poderForca(strengthTier, 1.2);
  const base = 0.24 + sp * 0.045;
  const weightMul = 0.85 + Math.max(1, weightTier | 0) * 0.22;
  return Math.max(0.18, Math.min(2.1, (base * weightMul) / (0.72 + power * 0.55)));
}

/**
 * @param {object | null} carry
 * @param {number} maxTier
 */
export function infoMobilidade(carry, maxTier) {
  if (!carry) return null;
  const weight = normalizarPeso(carry.weightTier);
  const max = Math.max(1, maxTier | 0);
  if (weight > max) return { kind: "blocked", chave: "forca.muitoPesado" };
  if (weight >= max && weight >= 2) return { kind: "heavy", chave: "forca.pesado" };
  return null;
}

/**
 * @param {object | null} carry
 * @param {number} maxTier
 */
export function mulVelocidadeCarry(carry, maxTier) {
  const m = infoMobilidade(carry, maxTier);
  if (!m) return 1;
  if (m.kind === "blocked") return 0;
  return 0.78;
}

/**
 * Soft-hide prop no mundo.
 * @param {object} prop
 */
export function ocultarProp(prop) {
  if (!prop) return;
  // Só marca carry — NÃO oculta o billboard (fica anexado na cabeça / voo).
  prop.forcaCarregado = true;
  reindexarEm(prop.x, prop.y);
}

/**
 * @param {object} prop
 * @param {number} x
 * @param {number} y
 */
export function restaurarProp(prop, x, y) {
  if (!prop) return;
  const z = alturaSobPes(x, y, (prop.z ?? 0) + 1) || prop.z || 0;
  const ox = prop.x;
  const oy = prop.y;
  prop.x = x;
  prop.y = y;
  prop.z = z;
  prop.forcaCarregado = false;
  reindexarEm(ox, oy);
  reindexarEm(x, y);
}

/**
 * @param {object} enemy
 */
export function ocultarPokemon(enemy) {
  if (!enemy) return;
  enemy.forcaCarregado = true;
  enemy._forcaPrevVx = enemy.vx;
  enemy._forcaPrevVy = enemy.vy;
  enemy.vx = 0;
  enemy.vy = 0;
}

/**
 * @param {object} enemy
 * @param {number} x
 * @param {number} y
 */
export function restaurarPokemon(enemy, x, y) {
  if (!enemy) return;
  const z = alturaSobPes(x, y, (enemy.z ?? 0) + 1) || enemy.z || 0;
  enemy.x = x;
  enemy.y = y;
  enemy.z = z;
  if (Number.isFinite(enemy.elevacao)) enemy.elevacao = z;
  enemy.forcaCarregado = false;
  enemy.vx = 0;
  enemy.vy = 0;
  delete enemy._forcaSendoLevantado;
  delete enemy._forcaPrevVx;
  delete enemy._forcaPrevVy;
}

/**
 * @param {object} carrier
 * @param {{ kind: string, prop?: object, enemy?: object, weightTier: number }} target
 * @param {number} nowSec
 * @param {{ humanoTier?: number } | null} cfg
 */
export function iniciarGrabNoAlvo(carrier, target, nowSec, cfg = null) {
  if (!carrier || !target) return null;
  const strengthTier = resolverTierCarrier(carrier, cfg);
  const failed = !podeLevantar(strengthTier, target.weightTier);
  const failDuration = failed ? duracaoFalhaSec(strengthTier, target.weightTier) : 0;

  if (target.kind === "faintedWild") {
    const enemy = target.enemy;
    if (!enemy) return null;
    const living = ehVivoLevantavel(enemy);
    const agro = living && ehAgroForca(enemy);
    const durationSec = agro
      ? STRUGGLE_SEC
      : failed
        ? failDuration
        : duracaoGrabSec(strengthTier, target.weightTier, 3 + target.weightTier);
    if (living) travarVivoNoLift(enemy);
    return {
      kind: "faintedWild",
      enemy,
      weightTier: target.weightTier,
      durationSec,
      elapsedSec: 0,
      startX: carrier.x,
      startY: carrier.y,
      originX: enemy.x,
      originY: enemy.y,
      startedAtSec: nowSec,
      strengthTier,
      failed: agro ? false : failed,
      struggle: agro,
      failFeedbackPlayed: false,
    };
  }

  const prop = target.prop;
  if (!prop) return null;
  const spriteCount = Math.max(1, 2 + (target.weightTier | 0));
  const durationSec = failed
    ? failDuration
    : duracaoGrabSec(strengthTier, target.weightTier, spriteCount);
  return {
    kind: "rock",
    prop,
    weightTier: target.weightTier,
    durationSec,
    elapsedSec: 0,
    startX: carrier.x,
    startY: carrier.y,
    originX: prop.x,
    originY: prop.y,
    startedAtSec: nowSec,
    strengthTier,
    failed,
    failFeedbackPlayed: false,
  };
}

/**
 * @param {object} carrier
 * @param {object | null} sticky
 * @param {{ humanoTier?: number } | null} cfg
 * @param {number} nowSec
 */
export function iniciarGrab(carrier, sticky, nowSec, cfg = null) {
  const target = acharAlvoForca(carrier, carrier, { sticky });
  if (!target) return null;
  return iniciarGrabNoAlvo(carrier, target, nowSec, cfg);
}

/**
 * @param {object} action
 * @param {object} carrier
 */
export function finalizarGrab(action, carrier) {
  if (!action || !carrier) return null;
  if (action.kind === "faintedWild") {
    const enemy = action.enemy;
    if (!enemy || enemy.capturado || enemy.forcaCarregado) return null;
    const living = !enemy.morto && (enemy.hp ?? 0) > 0;
    if (living && !ehVivoLevantavel(enemy)) return null;
    if (!living && !ehDesmaiadoOk(enemy)) return null;
    ocultarPokemon(enemy);
    return {
      kind: "faintedWild",
      enemy,
      weightTier: action.weightTier,
      originX: enemy.x,
      originY: enemy.y,
      halfW: Math.max(0.35, enemy.r || RAIO_POKEMON),
      halfH: Math.max(0.35, enemy.r || RAIO_POKEMON),
    };
  }
  const prop = action.prop;
  if (!prop || prop.forcaCarregado) return null;
  ocultarProp(prop);
  const r = Math.max(0.35, prop.r > 0 ? prop.r : RAIO_BASE_PEDRA);
  return {
    kind: "rock",
    prop,
    variant: prop.sprite,
    rockKind: prop.tipo,
    halfW: r,
    halfH: r,
    weightTier: action.weightTier,
    hitsRemaining: Math.max(1, prop.hp | 0 || 1),
    originX: prop.x,
    originY: prop.y,
  };
}

function ehDesmaiadoOk(e) {
  return !!(e && (e.morto || (e.hp ?? 0) <= 0));
}

/**
 * @param {object | null} worldUnused
 * @param {object} carry
 * @param {number} x
 * @param {number} y
 * @param {object | null} [carrier]
 */
export function celulaLivreParaSoltar(_world, carry, x, y, carrier = null) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  // Props usam discs por célula; pedra carregada já está oculto.
  // Só rejeita se cair longe demais do carrier sem altura válida.
  const z = alturaSobPes(x, y, (carrier?.z ?? 0) + 2);
  return Number.isFinite(z);
}

/**
 * @param {object} carrier
 * @param {object} carry
 * @param {number} x
 * @param {number} y
 */
export function tentarSoltarEm(carrier, carry, x, y) {
  if (!carrier || !carry) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (!celulaLivreParaSoltar(null, carry, x, y, carrier)) return false;
  if (carry.kind === "faintedWild") {
    if (!carry.enemy) return false;
    restaurarPokemon(carry.enemy, x, y);
    return true;
  }
  if (!carry.prop) return false;
  restaurarProp(carry.prop, x, y);
  return true;
}

/**
 * @param {object} carrier
 * @param {object} carry
 */
export function tentarSoltarAFrente(carrier, carry) {
  if (!carrier || !carry) return false;
  const fx = Number(carrier.dirX) || 0;
  const fy = Number(carrier.dirY) || 1;
  const fl = Math.hypot(fx, fy) || 1;
  const nx = fx / fl;
  const ny = fy / fl;
  const dists = [1.05, 1.55, 2.05, 2.55];
  for (let i = 0; i < dists.length; i++) {
    if (tentarSoltarEm(carrier, carry, carrier.x + nx * dists[i], carrier.y + ny * dists[i])) {
      return true;
    }
  }
  const fx2 = carrier.x + nx * 0.6;
  const fy2 = carrier.y + ny * 0.6;
  if (tentarSoltarEm(carrier, carry, fx2, fy2)) return true;
  if (carry.kind === "faintedWild") {
    if (!carry.enemy) return false;
    restaurarPokemon(carry.enemy, fx2, fy2);
    return true;
  }
  if (!carry.prop) return false;
  restaurarProp(carry.prop, fx2, fy2);
  return true;
}

export { FORCA_HUMANO };
