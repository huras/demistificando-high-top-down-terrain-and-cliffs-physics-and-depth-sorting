/**
 * Grade mundial de bioma de encontro, uma vez.
 * Células reutilizam a mesma resolução do calor de força.
 */

import { areaLogicaNoMundo } from "../../../mundo/bioma/areasMundo.js";
import { dentroDoKanto } from "../../../mundo/bounds.js";
import { amostraKanto } from "../../../mundo/regiao/amostraKanto.js";
import { CELULA_FORCA, GRADE_FORCA } from "../../../pokemon/distribuicao/forca.js";

/** @type {Promise<Map<string, number[]>> | null} */
let pronto = null;

/** @type {Map<string, number[]> | null} */
let celulas = null;

function biomaNoPonto(wx, wy) {
  if (dentroDoKanto(wx, wy)) {
    return amostraKanto(wx, wy)?.bioma?.id || "light-grass";
  }
  return areaLogicaNoMundo(wx, wy)?.encontro || "light-grass";
}

function fatiar() {
  const grade = new Array(GRADE_FORCA * GRADE_FORCA);
  const meio = CELULA_FORCA * 0.5;
  let cy = 0;

  return new Promise((resolve) => {
    function lote() {
      const t0 = performance.now();
      while (cy < GRADE_FORCA && performance.now() - t0 < 6) {
        const base = cy * GRADE_FORCA;
        const wy = cy * CELULA_FORCA + meio;
        for (let cx = 0; cx < GRADE_FORCA; cx++) {
          grade[base + cx] = biomaNoPonto(cx * CELULA_FORCA + meio, wy);
        }
        cy += 1;
      }
      if (cy < GRADE_FORCA) {
        setTimeout(lote, 0);
        return;
      }
      const mapa = new Map();
      for (let i = 0; i < grade.length; i++) {
        const id = grade[i];
        let lista = mapa.get(id);
        if (!lista) {
          lista = [];
          mapa.set(id, lista);
        }
        lista.push(i);
      }
      celulas = mapa;
      resolve(mapa);
    }
    lote();
  });
}

export function garantirGradeBioma() {
  if (!pronto) pronto = fatiar();
  return pronto;
}

/**
 * @param {string} biomaId
 * @returns {number[] | null}
 */
export function celulasDoBioma(biomaId) {
  return celulas?.get(biomaId) || null;
}

/**
 * @param {string} biomaId
 * @returns {{ x0: number, y0: number, x1: number, y1: number } | null}
 */
export async function limitesDoBioma(biomaId) {
  await garantirGradeBioma();
  const lista = celulas?.get(biomaId);
  if (!lista?.length) return null;
  let x0 = GRADE_FORCA;
  let y0 = GRADE_FORCA;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < lista.length; i++) {
    const idx = lista[i];
    const cx = idx % GRADE_FORCA;
    const cy = (idx / GRADE_FORCA) | 0;
    if (cx < x0) x0 = cx;
    if (cy < y0) y0 = cy;
    if (cx > x1) x1 = cx;
    if (cy > y1) y1 = cy;
  }
  return {
    x0: x0 * CELULA_FORCA,
    y0: y0 * CELULA_FORCA,
    x1: (x1 + 1) * CELULA_FORCA,
    y1: (y1 + 1) * CELULA_FORCA,
  };
}
