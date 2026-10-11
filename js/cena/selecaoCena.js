import * as THREE from "three";
import { ALTURA_BLOCO } from "../config.js";
import { obterBloco } from "../mundo/voxel/storeMundo.js";
import { BLOCO, nomeBloco } from "../mundo/voxel/tiposBloco.js";
import { estaEmCena } from "./modoCena.js";
import {
  idCenaDoObjeto,
  listarEntradasCena,
  marcarAuxiliar,
  obterEntradaCena,
  aoRemoverObjetoCena,
} from "./registroCena.js";

const raycaster = new THREE.Raycaster();
raycaster.layers.set(0);

const caixa = new THREE.Box3();
const realce = new THREE.Box3Helper(caixa, 0xffcc66);
realce.name = "realce-cena";
realce.frustumCulled = false;
realce.visible = false;
realce.raycast = () => {};
marcarAuxiliar(realce);
realce.material.depthTest = true;
realce.material.toneMapped = false;

const matrizInst = new THREE.Matrix4();
const ponto = new THREE.Vector3();
const normal = new THREE.Vector3();
const tamanhoMarcador = new THREE.Vector3(0.45, 0.45, 0.45);
const alvos = [];

/** @type {{ id: string, instanceId: number | null, voxel: { x:number, y:number, z:number } | null } | null} */
let selecao = null;
let realceChave = "";
const ouvintes = new Set();

let cena = null;

function avisar() {
  realceChave = "";
  for (const fn of ouvintes) fn(selecao);
}

export function ligarSelecaoCena(scene) {
  if (!scene || cena === scene) return;
  cena = scene;
  scene.add(realce);
  aoRemoverObjetoCena((id) => {
    if (selecao?.id === id) selecionarCena(null);
  });
}

export function obterSelecaoCena() {
  return selecao;
}

