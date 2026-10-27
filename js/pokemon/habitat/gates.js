/**
 * Gates de habitat: FlapAround ≠ Flying type; aquático = Water type.
 */
import { chaveTemFlapAround, dexTemFlapAround } from "./flapCatalog.js";
import { HABITAT, ehHabitatAquatico } from "./kinds.js";

/**
 * @param {{ dex?: number, key?: string, tipos?: string[] } | null | undefined} esp
 */
export function temFlapAround(esp) {
  if (!esp) return false;
  if (dexTemFlapAround(esp.dex)) return true;
  if (chaveTemFlapAround(esp.key)) return true;
  return false;
}

/**
 * @param {{ tipos?: string[] } | null | undefined} esp
 */
export function ehAquatico(esp) {
  const tipos = esp?.tipos;
  if (!Array.isArray(tipos)) return false;
  for (let i = 0; i < tipos.length; i++) {
    if (tipos[i] === "water") return true;
  }
  return false;
}

/**
 * Kind do lar permanente a partir da espécie + tile.
 * @param {object | null} esp
 * @param {{ molhado?: boolean, profundidade?: number, undersea?: boolean } | null} [tile]
 */
export function kindDoLar(esp, tile = null) {
  const molhado = !!tile?.molhado;
  const undersea = !!tile?.undersea;
  const prof = Number(tile?.profundidade) || 0;

  if (molhado && ehAquatico(esp)) {
    if (undersea || prof >= 3) return HABITAT.UNDERSEA;
    return HABITAT.SURFACE;
  }
  if (temFlapAround(esp)) return HABITAT.HIGH;
  return HABITAT.LAND;
}

/**
 * Filtra se a espécie cabe no kind pedido.
 * @param {object | null} esp
 * @param {string} kind
 */
export function especieServeHabitat(esp, kind) {
  if (!esp) return false;
  if (kind === HABITAT.SKY) return temFlapAround(esp);
  if (ehHabitatAquatico(kind)) return ehAquatico(esp);
  if (kind === HABITAT.HIGH) return temFlapAround(esp);
  if (kind === HABITAT.LAND) return !ehAquatico(esp);
  return true;
}
