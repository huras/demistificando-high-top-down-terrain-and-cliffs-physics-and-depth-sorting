import * as THREE from "three";
import { VEG_ALPHA_TEST } from "../../../config.js";
import { aplicarLuzBillboard } from "../ceu/luzBillboard.js";

/**
 * Material padrão de cartão (props / atores).
 * Aplica luz + profundidade em coluna (XZ pé, Y fragmento).
 */
export function materialCartao(mapa, opts = {}) {
  const alphaTest = opts.alphaTest ?? VEG_ALPHA_TEST;
  const mat = new THREE.MeshStandardMaterial({
    map: mapa || null,
    roughness: opts.roughness ?? 1,
    metalness: opts.metalness ?? 0,
    transparent: !!opts.transparent,
    alphaTest,
    depthWrite: opts.depthWrite !== false,
    depthTest: opts.depthTest !== false,
    side: opts.side ?? THREE.FrontSide,
    color: opts.color ?? 0xffffff,
    opacity: opts.opacity ?? 1,
  });
  if (opts.fog === false) mat.fog = false;
  if (opts.toneMapped === false) mat.toneMapped = false;
  aplicarLuzBillboard(mat, opts.folgaPivo);
  return mat;
}

/** Depth material para shadow map com o mesmo recorte de alpha. */
export function materialProfundidade(mapa, alphaTest = VEG_ALPHA_TEST) {
  return new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: mapa || null,
    alphaTest,
    side: THREE.DoubleSide,
  });
}
