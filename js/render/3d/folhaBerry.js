/**
 * Folha GBA dos arbustos — mesmo mapeamento do Pokémon AI.
 * Solo plantado / broto base são tiles compartilhados; 0/1/2 são por espécie.
 * iapapa usa o quadro lapapa. Quadro 1 fica 16 px à direita do 0.
 */

import { UV_ARBUSTO } from "./uvArbustoBerry.js";

const LADO = 16;
export const ESCALA_ARBUSTO = 1.15;
export const ARBUSTO_ANIM_MS = 380;

/** Solo arado da folha (Pokémon AI: BERRY_PLANTED_SOIL). */
export const SOLO_PLANTADO = Object.freeze({ sx: 288, sy: 240, sw: 16, sh: 16 });

/** Primeiro broto compartilhado após plantar (Pokémon AI: BERRY_BASE_FORM). */
export const BROTO_BASE = Object.freeze({
  0: Object.freeze({ sx: 304, sy: 240, sw: 16, sh: 16 }),
  1: Object.freeze({ sx: 320, sy: 240, sw: 16, sh: 16 }),
});

/**
 * Plot stage → folha (Pokémon AI plotStageToSheetGrowth):
 * soil → solo | seed → base | sprout → 0 | bush/flower → 1 | ripe → 2
 */
export function estagioParaFolha(estagio) {
  switch (estagio) {
    case "soil":
    case "solo":
      return "soil";
    case "seed":
    case "semente":
      return "base";
    case "sprout":
    case "broto":
      return 0;
    case "bush":
    case "arbusto":
    case "flower":
    case "flor":
      return 1;
    case "ripe":
    case "maduro":
      return 2;
    default:
      return 2;
  }
}

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

function uvCrescimento(especie, crescimento) {
  const uvs = UV_ARBUSTO[especie];
  if (!uvs) return null;
  if (uvs[crescimento]) return uvs[crescimento];
  // Estágio 0 (broto jovem): 32 px à esquerda do UV 1, como no catálogo do Pokémon AI.
  if (crescimento === 0 && uvs[1]) {
    const u = uvs[1];
    return Object.freeze([u[0] - 32, u[1], u[2] - 32, u[3]]);
  }
  return null;
}

function recortarTile(chave, sx, sy, sw, sh) {
  const id = `t:${chave}:${sx}:${sy}`;
  const pronto = recortes.get(id);
  if (pronto) return pronto;
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(folha, sx, sy, sw, sh, 0, 0, sw, sh);
  recortes.set(id, canvas);
  return canvas;
}

function recortarArvore(especie, crescimento, quadro) {
  const id = `${especie}:${crescimento}:${quadro}`;
  const pronto = recortes.get(id);
  if (pronto) return pronto;
  const uv = uvCrescimento(especie, crescimento);
  if (!uv || uv[0] < 0 || uv[2] < 0) return null;
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

/** Canvas 16×16 do solo arado da folha, ou null se a folha não carregou. */
export function imagemSoloPlantado() {
  if (!folha?.complete || folha.naturalWidth <= 0) {
    garantirFolhaBerry();
    return null;
  }
  return recortarTile("solo", SOLO_PLANTADO.sx, SOLO_PLANTADO.sy, SOLO_PLANTADO.sw, SOLO_PLANTADO.sh);
}

/**
 * Canvas do estágio do canteiro/arbusto.
 * - seed → broto base 16×16
 * - sprout/bush/flower/ripe → árvore 16×32
 * Sem quadro explícito, usa o relógio global de 380 ms.
 */
export function imagemArbusto(chave, estagio, quadro) {
  if (!folha?.complete || folha.naturalWidth <= 0) {
    garantirFolhaBerry();
    return null;
  }
  const frame = quadro == null ? quadroArbusto() : (quadro | 0) & 1;
  const growth = estagioParaFolha(estagio);

  if (growth === "soil") return imagemSoloPlantado();

  if (growth === "base") {
    const tile = BROTO_BASE[frame] || BROTO_BASE[0];
    return recortarTile(`base:${frame}`, tile.sx, tile.sy, tile.sw, tile.sh);
  }

  if (!chave) return null;
  const especie = especieDaFolha(chave);
  return recortarArvore(especie, growth, frame);
}

/** true se o estágio usa tile 16×16 (solo/seed) em vez da árvore 16×32. */
export function estagioEhTileBaixo(estagio) {
  const g = estagioParaFolha(estagio);
  return g === "soil" || g === "base";
}
