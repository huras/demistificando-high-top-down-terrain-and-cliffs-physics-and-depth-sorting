/**
 * Placas de cidade, postes de rota, quadro da praça e caixas de correio.
 * A conta é local à área; a malha fica no render.
 */
import { deLocalKanto } from "../bounds.js";
import { amostraKanto } from "./amostraKanto.js";
import {
  AREA_KANTO,
  CENTRO_AREA,
  LADO_KANTO,
  SAIDA_LESTE,
  SAIDA_NORTE,
  SAIDA_OESTE,
  SAIDA_SUL,
  zonaEm,
} from "./grafoKanto.js";

const MEIO_RUA = 3.5;
const OMBRO = MEIO_RUA + 1.15;
const PASSO_POSTE = 12;
const PASSO_POSTE_RUA = 10;
const MARGEM_POSTE_RUA = MEIO_RUA + 0.8;
const DIST_PRACA_POSTE = 1.6;
const RECUO_POSTE = 14;
const BORDA_PLACA = 8;
const FOLGA_ALTURA = 3;
const LARGURA_POSTE = 0.7;
const LARGURA_QUADRO = 2;
const LARGURA_CORREIO = 1;
const FOLGA_PRACA = 0.28;

const SAIDAS = [SAIDA_NORTE, SAIDA_SUL, SAIDA_OESTE, SAIDA_LESTE];

export const CORES_CORREIO = Object.freeze([
  "#c23b3b",
  "#2f6fbf",
  "#3d8c4a",
  "#e2b33a",
  "#2e2e2e",
  "#e07a2f",
  "#d46aa6",
  "#7a4ea3",
]);

function chao(wx, wy) {
  const amostra = amostraKanto(Math.floor(wx), Math.floor(wy));
  return amostra ? amostra.h : null;
}

function mundo(ax, ay, lx, ly) {
  return deLocalKanto(ax * AREA_KANTO + lx, ay * AREA_KANTO + ly);
}

function longe(lista, x, y, raio) {
  const r2 = raio * raio;
  for (let i = 0; i < lista.length; i++) {
    const dx = lista[i].x - x;
    const dy = lista[i].y - y;
    if (dx * dx + dy * dy < r2) return false;
  }
  return true;
}

function vagoNoLote(layout, x, y) {
  if (x < 2 || y < 2 || x >= AREA_KANTO - 2 || y >= AREA_KANTO - 2) return false;
  if (Math.abs(x - CENTRO_AREA) <= MEIO_RUA + 0.2) return false;
  if (Math.abs(y - CENTRO_AREA) <= MEIO_RUA + 0.2) return false;
  const volumes = layout.volumes;
  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    if (x >= v.x0 - 0.2 && x < v.x1 + 0.2 && y >= v.y0 - 0.2 && y < v.y1 + 0.2) return false;
  }
  return true;
}

function pracaNoCentro() {
  const y = CENTRO_AREA + 2.35;
  const largura = LARGURA_POSTE + FOLGA_PRACA + LARGURA_QUADRO + FOLGA_PRACA + LARGURA_CORREIO + FOLGA_PRACA + LARGURA_POSTE;
  let x = CENTRO_AREA - largura * 0.5;
  const posteEsq = x + LARGURA_POSTE * 0.5;
  x += LARGURA_POSTE + FOLGA_PRACA;
  const quadro = x + LARGURA_QUADRO * 0.5;
  x += LARGURA_QUADRO + FOLGA_PRACA;
  const correio = x + LARGURA_CORREIO * 0.5;
  x += LARGURA_CORREIO + FOLGA_PRACA;
  const posteDir = x + LARGURA_POSTE * 0.5;
  return {
    quadro: { x: quadro, y, yaw: 0 },
    correio: { x: correio, y, cor: CORES_CORREIO[0] },
    postes: [
      { x: posteEsq, y },
      { x: posteDir, y },
    ],
  };
}

function correiosDasCasas(layout) {
  const volumes = layout.volumes;
  const lista = [];
  let casa = 0;
  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    if (v.papel !== "casa") continue;
    const cor = CORES_CORREIO[casa % CORES_CORREIO.length];
    const lado = casa % 2 === 0 ? -1 : 1;
    casa += 1;
    const y = v.y1 + 0.35;
    let x = lado < 0 ? v.x0 - 0.55 : v.x1 + 0.55;
    if (!vagoNoLote(layout, x, y)) x = lado < 0 ? v.x1 + 0.55 : v.x0 - 0.55;
    if (!vagoNoLote(layout, x, y)) continue;
    lista.push({ x, y, cor });
  }
  return lista;
}

