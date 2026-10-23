/**
 * Marcas de santuários descobertos no mapa mundo / minimapa (cacheadas).
 */
import { getWorldShrinePlan, shrineMapColor } from "./colocacao.js";
import {
  estadoSantuario,
  santuarioLimpo,
  versaoMapaSantuario,
} from "./estadoSantuario.js";
import { nomeTemplo } from "./nomes.js";

/** @type {object[] | null} */
let cache = null;
let cacheVersao = -1;

export function invalidarMarcasSantuario() {
  cache = null;
  cacheVersao = -1;
}

export function geracaoMarcasSantuario() {
  return versaoMapaSantuario();
}

/**
 * Lista cacheada — só reconstrói quando discovered/cleared mudam.
 * @returns {object[]}
 */
export function marcasSantuario() {
  const v = versaoMapaSantuario();
  if (cache && cacheVersao === v) return cache;
  const out = [];
  const slots = getWorldShrinePlan().slots;
  for (let i = 0; i < slots.length; i++) {
    const m = slots[i];
    if (!estadoSantuario.discovered.has(m.id) && !santuarioLimpo(m.id)) continue;
    const cleared = santuarioLimpo(m.id);
    out.push({
      tipo: "santuario",
      id: m.id,
      nome: nomeTemplo(m.id, m.element),
      x: m.x,
      y: m.y,
      cor: shrineMapColor(m.element),
      cleared,
      element: m.element,
    });
  }
  cache = out;
  cacheVersao = v;
  return cache;
}
