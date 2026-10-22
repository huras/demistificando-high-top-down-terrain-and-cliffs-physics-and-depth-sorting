/**
 * Modelos 3D das pokébolas (Collada LGPE).
 * SkinnedMesh → Mesh estático na pose de bind (bola fechada), mantendo UV/mapa.
 * Só corrige transparency do Collada e flipY (OpenGL).
 */
import * as THREE from "three";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { clone as clonarEsqueleto } from "three/addons/utils/SkeletonUtils.js";

const loader = new ColladaLoader();

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

/** Diâmetro alvo no mundo (unidades Three). */
const DIAMETRO = 0.5;

/** Transparency do Collada LGPE deixa blending quebrado — não troca o map. */
function consertarMaterial(mat) {
  if (!mat) return;
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
  mat.alphaTest = 0;
  mat.side = THREE.FrontSide;
  if (mat.alphaMap) mat.alphaMap = null;
  if (mat.map) {
    // Collada/OpenGL: V=0 embaixo. Sem isso o atlas fica invertido.
    mat.map.flipY = false;
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.needsUpdate = true;
  }
  mat.needsUpdate = true;
}

/**
 * SkinnedMesh na pose de bind → Mesh estático.
 * Sem skeleton o clone/pool e o AABB quebram (bola some → placeholder 2D).
 * UV e materiais do Collada ficam intactos.
 */
function bakePoseBind(raiz) {
  const grupo = new THREE.Group();
  raiz.updateMatrixWorld(true);

  raiz.traverse((obj) => {
    if (!obj.isMesh && !obj.isSkinnedMesh) return;

    if (obj.isSkinnedMesh && obj.skeleton) {
      obj.skeleton.pose();
      obj.updateMatrixWorld(true);
    }

    const geo = obj.geometry.clone();
    // Bind-shape já está nos verts; aplica o transform do nó.
    geo.applyMatrix4(obj.matrixWorld);
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingSphere) geo.computeBoundingSphere();

    let mats;
    if (Array.isArray(obj.material)) {
      mats = obj.material.map((m) => {
        const c = m.clone();
        consertarMaterial(c);
        return c;
      });
    } else {
      mats = obj.material.clone();
      consertarMaterial(mats);
    }

    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.name = obj.name || "bola";
    grupo.add(mesh);
  });

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
  for (let i = 0; i < grupo.children.length; i++) {
    grupo.children[i].position.sub(centro);
  }
  const maior = Math.max(tam.x, tam.y, tam.z, 1e-4);
  grupo.scale.setScalar(DIAMETRO / maior);
  grupo.updateMatrixWorld(true);
  return true;
}

function preparar(cena) {
  const raiz = clonarEsqueleto(cena);
  const grupo = bakePoseBind(raiz);
  if (!grupo.children.length) {
    console.warn("Pokébola Collada sem malhas");
    return null;
  }
  if (!normalizarTamanho(grupo)) {
    console.warn("Pokébola Collada com AABB vazio");
    return null;
  }
  return grupo;
}

function pedirMolde(key) {
  const chave = URL_POR_KEY[key] ? key : "pokeball";
  if (moldes.has(chave)) return moldes.get(chave);
  const url = URL_POR_KEY[chave];
  const promessa = loader
    .loadAsync(url)
    .then((col) => {
      if (!col?.scene) return null;
      const molde = preparar(col.scene);
      if (!molde) return null;
      molde.name = `molde-bola-${chave}`;
      molde.userData.ballKey = chave;
      return molde;
    })
    .catch((err) => {
      console.warn("Falha ao carregar pokébola 3D:", chave, err);
      return null;
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
      return livre;
    }
  }
  const molde = await pedirMolde(chave);
  if (!molde) return null;
  // Já é Mesh estático — clone simples
  const inst = molde.clone(true);
  inst.traverse((obj) => {
    if (!obj.isMesh) return;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => {
        if (!m) return m;
        const c = m.clone();
        consertarMaterial(c);
        return c;
      });
    } else if (obj.material) {
      obj.material = obj.material.clone();
      consertarMaterial(obj.material);
    }
    obj.visible = true;
    obj.frustumCulled = false;
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
