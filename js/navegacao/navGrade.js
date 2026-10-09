import {
  ASA_DELTA_DESCIDA,
  ASA_DELTA_VEL_MUL,
  ESCALADA_VEL,
  NAV_MAX_PISOS,
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
import { listarPisosWalkable } from "../fisica/colisao.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";
import {
  alturasLocomocao,
  linksCachoeira,
  multiplicadorAgua,
} from "./aguaNav.js";
import { dentroDoMapa } from "../mundo/altura.js";
import { obterAabbCarregado, obterBloco } from "../mundo/voxel/storeMundo.js";
import { ehSolido } from "../mundo/voxel/tiposBloco.js";

const SQRT2 = Math.SQRT2;
const KEY_OFFSET = 32768;
const KEY_Z_MUL = 4294967296;

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
export const TIPO_NADO = 5;

const cache = new Map();
/** Centro da última grade (mundo). */
let navCentro = { cx: 0, cy: 0 };
let navRaioAtivo = 28;
/** Construção fatiada — uma grade por vez, sem travar o frame. */
let trabalhoNav = null;
const ORCAMENTO_NAV_MS = 2;

/** Chave 3D: (cx, cy, zFloor). */
export function chaveCelula(cx, cy, z = 0) {
  const xy =
    (((cy + KEY_OFFSET) & 0xffff) << 16) | ((cx + KEY_OFFSET) & 0xffff);
  return ((z | 0) >>> 0) * KEY_Z_MUL + (xy >>> 0);
}

export function celulaDeChave(key) {
  const z = (key / KEY_Z_MUL) | 0;
  let xy = key - z * KEY_Z_MUL;
  if (xy < 0) xy += KEY_Z_MUL;
  const cx = (xy & 0xffff) - KEY_OFFSET;
  const cy = ((xy / 65536) | 0) - KEY_OFFSET;
  return { cx: cx | 0, cy: cy | 0, z: z | 0 };
}

/** Piso de locomoção mais próximo de elev (nado na superfície, senão o sólido). */
export function pisoMaisProximo(cx, cy, elev, perfil = null) {
  const brutos = listarPisosWalkable(cx, cy, NAV_MAX_PISOS);
  const pisos = perfil
    ? alturasLocomocao(brutos, colunaAgua(cx, cy), perfil)
    : brutos;
  if (!pisos.length) return 0;
  let best = pisos[0];
  let bestD = Math.abs(best - elev);
  for (let i = 1; i < pisos.length; i++) {
    const d = Math.abs(pisos[i] - elev);
    if (d < bestD) {
      bestD = d;
      best = pisos[i];
    }
  }
  return best;
}

export function invalidarNavCache(_aabb = null) {
  cache.clear();
  trabalhoNav = null;
}

function caixaCobre(box, ax, ay, gx, gy) {
  return (
    !!box &&
    ax >= box.x0 &&
    ax <= box.x1 &&
    ay >= box.y0 &&
    ay <= box.y1 &&
    gx >= box.x0 &&
    gx <= box.x1 &&
    gy >= box.y0 &&
    gy <= box.y1
  );
}

function limitesGrade(centroX, centroY, raio) {
  const loaded = obterAabbCarregado();
  return {
    x0: Math.max(loaded.x0 | 0, centroX - raio),
    y0: Math.max(loaded.y0 | 0, centroY - raio),
    x1: Math.min(loaded.x1 | 0, centroX + raio),
    y1: Math.min(loaded.y1 | 0, centroY + raio),
  };
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

  const g = cache.get(perfil.id);
  if (caixaCobre(g, aCx, aCy, gCx, gCy)) return g;

  const midX = ((aCx + gCx) / 2) | 0;
  const midY = ((aCy + gCy) / 2) | 0;
  const dist = Math.hypot(gCx - aCx, gCy - aCy);
  const raio = Math.min(48, Math.max(NAV_RAIO, Math.ceil(dist * 0.5) + 12));
  const box = limitesGrade(midX, midY, raio);
  if (
    trabalhoNav &&
    trabalhoNav.perfilId === perfil.id &&
    caixaCobre(trabalhoNav, aCx, aCy, gCx, gCy)
  ) {
    return null;
  }

  navCentro.cx = midX;
  navCentro.cy = midY;
  navRaioAtivo = raio;
  trabalhoNav = {
    perfilId: perfil.id,
    ...box,
    gen: construirGrade(perfil, midX, midY, raio),
  };
  return null;
}

/** Avança a grade suja por no máximo alguns ms. O A* espera ela ficar pronta. */
export function tickNavGrade(orcamentoMs = ORCAMENTO_NAV_MS) {
  if (!trabalhoNav) return;
  const t0 = performance.now();
  let passo = trabalhoNav.gen.next();
  while (!passo.done && performance.now() - t0 < orcamentoMs) {
    passo = trabalhoNav.gen.next();
  }
  if (!passo.done) return;
  cache.set(trabalhoNav.perfilId, passo.value);
  trabalhoNav = null;
}

function quedaMaxAndar(perfil) {
  return perfil.quedaMaxAndar ?? perfil.quedaMax ?? Infinity;
}

function topoColuna(pisos) {
  return pisos.length ? pisos[pisos.length - 1] : 0;
}

/** Célula na beira de precipício — única que precisa de NavLink glide. */
function temBeiraGlide(cx, cy, zA, pisosDe) {
  if (zA < PATH_GLIDE_QUEDA_MIN + 1) return false;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const pisos = pisosDe(cx + dx, cy + dy);
    const zViz = topoColuna(pisos);
    if (!pisos.length || zA - zViz >= PATH_GLIDE_QUEDA_MIN) return true;
  }
  return false;
}

