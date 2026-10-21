/**
 * Áreas lógicas de Kanto (32×32). Identidade geográfica estável:
 * clima, encontros e paleta visual. Lookup só por índice de célula.
 */
import { EXTENSAO_KANTO, ORIGEM_KANTO_X, ORIGEM_KANTO_Y } from "../bounds.js";
import {
  RELEVO_FUNDO,
  RELEVO_MONTANHA,
  RELEVO_RASO,
  relevoEm,
} from "./kantoRelevo.js";

export const LADO_AREAS = 32;
export const CELULA_AREA = 128;

/** @typedef {{ id: string, nome: string, precip: string, paleta: readonly string[], encontro: string, berry: string, camada: "terra"|"mar" }} AreaLogica */

/** @type {readonly AreaLogica[]} */
export const AREAS_KANTO = Object.freeze([
  Object.freeze({
    id: "kanto-southwest",
    nome: "Sudoeste temperado",
    precip: "chuva",
    paleta: Object.freeze(["light-grass", "autum-forest", "light-grass"]),
    encontro: "light-grass",
    berry: "light-grass",
    camada: "terra",
  }),
  Object.freeze({
    id: "viridian-forest",
    nome: "Floresta de Viridian",
    precip: "chuva",
    paleta: Object.freeze(["lush-grass", "lush-grass", "autum-forest"]),
    encontro: "lush-grass",
    berry: "lush-grass",
    camada: "terra",
  }),
  Object.freeze({
    id: "pewter-massif",
    nome: "Maciço de Pewter",
    precip: "chuva",
    paleta: Object.freeze(["pewter-massif", "stone", "pewter-massif"]),
    encontro: "pewter-massif",
    berry: "pewter-massif",
    camada: "terra",
  }),
  Object.freeze({
    id: "mt-moon",
    nome: "Monte Lua",
    precip: "chuva",
    paleta: Object.freeze(["moon-ridge", "moon-ridge", "pewter-massif"]),
    encontro: "moon-ridge",
    berry: "moon-ridge",
    camada: "terra",
  }),
  Object.freeze({
    id: "central-plains",
    nome: "Planície central",
    precip: "chuva",
    paleta: Object.freeze(["light-grass", "savanna", "light-grass", "autum-forest"]),
    encontro: "light-grass",
    berry: "light-grass",
    camada: "terra",
  }),
  Object.freeze({
    id: "rock-tunnel-hills",
    nome: "Colinas do Túnel",
    precip: "chuva",
    paleta: Object.freeze(["tunnel-hills", "tunnel-hills", "stone"]),
    encontro: "tunnel-hills",
    berry: "tunnel-hills",
    camada: "terra",
  }),
  Object.freeze({
    id: "lavender-haunt",
    nome: "Bosque de Lavender",
    precip: "nevoa",
    paleta: Object.freeze(["ghost-forest", "ghost-forest", "autum-forest"]),
    encontro: "ghost-forest",
    berry: "ghost-forest",
    camada: "terra",
  }),
  Object.freeze({
    id: "vermilion-coast",
    nome: "Costa de Vermilion",
    precip: "chuva",
    paleta: Object.freeze(["light-grass", "savanna", "light-grass"]),
    encontro: "light-grass",
    berry: "light-grass",
    camada: "terra",
  }),
  Object.freeze({
    id: "fuchsia-marsh",
    nome: "Pantanal de Fuchsia",
    precip: "nevoa",
    paleta: Object.freeze(["marsh", "marsh", "lush-grass"]),
    encontro: "marsh",
    berry: "marsh",
    camada: "terra",
  }),
  Object.freeze({
    id: "cinnabar-amber",
    nome: "Ilha Âmbar",
    precip: "areia",
    paleta: Object.freeze(["amber-rock", "amber-rock", "savanna"]),
    encontro: "amber-rock",
    berry: "amber-rock",
    camada: "terra",
  }),
  Object.freeze({
    id: "kanto-shelf",
    nome: "Plataforma marinha",
    precip: "chuva",
    paleta: Object.freeze(["sandy-shelf"]),
    encontro: "sandy-shelf",
    berry: "dirty-sand",
    camada: "mar",
  }),
  Object.freeze({
    id: "north-kelp",
    nome: "Kelp do norte",
    precip: "chuva",
    paleta: Object.freeze(["kelp-forest"]),
    encontro: "kelp-forest",
    berry: "dirty-sand",
    camada: "mar",
  }),
  Object.freeze({
    id: "west-trench",
    nome: "Fossa oeste",
    precip: "chuva",
    paleta: Object.freeze(["deep-trench"]),
    encontro: "deep-trench",
    berry: "dirty-sand",
    camada: "mar",
  }),
]);

const POR_ID = new Map(AREAS_KANTO.map((a) => [a.id, a]));

export const AREA_IDX = Object.freeze({
  SOUTHWEST: 0,
  VIRIDIAN: 1,
  PEWTER: 2,
  MOON: 3,
  CENTRAL: 4,
  TUNNEL: 5,
  LAVENDER: 6,
  VERMILION: 7,
  FUCHSIA: 8,
  CINNABAR: 9,
  SHELF: 10,
  KELP: 11,
  TRENCH: 12,
});

