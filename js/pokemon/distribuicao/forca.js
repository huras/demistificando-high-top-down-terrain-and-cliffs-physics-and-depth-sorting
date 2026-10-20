/**
 * Nível selvagem por distância de civilização (áreas do grafo Kanto).
 * Fora da ilha: continua a métrica a partir da borda (não INF imediato).
 */
import {
  deLocalKanto,
  distAssinadaKanto,
  paraLocalKanto,
} from "../../mundo/bounds.js";
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

function hopNaBorda(lx, ly) {
  const cx = Math.max(0, Math.min(EXTENSAO_KANTO - 0.01, lx));
  const cy = Math.max(0, Math.min(EXTENSAO_KANTO - 0.01, ly));
  const ax = (cx / AREA_KANTO) | 0;
  const ay = (cy / AREA_KANTO) | 0;
  const tabela = garantirHops();
  const h = tabela[ay * LADO_KANTO + ax];
  if (h >= INF) return LADO_KANTO;
  return h;
}

/** Distância em blocos a partir de cidades. wx/wy mundiais. */
function tileDistEm(wx, wy) {
  const fora = distAssinadaKanto(wx, wy);
  const local = paraLocalKanto(wx, wy);

  if (fora > 0) {
    const hop = hopNaBorda(local.x, local.y);
    return hop * AREA_KANTO + AREA_KANTO * 0.5 + fora;
  }

  const tabela = garantirHops();
  const ax = (local.x / AREA_KANTO) | 0;
  const ay = (local.y / AREA_KANTO) | 0;
  if (ax < 0 || ay < 0 || ax >= LADO_KANTO || ay >= LADO_KANTO) {
    return hopNaBorda(local.x, local.y) * AREA_KANTO + AREA_KANTO * 0.5;
  }
  const h = tabela[ay * LADO_KANTO + ax];
  if (h === 0) return 0;
  if (h >= INF) return INF;
  const lx = local.x - ax * AREA_KANTO;
  const ly = local.y - ay * AREA_KANTO;
  const noCentro = Math.hypot(lx - AREA_KANTO * 0.5, ly - AREA_KANTO * 0.5);
  return h * AREA_KANTO + noCentro;
}

/** Nível de encontro em (wx, wy). Cidade → 0 no mapa; spawn usa mínimo 2. */
export function nivelEm(wx, wy) {
  const dist = tileDistEm(wx, wy);
  if (dist === 0) return NIVEL_MIN;
  const n = nivelDeTileDist(dist);
  return Math.max(NIVEL_MIN, n);
}

/** Nível no centro da área (ax/ay da grade Kanto). Cidade → 0. */
export function nivelNaArea(ax, ay) {
  const a = ax | 0;
  const b = ay | 0;
  if (a < 0 || b < 0 || a >= LADO_KANTO || b >= LADO_KANTO) return NIVEL_MAX;
  const tabela = garantirHops();
  if (tabela[b * LADO_KANTO + a] === 0) return 0;
  const p = deLocalKanto(a * AREA_KANTO + AREA_KANTO * 0.5, b * AREA_KANTO + AREA_KANTO * 0.5);
  return nivelDeTileDist(tileDistEm(p.x, p.y));
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

  const ptsLocais = [
    [a * AREA_KANTO + AREA_KANTO * 0.5, b * AREA_KANTO + AREA_KANTO * 0.5],
    [a * AREA_KANTO + 0.5, b * AREA_KANTO + 0.5],
    [(a + 1) * AREA_KANTO - 0.5, b * AREA_KANTO + 0.5],
    [a * AREA_KANTO + 0.5, (b + 1) * AREA_KANTO - 0.5],
    [(a + 1) * AREA_KANTO - 0.5, (b + 1) * AREA_KANTO - 0.5],
  ];
  let min = NIVEL_MAX;
  let max = 0;
  for (let i = 0; i < ptsLocais.length; i++) {
    const p = deLocalKanto(ptsLocais[i][0], ptsLocais[i][1]);
    const n = nivelDeTileDist(tileDistEm(p.x, p.y));
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
