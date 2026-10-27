/** Índice bioma → pools casa/extras brutos (catálogo filtra no sorteio). */

import { AREAS_MUNDO, areaPorId } from "../../mundo/bioma/areasMundo.js";

const VAZIO = Object.freeze({ casa: Object.freeze([]), extras: Object.freeze([]) });

/** @type {Map<string, { casa: readonly string[], extras: readonly string[] }> | null} */
let porBioma = null;
let pronto = false;

export function distribuicaoPronta() {
  return pronto;
}

export async function carregarDistribuicao() {
  porBioma = new Map();
  try {
    const res = await fetch("/ref/distribuicao-bioma.json");
    if (res.ok) {
      const json = await res.json();
      const mapa = json?.porBioma || {};
      const ids = Object.keys(mapa);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const item = mapa[id] || {};
        porBioma.set(
          id,
          Object.freeze({
            casa: Object.freeze(Array.isArray(item.casa) ? item.casa.slice() : []),
            extras: Object.freeze(Array.isArray(item.extras) ? item.extras.slice() : []),
          }),
        );
      }
    }
  } catch {
    // Sem JSON: pools vazios — sorteio usa pad aquático / light-grass fallback.
  }
  // Área lógica exterior → mesmo pool do bioma de encontro.
  for (let i = 0; i < AREAS_MUNDO.length; i++) {
    const area = AREAS_MUNDO[i];
    if (porBioma.has(area.id)) continue;
    const base = porBioma.get(area.encontro);
    if (base) porBioma.set(area.id, base);
  }
  // Pools mínimos pra mar/shelf se o JSON omitir.
  const padMar = Object.freeze({
    casa: Object.freeze(["magikarp", "tentacool", "goldeen", "psyduck"]),
    extras: Object.freeze(["staryu", "shellder", "horsea", "poliwag"]),
  });
  const idsMar = ["sandy-shelf", "deep-trench", "kelp-forest", "mundo-shelf", "mundo-trench"];
  for (let i = 0; i < idsMar.length; i++) {
    if (!porBioma.has(idsMar[i])) porBioma.set(idsMar[i], padMar);
  }
  pronto = true;
  return porBioma.size;
}

export function poolDoBioma(id) {
  if (!porBioma) return VAZIO;
  const direto = porBioma.get(id);
  if (direto) return direto;
  const area = areaPorId(id);
  if (area?.encontro) return porBioma.get(area.encontro) || VAZIO;
  return VAZIO;
}
