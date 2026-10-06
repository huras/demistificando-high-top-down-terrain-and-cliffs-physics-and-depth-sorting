import {
  ASA_DELTA_DESCIDA,
  ASA_DELTA_VEL_MUL,
  ESCALADA_VEL,
  NAV_RAIO,
  PATH_CUSTO_ESCALADA,
  PATH_GLIDE_ALCANCE_MAX,
  PATH_GLIDE_ALCANCE_MUL,
  PATH_GLIDE_CUSTO_MUL,
  PATH_GLIDE_DIST_MIN,
  PATH_GLIDE_PICO_DIST_MIN,
  PATH_GLIDE_PULO_BONUS,
  PATH_GLIDE_QUEDA_MIN,
  PATH_VOO_ALCANCE_MAX,
  PATH_VOO_CUSTO_MUL,
  PATH_VOO_DIST_MIN,
  PATH_VOO_VEL,
  VELOCIDADE_MAX,
} from "../config.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";
import { obterAabbCarregado } from "../mundo/voxel/storeMundo.js";

const SQRT2 = Math.SQRT2;
const KEY_OFFSET = 32768;

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

export const TIPO_WALK = 0;
export const TIPO_JUMP = 1;
export const TIPO_CLIMB = 2;
export const TIPO_GLIDE = 3;
export const TIPO_VOO = 4;

const cache = new Map();
/** Centro da última grade (mundo). */
let navCentro = { cx: 0, cy: 0 };
let navRaioAtivo = 28;

export function chaveCelula(cx, cy) {
  return (((cy + KEY_OFFSET) & 0xffff) << 16) | ((cx + KEY_OFFSET) & 0xffff);
}

export function celulaDeChave(key) {
  const cx = (key & 0xffff) - KEY_OFFSET;
  const cy = ((key >>> 16) & 0xffff) - KEY_OFFSET;
  return { cx, cy };
}

export function invalidarNavCache(_aabb = null) {
  cache.clear();
}

/** Atualiza âncora da grade (jogador / agente). */
export function definirNavCentro(cx, cy) {
  navCentro.cx = cx | 0;
  navCentro.cy = cy | 0;
}

export function obterNavGrade(perfil, ax = null, ay = null, gx = null, gy = null) {
  const aCx = ax != null ? ax | 0 : navCentro.cx;
  const aCy = ay != null ? ay | 0 : navCentro.cy;
  const gCx = gx != null ? gx | 0 : aCx;
  const gCy = gy != null ? gy | 0 : aCy;

  let g = cache.get(perfil.id);
  const fora =
    !g ||
    aCx < g.x0 ||
    aCx > g.x1 ||
    aCy < g.y0 ||
    aCy > g.y1 ||
    gCx < g.x0 ||
    gCx > g.x1 ||
    gCy < g.y0 ||
    gCy > g.y1;

  if (!fora) return g;

  const midX = ((aCx + gCx) / 2) | 0;
  const midY = ((aCy + gCy) / 2) | 0;
  const dist = Math.hypot(gCx - aCx, gCy - aCy);
  const raio = Math.min(48, Math.max(NAV_RAIO, Math.ceil(dist * 0.5) + 12));
  navCentro.cx = midX;
  navCentro.cy = midY;
  navRaioAtivo = raio;
  g = construirGrade(perfil, midX, midY, raio);
  cache.set(perfil.id, g);
  return g;
}

function quedaMaxAndar(perfil) {
  return perfil.quedaMaxAndar ?? perfil.quedaMax ?? Infinity;
}

/** Célula na beira de precipício — única que precisa de NavLink glide. */
function temBeiraGlide(cx, cy, zA) {
  if (zA < PATH_GLIDE_QUEDA_MIN + 1) return false;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    if (zA - alturaEm(cx + dx, cy + dy) >= PATH_GLIDE_QUEDA_MIN) return true;
  }
  return false;
}

function construirGrade(perfil, centroX, centroY, raio) {
  const loaded = obterAabbCarregado();
  const x0 = Math.max(loaded.x0 | 0, centroX - raio);
  const y0 = Math.max(loaded.y0 | 0, centroY - raio);
  const x1 = Math.min(loaded.x1 | 0, centroX + raio);
  const y1 = Math.min(loaded.y1 | 0, centroY + raio);

  /** @type {Map<number, number[]>} — NÃO usar Float32Array: chaves packed >2^24 perdem precisão. */
  const edges = new Map();

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!dentroDoMapa(cx, cy)) continue;
      const zA = alturaEm(cx, cy);
      const key = chaveCelula(cx, cy);
      if (zA <= 0) {
        edges.set(key, []);
        continue;
      }
      const lista = [];
      for (const [dx, dy, diag] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!dentroDoMapa(nx, ny)) continue;
        const zB = alturaEm(nx, ny);
        if (zB <= 0) continue;
        if (diag && !cantoDiagonalLivre(cx, cy, zA, nx, ny)) continue;
        const edge = classificarAresta(zA, zB, perfil, diag);
        if (!edge) continue;
        lista.push(chaveCelula(nx, ny), edge.custo, edge.tipo);
      }
      if (perfil.podePlanar && temBeiraGlide(cx, cy, zA)) {
        adicionarGlideRays(lista, cx, cy, zA);
      }
      if (perfil.podeVoar && temBeiraGlide(cx, cy, zA)) {
        adicionarVooRays(lista, cx, cy, zA);
      }
      edges.set(key, lista);
    }
  }


  return {
    perfilId: perfil.id,
    x0,
    y0,
    x1,
    y1,
    edges,
  };
}