function indice(ax, ay) {
  return ay * LADO_AREAS + ax;
}

function dentro(ax, ay) {
  return ax >= 0 && ay >= 0 && ax < LADO_AREAS && ay < LADO_AREAS;
}

function ehMar(tipo) {
  return tipo === RELEVO_RASO || tipo === RELEVO_FUNDO;
}

function pintarDisco(mapa, cx, cy, raio, idx) {
  const r2 = raio * raio;
  const minX = Math.max(0, Math.floor(cx - raio));
  const maxX = Math.min(LADO_AREAS - 1, Math.ceil(cx + raio));
  const minY = Math.max(0, Math.floor(cy - raio));
  const maxY = Math.min(LADO_AREAS - 1, Math.ceil(cy + raio));
  for (let ay = minY; ay <= maxY; ay++) {
    for (let ax = minX; ax <= maxX; ax++) {
      const dx = ax - cx;
      const dy = ay - cy;
      if (dx * dx + dy * dy <= r2) mapa[indice(ax, ay)] = idx;
    }
  }
}

function pintarRet(mapa, x0, y0, x1, y1, idx) {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(LADO_AREAS - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(LADO_AREAS - 1, Math.max(y0, y1));
  for (let ay = minY; ay <= maxY; ay++) {
    for (let ax = minX; ax <= maxX; ax++) mapa[indice(ax, ay)] = idx;
  }
}

function terraPadrao(ax, ay) {
  if (ay >= 23 && ax >= 7 && ax <= 14) return AREA_IDX.CINNABAR;
  if (ay >= 21 && ax >= 16) return AREA_IDX.FUCHSIA;
  if (ay >= 15 && ax >= 16) return AREA_IDX.VERMILION;
  if (ay >= 14 && ax <= 14) return AREA_IDX.SOUTHWEST;
  if (ay <= 6 && ax <= 12) return AREA_IDX.PEWTER;
  if (ay <= 7 && ax >= 13 && ax <= 19) return AREA_IDX.MOON;
  if (ay <= 10 && ax >= 22) return AREA_IDX.TUNNEL;
  if (ax >= 24 && ay >= 9 && ay <= 13) return AREA_IDX.LAVENDER;
  if (ax <= 13 && ay >= 7 && ay <= 20) return AREA_IDX.SOUTHWEST;
  return AREA_IDX.CENTRAL;
}

function montarMapa() {
  const mapa = new Uint8Array(LADO_AREAS * LADO_AREAS);

  for (let ay = 0; ay < LADO_AREAS; ay++) {
    for (let ax = 0; ax < LADO_AREAS; ax++) {
      const rel = relevoEm(ax, ay);
      mapa[indice(ax, ay)] = ehMar(rel) ? AREA_IDX.SHELF : terraPadrao(ax, ay);
    }
  }

  // Regiões largas (terra). Ordem: geral → específico.
  pintarRet(mapa, 6, 11, 14, 20, AREA_IDX.SOUTHWEST);
  pintarRet(mapa, 14, 5, 24, 14, AREA_IDX.CENTRAL);
  pintarRet(mapa, 16, 15, 27, 20, AREA_IDX.VERMILION);
  pintarRet(mapa, 16, 21, 27, 27, AREA_IDX.FUCHSIA);
  pintarRet(mapa, 7, 23, 14, 28, AREA_IDX.CINNABAR);
  pintarRet(mapa, 6, 3, 12, 6, AREA_IDX.PEWTER);
  pintarRet(mapa, 13, 3, 19, 7, AREA_IDX.MOON);
  pintarRet(mapa, 22, 4, 28, 10, AREA_IDX.TUNNEL);
  pintarRet(mapa, 24, 9, 28, 13, AREA_IDX.LAVENDER);

  // Floresta de Viridian (3×3 densa + corredor da Rota 2).
  pintarRet(mapa, 9, 7, 11, 9, AREA_IDX.VIRIDIAN);
  mapa[indice(10, 10)] = AREA_IDX.VIRIDIAN;
  mapa[indice(10, 6)] = AREA_IDX.VIRIDIAN;

  // Marcos pontuais (reforço lore).
  pintarDisco(mapa, 16, 5, 2.2, AREA_IDX.MOON);
  pintarDisco(mapa, 25, 7.5, 2.0, AREA_IDX.TUNNEL);
  pintarDisco(mapa, 26, 11, 1.6, AREA_IDX.LAVENDER);
  pintarDisco(mapa, 20, 24, 2.2, AREA_IDX.FUCHSIA);
  pintarDisco(mapa, 10, 26, 1.8, AREA_IDX.CINNABAR);
  pintarDisco(mapa, 10, 5, 1.4, AREA_IDX.PEWTER);

  // Mar: landmarks sobrescrevem a plataforma.
  for (let ay = 0; ay < LADO_AREAS; ay++) {
    for (let ax = 0; ax < LADO_AREAS; ax++) {
      if (!ehMar(relevoEm(ax, ay))) continue;
      const dxK = ax - 25;
      const dyK = ay - 2;
      if (dxK * dxK + dyK * dyK <= 3.2 * 3.2) {
        mapa[indice(ax, ay)] = AREA_IDX.KELP;
        continue;
      }
      const dxT = ax - 4;
      const dyT = ay - 18;
      if (dxT * dxT + dyT * dyT <= 3.6 * 3.6) {
        mapa[indice(ax, ay)] = AREA_IDX.TRENCH;
        continue;
      }
      mapa[indice(ax, ay)] = AREA_IDX.SHELF;
    }
  }

  // Montanha do relevo reforça maciços sem invadir floresta/mar.
  for (let ay = 0; ay < LADO_AREAS; ay++) {
    for (let ax = 0; ax < LADO_AREAS; ax++) {
      if (relevoEm(ax, ay) !== RELEVO_MONTANHA) continue;
      const atual = mapa[indice(ax, ay)];
      if (atual === AREA_IDX.VIRIDIAN) continue;
      if (atual === AREA_IDX.SHELF || atual === AREA_IDX.KELP || atual === AREA_IDX.TRENCH) continue;
      if (ax <= 12 && ay <= 7) mapa[indice(ax, ay)] = AREA_IDX.PEWTER;
      else if (ax >= 13 && ax <= 19 && ay <= 7) mapa[indice(ax, ay)] = AREA_IDX.MOON;
      else if (ax >= 22 && ay <= 10) mapa[indice(ax, ay)] = AREA_IDX.TUNNEL;
    }
  }

  // Cidades herdam a área do entorno (já pintada); garante célula da cidade.
  const cidades = [
    [10, 17, AREA_IDX.SOUTHWEST],
    [10, 11, AREA_IDX.SOUTHWEST],
    [10, 5, AREA_IDX.PEWTER],
    [22, 5, AREA_IDX.CENTRAL],
    [16, 11, AREA_IDX.CENTRAL],
    [20, 11, AREA_IDX.CENTRAL],
    [26, 11, AREA_IDX.LAVENDER],
    [20, 17, AREA_IDX.VERMILION],
    [20, 24, AREA_IDX.FUCHSIA],
    [10, 26, AREA_IDX.CINNABAR],
  ];
  for (let i = 0; i < cidades.length; i++) {
    const [ax, ay, idx] = cidades[i];
    if (dentro(ax, ay) && !ehMar(relevoEm(ax, ay))) mapa[indice(ax, ay)] = idx;
  }

  return mapa;
}

const MAPA = montarMapa();

export function areaPorIndice(idx) {
  const i = idx | 0;
  if (i < 0 || i >= AREAS_KANTO.length) return AREAS_KANTO[AREA_IDX.CENTRAL];
  return AREAS_KANTO[i];
}

export function areaPorId(id) {
  return POR_ID.get(id) || null;
}

export function indiceAreaEm(ax, ay) {
  if (!dentro(ax | 0, ay | 0)) return -1;
  return MAPA[indice(ax | 0, ay | 0)];
}

export function areaEm(ax, ay) {
  const idx = indiceAreaEm(ax, ay);
  if (idx < 0) return null;
  return areaPorIndice(idx);
}

export function areaIdEm(ax, ay) {
  return areaEm(ax, ay)?.id || null;
}

/** World coords → área lógica (null fora da ilha). */
export function areaNoMundo(wx, wy) {
  const lx = wx - ORIGEM_KANTO_X;
  const ly = wy - ORIGEM_KANTO_Y;
  if (lx < 0 || ly < 0 || lx >= EXTENSAO_KANTO || ly >= EXTENSAO_KANTO) return null;
  return areaEm((lx / CELULA_AREA) | 0, (ly / CELULA_AREA) | 0);
}

export function areaIdNoMundo(wx, wy) {
  return areaNoMundo(wx, wy)?.id || null;
}

/**
 * Vizinho de área mais próximo da borda local (lx,ly em 0..127).
 * Usado só para soft blend visual — O(1), quatro lados.
 */
export function vizinhoAreaBorda(ax, ay, lx, ly) {
  const area = areaEm(ax, ay);
  if (!area) return null;
  const FAIXA = 48;
  const distN = ly;
  const distS = CELULA_AREA - 1 - ly;
  const distW = lx;
  const distE = CELULA_AREA - 1 - lx;
  let melhor = distN;
  let nx = ax;
  let ny = ay - 1;
  if (distS < melhor) {
    melhor = distS;
    nx = ax;
    ny = ay + 1;
  }
  if (distW < melhor) {
    melhor = distW;
    nx = ax - 1;
    ny = ay;
  }
  if (distE < melhor) {
    melhor = distE;
    nx = ax + 1;
    ny = ay;
  }
  if (melhor >= FAIXA) return null;
  const viz = areaEm(nx, ny);
  if (!viz || viz.id === area.id) return null;
  const t = melhor / FAIXA;
  const peso = (1 - t) * (1 - t) * (3 - 2 * (1 - t));
  return { area, vizinha: viz, peso, faixa: FAIXA };
}
