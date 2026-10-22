/**
 * Modelos 3D das pokébolas (Collada LGPE).
 * São SkinnedMesh — precisa SkeletonUtils.clone. Materiais Collada vêm
 * com transparency quebrada; refazemos opacos + textura de cor.
 */
import * as THREE from "three";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { clone as clonarEsqueleto } from "three/addons/utils/SkeletonUtils.js";

const loader = new ColladaLoader();
const texLoader = new THREE.TextureLoader();

/** @type {Map<string, Promise<THREE.Object3D | null>>} */
const moldes = new Map();
/** @type {Map<string, THREE.Object3D[]>} */
const pool = new Map();

const URL_POR_KEY = Object.freeze({
  pokeball: "/assets/models/pokeballs/pokeball/modelo.dae",
  greatball: "/assets/models/pokeballs/greatball/modelo.dae",
  ultraball: "/assets/models/pokeballs/ultraball/modelo.dae",
  masterball: "/assets/models/pokeballs/masterball/modelo.dae",
  premierball: "/assets/models/pokeballs/premierball/modelo.dae",
  boomerangball: "/assets/models/pokeballs/boomerangball/modelo.dae",
});

const TEX_POR_KEY = Object.freeze({
  pokeball: "/assets/models/pokeballs/pokeball/ob0204_00_obj_col.png",
  greatball: "/assets/models/pokeballs/greatball/ob0203_00_obj_col.png",
  ultraball: "/assets/models/pokeballs/ultraball/ob0202_00_obj_col.png",
  masterball: "/assets/models/pokeballs/masterball/ob0201_00_obj_col.png",
  premierball: "/assets/models/pokeballs/premierball/ob0212_00_obj_col.png",
  boomerangball: "/assets/models/pokeballs/boomerangball/ob0216_00_obj_col.png",
});

/** Diâmetro alvo no mundo (unidades Three). */
const DIAMETRO = 0.5;

function materialOpaco(mapa) {
  const mat = new THREE.MeshStandardMaterial({
    map: mapa || null,
    color: 0xffffff,
    metalness: 0.2,
    roughness: 0.4,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.flipY = false;
    mat.map.needsUpdate = true;
  }
  return mat;
}

async function carregarMapa(chave) {
  const url = TEX_POR_KEY[chave] || TEX_POR_KEY.pokeball;
  try {
    return await texLoader.loadAsync(url);
  } catch {
    return null;
  }
}

function esferaFallback(mapa) {
  const geo = new THREE.SphereGeometry(DIAMETRO * 0.5, 24, 16);
  const mesh = new THREE.Mesh(geo, materialOpaco(mapa));
  mesh.castShadow = true;
  const grupo = new THREE.Group();
  grupo.add(mesh);
  return grupo;
}

function normalizarTamanho(grupo) {
  grupo.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(grupo);
  if (caixa.isEmpty()) return false;
  const tam = new THREE.Vector3();
  const centro = new THREE.Vector3();
  caixa.getSize(tam);
  caixa.getCenter(centro);
  grupo.position.sub(centro);
  const maior = Math.max(tam.x, tam.y, tam.z, 1e-4);
  grupo.scale.multiplyScalar(DIAMETRO / maior);
  grupo.updateMatrixWorld(true);
  return true;
}

function aplicarMateriais(raiz, mapa) {
  let malhas = 0;
  raiz.traverse((obj) => {
    if (!obj.isMesh && !obj.isSkinnedMesh) return;
    malhas++;
    obj.visible = true;
    obj.frustumCulled = false;
    obj.castShadow = true;
    obj.receiveShadow = false;
    const mat = materialOpaco(mapa || obj.material?.map || null);
    obj.material = mat;
    if (obj.isSkinnedMesh && obj.skeleton) {
      obj.skeleton.pose();
      obj.normalizeSkinWeights?.();
    }
  });
  return malhas;
}

async function preparar(cena, chave) {
  const mapa = await carregarMapa(chave);
  const raiz = clonarEsqueleto(cena);
  const malhas = aplicarMateriais(raiz, mapa);
  if (!malhas) return esferaFallback(mapa);

  const grupo = new THREE.Group();
  grupo.add(raiz);
  if (!normalizarTamanho(grupo)) return esferaFallback(mapa);

  // Garante pose de bind (bola fechada)
  grupo.traverse((obj) => {
    if (obj.isSkinnedMesh && obj.skeleton) {
      obj.skeleton.pose();
      obj.updateMatrixWorld(true);
    }
  });
  return grupo;
}

function pedirMolde(key) {
  const chave = URL_POR_KEY[key] ? key : "pokeball";
  if (moldes.has(chave)) return moldes.get(chave);
  const url = URL_POR_KEY[chave];
  const promessa = loader
    .loadAsync(url)
    .then((col) => {
      if (!col?.scene) return carregarMapa(chave).then(esferaFallback);
      return preparar(col.scene, chave);
    })
    .then((molde) => {
      if (!molde) return null;
      molde.name = `molde-bola-${chave}`;
      molde.userData.ballKey = chave;
      return molde;
    })
    .catch(async (err) => {
      console.warn("Falha Collada pokébola, usando esfera:", chave, err);
      const mapa = await carregarMapa(chave);
      const esfera = esferaFallback(mapa);
      esfera.userData.ballKey = chave;
      return esfera;
    });
  moldes.set(chave, promessa);
  return promessa;
}

/** Pré-aquece as bolas usadas no jogo. */
export function aquecerMalhasBola(keys = Object.keys(URL_POR_KEY)) {
  for (let i = 0; i < keys.length; i++) pedirMolde(keys[i]);
}

/**
 * @param {string} key
 * @returns {Promise<THREE.Object3D | null>}
 */
export async function obterInstanciaBola(key) {
  const chave = URL_POR_KEY[key] ? key : "pokeball";
  const lista = pool.get(chave) || [];
  while (lista.length) {
    const livre = lista.pop();
    if (livre) {
      livre.visible = true;
      livre.rotation.set(0, 0, 0);
      livre.traverse((o) => {
        if (o.isMesh || o.isSkinnedMesh) {
          o.visible = true;
          if (o.isSkinnedMesh && o.skeleton) o.skeleton.pose();
        }
      });
      return livre;
    }
  }
  const molde = await pedirMolde(chave);
  if (!molde) return null;
  const inst = clonarEsqueleto(molde);
  inst.traverse((obj) => {
    if (!obj.isMesh && !obj.isSkinnedMesh) return;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => (m ? m.clone() : m));
    } else if (obj.material) {
      obj.material = obj.material.clone();
    }
    obj.visible = true;
    obj.frustumCulled = false;
    if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.pose();
  });
  inst.userData.ballKey = chave;
  inst.visible = true;
  return inst;
}

/** Devolve a malha ao pool. */
export function devolverInstanciaBola(mesh) {
  if (!mesh) return;
  mesh.visible = false;
  mesh.removeFromParent();
  mesh.rotation.set(0, 0, 0);
  const chave = mesh.userData.ballKey || "pokeball";
  const lista = pool.get(chave) || [];
  lista.push(mesh);
  pool.set(chave, lista);
}
