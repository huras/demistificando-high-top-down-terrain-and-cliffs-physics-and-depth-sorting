/**
 * BGM outdoor por bioma × período × clima.
 * Fallbacks: weather.strong → weather.weak → {period} → .day → bare biome.
 */

import { CLIMA, CLIMA_LOGICO, INTENSIDADE } from "../../clima/kinds.js";

export const SLOT_PERIODO_BGM = Object.freeze({
  DAY: "day",
  AFTERNOON: "afternoon",
  NIGHT: "night",
  LATE_NIGHT: "late-night",
});

export const SLOT_CLIMA_BGM = Object.freeze({
  WEAK: "weather.weak",
  STRONG: "weather.strong",
});

export const PERIODO_BGM = Object.freeze({
  DAY: "day",
  AFTERNOON: "afternoon",
  NIGHT: "night",
  LATE_NIGHT: "late-night",
});

const SLOTS_PERIODO = Object.freeze([
  SLOT_PERIODO_BGM.DAY,
  SLOT_PERIODO_BGM.AFTERNOON,
  SLOT_PERIODO_BGM.NIGHT,
  SLOT_PERIODO_BGM.LATE_NIGHT,
]);

/**
 * late-night [0,6) · day [6,14) · afternoon [14,19) · night [19,24)
 * @param {number} hora
 * @param {{ dayStartHour?: number, afternoonStartHour?: number, nightStartHour?: number }} [cfg]
 */
export function periodoBgmDaHora(hora, cfg = {}) {
  const h = ((Number(hora) % 24) + 24) % 24;
  const dayStart = cfg.dayStartHour ?? 6;
  const afternoonStart = cfg.afternoonStartHour ?? 14;
  const nightStart = cfg.nightStartHour ?? 19;
  if (h >= nightStart) return PERIODO_BGM.NIGHT;
  if (h >= afternoonStart) return PERIODO_BGM.AFTERNOON;
  if (h >= dayStart) return PERIODO_BGM.DAY;
  return PERIODO_BGM.LATE_NIGHT;
}

export function slotPeriodoBgm(periodo) {
  if (periodo === PERIODO_BGM.AFTERNOON) return SLOT_PERIODO_BGM.AFTERNOON;
  if (periodo === PERIODO_BGM.NIGHT) return SLOT_PERIODO_BGM.NIGHT;
  if (periodo === PERIODO_BGM.LATE_NIGHT) return SLOT_PERIODO_BGM.LATE_NIGHT;
  return SLOT_PERIODO_BGM.DAY;
}

export function chaveBgmBioma(biomeId, slot) {
  const id = String(biomeId || "").trim();
  if (!id || !slot) return null;
  return `${id}.${slot}`;
}

export function ehChaveBgmBiomaContexto(key) {
  if (!key || typeof key !== "string") return false;
  if (!key.includes(".")) return false;
  if (
    key.startsWith("cave.") ||
    key.startsWith("hub.") ||
    key.startsWith("shrine.") ||
    key.startsWith("battle.") ||
    key.startsWith("meet.") ||
    key.startsWith("opening.") ||
    key.startsWith("rest.") ||
    key.startsWith("period.") ||
    key.startsWith("weather.")
  ) {
    return false;
  }
  const i = key.indexOf(".");
  const slot = key.slice(i + 1);
  return (
    SLOTS_PERIODO.includes(slot) ||
    slot === SLOT_CLIMA_BGM.WEAK ||
    slot === SLOT_CLIMA_BGM.STRONG
  );
}

/**
 * @param {{ logicalKind?: string, display?: string, intensity?: string, forte?: boolean } | null | undefined} wx
 */
function kindClima(wx) {
  return wx?.logicalKind || wx?.display || null;
}

/**
 * limpo/nublado → período; precip/vendaval → weather.
 * @param {{ logicalKind?: string, display?: string } | null | undefined} wx
 */
export function climaUsaSlotTempo(wx) {
  const kind = kindClima(wx);
  if (!kind) return true;
  if (kind === CLIMA.LIMPO || kind === CLIMA.NUBLADO) return true;
  if (kind === CLIMA_LOGICO.LIMPO || kind === CLIMA_LOGICO.NUBLADO) return true;
  return false;
}

/**
 * @param {{ logicalKind?: string, display?: string, intensity?: string, forte?: boolean } | null | undefined} wx
 * @returns {"weather.weak" | "weather.strong" | null}
 */
export function slotClimaBgm(wx) {
  if (climaUsaSlotTempo(wx)) return null;
  const forte =
    wx?.forte === true ||
    wx?.intensity === INTENSIDADE.FORTE ||
    wx?.intensity === "forte";
  return forte ? SLOT_CLIMA_BGM.STRONG : SLOT_CLIMA_BGM.WEAK;
}

/**
 * @param {object} opts
 * @param {string} opts.biomeId
 * @param {number} [opts.hora]
 * @param {object} [opts.cfgPeriodo]
 * @param {object | null} [opts.clima]
 * @returns {string[]}
 */
export function cadeiaChavesBgmBioma({
  biomeId,
  hora = 12,
  cfgPeriodo = {},
  clima = null,
} = {}) {
  const id = String(biomeId || "").trim();
  if (!id) return [];

  const keys = [];
  const push = (k) => {
    if (k && !keys.includes(k)) keys.push(k);
  };

  const climaSlot = slotClimaBgm(clima);
  if (climaSlot === SLOT_CLIMA_BGM.STRONG) {
    push(chaveBgmBioma(id, SLOT_CLIMA_BGM.STRONG));
    push(chaveBgmBioma(id, SLOT_CLIMA_BGM.WEAK));
  } else if (climaSlot === SLOT_CLIMA_BGM.WEAK) {
    push(chaveBgmBioma(id, SLOT_CLIMA_BGM.WEAK));
  }

  const periodo = periodoBgmDaHora(hora, cfgPeriodo);
  const periodSlot = slotPeriodoBgm(periodo);
  push(chaveBgmBioma(id, periodSlot));
  if (periodSlot !== SLOT_PERIODO_BGM.DAY) {
    push(chaveBgmBioma(id, SLOT_PERIODO_BGM.DAY));
  }
  push(id);
  return keys;
}

/**
 * @param {object} opts
 * @param {{ hasTrack?: (key: string) => boolean } | null} opts.bgm
 * @param {string} opts.biomeId
 * @param {number} [opts.hora]
 * @param {object} [opts.cfgPeriodo]
 * @param {object | null} [opts.clima]
 * @returns {string | null}
 */
export function resolverChaveBgmBioma({
  bgm,
  biomeId,
  hora = 12,
  cfgPeriodo = {},
  clima = null,
} = {}) {
  if (!bgm?.hasTrack) return null;
  const cadeia = cadeiaChavesBgmBioma({ biomeId, hora, cfgPeriodo, clima });
  for (const key of cadeia) {
    if (bgm.hasTrack(key)) return key;
  }
  return null;
}
