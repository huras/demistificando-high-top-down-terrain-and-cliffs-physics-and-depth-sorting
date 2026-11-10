/**
 * Park / restore de atores OW durante batalha (campo ou sandbox).
 */

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
  ator.andando = false;
  ator.correndo = false;
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
