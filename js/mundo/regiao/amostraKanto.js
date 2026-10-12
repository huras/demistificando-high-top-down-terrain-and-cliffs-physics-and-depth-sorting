/**
 * Altura, chão e rua de um bloco de Kanto.
 * Uma consulta por célula; o grafo já está montado.
 */
import { fbm2 } from "../voxel/ruido.js";
import {
  AREA_KANTO,
  CENTRO_AREA,
  EXTENSAO_KANTO,
  SAIDA_LESTE,
  SAIDA_NORTE,
  SAIDA_OESTE,
  SAIDA_SUL,
  zonaEm,
  zonaNoMundo,
} from "./grafoKanto.js";
import {
  RELEVO_FUNDO,
  RELEVO_MONTANHA,
  RELEVO_RASO,
  relevoEm,
} from "./kantoRelevo.js";
import { noFootprint, predioNoLayout, ruaNoLayout } from "./volumesCidade.js";

const COTA_CIDADE = 16;
const COTA_MONTANHA = 34;
const COTA_RASO = 10;
const COTA_FUNDO = 8;
const SEMENTE = 1337;
const MEIO_RUA = 3.5;
const SANGRIA = 4;
const AVENTAL = 18;

export const BIOMA_KANTO = Object.freeze({
  grama: Object.freeze({
    id: "light-grass",
    kit: "light-grass",
    superficie: "grama",
    cor: "#7dce6a",
    camada: "terra",
  }),
  mata: Object.freeze({
    id: "lush-grass",
    kit: "lush-grass",
    superficie: "grama",
    cor: "#3e8f45",
    camada: "terra",
  }),
  caminho: Object.freeze({
    id: "brown-earth",
    kit: "brown-earth",
    superficie: "terra",
    cor: "#a67c52",
    camada: "terra",
  }),
  pedra: Object.freeze({
    id: "stone",
    kit: "stone",
    superficie: "pedra",
    cor: "#8d8680",
    camada: "terra",
  }),
  montanha: Object.freeze({
    id: "pewter-massif",
    kit: "pewter-massif",
    superficie: "pedra",
    cor: "#6e6874",
    camada: "terra",
  }),
});

let cacheX = 1e9;
let cacheY = 1e9;
let cacheAmostra = null;

export function dentroDoKanto(wx, wy) {
  return wx >= 0 && wy >= 0 && wx < EXTENSAO_KANTO && wy < EXTENSAO_KANTO;
}

function distTrecho(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-4) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function noCaminho(lx, ly, pontos) {
  const px = lx + 0.5;
  const py = ly + 0.5;
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    if (distTrecho(px, py, a[0], a[1], b[0], b[1]) <= MEIO_RUA) return true;
  }
  return false;
}

function corredor(lx, ly, saidas) {
  if (!saidas) return false;
  const px = lx + 0.5;
  const py = ly + 0.5;
  const noX = Math.abs(px - CENTRO_AREA) <= MEIO_RUA;
  const noY = Math.abs(py - CENTRO_AREA) <= MEIO_RUA;
  if (noX && noY) return true;
  if ((saidas & SAIDA_NORTE) && noX && py < CENTRO_AREA) return true;
  if ((saidas & SAIDA_SUL) && noX && py > CENTRO_AREA) return true;
  if ((saidas & SAIDA_OESTE) && noY && px < CENTRO_AREA) return true;
  if ((saidas & SAIDA_LESTE) && noY && px > CENTRO_AREA) return true;
  return false;
}

function ruaCidade(lx, ly, zona) {
  const layout = zona.layout;
  if (noFootprint(lx, ly, layout)) return ruaNoLayout(lx, ly, layout);
  const px = lx + 0.5;
  const py = ly + 0.5;
  const fp = layout.fp;
  const noX = Math.abs(px - CENTRO_AREA) <= MEIO_RUA;
  const noY = Math.abs(py - CENTRO_AREA) <= MEIO_RUA;
  if ((zona.saidas & SAIDA_NORTE) && noX && py <= fp.y0) return true;
  if ((zona.saidas & SAIDA_SUL) && noX && py >= fp.y1) return true;
  if ((zona.saidas & SAIDA_OESTE) && noY && px <= fp.x0) return true;
  if ((zona.saidas & SAIDA_LESTE) && noY && px >= fp.x1) return true;
  return false;
}

function ehRua(lx, ly, zona) {
  if (!zona) return false;
  if (zona.tipo === "cidade") return ruaCidade(lx, ly, zona);
  if (zona.tipo !== "rota") return false;
  if (zona.caminho) return noCaminho(lx, ly, zona.caminho);
  return corredor(lx, ly, zona.saidas);
}

function cotaRua(zona) {
  if (!zona || zona.tipo === "cidade" || zona.agua) return COTA_CIDADE;
  if (zona.montanha || relevoEm(zona.ax, zona.ay) === RELEVO_MONTANHA) return COTA_MONTANHA;
  return COTA_CIDADE;
}

function misturaEixo(local, centro, saidaPerto, saidaLonge, cota, cotaPerto, cotaLonge) {
  if (local < centro && saidaPerto) {
    const t = (local + 0.5) / centro;
    return cotaPerto + (cota - cotaPerto) * t;
  }
  if (local >= centro && saidaLonge) {
    const t = (local + 0.5 - centro) / centro;
    return cota + (cotaLonge - cota) * t;
  }
  return cota;
}

