import { ALTURA_MAX_RELEVO, SEED_MUNDO, clampAltura } from "../../config.js";
import { distAssinadaKanto, pesoCostura } from "../bounds.js";
import { amostraKanto, dentroDoKanto } from "../regiao/amostraKanto.js";
import { dentroDoTerrenoSala } from "../cidade/sala3d.js";
import { BLOCO } from "../voxel/tiposBloco.js";
import { fbm2, hash2 } from "../voxel/ruido.js";
import { areaLogicaNoMundo, biomasDaPaleta } from "./areasMundo.js";
import { avaliarGrafo } from "./grafo.js";
import { amarrarBioma, plantaNoBioma } from "./detalhe.js";

/** @type {object | null} */
let dados = null;
let semente = SEED_MUNDO;
/** @type {Map<string, object>} */
let porId = new Map();
/** @type {Map<string, number>} */
let midBandPorId = new Map();

export async function carregarCatalogo() {
  const res = await fetch("biomas/mundo.json", { cache: "no-store" });
  if (!res.ok) throw new Error("biomas/mundo.json");
  definirCatalogo(await res.json());
}

function reconstruirIndice(catalogo) {
  porId = new Map();
  midBandPorId = new Map();
  const biomas = catalogo?.biomas || [];
  const origem = Number(catalogo?.origemMetros);
  const base = Number.isFinite(origem) ? origem : -200;
  const mpb = Number(catalogo?.metrosPorBloco) || 48;
  for (let i = 0; i < biomas.length; i++) {
    const b = biomas[i];
    if (!b?.id) continue;
    porId.set(b.id, b);
    const piso = Number(b.pisoMetros) || 0;
    const faixa = Number(b.faixaMetros) || 1;
    midBandPorId.set(b.id, (piso + faixa * 0.5 - base) / mpb);
  }
}

export function definirCatalogo(proximo) {
  dados = proximo;
  semente = (SEED_MUNDO + (dados?.semente | 0)) | 0;
  reconstruirIndice(dados);
}

export function biomaPorId(id) {
  if (!id) return null;
  return porId.get(id) || null;
}

/** Faixa média do grafo em blocos — âncora do detalhe residual. */
export function midBandDoBioma(biomaOuId) {
  const id = typeof biomaOuId === "string" ? biomaOuId : biomaOuId?.id;
  if (!id) return 16;
  const cached = midBandPorId.get(id);
  if (cached != null) return cached;
  const b = typeof biomaOuId === "object" ? biomaOuId : biomaPorId(id);
  if (!b) return 16;
  const origem = Number(dados?.origemMetros);
  const base = Number.isFinite(origem) ? origem : -200;
  const mpb = Number(dados?.metrosPorBloco) || 48;
  const piso = Number(b.pisoMetros) || 0;
  const faixa = Number(b.faixaMetros) || 1;
  return (piso + faixa * 0.5 - base) / mpb;
}

export function midBandDoPar(par) {
  if (!par) return 16;
  const a = midBandDoBioma(par.bioma);
  if (!par.biomaB || par.biomaB === par.bioma) return a;
  const b = midBandDoBioma(par.biomaB);
  const d = Number.isFinite(par.dominio) ? par.dominio : 1;
  return a * d + b * (1 - d);
}

export function obterCatalogo() {
  return dados;
}

export function obterSementeBioma() {
  return semente;
}

function suave01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Domain warp da query Voronoi — curvas de média escala nas fronteiras.
 * Amp em blocos; fbm centrado em 0.
 */
function deslocarDominio(wx, wy, catalogo, seed) {
  const escala = Math.max(8, Number(catalogo?.escalaWarpRegiao) || 72);
  const amp = Math.max(0, Number(catalogo?.ampWarpRegiao) || 42);
  if (!(amp > 0)) return { x: wx, y: wy };
  const oitavas = Math.max(1, Math.min(6, (Number(catalogo?.oitavasWarpRegiao) || 3) | 0));
  const nx = fbm2(wx / escala, wy / escala, seed + 5107, oitavas) * 2 - 1;
  const ny = fbm2(wx / escala, wy / escala, seed + 6203, oitavas) * 2 - 1;
  return { x: wx + nx * amp, y: wy + ny * amp };
}

