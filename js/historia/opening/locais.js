/** Âncoras da opening no grid Kanto local. */

import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { deLocalKanto } from "../../mundo/bounds.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";

const CENTRO = AREA_KANTO * 0.5;

function cidade(key) {
  return CIDADES_KANTO.find((c) => c.key === key) || null;
}

/** Centro mundial de uma área (ax, ay). */
export function mundoDaArea(ax, ay, lx = CENTRO, ly = CENTRO) {
  return deLocalKanto(ax * AREA_KANTO + lx, ay * AREA_KANTO + ly);
}

export function locaisOpening() {
  const pallet = cidade("pallet-town");
  const viridian = cidade("viridian");
  // Rota 1: entre Pallet (ay 17) e Viridian (ay 11) — área ay 14.
  const routeAx = pallet?.ax ?? 10;
  const routeAy = 14;
  const professor = mundoDaArea(routeAx, routeAy, CENTRO, CENTRO + 24);
  const bag = mundoDaArea(routeAx, routeAy, CENTRO, CENTRO + 8);
  return {
    palletAx: pallet?.ax ?? 10,
    palletAy: pallet?.ay ?? 17,
    viridianAx: viridian?.ax ?? 10,
    viridianAy: viridian?.ay ?? 11,
    routeAx,
    routeAy,
    professor,
    bag,
    rattata: [
      { x: professor.x - 2.2, y: professor.y + 1.4 },
      { x: professor.x + 2.4, y: professor.y + 1.1 },
    ],
  };
}
