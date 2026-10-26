/**
 * Cascas de interior: uma BoxGeometry em pé com shear pro norte (−Z).
 * Órbita: só a parede norte (skew); sul/leste/oeste ocultas.
 * Mira: todas retas e visíveis.
 *
 * Three.js makeShear(xy, xz, yx, yz, zx, zy):
 *   yz → z' += yz * y  (topo anda no Z)
 */
import * as THREE from "three";

/** @type {THREE.Mesh[]} */
const faixas = [];
const _shear = new THREE.Matrix4();
const LIMIAR_ORBITA = 0.15;
let yzAtual = NaN;
/** @type {boolean | null} */
let orbitaAtual = null;

/**
 * @param {{
 *   x: number, y: number, z: number,
 *   w: number, d: number, h: number,
 *   materiais: THREE.Material | THREE.Material[],
 *   face?: "norte" | "sul" | "leste" | "oeste",
 * }} opts
 */
export function criarFaixaParede(opts) {
  const { x, y, z, w, d, h: hCheia, materiais, face = "norte" } = opts;
  const h = hCheia * 0.5;
  const yPe = y - hCheia * 0.5;

  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h * 0.5, 0);

  const mesh = new THREE.Mesh(geo, materiais);
  mesh.name = "parede-skew";
  mesh.position.set(x, yPe, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  // Só a parede norte da sala/corredor fica no top-down.
  mesh.userData.ocultarNaOrbita = face !== "norte";
  aplicarShear(mesh, Number.isFinite(yzAtual) ? yzAtual : 0);
  mesh.visible = !(mesh.userData.ocultarNaOrbita && orbitaAtual === true);

  faixas.push(mesh);
  return mesh;
}

function aplicarShear(mesh, yz) {
  _shear.makeShear(0, 0, 0, yz, 0, 0);
  mesh.matrix.compose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.matrix.multiply(_shear);
  mesh.matrixWorldNeedsUpdate = true;
}

/** Shear contínuo; na órbita só a parede norte fica visível. */
export function atualizarParedesDual(inclinacao = 0) {
  const ang = inclinacao || 0;
  const yz = Math.tan(ang);
  const orbita = Math.abs(ang) > LIMIAR_ORBITA;
  if (yz === yzAtual && orbita === orbitaAtual) return;
  yzAtual = yz;
  orbitaAtual = orbita;
  for (let i = 0; i < faixas.length; i++) {
    const mesh = faixas[i];
    aplicarShear(mesh, yz);
    mesh.visible = !(mesh.userData.ocultarNaOrbita && orbita);
  }
}
