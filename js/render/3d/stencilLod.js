/**
 * Handoff de LOD por stencil (BOTW-style layers).
 *
 * 1. Blocos escrevem ref=1 (Always + Replace, inclusive em ZFail —
 *    veg/atores já podem ter ganhado o depth nesses pixels)
 * 2. Suave terra: ≠1 + Replace (cobertura média; ZFail também marca)
 * 2b. Suave oceano: Always + Replace — a lâmina precisa cobrir o fundo
 *     que o próprio suave já marcou; senão o mar do horizonte some e
 *     o anel médio fica seco
 * 3. Horizonte: Equal(0) — só stencil limpo (ref=1 dos LODs e ref=2
 *    da grama bloqueiam; NotEqual(1) furava a base dos details)
 *
 * Ordem de draw: blocos → suave terra → suave água → horizonte.
 */
import * as THREE from "three";

export const STENCIL_LOD_FINO = 1;

/** Material dos voxels: sempre marca a célula como LOD fino. */
export function marcarLodFino(material) {
  material.stencilWrite = true;
  material.stencilRef = STENCIL_LOD_FINO;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.ReplaceStencilOp;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

/**
 * Suave: não pinta em cima do bloco; ao passar, marca stencil
 * para o horizonte não z-fightar na junta.
 */
export function atrasDoLodFinoMarcando(material) {
  material.depthTest = true;
  material.depthWrite = true;
  material.stencilWrite = true;
  material.stencilRef = STENCIL_LOD_FINO;
  material.stencilFunc = THREE.NotEqualStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.ReplaceStencilOp;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

/**
 * Lâmina de oceano/lago no LOD médio.
 * Não usa NotEqual: o chão suave já escreveu ref=1 no fundo do mar;
 * a água ainda precisa pintar por cima e marcar cobertura pro horizonte.
 * Mantém depthWrite do material (água transparente = false).
 */
export function cobrirLodComAgua(material) {
  material.depthTest = true;
  material.stencilWrite = true;
  material.stencilRef = STENCIL_LOD_FINO;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

/**
 * Faixa de estrada no LOD suave.
 * O chão médio já marcou stencil (incl. leito do mar); NotEqual comia a
 * pista e matava pontes. Always+Replace desenha o deck por cima e ainda
 * tapa o horizonte. Fora do raio de stream (anel), não sobrescreve blocos.
 */
export function cobrirLodComEstrada(material) {
  material.depthTest = true;
  material.depthWrite = true;
  material.stencilWrite = true;
  material.stencilRef = STENCIL_LOD_FINO;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

/** Horizonte: só onde o stencil ainda está limpo (0). */
export function atrasDoLodMedio(material) {
  material.depthTest = true;
  material.depthWrite = true;
  material.stencilWrite = true;
  material.stencilRef = 0;
  material.stencilFunc = THREE.EqualStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
  return material;
}