/** Ruído fino na linha db−da (litoral da célula). */
function ruidoFronteira(wx, wy, catalogo, seed) {
  const amp = Number(catalogo?.ampRuidoFronteira);
  if (!(amp > 0)) return 0;
  const escala = Math.max(4, Number(catalogo?.escalaRuidoFronteira) || 28);
  return (fbm2(wx / escala, wy / escala, seed + 7331, 2) * 2 - 1) * amp;
}

/**
 * Duas regiões mais próximas (Voronoi com centro jitterado + domain warp).
 * Fora de Kanto a célula só sorteia dentro da paleta da área lógica.
 * dominio = peso de A: 1 no miolo, 0.5 na borda.
 */
export function amostrarRegiao(wx, wy, catalogo = dados, seed = semente) {
  const terra = mascaraContinente(wx, wy, catalogo, seed);
  const pesoT = pesoTerraContinente(terra, catalogo);
  const area = areaLogicaNoMundo(wx, wy, { mar: pesoT < 0.45, seed });
  const biomas = biomasDaPaleta(area, catalogo);
  const n = biomas.length;
  if (!n) return null;
  const baseEscala = Math.max(32, Number(catalogo.escalaRegiao) || 200);
  const escala = Math.max(48, baseEscala * (Number(area?.escalaMul) || 2.5));
  const ampWarp = Math.max(0, Number(catalogo?.ampWarpRegiao) || 42);
  const q = deslocarDominio(wx, wy, catalogo, seed);
  const gx = Math.floor(q.x / escala);
  const gy = Math.floor(q.y / escala);
  const raio = Math.max(1, 1 + Math.ceil(ampWarp / escala));
  let melhor = null;
  let segundo = null;

  for (let oy = -raio; oy <= raio; oy++) {
    for (let ox = -raio; ox <= raio; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const jx = (hash2(cx, cy, seed) - 0.5) * escala * 0.85;
      const jy = (hash2(cx, cy, seed + 17) - 0.5) * escala * 0.85;
      const px = (cx + 0.5) * escala + jx;
      const py = (cy + 0.5) * escala + jy;
      const dx = q.x - px;
      const dy = q.y - py;
      const d2 = dx * dx + dy * dy;
      const indice = Math.floor(hash2(cx, cy, seed + 3) * n) % n;
      const item = { bioma: biomas[indice], d2, px, py };
      if (!melhor || d2 < melhor.d2) {
        segundo = melhor;
        melhor = item;
      } else if (!segundo || d2 < segundo.d2) {
        segundo = item;
      }
    }
  }

  if (!segundo) segundo = melhor;
  const da = Math.sqrt(melhor.d2);
  const db = Math.sqrt(segundo.d2);
  const largura =
    (Math.max(1, Number(melhor.bioma.transicao) || 8) +
      Math.max(1, Number(segundo.bioma.transicao) || 8)) *
    0.5;
  const fronteira = db - da + ruidoFronteira(wx, wy, catalogo, seed);
  const perto = suave01(fronteira / largura);
  const dominio = 0.5 + 0.5 * perto;
  return { a: melhor.bioma, b: segundo.bioma, dominio, area };
}

function snap(h, degrau) {
  const d = Math.max(1, Number(degrau) || 1);
  const q = Math.round(h / d) * d;
  return clampAltura(q);
}

/** Linha única do oceano, em blocos. A lâmina fica nessa cota no mundo inteiro. */
export function nivelMarBlocos(catalogo = dados) {
  const n = Number(catalogo?.nivelMarBlocos);
  if (!Number.isFinite(n)) return 12;
  return Math.max(2, Math.min(ALTURA_MAX_RELEVO - 1, Math.round(n)));
}

function tetoMar(bioma, h, nivel) {
  if (bioma?.camada !== "mar") return h;
  return Math.min(h, nivel - 1);
}

function contexto(catalogo) {
  return {
    metrosPorBloco: Number(catalogo?.metrosPorBloco) || 48,
    metrosPorCelula: Number(catalogo?.metrosPorCelula) || 1000,
  };
}

/** Blocos. Grafo Unity (0..1) vira metros e depois blocos, com a mesma escala para todos. */
function alturaContinua(bioma, wx, wy, seed, catalogo) {
  const n = avaliarGrafo(bioma, wx, wy, seed, contexto(catalogo));
  if (bioma?.modo !== "unity") return n;
  const piso = Number(bioma.pisoMetros) || 0;
  const faixa = Number(bioma.faixaMetros) || 1;
  const metros = piso + Math.max(0, Math.min(1, n)) * faixa;
  const origem = Number(catalogo?.origemMetros);
  const base = Number.isFinite(origem) ? origem : -200;
  const mpb = Number(catalogo?.metrosPorBloco) || 48;
  return (metros - base) / mpb;
}

