/**
 * Marcas de wild homes descobertos (stack por espécie + chunk).
 */
import { CHUNK_XZ } from "../config.js";
import { especie } from "../pokemon/dados.js";
import { wildsDescobertos, versaoDescobertaMapa } from "./descoberta.js";

/** @type {object[] | null} */
let cache = null;
let cacheVersao = -1;

const CAP_MUNDO = 80;

function chaveStack(info) {
  const cx = Math.floor(info.x / CHUNK_XZ);
  const cy = Math.floor(info.y / CHUNK_XZ);
  return `${cx},${cy}:${info.speciesKey || "?"}`;
}

export function marcasWild() {
  const v = versaoDescobertaMapa();
  if (cache && cacheVersao === v) return cache;

  /** @type {Map<string, { x: number, y: number, n: number, speciesKey: string, dex: number, shiny: boolean, ids: string[] }>} */
  const stacks = new Map();
  for (const [id, info] of wildsDescobertos()) {
    const key = chaveStack(info);
    let s = stacks.get(key);
    if (!s) {
      s = {
        x: 0,
        y: 0,
        n: 0,
        speciesKey: info.speciesKey,
        dex: info.dex | 0,
        shiny: !!info.shiny,
        ids: [],
      };
      stacks.set(key, s);
    }
    s.x += info.x;
    s.y += info.y;
    s.n++;
    s.ids.push(id);
    if (info.shiny) s.shiny = true;
    if (!s.dex && info.dex) s.dex = info.dex | 0;
  }

  const out = [];
  for (const [key, s] of stacks) {
    const esp = especie(s.speciesKey);
    const dex = s.dex || esp?.dex || 0;
    out.push({
      tipo: "wild",
      id: `wild:${key}`,
      x: s.x / s.n,
      y: s.y / s.n,
      speciesKey: s.speciesKey,
      dex,
      shiny: s.shiny,
      count: s.n,
      nome: esp?.nome || s.speciesKey,
    });
  }
  cache = out;
  cacheVersao = v;
  return cache;
}

/**
 * Subconjunto perto do centro da vista (cap no mapa mundo).
 * @param {object[]} lista
 * @param {{ cx: number, cy: number, mini?: boolean }} vista
 */
export function filtrarWildParaVista(lista, vista) {
  if (!lista?.length) return lista;
  if (vista?.mini) return lista;
  if (lista.length <= CAP_MUNDO) return lista;
  const cx = vista.cx;
  const cy = vista.cy;
  const ranked = lista.slice().sort((a, b) => {
    const da = (a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy);
    const db = (b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy);
    return da - db;
  });
  return ranked.slice(0, CAP_MUNDO);
}
