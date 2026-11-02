/**
 * Gates de habitat: pose aérea (FlapAround/Hover/Hop/Float) ≠ tipo Flying;
 * aquático = Water type.
 */
import { chaveTemPoseVoo, dexTemPoseVoo } from "./flapCatalog.js";
import { HABITAT, ehHabitatAquatico } from "./kinds.js";

/**
 * Espécie tem strip aérea no catálogo (asset gate).
 * @param {{ dex?: number, key?: string, tipos?: string[] } | null | undefined} esp
 */
export function temPoseVoo(esp) {
  if (!esp) return false;
  if (dexTemPoseVoo(esp.dex)) return true;
  if (chaveTemPoseVoo(esp.key)) return true;
  return false;
}

/** @deprecated use temPoseVoo */
export const temFlapAround = temPoseVoo;

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
  if (temPoseVoo(esp)) return HABITAT.HIGH;
  return HABITAT.LAND;
}

/**
 * Filtra se a espécie cabe no kind pedido.
 * @param {object | null} esp
 * @param {string} kind
 */
export function especieServeHabitat(esp, kind) {
  if (!esp) return false;
  if (kind === HABITAT.SKY) return temPoseVoo(esp);
  if (ehHabitatAquatico(kind)) return ehAquatico(esp);
  if (kind === HABITAT.HIGH) return temPoseVoo(esp);
  if (kind === HABITAT.LAND) return !ehAquatico(esp);
  return true;
}
