/**
 * Props OBJ: carga, cache, clone e InstancedMesh (correios).
 */
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { BASE_PROPS, defDoProp, tintDaCama } from "../../mundo/cidade/catalogoProps.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import { aplicarProfundidadeVolume } from "./ceu/luzBillboard.js";
import { aplicarTintCorreio } from "./props/tintCorreio.js";
import {
  carregarSlotsCura,
  posicaoSlotCura,
  QTD_SLOTS_CURA,
  slotsCuraAtuais,
} from "../../jogo/slotsCuraConfig.js";
import { BOLA_DIAMETRO } from "../../config.js";
import { devolverInstanciaBola, obterInstanciaBola } from "../../pokemon/malhaBola.js";
import { aplicarEscalaProp } from "./escalaVertical.js";

/** Fração do menor eixo XZ (mundo) → diâmetro da bola no slot. */
const FRACAO_BOLA_CURA = 0.28;
const DIAMETRO_BOLA_CURA_MIN = 0.35;
const DIAMETRO_BOLA_CURA_MAX = 0.85;

const cache = new Map();
const pedidos = new Map();
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _esc = new THREE.Vector3(1, 1, 1);
const _cor = new THREE.Color();
const _caixaBola = new THREE.Box3();
const _tamBola = new THREE.Vector3();
const _escalaMundo = new THREE.Vector3();

/** Diâmetro das bolas a partir do AABB em espaço de mundo. */
export function diametroBolaCuraPara(raiz) {
  if (!raiz) return DIAMETRO_BOLA_CURA_MIN;
  raiz.updateMatrixWorld(true);
  _caixaBola.setFromObject(raiz);
  if (_caixaBola.isEmpty()) return DIAMETRO_BOLA_CURA_MIN;
  _caixaBola.getSize(_tamBola);
  const base = Math.min(
    Number.isFinite(_tamBola.x) ? _tamBola.x : 1,
    Number.isFinite(_tamBola.z) ? _tamBola.z : 1,
  );
  const d = Math.max(0.25, base) * FRACAO_BOLA_CURA;
  return Math.max(DIAMETRO_BOLA_CURA_MIN, Math.min(DIAMETRO_BOLA_CURA_MAX, d));
}

/**
 * O prop já tem scale no grupo; sem isso, offsets/bolas ficam em unidades
 * do OBJ cru e parecem formigas na máquina.
 */
