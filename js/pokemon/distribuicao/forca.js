/**
 * Nível selvagem por distância de civilização (áreas do grafo Kanto).
 * Fora da ilha: continua a métrica a partir da borda — sem teto de nível.
 */
import {
  LADO_MUNDO,
  ORIGEM_KANTO_X,
  ORIGEM_KANTO_Y,
  deLocalKanto,
  distAssinadaKanto,
  dentroDoKanto,
  paraLocalKanto,
} from "../../mundo/bounds.js";
import {
  AREA_KANTO,
  EXTENSAO_KANTO,
  LADO_KANTO,
  zonaEm,
} from "../../mundo/regiao/grafoKanto.js";

const INF = 65535;
export const TILES_POR_NIVEL = 48;
const NIVEL_MIN = 2;

/** Célula do heatmap / labels (= área Kanto, 128 blocos). */
export const CELULA_FORCA = AREA_KANTO;
/** Grade mundo: 8192 / 128 = 64. */
export const GRADE_FORCA = (LADO_MUNDO / CELULA_FORCA) | 0;

/** Distância finita para células de hop inalcançáveis. */
const DIST_INF =
  LADO_KANTO * AREA_KANTO + Math.hypot(LADO_MUNDO, LADO_MUNDO);

const ALPHA_CALOR = 0.58;

/** Offset da grade Kanto na grade mundo (ORIGEM 2048 / 128 = 16). */
const OX_GRADE = (ORIGEM_KANTO_X / AREA_KANTO) | 0;
const OY_GRADE = (ORIGEM_KANTO_Y / AREA_KANTO) | 0;

/** @type {Uint16Array | null} */
let hops = null;

/** @type {number | null} */
let escalaMundo = null;

/** @type {Map<number, string[]>} */
const lutPorEscala = new Map();

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
  if (tileDist <= 0) return 0;
  const d =
    !Number.isFinite(tileDist) || tileDist >= INF ? DIST_INF : tileDist;
  return Math.max(1, 1 + Math.floor(d / TILES_POR_NIVEL));
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

/** Nível de encontro em (wx, wy). Cidade → mínimo 2 no spawn. */
export function nivelEm(wx, wy) {
  const dist = tileDistEm(wx, wy);
  if (dist === 0) return NIVEL_MIN;
  return Math.max(NIVEL_MIN, nivelDeTileDist(dist));
}

function celulaEhCidade(cx, cy) {
  const wx = cx * CELULA_FORCA + CELULA_FORCA * 0.5;
  const wy = cy * CELULA_FORCA + CELULA_FORCA * 0.5;
  if (!dentroDoKanto(wx, wy)) return false;
  const local = paraLocalKanto(wx, wy);
  const ax = (local.x / AREA_KANTO) | 0;
  const ay = (local.y / AREA_KANTO) | 0;
  const tabela = garantirHops();
  return tabela[ay * LADO_KANTO + ax] === 0;
}

/** Nível no centro da célula mundo (cx/cy na grade GRADE_FORCA). Cidade → 0. */
export function nivelNaCelulaMundo(cx, cy) {
  const a = cx | 0;
  const b = cy | 0;
  if (a < 0 || b < 0 || a >= GRADE_FORCA || b >= GRADE_FORCA) {
    return nivelDeTileDist(DIST_INF);
  }
  if (celulaEhCidade(a, b)) return 0;
  const wx = a * CELULA_FORCA + CELULA_FORCA * 0.5;
  const wy = b * CELULA_FORCA + CELULA_FORCA * 0.5;
  return nivelDeTileDist(tileDistEm(wx, wy));
}

/** Faixa min–max amostrando centro + 4 cantos da célula mundo. Cidade → {0,0}. */
export function faixaNivelCelulaMundo(cx, cy) {
  const a = cx | 0;
  const b = cy | 0;
  if (a < 0 || b < 0 || a >= GRADE_FORCA || b >= GRADE_FORCA) {
    const n = nivelDeTileDist(DIST_INF);
    return { min: n, max: n };
  }
  if (celulaEhCidade(a, b)) return { min: 0, max: 0 };

  const x0 = a * CELULA_FORCA;
  const y0 = b * CELULA_FORCA;
  const pts = [
    [x0 + CELULA_FORCA * 0.5, y0 + CELULA_FORCA * 0.5],
    [x0 + 0.5, y0 + 0.5],
    [x0 + CELULA_FORCA - 0.5, y0 + 0.5],
    [x0 + 0.5, y0 + CELULA_FORCA - 0.5],
    [x0 + CELULA_FORCA - 0.5, y0 + CELULA_FORCA - 0.5],
  ];
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < pts.length; i++) {
    const n = nivelDeTileDist(tileDistEm(pts[i][0], pts[i][1]));
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return { min, max };
}

/** Wrappers da grade Kanto → célula mundo. */
export function nivelNaArea(ax, ay) {
  return nivelNaCelulaMundo(OX_GRADE + (ax | 0), OY_GRADE + (ay | 0));
}

export function faixaNivelArea(ax, ay) {
  return faixaNivelCelulaMundo(OX_GRADE + (ax | 0), OY_GRADE + (ay | 0));
}

/**
 * Referência de cor: maior nível nos cantos/bordas do overworld.
 * Usado no bake e na legenda para contraste estável.
 */
export function nivelEscalaCalor() {
  if (escalaMundo != null) return escalaMundo;
  const pts = [
    [0.5, 0.5],
    [LADO_MUNDO - 0.5, 0.5],
    [0.5, LADO_MUNDO - 0.5],
    [LADO_MUNDO - 0.5, LADO_MUNDO - 0.5],
    [LADO_MUNDO * 0.5, 0.5],
    [LADO_MUNDO * 0.5, LADO_MUNDO - 0.5],
    [0.5, LADO_MUNDO * 0.5],
    [LADO_MUNDO - 0.5, LADO_MUNDO * 0.5],
  ];
  let max = 1;
  for (let i = 0; i < pts.length; i++) {
    const n = nivelDeTileDist(tileDistEm(pts[i][0], pts[i][1]));
    if (n > max) max = n;
  }
  escalaMundo = max;
  return max;
}

function hslaDeNivel(nivel, alpha, nivelEscala) {
  if (nivel <= 0) {
    return `hsla(210, 18%, 42%, ${alpha * 0.35})`;
  }
  const esc = Math.max(1, nivelEscala);
  const t = Math.max(0, Math.min(1, Math.log1p(nivel) / Math.log1p(esc)));
  const hue = 128 * (1 - t);
  const sat = 62 + t * 18;
  const light = 48 - t * 10;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}

function garantirLut(escBucket) {
  let lut = lutPorEscala.get(escBucket);
  if (lut) return lut;
  lut = new Array(escBucket + 1);
  for (let n = 0; n <= escBucket; n++) {
    lut[n] = hslaDeNivel(n, ALPHA_CALOR, escBucket);
  }
  lutPorEscala.set(escBucket, lut);
  return lut;
}

/**
 * Cor HSLA do heat map.
 * @param {number} nivel
 * @param {number} [alpha]
 * @param {number} [nivelEscala] teto visual (log); default = cantos do mundo
 */
export function corCalor(nivel, alpha = ALPHA_CALOR, nivelEscala = nivelEscalaCalor()) {
  const n = Math.max(0, nivel | 0);
  const escBucket = Math.max(1, Math.round(nivelEscala));
  if (alpha === ALPHA_CALOR) {
    const lut = garantirLut(escBucket);
    if (n <= escBucket) return lut[n];
    return hslaDeNivel(n, alpha, escBucket);
  }
  return hslaDeNivel(n, alpha, escBucket);
}
