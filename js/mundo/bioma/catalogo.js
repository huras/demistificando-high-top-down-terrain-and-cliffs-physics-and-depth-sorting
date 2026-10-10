import { SEED_MUNDO } from "../../config.js";
import { BLOCO } from "../voxel/tiposBloco.js";
import { hash2 } from "../voxel/ruido.js";
import { avaliarGrafo } from "./grafo.js";

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

/**
 * Duas regiões mais próximas (Voronoi com centro jitterado).
 * dominio = 1 no miolo de A, cai na borda até 0.
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
  const dominio = Math.max(0, Math.min(1, (db - da) / largura));
  return { a: melhor.bioma, b: segundo.bioma, dominio };
}

function snap(h, degrau) {
  const d = Math.max(1, Number(degrau) || 1);
  const q = Math.round(h / d) * d;
  return Math.max(1, Math.min(40, q));
}

/** Altura em blocos, já com mistura de borda e degrau. */
export function alturaDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  const reg = amostrarRegiao(wx, wy, catalogo, seed);
  if (!reg) return 4;
  const ha = avaliarGrafo(reg.a, wx, wy, seed);
  const hb = avaliarGrafo(reg.b, wx, wy, seed);
  const mistura = ha * reg.dominio + hb * (1 - reg.dominio);
  const degrau =
    reg.dominio > 0.85
      ? reg.a.degrau
      : reg.dominio < 0.15
        ? reg.b.degrau
        : Math.max(Number(reg.a.degrau) || 1, Number(reg.b.degrau) || 1);
  return snap(mistura, degrau);
}

export function biomaDominante(wx, wy, catalogo = dados, seed = semente) {
  const reg = amostrarRegiao(wx, wy, catalogo, seed);
  if (!reg) return null;
  return reg.dominio >= 0.5 ? reg.a : reg.b;
}

export function superficieDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  const b = biomaDominante(wx, wy, catalogo, seed);
  if (!b) return BLOCO.GRAMA;
  if (b.superficie === "pedra") return BLOCO.PEDRA;
  if (b.superficie === "terra") return BLOCO.TERRA;
  return BLOCO.GRAMA;
}

/** "arvore", "mata" ou null. Determinístico por célula. */
export function plantaDoRelevo(wx, wy, catalogo = dados, seed = semente) {
  const b = biomaDominante(wx | 0, wy | 0, catalogo, seed);
  if (!b) return null;
  const u = hash2(wx | 0, wy | 0, seed + 9001);
  const arvore = Math.max(0, Number(b.arvore) || 0);
  const mata = Math.max(0, Number(b.mata) || 0);
  if (u < arvore) return "arvore";
  if (u < arvore + mata) return "mata";
  return null;
}
