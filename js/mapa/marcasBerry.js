/**
 * Marcas de berry descobertas (só minimapa).
 */
import { berriesDescobertos, versaoDescobertaMapa } from "./descoberta.js";
import { BERRIES } from "../wild/catalogo.js";

/** @type {object[] | null} */
let cache = null;
let cacheVersao = -1;

export function marcasBerry() {
  const v = versaoDescobertaMapa();
  if (cache && cacheVersao === v) return cache;
  const out = [];
  for (const [id, info] of berriesDescobertos()) {
    out.push({
      tipo: "berry",
      id: `berry:${id}`,
      x: info.x,
      y: info.y,
      berryKey: info.berryKey,
      cor: BERRIES[info.berryKey]?.cor || "#86efac",
      nome: BERRIES[info.berryKey]?.nome || info.berryKey,
    });
  }
  cache = out;
  cacheVersao = v;
  return cache;
}
