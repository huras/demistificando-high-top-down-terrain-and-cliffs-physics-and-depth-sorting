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
const AVANCO = 1.05;
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
  raiz.position.sub(box.getCenter(new THREE.Vector3()));
  return raiz;
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
    const avanco = AVANCO;
    mesh.position.set(
      boca.x + (boca.dirX || 0) * avanco,
      boca.z * ALTURA_BLOCO + ALTURA_ALVO * 0.5,
      boca.y + (boca.dirY || 0) * avanco,
    );
    mesh.rotation.set(0, boca.yaw || 0, 0);
    mesh.scale.setScalar(escala);
  }
}
