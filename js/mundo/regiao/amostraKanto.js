/**
 * Altura, chão e rua de um bloco de Kanto.
 * Entrada em coords mundiais; o cálculo interno usa local da ilha.
 */
import { clampAltura } from "../../config.js";
import { dentroDoKanto, paraLocalKanto } from "../bounds.js";
import { fbm2 } from "../voxel/ruido.js";
import { amostraCorpo, ligarConsultasCorpo } from "../agua/corpos.js";
import { parBiomaKanto } from "./biomasKanto.js";
import {
  AREA_KANTO,
  CENTRO_AREA,
  EXTENSAO_KANTO,
  SAIDA_LESTE,
  SAIDA_NORTE,
  SAIDA_OESTE,
  SAIDA_SUL,
  zonaEm,
} from "./grafoKanto.js";
import {
  RELEVO_FUNDO,
  RELEVO_MONTANHA,
  RELEVO_RASO,
  RELEVO_TERRA,
  relevoEm,
} from "./kantoRelevo.js";
import { noFootprint, noQuintalDoLote, predioNoLayout, ruaNoLayout } from "./volumesCidade.js";

export { dentroDoKanto } from "../bounds.js";
import { aplicarDetalheBioma } from "./detalheRelevo.js";
import {
  COTA_ESTRADA_MONTANHA,
  PAD_ABUTMENT_PONTE,
  cotaDeckEstrada,
} from "./cotasEstrada.js";

const COTA_CIDADE = 16;
const SPRITE_PREDIO = new Set(["torre", "porto", "safari"]);

function predioSprite(papel) {
  return SPRITE_PREDIO.has(papel);
}
const COTA_MONTANHA = 36;
const COTA_PICO = 54;
const COTA_RASO = 10;
const COTA_FUNDO = 8;
const SEMENTE = 1337;
const MEIO_RUA = 3.5;
const SANGRIA = 4;
const AVENTAL = 18;

export { BIOMA_KANTO } from "./biomasKanto.js";

let cacheX = 1e9;
let cacheY = 1e9;
let cacheAmostra = null;
let cacheBaseX = 1e9;
let cacheBaseY = 1e9;
let cacheBase = null;
const CAMPO = {
  tem: 0,
  fluido: 0,
  cava: 0,
  sobe: 0,
  superficie: 0,
  altura: 0,
  queda: 0,
};

/** Altura sem cavar água — coords mundiais. */
export function alturaBaseKanto(wx, wy) {
  const b = amostraBaseKanto(wx, wy);
  return b ? b.h : 16;
}

/** Cidade, rua/canal ou prédio: o campo de água não toca. */
export function reservaAguaKanto(wx, wy) {
  const b = amostraBaseKanto(wx, wy);
  return !b || b.reservado;
}

/** Consultas locais para o campo de corpos (coords da ilha). */
function alturaBaseLocal(lx, ly) {
  const b = amostraBaseLocal(lx | 0, ly | 0);
  return b ? b.h : 16;
}

function reservaAguaLocal(lx, ly) {
  const b = amostraBaseLocal(lx | 0, ly | 0);
  return !b || b.reservado;
}

function amostraBaseLocal(x, y) {
  if (x < 0 || y < 0 || x >= EXTENSAO_KANTO || y >= EXTENSAO_KANTO) return null;
  if (x === cacheBaseX && y === cacheBaseY) return cacheBase;
  cacheBaseX = x;
  cacheBaseY = y;
  cacheBase = calcularBase(x, y);
  return cacheBase;
}

