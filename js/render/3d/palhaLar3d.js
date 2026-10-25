/**
 * Straw beds dos lares: InstancedMesh syncado por proximidade.
 */
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { ALTURA_BLOCO } from "../../config.js";
import {
  BASE_PALHA,
  PALHA_ALTURA_ALVO,
  PALHA_RAIO_SYNC,
} from "../../mundo/overworld/catalogoPalha.js";
import { listarLaresProximos } from "../../pokemon/laresMapa.js";
import { sincronizarPalha } from "../../fisica/palha.js";
import { estado as estadoJogo } from "../../jogo/estado.js";

const CAP = 128;
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _esc = new THREE.Vector3(1, 1, 1);
const _eul = new THREE.Euler(0, 0, 0, "YXZ");
const _mat4 = new THREE.Matrix4();

/** @type {THREE.Group | null} */
let grupo = null;
/** @type {THREE.InstancedMesh[] | null} */
let malhas = null;
/** @type {Promise<void> | null} */
let pedido = null;
let escala = 1;
let pronto = false;

function consertarNormais(geo) {
  const normal = geo.getAttribute("normal");
  if (!normal) {
    geo.computeVertexNormals();
    return;
  }
  const arr = normal.array;
  for (let i = 0; i < arr.length; i++) {
    if (Number.isFinite(arr[i])) continue;
    geo.computeVertexNormals();
    return;
  }
}

function ajustarMaterial(mat) {
  const lista = Array.isArray(mat) ? mat : [mat];
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    if (!m) continue;
    const novo = new THREE.MeshLambertMaterial({
      name: m.name || "",
      map: m.map || null,
      color: 0xffffff,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    });
    if (novo.map) {
      novo.map.colorSpace = THREE.SRGBColorSpace;
      novo.map.magFilter = THREE.NearestFilter;
      novo.map.minFilter = THREE.NearestFilter;
      novo.map.generateMipmaps = false;
      novo.map.needsUpdate = true;
    }
    lista[i] = novo;
    m.dispose();
  }
  return Array.isArray(mat) ? lista : lista[0];
}

function carregarObj() {
  return new Promise((resolve, reject) => {
    const mats = new MTLLoader();
    mats.setResourcePath(BASE_PALHA);
    mats.load(
      `${BASE_PALHA}modelo.mtl`,
      (prontoMtl) => {
        prontoMtl.preload();
        const obj = new OBJLoader();
        obj.setMaterials(prontoMtl);
        obj.load(`${BASE_PALHA}modelo.obj`, resolve, undefined, reject);
      },
      undefined,
      reject,
    );
  });
}

function yawDoLar(lar) {
  const id = String(lar.id || `${lar.x},${lar.y}`);
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

function prepararPartes(raiz) {
  raiz.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(raiz);
  if (caixa.isEmpty()) throw new Error("palha sem volume");
  const sy = Math.max(0.01, caixa.max.y - caixa.min.y);
  escala = PALHA_ALTURA_ALVO / sy;
  const cx = (caixa.min.x + caixa.max.x) * 0.5;
  const cz = (caixa.min.z + caixa.max.z) * 0.5;
  const cy = caixa.min.y;

  const partes = [];
  raiz.traverse((filho) => {
    if (!filho.isMesh || !filho.geometry) return;
    consertarNormais(filho.geometry);
    filho.material = ajustarMaterial(filho.material);
    if (filho.material?.visible === false) return;
    const geo = filho.geometry.clone();
    filho.updateWorldMatrix(true, false);
    geo.applyMatrix4(filho.matrixWorld);
    // Origem no centro XZ / base Y
    geo.translate(-cx, -cy, -cz);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mat = Array.isArray(filho.material)
      ? filho.material[0]
      : filho.material;
    if (!mat || mat.visible === false) return;
    partes.push({ geo, mat: mat.clone() });
  });
  if (!partes.length) throw new Error("palha sem malha");
  return partes;
}

function garantirMalhas(scene) {
  if (malhas || pedido) return;
  pedido = carregarObj()
    .then((raiz) => {
      const partes = prepararPartes(raiz);
      grupo = new THREE.Group();
      grupo.name = "palha-lares";
      malhas = [];
      for (let i = 0; i < partes.length; i++) {
        const { geo, mat } = partes[i];
        const mesh = new THREE.InstancedMesh(geo, mat, CAP);
        mesh.name = `palha-parte-${i}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mesh.count = 0;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        grupo.add(mesh);
        malhas.push(mesh);
      }
      scene.add(grupo);
      pronto = true;
    })
    .catch((err) => {
      console.error("palha 3d", err);
      pedido = null;
    });
}

/**
 * @param {THREE.Scene} scene
 */
export function criarPalhaLar3d(scene) {
  garantirMalhas(scene);
  return {
    atualizar: atualizarPalhaLares,
  };
}

/**
 * Sync InstancedMesh com lares próximos do jogador.
 * @param {number} px
 * @param {number} py
 */
export function atualizarPalhaLares(px, py) {
  if (!pronto || !malhas || !grupo) return;
  if (estadoJogo.interior?.sala3d) {
    grupo.visible = false;
    for (let m = 0; m < malhas.length; m++) malhas[m].count = 0;
    return;
  }
  grupo.visible = true;
  const lista = listarLaresProximos(px, py, PALHA_RAIO_SYNC);
  sincronizarPalha(px, py, lista);
  const n = Math.min(lista.length, CAP);
  _esc.set(escala, escala, escala);
  for (let i = 0; i < n; i++) {
    const lar = lista[i];
    _pos.set(lar.x, (lar.z || 0) * ALTURA_BLOCO, lar.y);
    _eul.set(0, yawDoLar(lar), 0);
    _quat.setFromEuler(_eul);
    _mat4.compose(_pos, _quat, _esc);
    for (let m = 0; m < malhas.length; m++) {
      malhas[m].setMatrixAt(i, _mat4);
    }
  }
  for (let m = 0; m < malhas.length; m++) {
    malhas[m].count = n;
    malhas[m].instanceMatrix.needsUpdate = true;
  }
}
