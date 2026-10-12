/**
 * Pallet, no meio da praça. O chão da cidade é a cota fixa da amostra.
 */
import { ALTURA_PRACA } from "./amostraKanto.js";
import { AREA_KANTO, CENTRO_AREA } from "./grafoKanto.js";

export const SPAWN_PALLET = Object.freeze({
  x: 10 * AREA_KANTO + CENTRO_AREA + 0.5,
  y: 17 * AREA_KANTO + CENTRO_AREA + 0.5,
  z: ALTURA_PRACA,
});
