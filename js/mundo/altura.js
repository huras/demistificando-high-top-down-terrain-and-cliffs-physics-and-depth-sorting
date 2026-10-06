import { CHUNK_Y } from "../config.js";
import {
  chunkCarregadoEm,
  obterBloco,
  superficieEm,
} from "./voxel/storeMundo.js";
import { ehSolido } from "./voxel/tiposBloco.js";
import { quedaVisualFace } from "./voxel/superficies.js";

export {
  baseTopoColuna,
  colunaTemArInterno,
  espessuraTopo,
  quedaVisualFace,
  superficieBaixa,
  superficieSobElevacao,
  tetoSobreElevacao,
} from "./voxel/superficies.js";

/** Célula com chunk carregado (mundo infinito fora do stream = inacessível). */
export function dentroDoMapa(cx, cy) {
  return chunkCarregadoEm(cx | 0, cy | 0);
}

/** Altura de superfície (maior z sólido na coluna). */
export function alturaEm(cx, cy) {
  const x = cx | 0;
  const y = cy | 0;
  if (!chunkCarregadoEm(x, y)) return 0;
  return superficieEm(x, y) | 0;
}

export function alturaNoPonto(x, y) {
  return alturaEm(Math.floor(x), Math.floor(y));
}

export function vizinho(cx, cy, dx, dy) {
  return { x: cx + dx, y: cy + dy, z: alturaEm(cx + dx, cy + dy) };
}

/** Queda sul: Δz positivo se a célula atual é mais alta que a do sul. */
export function quedaSul(cx, cy) {
  return quedaVisualFace(cx, cy, 0, 1);
}

/** Bloco sólido em (cx,cy,z) — API voxel. */
export function solidoEm(cx, cy, z) {
  if (z < 0 || z >= CHUNK_Y) return false;
  return ehSolido(obterBloco(cx, cy, z));
}
