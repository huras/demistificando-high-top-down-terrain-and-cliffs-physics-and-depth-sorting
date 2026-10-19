import { GRAVIDADE, PULO_VELOCIDADE } from "../../config.js";
import { emAvanco, emEsquiva, emRecuo, velocidadeDe } from "../ator.js";

const CD_PULO = 0.85;
const VEL_PULO = 0.55;

export function noAr(ator) {
  return !!(ator && ator.pulando);
}

function ocupado(ator) {
  return emRecuo(ator) || emEsquiva(ator) || emAvanco(ator);
}

export function comecarPulo(ator) {
  if (!ator || ator.morto || ator.capturado || ator.pulando) return false;
  if (ocupado(ator)) return false;
  ator.pulando = true;
  ator.noChao = false;
  ator.vz = PULO_VELOCIDADE;
  ator.puloAlt = 0;
  ator.elevacao = ator.z || 0;
  return true;
}

export function lembrarEmbalo(ator) {
  const v = Math.hypot(ator.vx || 0, ator.vy || 0);
  if (v < VEL_PULO) return;
  ator.embaloX = ator.vx;
  ator.embaloY = ator.vy;
  ator.embaloAte = 0.45;
}

function garantirEmbalo(ator) {
  if (Math.hypot(ator.vx || 0, ator.vy || 0) >= VEL_PULO) return true;
  if ((ator.embaloAte || 0) > 0 && Math.hypot(ator.embaloX || 0, ator.embaloY || 0) >= VEL_PULO) {
    ator.vx = ator.embaloX;
    ator.vy = ator.embaloY;
    return true;
  }
  const cx = ator.cmdX || 0;
  const cy = ator.cmdY || 0;
  const m = Math.hypot(cx, cy);
  if (m < 0.2 || !ator.stats) return false;
  const vel = velocidadeDe(ator, true);
  ator.vx = (cx / m) * vel;
  ator.vy = (cy / m) * vel;
  return Math.hypot(ator.vx, ator.vy) >= VEL_PULO;
}

/** Salta no começo do golpe se ainda vem com velocidade. Parado de verdade, o golpe continua plantado. */
export function puloNoGolpe(ator) {
  if (!ator || ator.pulando) return false;
  if (!garantirEmbalo(ator)) return false;
  if (!comecarPulo(ator)) return false;
  ator.puloCd = CD_PULO;
  return true;
}

/** Hop curto enquanto corre, pra o pulo aparecer entre um golpe e outro. */
export function quererPulo(ator) {
  if (!ator || ator.morto || ator.capturado || ator.pulando) return false;
  if ((ator.puloCd || 0) > 0) return false;
  if ((ator.conjuroRestante || 0) > 0 || (ator.golpeRecRestante || 0) > 0 || (ator.jatoDur || 0) > 0) return false;
  if (ocupado(ator)) return false;
  if (Math.hypot(ator.vx || 0, ator.vy || 0) < VEL_PULO) return false;
  if (!comecarPulo(ator)) return false;
  ator.puloCd = CD_PULO;
  return true;
}

/** Inércia horizontal. Não zera vx/vy e não troca o rumo. */
export function deslizarNoAr(ator, dt) {
  if (!noAr(ator)) return false;
  ator.x += (ator.vx || 0) * dt;
  ator.y += (ator.vy || 0) * dt;
  ator.andando = false;
  return true;
}

export function integrarPulo(ator, dt) {
  if (!ator) return;
  if (ator.puloCd > 0) ator.puloCd = Math.max(0, ator.puloCd - dt);
  if (ator.embaloAte > 0) ator.embaloAte = Math.max(0, ator.embaloAte - dt);
  if (!ator.pulando) return;
  const chao = ator.z || 0;
  ator.vz = (ator.vz || 0) - GRAVIDADE * dt;
  ator.puloAlt = (ator.puloAlt || 0) + ator.vz * dt;
  if (ator.puloAlt <= 0 && ator.vz <= 0) {
    ator.puloAlt = 0;
    ator.vz = 0;
    ator.pulando = false;
    ator.noChao = true;
    ator.elevacao = chao;
    if (!emEsquiva(ator)) ator.hopLift = 0;
    return;
  }
  ator.noChao = false;
  ator.elevacao = chao;
  ator.hopLift = Math.max(ator.hopLift || 0, ator.puloAlt);
}
