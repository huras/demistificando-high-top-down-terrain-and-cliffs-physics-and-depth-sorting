/**
 * Folha GBA dos arbustos. Recorta topo e pé de cada espécie e quadro.
 * iapapa usa o quadro lapapa da folha. Quadro 1 fica 16 px à direita do 0.
 */

import { UV_ARBUSTO } from "./uvArbustoBerry.js";

const LADO = 16;
export const ESCALA_ARBUSTO = 1.15;
export const ARBUSTO_ANIM_MS = 380;

const CRESCIMENTO = Object.freeze({
  arbusto: 1,
  flor: 1,
  maduro: 2,
});

/** @type {HTMLImageElement | null} */
let folha = null;
let pediu = false;
/** @type {Array<() => void>} */
const prontos = [];
/** @type {Map<string, HTMLCanvasElement>} */
const recortes = new Map();

function avisar() {
  const fila = prontos.splice(0, prontos.length);
  for (let i = 0; i < fila.length; i++) fila[i]();
}

export function garantirFolhaBerry(quando) {
  if (typeof quando === "function") {
    if (folha?.complete && folha.naturalWidth > 0) quando();
    else prontos.push(quando);
  }
  if (pediu) return;
  pediu = true;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    folha = img;
    avisar();
  };
  img.onerror = () => {
    folha = null;
    avisar();
  };
  img.src = "assets/berries/berry-trees.png";
}

function especieDaFolha(chave) {
  if (chave === "iapapa") return "lapapa";
  return chave;
}

/** 0 ou 1, mesmo relógio do Pokémon AI. */
export function quadroArbusto(agora = performance.now()) {
  return Math.floor(agora / ARBUSTO_ANIM_MS) % 2;
}

function recortar(especie, crescimento, quadro) {
  const id = `${especie}:${crescimento}:${quadro}`;
  const pronto = recortes.get(id);
  if (pronto) return pronto;
  const uv = UV_ARBUSTO[especie]?.[crescimento];
  if (!uv) return null;
  const dx = quadro ? LADO : 0;
  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(folha, uv[0] + dx, uv[1], LADO, LADO, 0, 0, LADO, LADO);
  ctx.drawImage(folha, uv[2] + dx, uv[3], LADO, LADO, 0, LADO, LADO, LADO);
  recortes.set(id, canvas);
  return canvas;
}

/**
 * Canvas 16×32, ou null enquanto a folha não chegou.
 * Sem quadro explícito, usa o relógio global de 380 ms.
 */
export function imagemArbusto(chave, estagio, quadro) {
  if (!chave) return null;
  if (!folha?.complete || folha.naturalWidth <= 0) {
    garantirFolhaBerry();
    return null;
  }
  const especie = especieDaFolha(chave);
  const crescimento = CRESCIMENTO[estagio] || CRESCIMENTO.maduro;
  const frame = quadro == null ? quadroArbusto() : (quadro | 0) & 1;
  return recortar(especie, crescimento, frame);
}
