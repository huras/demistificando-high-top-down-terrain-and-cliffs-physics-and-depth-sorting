import { PATH_CUSTO_ESCALADA } from "../config.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";
import { COLUNAS, LINHAS } from "../mundo/mapaDemo.js";

const SQRT2 = Math.SQRT2;

/** 8 direções: dx, dy, éDiagonal */
const DIRS = [
  [1, 0, false],
  [-1, 0, false],
  [0, 1, false],
  [0, -1, false],
  [1, 1, true],
  [1, -1, true],
  [-1, 1, true],
  [-1, -1, true],
];

const cache = new Map(); // perfilId -> { vizinhos: Int32Array[][], custos: Float32Array[][] }

export function chaveCelula(cx, cy) {
  return cy * COLUNAS + cx;
}

export function celulaDeChave(key) {
  const cy = (key / COLUNAS) | 0;
  const cx = key - cy * COLUNAS;
  return { cx, cy };
}

export function invalidarNavCache() {
  cache.clear();
}

/**
 * Garante grade de adjacência pro perfil (build lazy, 1×).
 * Cada célula: lista compacta de [vizKey0, custo0, tipo0, ...]
 * tipo: 0=walk/drop, 1=jump, 2=climb
 */
export function obterNavGrade(perfil) {
  let g = cache.get(perfil.id);
  if (g) return g;
  g = construirGrade(perfil);
  cache.set(perfil.id, g);
  return g;
}

function construirGrade(perfil) {
  const n = COLUNAS * LINHAS;
  /** @type {Float32Array[]} */
  const edges = new Array(n);

  for (let cy = 0; cy < LINHAS; cy++) {
    for (let cx = 0; cx < COLUNAS; cx++) {
      const zA = alturaEm(cx, cy);
      if (zA <= 0) {
        edges[chaveCelula(cx, cy)] = new Float32Array(0);
        continue;
      }
      const lista = [];
      for (const [dx, dy, diag] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!dentroDoMapa(nx, ny)) continue;
        const zB = alturaEm(nx, ny);
        if (zB <= 0) continue;

        if (diag) {
          // corte de canto: ambos cardinais precisam ser transitáveis no mesmo nível de regra
          if (!cardinalOk(cx, cy, zA, nx, cy, perfil)) continue;
          if (!cardinalOk(cx, cy, zA, cx, ny, perfil)) continue;
        }

        const edge = classificarAresta(zA, zB, perfil, diag);
        if (!edge) continue;
        lista.push(chaveCelula(nx, ny), edge.custo, edge.tipo);
      }
      edges[chaveCelula(cx, cy)] = new Float32Array(lista);
    }
  }

  return {
    perfilId: perfil.id,
    cols: COLUNAS,
    rows: LINHAS,
    edges,
  };
}

function cardinalOk(cx, cy, zA, tx, ty, perfil) {
  if (!dentroDoMapa(tx, ty)) return false;
  const zB = alturaEm(tx, ty);
  if (zB <= 0) return false;
  return !!classificarAresta(zA, zB, perfil, false);
}

/**
 * @returns {{ custo: number, tipo: number } | null}
 */
function classificarAresta(zA, zB, perfil, diag) {
  const base = diag ? SQRT2 : 1;
  const dz = zB - zA;

  if (dz === 0) return { custo: base, tipo: 0 };

  if (dz < 0) {
    const queda = -dz;
    if (queda > perfil.quedaMax) return null;
    // queda: um pouco mais cara se for alta
    return { custo: base + queda * 0.15, tipo: 0 };
  }

  // subida
  if (dz === 1 && perfil.podePular) {
    return { custo: base + 0.35, tipo: 1 };
  }

  if (perfil.podeEscalar && dz >= 1) {
    return { custo: base + PATH_CUSTO_ESCALADA * dz, tipo: 2 };
  }

  return null;
}

/** Itera vizinhos: callback(vizKey, custo, tipo) */
export function paraCadaVizinho(grade, key, fn) {
  const arr = grade.edges[key];
  if (!arr) return;
  for (let i = 0; i < arr.length; i += 3) {
    fn(arr[i] | 0, arr[i + 1], arr[i + 2] | 0);
  }
}
