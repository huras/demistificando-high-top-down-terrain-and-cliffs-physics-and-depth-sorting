import { SEED_MUNDO } from "../../config.js";
import { amostraKanto, dentroDoKanto } from "../regiao/amostraKanto.js";
import { BLOCO } from "../voxel/tiposBloco.js";
import { hash2 } from "../voxel/ruido.js";
import { avaliarGrafo } from "./grafo.js";
import { plantaNoBioma } from "./detalhe.js";

/** @type {object | null} */
let dados = null;
let semente = SEED_MUNDO;

export async function carregarCatalogo() {
  const res = await fetch("biomas/mundo.json", { cache: "no-store" });
  if (!res.ok) throw new Error("biomas/mundo.json");
  definirCatalogo(await res.json());
}

export function definirCatalogo(proximo) {
  dados = proximo;
  semente = (SEED_MUNDO + (dados?.semente | 0)) | 0;
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
 * Duas regiões mais próximas (Voronoi com centro jitterado).
 * dominio = peso de A: 1 no miolo, 0.5 na borda.
 * Na borda os dois lados valem metade, senão a faixa vira A, B, A, B.
 */
export function amostrarRegiao(wx, wy, catalogo = dados, seed = semente) {
  const biomas = catalogo?.biomas || [];
  const n = biomas.length;
  if (!n) return null;
  const escala = Math.max(32, Number(catalogo.escalaRegiao) || 200);
  const gx = Math.floor(wx / escala);
  const gy = Math.floor(wy / escala);
  let melhor = null;
  let segundo = null;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const jx = (hash2(cx, cy, seed) - 0.5) * escala * 0.85;
      const jy = (hash2(cx, cy, seed + 17) - 0.5) * escala * 0.85;
      const px = (cx + 0.5) * escala + jx;
      const py = (cy + 0.5) * escala + jy;
      const dx = wx - px;
      const dy = wy - py;
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
  const perto = suave01((db - da) / largura);
  const dominio = 0.5 + 0.5 * perto;
  return { a: melhor.bioma, b: segundo.bioma, dominio };
}

function snap(h, degrau) {
  const d = Math.max(1, Number(degrau) || 1);
  const q = Math.round(h / d) * d;
  return Math.max(1, Math.min(60, q));
}

/** Linha única do oceano, em blocos. A lâmina fica nessa cota no mundo inteiro. */
export function nivelMarBlocos(catalogo = dados) {
  const n = Number(catalogo?.nivelMarBlocos);
  if (!Number.isFinite(n)) return 12;
  return Math.max(2, Math.min(59, Math.round(n)));
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

/** Altura em blocos. Na faixa da borda, A e B se misturam; no miolo fica o degrau do bioma. */
export function alturaDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  if (dentroDoKanto(wx, wy)) return amostraKanto(wx, wy).h;
  const reg = amostrarRegiao(wx, wy, catalogo, seed);
  if (!reg) return 4;
  const nivel = nivelMarBlocos(catalogo);
  const ha = tetoMar(reg.a, alturaContinua(reg.a, wx, wy, seed, catalogo), nivel);
  const hb = tetoMar(reg.b, alturaContinua(reg.b, wx, wy, seed, catalogo), nivel);
  const mistura = ha * reg.dominio + hb * (1 - reg.dominio);
  const degrau = reg.dominio > 0.92 ? reg.a.degrau : 1;
  let h = snap(mistura, degrau);
  if (reg.a.camada === "mar") h = Math.min(h, nivel - 1);
  return h;
}

export function biomaDominante(wx, wy, catalogo = dados, seed = semente) {
  if (dentroDoKanto(wx, wy)) return amostraKanto(wx, wy).bioma;
  const reg = amostrarRegiao(wx, wy, catalogo, seed);
  if (!reg) return null;
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
  if (dentroDoKanto(wx, wy)) {
    const amostra = amostraKanto(wx, wy);
    if (!amostra || amostra.rua || amostra.predio || amostra.h < nivelMarBlocos(catalogo)) return null;
    return plantaNoBioma(amostra.bioma, wx, wy);
  }
  const b = biomaDominante(wx | 0, wy | 0, catalogo, seed);
  if (!b) return null;
  return plantaNoBioma(b, wx, wy);
}