export function aoMudarSelecaoCena(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function selecionarCena(id, extra = null) {
  if (!id) {
    if (!selecao) return;
    selecao = null;
    avisar();
    return;
  }
  const entrada = obterEntradaCena(id);
  if (!entrada) {
    if (!selecao) return;
    selecao = null;
    avisar();
    return;
  }
  const instanceId = Number.isInteger(extra?.instanceId) ? extra.instanceId : null;
  const voxel = extra?.voxel || null;
  if (
    selecao &&
    selecao.id === id &&
    selecao.instanceId === instanceId &&
    mesmoVoxel(selecao.voxel, voxel)
  ) {
    return;
  }
  selecao = { id, instanceId, voxel };
  avisar();
}

function mesmoVoxel(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function lerVoxel(hit, entrada) {
  if (!hit?.face || (entrada.pasta !== "Terreno" && entrada.pasta !== "Água")) return null;
  normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
  ponto.copy(hit.point).addScaledVector(normal, -0.04);
  let voxel = voxelDe(ponto);
  if (obterBloco(voxel.x, voxel.y, voxel.z) === BLOCO.AR) {
    ponto.copy(hit.point).addScaledVector(normal, -0.2);
    const outro = voxelDe(ponto);
    if (obterBloco(outro.x, outro.y, outro.z) !== BLOCO.AR) voxel = outro;
  }
  return voxel;
}

function voxelDe(p) {
  return {
    x: Math.floor(p.x),
    y: Math.floor(p.z),
    z: Math.floor(p.y / ALTURA_BLOCO),
  };
}

export function nomeBlocoSelecionado(voxel = selecao?.voxel) {
  if (!voxel) return null;
  return nomeBloco(obterBloco(voxel.x, voxel.y, voxel.z));
}

export function selecionarNoNdc(ndc, camera) {
  if (!camera) {
    selecionarCena(null);
    return;
  }
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = camera.far;
  alvos.length = 0;
  for (const entrada of listarEntradasCena()) {
    if (entrada.auxiliar) continue;
    if (!entrada.visivel()) continue;
    alvos.push(entrada.objeto);
  }
  const hits = raycaster.intersectObjects(alvos, true);
  const hit = hits.find((h) => h.object.layers.test(raycaster.layers) && idCenaDoObjeto(h.object));
  if (!hit) {
    selecionarCena(null);
    return;
  }
  const id = idCenaDoObjeto(hit.object);
  const entrada = obterEntradaCena(id);
  const instanceId = Number.isInteger(hit.instanceId) ? hit.instanceId : null;
  selecionarCena(id, {
    instanceId: entrada?.obterInstancia ? instanceId : null,
    voxel: lerVoxel(hit, entrada),
  });
}

export function caixaDaSelecao(destino) {
  if (!selecao) return false;
  const entrada = obterEntradaCena(selecao.id);
  if (!entrada) return false;
  preencherCaixa(entrada, selecao.instanceId, destino);
  return !destino.isEmpty();
}

function preencherCaixa(entrada, instanceId, destino) {
  const obj = entrada.objeto;
  if (instanceId != null && obj.isInstancedMesh && instanceId < (obj.count | 0)) {
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    obj.updateWorldMatrix(true, false);
    obj.getMatrixAt(instanceId, matrizInst);
    matrizInst.premultiply(obj.matrixWorld);
    destino.copy(obj.geometry.boundingBox).applyMatrix4(matrizInst);
    return;
  }
  obj.updateWorldMatrix(true, true);
  destino.setFromObject(obj);
  if (destino.isEmpty()) {
    obj.getWorldPosition(ponto);
    destino.setFromCenterAndSize(ponto, tamanhoMarcador);
  }
}

export function atualizarRealceCena() {
  if (!estaEmCena() || !selecao) {
    realce.visible = false;
    return;
  }
  const entrada = obterEntradaCena(selecao.id);
  if (!entrada) {
    realce.visible = false;
    return;
  }
  const chave = `${selecao.id}:${selecao.instanceId ?? ""}:${entrada.objeto.uuid}`;
  const parado = !entrada.segue && selecao.instanceId == null;
  if (parado && chave === realceChave && !caixa.isEmpty()) {
    realce.updateMatrixWorld(true);
    realce.visible = true;
    return;
  }
  preencherCaixa(entrada, selecao.instanceId, caixa);
  realceChave = chave;
  realce.visible = !caixa.isEmpty();
  if (realce.visible) realce.updateMatrixWorld(true);
}

const matrizPick = new THREE.Matrix4();
const pontoPick = new THREE.Vector3();

/**
 * Pick de InstancedMesh sem testar triângulo em todas as instâncias.
 * Rejeita em XZ com a posição do prop e só então lê a matriz.
 * @param {import("three").InstancedMesh} mesh
 * @param {() => { itens: object[], largura?: number, altura?: number } | null} obterLote
 */
export function usarRaycastBillboard(mesh, obterLote) {
  mesh.raycast = (rc, intersects) => {
    const lote = obterLote();
    const itens = lote?.itens;
    const n = Math.min(mesh.count | 0, itens?.length || 0);
    if (!n) return;
    const dir = rc.ray.direction;
    const ori = rc.ray.origin;
    const horiz = dir.x * dir.x + dir.z * dir.z;
    const meia = Math.max(0.3, (lote.largura || 1) * 0.55);
    const meia2 = meia * meia;
    mesh.updateWorldMatrix(true, false);
    for (let i = 0; i < n; i++) {
      const item = itens[i];
      const px = item.x;
      const pz = item.y;
      let t = 0;
      if (horiz > 1e-8) t = ((px - ori.x) * dir.x + (pz - ori.z) * dir.z) / horiz;
      if (t < 0 || t > rc.far) continue;
      const qx = ori.x + dir.x * t;
      const qz = ori.z + dir.z * t;
      const ddx = px - qx;
      const ddz = pz - qz;
      if (ddx * ddx + ddz * ddz > meia2) continue;

      mesh.getMatrixAt(i, matrizPick);
      matrizPick.premultiply(mesh.matrixWorld);
      const el = matrizPick.elements;
      const base = el[13];
      const topo = base + el[5];
      const ry = ori.y + dir.y * t;
      const y0 = Math.min(base, topo) - 0.12;
      const y1 = Math.max(base, topo) + 0.12;
      if (ry < y0 || ry > y1) continue;
      pontoPick.copy(ori).addScaledVector(dir, t);
      intersects.push({
        distance: t,
        point: pontoPick.clone(),
        object: mesh,
        instanceId: i,
      });
    }
  };
}
