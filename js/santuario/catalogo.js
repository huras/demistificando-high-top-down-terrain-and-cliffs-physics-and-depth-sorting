/**
 * Pedras elementais do overworld (atlas 14×2).
 */

export const SHRINE_TILE_PX = 16;
export const SHRINE_FOOTPRINT_COLS = 1;
export const SHRINE_FOOTPRINT_ROWS = 2;
export const SHRINE_DRAW_SCALE = 2.5;
export const SHRINE_VEG_CLEARANCE = 2;
export const RAIO_SANTUARIO = 0.4;

/** @typedef {{ element: string, atlasCol: number }} ShrineElementDef */

/** @type {readonly ShrineElementDef[]} */
export const SHRINE_ELEMENTS = Object.freeze([
  Object.freeze({ element: "normal", atlasCol: 0 }),
  Object.freeze({ element: "dark", atlasCol: 1 }),
  Object.freeze({ element: "ice", atlasCol: 2 }),
  Object.freeze({ element: "fighting", atlasCol: 3 }),
  Object.freeze({ element: "water", atlasCol: 4 }),
  Object.freeze({ element: "grass", atlasCol: 5 }),
  Object.freeze({ element: "fire", atlasCol: 6 }),
  Object.freeze({ element: "poison", atlasCol: 7 }),
  Object.freeze({ element: "electric", atlasCol: 8 }),
  Object.freeze({ element: "bug", atlasCol: 9 }),
  Object.freeze({ element: "rock", atlasCol: 10 }),
  Object.freeze({ element: "ground", atlasCol: 11 }),
  Object.freeze({ element: "dragon", atlasCol: 12 }),
  Object.freeze({ element: "psychic", atlasCol: 13 }),
]);

export const SHRINE_MAP_COLORS = Object.freeze({
  normal: "#d4d4d8",
  dark: "#7c3aed",
  ice: "#7dd3fc",
  fighting: "#f97316",
  water: "#3b82f6",
  grass: "#4ade80",
  fire: "#f87171",
  poison: "#c084fc",
  electric: "#facc15",
  bug: "#a3e635",
  rock: "#a8a29e",
  ground: "#d6a56a",
  dragon: "#818cf8",
  psychic: "#f472b6",
});

export function shrineDefByIndex(index) {
  const n = SHRINE_ELEMENTS.length;
  if (!n) return null;
  const i = ((index % n) + n) % n;
  return SHRINE_ELEMENTS[i];
}

export function shrineDefByElement(element) {
  const key = String(element || "").toLowerCase();
  return SHRINE_ELEMENTS.find((d) => d.element === key) ?? null;
}

export function shrineMapColor(element) {
  return SHRINE_MAP_COLORS[String(element || "").toLowerCase()] ?? "#e2e8f0";
}

export function shrineGemKey(element) {
  return `${String(element || "normal").toLowerCase()}Gem`;
}