/** Altura contínua do grafo completo (catálogo), em blocos. */
export function alturaContinuaDoBioma(bioma, wx, wy, catalogo = dados, seed = semente) {
  if (!bioma) return 4;
  const completo = biomaPorId(bioma.id) || bioma;
  return alturaContinua(completo, wx, wy, seed, catalogo);
}

/**
 * Grafo A/B do par de biomas (ids Kanto → entrada completa do catálogo).
 * Sem snap — usado como detalhe residual sobre o macro pintado.
 */
export function alturaGrafoDoPar(par, wx, wy, catalogo = dados, seed = semente) {
  if (!par?.bioma) return 16;
  const a = biomaPorId(par.bioma.id) || par.bioma;
  const bStub = par.biomaB || par.bioma;
  const b = biomaPorId(bStub.id) || bStub;
  if (!a?.nos?.length) return midBandDoBioma(a);
  const nivel = nivelMarBlocos(catalogo);
  const ha = tetoMar(a, alturaContinua(a, wx, wy, seed, catalogo), nivel);
  const hb =
    b === a || !b?.nos?.length
      ? ha
      : tetoMar(b, alturaContinua(b, wx, wy, seed, catalogo), nivel);
  const dominio = Number.isFinite(par.dominio) ? par.dominio : 1;
  return ha * dominio + hb * (1 - dominio);
}

/**
 * Campo 0..1 de continente fora de Kanto.
 * Baixo = oceano, alto = terra. Escala larga + detalhe de costa.
 */
export function mascaraContinente(wx, wy, catalogo = dados, seed = semente) {
  const escala = Math.max(120, Number(catalogo?.escalaContinente) || 880);
  const largo = fbm2(wx / escala, wy / escala, seed + 901, 5);
  const costa = fbm2(wx / (escala * 0.34), wy / (escala * 0.34), seed + 1409, 3);
  let terra = largo * 0.7 + costa * 0.3;

  // Anel logo fora da AABB: puxa pra mar pra costurar com o oceano authored.
  const d = distAssinadaKanto(wx, wy);
  if (d > 0) {
    const anel = Math.max(64, Number(catalogo?.anelMarKanto) || 320);
    const puxa = 1 - suave01(Math.min(1, d / anel));
    const forca = Number.isFinite(catalogo?.forcaAnelMar) ? Number(catalogo.forcaAnelMar) : 0.58;
    terra *= 1 - forca * puxa;
  }
  return Math.max(0, Math.min(1, terra));
}

/** Peso de terra 0..1 a partir da máscara (0 = fundo do mar, 1 = relevo seco). */
function pesoTerraContinente(terra, catalogo) {
  const limiar = Number.isFinite(catalogo?.limiarContinente)
    ? Number(catalogo.limiarContinente)
    : 0.5;
  const faixa = Math.max(0.02, Number(catalogo?.faixaCostaContinente) || 0.09);
  return suave01((terra - (limiar - faixa)) / (2 * faixa));
}

/** Altura procedural pura (sem Kanto). Mar vem da máscara de continente. */
function alturaProcedural(wx, wy, catalogo, seed) {
  const reg = amostrarRegiao(wx, wy, catalogo, seed);
  if (!reg) return 4;
  const nivel = nivelMarBlocos(catalogo);
  const ha = tetoMar(reg.a, alturaContinua(reg.a, wx, wy, seed, catalogo), nivel);
  const hb = tetoMar(reg.b, alturaContinua(reg.b, wx, wy, seed, catalogo), nivel);
  const mistura = ha * reg.dominio + hb * (1 - reg.dominio);
  const degrau = reg.dominio > 0.92 ? reg.a.degrau : 1;
  let h = snap(mistura, degrau);
  if (reg.a.camada === "mar") h = Math.min(h, nivel - 1);

  const terra = mascaraContinente(wx, wy, catalogo, seed);
  const t = pesoTerraContinente(terra, catalogo);
  if (t < 1) {
    const profundidade = Math.round((1 - terra) * 7);
    const fundo = Math.max(2, Math.min(nivel - 1, nivel - 1 - profundidade));
    h = Math.round(fundo * (1 - t) + h * t);
    if (t < 0.55) h = Math.min(h, nivel - 1);
  }
  return clampAltura(h);
}

