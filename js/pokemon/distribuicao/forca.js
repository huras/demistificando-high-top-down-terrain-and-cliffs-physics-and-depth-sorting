/**
 * Nível selvagem por distância de civilização (áreas do grafo Kanto).
 * Espelha o fallback do WildStrengthMap do Pokemon AI.
 */
import {
  AREA_KANTO,
  EXTENSAO_KANTO,
  LADO_KANTO,
  zonaEm,
} from "../../mundo/regiao/grafoKanto.js";

const INF = 65535;
export const TILES_POR_NIVEL = 12;
const NIVEL_MIN = 2;
export const NIVEL_MAX = 45;

const ALPHA_CALOR = 0.58;

/** @type {Uint16Array | null} */
let hops = null;

/** @type {string[] | null} */
let lutCalor = null;

function garantirHops() {
  if (hops) return hops;
  const n = LADO_KANTO * LADO_KANTO;
  hops = new Uint16Array(n);
  hops.fill(INF);
  const fila = new Uint16Array(n);
  let cabeça = 0;
  let cauda = 0;

  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonaEm(ax, ay);
      if (zona?.tipo !== "cidade") continue;
      const i = ay * LADO_KANTO + ax;
      hops[i] = 0;
      fila[cauda++] = i;
    }
  }

  while (cabeça < cauda) {
    const i = fila[cabeça++];
    const ax = i % LADO_KANTO;
    const ay = (i / LADO_KANTO) | 0;
    const d = hops[i] + 1;
    const vizinhos = [
      [ax - 1, ay],
      [ax + 1, ay],
      [ax, ay - 1],
      [ax, ay + 1],
    ];
    for (let v = 0; v < 4; v++) {
      const nx = vizinhos[v][0];
      const ny = vizinhos[v][1];
      if (nx < 0 || ny < 0 || nx >= LADO_KANTO || ny >= LADO_KANTO) continue;
      const j = ny * LADO_KANTO + nx;
      if (d >= hops[j]) continue;
      hops[j] = d;
      fila[cauda++] = j;
    }
  }
  return hops;
}

function nivelDeTileDist(tileDist) {
  if (!Number.isFinite(tileDist) || tileDist >= INF) return NIVEL_MAX;
  if (tileDist <= 0) return 0;
  return Math.max(1, Math.min(NIVEL_MAX, 1 + Math.floor(tileDist / TILES_POR_NIVEL)));
}

function tileDistEm(wx, wy) {
  if (wx < 0 || wy < 0 || wx >= EXTENSAO_KANTO || wy >= EXTENSAO_KANTO) {
    return INF;
  }
  const tabela = garantirHops();
  const ax = (wx / AREA_KANTO) | 0;
  const ay = (wy / AREA_KANTO) | 0;
  const h = tabela[ay * LADO_KANTO + ax];
  if (h === 0) return 0;
  if (h >= INF) return INF;
  const lx = wx - ax * AREA_KANTO;
  const ly = wy - ay * AREA_KANTO;
  const local = Math.hypot(lx - AREA_KANTO * 0.5, ly - AREA_KANTO * 0.5);
  return h * AREA_KANTO + local;
}

/** Nível de encontro em (wx, wy). Cidade → 0 no mapa; spawn usa mínimo 2. */
export function nivelEm(wx, wy) {
  const dist = tileDistEm(wx, wy);
  if (dist === 0) return NIVEL_MIN;
  const n = nivelDeTileDist(dist);
  return Math.max(NIVEL_MIN, n);
}

/** Nível no centro da área. Cidade → 0 (tinta fria do heat map). */
export function nivelNaArea(ax, ay) {
  const a = ax | 0;
  const b = ay | 0;
  if (a < 0 || b < 0 || a >= LADO_KANTO || b >= LADO_KANTO) return NIVEL_MAX;
  const tabela = garantirHops();
  if (tabela[b * LADO_KANTO + a] === 0) return 0;
  return nivelDeTileDist(tileDistEm(a * AREA_KANTO + AREA_KANTO * 0.5, b * AREA_KANTO + AREA_KANTO * 0.5));
}

/** Faixa min–max amostrando centro + 4 cantos. Cidade → {0,0}. */
export function faixaNivelArea(ax, ay) {
  const a = ax | 0;
  const b = ay | 0;
  if (a < 0 || b < 0 || a >= LADO_KANTO || b >= LADO_KANTO) {
    return { min: NIVEL_MAX, max: NIVEL_MAX };
  }
  const tabela = garantirHops();
  if (tabela[b * LADO_KANTO + a] === 0) return { min: 0, max: 0 };

  const x0 = a * AREA_KANTO + 0.5;
  const y0 = b * AREA_KANTO + 0.5;
  const x1 = (a + 1) * AREA_KANTO - 0.5;
  const y1 = (b + 1) * AREA_KANTO - 0.5;
  const cx = a * AREA_KANTO + AREA_KANTO * 0.5;
  const cy = b * AREA_KANTO + AREA_KANTO * 0.5;
  const pts = [
    [cx, cy],
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ];
  let min = NIVEL_MAX;
  let max = 0;
  for (let i = 0; i < pts.length; i++) {
    const n = nivelDeTileDist(tileDistEm(pts[i][0], pts[i][1]));
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return { min, max };
}

function hslaDeNivel(nivel, alpha) {
  if (nivel <= 0) {
    return `hsla(210, 18%, 42%, ${alpha * 0.35})`;
  }
  const t = Math.max(0, Math.min(1, (nivel - 1) / Math.max(1, NIVEL_MAX - 1)));
  const hue = 128 * (1 - t);
  const sat = 62 + t * 18;
  const light = 48 - t * 10;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}

function garantirLut() {
  if (lutCalor) return lutCalor;
  lutCalor = new Array(NIVEL_MAX + 1);
  for (let n = 0; n <= NIVEL_MAX; n++) {
    lutCalor[n] = hslaDeNivel(n, ALPHA_CALOR);
  }
  return lutCalor;
}

/** Cor HSLA do heat map. Alpha padrão 0.58; fora do padrão recalcula. */
export function corCalor(nivel, alpha = ALPHA_CALOR) {
  const n = Math.max(0, Math.min(NIVEL_MAX, nivel | 0));
  if (alpha === ALPHA_CALOR) return garantirLut()[n];
  return hslaDeNivel(n, alpha);
}
