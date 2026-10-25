/**
 * Straw beds dos lares: InstancedMesh syncado por proximidade.
 */
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { ALTURA_BLOCO, POKEMON } from "../../config.js";
import {
  BASE_PALHA,
  PALHA_ALTURA_ALVO,
  PALHA_RAIO_SYNC,
} from "../../mundo/overworld/catalogoPalha.js";
import { alturaEm } from "../../mundo/altura.js";
import { listarLaresProximos } from "../../pokemon/laresMapa.js";
import { sincronizarPalha } from "../../fisica/palha.js";
import { estado as estadoJogo } from "../../jogo/estado.js";

const CAP = 128;
/** Folga pra não z-fightar com o chão voxel. */
const LIFT_Y = 0.04;
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
/** @type {THREE.Scene | null} */
let cenaRef = null;
let escala = 1;
let pronto = false;

function raioSync() {
  const r = Number(POKEMON?.RAIO_LARES);
  return Number.isFinite(r) && r > 0 ? Math.max(r, PALHA_RAIO_SYNC) : PALHA_RAIO_SYNC;
}

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
      name: m.name || "palha",
      map: m.map || null,
      color: 0xffffff,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthWrite: true,
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

/** Se o MTL não trouxe mapa (nome wara.png às vezes falha), aplica a textura na mão. */
function garantirTextura(raiz) {
  return new Promise((resolve) => {
    let precisa = false;
    raiz.traverse((filho) => {
      if (!filho.isMesh) return;
      const mats = Array.isArray(filho.material) ? filho.material : [filho.material];
      for (let i = 0; i < mats.length; i++) {
        if (mats[i] && !mats[i].map) precisa = true;
      }
    });
    if (!precisa) {
      resolve(raiz);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(
      `${BASE_PALHA}wara.png`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        raiz.traverse((filho) => {
          if (!filho.isMesh) return;
          const mats = Array.isArray(filho.material) ? filho.material : [filho.material];
          for (let i = 0; i < mats.length; i++) {
            if (mats[i] && !mats[i].map) {
              mats[i].map = tex;
              mats[i].needsUpdate = true;
            }
          }
        });
        resolve(raiz);
      },
      undefined,
      () => resolve(raiz),
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
    geo.translate(-cx, -cy, -cz);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mat = Array.isArray(filho.material) ? filho.material[0] : filho.material;
    if (!mat || mat.visible === false) return;
    partes.push({ geo, mat: mat.clone() });
  });
  if (!partes.length) throw new Error("palha sem malha");
  return partes;
}

function montarMalhas(raiz) {
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
    // Instâncias espalhadas: BS do molde na origem culla tudo longe do (0,0).
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grupo.add(mesh);
    malhas.push(mesh);
  }
  if (cenaRef) cenaRef.add(grupo);
  pronto = true;
}

function garantirMalhas(scene) {
  cenaRef = scene;
  if (malhas || pedido) return;
  pedido = carregarObj()
    .then((raiz) => garantirTextura(raiz))
    .then((raiz) => {
      montarMalhas(raiz);
    })
    .catch((err) => {
      console.error("palha 3d", err);
      pedido = null;
      pronto = false;
      malhas = null;
      grupo = null;
    });
}

/**
 * @param {THREE.Scene} scene
 */
export function criarPalhaLar3d(scene) {
  garantirMalhas(scene);
  return {
    atualizar: atualizarPalhaLares,
    get grupo() {
      return grupo;
    },
  };
}

/**
 * Sync InstancedMesh com lares próximos do jogador.
 * @param {number} px
 * @param {number} py
 */
export function atualizarPalhaLares(px, py) {
  if (!pronto || !malhas || !grupo) {
    if (cenaRef && !malhas && !pedido) garantirMalhas(cenaRef);
    return;
  }
  if (estadoJogo.interior?.sala3d) {
    grupo.visible = false;
    for (let m = 0; m < malhas.length; m++) malhas[m].count = 0;
    return;
  }
  grupo.visible = true;
  const lista = listarLaresProximos(px, py, raioSync());
  sincronizarPalha(px, py, lista);
  const n = Math.min(lista.length, CAP);
  _esc.set(escala, escala, escala);
  for (let i = 0; i < n; i++) {
    const lar = lista[i];
    const hz = alturaEm(Math.floor(lar.x), Math.floor(lar.y));
    const y = (Number.isFinite(hz) && hz > 0 ? hz : lar.z || 0) * ALTURA_BLOCO + LIFT_Y;
    _pos.set(lar.x, y, lar.y);
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
    if (n > 0) {
      malhas[m].computeBoundingSphere();
    }
  }
}
