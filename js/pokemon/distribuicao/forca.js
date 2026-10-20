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
const TILES_POR_NIVEL = 12;
const NIVEL_MIN = 2;
const NIVEL_MAX = 45;

/** @type {Uint16Array | null} */
let hops = null;

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

/** Nível de encontro em (wx, wy). Cidade e fora do mapa ficam no mínimo. */
export function nivelEm(wx, wy) {
  if (wx < 0 || wy < 0 || wx >= EXTENSAO_KANTO || wy >= EXTENSAO_KANTO) {
    return NIVEL_MIN;
  }
  const tabela = garantirHops();
  const ax = (wx / AREA_KANTO) | 0;
  const ay = (wy / AREA_KANTO) | 0;
  const h = tabela[ay * LADO_KANTO + ax];
  if (h === 0 || h >= INF) {
    return h === 0 ? NIVEL_MIN : NIVEL_MAX;
  }
  const lx = wx - ax * AREA_KANTO;
  const ly = wy - ay * AREA_KANTO;
  const local = Math.hypot(lx - AREA_KANTO * 0.5, ly - AREA_KANTO * 0.5);
  const tileDist = h * AREA_KANTO + local;
  return Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, 1 + Math.floor(tileDist / TILES_POR_NIVEL)));
}
