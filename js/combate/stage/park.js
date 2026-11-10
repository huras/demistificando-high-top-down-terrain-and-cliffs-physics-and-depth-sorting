/**
 * Park / restore de atores OW durante batalha (campo ou sandbox).
 */
import { alturaSobPes } from "../../fisica/colisao.js";

/**
 * @param {object} ator
 * @param {{ ocultar?: boolean }} [opts] ocultar=true some do render OW (sandbox).
 */
export function estacionarAtor(ator, opts = {}) {
  if (!ator || ator._stageParked) return;
  const ocultar = opts.ocultar !== false;
  ator._stageParked = true;
  ator._stageOculto = ocultar;
  ator._stagePrevX = ator.x;
  ator._stagePrevY = ator.y;
  ator._stagePrevZ = ator.z ?? ator.elevacao ?? 0;
  ator._stagePrevElev = ator.elevacao ?? ator.z ?? 0;
  ator._stagePrevModo = ator.modo || "roam";
  ator._stagePrevAlvo = ator.alvo || null;
  ator._stagePrevCombatHold = !!ator.combatHold;
  ator.vx = 0;
  ator.vy = 0;
  ator.vz = 0;
  ator.andando = false;
  ator.correndo = false;
  ator.pulando = false;
  ator.puloVisual = false;
  ator.puloAlt = 0;
  ator.hopLift = 0;
  ator.noChao = true;
  ator.combatHold = true;
  if (ator.status !== "sleep") {
    ator.sonoNatural = false;
    if ((ator.dormindo || 0) > 0) ator.dormindo = 0;
  }
}

export function colocarNoSlot(ator, slot) {
  if (!ator || !slot) return;
  ator.x = slot.x;
  ator.y = slot.y;
  if (Number.isFinite(slot.z)) {
    ator.z = slot.z;
    ator.elevacao = slot.z;
  }
  ator.casaX = slot.x;
  ator.casaY = slot.y;
  ator.casaZ = ator.z ?? 0;
  ator.casaChronoX = slot.x;
  ator.casaChronoY = slot.y;
  if (slot.dirX != null) ator.dirX = slot.dirX;
  if (slot.dirY != null) ator.dirY = slot.dirY;
  ator.vx = 0;
  ator.vy = 0;
}

/**
 * @param {object} ator
 * @param {{ restaurarPose?: boolean, soltarHold?: boolean }} [opts]
 */
export function restaurarAtor(ator, opts = {}) {
  if (!ator || !ator._stageParked) return;
  const restaurarPose = opts.restaurarPose !== false;
  const soltarHold = opts.soltarHold !== false;
  if (restaurarPose) {
    if (Number.isFinite(ator._stagePrevX)) ator.x = ator._stagePrevX;
    if (Number.isFinite(ator._stagePrevY)) ator.y = ator._stagePrevY;
    if (Number.isFinite(ator._stagePrevZ)) ator.z = ator._stagePrevZ;
    if (Number.isFinite(ator._stagePrevElev)) ator.elevacao = ator._stagePrevElev;
  }
  if (soltarHold) {
    ator.combatHold = !!ator._stagePrevCombatHold;
    ator._chronoHold = false;
    ator._emLutaCampo = false;
    ator.resultadoTurno = null;
    ator.carregarDepois = false;
    ator.ensaioEvitar = null;
    if (ator.faccao === "selvagem" && !ator.morto && !ator.capturado && (ator.hp == null || ator.hp > 0)) {
      ator.modo = ator._stagePrevModo || "roam";
      ator.agroPersistente = false;
      ator.alvo = null;
    } else if (ator.faccao === "party") {
      ator.modo = "roam";
      ator.alvo = null;
      ator.ordemAlvo = null;
    }
  }
  ator._stageParked = false;
  ator._stageOculto = false;
  delete ator._stagePrevX;
  delete ator._stagePrevY;
  delete ator._stagePrevZ;
  delete ator._stagePrevElev;
  delete ator._stagePrevModo;
  delete ator._stagePrevAlvo;
  delete ator._stagePrevCombatHold;
}

export function atorEstacionado(ator) {
  return !!(ator && ator._stageParked);
}

/** Sandbox esconde; batalha no campo continua visível. */
export function atorOcultoNoOw(ator) {
  return !!(ator && ator._stageParked && ator._stageOculto);
}

/**
 * Guarda pose do jogador e leva pra trás da linha Chrono (sem hold de combate).
 * @param {object} corpo
 * @param {{ ox: number, oy: number, fx: number, fy: number, atras: number, sepFrente: number }} opts
 */
export function estacionarJogadorChrono(corpo, opts) {
  if (!corpo || corpo._chronoPose) return;
  let fx = Number.isFinite(opts?.fx) ? opts.fx : 1;
  let fy = Number.isFinite(opts?.fy) ? opts.fy : 0;
  const len = Math.hypot(fx, fy) || 1;
  fx /= len;
  fy /= len;
  const ox = opts?.ox ?? corpo.x;
  const oy = opts?.oy ?? corpo.y;
  const sep = Number.isFinite(opts?.sepFrente) ? opts.sepFrente : 2.85;
  const atras = Number.isFinite(opts?.atras) ? opts.atras : 3.5;

  corpo._chronoPose = {
    x: corpo.x,
    y: corpo.y,
    z: corpo.z,
    elevacao: corpo.elevacao,
    dirX: corpo.dirX,
    dirY: corpo.dirY,
    facing: corpo.facing,
  };

  const wx = ox - fx * (sep + atras);
  const wy = oy - fy * (sep + atras);
  corpo.x = wx;
  corpo.y = wy;
  const ref = corpo.elevacao ?? corpo.z ?? 0;
  const z = alturaSobPes(wx, wy, ref, ref);
  if (Number.isFinite(z)) {
    corpo.z = z;
    corpo.elevacao = z;
  }
  corpo.dirX = fx;
  corpo.dirY = fy;
  // Mesma regra 4-way de movimento.js (0 S/N conforme |dx|/|dy|).
  if (typeof corpo.facing === "number") {
    if (Math.abs(fx) > Math.abs(fy)) corpo.facing = fx < 0 ? 1 : 2;
    else corpo.facing = fy < 0 ? 3 : 0;
  }
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.andando = false;
  corpo.correndo = false;
  corpo.pulando = false;
  corpo.hopLift = 0;
  corpo.noChao = true;
}

/** Devolve o jogador à pose exata de antes do Chrono. */
export function restaurarJogadorChrono(corpo) {
  if (!corpo || !corpo._chronoPose) return;
  const p = corpo._chronoPose;
  corpo.x = p.x;
  corpo.y = p.y;
  if (Number.isFinite(p.z)) corpo.z = p.z;
  if (Number.isFinite(p.elevacao)) corpo.elevacao = p.elevacao;
  if (p.dirX != null) corpo.dirX = p.dirX;
  if (p.dirY != null) corpo.dirY = p.dirY;
  if (p.facing != null) corpo.facing = p.facing;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.andando = false;
  delete corpo._chronoPose;
}