/**
 * Peso da costura. Terra de Kanto mantém a faixa curta.
 * Oceano authored: faixa larga só pra textura/profundidade do mar —
 * nunca libera ilha procedural em cima do oceano de Kanto.
 */
function pesoCosturaRelevo(wx, wy, catalogo, seed) {
  let t = pesoCostura(wx, wy);
  if (t >= 1 || !dentroDoKanto(wx, wy)) return t;
  const hK = amostraKanto(wx, wy)?.h;
  const nivel = nivelMarBlocos(catalogo);
  if (!(Number.isFinite(hK) && hK < nivel)) return t;
  const faixaMar = Math.max(64, Number(catalogo?.faixaCosturaMar) || 520);
  return Math.max(t, pesoCostura(wx, wy, faixaMar));
}

/** Altura em blocos. Costura Kanto↔procedural na borda; no miolo Voronoi mistura A/B. */
export function alturaDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  const nivel = nivelMarBlocos(catalogo);
  const t = pesoCosturaRelevo(wx, wy, catalogo, seed);
  const hKamostra = dentroDoKanto(wx, wy) ? amostraKanto(wx, wy)?.h : null;
  if (t <= 0) {
    return Number.isFinite(hKamostra) ? hKamostra : alturaProcedural(wx, wy, catalogo, seed);
  }
  const hP = alturaProcedural(wx, wy, catalogo, seed);
  if (t >= 1) {
    // Oceano authored: procedural só redefine o fundo, nunca sobe ilha.
    if (Number.isFinite(hKamostra) && hKamostra < nivel) return Math.min(hP, nivel - 1);
    return hP;
  }
  const hK = Number.isFinite(hKamostra) ? hKamostra : hP;
  let h = clampAltura(hK * (1 - t) + hP * t);
  if (hK < nivel) h = Math.min(h, nivel - 1);
  return h;
}

export { pesoCosturaRelevo };

export function biomaDominante(wx, wy, catalogo = dados, seed = semente) {
  const t = pesoCosturaRelevo(wx, wy, catalogo, seed);
  if (t < 0.5 && dentroDoKanto(wx, wy)) {
    const a = amostraKanto(wx, wy);
    if (a?.bioma) return a.bioma;
  }
  const reg = amostrarRegiao(wx, wy, catalogo, seed);
  if (!reg) return dentroDoKanto(wx, wy) ? amostraKanto(wx, wy)?.bioma ?? null : null;
  if (t > 0 && t < 1 && dentroDoKanto(wx, wy)) {
    const a = amostraKanto(wx, wy);
    if (a?.bioma && t < 0.5) return a.bioma;
  }
  return reg.a;
}

export function kitDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  const b = biomaDominante(wx, wy, catalogo, seed);
  return b?.kit || null;
}

export function superficieDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  const b = biomaDominante(wx, wy, catalogo, seed);
  if (!b) return BLOCO.GRAMA;
  if (b.superficie === "pedra") return BLOCO.PEDRA;
  if (b.superficie === "terra") return BLOCO.TERRA;
  return BLOCO.GRAMA;
}

/**
 * Prop da célula. A porta e o sprite vêm de detalhe.js.
 * @returns {{ classe: string, sprite: string } | null}
 */
export function plantaDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  if (dentroDoTerrenoSala(wx, wy)) return null;
  const t = pesoCosturaRelevo(wx, wy, catalogo, seed);
  if (t < 0.55 && dentroDoKanto(wx, wy)) {
    const amostra = amostraKanto(wx, wy);
    if (!amostra || amostra.rua || amostra.predio || amostra.h < nivelMarBlocos(catalogo)) return null;
    if (amostra.entradaLab) return null;
    return plantaNoBioma(amostra.bioma, wx, wy);
  }
  if (alturaDoRelevo(wx, wy, catalogo, seed) < nivelMarBlocos(catalogo)) return null;
  const b = biomaDominante(wx | 0, wy | 0, catalogo, seed);
  if (!b || b.camada === "mar") return null;
  return plantaNoBioma(b, wx, wy);
}

amarrarBioma((wx, wy) => biomaDominante(wx, wy));
