import * as THREE from "three";
import { aplicarProfundidadeSprite } from "./ceu/luzBillboard.js";

/** Mesma cor do personagem e do Pokémon da party. */
export const COR_SILHUETA_JOGADOR = 0xc5d6ee;
/** Selvagem: quente, para não confundir com o aliado atrás do sólido. */
export const COR_SILHUETA_SELVAGEM = 0xf2b08a;
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
 * O cartão visível some quando o pivô perde o depth.
 * Este passe usa o mesmo pivô com teste invertido, então só entra
 * o que o sólido já cobriu.
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
