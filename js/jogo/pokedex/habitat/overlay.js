/**
 * Bake de presença por espécie. A grade de bioma é compartilhada;
 * cada espécie só pinta as células dos biomas em que ela sorteia.
 */

import { CELULA_FORCA, GRADE_FORCA } from "../../../pokemon/distribuicao/forca.js";
import { biomassDaEspecie, geracaoHabitat } from "./indice.js";
import { celulasDoBioma, garantirGradeBioma } from "./gradeBioma.js";

const CAP_LRU = 12;

/**
 * @typedef {Object} FiltroHabitat
 * @property {boolean} casa
 * @property {boolean} extra
 * @property {boolean} santuario
 */

/**
 * @typedef {Object} BakeHabitat
 * @property {Uint8Array} pesos 0 vazio, 1 extra, 2 casa
 * @property {{ x0: number, y0: number, x1: number, y1: number } | null} bounds
 * @property {number} geracao
 * @property {number} usado
 * @property {{ chave: number, canvas: HTMLCanvasElement } | null} tinta
 */

/** @type {Map<string, BakeHabitat>} */
const lru = new Map();

function expulsar() {
  while (lru.size > CAP_LRU) {
    let velha = "";
    let t = Infinity;
    for (const [chave, item] of lru) {
      if (item.usado < t) {
        t = item.usado;
        velha = chave;
      }
    }
    if (!velha) break;
    lru.delete(velha);
  }
}

/**
 * @param {string} speciesKey
 * @returns {Promise<BakeHabitat>}
 */
export async function bakeDaEspecie(speciesKey) {
  await garantirGradeBioma();
  const chave = String(speciesKey || "");
  const geracao = geracaoHabitat();
  const hit = lru.get(chave);
  if (hit && hit.geracao === geracao) {
    hit.usado = performance.now();
    return hit;
  }

  const pesos = new Uint8Array(GRADE_FORCA * GRADE_FORCA);
  const biomassa = biomassDaEspecie(chave);
  let x0 = GRADE_FORCA;
  let y0 = GRADE_FORCA;
  let x1 = -1;
  let y1 = -1;

  for (const [biomaId, peso] of biomassa) {
    const celulas = celulasDoBioma(biomaId);
    if (!celulas) continue;
    const marca = peso >= 3 ? 2 : 1;
    for (let i = 0; i < celulas.length; i++) {
      const idx = celulas[i];
      if (pesos[idx] >= marca) continue;
      pesos[idx] = marca;
      const cx = idx % GRADE_FORCA;
      const cy = (idx / GRADE_FORCA) | 0;
      if (cx < x0) x0 = cx;
      if (cy < y0) y0 = cy;
      if (cx > x1) x1 = cx;
      if (cy > y1) y1 = cy;
    }
  }

  /** @type {BakeHabitat} */
  const item = {
    pesos,
    bounds:
      x1 < 0
        ? null
        : {
            x0: x0 * CELULA_FORCA,
            y0: y0 * CELULA_FORCA,
            x1: (x1 + 1) * CELULA_FORCA,
            y1: (y1 + 1) * CELULA_FORCA,
          },
    geracao,
    usado: performance.now(),
    tinta: null,
  };
  lru.set(chave, item);
  expulsar();
  return item;
}

/**
 * Recolore o bake já pronto. Não reamostra o mundo.
 * @param {BakeHabitat} item
 * @param {FiltroHabitat} filtros
 * @returns {HTMLCanvasElement}
 */
export function tintaDoBake(item, filtros) {
  const casa = filtros.casa !== false;
  const extra = filtros.extra !== false;
  const chave = (casa ? 1 : 0) + (extra ? 2 : 0);
  if (item.tinta && item.tinta.chave === chave) return item.tinta.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = GRADE_FORCA;
  canvas.height = GRADE_FORCA;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) {
    item.tinta = { chave, canvas };
    return canvas;
  }
  const img = ctx.createImageData(GRADE_FORCA, GRADE_FORCA);
  const data = img.data;
  const pesos = item.pesos;
  for (let i = 0; i < pesos.length; i++) {
    const marca = pesos[i];
    if (marca === 2 && !casa) continue;
    if (marca === 1 && !extra) continue;
    if (!marca) continue;
    const o = i * 4;
    if (marca === 2) {
      data[o] = 250;
      data[o + 1] = 204;
      data[o + 2] = 21;
      data[o + 3] = 158;
    } else {
      data[o] = 56;
      data[o + 1] = 189;
      data[o + 2] = 248;
      data[o + 3] = 148;
    }
  }
  ctx.putImageData(img, 0, 0);
  item.tinta = { chave, canvas };
  return canvas;
}
