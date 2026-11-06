/**
 * Colmeias dos lares de abelha: InstancedMesh no mesmo passe da palha.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ALTURA_BLOCO } from "../../config.js";
import {
  BASE_COLMEIA,
  COLMEIA_ALTURA_ALVO,
  COLMEIA_CAP,
  COLMEIA_LIFT_Y,
  COLMEIA_RAIO,
  COLMEIA_RECUO,
  COLMEIA_YAW_MODELO,
} from "../../mundo/overworld/catalogoColmeia.js";
import { alturaEm } from "../../mundo/altura.js";
import { yawEntradaLar } from "../../pokemon/laresSitio.js";
import { sincronizarGrupoDiscos } from "../../fisica/obstaculos.js";
import { estado as estadoJogo } from "../../jogo/estado.js";

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _esc = new THREE.Vector3(1, 1, 1);
const _eul = new THREE.Euler(0, 0, 0, "YXZ");
const _mat4 = new THREE.Matrix4();
const _discos = [];

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
let assinatura = "";

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
      name: m.name || "colmeia",
      map: m.map || null,
      color: 0xffffff,
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

function carregarGltf() {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(BASE_COLMEIA, (gltf) => {
      resolve(gltf.scene || gltf.scenes?.[0] || null);
    }, undefined, reject);
  });
}

function yawFallback(lar) {
  const id = String(lar.id || `${lar.x},${lar.y}`);
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

function pisoDoLar(lar) {
  const hz = alturaEm(Math.floor(lar.x), Math.floor(lar.y));
  return (Number.isFinite(hz) && hz > 0 ? hz : lar.z || 0);
}

function prepararPartes(raiz) {
  raiz.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(raiz);
  if (caixa.isEmpty()) throw new Error("colmeia sem volume");
  const sy = Math.max(0.01, caixa.max.y - caixa.min.y);
  escala = COLMEIA_ALTURA_ALVO / sy;
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
    if (geo.getAttribute("uv1")) geo.deleteAttribute("uv1");
    if (geo.getAttribute("uv2")) geo.deleteAttribute("uv2");
    filho.updateWorldMatrix(true, false);
    geo.applyMatrix4(filho.matrixWorld);
    geo.translate(-cx, -cy, -cz);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mat = Array.isArray(filho.material) ? filho.material[0] : filho.material;
    if (!mat || mat.visible === false) return;
    partes.push({ geo, mat: mat.clone() });
  });
  if (!partes.length) throw new Error("colmeia sem malha");
  return partes;
}

function montarMalhas(raiz) {
  const partes = prepararPartes(raiz);
  grupo = new THREE.Group();
  grupo.name = "colmeia-lares";
  malhas = [];
  for (let i = 0; i < partes.length; i++) {
    const { geo, mat } = partes[i];
    const mesh = new THREE.InstancedMesh(geo, mat, COLMEIA_CAP);
    mesh.name = `colmeia-parte-${i}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
  pedido = carregarGltf()
    .then((raiz) => {
      if (!raiz) throw new Error("colmeia sem cena");
      montarMalhas(raiz);
    })
    .catch((err) => {
      console.error("colmeia 3d", err);
      pedido = null;
      pronto = false;
      malhas = null;
      grupo = null;
    });
}

export function colmeiaCarregada() {
  return !!(pronto && malhas && grupo);
}

/**
 * @param {THREE.Scene} scene
 */
export function criarColmeiaLar3d(scene) {
  garantirMalhas(scene);
  return {
    atualizar: sincronizarColmeias,
    get grupo() {
      return grupo;
    },
  };
}

function limparInstancias() {
  if (!malhas) return;
  for (let m = 0; m < malhas.length; m++) malhas[m].count = 0;
}

/**
 * Desenha as colmeias da lista já filtrada e atualiza o disco.
 * null esconde (interior) e tira a colisão.
 * @param {{ id?: string, x: number, y: number, z?: number }[] | null} lista
 */
export function sincronizarColmeias(lista) {
  if (!colmeiaCarregada()) {
    if (cenaRef && !malhas && !pedido) garantirMalhas(cenaRef);
    if (!lista) sincronizarGrupoDiscos("colmeia", []);
    return;
  }
  if (!lista || estadoJogo.interior?.sala3d) {
    grupo.visible = false;
    limparInstancias();
    assinatura = "";
    sincronizarGrupoDiscos("colmeia", []);
    return;
  }

  grupo.visible = true;
  const n = Math.min(lista.length, COLMEIA_CAP);
  let marca = "";
  _esc.set(escala, escala, escala);
  for (let i = 0; i < n; i++) {
    const lar = lista[i];
    const piso = pisoDoLar(lar);
    const yawMundo = yawEntradaLar(lar.id) ?? yawFallback(lar);
    const ox = -Math.sin(yawMundo) * COLMEIA_RECUO;
    const oz = -Math.cos(yawMundo) * COLMEIA_RECUO;
    const x = lar.x + ox;
    const yMapa = lar.y + oz;
    _pos.set(x, piso * ALTURA_BLOCO + COLMEIA_LIFT_Y, yMapa);
    _eul.set(0, yawMundo + COLMEIA_YAW_MODELO, 0);
    _quat.setFromEuler(_eul);
    _mat4.compose(_pos, _quat, _esc);
    for (let m = 0; m < malhas.length; m++) malhas[m].setMatrixAt(i, _mat4);
    let disco = _discos[i];
    if (!disco) {
      disco = { id: "", x: 0, y: 0, z: 0, r: COLMEIA_RAIO };
      _discos[i] = disco;
    }
    disco.id = lar.id || `${x},${yMapa}`;
    disco.x = x;
    disco.y = yMapa;
    disco.z = piso;
    disco.r = COLMEIA_RAIO;
    marca += disco.id + "@" + piso + "@" + (yawMundo * 1000 | 0) + ";";
  }
  _discos.length = n;
  for (let m = 0; m < malhas.length; m++) {
    malhas[m].count = n;
    malhas[m].instanceMatrix.needsUpdate = true;
    if (n > 0) malhas[m].computeBoundingSphere();
  }
  if (marca !== assinatura) {
    assinatura = marca;
    sincronizarGrupoDiscos("colmeia", _discos);
  }
}
