/**
 * Folha GBA dos arbustos. Recorta uma vez o topo e o pé de cada espécie.
 * iapapa usa o quadro lapapa da folha.
 */

import { UV_ARBUSTO } from "./uvArbustoBerry.js";

const LADO = 16;
export const ESCALA_ARBUSTO = 1.15;

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

/** Canvas 16×32, ou null enquanto a folha não chegou. */
export function imagemArbusto(chave, estagio) {
  if (!chave) return null;
  if (!folha?.complete || folha.naturalWidth <= 0) {
    garantirFolhaBerry();
    return null;
  }
  const especie = especieDaFolha(chave);
  const crescimento = CRESCIMENTO[estagio] || CRESCIMENTO.maduro;
  const id = `${especie}:${crescimento}`;
  const pronto = recortes.get(id);
  if (pronto) return pronto;
  const uv = UV_ARBUSTO[especie]?.[crescimento];
  if (!uv) return null;
  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(folha, uv[0], uv[1], LADO, LADO, 0, 0, LADO, LADO);
  ctx.drawImage(folha, uv[2], uv[3], LADO, LADO, 0, LADO, LADO, LADO);
  recortes.set(id, canvas);
  return canvas;
}
