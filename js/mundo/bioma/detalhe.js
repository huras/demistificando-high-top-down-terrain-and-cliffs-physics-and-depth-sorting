/**
 * Portas de grama, árvore, pedra e splat.
 * O FBM assinado é o classic noise 2D (webgl-noise, MIT), o mesmo campo
 * das portas do Pokémon AI. O fbm 0..1 do terreno não serve para esses limiares.
 */
import { hash2 } from "../voxel/ruido.js";
import { obterKit, sortearSprite } from "./kits.js";

const DESLOC_X = 412.71;
const DESLOC_Y = 317.93;
const SEMENTE_SPLAT = 53;

/** @type {object | null} */
let dados = null;
let revisao = 0;
/** @type {Map<string, object>} */
const planos = new Map();
/** @type {Map<string, number | boolean>} */
const cache = new Map();
/** @type {Map<string, number>} */
let indicePele = new Map();

function mod289(x) {
  return x - Math.floor(x * (1 / 289)) * 289;
}

function permute(x) {
  return mod289((x * 34 + 10) * x);
}

function taylorInvSqrt(r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function cnoise(x, y, seed = 0) {
  const Pi0 = Math.floor(x);
  const Pi1 = Pi0 + 1;
  const Pj0 = Math.floor(y);
  const Pj1 = Pj0 + 1;
  const sx = seed ? mod289(Math.imul(seed, 271) & 0x7fffff) : 0;
  const sy = seed ? mod289(Math.imul(seed, 787) & 0x7fffff) : 0;
  const ix0 = mod289(Pi0 + sx);
  const ix1 = mod289(Pi1 + sx);
  const iy0 = mod289(Pj0 + sy);
  const iy1 = mod289(Pj1 + sy);
  const fx0 = x - Pi0;
  const fy0 = y - Pj0;
  const fx1 = fx0 - 1;
  const fy1 = fy0 - 1;
  const i00 = permute(permute(ix0) + iy0);
  const i10 = permute(permute(ix1) + iy0);
  const i01 = permute(permute(ix0) + iy1);
  const i11 = permute(permute(ix1) + iy1);

  function grad(hash, xg, yg) {
    const hf = hash * (1 / 41) - Math.floor(hash * (1 / 41));
    let gx = hf * 2 - 1;
    let gy = Math.abs(gx) - 0.5;
    const tx = Math.floor(gx + 0.5);
    gx -= tx;
    const norm = taylorInvSqrt(gx * gx + gy * gy);
    return norm * (gx * xg + gy * yg);
  }

  const n00 = grad(i00, fx0, fy0);
  const n10 = grad(i10, fx1, fy0);
  const n01 = grad(i01, fx0, fy1);
  const n11 = grad(i11, fx1, fy1);
  const u = fade(fx0);
  const v = fade(fy0);
  const nx0 = n00 + u * (n10 - n00);
  const nx1 = n01 + u * (n11 - n01);
  return 2.3 * (nx0 + v * (nx1 - nx0));
}

function fbm(x, y, oitavas, persistencia, lacunaridade, seed = 0) {
  let valor = 0;
  let amplitude = 1;
  let frequencia = 1;
  let maximo = 0;
  const n = Math.max(1, oitavas | 0);
  const pers = Number.isFinite(persistencia) ? persistencia : 0.5;
  const lac = Number.isFinite(lacunaridade) ? lacunaridade : 2;
  for (let i = 0; i < n; i++) {
    valor += amplitude * cnoise(x * frequencia, y * frequencia, seed);
    maximo += amplitude;
    amplitude *= pers;
    frequencia *= lac;
  }
  return maximo > 0 ? valor / maximo : 0;
}

function sementeCanal(canal, sal) {
  const c = ((canal | 0) + 1) & 0xffff;
  let h = Math.imul(c, 374761393) ^ Math.imul(sal | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 13) % 9973) + 1;
}

function lembrar(chave, calcular) {
  if (cache.has(chave)) return cache.get(chave);
  const valor = calcular();
  if (cache.size > 80000) cache.clear();
  cache.set(chave, valor);
  return valor;
}

function campoDe(ruido, sal) {
  if (!ruido) return null;
  const canal = ruido.canal | 0;
  return {
    freq: Number(ruido.freq) || 0.04,
    limiar: Number.isFinite(Number(ruido.limiar)) ? Number(ruido.limiar) : 0,
    oitavas: Math.max(1, ruido.oitavas | 0 || 2),
    persistencia: Number.isFinite(Number(ruido.persistencia)) ? Number(ruido.persistencia) : 0.5,
    lacunaridade: Number.isFinite(Number(ruido.lacunaridade)) ? Number(ruido.lacunaridade) : 2,
    ox: canal * DESLOC_X,
    oy: canal * DESLOC_Y,
    semente: sementeCanal(canal, sal | 0),
  };
}

