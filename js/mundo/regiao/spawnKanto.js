/**
 * Pallet, no meio da praça. O chão da cidade é a cota fixa da amostra.
 */
import { deLocalKanto } from "../bounds.js";
import { ALTURA_PRACA } from "./amostraKanto.js";
import { AREA_KANTO, CENTRO_AREA } from "./grafoKanto.js";

const local = deLocalKanto(
  10 * AREA_KANTO + CENTRO_AREA + 0.5,
  17 * AREA_KANTO + CENTRO_AREA + 0.5,
);

export const SPAWN_PALLET = Object.freeze({
  x: local.x,
  y: local.y,
  z: ALTURA_PRACA,
});
