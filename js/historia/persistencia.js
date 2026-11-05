/** Serializa / hidrata estado de história no save. */

import {
  OPENING_STAGE,
  ROCKET_CLEANUP,
  VIRIDIAN_ROCKET,
  criarHistoriaState,
  criarOpeningState,
} from "./flags.js";
import { cameraEventoAtiva } from "./cameraEvento.js";

/** @type {() => object} */
let obterEstado = null;

/** Evita ciclo com jogo/estado.js — registrar no boot. */
export function registrarEstadoHistoria(fn) {
  obterEstado = fn;
}

function est() {
  if (!obterEstado) throw new Error("historia: estado não registrado");
  return obterEstado();
}

export function historiaPodeSalvar() {
  const e = obterEstado?.();
  return !cameraEventoAtiva() && !e?.historia?.cinemaAtiva;
}

export function serializarHistoria() {
  const h = est().historia || criarHistoriaState();
  return {
    opening: {
      active: !!h.opening?.active,
      stage: h.opening?.stage || OPENING_STAGE.COMPLETE,
      encounterPhase: h.opening?.encounterPhase || null,
      encounterComplete: !!h.opening?.encounterComplete,
      trialSpecies: h.opening?.trialSpecies || null,
      rivalStarters: h.opening?.rivalStarters || null,
      trioCinemaPhase: h.opening?.trioCinemaPhase || null,
      version: h.opening?.version || 2,
    },
    rocketCleanupQuestStatus: h.rocketCleanupQuestStatus || ROCKET_CLEANUP.IDLE,
    rocketCleanupTurnedIn: [...(h.rocketCleanupTurnedIn || [])],
    discoveredWarehouses: [...(h.discoveredWarehouses || [])],
    clearedWarehouses: [...(h.clearedWarehouses || [])],
    unlockedEntrances: [...(h.unlockedEntrances || [])],
    warehouseGuardsDefeated: [...(h.warehouseGuardsDefeated || [])],
    viridianRocketScene: h.viridianRocketScene || VIRIDIAN_ROCKET.IDLE,
  };
}

export function hidratarHistoria(bruto, { partyLen = 0 } = {}) {
  const e = est();
  const base = criarHistoriaState();
  if (!bruto || typeof bruto !== "object") {
    if (partyLen > 0) {
      base.opening = {
        ...criarOpeningState(),
        active: false,
        stage: OPENING_STAGE.LEGACY,
      };
    }
    e.historia = base;
    return;
  }
  const op = bruto.opening || {};
  base.opening = {
    ...criarOpeningState(),
    active:
      op.active !== false &&
      op.stage !== OPENING_STAGE.COMPLETE &&
      op.stage !== OPENING_STAGE.LEGACY,
    stage: op.stage || OPENING_STAGE.VISIT_LAB,
    encounterPhase: op.encounterPhase || null,
    encounterComplete: !!op.encounterComplete,
    trialSpecies: op.trialSpecies || null,
    rivalStarters: op.rivalStarters || null,
    trioCinemaPhase: op.trioCinemaPhase || null,
    version: op.version || 2,
  };
  if (
    base.opening.stage === OPENING_STAGE.COMPLETE ||
    base.opening.stage === OPENING_STAGE.LEGACY
  ) {
    base.opening.active = false;
  }
  base.rocketCleanupQuestStatus = bruto.rocketCleanupQuestStatus || ROCKET_CLEANUP.IDLE;
  base.rocketCleanupTurnedIn = Array.isArray(bruto.rocketCleanupTurnedIn)
    ? [...bruto.rocketCleanupTurnedIn]
    : [];
  base.discoveredWarehouses = Array.isArray(bruto.discoveredWarehouses)
    ? [...bruto.discoveredWarehouses]
    : [];
  base.clearedWarehouses = Array.isArray(bruto.clearedWarehouses)
    ? [...bruto.clearedWarehouses]
    : [];
  base.unlockedEntrances = Array.isArray(bruto.unlockedEntrances)
    ? [...bruto.unlockedEntrances]
    : [];
  base.warehouseGuardsDefeated = Array.isArray(bruto.warehouseGuardsDefeated)
    ? [...bruto.warehouseGuardsDefeated]
    : [];
  base.viridianRocketScene = bruto.viridianRocketScene || VIRIDIAN_ROCKET.IDLE;
  e.historia = base;
}

export function garantirHistoria() {
  const e = est();
  if (!e.historia) e.historia = criarHistoriaState();
  return e.historia;
}
