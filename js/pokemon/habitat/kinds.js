/** Kinds de habitat selvagem (lares + sky passers). */

export const HABITAT = Object.freeze({
  LAND: "land",
  HIGH: "high",
  SURFACE: "surface",
  UNDERSEA: "undersea",
  SKY: "sky",
});

export function ehHabitatTerrestre(kind) {
  return kind === HABITAT.LAND || kind === HABITAT.HIGH;
}

export function ehHabitatAquatico(kind) {
  return kind === HABITAT.SURFACE || kind === HABITAT.UNDERSEA;
}