function amostraCampo(x, y, campo) {
  const chave = `c${campo.semente}:${campo.freq}:${x},${y}`;
  return lembrar(chave, () =>
    fbm(
      (x + campo.ox) * campo.freq,
      (y + campo.oy) * campo.freq,
      campo.oitavas,
      campo.persistencia,
      campo.lacunaridade,
      campo.semente,
    ),
  );
}

export function definirDetalhe(proximo) {
  dados = proximo || null;
  revisao += 1;
  planos.clear();
  cache.clear();
  indicePele = new Map();
  const peles = dados?.peles || {};
  const nomes = Object.keys(peles);
  for (let i = 0; i < nomes.length; i++) indicePele.set(nomes[i], i + 1);
}

export function obterDetalhe() {
  return dados;
}

export async function carregarDetalhe() {
  const res = await fetch("biomas/detalhe.json", { cache: "no-store" });
  if (!res.ok) throw new Error("biomas/detalhe.json");
  definirDetalhe(await res.json());
}

function listaGrama(bioma, kit) {
  const pesos = dados?.pesosGrama?.[bioma.id] || {};
  const ruidoBioma = dados?.ruidoGrama?.[bioma.id] || {};
  const negarBioma = dados?.negarGrama?.[bioma.id] || {};
  const global = dados?.ruidoSprite || {};
  const lista = [];
  const itens = kit?.grama || [];
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    const id = item?.id;
    if (!id) continue;
    const mult = Object.prototype.hasOwnProperty.call(pesos, id) ? Number(pesos[id]) : 1;
    if (!(mult > 0)) continue;
    const peso = Math.max(0, Number(item.peso) || 0) * mult;
    if (!(peso > 0)) continue;
    lista.push({
      id,
      peso,
      selecao: campoDe(ruidoBioma[id] || global[id], 0),
      negacao: campoDe(negarBioma[id], 0),
    });
  }
  return lista;
}

function familiasDo(bioma) {
  const todas = dados?.pedras || [];
  const minhas = [];
  for (let i = 0; i < todas.length; i++) {
    const pedra = todas[i];
    if (pedra.biomas?.includes(bioma.id)) minhas.push(pedra);
  }
  const porId = new Map();
  for (let i = 0; i < minhas.length; i++) porId.set(minhas[i].id, minhas[i]);
  const usado = new Set();
  const familias = [];
  const grupos = dados?.familias || [];
  for (let i = 0; i < grupos.length; i++) {
    const membros = [];
    const ordem = grupos[i].membros || [];
    for (let m = 0; m < ordem.length; m++) {
      const pedra = porId.get(ordem[m]);
      if (!pedra) continue;
      membros.push(pedra);
      usado.add(pedra.id);
    }
    if (membros.length) familias.push(membros);
  }
  for (let i = 0; i < minhas.length; i++) {
    if (!usado.has(minhas[i].id)) familias.push([minhas[i]]);
  }
  return familias;
}

function planoDe(bioma) {
  const id = bioma?.id || "";
  const pronto = planos.get(id);
  if (pronto && pronto.revisao === revisao) return pronto;
  const kit = obterKit(bioma?.kit);
  const plano = {
    revisao,
    mar: bioma?.camada === "mar",
    grama: listaGrama(bioma, kit),
    arvore: kit?.arvore || [],
    familias: familiasDo(bioma),
    cristais: new Set((kit?.cristal || []).map((item) => item.id)),
  };
  planos.set(id, plano);
  return plano;
}

function valorGrama(x, y) {
  const g = dados?.grama;
  if (!g) return null;
  const seed = g.semente | 0;
  return {
    n: fbm(
      (x + seed * 23.9) * (Number(g.escala) || 0.0055),
      (y + seed * 11.4) * (Number(g.escala) || 0.0055),
      g.oitavas | 0 || 2,
      g.persistencia,
      g.lacunaridade,
      0,
    ),
    limiar: Number(g.limiar) || 0,
    densidade: Number(g.densidade) || 0,
    seed,
  };
}

function valorArvore(x, y) {
  const a = dados?.arvore;
  if (!a) return null;
  const seed = a.semente | 0;
  return {
    n: fbm(
      (x + seed * 17.3) * (Number(a.escala) || 0.0452),
      (y + seed * 31.7) * (Number(a.escala) || 0.0452),
      a.oitavas | 0 || 4,
      a.persistencia,
      a.lacunaridade,
      0,
    ),
    limiar: Number(a.limiar) || 0,
    densidade: Number(a.densidade) || 0,
    seed,
  };
}

