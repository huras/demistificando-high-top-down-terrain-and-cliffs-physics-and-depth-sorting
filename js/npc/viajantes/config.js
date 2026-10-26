/** Constantes dos treinadores dinâmicos do overworld. */
export const OW_CFG = Object.freeze({
  MAX_ATIVOS: 2,
  MAX_RASTREADOS: 5,
  SPAWN_INTERVAL_SEC: 2.2,
  MIN_SPACING: 22,
  MIN_PLAYER_DIST: 14,
  SPAWN_BEYOND_MIN: 8,
  SPAWN_BEYOND_MAX: 22,
  KEEP_AREA_RING: 2,
  CITY_FALLOFF: 40,
  BASE_SPAWN_CHANCE: 0.5,
  WALK_SPEED: 2.5,
  RAIO: 0.38,
  INTERACT_REACH: 1.4,
  VIEW_PAD: 3,
  WANDER_MIN_GOAL: 16,
  WANDER_IDLE_MIN: 1.2,
  WANDER_IDLE_MAX: 4.5,
  WANDER_ROAD_BIAS: 0.6,
  MOVE_WANDER_WEIGHT: 0.6,
  MOVE_TRAVEL_WEIGHT: 0.4,
  MIN_INTERIOR_TRANSIT: 20,
  MAX_PLAYER_SIM_DIST: 56,
  TIME_MUL: Object.freeze({
    day: 1,
    afternoon: 0.85,
    night: 0.35,
  }),
});

export const OW_MODO = Object.freeze({
  WANDER: "wander",
  TRAVEL: "travel",
});

export const OW_LOD = Object.freeze({
  ACTIVE: "active",
  DORMANT: "dormant",
});