function compensarEscalaDoProp(suporte, raiz) {
  raiz.updateMatrixWorld(true);
  raiz.getWorldScale(_escalaMundo);
  const ix = Math.abs(_escalaMundo.x) > 1e-8 ? 1 / _escalaMundo.x : 1;
  const iy = Math.abs(_escalaMundo.y) > 1e-8 ? 1 / _escalaMundo.y : 1;
  const iz = Math.abs(_escalaMundo.z) > 1e-8 ? 1 / _escalaMundo.z : 1;
  suporte.scale.set(ix, iy, iz);
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

/** clone() perde onBeforeCompile; reidrata luz de cidade + profundidade de volume. */
function clonarMaterialProp(mat) {
  const clone = mat ? mat.clone() : new THREE.MeshLambertMaterial({ color: 0xffffff });
  aplicarLuzCidade(clone);
  const y = mat?.userData?.profundidadeVolumeY;
  if (y != null && Number.isFinite(y)) {
    const folga = mat.userData.profundidadeVolumeFolga;
    aplicarProfundidadeVolume(clone, y, folga != null ? folga : undefined);
  }
  return clone;
}

/** Malhas visíveis do molde, geo já no espaço local do grupo (sem scale). */
function partesInstanciaCorreio(molde) {
  if (molde.partesInstancia) return molde.partesInstancia;
  molde.grupo.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(molde.grupo.matrixWorld).invert();
  const partes = [];
  molde.grupo.traverse((filho) => {
    if (!filho.isMesh || !filho.visible || !filho.geometry) return;
    if (filho.material?.visible === false) return;
    const geo = filho.geometry.clone();
    filho.updateWorldMatrix(true, false);
    geo.applyMatrix4(filho.matrixWorld);
    geo.applyMatrix4(inv);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mat = clonarMaterialProp(filho.material);
    mat.side = THREE.DoubleSide;
    aplicarTintCorreio(mat);
    partes.push({ geo, mat });
  });
  if (!partes.length) throw new Error(`prop ${molde.id} sem malha`);
  molde.partesInstancia = partes;
  return partes;
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
      aplicarEscalaProp(medido.grupo, escala, multY);
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
  return Promise.all([carregarSlotsCura(), ...unicos.map((id) => carregarMoldeProp(id))]).then(
    () => cache,
  );
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
        mats[i] = clonarMaterialProp(mats[i]);
        mats[i].color.copy(_cor);
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
 * Um InstancedMesh por material do correio (board_a / board_b).
 * Tint só nas regiões vermelhas; postes/detalhes ficam neutros.
 * pontos: [{ x, y, cor }] em coords mundiais.
 */
export function anexarCorreiosInstanced(grupo, pontos) {
  const molde = cache.get("correio");
  if (!molde || !pontos?.length) return null;
  const partes = partesInstanciaCorreio(molde);
  const n = pontos.length;
  const raiz = new THREE.Group();
  raiz.name = "correios-instanced";
  _quat.identity();
  _esc.copy(molde.grupo.scale);

  for (let p = 0; p < partes.length; p++) {
    const { geo, mat } = partes[p];
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.name = `correios-parte-${p}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for (let i = 0; i < n; i++) {
      const pt = pontos[i];
      _pos.set(pt.x, ALTURA_PRACA, pt.y);
      _mat4.compose(_pos, _quat, _esc);
      mesh.setMatrixAt(i, _mat4);
      _cor.set(pt.cor || "#c23b3b");
      mesh.setColorAt(i, _cor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    raiz.add(mesh);
  }

  grupo.add(raiz);
  return raiz;
}

function placeholderBolaCura(diametro) {
  const r = Math.max(0.08, diametro * 0.5);
  const geo = new THREE.SphereGeometry(r, 10, 8);
  const faixaGeo = new THREE.CylinderGeometry(r * 1.03, r * 1.03, r * 0.28, 10);
  const faixa = new THREE.MeshLambertMaterial({ color: 0xef4444 });
  aplicarLuzCidade(faixa);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xf8fafc,
    emissive: 0xb8fff0,
    emissiveIntensity: 0,
  });
  aplicarLuzCidade(mat);
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(geo, mat));
  const cinto = new THREE.Mesh(faixaGeo, faixa);
  cinto.rotation.z = Math.PI / 2;
  grupo.add(cinto);
  grupo.userData.mat = mat;
  grupo.userData.placeholder = true;
  return grupo;
}

/**
 * Troca o visual do slot pela malha Collada da ballKey (async).
 * A instância já vem em BOLA_DIAMETRO; multiplicamos até o diâmetro-alvo da máquina.
 * @param {THREE.Object3D} bola
 * @param {string} ballKey
 */
export function garantirVisualBolaCura(bola, ballKey) {
  const chave = ballKey || "pokeball";
  if (!bola || (bola.userData.ballKey === chave && bola.userData.malha)) return;
  if (bola.userData.pedidoKey === chave) return;
  bola.userData.pedidoKey = chave;
  const alvo = bola.userData.diametroAlvo || DIAMETRO_BOLA_CURA_MIN;
  obterInstanciaBola(chave).then((malha) => {
    if (!malha || bola.userData.pedidoKey !== chave) {
      if (malha) devolverInstanciaBola(malha);
      return;
    }
    if (bola.userData.malha) {
      devolverInstanciaBola(bola.userData.malha);
      bola.userData.malha = null;
    }
    while (bola.children.length) bola.remove(bola.children[0]);
    bola.userData.placeholderMesh = null;
    // Clone/pool já vem em BOLA_DIAMETRO; guarda a base pra não acumular no reuso.
    if (malha.userData.escalaBase == null) malha.userData.escalaBase = malha.scale.x || 1;
    malha.scale.setScalar(malha.userData.escalaBase * (alvo / BOLA_DIAMETRO));
    bola.add(malha);
    bola.userData.malha = malha;
    bola.userData.ballKey = chave;
    bola.userData.mat = null;
    bola.userData.placeholder = false;
  });
}

/**
 * Layout em unidades de mundo (alturaAlvo ≈ metros do prop).
 * Compensa a scale do grupo do OBJ pra slider 1.0 ≈ 1 unidade visível.
 */
export function aplicarPoseBolasCura(suporte, layout, bolas) {
  if (!suporte) return;
  const raiz = suporte.parent;
  if (raiz) compensarEscalaDoProp(suporte, raiz);
  const sx = suporte.scale.x;
  const sy = suporte.scale.y;
  const sz = suporte.scale.z;
  const sp = layout?.suporte || { x: 0, y: 1.35, z: 0.15 };
  // position do suporte ainda é espaço local do prop → divide pela scale do pai.
  suporte.position.set(sp.x * sx, sp.y * sy, sp.z * sz);
  if (!bolas?.length) return;
  const slots = layout?.slots || [];
  for (let i = 0; i < bolas.length; i++) {
    const pos = posicaoSlotCura(slots[i]);
    const bola = bolas[i];
    bola.userData.baseY = pos.y;
    bola.position.set(pos.x, pos.y, pos.z);
  }
}

/** Bolas da máquina de cura grudadas no topo da malha 3D. */
export function criarBolasCuraNaMalha(raiz) {
  const layout = slotsCuraAtuais();
  const diametro = diametroBolaCuraPara(raiz);
  const bolas = [];
  const suporte = new THREE.Group();
  suporte.name = "bolas-cura";
  raiz.add(suporte);
  for (let i = 0; i < QTD_SLOTS_CURA; i++) {
    const bola = new THREE.Group();
    const ph = placeholderBolaCura(diametro);
    bola.add(ph);
    bola.userData.placeholderMesh = ph;
    bola.userData.mat = ph.userData.mat;
    bola.userData.placeholder = true;
    bola.userData.diametroAlvo = diametro;
    bola.userData.ballKey = null;
    bola.visible = false;
    suporte.add(bola);
    bolas.push(bola);
    garantirVisualBolaCura(bola, "pokeball");
  }
  aplicarPoseBolasCura(suporte, layout, bolas);
  return bolas;
}