function passaGrama(x, y) {
  const v = valorGrama(x, y);
  if (!v || v.n < v.limiar) return false;
  return hash2(x, y, v.seed ^ 0x6c078965) <= v.densidade;
}

const VEG = { arvore: 0, grama: 0, mote: 0 };

/**
 * Raio da marca de copa (células mundo). Spawn/mote = 1 célula.
 * Perto (comHash, 1 px/bloco): 2 → marca ~2×.
 * Visão (!comHash, 1 px/4 blocos): 4 → ~2× no atlas longe.
 */
function raioMarcaArvore(comHash) {
  return comHash ? 2 : 4;
}

function forcaArvoreSpawn(ox, oy) {
  if (!passaArvore(ox, oy) || !ganhaPegada(ox, oy)) return 0;
  const a = valorArvore(ox, oy);
  if (!a) return 0;
  const faixa = Math.max(0.25, 0.7 - a.limiar);
  return Math.min(1, Math.max(0.35, (a.n - a.limiar) / faixa));
}

/**
 * Cobertura do campo no ponto (mapa).
 * Árvore usa o mesmo filtro do mundo (passaArvore + ganhaPegada).
 * A marca de copa é maior que a célula de spawn — aproximação visual, não inventário.
 */
export function vegetacaoNoPonto(x, y, comHash, saida = VEG) {
  const xi = x | 0;
  const yi = y | 0;
  saida.arvore = 0;
  saida.grama = 0;
  saida.mote = 0;

  const noCentro = forcaArvoreSpawn(xi, yi);
  if (noCentro > 0) {
    saida.arvore = noCentro;
    if (comHash) saida.mote = 2;
  } else {
    let melhor = 0;
    const raio = raioMarcaArvore(comHash);
    for (let oy = yi - raio; oy <= yi + raio; oy++) {
      for (let ox = xi - raio; ox <= xi + raio; ox++) {
        const f = forcaArvoreSpawn(ox, oy);
        if (f <= 0) continue;
        const t = Math.max(0, 1 - Math.hypot(ox + 0.5 - x, oy + 0.5 - y) / (raio + 0.5));
        melhor = Math.max(melhor, f * (0.55 + 0.45 * t));
      }
    }
    saida.arvore = melhor;
  }

  const g = valorGrama(xi, yi);
  if (g && g.n >= g.limiar) {
    const faixa = Math.max(0.25, 0.7 - g.limiar);
    saida.grama = Math.min(1, (g.n - g.limiar) / faixa);
    if (comHash && saida.mote === 0 && hash2(xi, yi, g.seed ^ 0x6c078965) <= g.densidade) {
      saida.mote = 1;
    }
  }
  return saida;
}

function uVariante(x, y) {
  const v = dados?.grama?.variante;
  if (!v) return hash2(x, y, 0x67726173);
  const seed = v.semente | 0;
  const n = fbm(
    (x + seed * 17.3) * (Number(v.escala) || 0.07),
    (y + seed * 9.1) * (Number(v.escala) || 0.07),
    v.oitavas | 0 || 1,
    v.persistencia,
    v.lacunaridade,
    0,
  );
  const suave = Math.max(0, Math.min(1, (n + 1) * 0.5));
  const celula = hash2(x, y, seed ^ 0x67726173);
  const tremor = Math.max(0, Math.min(1, Number(v.tremor) || 0));
  return suave * (1 - tremor) + celula * tremor;
}

function escolherGrama(x, y, lista) {
  const vivas = [];
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (item.negacao && amostraCampo(x, y, item.negacao) >= item.negacao.limiar) continue;
    vivas.push(item);
  }
  if (!vivas.length) return null;
  const comCanal = [];
  const semCanal = [];
  for (let i = 0; i < vivas.length; i++) {
    if (vivas[i].selecao) comCanal.push(vivas[i]);
    else semCanal.push(vivas[i]);
  }
  if (comCanal.length) {
    let melhor = null;
    let nota = 0;
    for (let i = 0; i < comCanal.length; i++) {
      const item = comCanal[i];
      const n = amostraCampo(x, y, item.selecao);
      const s = (n - item.selecao.limiar) * item.peso;
      if (s > nota) {
        nota = s;
        melhor = item;
      }
    }
    if (melhor) return melhor.id;
    const buraco = semCanal.length ? semCanal : comCanal;
    return sortearSprite(buraco.map((item) => ({ id: item.id, peso: item.peso })), uVariante(x, y));
  }
  return sortearSprite(vivas.map((item) => ({ id: item.id, peso: item.peso })), uVariante(x, y));
}

