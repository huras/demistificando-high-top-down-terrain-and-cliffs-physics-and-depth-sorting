/**
 * Vãos das portas, estáticos.
 * Um preenchimento instanciado e um único traço de arestas.
 * Some do frame quando o checkbox está desligado.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { marcarAuxiliar } from "../../cena/registroCena.js";
import { ALTURA_PAREDE_LAB, ORIGEM_LAB_X, ORIGEM_LAB_Y, ROWS_LAB, plantaLaboratorio } from "../../mundo/cidade/laboratorio.js";
import { medidasSala } from "../../mundo/cidade/sala3d.js";
import { carregarCascasCidade, listarVaosPorta } from "../../mundo/cidade/cascaCasa.js";
import { escreverArestasCartao, matrizCartao } from "./matrizCartao.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";

const COR_VOLUME = 0x3ec6ff;
const COR_ARESTA = 0xe7f8ff;
const FOLGA_CHAO = 0.03;

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

function semRaycast() {}

function criarPreenchimento(caixas) {
  const n = caixas.length;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: COR_VOLUME,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = "debug-vaos-porta-volume";
  mesh.count = n;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 4;
  mesh.raycast = semRaycast;
  for (let i = 0; i < n; i++) {
    if (caixas[i].cartao) {
      mesh.setMatrixAt(i, matrizCartao(caixas[i], _m));
      continue;
    }
    const m = medida(caixas[i]);
    _p.set(m.cx, m.cy, m.cz);
    _s.set(m.sx, m.sy, m.sz);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function criarArestas(caixas) {
  const n = caixas.length;
  const pos = new Float32Array(n * ARESTAS.length * 6);
  let o = 0;
  for (let i = 0; i < n; i++) {
    if (caixas[i].cartao) {
      o = escreverArestasCartao(pos, o, ARESTAS, caixas[i]);
      continue;
    }
    const m = medida(caixas[i]);
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
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: COR_ARESTA,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const linhas = new THREE.LineSegments(geo, mat);
  linhas.name = "debug-vaos-porta-arestas";
  linhas.frustumCulled = false;
  linhas.renderOrder = 5;
  linhas.raycast = semRaycast;
  return linhas;
}

function vaoSala() {
  const sala = medidasSala();
  return {
    x0: sala.portaX0,
    x1: sala.portaX1,
    y0: sala.portaY,
    y1: sala.portaY + 1,
    z0: ALTURA_PRACA,
    z1: ALTURA_PRACA + sala.alturaParede,
  };
}

function vaoLaboratorio() {
  const lab = plantaLaboratorio();
  return {
    x0: ORIGEM_LAB_X + lab.doorX0,
    x1: ORIGEM_LAB_X + lab.doorX1,
    y0: ORIGEM_LAB_Y + ROWS_LAB - 1,
    y1: ORIGEM_LAB_Y + ROWS_LAB,
    z0: ALTURA_PRACA,
    z1: ALTURA_PRACA + ALTURA_PAREDE_LAB,
  };
}

async function coletar() {
  await carregarCascasCidade();
  const lista = listarVaosPorta();
  lista.push(vaoSala(), vaoLaboratorio());
  return lista;
}

function publicar(caixas) {
  const preenchimento = caixas.length ? criarPreenchimento(caixas) : null;
  const arestas = caixas.length ? criarArestas(caixas) : null;
  if (preenchimento) grupo.add(preenchimento);
  if (arestas) grupo.add(arestas);
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
  atual = coletar().then((caixas) => {
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

export function criarDebugVaosPorta() {
  grupo = new THREE.Group();
  grupo.name = "debug-vaos-porta";
  grupo.visible = false;
  const pendente = fila;
  fila = null;
  if (pendente) {
    for (let i = 0; i < pendente.length; i++) pendente[i]();
  }
  return grupo;
}

export function definirDebugVaosPorta(ativo) {
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