function* construirGrade(perfil, centroX, centroY, raio) {
  const { x0, y0, x1, y1 } = limitesGrade(centroX, centroY, raio);

  /** @type {Map<number, number[]>} */
  const edges = new Map();
  /** Cache local de pisos e de água no AABB */
  const cachePisos = new Map();
  const cacheAgua = new Map();
  function aguaDe(cx, cy) {
    const k = ((cy + KEY_OFFSET) << 16) | (cx + KEY_OFFSET);
    let a = cacheAgua.get(k);
    if (!a) {
      a = colunaAgua(cx, cy);
      cacheAgua.set(k, a);
    }
    return a;
  }
  function pisosDe(cx, cy) {
    const k = ((cy + KEY_OFFSET) << 16) | (cx + KEY_OFFSET);
    let p = cachePisos.get(k);
    if (!p) {
      p = alturasLocomocao(
        listarPisosWalkable(cx, cy, NAV_MAX_PISOS),
        aguaDe(cx, cy),
        perfil,
      );
      cachePisos.set(k, p);
    }
    return p;
  }

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!dentroDoMapa(cx, cy)) continue;
      const pisosA = pisosDe(cx, cy);
      if (!pisosA.length) {
        yield;
        continue;
      }

      for (const zA of pisosA) {
        const key = chaveCelula(cx, cy, zA);
        const lista = [];

        for (const [dx, dy, diag] of DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!dentroDoMapa(nx, ny)) continue;
          const pisosB = pisosDe(nx, ny);
          if (!pisosB.length) continue;
          if (diag && !cantoDiagonalLivre(cx, cy, zA, nx, ny, pisosDe)) {
            continue;
          }
          for (const zB of pisosB) {
            const edge = classificarAresta(zA, zB, perfil, diag);
            if (!edge) continue;
            const mult = multiplicadorAgua(
              aguaDe(cx, cy),
              aguaDe(nx, ny),
              dx,
              dy,
              perfil,
            );
            if (mult == null) continue;
            edge.custo *= mult;
            lista.push(chaveCelula(nx, ny, zB), edge.custo, edge.tipo);
          }
        }

        const jaAgua = new Set();
        for (let i = 0; i < lista.length; i += 3) jaAgua.add(lista[i]);
        for (const link of linksCachoeira(
          cx,
          cy,
          zA,
          perfil,
          aguaDe,
          pisosDe,
        )) {
          const key = chaveCelula(link.cx, link.cy, link.z);
          if (jaAgua.has(key)) continue;
          lista.push(
            key,
            link.custo,
            link.tipo === "nado" ? TIPO_NADO : TIPO_CLIMB,
          );
          jaAgua.add(key);
        }

        // Shaft vertical na mesma coluna (climb curto entre andares)
        if (perfil.podeEscalar) {
          for (const zB of pisosA) {
            if (zB <= zA) continue;
            const dz = zB - zA;
            if (dz < 2 || dz > 12) continue;
            const custo =
              PATH_CUSTO_ESCALADA + dz / Math.max(0.25, ESCALADA_VEL);
            lista.push(chaveCelula(cx, cy, zB), custo, TIPO_CLIMB);
          }
        }

        if (perfil.podePlanar && temBeiraGlide(cx, cy, zA, pisosDe)) {
          adicionarGlideRays(lista, cx, cy, zA, pisosDe);
        }
        if (perfil.podeVoar && temBeiraGlide(cx, cy, zA, pisosDe)) {
          adicionarVooRays(lista, cx, cy, zA, pisosDe);
        }

        edges.set(key, lista);
        yield;
      }
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

