/**
 * Moinhos outdoor: post fixo + head (yaw no vento) + fan (spin na intensidade).
 *
 * Preferência de pivô = origin do objeto no Blender (0,0,0 local).
 * OBJ “world baked” perde isso → cai no centro da bbox.
 * Com hierarquia preservada (glTF: fan dentro de head), gira os próprios nós.
 *
 * Offset fino opcional: assets/models/moinho-pivo.json (aba Moinho).
 */
import * as THREE from "three";
import { obterVentoMundo } from "../../clima/amostra.js";
import { offsetMoinho } from "../../mundo/sites/moinhoPivo.js";

const NOME_YAW = "eixo-yaw";
const NOME_FAN = "eixo-fan";
const SPIN_MIN = 2.1;
const SPIN_MAX = 15.6;
const YAW_VEL = 1.35;
const RAIO_ANIM_M = 96;
const RAIO_ANIM2 = RAIO_ANIM_M * RAIO_ANIM_M;

const _box = new THREE.Box3();
const _hub = new THREE.Vector3();
const _centro = new THREE.Vector3();
const _tam = new THREE.Vector3();
const _upMundo = new THREE.Vector3(0, 1, 0);
const _upPai = new THREE.Vector3();
const _quatPai = new THREE.Quaternion();
const _eixoZ = new THREE.Vector3(0, 0, 1);
const _axle = new THREE.Vector3();

/**
 * @param {string} modeloId
 */
export function ehModeloMoinho(modeloId) {
  return String(modeloId || "").startsWith("windmill");
}

function nomeDe(n) {
  return String(n?.name || "").toLowerCase();
}

function coletarPecas(molde) {
  /** @type {THREE.Object3D[]} */
  const posts = [];
  /** @type {THREE.Object3D[]} */
  const heads = [];
  /** @type {THREE.Object3D[]} */
  const fans = [];
  molde.traverse((n) => {
    if (!n.isMesh && !n.isGroup) return;
    // Só folhas com geometria ou grupos nomeados da peça.
    const nome = nomeDe(n);
    if (!nome) return;
    if (!n.isMesh) return;
    if (nome.includes("fan")) fans.push(n);
    else if (nome.includes("head")) heads.push(n);
    else if (nome.includes("post")) posts.push(n);
  });
  return { posts, heads, fans };
}

function ehDescendente(no, ancestral) {
  let p = no?.parent;
  while (p) {
    if (p === ancestral) return true;
    p = p.parent;
  }
  return false;
}

/**
 * Origin Blender = (0,0,0) local. Se o OBJ bakeou world e a origin
 * cai fora da peça, usa centro da bbox (fallback).
 */
function origemDaPeca(meshes, destino, alvoLocal) {
  const m = meshes[0];
  if (!m) return false;
  m.updateWorldMatrix(true, false);
  _hub.set(0, 0, 0);
  m.localToWorld(_hub);
  _box.setFromObject(m);
  if (_box.isEmpty()) {
    destino.worldToLocal(_hub);
    alvoLocal.copy(_hub);
    return true;
  }
  _box.getCenter(_centro);
  _box.getSize(_tam);
  const raio = Math.max(_tam.x, _tam.y, _tam.z, 0.01) * 0.75;
  if (_hub.distanceTo(_centro) > raio) _hub.copy(_centro);
  destino.worldToLocal(_hub);
  alvoLocal.copy(_hub);
  return true;
}

/**
 * Escala Y ≠ XZ no molde (fatorYCasa) + qualquer rotação de filho = shear.
 * Articulação precisa de escala uniforme no ancestral.
 */
function forcarEscalaUniforme(molde) {
  const s = Math.abs(molde.scale.x) || 1;
  molde.scale.set(s, s, s);
}

/** Local +Y do grupo = up do mundo (glTF Y-up no post deixa localY horizontal). */
function alinharYaoMundo(eixo, pai) {
  pai.updateWorldMatrix(true, false);
  pai.getWorldQuaternion(_quatPai);
  _upPai.copy(_upMundo).applyQuaternion(_quatPai.invert()).normalize();
  if (_upPai.lengthSq() < 1e-8) return;
  eixo.quaternion.setFromUnitVectors(_upMundo, _upPai);
}

/**
 * Yaw em volta do poste (mundo Y) + spin no hub do fan (eixo hub←head).
 * @returns {{ eixoYaw: THREE.Object3D, eixoFan: THREE.Object3D }|null}
 */
