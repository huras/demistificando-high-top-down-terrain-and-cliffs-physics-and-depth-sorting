/**
 * Amostra do mapa. Mesmas sementes do terreno, sem o cache de uma célula
 * que o mundo usa o frame inteiro. A costa sai de um campo de distância
 * da grade de relevo, perturbado pelo mesmo fbm.
 */
import {
  alturaDoRelevo,
  biomaDominante,
  nivelMarBlocos,
  pesoCosturaRelevo,
} from "../../mundo/bioma/catalogo.js";
import { vegetacaoNoPonto } from "../../mundo/bioma/detalhe.js";
import { obterKit } from "../../mundo/bioma/kits.js";
import {
  deLocalKanto,
  dentroDoMundo,
  paraLocalKanto,
} from "../../mundo/bounds.js";
import { amostraCorpo } from "../../mundo/agua/corpos.js";
import { fluidoDe } from "../../mundo/agua/fluidos.js";
import { BIOMA_KANTO, alturaBaseKanto, amostraKanto } from "../../mundo/regiao/amostraKanto.js";
import { parBiomaKanto } from "../../mundo/regiao/biomasKanto.js";
import { aplicarDetalheBioma } from "../../mundo/regiao/detalheRelevo.js";
import {
  AREA_KANTO,
  CENTRO_AREA,
  EXTENSAO_KANTO,
  LADO_KANTO,
  SAIDA_LESTE,
  SAIDA_NORTE,
  SAIDA_OESTE,
  SAIDA_SUL,
  zonaEm,
} from "../../mundo/regiao/grafoKanto.js";
import {
  RELEVO_FUNDO,
  RELEVO_MONTANHA,
  RELEVO_RASO,
  RELEVO_TERRA,
  relevoEm,
} from "../../mundo/regiao/kantoRelevo.js";
import { noFootprint, noQuintalDoLote, predioNoLayout, ruaNoLayout } from "../../mundo/regiao/volumesCidade.js";
import { fbm2 } from "../../mundo/voxel/ruido.js";
import {
  COPA,
  FORCA_COPA,
  FORCA_GRAMA,
  FORCA_MOTE_ARVORE,
  FORCA_MOTE_GRAMA,
  GRAMA_CAMPO,
  MOTE_ARVORE,
  MOTE_GRAMA,
  empacotarVeg,
} from "./coresVeg.js";

const COTA_CIDADE = 16;
const COTA_MONTANHA = 72;
const COTA_PICO = 108;
const COTA_RASO = 10;
const COTA_FUNDO = 8;
const SEMENTE = 1337;
const MEIO_RUA = 3.5;
const SANGRIA = 4;
const AVENTAL = 18;
const N = 512;
const PASSO = EXTENSAO_KANTO / N;

const AGUA_FUNDO = [20, 62, 102];
const AGUA_RASO = [58, 142, 184];

const PALETA = new Map();
const SAIDA = { h: 0, u: 0, r: 0, g: 0, b: 0 };
const CORPO = { tem: 0 };

let distAgua = null;
let distTerra = null;
let distForaMonte = null;

function rgbDe(hex) {
  const cru = (hex || "#7dce6a").replace("#", "");
  const h = cru.length === 3 ? cru.replace(/./g, (c) => c + c) : cru.slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

for (const chave of Object.keys(BIOMA_KANTO)) {
  PALETA.set(BIOMA_KANTO[chave], rgbDe(BIOMA_KANTO[chave].cor));
}

function edt1d(f, d, v, z) {
  const n = f.length;
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k += 1;
    const dx = q - v[k];
    d[q] = dx * dx + f[v[k]];
  }
}

function distancia(mask) {
  const inf = N * N;
  const g = new Float64Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = mask[i] ? 0 : inf;
  const f = new Float64Array(N);
  const d = new Float64Array(N);
  const v = new Int32Array(N);
  const z = new Float64Array(N + 1);
  for (let y = 0; y < N; y++) {
    const o = y * N;
    for (let x = 0; x < N; x++) f[x] = g[o + x];
    edt1d(f, d, v, z);
    for (let x = 0; x < N; x++) g[o + x] = d[x];
  }
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) f[y] = g[y * N + x];
    edt1d(f, d, v, z);
    for (let y = 0; y < N; y++) g[y * N + x] = d[y];
  }
  const out = new Float32Array(N * N);
  for (let i = 0; i < out.length; i++) {
    const blocos = Math.sqrt(g[i]) * PASSO;
    out[i] = blocos > 480 ? 480 : blocos;
  }
  return out;
}

