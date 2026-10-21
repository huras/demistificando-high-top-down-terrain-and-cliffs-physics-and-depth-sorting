/**
 * Handoff de LOD por stencil (BOTW-style layers).
 *
 * 1. Blocos escrevem ref=1 (Always + Replace)
 * 2. Suave desenha onde ≠1 e marca ref=1 (cobertura média)
 * 3. Horizonte desenha onde ≠1 (só o que blocos/suave não cobriram)
 *
 * Ordem de draw: blocos → suave → horizonte.
 */
import * as THREE from "three";

export const STENCIL_LOD_FINO = 1;

/** Material dos voxels: sempre marca a célula como LOD fino. */
export function marcarLodFino(material) {
  material.stencilWrite = true;
  material.stencilRef = STENCIL_LOD_FINO;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
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
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

/** Horizonte: só onde blocos e suave deixaram o stencil limpo. */
export function atrasDoLodMedio(material) {
  material.depthTest = true;
  material.depthWrite = true;
  material.stencilWrite = true;
  material.stencilRef = STENCIL_LOD_FINO;
  material.stencilFunc = THREE.NotEqualStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
  return material;
}
