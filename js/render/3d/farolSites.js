/**
 * Feixe luminoso procedural do Glitter Lighthouse (sem colisão).
 * Altura/offset: assets/models/moinho-pivo.json (aba Moinho → Farol).
 */
import * as THREE from "three";
import { offsetMoinho } from "../../mundo/sites/moinhoPivo.js";

export const ID_FAROL = "glitter-lighthouse";
const NOME_EIXO = "eixo-feixe-farol";
const SPIN = 0.55;
/** Altura local padrão se o pivô ainda for zero (topo aproximado do molde 7.2). */
const ALTURA_PADRAO = 155.4;
const COMPRIMENTO = 1895;
const LARGURA = 76.75;

/**
 * @param {string} modeloId
 */
export function ehModeloFarol(modeloId) {
  return String(modeloId || "") === ID_FAROL;
}

function criarMalhaFeixe() {
  // Cone longo deitado no +Z local — gira em Y no eixo do farol.
  const geo = new THREE.ConeGeometry(LARGURA * 0.5, COMPRIMENTO, 16, 1, true);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, COMPRIMENTO * 0.5);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "feixe-luz-farol";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 3;
  mesh.raycast = () => {};
  return mesh;
}

/**
 * @param {THREE.Object3D} inst molde/clone já escalado
 * @returns {THREE.Group|null} eixo do feixe
 */
export function montarFeixeFarol(inst) {
  if (!inst) return null;
  let eixo = null;
  inst.traverse((n) => {
    if (n.name === NOME_EIXO) eixo = n;
  });
  if (eixo) return eixo;

  eixo = new THREE.Group();
  eixo.name = NOME_EIXO;
  eixo.userData.feixeFarol = true;
  const malha = criarMalhaFeixe();
  eixo.add(malha);
  eixo.userData.malhaFeixe = malha;
  inst.add(eixo);
  aplicarOffsetFeixeFarol(eixo, offsetMoinho(ID_FAROL));
  return eixo;
}

/**
 * @param {THREE.Object3D} eixo
 * @param {{ dx?:number, dy?:number, dz?:number }} off
 */
export function aplicarOffsetFeixeFarol(eixo, off) {
  if (!eixo) return;
  if (!eixo.userData.hubBase) {
    eixo.userData.hubBase = { x: 0, y: ALTURA_PADRAO, z: 0 };
  }
  const hub = eixo.userData.hubBase;
  eixo.position.set(
    hub.x + (Number(off?.dx) || 0),
    hub.y + (Number(off?.dy) || 0),
    hub.z + (Number(off?.dz) || 0),
  );
}

/**
 * @param {Iterable<{ eixo: THREE.Object3D }>} lista
 * @param {number} dt
 * @param {number} pesoNoite
 */
export function tickFarois(lista, dt, pesoNoite) {
  const noite = Math.max(0, Math.min(1, pesoNoite));
  const op = noite <= 0.02 ? 0 : 0.12 + noite * 0.38;
  for (const item of lista) {
    const eixo = item?.eixo;
    if (!eixo) continue;
    eixo.rotation.y += SPIN * (dt > 0 ? dt : 1 / 60);
    const malha = eixo.userData.malhaFeixe;
    if (malha?.material) {
      malha.material.opacity = op;
      malha.visible = op > 0.01;
    }
  }
}

export function eixoFeixeDaInstancia(inst) {
  if (!inst) return null;
  let achou = null;
  inst.traverse((n) => {
    if (n.name === NOME_EIXO) achou = n;
  });
  return achou;
}