function pintarMascara(mask, casa) {
  const cel = N / LADO_KANTO;
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      if (!casa(relevoEm(ax, ay))) continue;
      const x0 = ax * cel;
      const y0 = ay * cel;
      const x1 = x0 + cel;
      const y1 = y0 + cel;
      for (let y = y0; y < y1; y++) {
        const o = y * N;
        for (let x = x0; x < x1; x++) mask[o + x] = 1;
      }
    }
  }
}

export function prepararMapa() {
  if (distAgua) return;
  const agua = new Uint8Array(N * N);
  const terra = new Uint8Array(N * N);
  const fora = new Uint8Array(N * N);
  pintarMascara(agua, (b) => b === RELEVO_FUNDO || b === RELEVO_RASO || b === 255);
  pintarMascara(terra, (b) => b === RELEVO_TERRA || b === RELEVO_MONTANHA);
  pintarMascara(fora, (b) => b !== RELEVO_MONTANHA && b !== 255);
  distAgua = distancia(agua);
  distTerra = distancia(terra);
  distForaMonte = distancia(fora);
}

function ler(campo, wx, wy) {
  const u = wx / PASSO - 0.5;
  const v = wy / PASSO - 0.5;
  const x0 = Math.max(0, Math.min(N - 1, Math.floor(u)));
  const y0 = Math.max(0, Math.min(N - 1, Math.floor(v)));
  const x1 = Math.min(N - 1, x0 + 1);
  const y1 = Math.min(N - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, u - x0));
  const ty = Math.max(0, Math.min(1, v - y0));
  const i00 = campo[y0 * N + x0];
  const i10 = campo[y0 * N + x1];
  const i01 = campo[y1 * N + x0];
  const i11 = campo[y1 * N + x1];
  const a = i00 + (i10 - i00) * tx;
  const b = i01 + (i11 - i01) * tx;
  return a + (b - a) * ty;
}

function perfilEm(x, y) {
  const onda = (fbm2(x * 0.006, y * 0.006, SEMENTE + 17, 4) - 0.5) * 110;
  const afast = ler(distAgua, x, y) - ler(distTerra, x, y) + onda;
  const faixa = 30;
  let u = (afast + faixa) / (faixa * 2);
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  u = u * u * (3 - 2 * u);
  return { u, dentro: ler(distForaMonte, x, y) };
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
  if (zona.tipo === "cidade") return zona.layout ? ruaCidade(lx, ly, zona) : false;
  if (zona.tipo !== "rota") return false;
  if (zona.caminho) return noCaminho(lx, ly, zona.caminho);
  return corredor(lx, ly, zona.saidas);
}

function florestaEm(lx, ly, zona) {
  if (!zona) return false;
  if (zona.densa || zona.floresta) return true;
  if (!zona.sangria) return false;
  if ((zona.sangria & SAIDA_NORTE) && ly < SANGRIA) return true;
  if ((zona.sangria & SAIDA_SUL) && ly >= AREA_KANTO - SANGRIA) return true;
  if ((zona.sangria & SAIDA_OESTE) && lx < SANGRIA) return true;
  if ((zona.sangria & SAIDA_LESTE) && lx >= AREA_KANTO - SANGRIA) return true;
  return false;
}

function distanciaFora(lx, ly, fp) {
  let dist = 0;
  if (lx < fp.x0) dist = fp.x0 - lx;
  else if (lx >= fp.x1) dist = lx - fp.x1 + 1;
  if (ly < fp.y0) dist = Math.max(dist, fp.y0 - ly);
  else if (ly >= fp.y1) dist = Math.max(dist, ly - fp.y1 + 1);
  return dist;
}

function alturaNatural(x, y, zona, perfil) {
  const byte = relevoEm(zona.ax, zona.ay);
  const n = fbm2(x * 0.02, y * 0.02, SEMENTE, 2);
  const plano = COTA_CIDADE + Math.round((n - 0.5) * 3);
  const montanha = zona.montanha || byte === RELEVO_MONTANHA;
  let terra = plano;
  if (montanha) {
    const t = Math.min(1, perfil.dentro / 32);
    const pico = Math.max(COTA_MONTANHA, Math.min(COTA_PICO, Math.round(COTA_MONTANHA + n * (COTA_PICO - COTA_MONTANHA))));
    terra = Math.round(plano + (pico - plano) * t);
  }
  return Math.round(COTA_FUNDO + (terra - COTA_FUNDO) * perfil.u);
}

function cotaAgua(zona) {
  const byte = relevoEm(zona.ax, zona.ay);
  return byte === RELEVO_RASO ? COTA_RASO : COTA_FUNDO;
}

