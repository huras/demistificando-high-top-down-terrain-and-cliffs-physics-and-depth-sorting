import {
  ASA_DELTA_DESCIDA,
  ASA_DELTA_VEL_MUL,
  PATH_CUSTO_ESCALADA,
  PATH_GLIDE_ALCANCE_MAX,
  PATH_GLIDE_ALCANCE_MUL,
  PATH_GLIDE_DIST_MIN,
  PATH_GLIDE_PICO_DIST_MIN,
  PATH_GLIDE_PULO_BONUS,
  PATH_GLIDE_QUEDA_MIN,
  VELOCIDADE_MAX,
} from "../config.js";
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

/** tipo: 0=walk/drop, 1=jump, 2=climb, 3=glide */
export const TIPO_WALK = 0;
export const TIPO_JUMP = 1;
export const TIPO_CLIMB = 2;
export const TIPO_GLIDE = 3;

const cache = new Map();

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
 */
export function obterNavGrade(perfil) {
  let g = cache.get(perfil.id);
  if (g) return g;
  g = construirGrade(perfil);
  cache.set(perfil.id, g);
  return g;
}

function quedaMaxAndar(perfil) {
  return perfil.quedaMaxAndar ?? perfil.quedaMax ?? Infinity;
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
          if (!cardinalOk(cx, cy, zA, nx, cy, perfil)) continue;
          if (!cardinalOk(cx, cy, zA, cx, ny, perfil)) continue;
        }

        const edge = classificarAresta(zA, zB, perfil, diag);
        if (!edge) continue;
        lista.push(chaveCelula(nx, ny), edge.custo, edge.tipo);
      }

      if (perfil.podePlanar) {
        adicionarGlideRays(lista, cx, cy, zA);
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

  if (dz === 0) return { custo: base, tipo: TIPO_WALK };

  if (dz < 0) {
    const queda = -dz;
    if (queda > quedaMaxAndar(perfil)) return null;
    return { custo: base + queda * 0.15, tipo: TIPO_WALK };
  }

  if (dz === 1 && perfil.podePular) {
    return { custo: base + 0.35, tipo: TIPO_JUMP };
  }

  if (perfil.podeEscalar && dz >= 1) {
    return { custo: base + PATH_CUSTO_ESCALADA * dz, tipo: TIPO_CLIMB };
  }

  return null;
}

/**
 * NavLinks de asa-delta: raio em 8 dirs com **todos** os pousos válidos
 * (não só o 1º — senão o vale engole o link pico→pico).
 * Nunca pousa acima do z de origem (cliff/subida = pulo/escalada).
 */
function adicionarGlideRays(lista, cx, cy, zA) {
  const velGlide = VELOCIDADE_MAX * ASA_DELTA_VEL_MUL * PATH_GLIDE_ALCANCE_MUL;
  const zLaunch = zA + PATH_GLIDE_PULO_BONUS;
  const jaTem = new Set();
  for (let i = 0; i < lista.length; i += 3) jaTem.add(lista[i] | 0);

  for (const [dx, dy, diag] of DIRS) {
    const passo = diag ? SQRT2 : 1;
    for (let step = 1; step <= PATH_GLIDE_ALCANCE_MAX; step++) {
      const nx = cx + dx * step;
      const ny = cy + dy * step;
      if (!dentroDoMapa(nx, ny)) break;

      const zLand = alturaEm(nx, ny);
      // parede acima do chão de origem bloqueia o raio (não “asa pra cima”)
      if (zLand > zA) break;

      if (zLand <= 0) continue;

      const distHoriz = step * passo;
      if (distHoriz < PATH_GLIDE_DIST_MIN) continue;

      const quedaChao = zA - zLand;
      const picoAPico = quedaChao === 0 && distHoriz >= PATH_GLIDE_PICO_DIST_MIN;
      const quedaOk = quedaChao >= PATH_GLIDE_QUEDA_MIN;
      if (!quedaOk && !picoAPico) continue;

      // alcance usa ápice do pulo; pouso nunca acima de zA
      const dzLaunch = zLaunch - zLand;
      const alcanceMax = (dzLaunch / ASA_DELTA_DESCIDA) * velGlide;
      if (distHoriz > alcanceMax) continue;

      if (!clearanceGlide(cx, cy, zLaunch, nx, ny, zLand, dx, dy, step)) {
        continue;
      }

      const key = chaveCelula(nx, ny);
      if (jaTem.has(key)) continue;

      const custo =
        distHoriz / (VELOCIDADE_MAX * ASA_DELTA_VEL_MUL) +
        Math.max(quedaChao, 0.5) / ASA_DELTA_DESCIDA +
        0.35;
      lista.push(key, custo, TIPO_GLIDE);
      jaTem.add(key);
    }
  }
}

/** Terreno sob o arco linear de descida (de zLaunch até zLand) não fura o envelope. */
function clearanceGlide(sx, sy, zLaunch, lx, ly, zLand, dx, dy, step) {
  for (let t = 1; t <= step; t++) {
    const fx = sx + dx * t;
    const fy = sy + dy * t;
    const zTerreno = alturaEm(fx, fy);
    if (zTerreno <= 0) continue;
    const f = t / step;
    const zGlide = zLaunch + (zLand - zLaunch) * f;
    if (t === step) {
      if (zTerreno > zLand) return false;
    } else if (zTerreno >= zGlide - 0.05) {
      return false;
    }
  }
  return true;
}

/** Itera vizinhos: callback(vizKey, custo, tipo) */
export function paraCadaVizinho(grade, key, fn) {
  const arr = grade.edges[key];
  if (!arr) return;
  for (let i = 0; i < arr.length; i += 3) {
    fn(arr[i] | 0, arr[i + 1], arr[i + 2] | 0);
  }
}