function cantoDiagonalLivre(cx, cy, zA, nx, ny) {
  const zB = alturaEm(nx, ny);
  const teto = Math.max(zA, zB);
  const zCornerX = alturaEm(nx, cy);
  const zCornerY = alturaEm(cx, ny);
  if (zCornerX > 0 && zCornerX > teto) return false;
  if (zCornerY > 0 && zCornerY > teto) return false;
  return true;
}

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

  if (perfil.podeEscalar && dz >= 2) {
    const custo =
      base + PATH_CUSTO_ESCALADA + dz / Math.max(0.25, ESCALADA_VEL);
    return { custo, tipo: TIPO_CLIMB };
  }

  if (perfil.podeEscalar && dz >= 1) {
    const custo =
      base + PATH_CUSTO_ESCALADA + dz / Math.max(0.25, ESCALADA_VEL);
    return { custo, tipo: TIPO_CLIMB };
  }

  return null;
}

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
      if (zLand > zA) break;
      if (zLand <= 0) continue;

      const distHoriz = step * passo;
      if (distHoriz < PATH_GLIDE_DIST_MIN) continue;

      const quedaChao = zA - zLand;
      const picoAPico = quedaChao === 0 && distHoriz >= PATH_GLIDE_PICO_DIST_MIN;
      const quedaOk = quedaChao >= PATH_GLIDE_QUEDA_MIN;
      if (!quedaOk && !picoAPico) continue;

      const dzLaunch = zLaunch - zLand;
      const alcanceMax = (dzLaunch / ASA_DELTA_DESCIDA) * velGlide;
      if (distHoriz > alcanceMax) continue;
      if (!clearanceGlide(cx, cy, zLaunch, nx, ny, zLand, dx, dy, step)) continue;

      const key = chaveCelula(nx, ny);
      if (jaTem.has(key)) continue;

      const custo =
        (distHoriz / (VELOCIDADE_MAX * ASA_DELTA_VEL_MUL) +
          Math.max(quedaChao, 0.5) / ASA_DELTA_DESCIDA +
          0.25) *
        PATH_GLIDE_CUSTO_MUL;
      lista.push(key, custo, TIPO_GLIDE);
      jaTem.add(key);
    }
  }
}

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

function adicionarVooRays(lista, cx, cy, zA) {
  const jaTem = new Set();
  for (let i = 0; i < lista.length; i += 3) jaTem.add(lista[i] | 0);

  for (const [dx, dy, diag] of DIRS) {
    const passo = diag ? SQRT2 : 1;
    for (let step = 1; step <= PATH_VOO_ALCANCE_MAX; step++) {
      const nx = cx + dx * step;
      const ny = cy + dy * step;
      if (!dentroDoMapa(nx, ny)) break;

      const zLand = alturaEm(nx, ny);
      if (zLand <= 0) continue;

      const distHoriz = step * passo;
      if (distHoriz < PATH_VOO_DIST_MIN) continue;

      const zCruise = Math.max(zA, zLand) + 1.25;
      if (!clearanceVoo(cx, cy, zA, nx, ny, zLand, zCruise, dx, dy, step)) {
        continue;
      }

      const key = chaveCelula(nx, ny);
      if (jaTem.has(key)) continue;

      const dist3 = Math.hypot(distHoriz, zLand - zA);
      const custo = (dist3 / PATH_VOO_VEL + 0.2) * PATH_VOO_CUSTO_MUL;
      lista.push(key, custo, TIPO_VOO);
      jaTem.add(key);
    }
  }
}

function clearanceVoo(sx, sy, zA, lx, ly, zLand, zCruise, dx, dy, step) {
  for (let t = 1; t < step; t++) {
    const fx = sx + dx * t;
    const fy = sy + dy * t;
    const zTerreno = alturaEm(fx, fy);
    if (zTerreno <= 0) continue;
    const f = t / step;
    const zPath =
      f < 0.5
        ? zA + (zCruise - zA) * (f * 2)
        : zCruise + (zLand - zCruise) * ((f - 0.5) * 2);
    if (zTerreno >= zPath - 0.15) return false;
  }
  return true;
}

export function paraCadaVizinho(grade, key, fn) {
  const arr = grade.edges.get(key);
  if (!arr) return;
  for (let i = 0; i < arr.length; i += 3) {
    fn(arr[i] | 0, arr[i + 1], arr[i + 2] | 0);
  }
}
