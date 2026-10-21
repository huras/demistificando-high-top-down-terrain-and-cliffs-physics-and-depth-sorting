/**
 * Props OBJ: carga, cache, clone e InstancedMesh (correios).
 */
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { BASE_PROPS, defDoProp, tintDaCama } from "../../mundo/cidade/catalogoProps.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import { aplicarProfundidadeVolume } from "./ceu/luzBillboard.js";
import { SLOTS_CURA } from "../../jogo/maquinaCura.js";

const cache = new Map();
const pedidos = new Map();
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _esc = new THREE.Vector3(1, 1, 1);
const _cor = new THREE.Color();

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
    const nome = (m.name || "").toLowerCase();
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
    if (nome.includes("kage") || nome.includes("shade")) {
      novo.visible = false;
      novo.transparent = true;
      novo.opacity = 0;
    }
    lista[i] = novo;
    aplicarLuzCidade(novo);
    m.dispose();
  }
  return Array.isArray(mat) ? lista : lista[0];
}

function partirMultiMaterial(mesh) {
  const mats = mesh.material;
  if (!Array.isArray(mats) || !mesh.geometry?.groups?.length || !mesh.parent) return;
  const geo = mesh.geometry;
  const grupos = geo.groups;
  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    const mat = mats[grupo.materialIndex];
    if (!mat) continue;
    const parteGeo = geo.clone();
    parteGeo.clearGroups();
    parteGeo.setDrawRange(grupo.start, grupo.count);
    const parte = new THREE.Mesh(parteGeo, mat);
    parte.name = mat.name || mesh.name;
    parte.position.copy(mesh.position);
    parte.quaternion.copy(mesh.quaternion);
    parte.scale.copy(mesh.scale);
    mesh.parent.add(parte);
  }
  mesh.parent.remove(mesh);
  geo.dispose();
}

function marcarVolume(raiz, yChao) {
  const amostra = new THREE.Vector3();
  raiz.traverse((filho) => {
    if (!filho.isMesh || !filho.visible || !filho.material) return;
    amostra.set(0, yChao, 0);
    filho.worldToLocal(amostra);
    aplicarProfundidadeVolume(filho.material, amostra.y);
  });
}

function preparar(raiz) {
  const multi = [];
  raiz.traverse((filho) => {
    if (filho.isMesh && Array.isArray(filho.material)) multi.push(filho);
  });
  for (let i = 0; i < multi.length; i++) partirMultiMaterial(multi[i]);
  raiz.traverse((filho) => {
    if (!filho.isMesh) return;
    const nome = (filho.material?.name || "").toLowerCase();
    if (nome.includes("kage") || nome.includes("shade")) {
      filho.visible = false;
      filho.castShadow = false;
      filho.receiveShadow = false;
      return;
    }
    consertarNormais(filho.geometry);
    filho.material = ajustarMaterial(filho.material);
    if (filho.material?.visible === false) {
      filho.visible = false;
      return;
    }
    filho.castShadow = true;
    filho.receiveShadow = true;
    filho.frustumCulled = true;
    filho.geometry.computeBoundingSphere();
  });
  raiz.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(raiz);
  if (caixa.isEmpty() || !Number.isFinite(caixa.min.y) || !Number.isFinite(caixa.max.y)) {
    throw new Error("prop sem volume");
  }
  marcarVolume(raiz, caixa.min.y);
  const grupo = new THREE.Group();
  raiz.position.set(
    -((caixa.min.x + caixa.max.x) * 0.5),
    -caixa.min.y,
    -((caixa.min.z + caixa.max.z) * 0.5),
  );
  grupo.add(raiz);
  const sy = Math.max(0.01, caixa.max.y - caixa.min.y);
  const sx = Math.max(0.01, caixa.max.x - caixa.min.x);
  const sz = Math.max(0.01, caixa.max.z - caixa.min.z);
  return { grupo, sx, sy, sz };
}

function carregarObj(pasta) {
  const base = `${BASE_PROPS}${pasta}/`;
  return new Promise((resolve, reject) => {
    const mats = new MTLLoader();
    mats.setResourcePath(base);
    mats.load(
      `${base}modelo.mtl`,
      (pronto) => {
        pronto.preload();
        const obj = new OBJLoader();
        obj.setMaterials(pronto);
        obj.load(`${base}modelo.obj`, resolve, undefined, reject);
      },
      undefined,
      reject,
    );
  });
}

/** Funde malhas visíveis do molde num único geo (já na escala do grupo). */
function geometriaFundida(molde) {
  if (molde.geoInstancia) return molde.geoInstancia;
  molde.grupo.updateMatrixWorld(true);
  const geos = [];
  let matBase = null;
  molde.grupo.traverse((filho) => {
    if (!filho.isMesh || !filho.visible || !filho.geometry) return;
    const geo = filho.geometry.clone();
    filho.updateWorldMatrix(true, false);
    geo.applyMatrix4(filho.matrixWorld);
    geos.push(geo);
    if (!matBase && filho.material?.visible !== false) matBase = filho.material;
  });
  if (!geos.length) throw new Error(`prop ${molde.id} sem malha`);
  const fundido = mergeGeometries(geos, false);
  for (let i = 0; i < geos.length; i++) geos[i].dispose();
  if (!fundido) throw new Error(`merge falhou ${molde.id}`);
  // Volta ao espaço local do molde (mundo relativo ao grupo na origem).
  const inv = new THREE.Matrix4().copy(molde.grupo.matrixWorld).invert();
  fundido.applyMatrix4(inv);
  fundido.computeBoundingSphere();
  fundido.computeBoundingBox();
  molde.geoInstancia = fundido;
  molde.matInstancia = matBase
    ? matBase.clone()
    : new THREE.MeshLambertMaterial({ color: 0xffffff });
  molde.matInstancia.side = THREE.DoubleSide;
  aplicarLuzCidade(molde.matInstancia);
  return fundido;
}

