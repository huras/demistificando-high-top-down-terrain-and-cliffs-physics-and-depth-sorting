/**
 * Enums e estado do quadro de missões (board).
 * Tipos skill/capture ficam reservados para expansão futura.
 */

export const QUEST_TYPE = Object.freeze({
  MISSING_PERSON: "missing-person",
  MATERIAL_DELIVERY: "material-delivery",
  SKILL_UNLOCK: "skill-unlock",
  CAPTURE: "capture",
});

export const QUEST_STATUS = Object.freeze({
  POSTED: "posted",
  ACTIVE: "active",
  ESCORT: "escort",
  COMPLETED: "completed",
});

export const QUEST_BOARD_TAB = Object.freeze({
  AVAILABLE: "available",
  TAKEN: "taken",
  COMPLETED: "completed",
});

export const QUEST_BOARD_TYPE_TAB = Object.freeze({
  ALL: "all",
  MISSING_PERSON: QUEST_TYPE.MISSING_PERSON,
  MATERIAL_DELIVERY: QUEST_TYPE.MATERIAL_DELIVERY,
});

export const QUEST_BOARD_TYPE_ORDER = Object.freeze([
  QUEST_TYPE.MISSING_PERSON,
  QUEST_TYPE.MATERIAL_DELIVERY,
]);

export const MISSING_PERSON_FLAVOR = Object.freeze(["afraid", "stuck", "hurt"]);

/** Materiais comuns de drop — nunca gema de santuário. */
export const DELIVERY_MATERIALS = Object.freeze([
  "bellLeaf",
  "ratTail",
  "ratTeeth",
  "softFeather",
  "sharpBeak",
  "caterpieSilk",
  "hardShell",
  "stingerTip",
  "electricFur",
  "snakeSkin",
  "poisonQuill",
  "softPuff",
  "batWing",
  "oddLeaf",
  "bugDust",
  "rockChip",
  "waterBubble",
  "duckDown",
]);

export const QUEST_RING = 3;
export const QUEST_HP_FRAC = 0.24;
export const QUEST_BOARD_SLOTS = 6;
export const QUEST_REFRESH_HOUR = 6;
export const QUEST_COMPLETED_CAP = 40;

export const TIER_MONEY = Object.freeze({
  starter: 1000,
  town: 1600,
  city: 2400,
});

export function hashQuestId(str) {
  const s = String(str ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createQuestState() {
  return {
    boardDay: null,
    ultimaHora: null,
    boardForceSalt: 0,
    boards: {},
    taken: [],
    completed: [],
  };
}

function clonePosting(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  return { ...raw };
}

function cloneTaken(raw) {
  const posting = clonePosting(raw?.posting ?? raw);
  if (!posting) return null;
  const rec = { posting };
  if (Number.isFinite(raw.targetAx)) rec.targetAx = raw.targetAx | 0;
  if (Number.isFinite(raw.targetAy)) rec.targetAy = raw.targetAy | 0;
  if (Number.isFinite(raw.spawnX)) rec.spawnX = Number(raw.spawnX);
  if (Number.isFinite(raw.spawnY)) rec.spawnY = Number(raw.spawnY);
  rec.escorting = !!raw.escorting;
  return rec;
}

export function normalizeQuestState(raw) {
  const state = createQuestState();
  if (!raw || typeof raw !== "object") return state;
  if (Number.isFinite(raw.boardDay)) state.boardDay = raw.boardDay | 0;
  if (Number.isFinite(raw.ultimaHora)) state.ultimaHora = Number(raw.ultimaHora);
  if (Number.isFinite(raw.boardForceSalt)) state.boardForceSalt = raw.boardForceSalt | 0;
  if (raw.boards && typeof raw.boards === "object") {
    for (const [cityId, list] of Object.entries(raw.boards)) {
      if (!Array.isArray(list)) continue;
      state.boards[cityId] = list.map(clonePosting).filter(Boolean);
    }
  }
  if (Array.isArray(raw.taken)) {
    state.taken = raw.taken.map(cloneTaken).filter(Boolean);
  }
  if (Array.isArray(raw.completed)) {
    state.completed = raw.completed.map(clonePosting).filter(Boolean);
  }
  return state;
}
