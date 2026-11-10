/**
 * Feixe luminoso procedural do Glitter Lighthouse (sem colisão).
 * Alcance = raio de chunks carregados (obterRaioStream × CHUNK_XZ).
 * Altura/offset: assets/models/moinho-pivo.json (aba Moinho → Farol).
 */
import * as THREE from "three";
import { CHUNK_XZ } from "../../config.js";
import { offsetMoinho } from "../../mundo/sites/moinhoPivo.js";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { oferecerLuzChao } from "./luzes/mapaChao.js";

export const ID_FAROL = "glitter-lighthouse";
const NOME_EIXO = "eixo-feixe-farol";
const SPIN = 0.55;
/** Altura local padrão se o pivô ainda for zero. */
const ALTURA_PADRAO = 155.4;
/** Cone unitário: length=1 no +Z local; escala no tick bate o alcance do stream. */
const GEO_LEN = 1;
const GEO_RAD = 0.04;
const COR_FEIXE = "#ffcc66";
/** Relevo dentro desta folga vertical do feixe conta como “atingido”. */
const FOLGA_HIT_Y = 22;
/** Largura do cone no mundo (~proporcional ao alcance, com teto). */
const LARGURA_FRAC = 0.035;
const LARGURA_MAX = 28;

const _origem = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _scale = new THREE.Vector3();

/**
 * @param {string} modeloId
 */
export function ehModeloFarol(modeloId) {
  return String(modeloId || "") === ID_FAROL;
}

/** Blocos / unidades de mundo = disco de chunks carregados. */
export function alcanceFeixeBlocos() {
  return Math.max(CHUNK_XZ, obterRaioStream() * CHUNK_XZ);
}

function criarMalhaFeixe() {
  const geo = new THREE.ConeGeometry(GEO_RAD, GEO_LEN, 16, 1, true);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, GEO_LEN * 0.5);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "feixe-luz-farol";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 3;
  mesh.raycast = () => {};
  return mesh;
}

/**
 * Escala a malha pra o comprimento no mundo = alcance do stream.
 * @param {THREE.Object3D} eixo
 */
function ajustarTamanhoFeixe(eixo) {
  const malha = eixo?.userData?.malhaFeixe;
  if (!malha) return;
  eixo.updateWorldMatrix(true, false);
  _scale.setFromMatrixScale(eixo.matrixWorld);
  const sPai = Math.max(Math.abs(_scale.x), Math.abs(_scale.z), 1e-6);
  const alcance = alcanceFeixeBlocos();
  const sLen = alcance / (GEO_LEN * sPai);
  const larguraMundo = Math.min(LARGURA_MAX, Math.max(4, alcance * LARGURA_FRAC));
  const sRad = larguraMundo / (GEO_RAD * 2 * sPai);
  malha.scale.set(sRad, sRad, sLen);
}

/**
 * @param {THREE.Object3D} inst molde/clone já escalado
 * @returns {THREE.Group|null} eixo do feixe
 */
export function montarFeixeFarol(inst) {
  if (!inst) return null;
  let eixo = null;
  inst.traverse((n) => {
    if (n.name === NOME_EIXO) eixo = n;
  });
  if (eixo) {
    ajustarTamanhoFeixe(eixo);
    return eixo;
  }

  eixo = new THREE.Group();
  eixo.name = NOME_EIXO;
  eixo.userData.feixeFarol = true;
  const malha = criarMalhaFeixe();
  eixo.add(malha);
  eixo.userData.malhaFeixe = malha;
  inst.add(eixo);
  aplicarOffsetFeixeFarol(eixo, offsetMoinho(ID_FAROL));
  ajustarTamanhoFeixe(eixo);
  return eixo;
}

/**
 * @param {THREE.Object3D} eixo
 * @param {{ dx?:number, dy?:number, dz?:number }} off
 */
export function aplicarOffsetFeixeFarol(eixo, off) {
  if (!eixo) return;
  if (!eixo.userData.hubBase) {
    eixo.userData.hubBase = { x: 0, y: ALTURA_PADRAO, z: 0 };
  }
  const hub = eixo.userData.hubBase;
  eixo.position.set(
    hub.x + (Number(off?.dx) || 0),
    hub.y + (Number(off?.dy) || 0),
    hub.z + (Number(off?.dz) || 0),
  );
}

function iluminarFeixeNoChao(eixo, noite) {
  if (noite <= 0.02) return;
  eixo.updateWorldMatrix(true, false);
  eixo.getWorldPosition(_origem);
  _dir.set(0, 0, 1).transformDirection(eixo.matrixWorld);
  _dir.y = 0;
  if (_dir.lengthSq() < 1e-6) return;
  _dir.normalize();

  const alcance = alcanceFeixeBlocos();
  const amostras = Math.max(8, Math.min(24, Math.round(alcance / 12)));
  for (let i = 1; i <= amostras; i++) {
    const d = (i / amostras) * alcance;
    const wx = _origem.x + _dir.x * d;
    const wz = _origem.z + _dir.z * d;
    const yFeixe = _origem.y;
    const yChao = alturaDoRelevo(wx, wz);
    const atingiu = Math.abs(yChao - yFeixe) <= FOLGA_HIT_Y;
    const yLuz = atingiu ? yChao + 1.2 : yFeixe;
    const queda = 1 - (i - 1) / amostras;
    const inten = noite * (atingiu ? 1.15 : 0.45) * (0.35 + queda * 0.65);
    oferecerLuzChao("farol", wx, yLuz, wz, COR_FEIXE, inten);
  }
}

/**
 * @param {Iterable<{ eixo: THREE.Object3D }>} lista
 * @param {number} dt
 * @param {number} pesoNoite
 */
export function tickFarois(lista, dt, pesoNoite) {
  const noite = Math.max(0, Math.min(1, pesoNoite));
  const op = noite <= 0.02 ? 0 : 0.04 + noite * 0.1;
  for (const item of lista) {
    const eixo = item?.eixo;
    if (!eixo) continue;
    eixo.rotation.y += SPIN * (dt > 0 ? dt : 1 / 60);
    ajustarTamanhoFeixe(eixo);
    const malha = eixo.userData.malhaFeixe;
    if (malha?.material) {
      malha.material.opacity = op;
      malha.visible = op > 0.01;
    }
    iluminarFeixeNoChao(eixo, noite);
  }
}

export function eixoFeixeDaInstancia(inst) {
  if (!inst) return null;
  let achou = null;
  inst.traverse((n) => {
    if (n.name === NOME_EIXO) achou = n;
  });
  return achou;
}