function alturaRua(lx, ly, zona) {
  const cota = cotaRua(zona);
  const hy = misturaEixo(
    ly,
    CENTRO_AREA,
    zona.saidas & SAIDA_NORTE,
    zona.saidas & SAIDA_SUL,
    cota,
    cotaRua(zonaEm(zona.ax, zona.ay - 1)),
    cotaRua(zonaEm(zona.ax, zona.ay + 1)),
  );
  const hx = misturaEixo(
    lx,
    CENTRO_AREA,
    zona.saidas & SAIDA_OESTE,
    zona.saidas & SAIDA_LESTE,
    cota,
    cotaRua(zonaEm(zona.ax - 1, zona.ay)),
    cotaRua(zonaEm(zona.ax + 1, zona.ay)),
  );
  const noX = Math.abs(lx + 0.5 - CENTRO_AREA) <= MEIO_RUA;
  const noY = Math.abs(ly + 0.5 - CENTRO_AREA) <= MEIO_RUA;
  if (zona.caminho) return Math.round((hx + hy) * 0.5);
  if (noY && !noX) return Math.round(hx);
  if (noX && !noY) return Math.round(hy);
  return Math.round((hx + hy) * 0.5);
}

function alturaNatural(x, y, zona) {
  const byte = relevoEm(zona.ax, zona.ay);
  if (zona.agua) return byte === RELEVO_RASO ? COTA_RASO : COTA_FUNDO;
  if (byte === RELEVO_FUNDO) return COTA_FUNDO;
  if (byte === RELEVO_RASO) return COTA_RASO;
  const montanha = zona.montanha || byte === RELEVO_MONTANHA;
  const n = fbm2(x * 0.02, y * 0.02, SEMENTE, 2);
  if (montanha) return Math.max(22, Math.min(48, Math.round(COTA_MONTANHA + (n - 0.5) * 16)));
  return COTA_CIDADE + Math.round((n - 0.5) * 2);
}

function distanciaFora(lx, ly, fp) {
  let dist = 0;
  if (lx < fp.x0) dist = fp.x0 - lx;
  else if (lx >= fp.x1) dist = lx - fp.x1 + 1;
  if (ly < fp.y0) dist = Math.max(dist, fp.y0 - ly);
  else if (ly >= fp.y1) dist = Math.max(dist, ly - fp.y1 + 1);
  return dist;
}

function alturaCidade(x, y, lx, ly, zona, rua) {
  if (rua || noFootprint(lx, ly, zona.layout)) return COTA_CIDADE;
  const natural = alturaNatural(x, y, zona);
  const dist = distanciaFora(lx, ly, zona.layout.fp);
  if (dist >= AVENTAL) return natural;
  return Math.round(COTA_CIDADE + (natural - COTA_CIDADE) * (dist / AVENTAL));
}

function florestaEm(lx, ly, zona) {
  if (zona.densa || zona.floresta) return true;
  if (!zona.sangria) return false;
  if ((zona.sangria & SAIDA_NORTE) && ly < SANGRIA) return true;
  if ((zona.sangria & SAIDA_SUL) && ly >= AREA_KANTO - SANGRIA) return true;
  if ((zona.sangria & SAIDA_OESTE) && lx < SANGRIA) return true;
  if ((zona.sangria & SAIDA_LESTE) && lx >= AREA_KANTO - SANGRIA) return true;
  return false;
}

function calcular(x, y) {
  const zona = zonaNoMundo(x, y);
  const ax = (x / AREA_KANTO) | 0;
  const ay = (y / AREA_KANTO) | 0;
  const lx = x - ax * AREA_KANTO;
  const ly = y - ay * AREA_KANTO;
  const rua = ehRua(lx, ly, zona);
  const predio =
    !rua && zona.tipo === "cidade" && zona.layout ? predioNoLayout(lx, ly, zona.layout) : null;
  let h;
  if (rua && zona.tipo === "cidade") h = COTA_CIDADE;
  else if (rua) h = alturaRua(lx, ly, zona);
  else if (zona.tipo === "cidade") h = alturaCidade(x, y, lx, ly, zona, false);
  else h = alturaNatural(x, y, zona);
  if (h < 1) h = 1;
  if (h > 60) h = 60;

  const floresta = !rua && !predio && h >= COTA_CIDADE && florestaEm(lx, ly, zona);
  let bioma = BIOMA_KANTO.grama;
  if (predio) bioma = BIOMA_KANTO.pedra;
  else if (rua) bioma = BIOMA_KANTO.caminho;
  else if (zona.montanha || relevoEm(ax, ay) === RELEVO_MONTANHA) bioma = BIOMA_KANTO.montanha;
  else if (floresta) bioma = BIOMA_KANTO.mata;

  return {
    h,
    bioma,
    rua,
    floresta,
    predio: predio ? predio.altura : 0,
    nome: zona.nome,
  };
}

export function amostraKanto(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  if (!dentroDoKanto(x, y)) return null;
  if (x === cacheX && y === cacheY) return cacheAmostra;
  cacheX = x;
  cacheY = y;
  cacheAmostra = calcular(x, y);
  return cacheAmostra;
}

export function ehCaminhoKanto(wx, wy) {
  const amostra = amostraKanto(wx, wy);
  return !!amostra?.rua;
}

export const ALTURA_PRACA = COTA_CIDADE;