function cotaDaRua(zona) {
  if (!zona || zona.tipo === "cidade") return COTA_CIDADE;
  if (zona.agua) return cotaAgua(zona);
  const byte = relevoEm(zona.ax, zona.ay);
  if (zona.montanha || byte === RELEVO_MONTANHA) return COTA_MONTANHA;
  return COTA_CIDADE;
}

function alturaEm(x, y, lx, ly, zona, perfil, rua) {
  if (!zona) return COTA_FUNDO;
  // Canal de surf no corredor; fora dele, costa do relevo (não mar na célula toda).
  if (rua) return cotaDaRua(zona);
  if (zona.tipo === "cidade" && zona.layout) {
    if (noFootprint(lx, ly, zona.layout)) return COTA_CIDADE;
    const natural = alturaNatural(x, y, zona, perfil);
    const dist = distanciaFora(lx, ly, zona.layout.fp);
    if (dist >= AVENTAL) return natural;
    return Math.round(COTA_CIDADE + (natural - COTA_CIDADE) * (dist / AVENTAL));
  }
  return alturaNatural(x, y, zona, perfil);
}

function corBase(bioma, u) {
  if (u < 0.34) {
    const t = u / 0.34;
    const s = t * t;
    return [
      AGUA_FUNDO[0] + (AGUA_RASO[0] - AGUA_FUNDO[0]) * s,
      AGUA_FUNDO[1] + (AGUA_RASO[1] - AGUA_FUNDO[1]) * s,
      AGUA_FUNDO[2] + (AGUA_RASO[2] - AGUA_FUNDO[2]) * s,
    ];
  }
  return PALETA.get(bioma) || PALETA.get(BIOMA_KANTO.grama);
}

function corDoPar(par, u) {
  const a = corBase(par.bioma, u);
  if (u < 0.34 || par.dominio >= 1 || par.bioma === par.biomaB) return a;
  const b = corBase(par.biomaB, u);
  const t = par.dominio;
  return [
    a[0] * t + b[0] * (1 - t),
    a[1] * t + b[1] * (1 - t),
    a[2] * t + b[2] * (1 - t),
  ];
}

function misturar(rgb, cor, t) {
  return [
    rgb[0] + (cor[0] - rgb[0]) * t,
    rgb[1] + (cor[1] - rgb[1]) * t,
    rgb[2] + (cor[2] - rgb[2]) * t,
  ];
}

function aplicarVeg(rgb, bioma, limpo, x, y, comMote) {
  if (limpo) return rgb;
  const kit = obterKit(bioma?.kit);
  const veg = vegetacaoNoPonto(x, y, comMote);
  const podeArvore = !!kit?.arvore?.length;
  const podeGrama = !!kit?.grama?.length;
  let cor = rgb;
  if (podeGrama && veg.grama > 0.04) {
    cor = misturar(cor, GRAMA_CAMPO, Math.min(FORCA_GRAMA, veg.grama * 0.9));
  }
  if (comMote && veg.mote === 1 && podeGrama) cor = misturar(cor, MOTE_GRAMA, FORCA_MOTE_GRAMA);
  // Copa por cima da grama — senão o halo da marca some onde tem tufo.
  if (podeArvore && veg.arvore > 0.04) {
    cor = misturar(cor, COPA, Math.min(FORCA_COPA, veg.arvore * 0.9));
  }
  if (comMote && veg.mote === 2 && podeArvore) cor = misturar(cor, MOTE_ARVORE, FORCA_MOTE_ARVORE);
  return cor;
}

/** x,y em coords locais da ilha. */
function lerPontoLocal(wx, wy) {
  prepararMapa();
  const x = Math.max(0, Math.min(EXTENSAO_KANTO - 0.01, wx));
  const y = Math.max(0, Math.min(EXTENSAO_KANTO - 0.01, wy));
  const ax = (x / AREA_KANTO) | 0;
  const ay = (y / AREA_KANTO) | 0;
  const zona = zonaEm(ax, ay);
  const lx = x - ax * AREA_KANTO;
  const ly = y - ay * AREA_KANTO;
  const perfil = perfilEm(x, y);
  const rua = ehRua(lx, ly, zona);
  const predio = !!(zona?.tipo === "cidade" && zona.layout && !rua && predioNoLayout(lx, ly, zona.layout));
  const entrada = !!(zona?.tipo === "cidade" && zona.layout && noQuintalDoLote(lx, ly, zona.layout));
  const noFp = !!(zona?.tipo === "cidade" && zona.layout && noFootprint(lx, ly, zona.layout));
  let h = alturaEm(x, y, lx, ly, zona, perfil, rua || predio);
  const floresta = !rua && !predio && h >= COTA_CIDADE && florestaEm(lx, ly, zona);
  const par = parBiomaKanto(x, y, perfil.u, perfil.dentro, floresta, predio, rua);
  const travado = !!(rua || predio || noFp);
  h = aplicarDetalheBioma(h, x, y, par, perfil.u, travado);
  const bioma = par.bioma;
  const sobAgua = h < nivelMarBlocos();
  const limpo =
    rua ||
    predio ||
    entrada ||
    sobAgua ||
    perfil.u < 0.72 ||
    bioma.superficie === "pedra";
  return { x, y, h, u: perfil.u, par, bioma, limpo, rua, predio };
}