/** Entrada mundial. */
export function amostraBaseKanto(wx, wy) {
  if (!dentroDoKanto(wx, wy)) return null;
  const local = paraLocalKanto(wx, wy);
  return amostraBaseLocal(local.x | 0, local.y | 0);
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

function cotaAgua(zona) {
  if (!zona) return COTA_FUNDO;
  const byte = relevoEm(zona.ax, zona.ay);
  return byte === RELEVO_RASO ? COTA_RASO : COTA_FUNDO;
}

function cotaRua(zona) {
  if (!zona || zona.tipo === "cidade") return COTA_CIDADE;
  // Rota de água: deck constante (ponte). Leito fica em hLeito no sample.
  if (zona.agua) return cotaDeckEstrada(zona);
  if (zona.montanha || relevoEm(zona.ax, zona.ay) === RELEVO_MONTANHA) {
    return Math.max(COTA_MONTANHA, COTA_ESTRADA_MONTANHA);
  }
  return COTA_CIDADE;
}

/** Sobe a rua de terra até o deck se estiver no pad vizinho a uma rota de água. */
function abutmentPonte(lx, ly, zona, h) {
  if (!zona || zona.agua) return h;
  let deck = h;
  const pad = PAD_ABUTMENT_PONTE;
  const lados = [
    [0, -1, ly],
    [0, 1, AREA_KANTO - 1 - ly],
    [-1, 0, lx],
    [1, 0, AREA_KANTO - 1 - lx],
  ];
  for (let i = 0; i < lados.length; i++) {
    const dx = lados[i][0];
    const dy = lados[i][1];
    const dist = lados[i][2];
    if (dist > pad) continue;
    const viz = zonaEm(zona.ax + dx, zona.ay + dy);
    if (!viz?.agua) continue;
    const d = cotaDeckEstrada(viz);
    if (d > deck) deck = d;
  }
  return deck > h ? deck : h;
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
  // Ponte: nível constante em toda a água (sem rampa afundando no canal).
  if (zona.agua) return cotaDeckEstrada(zona);
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
  let h;
  if (zona.caminho) h = Math.round((hx + hy) * 0.5);
  else if (noY && !noX) h = Math.round(hx);
  else if (noX && !noY) h = Math.round(hy);
  else h = Math.round((hx + hy) * 0.5);
  return abutmentPonte(lx, ly, zona, h);
}

function ehAgua(byte) {
  return byte === RELEVO_FUNDO || byte === RELEVO_RASO || byte === 255;
}

function distanciaAte(wx, wy, casa) {
  const ax = (wx / AREA_KANTO) | 0;
  const ay = (wy / AREA_KANTO) | 0;
  const px = wx + 0.5;
  const py = wy + 0.5;
  let melhor = 480;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (!casa(relevoEm(ax + dx, ay + dy))) continue;
      const x0 = (ax + dx) * AREA_KANTO;
      const y0 = (ay + dy) * AREA_KANTO;
      const x1 = x0 + AREA_KANTO;
      const y1 = y0 + AREA_KANTO;
      const qx = px < x0 ? x0 : px > x1 ? x1 : px;
      const qy = py < y0 ? y0 : py > y1 ? y1 : py;
      const d = Math.hypot(px - qx, py - qy);
      if (d < melhor) melhor = d;
    }
  }
  return melhor;
}

function perfilCosta(wx, wy) {
  const onda = (fbm2(wx * 0.006, wy * 0.006, SEMENTE + 17, 4) - 0.5) * 110;
  const afast = distanciaAte(wx, wy, ehAgua) - distanciaAte(wx, wy, (b) => b === RELEVO_TERRA || b === RELEVO_MONTANHA) + onda;
  const faixa = 30;
  let u = (afast + faixa) / (faixa * 2);
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  u = u * u * (3 - 2 * u);
  return {
    u,
    dentroMontanha: distanciaAte(wx, wy, (b) => b !== RELEVO_MONTANHA && b !== 255),
  };
}

function alturaDoTerreno(x, y, zona, perfil) {
  const n = fbm2(x * 0.02, y * 0.02, SEMENTE, 2);
  const plano = COTA_CIDADE + Math.round((n - 0.5) * 3);
  const montanha = zona.montanha || relevoEm(zona.ax, zona.ay) === RELEVO_MONTANHA;
  if (!montanha) return plano;
  const t = Math.min(1, perfil.dentroMontanha / 32);
  // n 0..1 cobre COTA_MONTANHA → COTA_PICO (não centrado em zero).
  const pico = Math.max(COTA_MONTANHA, Math.min(COTA_PICO, Math.round(COTA_MONTANHA + n * (COTA_PICO - COTA_MONTANHA))));
  return Math.round(plano + (pico - plano) * t);
}

function alturaNatural(x, y, zona, perfil) {
  // Fora do canal, rota de água usa a mesma costa do relevo (não afunda a célula inteira).
  const terra = alturaDoTerreno(x, y, zona, perfil);
  return Math.round(COTA_FUNDO + (terra - COTA_FUNDO) * perfil.u);
}

