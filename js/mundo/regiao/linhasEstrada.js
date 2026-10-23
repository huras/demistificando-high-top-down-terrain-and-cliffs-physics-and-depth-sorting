/**
 * Polilinhas e corredor das estradas de Kanto.
 * Fonte única pra postes, faixas LOD e furo aproximado no heightfield.
 */
import { deLocalKanto, paraLocalKanto, dentroDoKanto } from "../bounds.js";
import { nivelMarBlocos } from "../bioma/catalogo.js";
import { amostraKanto } from "./amostraKanto.js";
import { cotaDeckEstrada } from "./cotasEstrada.js";
import {
  AREA_KANTO,
  CENTRO_AREA,
  LADO_KANTO,
  SAIDA_LESTE,
  SAIDA_NORTE,
  SAIDA_OESTE,
  SAIDA_SUL,
  zonaEm,
  zonaNoMundo,
} from "./grafoKanto.js";

export { cotaDeckEstrada } from "./cotasEstrada.js";

/** Distância do eixo ao centro da célula da borda (ehRua). */
export const MEIA_LARGURA_ESTRADA = 3.5;
/** Meia-largura da malha: cobre blocos [centro−4, centro+4]. */
export const MEIA_LARGURA_FAIXA = 4;
/** Ombro suave do furo no LOD (montanha / costa). */
const OMBRO_CORREDOR = 6;

/**
 * Trechos locais de uma rota (saídas ou caminho).
 * Extremos em 0..AREA_KANTO pra costurar áreas vizinhas sem fresta.
 */
export function linhasDaRota(zona) {
  if (!zona || zona.tipo !== "rota") return [];
  if (zona.caminho?.length > 1) {
    const linhas = [];
    for (let i = 1; i < zona.caminho.length; i++) {
      linhas.push([zona.caminho[i - 1], zona.caminho[i]]);
    }
    return linhas;
  }
  const c = CENTRO_AREA;
  const fim = AREA_KANTO;
  const linhas = [];
  if (zona.saidas & SAIDA_NORTE) linhas.push([[c, 0], [c, c]]);
  if (zona.saidas & SAIDA_SUL) linhas.push([[c, c], [c, fim]]);
  if (zona.saidas & SAIDA_OESTE) linhas.push([[0, c], [c, c]]);
  if (zona.saidas & SAIDA_LESTE) linhas.push([[c, c], [fim, c]]);
  return linhas;
}

/** Cidade: cruz no centro do footprint + braços até a borda. */
export function linhasDaCidade(zona) {
  if (!zona || zona.tipo !== "cidade" || !zona.layout?.fp) return [];
  const fp = zona.layout.fp;
  const cx = Number.isFinite(fp.cx) ? fp.cx : CENTRO_AREA;
  const cy = Number.isFinite(fp.cy) ? fp.cy : CENTRO_AREA;
  const fim = AREA_KANTO;
  const linhas = [];
  if (fp.x0 <= cx && cx < fp.x1) linhas.push([[cx, fp.y0], [cx, fp.y1]]);
  if (fp.y0 <= cy && cy < fp.y1) linhas.push([[fp.x0, cy], [fp.x1, cy]]);
  if (zona.saidas & SAIDA_NORTE) linhas.push([[cx, 0], [cx, fp.y0]]);
  if (zona.saidas & SAIDA_SUL) linhas.push([[cx, fp.y1], [cx, fim]]);
  if (zona.saidas & SAIDA_OESTE) linhas.push([[0, cy], [fp.x0, cy]]);
  if (zona.saidas & SAIDA_LESTE) linhas.push([[fp.x1, cy], [fim, cy]]);
  return linhas;
}

function linhasLocaisLod(zona) {
  if (!zona) return [];
  if (zona.tipo === "rota") return linhasDaRota(zona);
  if (zona.tipo === "cidade") return linhasDaCidade(zona);
  return [];
}

function mundoDaArea(ax, ay, lx, ly) {
  return deLocalKanto(ax * AREA_KANTO + lx, ay * AREA_KANTO + ly);
}

