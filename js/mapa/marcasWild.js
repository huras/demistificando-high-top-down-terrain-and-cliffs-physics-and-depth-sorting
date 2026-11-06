/**
 * Marcas de wild homes descobertos (stack por espécie + chunk).
 */
import { CHUNK_XZ } from "../config.js";
import { especie } from "../pokemon/dados.js";
import { wildsDescobertos, versaoDescobertaMapa } from "./descoberta.js";

/** @type {object[] | null} */
let cache = null;
let cacheVersao = -1;
/** Célula → marcas. Consulta da vista sem varrer o mundo inteiro.
 * @type {Map<string, object[]> | null} */
let grade = null;
/** Depuração: esconde pins no mapa/minimapa sem apagar descoberta. */
let ninhosVisiveis = true;

const CAP_MUNDO = 80;
const CELULA = 64;

export function ninhosMapaVisiveis() {
  return ninhosVisiveis;
}

export function definirNinhosMapaVisiveis(ativo) {
  ninhosVisiveis = !!ativo;
  return ninhosVisiveis;
}

function chaveStack(info) {
  const cx = Math.floor(info.x / CHUNK_XZ);
  const cy = Math.floor(info.y / CHUNK_XZ);
  return `${cx},${cy}:${info.speciesKey || "?"}`;
}

export function marcasWild() {
  if (!ninhosVisiveis) return [];
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
  grade = indexarGrade(out);
  return cache;
}

function indexarGrade(lista) {
  const mapa = new Map();
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    const k = `${Math.floor(m.x / CELULA)},${Math.floor(m.y / CELULA)}`;
    let cel = mapa.get(k);
    if (!cel) {
      cel = [];
      mapa.set(k, cel);
    }
    cel.push(m);
  }
  return mapa;
}

function naJanela(cx, cy, mx, my) {
  const x0 = cx - mx;
  const x1 = cx + mx;
  const y0 = cy - my;
  const y1 = cy + my;
  const gx0 = Math.floor(x0 / CELULA);
  const gx1 = Math.floor(x1 / CELULA);
  const gy0 = Math.floor(y0 / CELULA);
  const gy1 = Math.floor(y1 / CELULA);
  const out = [];
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const cel = grade.get(`${gx},${gy}`);
      if (!cel) continue;
      for (let i = 0; i < cel.length; i++) {
        const m = cel[i];
        if (m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue;
        out.push(m);
      }
    }
  }
  return out;
}

/** Os `cap` mais perto do centro, sem ordenar a lista inteira. */
function maisProximos(lista, cx, cy, cap) {
  const top = [];
  let pior = 0;
  let piorI = 0;
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    const dx = m.x - cx;
    const dy = m.y - cy;
    const d = dx * dx + dy * dy;
    if (top.length < cap) {
      top.push(m);
      if (top.length === 1 || d > pior) {
        pior = d;
        piorI = top.length - 1;
      }
      continue;
    }
    if (d >= pior) continue;
    top[piorI] = m;
    pior = -1;
    piorI = 0;
    for (let k = 0; k < cap; k++) {
      const t = top[k];
      const td = (t.x - cx) * (t.x - cx) + (t.y - cy) * (t.y - cy);
      if (td > pior) {
        pior = td;
        piorI = k;
      }
    }
  }
  return top;
}

/**
 * Subconjunto perto do centro da vista (cap no mapa mundo).
 * No minimapa, `margem` restringe à janela via grade.
 * @param {object[]} lista
 * @param {{ cx: number, cy: number, mini?: boolean }} vista
 * @param {{ mx: number, my: number } | null} [margem]
 */
export function filtrarWildParaVista(lista, vista, margem) {
  if (!lista?.length) return lista;
  if (vista?.mini) {
    if (!margem || !grade || lista.length <= 96) return lista;
    return naJanela(vista.cx, vista.cy, margem.mx, margem.my);
  }
  if (lista.length <= CAP_MUNDO) return lista;
  return maisProximos(lista, vista.cx, vista.cy, CAP_MUNDO);
}