export function decoracaoDaCidade(layout) {
  const praca = pracaNoCentro();
  const casas = correiosDasCasas(layout);
  const ocupados = casas.concat([praca.quadro, praca.correio], praca.postes);
  return {
    quadro: praca.quadro,
    correio: praca.correio,
    postes: praca.postes,
    casas,
    ocupados,
  };
}

function longeDaPraca(ocupados, x, y) {
  const limite = DIST_PRACA_POSTE * DIST_PRACA_POSTE;
  for (let i = 0; i < ocupados.length; i++) {
    const dx = ocupados[i].x - x;
    const dy = ocupados[i].y - y;
    if (dx * dx + dy * dy < limite) return false;
  }
  return true;
}

/** Postes da calçada, em coordenadas da área. A praça entra em decoracaoDaCidade. */
export function postesDeRua(layout) {
  const fp = layout.fp;
  const ocupados = decoracaoDaCidade(layout).ocupados;
  const lista = [];
  const margem = MARGEM_POSTE_RUA;
  const volumes = layout.volumes;
  function livre(x, y) {
    if (Math.abs(x - CENTRO_AREA) < 8 && Math.abs(y - CENTRO_AREA) < 8) return false;
    for (let i = 0; i < volumes.length; i++) {
      const v = volumes[i];
      if (x >= v.x0 - 0.4 && x < v.x1 + 0.4 && y >= v.y0 - 0.4 && y < v.y1 + 0.4) return false;
    }
    return longeDaPraca(ocupados, x, y);
  }
  for (let x = Math.ceil(fp.x0) + 4; x < fp.x1 - 2; x += PASSO_POSTE_RUA) {
    const px = x + 0.5;
    if (livre(px, CENTRO_AREA - margem)) lista.push({ x: px, y: CENTRO_AREA - margem });
    if (livre(px, CENTRO_AREA + margem)) lista.push({ x: px, y: CENTRO_AREA + margem });
  }
  for (let y = Math.ceil(fp.y0) + 4; y < fp.y1 - 2; y += PASSO_POSTE_RUA) {
    const py = y + 0.5;
    if (livre(CENTRO_AREA - margem, py)) lista.push({ x: CENTRO_AREA - margem, y: py });
    if (livre(CENTRO_AREA + margem, py)) lista.push({ x: CENTRO_AREA + margem, y: py });
  }
  return lista;
}

function vizinho(ax, ay, dir) {
  let nx = ax;
  let ny = ay;
  if (dir === SAIDA_NORTE) ny -= 1;
  else if (dir === SAIDA_SUL) ny += 1;
  else if (dir === SAIDA_OESTE) nx -= 1;
  else nx += 1;
  return zonaEm(nx, ny);
}

function ancoraDaSaida(dir) {
  const borda = AREA_KANTO - 1 - BORDA_PLACA;
  if (dir === SAIDA_NORTE) return { x: CENTRO_AREA, y: BORDA_PLACA, tx: 0, ty: 1 };
  if (dir === SAIDA_SUL) return { x: CENTRO_AREA, y: borda, tx: 0, ty: -1 };
  if (dir === SAIDA_OESTE) return { x: BORDA_PLACA, y: CENTRO_AREA, tx: 1, ty: 0 };
  return { x: borda, y: CENTRO_AREA, tx: -1, ty: 0 };
}

function projetarNoCaminho(caminho, x, y) {
  let melhor = null;
  let melhorD = 1e9;
  for (let i = 1; i < caminho.length; i++) {
    const a = caminho[i - 1];
    const b = caminho[i];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-4) continue;
    let t = ((x - a[0]) * abx + (y - a[1]) * aby) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const px = a[0] + abx * t;
    const py = a[1] + aby * t;
    const d = Math.hypot(x - px, y - py);
    if (d >= melhorD) continue;
    const len = Math.sqrt(len2);
    melhorD = d;
    melhor = { x: px, y: py, tx: abx / len, ty: aby / len, d };
  }
  if (!melhor || melhor.d > 12) return null;
  return melhor;
}

