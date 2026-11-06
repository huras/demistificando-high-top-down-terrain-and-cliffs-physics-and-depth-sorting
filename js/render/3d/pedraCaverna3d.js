/**
 * Pedras e placas do chute. Poucas malhas, atualizadas no lugar.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import {
  listarInterruptoresCaverna,
  listarPedrasCaverna,
} from "../../caverna/puzzle/runtime.js";

/** @type {THREE.Group | null} */
let grupo = null;
/** @type {THREE.Mesh[]} */
const pedras = [];
/** @type {THREE.Mesh[]} */
const placas = [];
let geoPedra = null;
let geoPlaca = null;
let matPedra = null;
let matLivre = null;
let matCoberto = null;

function malha(lista, geo, mat, i) {
  while (lista.length <= i) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    grupo?.add(mesh);
    lista.push(mesh);
  }
  return lista[i];
}

export function criarPedrasCaverna3d(scene) {
  grupo = new THREE.Group();
  grupo.name = "pedras-caverna";
  geoPedra = new THREE.DodecahedronGeometry(0.46, 0);
  geoPlaca = new THREE.CylinderGeometry(0.38, 0.42, 0.08, 8);
  matPedra = new THREE.MeshLambertMaterial({ color: 0x6e675c });
  matLivre = new THREE.MeshLambertMaterial({ color: 0x3d4c38 });
  matCoberto = new THREE.MeshLambertMaterial({ color: 0xd4b483 });
  scene.add(grupo);
  return { atualizar: atualizarPedrasCaverna };
}

export function atualizarPedrasCaverna() {
  if (!grupo) return;
  const lista = listarPedrasCaverna();
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    const mesh = malha(pedras, geoPedra, matPedra, i);
    mesh.visible = true;
    mesh.position.set(p.x, ALTURA_PRACA * ALTURA_BLOCO + 0.42, p.y);
  }
  for (let i = lista.length; i < pedras.length; i++) pedras[i].visible = false;

  const sw = listarInterruptoresCaverna();
  for (let i = 0; i < sw.length; i++) {
    const s = sw[i];
    const mesh = malha(placas, geoPlaca, s.coberto ? matCoberto : matLivre, i);
    mesh.material = s.coberto ? matCoberto : matLivre;
    mesh.visible = true;
    mesh.position.set(s.x, s.z * ALTURA_BLOCO + 0.05, s.y);
  }
  for (let i = sw.length; i < placas.length; i++) placas[i].visible = false;
}
