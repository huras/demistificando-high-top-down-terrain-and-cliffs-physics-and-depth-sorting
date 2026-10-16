/**
 * Lote sólido das casas. A porta fica recortada.
 * Uma malha instanciada, montada uma vez.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { marcarAuxiliar } from "../../cena/registroCena.js";
import { carregarCascasCidade, listarSolidosCasa } from "../../mundo/cidade/cascaCasa.js";
import { escreverArestasCartao, matrizCartao } from "./matrizCartao.js";

const COR_VOLUME = 0xe24b7a;
const COR_ARESTA = 0xffd6e4;
const FOLGA_CHAO = 0.02;

const ARESTAS = Object.freeze([
  [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5, 0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5, -0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5, -0.5, -0.5, -0.5],
  [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, -0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5, -0.5, -0.5, 0.5],
  [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5],
  [0.5, -0.5, -0.5, 0.5, -0.5, 0.5],
  [0.5, 0.5, -0.5, 0.5, 0.5, 0.5],
  [-0.5, 0.5, -0.5, -0.5, 0.5, 0.5],
]);

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

let grupo = null;
let pedido = false;
let total = 0;
let montado = false;
let geracao = 0;
let carga = null;
/** @type {Array<() => void> | null} */
let fila = null;

function semRaycast() {}

function medida(caixa) {
  return {
    cx: (caixa.x0 + caixa.x1) * 0.5,
    cy: ((caixa.z0 + caixa.z1) * 0.5) * ALTURA_BLOCO + FOLGA_CHAO,
    cz: (caixa.y0 + caixa.y1) * 0.5,
    sx: Math.max(0.05, caixa.x1 - caixa.x0),
    sy: Math.max(0.05, (caixa.z1 - caixa.z0) * ALTURA_BLOCO),
    sz: Math.max(0.05, caixa.y1 - caixa.y0),
  };
}

function publicar(caixas) {
  if (!caixas.length) {
    montado = true;
    total = 0;
    grupo.visible = pedido;
    return;
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: COR_VOLUME,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, caixas.length);
  mesh.name = "debug-casas-volume";
  mesh.count = caixas.length;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 3;
  mesh.raycast = semRaycast;

  const pos = new Float32Array(caixas.length * ARESTAS.length * 6);
  let o = 0;
  for (let i = 0; i < caixas.length; i++) {
    if (caixas[i].cartao) {
      mesh.setMatrixAt(i, matrizCartao(caixas[i], _m));
      o = escreverArestasCartao(pos, o, ARESTAS, caixas[i]);
      continue;
    }
    const m = medida(caixas[i]);
    _p.set(m.cx, m.cy, m.cz);
    _s.set(m.sx, m.sy, m.sz);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    for (let e = 0; e < ARESTAS.length; e++) {
      const a = ARESTAS[e];
      pos[o++] = m.cx + a[0] * m.sx;
      pos[o++] = m.cy + a[1] * m.sy;
      pos[o++] = m.cz + a[2] * m.sz;
      pos[o++] = m.cx + a[3] * m.sx;
      pos[o++] = m.cy + a[4] * m.sy;
      pos[o++] = m.cz + a[5] * m.sz;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;

  const geoLinha = new THREE.BufferGeometry();
  geoLinha.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const linhas = new THREE.LineSegments(geoLinha, new THREE.LineBasicMaterial({
    color: COR_ARESTA,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }));
  linhas.name = "debug-casas-arestas";
  linhas.frustumCulled = false;
  linhas.renderOrder = 3;
  linhas.raycast = semRaycast;

  grupo.add(mesh);
  grupo.add(linhas);
  marcarAuxiliar(grupo);
  montado = true;
  total = caixas.length;
  grupo.visible = pedido;
}

function quandoGrupo() {
  if (grupo) return Promise.resolve();
  if (!fila) fila = [];
  return new Promise((resolve) => fila.push(resolve));
}

function garantir() {
  if (montado) return Promise.resolve(total);
  if (carga) return carga;
  const g = ++geracao;
  let atual;
  atual = carregarCascasCidade().then(() => listarSolidosCasa()).then((caixas) => {
    if (atual === carga) carga = null;
    if (g !== geracao || montado) return total;
    publicar(caixas);
    return total;
  }).catch((erro) => {
    if (atual === carga) carga = null;
    throw erro;
  });
  carga = atual;
  return atual;
}

export function criarDebugCasas() {
  grupo = new THREE.Group();
  grupo.name = "debug-casas";
  grupo.visible = false;
  const pendente = fila;
  fila = null;
  if (pendente) {
    for (let i = 0; i < pendente.length; i++) pendente[i]();
  }
  return grupo;
}

export function definirDebugCasas(ativo) {
  pedido = !!ativo;
  if (!pedido) {
    geracao += 1;
    carga = null;
    if (grupo) grupo.visible = false;
    return Promise.resolve(0);
  }
  return quandoGrupo().then(() => garantir()).then((n) => {
    if (grupo) grupo.visible = pedido;
    return pedido ? n : 0;
  });
}