function cantoDiagonalLivre(cx, cy, zA, nx, ny, pisosDe) {
  const teto = zA + 1;
  const px = pisosDe(nx, cy);
  const py = pisosDe(cx, ny);
  for (const z of px) {
    if (z > teto && z <= zA + 3) return false;
  }
  for (const z of py) {
    if (z > teto && z <= zA + 3) return false;
  }
  // Parede sólida no canto na faixa do corpo
  if (ehSolido(obterBloco(nx, cy, Math.floor(zA)))) return false;
  if (ehSolido(obterBloco(cx, ny, Math.floor(zA)))) return false;
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

function adicionarGlideRays(lista, cx, cy, zA, pisosDe) {
  const velGlide = VELOCIDADE_MAX * ASA_DELTA_VEL_MUL * PATH_GLIDE_ALCANCE_MUL;
  const zLaunch = zA + PATH_GLIDE_PULO_BONUS;
  const jaTem = new Set();
  for (let i = 0; i < lista.length; i += 3) jaTem.add(lista[i]);

  for (const [dx, dy, diag] of DIRS) {
    const passo = diag ? SQRT2 : 1;
    for (let step = 1; step <= PATH_GLIDE_ALCANCE_MAX; step++) {
      const nx = cx + dx * step;
      const ny = cy + dy * step;
      if (!dentroDoMapa(nx, ny)) break;

      const pisos = pisosDe(nx, ny);
      if (!pisos.length) continue;
      // Pouso: piso ≤ zA mais alto possível
      let zLand = 0;
      for (const z of pisos) {
        if (z <= zA && z > zLand) zLand = z;
      }
      if (zLand <= 0) continue;
      if (zLand > zA) break;

      const distHoriz = step * passo;
      if (distHoriz < PATH_GLIDE_DIST_MIN) continue;

      const quedaChao = zA - zLand;
      const picoAPico = quedaChao === 0 && distHoriz >= PATH_GLIDE_PICO_DIST_MIN;
      const quedaOk = quedaChao >= PATH_GLIDE_QUEDA_MIN;
      if (!quedaOk && !picoAPico) continue;
      if (picoAPico && !vaoTemQuedaNoRay(cx, cy, zA, dx, dy, step, pisosDe)) {
        continue;
      }

      const dzLaunch = zLaunch - zLand;
      const alcanceMax = (dzLaunch / ASA_DELTA_DESCIDA) * velGlide;
      if (distHoriz > alcanceMax) continue;
      if (!clearanceGlide(cx, cy, zLaunch, nx, ny, zLand, dx, dy, step, pisosDe)) {
        continue;
      }

      const key = chaveCelula(nx, ny, zLand);
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

function clearanceGlide(sx, sy, zLaunch, lx, ly, zLand, dx, dy, step, pisosDe) {
  for (let t = 1; t <= step; t++) {
    const fx = sx + dx * t;
    const fy = sy + dy * t;
    const pisos = pisosDe(fx, fy);
    const zTerreno = topoColuna(pisos);
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

function vaoTemQuedaNoRay(sx, sy, zA, dx, dy, step, pisosDe) {
  for (let t = 1; t < step; t++) {
    const zT = topoColuna(pisosDe(sx + dx * t, sy + dy * t));
    if (zT < zA) return true;
  }
  return false;
}

function adicionarVooRays(lista, cx, cy, zA, pisosDe) {
  const jaTem = new Set();
  for (let i = 0; i < lista.length; i += 3) jaTem.add(lista[i]);

  for (const [dx, dy, diag] of DIRS) {
    const passo = diag ? SQRT2 : 1;
    for (let step = 1; step <= PATH_VOO_ALCANCE_MAX; step++) {
      const nx = cx + dx * step;
      const ny = cy + dy * step;
      if (!dentroDoMapa(nx, ny)) break;

      const pisos = pisosDe(nx, ny);
      if (!pisos.length) continue;
      const zLand = topoColuna(pisos);

      const distHoriz = step * passo;
      if (distHoriz < PATH_VOO_DIST_MIN) continue;

      const zCruise = Math.max(zA, zLand) + 1.25;
      if (!clearanceVoo(cx, cy, zA, nx, ny, zLand, zCruise, dx, dy, step, pisosDe)) {
        continue;
      }

      const key = chaveCelula(nx, ny, zLand);
      if (jaTem.has(key)) continue;

      const dist3 = Math.hypot(distHoriz, zLand - zA);
      const custo = (dist3 / PATH_VOO_VEL + 0.2) * PATH_VOO_CUSTO_MUL;
      lista.push(key, custo, TIPO_VOO);
      jaTem.add(key);
    }
  }
}

function clearanceVoo(sx, sy, zA, lx, ly, zLand, zCruise, dx, dy, step, pisosDe) {
  for (let t = 1; t < step; t++) {
    const fx = sx + dx * t;
    const fy = sy + dy * t;
    const zTerreno = topoColuna(pisosDe(fx, fy));
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
    fn(arr[i], arr[i + 1], arr[i + 2] | 0);
  }
}
