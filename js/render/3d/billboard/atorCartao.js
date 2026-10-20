import * as THREE from "three";
import { aplicarLuzBillboard } from "../ceu/luzBillboard.js";
import { geometriaNoPe } from "./geometria.js";
import { poseCartao } from "./pose.js";

/**
 * Cartão de ator (personagem / Pokémon): Mesh no pe, mesma pose dos props.
 * Troca a geo quando o pivô do quadro muda.
 */
export function criarAtorCartao(mapa, opts = {}) {
  const alphaTest = opts.alphaTest ?? 0.12;
  // Basic: a cor vem da CPU (aplicarCorSprite), igual ao Sprite antigo.
  // LuzBillboard só achata o depth no pe.
  const mat = new THREE.MeshBasicMaterial({
    map: mapa || null,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    alphaTest,
    depthWrite: opts.depthWrite === true,
    depthTest: opts.depthTest !== false,
    side: THREE.FrontSide,
    color: opts.color ?? 0xffffff,
  });
  if (opts.fog === false) mat.fog = false;
  if (opts.toneMapped === false) mat.toneMapped = false;
  if (opts.clippingPlanes) {
    mat.clippingPlanes = opts.clippingPlanes;
    mat.clipShadows = true;
  }
  aplicarLuzBillboard(mat, opts.folgaPivo);
  const geo = geometriaNoPe(0.5, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = opts.nome || "ator-cartao";
  mesh.rotation.order = "YXZ";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = opts.renderOrder ?? 3;
  mesh.userData.pivotKey = "0.5:1";
  return mesh;
}

/** Atualiza geo unitária para o pe do quadro. */
export function aplicarPivoCartao(mesh, pivotX, pivotY) {
  if (!mesh) return;
  const px = Number.isFinite(pivotX) ? pivotX : 0.5;
  const py = Number.isFinite(pivotY) ? pivotY : 1;
  const key = `${px.toFixed(4)}:${py.toFixed(4)}`;
  if (mesh.userData.pivotKey === key) return;
  const antiga = mesh.geometry;
  mesh.geometry = geometriaNoPe(px, py);
  mesh.userData.pivotKey = key;
  if (antiga && antiga !== mesh.geometry) antiga.dispose();
}

/**
 * Pose do cartão filho (pe no grupo).
 * pivotX/Y em fração do sheet; largura/altura em unidades de mundo.
 */
export function poseAtorCartao(mesh, opts) {
  if (!mesh) return;
  if (opts.pivotX != null || opts.pivotY != null) {
    aplicarPivoCartao(mesh, opts.pivotX, opts.pivotY);
  }
  poseCartao(mesh, {
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    z: opts.z ?? 0,
    largura: opts.largura,
    altura: opts.altura,
    yaw: opts.yaw,
    inclinacao: opts.inclinacao,
    roll: opts.roll,
    pivotY: opts.pivotY,
    dz: opts.dz,
  });
}
