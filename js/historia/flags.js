/** Flags e stages da história (opening + warehouses Rocket). */

export const OPENING_STAGE = Object.freeze({
  VISIT_LAB: "visitLab",
  CHECK_LAB: "checkLab",
  RESCUE_ROUTE: "rescueRoute",
  RESCUE_BATTLE: "rescueBattle",
  SCENE_THREE: "sceneThree",
  PARCEL: "parcel",
  FINAL_STARTER: "finalStarter",
  COMPLETE: "complete",
  LEGACY: "legacy",
});

export const OPENING_TRANSITIONS = Object.freeze({
  [OPENING_STAGE.VISIT_LAB]: OPENING_STAGE.CHECK_LAB,
  [OPENING_STAGE.CHECK_LAB]: OPENING_STAGE.RESCUE_ROUTE,
  [OPENING_STAGE.RESCUE_ROUTE]: OPENING_STAGE.RESCUE_BATTLE,
  [OPENING_STAGE.RESCUE_BATTLE]: OPENING_STAGE.SCENE_THREE,
  [OPENING_STAGE.SCENE_THREE]: OPENING_STAGE.PARCEL,
  [OPENING_STAGE.PARCEL]: OPENING_STAGE.FINAL_STARTER,
  [OPENING_STAGE.FINAL_STARTER]: OPENING_STAGE.COMPLETE,
});

export const ROCKET_CLEANUP = Object.freeze({
  IDLE: "idle",
  AWAITING_REPORT: "awaitingReport",
  ACTIVE: "active",
  DONE: "done",
});

export const VIRIDIAN_ROCKET = Object.freeze({
  IDLE: "idle",
  ARMED: "armed",
  DONE: "done",
});

/** @returns {object} */
export function criarOpeningState() {
  return {
    active: true,
    stage: OPENING_STAGE.VISIT_LAB,
    encounterPhase: null,
    encounterComplete: false,
    trialSpecies: null,
    rivalStarters: null,
    trioCinemaPhase: null,
    routeOutroLock: false,
    version: 2,
  };
}

/** @returns {object} */
export function criarHistoriaState() {
  return {
    opening: criarOpeningState(),
    rocketCleanupQuestStatus: ROCKET_CLEANUP.IDLE,
    rocketCleanupTurnedIn: [],
    discoveredWarehouses: [],
    clearedWarehouses: [],
    unlockedEntrances: [],
    warehouseGuardsDefeated: [],
    viridianRocketScene: VIRIDIAN_ROCKET.IDLE,
    cinemaAtiva: false,
  };
}
