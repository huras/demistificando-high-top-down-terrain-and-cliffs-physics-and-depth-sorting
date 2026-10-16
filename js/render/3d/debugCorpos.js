/**
 * Discos de colisão das entidades.
 * Malha instanciada e um anel pré-alocado. Fora do frame quando desligado.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { marcarAuxiliar } from "../../cena/registroCena.js";
import { raioDoCorpo, visitarCorposSolidos } from "../../fisica/obstaculos.js";

const CAP = 96;
const SEGMENTOS = 12;
const ALTURA = 0.08;
const FOLGA = 0.02;
const COR_DISCO = 0xf0a030;
const COR_ANEL = 0xffe7b0;

const COS = new Float32Array(SEGMENTOS);
const SIN = new Float32Array(SEGMENTOS);
for (let s = 0; s < SEGMENTOS; s++) {
  const a = (s / SEGMENTOS) * Math.PI * 2;
  COS[s] = Math.cos(a);
  SIN[s] = Math.sin(a);
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

let grupo = null;
let disco = null;
let anel = null;
let posAnel = null;
let pedido = false;
let ultimo = -1;
/** @type {((n: number) => void) | null} */
let ouvinte = null;

function semRaycast() {}

function criarDisco() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, SEGMENTOS);
  const mat = new THREE.MeshBasicMaterial({
    color: COR_DISCO,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, CAP);
  mesh.name = "debug-corpos-disco";
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 6;
  mesh.raycast = semRaycast;
  return mesh;
}

function criarAnel() {
  posAnel = new Float32Array(CAP * SEGMENTOS * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posAnel, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({
    color: COR_ANEL,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const linhas = new THREE.LineSegments(geo, mat);
  linhas.name = "debug-corpos-anel";
  linhas.frustumCulled = false;
  linhas.renderOrder = 7;
  linhas.raycast = semRaycast;
  return linhas;
}

function escreverAnel(indice, x, y, z, raio) {
  const base = indice * SEGMENTOS * 6;
  const topo = y + ALTURA * 0.5;
  for (let s = 0; s < SEGMENTOS; s++) {
    const n = (s + 1) % SEGMENTOS;
    const o = base + s * 6;
    posAnel[o] = x + COS[s] * raio;
    posAnel[o + 1] = topo;
    posAnel[o + 2] = z + SIN[s] * raio;
    posAnel[o + 3] = x + COS[n] * raio;
    posAnel[o + 4] = topo;
    posAnel[o + 5] = z + SIN[n] * raio;
  }
}

function publicarContagem(n) {
  if (n === ultimo) return;
  ultimo = n;
  ouvinte?.(n);
}

export function criarDebugCorpos() {
  grupo = new THREE.Group();
  grupo.name = "debug-corpos";
  grupo.visible = pedido;
  disco = criarDisco();
  anel = criarAnel();
  grupo.add(disco);
  grupo.add(anel);
  marcarAuxiliar(grupo);
  return grupo;
}

export function definirDebugCorpos(ativo, aoContar) {
  pedido = !!ativo;
  ouvinte = pedido ? aoContar || null : null;
  if (!pedido) {
    ultimo = -1;
    if (grupo) grupo.visible = false;
    if (disco) disco.count = 0;
    anel?.geometry.setDrawRange(0, 0);
    return;
  }
  if (grupo) grupo.visible = true;
  atualizarDebugCorpos();
}

export function atualizarDebugCorpos() {
  if (!disco || !pedido) return;
  let n = 0;
  visitarCorposSolidos((corpo) => {
    if (n >= CAP) return;
    const raio = raioDoCorpo(corpo);
    const elev = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
    const y = elev + ALTURA * 0.5 + FOLGA;
    _p.set(corpo.x, y, corpo.y);
    _s.set(raio, ALTURA, raio);
    disco.setMatrixAt(n, _m.compose(_p, _q, _s));
    escreverAnel(n, corpo.x, y, corpo.y, raio);
    n += 1;
  });
  disco.count = n;
  disco.instanceMatrix.needsUpdate = n > 0;
  disco.visible = n > 0;
  anel.geometry.setDrawRange(0, n * SEGMENTOS * 2);
  anel.geometry.attributes.position.needsUpdate = n > 0;
  anel.visible = n > 0;
  grupo.visible = true;
  publicarContagem(n);
}