function aplicarCorpoLocal(ponto, rgb) {
  if (ponto.rua || ponto.predio) return { h: ponto.h, u: ponto.u, rgb };
  const mundo = deLocalKanto(ponto.x, ponto.y);
  const baseH = alturaBaseKanto(mundo.x, mundo.y);
  amostraCorpo(ponto.x, ponto.y, baseH, CORPO);
  if (!CORPO.tem) return { h: ponto.h, u: ponto.u, rgb };
  if (CORPO.sobe) {
    return { h: CORPO.altura | 0, u: ponto.u, rgb };
  }
  const cava = Math.max(1, Math.min(2, CORPO.cava | 0));
  const superficie = Math.max(1, (CORPO.superficie | 0) || baseH - 1);
  const h = Math.max(1, superficie - cava);
  if (CORPO.fluido) {
    const fam = fluidoDe(CORPO.fluido);
    return {
      h: superficie,
      u: cava >= 2 ? 0.18 : 0.22,
      rgb: fam.lamina,
    };
  }
  return { h, u: ponto.u, rgb };
}

function pintarKanto(wx, wy, comMote, saida) {
  const nivel = nivelMarBlocos();
  // Altura do mundo (amostraKanto) manda no mar — lerPontoLocal às vezes
  // sobe a cota com detalhe/costa e pinta terra fantasma no zoom longe.
  const mundo = amostraKanto(wx, wy);
  if (mundo && mundo.h < nivel) return pintarAgua(mundo.h, nivel, saida);

  const local = paraLocalKanto(wx, wy);
  const ponto = lerPontoLocal(local.x, local.y);
  if (ponto.h < nivel) return pintarAgua(ponto.h, nivel, saida);
  // wx/wy mundiais — mesmo espaço de plantaNoBioma / props do chunk.
  const base = aplicarVeg(corDoPar(ponto.par, ponto.u), ponto.bioma, ponto.limpo, wx, wy, comMote);
  const corpo = aplicarCorpoLocal(ponto, base);
  if (corpo.h < nivel) return pintarAgua(corpo.h, nivel, saida);
  saida.h = corpo.h;
  saida.u = corpo.u;
  saida.r = corpo.rgb[0];
  saida.g = corpo.rgb[1];
  saida.b = corpo.rgb[2];
  return saida;
}

function pintarProcedural(wx, wy, comMote, saida) {
  const h = alturaDoRelevo(wx, wy);
  const bioma = biomaDominante(wx, wy);
  const nivel = nivelMarBlocos();
  const u = h < nivel ? Math.max(0.05, (h / nivel) * 0.45) : 1;
  let rgb = rgbDe(bioma?.cor || "#3a7a4a");
  if (h < nivel) {
    const t = Math.max(0, Math.min(1, h / nivel));
    rgb = misturar(AGUA_FUNDO, AGUA_RASO, t);
  } else {
    const limpo = bioma?.superficie === "pedra" || bioma?.camada === "mar";
    // Não gatear em plantaNoBioma: o halo da copa pinta células vizinhas sem prop.
    rgb = aplicarVeg(rgb, bioma, limpo, wx, wy, comMote);
  }
  saida.h = h;
  saida.u = u;
  saida.r = rgb[0] | 0;
  saida.g = rgb[1] | 0;
  saida.b = rgb[2] | 0;
  return saida;
}

const TMP_A = { h: 0, u: 0, r: 0, g: 0, b: 0 };
const TMP_B = { h: 0, u: 0, r: 0, g: 0, b: 0 };

function pintarAgua(h, nivel, saida) {
  const th = Math.max(0, Math.min(1, h / nivel));
  const rgb = misturar(AGUA_FUNDO, AGUA_RASO, th);
  saida.h = Math.min(h, nivel - 1);
  saida.u = Math.max(0.05, th * 0.45);
  saida.r = rgb[0] | 0;
  saida.g = rgb[1] | 0;
  saida.b = rgb[2] | 0;
  return saida;
}