function escolherOmbro(ax, ay, x, y, tx, ty, preferirEsq) {
  const lados = preferirEsq ? [1, -1] : [-1, 1];
  const rua = mundo(ax, ay, x, y);
  const hRua = chao(rua.x, rua.y);
  if (hRua == null) return null;
  const distancias = [OMBRO, MEIO_RUA - 0.45];
  for (let d = 0; d < distancias.length; d++) {
    const dist = distancias[d];
    const naPista = d > 0;
    for (let i = 0; i < lados.length; i++) {
      const lado = lados[i];
      const px = -ty * lado;
      const py = tx * lado;
      const sx = x + px * dist;
      const sy = y + py * dist;
      if (sx < 1 || sy < 1 || sx >= AREA_KANTO - 1 || sy >= AREA_KANTO - 1) continue;
      const ponto = mundo(ax, ay, sx, sy);
      const h = naPista ? hRua : chao(ponto.x, ponto.y);
      if (h == null || Math.abs(h - hRua) > FOLGA_ALTURA) continue;
      return {
        x: ponto.x,
        y: ponto.y,
        h,
        yaw: Math.atan2(-px, -py),
      };
    }
  }
  return null;
}

function linhasDaRota(zona) {
  if (zona.caminho?.length > 1) {
    const linhas = [];
    for (let i = 1; i < zona.caminho.length; i++) {
      linhas.push([zona.caminho[i - 1], zona.caminho[i]]);
    }
    return linhas;
  }
  const c = CENTRO_AREA;
  const fim = AREA_KANTO - 1;
  const linhas = [];
  if (zona.saidas & SAIDA_NORTE) linhas.push([[c, 0], [c, c]]);
  if (zona.saidas & SAIDA_SUL) linhas.push([[c, c], [c, fim]]);
  if (zona.saidas & SAIDA_OESTE) linhas.push([[0, c], [c, c]]);
  if (zona.saidas & SAIDA_LESTE) linhas.push([[c, c], [fim, c]]);
  return linhas;
}

function pontosDaLinha(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < PASSO_POSTE) return [];
  const tx = dx / len;
  const ty = dy / len;
  const saida = [];
  for (let d = RECUO_POSTE; d <= len - RECUO_POSTE; d += PASSO_POSTE) {
    const t = d / len;
    saida.push({
      x: a[0] + dx * t,
      y: a[1] + dy * t,
      tx,
      ty,
    });
  }
  return saida;
}

function decoracaoDaRota(ax, ay, zona) {
  const placas = [];
  for (let i = 0; i < SAIDAS.length; i++) {
    const dir = SAIDAS[i];
    if ((zona.saidas & dir) === 0) continue;
    const cidade = vizinho(ax, ay, dir);
    if (!cidade || cidade.tipo !== "cidade") continue;
    let ancora = ancoraDaSaida(dir);
    if (zona.caminho) {
      const noCaminho = projetarNoCaminho(zona.caminho, ancora.x, ancora.y);
      if (!noCaminho) continue;
      ancora = noCaminho;
    }
    const ombro = escolherOmbro(ax, ay, ancora.x, ancora.y, ancora.tx, ancora.ty, true);
    if (!ombro) continue;
    placas.push({
      x: ombro.x,
      y: ombro.y,
      h: ombro.h,
      yaw: ombro.yaw,
      nome: cidade.nome,
    });
  }

  const postes = [];
  const linhas = linhasDaRota(zona);
  let ordinal = 0;
  for (let i = 0; i < linhas.length; i++) {
    const pontos = pontosDaLinha(linhas[i][0], linhas[i][1]);
    for (let p = 0; p < pontos.length; p++) {
      const ponto = pontos[p];
      const preferirEsq = ordinal % 2 === 0;
      ordinal += 1;
      const ombro = escolherOmbro(ax, ay, ponto.x, ponto.y, ponto.tx, ponto.ty, preferirEsq);
      if (!ombro) continue;
      if (!longe(placas, ombro.x, ombro.y, 6)) continue;
      if (!longe(postes, ombro.x, ombro.y, 6)) continue;
      postes.push({ x: ombro.x, y: ombro.y, h: ombro.h });
    }
  }

  if (!placas.length && !postes.length) return null;
  const centro = deLocalKanto(ax * AREA_KANTO + CENTRO_AREA, ay * AREA_KANTO + CENTRO_AREA);
  return {
    ax,
    ay,
    cx: centro.x,
    cy: centro.y,
    placas,
    postes,
  };
}

let cacheRotas = null;

export function decoracaoDasRotas() {
  if (cacheRotas) return cacheRotas;
  const grupos = [];
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonaEm(ax, ay);
      if (!zona || zona.tipo !== "rota") continue;
      const grupo = decoracaoDaRota(ax, ay, zona);
      if (grupo) grupos.push(grupo);
    }
  }
  cacheRotas = grupos;
  return grupos;
}
