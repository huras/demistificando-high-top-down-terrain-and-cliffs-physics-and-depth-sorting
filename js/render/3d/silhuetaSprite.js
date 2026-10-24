import * as THREE from "three";
import {
  aplicarLuzBillboard,
  aplicarProfundidadeSprite,
  FOLGA_ATOR,
  FOLGA_CHAO,
} from "./ceu/luzBillboard.js";
import { geometriaNoPe } from "./billboard/geometria.js";

const FOLGA_SILHUETA = FOLGA_CHAO + FOLGA_ATOR;

/** Mesma cor do personagem e do Pokémon da party. */
export const COR_SILHUETA_JOGADOR = 0xc5d6ee;
/** Terreno e árvore gravam 1. A grama grava 2 por cima, no pixel que ela ganha. */
export const STENCIL_SOLIDO = 1;
export const STENCIL_GRAMA = 2;

export function marcarStencilSolido(material) {
  material.stencilWrite = true;
  material.stencilRef = STENCIL_SOLIDO;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

function testarStencil(material, ref) {
  material.stencilWrite = true;
  material.stencilRef = ref;
  material.stencilFunc = THREE.EqualStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
}

/**
 * O cartão visível some onde a profundidade em coluna perde pro sólido.
 * Este passe usa a mesma coluna com teste invertido (GreaterDepth),
 * então só entra o que o sólido já cobriu.
 */
function aplicarMascaraSilhueta(material) {
  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    if (shader.fragmentShader.includes("silhuetaChata")) return;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
/* silhuetaChata */
diffuseColor.rgb = diffuse;`,
    );
  };
  material.customProgramCacheKey = function chaveSilhueta() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|silhueta-chata`;
  };
  return material;
}

export function criarSpriteSilhueta(mapa, cor = COR_SILHUETA_JOGADOR) {
  const material = new THREE.SpriteMaterial({
    map: mapa,
    color: cor,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    alphaTest: 0.12,
    sizeAttenuation: true,
    fog: false,
    toneMapped: false,
  });
  aplicarMascaraSilhueta(material);
  aplicarProfundidadeSprite(material);
  testarStencil(material, STENCIL_SOLIDO);
  const sprite = new THREE.Sprite(material);
  sprite.name = "silhueta";
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 5;
  sprite.raycast = () => {};
  return sprite;
}

/** Silhueta em Mesh (mesma profundidade em coluna dos cartões de ator). */
export function criarMalhaSilhueta(mapa, cor = COR_SILHUETA_JOGADOR) {
  const material = new THREE.MeshBasicMaterial({
    map: mapa,
    color: cor,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    alphaTest: 0.12,
    fog: false,
    toneMapped: false,
    side: THREE.FrontSide,
  });
  aplicarMascaraSilhueta(material);
  aplicarLuzBillboard(material, FOLGA_SILHUETA);
  testarStencil(material, STENCIL_SOLIDO);
  const mesh = new THREE.Mesh(geometriaNoPe(0.5, 1), material);
  mesh.name = "silhueta";
  mesh.rotation.order = "YXZ";
  mesh.renderOrder = 5;
  mesh.raycast = () => {};
  mesh.userData.pivotKey = "0.5:1";
  return mesh;
}