function usarHierarquiaNativa(molde, modeloId, heads, fans) {
  const head = heads[0];
  const fan = fans[0];
  if (!fan) return null;
  if (head && !ehDescendente(fan, head) && fan.parent !== head) return null;

  const pecaYaw = head || fan.parent;
  if (!pecaYaw?.parent) return null;
  const paiYaw = pecaYaw.parent;

  let eixoYaw =
    paiYaw.name === NOME_YAW
      ? paiYaw
      : pecaYaw.parent?.name === NOME_YAW
        ? pecaYaw.parent
        : null;

  if (!eixoYaw) {
    eixoYaw = new THREE.Group();
    eixoYaw.name = NOME_YAW;
    eixoYaw.position.copy(pecaYaw.position);
    alinharYaoMundo(eixoYaw, paiYaw);
    paiYaw.add(eixoYaw);
    eixoYaw.attach(pecaYaw);
  }

  let eixoFan = fan.parent?.name === NOME_FAN ? fan.parent : null;
  if (!eixoFan) {
    const paiFan = fan.parent;
    if (!paiFan) return null;
    // Pivô = origin Blender do fan (hub). Sem isso, Group em (0,0,0) do head
    // faz o ventilador orbitar o head (“sistema solar”).
    _axle.copy(fan.position);
    const len = _axle.length();
    eixoFan = new THREE.Group();
    eixoFan.name = NOME_FAN;
    eixoFan.position.copy(fan.position);
    if (len > 1e-5) {
      _axle.multiplyScalar(1 / len);
      eixoFan.quaternion.setFromUnitVectors(_eixoZ, _axle);
    }
    paiFan.add(eixoFan);
    eixoFan.attach(fan);
    eixoFan.userData.hubBase = {
      x: eixoFan.position.x,
      y: eixoFan.position.y,
      z: eixoFan.position.z,
    };
  }

  const off = offsetMoinho(modeloId);
  if (off.dx || off.dy || off.dz) {
    aplicarOffsetEixoFan(eixoFan, off);
  }

  molde.userData.eixoYaw = eixoYaw;
  molde.userData.eixoFan = eixoFan;
  molde.userData.modeloMoinho = modeloId;
  return { eixoYaw, eixoFan };
}

/**
 * @param {THREE.Object3D} molde
 * @param {string} [modeloId]
 * @returns {{ eixoYaw: THREE.Object3D, eixoFan: THREE.Object3D }|null}
 */
export function montarArticulacaoMoinho(molde, modeloId = "windmill-1") {
  if (!molde) return null;
  forcarEscalaUniforme(molde);
  const jaYaw = molde.getObjectByName(NOME_YAW) || molde.userData?.eixoYaw;
  const jaFan = molde.getObjectByName(NOME_FAN) || molde.userData?.eixoFan;
  if (jaYaw && jaFan && jaYaw.isObject3D && jaFan.isObject3D) {
    return { eixoYaw: jaYaw, eixoFan: jaFan };
  }

  const { heads, fans } = coletarPecas(molde);
  if (!fans.length) return null;

  const nativo = usarHierarquiaNativa(molde, modeloId, heads, fans);
  if (nativo) return nativo;

  // OBJ flat: remonta eixos; pivô = origin Blender (0,0,0) ou bbox.
  const pai = (heads[0] || fans[0]).parent;
  if (!pai) return null;
  molde.updateMatrixWorld(true);

  const hubHead = new THREE.Vector3();
  if (heads.length) {
    if (!origemDaPeca(heads, pai, hubHead)) hubHead.set(0, 0, 0);
  } else if (!origemDaPeca(fans, pai, hubHead)) {
    return null;
  }

  const eixoYaw = new THREE.Group();
  eixoYaw.name = NOME_YAW;
  eixoYaw.position.copy(hubHead);
  alinharYaoMundo(eixoYaw, pai);
  pai.add(eixoYaw);
  for (let i = 0; i < heads.length; i++) eixoYaw.attach(heads[i]);

  molde.updateMatrixWorld(true);
  const hubFan = new THREE.Vector3();
  if (!origemDaPeca(fans, eixoYaw, hubFan)) return null;

  // Eixo de spin ≈ hub − origem do yaw (axle head→fan).
  _axle.copy(hubFan);
  const lenAxle = _axle.length();
  const off = offsetMoinho(modeloId);
  const eixoFan = new THREE.Group();
  eixoFan.name = NOME_FAN;
  eixoFan.position.set(hubFan.x + off.dx, hubFan.y + off.dy, hubFan.z + off.dz);
  if (lenAxle > 1e-5) {
    _axle.multiplyScalar(1 / lenAxle);
    eixoFan.quaternion.setFromUnitVectors(_eixoZ, _axle);
  }
  eixoFan.userData.hubBase = { x: hubFan.x, y: hubFan.y, z: hubFan.z };
  eixoFan.userData.modeloId = modeloId;
  eixoYaw.add(eixoFan);
  for (let i = 0; i < fans.length; i++) eixoFan.attach(fans[i]);

  molde.userData.eixoYaw = eixoYaw;
  molde.userData.eixoFan = eixoFan;
  molde.userData.modeloMoinho = modeloId;
  return { eixoYaw, eixoFan };
}

