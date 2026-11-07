/**
 * Boca 3D: um GLB clonado por entrada perto do jogador. Sem colisão.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ALTURA_BLOCO } from "../../config.js";
import { estado as estadoJogo } from "../../jogo/estado.js";
import { bocasPerto } from "../../caverna/bocas.js";

const URL_GLB = "assets/models/overworld/cavern-entrance/cavern-entrance.glb";
const ALTURA_ALVO = 2.1;
/** Centro do vão 5×2 (células t = 1 e 2 à frente da parede). */
const AVANCO = 1.5;
/** Mesma folga dos prédios: kage não z-fighta com o terreno. */
const LIFT_KAGE = 0.04;
const RAIO = 72;

/** @type {THREE.Group | null} */
let grupo = null;
/** @type {THREE.Object3D | null} */
let molde = null;
/** @type {Promise<void> | null} */
let pedido = null;
/** @type {THREE.Scene | null} */
let cenaRef = null;
let escala = 1;
/** @type {THREE.Object3D[]} */
const clones = [];

function preparar(raiz) {
  const box = new THREE.Box3().setFromObject(raiz);
  const size = new THREE.Vector3();
  box.getSize(size);
  const altura = Math.max(size.y, 0.001);
  escala = ALTURA_ALVO / altura;
  raiz.traverse((obj) => {
    const mesh = /** @type {THREE.Mesh} */ (obj);
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
  });
  // Pivot no centro do chão: o scale do clone sobe a peça sem levantar a base.
  raiz.position.set(
    -(box.min.x + box.max.x) * 0.5,
    -box.min.y,
    -(box.min.z + box.max.z) * 0.5,
  );
  const pivot = new THREE.Group();
  pivot.add(raiz);
  return pivot;
}

function garantir(scene) {
  cenaRef = scene;
  if (molde || pedido) return;
  pedido = new Promise((resolve, reject) => {
    new GLTFLoader().load(URL_GLB, (gltf) => resolve(gltf.scene || gltf.scenes?.[0]), undefined, reject);
  })
    .then((raiz) => {
      if (!raiz) return;
      molde = preparar(raiz);
      grupo = new THREE.Group();
      grupo.name = "bocas-caverna";
      cenaRef?.add(grupo);
    })
    .catch((err) => {
      console.error("boca caverna", err);
      pedido = null;
    });
}

export function criarBocasCaverna3d(scene) {
  garantir(scene);
  return { atualizar: atualizarBocasCaverna };
}

export function atualizarBocasCaverna(px, py) {
  if (!molde || !grupo) {
    if (cenaRef && !molde && !pedido) garantir(cenaRef);
    return;
  }
  if (estadoJogo.interior?.sala3d) {
    grupo.visible = false;
    return;
  }
  grupo.visible = true;
  const lista = bocasPerto(px, py, 1).filter((b) => {
    const dx = b.x - px;
    const dy = b.y - py;
    return dx * dx + dy * dy < RAIO * RAIO;
  });
  while (clones.length < lista.length) {
    const clone = molde.clone(true);
    clone.scale.setScalar(escala);
    grupo.add(clone);
    clones.push(clone);
  }
  for (let i = 0; i < clones.length; i++) {
    const mesh = clones[i];
    const boca = lista[i];
    if (!boca) {
      mesh.visible = false;
      continue;
    }
    mesh.visible = true;
    mesh.position.set(
      boca.x + (boca.dirX || 0) * AVANCO,
      boca.z * ALTURA_BLOCO + LIFT_KAGE,
      boca.y + (boca.dirY || 0) * AVANCO,
    );
    mesh.rotation.set(0, boca.yaw || 0, 0);
    mesh.scale.setScalar(escala);
  }
}
