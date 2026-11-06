/**
 * Becos de montanha: no máximo um por área, longe das cavernas autoradas.
 */
import { hashSeed } from "../santuario/dungeonGen.js";
import { zonaEm } from "../mundo/regiao/grafoKanto.js";
import { RELEVO_MONTANHA, relevoEm } from "../mundo/regiao/kantoRelevo.js";
import { CAVERNAS_KANTO } from "./catalogo.js";

const PERTO = 2;

function pertoDeAutoral(ax, ay) {
  for (let i = 0; i < CAVERNAS_KANTO.length; i++) {
    const bocas = CAVERNAS_KANTO[i].mouths;
    for (let j = 0; j < bocas.length; j++) {
      const m = bocas[j];
      if (Math.max(Math.abs(m.ax - ax), Math.abs(m.ay - ay)) <= PERTO) return true;
    }
  }
  return false;
}

export function areaAceitaProcedural(ax, ay) {
  if (relevoEm(ax, ay) !== RELEVO_MONTANHA) return false;
  const zona = zonaEm(ax, ay);
  if (!zona || zona.tipo === "cidade") return false;
  if (pertoDeAutoral(ax, ay)) return false;
  return hashSeed(`proc-cave:${ax}:${ay}`) % 5 === 0;
}
