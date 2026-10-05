import {
  ASA_DELTA_ABRIR_APOS,
  ASA_DELTA_ACEL_AR,
  ASA_DELTA_ATRITO_AR,
  ASA_DELTA_DESCIDA,
  ASA_DELTA_LIFT_MIN,
  ASA_DELTA_VEL_MUL,
  VELOCIDADE_MAX,
} from "../config.js";
import { alturaSobPes } from "./colisao.js";
import { pousarNoChao } from "./pulo.js";

export function estaPlanando(corpo) {
  return corpo?.planando === true;
}

export function podeAbrirAsaDelta(corpo) {
  if (!corpo || corpo.noChao || corpo.escalando || corpo.planando || corpo.voando) {
    return false;
  }
  if ((corpo.tempoAr ?? 0) < ASA_DELTA_ABRIR_APOS) return false;
  const zChao = alturaSobPes(corpo.x, corpo.y);
  const folga = corpo.elevacao - (zChao > 0 ? zChao : 0);
  return folga >= ASA_DELTA_LIFT_MIN;
}

/** Abre o planar — consome o impulso vertical (vira queda lenta). */
export function abrirAsaDelta(corpo) {
  if (!podeAbrirAsaDelta(corpo)) return false;
  corpo.planando = true;
  corpo.pulando = true;
  corpo.noChao = false;
  corpo.vz = Math.min(0, corpo.vz) * 0.15;
  corpo._glideTempo = 0;
  corpo._glideYaw = yawDoVoo(corpo);
  corpo._glideBank = 0;
  corpo.acao = "asa-delta";
  return true;
}

/** Fecha a asa e volta à queda livre. */
export function fecharAsaDelta(corpo) {
  if (!estaPlanando(corpo)) return false;
  corpo.planando = false;
  corpo.vz = Math.min(corpo.vz, -ASA_DELTA_DESCIDA);
  corpo.acao = "caindo";
  return true;
}

/**
 * Só edge de Space: 2º toque no ar abre; toque com asa aberta fecha.
 * Hold NÃO abre (hold = altura Mario no pulo).
 */
export function tratarInputAsaDelta(corpo, apertouSpace) {
  if (!apertouSpace) return false;
  if (estaPlanando(corpo)) return fecharAsaDelta(corpo);
  if (corpo.noChao || corpo.escalando) return false;
  return abrirAsaDelta(corpo);
}

/** Queda lenta + yaw/bank; pousa ao tocar o chão. */
export function atualizarAsaDelta(corpo, dt) {
  if (!estaPlanando(corpo) || !(dt > 0)) return false;

  corpo._glideTempo = (corpo._glideTempo ?? 0) + dt;
  tickYawAsaDelta(corpo, dt);

  corpo.vz = -ASA_DELTA_DESCIDA;
  corpo.elevacao += corpo.vz * dt;

  const zChao = alturaSobPes(corpo.x, corpo.y);
  corpo.z = zChao > 0 ? zChao : 0;
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.pulando = true;
  corpo.acao = "asa-delta";

  if (zChao > 0 && corpo.elevacao <= zChao + 0.05) {
    corpo.planando = false;
    pousarNoChao(corpo, zChao);
    return true;
  }

  if (corpo.elevacao < -2) {
    corpo.elevacao = -2;
    corpo.planando = false;
  }
  return false;
}

/** Steer no ar com knobs de asa (mais solto que o hop). */
export function atualizarCorridaAsaDelta(corpo, dx, dy, dt) {
  const acel = ASA_DELTA_ACEL_AR;
  const atrito = ASA_DELTA_ATRITO_AR;
  const vmax = VELOCIDADE_MAX * ASA_DELTA_VEL_MUL;
  const temInput = dx !== 0 || dy !== 0;

  if (temInput) {
    corpo.vx = aproximar(corpo.vx, dx * vmax, acel * dt);
    corpo.vy = aproximar(corpo.vy, dy * vmax, acel * dt);
  } else {
    corpo.vx = aproximar(corpo.vx, 0, atrito * dt);
    corpo.vy = aproximar(corpo.vy, 0, atrito * dt);
    if (Math.abs(corpo.vx) < 0.02) corpo.vx = 0;
    if (Math.abs(corpo.vy) < 0.02) corpo.vy = 0;
  }

  const sp = Math.hypot(corpo.vx, corpo.vy);
  if (sp > vmax) {
    const k = vmax / sp;
    corpo.vx *= k;
    corpo.vy *= k;
  }
}

function yawDoVoo(corpo) {
  const vx = corpo.vx ?? 0;
  const vy = corpo.vy ?? 0;
  if (Math.hypot(vx, vy) >= 0.08) return Math.atan2(vy, vx);
  const fx = corpo.dirX ?? 0;
  const fy = corpo.dirY ?? 1;
  if (fx === 0 && fy === 0) return 0;
  return Math.atan2(fy, fx);
}

function tickYawAsaDelta(corpo, dt) {
  const alvo = yawDoVoo(corpo);
  if (!Number.isFinite(corpo._glideYaw)) {
    corpo._glideYaw = alvo;
    corpo._glideBank = 0;
    return;
  }
  let d = alvo - corpo._glideYaw;
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  const k = 1 - Math.exp(-7.5 * dt);
  corpo._glideYaw += d * k;
  const bankAlvo = Math.max(-0.42, Math.min(0.42, d * 0.7));
  corpo._glideBank += (bankAlvo - (corpo._glideBank ?? 0)) * Math.min(1, dt * 9);
}

function aproximar(atual, alvo, maxDelta) {
  const d = alvo - atual;
  if (Math.abs(d) <= maxDelta) return alvo;
  return atual + Math.sign(d) * maxDelta;
}