function passaArvore(x, y) {
  const a = dados?.arvore;
  if (!a) return false;
  return lembrar(`a${x},${y}`, () => {
    const v = valorArvore(x, y);
    if (!v || v.n < v.limiar) return false;
    return hash2(x, y, v.seed) <= v.densidade;
  });
}

function ganhaPegada(x, y) {
  const a = dados?.arvore;
  if (!a) return false;
  const w = Math.max(1, a.largura | 0 || 2);
  const h = Math.max(1, a.altura | 0 || 3);
  const seed = (a.semente | 0) ^ 0xa24baed5;
  const meu = hash2(x, y, seed);
  for (let oy = y - (h - 1); oy <= y + (h - 1); oy++) {
    for (let ox = x - (w - 1); ox <= x + (w - 1); ox++) {
      if (ox === x && oy === y) continue;
      if (!(x < ox + w && x + w > ox && y < oy + h && y + h > oy)) continue;
      if (!passaArvore(ox, oy)) continue;
      const outro = hash2(ox, oy, seed);
      if (outro < meu || (outro === meu && (oy < y || (oy === y && ox < x)))) return false;
    }
  }
  return true;
}

function melhorDaFamilia(x, y, familias) {
  let melhor = null;
  let nota = -Infinity;
  for (let f = 0; f < familias.length; f++) {
    const membros = familias[f];
    if (!membros.length) continue;
    const piloto = campoDe(membros[0], 0);
    if (!piloto) continue;
    const n = amostraCampo(x, y, piloto);
    for (let i = 0; i < membros.length; i++) {
      const item = membros[i];
      const limiar = Number(item.limiar) || 0;
      if (n < limiar) continue;
      const s = n - limiar;
      if (s > nota) {
        nota = s;
        melhor = item;
      }
    }
  }
  return melhor;
}

function escolherPedra(x, y, familias, cristais) {
  const rochas = [];
  const cristaisFam = [];
  for (let f = 0; f < familias.length; f++) {
    const membros = familias[f];
    const cristal = membros.every((item) => item.cristal || cristais.has(item.id));
    if (cristal) cristaisFam.push(membros);
    else rochas.push(membros);
  }
  const rocha = melhorDaFamilia(x, y, rochas);
  if (rocha) return { classe: "pedra", sprite: rocha.id };
  const cristal = melhorDaFamilia(x, y, cristaisFam);
  if (!cristal) return null;
  return { classe: "cristal", sprite: cristal.id };
}

/**
 * Um prop da célula, já com a porta do bioma.
 * @returns {{ classe: string, sprite: string } | null}
 */
export function plantaNoBioma(bioma, wx, wy) {
  if (!bioma || !dados) return null;
  const x = wx | 0;
  const y = wy | 0;
  const plano = planoDe(bioma);
  if (plano.mar) {
    const bruto = Number(dados.mar?.densidade);
    const dens = Number.isFinite(bruto) ? bruto : 0.14;
    const roll = hash2(x, y, 0x534541);
    if (roll > dens) return null;
    const sprite = sortearSprite(plano.grama, dens > 0 ? roll / dens : 0);
    if (!sprite) return null;
    return { classe: "grama", sprite };
  }
  if (plano.arvore.length && passaArvore(x, y) && ganhaPegada(x, y)) {
    const sprite = sortearSprite(plano.arvore, hash2(x, y, 0x74726565));
    if (sprite) return { classe: "arvore", sprite };
  }
  const pedra = escolherPedra(x, y, plano.familias, plano.cristais);
  if (pedra) return pedra;
  if (!plano.grama.length || !passaGrama(x, y)) return null;
  const sprite = escolherGrama(x, y, plano.grama);
  if (!sprite) return null;
  return { classe: "grama", sprite };
}

export function nomePele(biomaId) {
  return dados?.splat?.[biomaId]?.pele || "";
}

export function urlPele(biomaId) {
  const nome = nomePele(biomaId);
  if (!nome) return "";
  return dados?.peles?.[nome] || "";
}

/** Porta crua do FBM, antes do filtro de vizinhança. */
export function cruSplat(wx, wy, biomaId) {
  const spec = dados?.splat?.[biomaId];
  if (!spec?.pele || !dados?.peles?.[spec.pele]) return false;
  const campo = campoDe(
    {
      canal: spec.canal,
      freq: spec.freq,
      limiar: spec.limiar,
      oitavas: spec.oitavas,
      persistencia: spec.persistencia,
      lacunaridade: spec.lacunaridade,
    },
    SEMENTE_SPLAT,
  );
  return amostraCampo(wx | 0, wy | 0, campo) >= campo.limiar;
}
