/**
 * Imagem do puzzle = retrato da espécie da pedra.
 */
import { especiePorDex } from "./cota.js";

export function shrinePuzzleImageSrc(shrineId, element, stone = null) {
  const dex = Number(stone?.dex) || 0;
  if (dex > 0) return `/ref/sprites/pokemon-portraits/${dex | 0}.png`;
  const key = String(stone?.speciesKey ?? "").trim();
  if (key) {
    // fallback: procura dex no plano via speciesKey já resolvido no prop
  }
  return `/ref/sprites/pokemon-portraits/133.png`;
}

export function shrinePuzzleSpecies(stone) {
  const dex = Number(stone?.dex) || 0;
  if (dex > 0) return especiePorDex(dex);
  return null;
}