/** Distância e projeção no eixo da estrada (coords locais contínuas). */
export function projetarEixoEstradaLocal(lx, ly, zona) {
  const linhas = linhasLocaisLod(zona);
  if (!linhas.length) return null;
  let melhor = null;
  let melhorD = 1e9;
  for (let i = 0; i < linhas.length; i++) {
    const [a, b] = linhas[i];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-6) continue;
    let t = ((lx - a[0]) * abx + (ly - a[1]) * aby) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const px = a[0] + abx * t;
    const py = a[1] + aby * t;
    const d = Math.hypot(lx - px, ly - py);
    if (d >= melhorD) continue;
    melhorD = d;
    melhor = { x: px, y: py, d };
  }
  return melhor;
}

/**
 * Abaixa o heightfield LOD em torno do corredor (montanha),
 * sem erguer mar/costa. Ombro suave evita parede de 16m na borda da faixa.
 */
export function ajustarAlturaCorredorEstrada(wx, wy, h) {
  if (!dentroDoKanto(wx, wy) || !Number.isFinite(h)) return h;
  const zona = zonaNoMundo(wx, wy);
  if (!zona || (zona.tipo !== "rota" && zona.tipo !== "cidade")) return h;
  // Rota de água: não cava o heightfield (deck ~16 abriria canyon no LOD).
  // Ponte visual = faixa estradasLod; stream perto = voxel oco.
  if (zona.agua) return h;
  const local = paraLocalKanto(wx, wy);
  const proj = projetarEixoEstradaLocal(local.x, local.y, zona);
  if (!proj) return h;
  const alcance = MEIA_LARGURA_ESTRADA + OMBRO_CORREDOR;
  if (proj.d >= alcance) return h;

  let deck = cotaDeckEstrada(zona, nivelMarBlocos());
  const eixo = deLocalKanto(zona.ax * AREA_KANTO + proj.x, zona.ay * AREA_KANTO + proj.y);
  const a = amostraKanto(eixo.x, eixo.y);
  if (a && Number.isFinite(a.h)) deck = a.h;
  // Só fura pra baixo — oceano ao lado da ponte permanece.
  if (h <= deck) return h;
  if (proj.d <= MEIA_LARGURA_ESTRADA) return deck;
  const u = (proj.d - MEIA_LARGURA_ESTRADA) / OMBRO_CORREDOR;
  const t = u * u * (3 - 2 * u);
  return h * t + deck * (1 - t);
}

/**
 * Catálogo estático de faixas em coords mundiais.
 * @returns {ReadonlyArray<{ id: string, ax: number, ay: number, x0: number, y0: number, x1: number, y1: number, mx: number, my: number, alcance: number, ponte: boolean, deck: number }>}
 */
let cacheSegmentos = null;

export function segmentosEstradaMundo() {
  if (cacheSegmentos) return cacheSegmentos;
  const lista = [];
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonaEm(ax, ay);
      const locais = linhasLocaisLod(zona);
      const ponte = !!(zona && zona.tipo === "rota" && zona.agua);
      const deck = cotaDeckEstrada(zona, nivelMarBlocos());
      for (let i = 0; i < locais.length; i++) {
        const [a, b] = locais[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1) continue;
        const p0 = mundoDaArea(ax, ay, a[0], a[1]);
        const p1 = mundoDaArea(ax, ay, b[0], b[1]);
        const mx = (p0.x + p1.x) * 0.5;
        const my = (p0.y + p1.y) * 0.5;
        lista.push({
          id: `${ax},${ay}:${i}`,
          ax,
          ay,
          x0: p0.x,
          y0: p0.y,
          x1: p1.x,
          y1: p1.y,
          mx,
          my,
          alcance: len * 0.5 + MEIA_LARGURA_FAIXA + 2,
          ponte,
          deck,
        });
      }
    }
  }
  cacheSegmentos = Object.freeze(lista);
  return cacheSegmentos;
}
