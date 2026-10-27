/**
 * Marcas de puzzles de letra no mapa (só após cheat de revelar, ou resolvidos).
 */
import { getWorldLetterPuzzlePlan } from "./plano.js";
import {
  letraRevelada,
  letraResolvida,
  versaoMapaLetras,
} from "./estado.js";

/** @type {object[] | null} */
let cache = null;
let cacheVersao = -1;

export function invalidarMarcasLetras() {
  cache = null;
  cacheVersao = -1;
}

export function geracaoMarcasLetras() {
  return versaoMapaLetras();
}

/**
 * @returns {object[]}
 */
export function marcasLetras() {
  const v = versaoMapaLetras();
  if (cache && cacheVersao === v) return cache;
  const out = [];
  const slots = getWorldLetterPuzzlePlan().slots;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const solved = letraResolvida(s.id);
    if (!solved && !letraRevelada(s.id)) continue;
    out.push({
      tipo: "letra",
      id: s.id,
      nome: `Letra ${s.letter}`,
      letter: s.letter,
      x: s.x,
      y: s.y,
      z: s.z,
      cleared: solved,
      cor: solved ? "#7ddea8" : "#c9b6ff",
    });
  }
  cache = out;
  cacheVersao = v;
  return cache;
}