export function anexarEixoFan(molde, modeloId = "windmill-1") {
  return montarArticulacaoMoinho(molde, modeloId)?.eixoFan || null;
}

/**
 * @param {THREE.Object3D} eixo
 * @param {{ dx:number, dy:number, dz:number }} offset
 */
export function aplicarOffsetEixoFan(eixo, offset) {
  if (!eixo) return;
  const hub = eixo.userData.hubBase || {
    x: eixo.position.x,
    y: eixo.position.y,
    z: eixo.position.z,
  };
  if (!eixo.userData.hubBase) {
    eixo.userData.hubBase = { x: hub.x, y: hub.y, z: hub.z };
  }
  const pai = eixo.parent;
  if (!pai) return;
  /** @type {THREE.Object3D[]} */
  const filhos = [...eixo.children];
  for (let i = 0; i < filhos.length; i++) pai.attach(filhos[i]);
  eixo.position.set(
    hub.x + (Number(offset?.dx) || 0),
    hub.y + (Number(offset?.dy) || 0),
    hub.z + (Number(offset?.dz) || 0)
  );
  for (let i = 0; i < filhos.length; i++) eixo.attach(filhos[i]);
}

export function eixoFanDaInstancia(inst) {
  if (!inst) return null;
  const porNome = inst.getObjectByName(NOME_FAN);
  if (porNome) return porNome;
  let fan = null;
  inst.traverse((n) => {
    if (fan || !n.isMesh) return;
    if (/fan/i.test(n.name || "")) fan = n;
  });
  return fan;
}

export function eixoYawDaInstancia(inst) {
  if (!inst) return null;
  const porNome = inst.getObjectByName(NOME_YAW);
  if (porNome) return porNome;
  let head = null;
  inst.traverse((n) => {
    if (head) return;
    if (/head/i.test(n.name || "")) head = n;
  });
  return head;
}

export function faseInicialMoinho(id) {
  let h = 2166136261;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 1000) / 1000) * Math.PI * 2;
}

function lerpAngulo(atual, alvo, t) {
  let d = ((alvo - atual + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return atual + d * Math.max(0, Math.min(1, t));
}

/**
 * @param {Iterable<{
 *   eixoFan: THREE.Object3D,
 *   eixoYaw?: THREE.Object3D|null,
 *   yawPai?: number,
 *   x: number,
 *   z: number,
 * }>} rotores
 */
export function tickMoinhos(rotores, dt, px, pz) {
  if (!(dt > 0) || !rotores) return;
  const vento = obterVentoMundo();
  const inten = Math.max(0, Math.min(1, Number(vento?.intensidade) || 0.35));
  const omega = SPIN_MIN + (SPIN_MAX - SPIN_MIN) * inten;
  const passo = omega * dt;
  const yawVento = Math.atan2(-(Number(vento?.vx) || 0), -(Number(vento?.vy) || 0));
  const kYaw = 1 - Math.exp(-YAW_VEL * dt);

  for (const r of rotores) {
    const dx = r.x - px;
    const dz = r.z - pz;
    if (dx * dx + dz * dz > RAIO_ANIM2) continue;

    const eixoYaw = r.eixoYaw;
    if (eixoYaw) {
      const alvo = yawVento - (Number(r.yawPai) || 0);
      eixoYaw.rotation.y = lerpAngulo(eixoYaw.rotation.y, alvo, kYaw);
    }

    const eixoFan = r.eixoFan || r.eixo;
    if (!eixoFan) continue;
    eixoFan.rotation.z += passo;
    if (eixoFan.rotation.z > Math.PI * 8) eixoFan.rotation.z %= Math.PI * 2;
  }
}
