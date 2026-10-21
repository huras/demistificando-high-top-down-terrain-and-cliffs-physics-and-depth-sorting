/**
 * Grade 32×32 de Kanto. Cidade, rota ou mato, com saídas só entre
 * cidade e rota. A consulta é um índice, sem varrer o pacote.
 * zonaNoMundo recebe coords mundiais (ilha centrada no overworld).
 */
import { EXTENSAO_KANTO as EXTENSAO_BOUNDS, ORIGEM_KANTO_X, ORIGEM_KANTO_Y } from "../bounds.js";
import { areaIdEm } from "./areasKanto.js";
import { CIDADES_KANTO } from "./kantoCidades.js";
import { ROTAS_KANTO } from "./kantoRotas.js";
import { montarLayout } from "./volumesCidade.js";

export const LADO_KANTO = 32;
export const AREA_KANTO = 128;
export const EXTENSAO_KANTO = LADO_KANTO * AREA_KANTO;
if (EXTENSAO_KANTO !== EXTENSAO_BOUNDS) {
  throw new Error("EXTENSAO_KANTO desalinhada de bounds.js");
}
export const CENTRO_AREA = 64;

export const SAIDA_NORTE = 1;
export const SAIDA_LESTE = 2;
export const SAIDA_SUL = 4;
export const SAIDA_OESTE = 8;

const SANGRIA = 4;

function indice(ax, ay) {
  return ay * LADO_KANTO + ax;
}

function dentro(ax, ay) {
  return ax >= 0 && ay >= 0 && ax < LADO_KANTO && ay < LADO_KANTO;
}

function segmento(ax0, ay0, ax1, ay1) {
  const celulas = [];
  let x = ax0;
  let y = ay0;
  const passoX = Math.sign(ax1 - ax0);
  const passoY = Math.sign(ay1 - ay0);
  while (x !== ax1) {
    celulas.push([x, y]);
    x += passoX;
  }
  while (y !== ay1) {
    celulas.push([x, y]);
    y += passoY;
  }
  celulas.push([ax1, ay1]);
  return celulas;
}

