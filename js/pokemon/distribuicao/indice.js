/** Índice bioma/área → pools casa/extras brutos (catálogo filtra no sorteio). */

import { AREAS_KANTO, areaPorId } from "../../mundo/regiao/areasKanto.js";

const VAZIO = Object.freeze({ casa: Object.freeze([]), extras: Object.freeze([]) });

/** @type {Map<string, { casa: readonly string[], extras: readonly string[] }> | null} */
let porBioma = null;
let pronto = false;

/** Área lógica → chave de pool visual (`encontro`). */
function aliasArea(id) {
  const area = areaPorId(id);
  return area?.encontro || null;
}

export function distribuicaoPronta() {
  return pronto;
}

export async function carregarDistribuicao() {
  const res = await fetch("/ref/distribuicao-bioma.json");
  if (!res.ok) throw new Error("distribuição de bioma indisponível");
  const json = await res.json();
  const mapa = json?.porBioma || {};
  porBioma = new Map();
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

  // Garante chave por área lógica → mesmo pool do bioma de encontro.
  for (let i = 0; i < AREAS_KANTO.length; i++) {
    const area = AREAS_KANTO[i];
    if (porBioma.has(area.id)) continue;
    const base = porBioma.get(area.encontro);
    if (base) porBioma.set(area.id, base);
  }

  const porArea = json?.porArea || {};
  const areaIds = Object.keys(porArea);
  for (let i = 0; i < areaIds.length; i++) {
    const id = areaIds[i];
    const item = porArea[id] || {};
    porBioma.set(
      id,
      Object.freeze({
        casa: Object.freeze(Array.isArray(item.casa) ? item.casa.slice() : []),
        extras: Object.freeze(Array.isArray(item.extras) ? item.extras.slice() : []),
      }),
    );
  }

  pronto = true;
  return porBioma.size;
}

export function poolDoBioma(id) {
  if (!porBioma) return VAZIO;
  const direto = porBioma.get(id);
  if (direto) return direto;
  const alias = aliasArea(id);
  if (alias) return porBioma.get(alias) || VAZIO;
  return VAZIO;
}