export function carregarMoldeProp(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (pedidos.has(id)) return pedidos.get(id);
  const def = defDoProp(id);
  if (!def) return Promise.resolve(null);
  const pedido = carregarObj(def.pasta)
    .then((raiz) => {
      const medido = preparar(raiz);
      const escala = (def.alturaAlvo || 1.5) / medido.sy;
      if (!Number.isFinite(escala) || escala <= 0) throw new Error(`escala invalida ${escala}`);
      const multY = Number.isFinite(def.escalaY) && def.escalaY > 0 ? def.escalaY : 1;
      medido.grupo.scale.set(escala, escala * multY, escala);
      medido.grupo.name = `molde-${id}`;
      const molde = {
        id,
        def,
        grupo: medido.grupo,
        sy: def.alturaAlvo * multY,
        sx: medido.sx * escala,
        sz: medido.sz * escala,
      };
      cache.set(id, molde);
      return molde;
    })
    .catch((erro) => {
      console.error("prop 3d", id, erro);
      pedidos.delete(id);
      return null;
    })
    .finally(() => {
      pedidos.delete(id);
    });
  pedidos.set(id, pedido);
  return pedido;
}

export function carregarMoldesProps(ids) {
  const unicos = [];
  const visto = new Set();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!id || visto.has(id) || !defDoProp(id)) continue;
    visto.add(id);
    unicos.push(id);
  }
  return Promise.all(unicos.map((id) => carregarMoldeProp(id))).then(() => cache);
}

/**
 * Instancia um prop no chão. Frente pro sul (yaw 0), igual às casas 3D.
 * opts.tint: cor hex pra tingir materiais (camas).
 */
export function instanciarProp(id, x, z, opts = {}) {
  const molde = cache.get(id);
  if (!molde) return null;
  const inst = molde.grupo.clone(true);
  inst.name = `prop-${id}`;
  inst.position.set(x, ALTURA_PRACA + (opts.yExtra || 0), z);
  inst.rotation.y = opts.yaw != null ? opts.yaw : 0;
  if (molde.def.parede && opts.yExtra == null) {
    inst.position.y = ALTURA_PRACA + (opts.alturaParede != null ? opts.alturaParede : 1.1);
  }
  if (opts.tint) {
    _cor.set(opts.tint);
    inst.traverse((filho) => {
      if (!filho.isMesh || !filho.material || filho.material.visible === false) return;
      const mats = Array.isArray(filho.material) ? filho.material : [filho.material];
      for (let i = 0; i < mats.length; i++) {
        if (!mats[i] || mats[i].visible === false) continue;
        mats[i] = mats[i].clone();
        mats[i].color.copy(_cor);
        aplicarLuzCidade(mats[i]);
      }
      filho.material = Array.isArray(filho.material) ? mats : mats[0];
    });
  }
  return inst;
}

export function instanciarCama(idSprite, x, z) {
  return instanciarProp("cama", x, z, { tint: tintDaCama(idSprite) || undefined });
}

/**
 * Um InstancedMesh por lote de correios. pontos: [{ x, y, cor }].
 * Coordenadas já mundiais (com ox/oy aplicados).
 */
export function anexarCorreiosInstanced(grupo, pontos) {
  const molde = cache.get("correio");
  if (!molde || !pontos?.length) return null;
  const geo = geometriaFundida(molde);
  const mat = molde.matInstancia.clone();
  mat.vertexColors = false;
  aplicarLuzCidade(mat);
  const mesh = new THREE.InstancedMesh(geo, mat, pontos.length);
  mesh.name = "correios-instanced";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  _quat.identity();
  // Geo fundida está no espaço local sem o scale do molde; aplica na instância.
  _esc.copy(molde.grupo.scale);
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i];
    _pos.set(p.x, ALTURA_PRACA, p.y);
    _mat4.compose(_pos, _quat, _esc);
    mesh.setMatrixAt(i, _mat4);
    _cor.set(p.cor || "#c23b3b");
    mesh.setColorAt(i, _cor);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  grupo.add(mesh);
  return mesh;
}

/** Bolas da máquina de cura grudadas no topo da malha 3D. */
export function criarBolasCuraNaMalha(raiz) {
  const bolas = [];
  const geo = new THREE.SphereGeometry(0.16, 10, 8);
  const faixaGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.045, 10);
  const faixa = new THREE.MeshLambertMaterial({ color: 0xef4444 });
  aplicarLuzCidade(faixa);
  const suporte = new THREE.Group();
  suporte.name = "bolas-cura";
  suporte.position.set(0, 1.17, 0.08);
  raiz.add(suporte);
  for (let i = 0; i < SLOTS_CURA.length; i++) {
    const slot = SLOTS_CURA[i];
    const mat = new THREE.MeshLambertMaterial({
      color: 0xf8fafc,
      emissive: 0xb8fff0,
      emissiveIntensity: 0,
    });
    aplicarLuzCidade(mat);
    const bola = new THREE.Group();
    bola.add(new THREE.Mesh(geo, mat));
    const cinto = new THREE.Mesh(faixaGeo, faixa);
    cinto.rotation.z = Math.PI / 2;
    bola.add(cinto);
    const baseY = -slot.y;
    bola.position.set(slot.x, baseY, 0);
    bola.userData.baseY = baseY;
    bola.userData.mat = mat;
    bola.visible = false;
    suporte.add(bola);
    bolas.push(bola);
  }
  return bolas;
}