function distanciaFora(lx, ly, fp) {
  let dist = 0;
  if (lx < fp.x0) dist = fp.x0 - lx;
  else if (lx >= fp.x1) dist = lx - fp.x1 + 1;
  if (ly < fp.y0) dist = Math.max(dist, fp.y0 - ly);
  else if (ly >= fp.y1) dist = Math.max(dist, ly - fp.y1 + 1);
  return dist;
}

function alturaCidade(x, y, lx, ly, zona, perfil) {
  if (noFootprint(lx, ly, zona.layout)) return COTA_CIDADE;
  const natural = alturaNatural(x, y, zona, perfil);
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

/** x,y em coords locais da ilha. */
function calcularBase(x, y) {
  const ax = (x / AREA_KANTO) | 0;
  const ay = (y / AREA_KANTO) | 0;
  const zona = zonaEm(ax, ay);
  if (!zona) return null;
  const lx = x - ax * AREA_KANTO;
  const ly = y - ay * AREA_KANTO;
  const rua = ehRua(lx, ly, zona);
  const predio =
    !rua && zona.tipo === "cidade" && zona.layout ? predioNoLayout(lx, ly, zona.layout) : null;
  const noFp =
    zona.tipo === "cidade" && zona.layout ? noFootprint(lx, ly, zona.layout) : false;
  const perfil = perfilCosta(x, y);

  const ponte = !!(rua && zona.tipo === "rota" && zona.agua);
  const hLeito = ponte ? cotaAgua(zona) : 0;

  let h;
  if (rua && zona.tipo === "cidade") h = COTA_CIDADE;
  else if (rua) h = alturaRua(lx, ly, zona);
  else if (zona.tipo === "cidade") h = alturaCidade(x, y, lx, ly, zona, perfil);
  else h = alturaNatural(x, y, zona, perfil);

  const floresta = !rua && !predio && h >= COTA_CIDADE && florestaEm(lx, ly, zona);
  const par = parBiomaKanto(x, y, perfil.u, perfil.dentroMontanha, floresta, predio, rua);
  const travado = !!(rua || predio || noFp || ponte);
  h = aplicarDetalheBioma(h, x, y, par, perfil.u, travado);
  h = clampAltura(h);

  // Ponte, cidade e prédio: corpos não cavam o deck / footprint.
  const reservado = !!(rua || predio || zona?.tipo === "cidade");

  return {
    h,
    hLeito,
    ponte,
    bioma: par.bioma,
    biomaB: par.biomaB,
    dominio: par.dominio,
    rua,
    floresta,
    predio: predio && !predioSprite(predio.papel) ? predio.altura : 0,
    entradaLab: !!(zona.tipo === "cidade" && zona.layout && noQuintalDoLote(lx, ly, zona.layout)),
    modelo: !!(predio && (predio.modelo || predioSprite(predio.papel))),
    nome: zona.nome,
    reservado,
  };
}

function aplicarAguaNoRelevo(x, y, base) {
  if (base.reservado) return base.h;
  amostraCorpo(x, y, base.h, CAMPO);
  if (!CAMPO.tem) return base.h;
  if (CAMPO.sobe) return clampAltura(CAMPO.altura | 0);
  const cava = CAMPO.cava || 0;
  if (cava <= 0) return base.h;
  // Leito = superfície da água (baseH - 1) menos a profundidade cavada.
  const superficie = Math.max(1, (CAMPO.superficie | 0) || (base.h | 0) - 1);
  return clampAltura(superficie - cava);
}

function calcular(x, y) {
  const base = calcularBase(x, y);
  if (!base) return null;
  const h = aplicarAguaNoRelevo(x, y, base);
  return {
    h,
    hLeito: base.hLeito,
    ponte: base.ponte,
    bioma: base.bioma,
    biomaB: base.biomaB,
    dominio: base.dominio,
    rua: base.rua,
    floresta: base.floresta,
    predio: base.predio,
    entradaLab: base.entradaLab,
    modelo: base.modelo,
    nome: base.nome,
  };
}

ligarConsultasCorpo(reservaAguaLocal, alturaBaseLocal);

export function amostraKanto(wx, wy) {
  if (!dentroDoKanto(wx, wy)) return null;
  const local = paraLocalKanto(wx, wy);
  const x = local.x | 0;
  const y = local.y | 0;
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