/** Preenche `saida` com altura, costa e cor. `comMote` liga o pontilhado do zoom perto. */
export function amostraMapa(wx, wy, comMote, saida = SAIDA) {
  if (!dentroDoMundo(wx, wy)) {
    saida.h = 4;
    saida.u = 0.1;
    saida.r = AGUA_FUNDO[0];
    saida.g = AGUA_FUNDO[1];
    saida.b = AGUA_FUNDO[2];
    return saida;
  }
  const nivel = nivelMarBlocos();
  const t = pesoCosturaRelevo(wx, wy);
  if (t <= 0) return pintarKanto(wx, wy, comMote, saida);
  if (t >= 1) {
    pintarProcedural(wx, wy, comMote, saida);
    // Dentro do oceano authored: sem ilha fantasma no zoom longe.
    const hK = amostraKanto(wx, wy)?.h;
    if (Number.isFinite(hK) && hK < nivel) return pintarAgua(Math.min(saida.h, nivel - 1), nivel, saida);
    return saida;
  }
  pintarKanto(wx, wy, comMote, TMP_A);
  pintarProcedural(wx, wy, comMote, TMP_B);
  const u = 1 - t;
  saida.h = Math.round(TMP_A.h * u + TMP_B.h * t);
  saida.u = TMP_A.u * u + TMP_B.u * t;
  if (TMP_A.h < nivel) {
    // Oceano de Kanto: só mistura profundidade/cor de água (nunca terra procedural).
    const hAgua = Math.min(saida.h, nivel - 1);
    if (TMP_B.h < nivel) {
      saida.h = hAgua;
      saida.r = (TMP_A.r * u + TMP_B.r * t) | 0;
      saida.g = (TMP_A.g * u + TMP_B.g * t) | 0;
      saida.b = (TMP_A.b * u + TMP_B.b * t) | 0;
      saida.u = Math.max(0.05, (hAgua / nivel) * 0.45);
      return saida;
    }
    return pintarAgua(hAgua, nivel, saida);
  }
  saida.r = (TMP_A.r * u + TMP_B.r * t) | 0;
  saida.g = (TMP_A.g * u + TMP_B.g * t) | 0;
  saida.b = (TMP_A.b * u + TMP_B.b * t) | 0;
  return saida;
}

/** Um byte por bloco para o zoom íntimo. Rua, prédio e água ficam zerados. */
export function byteNoPonto(wx, wy) {
  if (!dentroDoMundo(wx, wy)) return 0;
  const nivel = nivelMarBlocos();
  const t = pesoCosturaRelevo(wx, wy);
  if (t < 0.55) {
    const local = paraLocalKanto(wx, wy);
    const ponto = lerPontoLocal(local.x, local.y);
    const mundoAmostra = amostraKanto(wx, wy);
    if (mundoAmostra && mundoAmostra.h < nivel) return 0;
    if (ponto.h < nivel) return 0;
    const mundo = deLocalKanto(ponto.x, ponto.y);
    amostraCorpo(ponto.x, ponto.y, alturaBaseKanto(mundo.x, mundo.y), CORPO);
    if (CORPO.tem && CORPO.fluido && !ponto.rua && !ponto.predio) return 0;
    if (ponto.limpo) return 0;
    const kit = obterKit(ponto.bioma?.kit);
    const veg = vegetacaoNoPonto(wx, wy, true);
    const podeArvore = !!kit?.arvore?.length;
    const podeGrama = !!kit?.grama?.length;
    let mote = 0;
    if (podeArvore && veg.mote === 2) mote = 2;
    else if (podeGrama && veg.mote === 1) mote = 1;
    return empacotarVeg(podeGrama ? veg.grama : 0, podeArvore ? veg.arvore : 0, mote);
  }
  const bioma = biomaDominante(wx, wy);
  const h = alturaDoRelevo(wx, wy);
  if (h < nivelMarBlocos()) return 0;
  if (bioma?.superficie === "pedra" || bioma?.camada === "mar") return 0;
  const kit = obterKit(bioma?.kit);
  const veg = vegetacaoNoPonto(wx, wy, true);
  const podeArvore = !!kit?.arvore?.length;
  const podeGrama = !!kit?.grama?.length;
  let mote = 0;
  if (podeArvore && veg.mote === 2) mote = 2;
  else if (podeGrama && veg.mote === 1) mote = 1;
  return empacotarVeg(podeGrama ? veg.grama : 0, podeArvore ? veg.arvore : 0, mote);
}