function expandir(path) {
  const saida = [];
  const vistos = new Set();
  const por = (ax, ay) => {
    const chave = `${ax},${ay}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    saida.push([ax, ay]);
  };
  if (!path?.length) return saida;
  por(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) {
    const trecho = segmento(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    for (let k = 0; k < trecho.length; k++) por(trecho[k][0], trecho[k][1]);
  }
  return saida;
}

function zonaVazia(ax, ay) {
  return {
    tipo: "mato",
    ax,
    ay,
    nome: "Mato",
    id: `mato-${ax}-${ay}`,
    areaId: areaIdEm(ax, ay),
    saidas: 0,
    floresta: false,
    densa: false,
    montanha: false,
    agua: false,
    caminho: null,
    layout: null,
    sangria: 0,
  };
}

function caminhoFloresta() {
  const c = CENTRO_AREA;
  const n = 0;
  const s = AREA_KANTO - 1;
  const w = 0;
  const e = AREA_KANTO - 1;
  return {
    "10,9": [
      [c, s],
      [c, c],
      [w, c],
    ],
    "9,9": [
      [e, c],
      [c, c],
      [c, n],
    ],
    "9,8": [
      [c, s],
      [c, c],
      [e, c],
    ],
    "10,8": [
      [w, c],
      [e, c],
    ],
    "11,8": [
      [w, c],
      [c, c],
      [c, n],
    ],
    "11,7": [
      [c, s],
      [c, c],
      [w, c],
    ],
    "10,7": [
      [e, c],
      [c, c],
      [c, n],
    ],
  };
}

function montarZonas() {
  const zonas = new Array(LADO_KANTO * LADO_KANTO);
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) zonas[indice(ax, ay)] = zonaVazia(ax, ay);
  }

  for (let i = 0; i < CIDADES_KANTO.length; i++) {
    const def = CIDADES_KANTO[i];
    const zona = zonas[indice(def.ax, def.ay)];
    zona.tipo = "cidade";
    zona.nome = def.nome;
    zona.id = def.key;
    zona.layout = montarLayout(def);
  }

  for (let r = 0; r < ROTAS_KANTO.length; r++) {
    const rota = ROTAS_KANTO[r];
    const celulas = expandir(rota.path);
    for (let i = 0; i < celulas.length; i++) {
      const ax = celulas[i][0];
      const ay = celulas[i][1];
      if (!dentro(ax, ay)) continue;
      const zona = zonas[indice(ax, ay)];
      if (zona.tipo === "cidade") continue;
      if (zona.tipo === "rota") continue;
      zona.tipo = "rota";
      zona.nome = rota.nome;
      zona.id = `${rota.id}-${ax}-${ay}`;
      zona.floresta = !!rota.floresta;
      zona.montanha = !!rota.montanha;
      zona.agua = !!rota.agua;
    }
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const zona = zonas[indice(10 + dx, 8 + dy)];
      if (!zona || zona.tipo === "cidade") continue;
      zona.floresta = true;
      zona.densa = true;
      if (dx === 0 && dy === 0) zona.nome = "Floresta de Viridian";
    }
  }

  const caminhos = caminhoFloresta();
  for (const chave of Object.keys(caminhos)) {
    const [ax, ay] = chave.split(",").map(Number);
    const zona = zonas[indice(ax, ay)];
    if (!zona) continue;
    zona.caminho = caminhos[chave];
  }

  const em = (ax, ay) => (dentro(ax, ay) ? zonas[indice(ax, ay)] : null);
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonas[indice(ax, ay)];
      if (zona.densa || zona.tipo === "cidade") continue;
      if (em(ax, ay - 1)?.densa) zona.sangria |= SAIDA_NORTE;
      if (em(ax + 1, ay)?.densa) zona.sangria |= SAIDA_LESTE;
      if (em(ax, ay + 1)?.densa) zona.sangria |= SAIDA_SUL;
      if (em(ax - 1, ay)?.densa) zona.sangria |= SAIDA_OESTE;
    }
  }

  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonas[indice(ax, ay)];
      let saidas = 0;
      const norte = ay > 0 ? zonas[indice(ax, ay - 1)] : null;
      const leste = ax + 1 < LADO_KANTO ? zonas[indice(ax + 1, ay)] : null;
      const sul = ay + 1 < LADO_KANTO ? zonas[indice(ax, ay + 1)] : null;
      const oeste = ax > 0 ? zonas[indice(ax - 1, ay)] : null;
      if (norte && (norte.tipo === "cidade" || norte.tipo === "rota")) saidas |= SAIDA_NORTE;
      if (leste && (leste.tipo === "cidade" || leste.tipo === "rota")) saidas |= SAIDA_LESTE;
      if (sul && (sul.tipo === "cidade" || sul.tipo === "rota")) saidas |= SAIDA_SUL;
      if (oeste && (oeste.tipo === "cidade" || oeste.tipo === "rota")) saidas |= SAIDA_OESTE;
      zona.saidas = saidas;
      zona.areaId = areaIdEm(ax, ay);
    }
  }

  return zonas;
}

const ZONAS = montarZonas();

export function zonaEm(ax, ay) {
  if (!dentro(ax | 0, ay | 0)) return null;
  return ZONAS[indice(ax | 0, ay | 0)];
}

export function zonaNoMundo(wx, wy) {
  const lx = wx - ORIGEM_KANTO_X;
  const ly = wy - ORIGEM_KANTO_Y;
  if (lx < 0 || ly < 0 || lx >= EXTENSAO_KANTO || ly >= EXTENSAO_KANTO) return null;
  return zonaEm((lx / AREA_KANTO) | 0, (ly / AREA_KANTO) | 0);
}

export function ehCidade(wx, wy) {
  return zonaNoMundo(wx, wy)?.tipo === "cidade";
}
