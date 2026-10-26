/**
 * Cascas de interior: uma BoxGeometry em pé com shear pro norte (−Z).
 * Órbita: yz = tan(inclinacao) ≈ −1 (topo 45° norte). Mira: yz = 0 (reta).
 *
 * Three.js makeShear(xy, xz, yx, yz, zx, zy):
 *   yz → z' += yz * y  (topo anda no Z — o que queremos)
 *   zy → y' += zy * z  (altura muda com Z — “pra cima”, errado)
 */
import * as THREE from "three";

/** @type {THREE.Mesh[]} */
const faixas = [];
const _shear = new THREE.Matrix4();
let yzAtual = NaN;

/**
 * @param {{
 *   x: number, y: number, z: number,
 *   w: number, d: number, h: number,
 *   materiais: THREE.Material | THREE.Material[],
 * }} opts
 */
export function criarFaixaParede(opts) {
  const { x, y, z, w, d, h: hCheia, materiais } = opts;
  // Metade da altura antes do shear — com o lean 45° o topo visual cobre o mesmo vão.
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
  aplicarShear(mesh, Number.isFinite(yzAtual) ? yzAtual : 0);

  faixas.push(mesh);
  return mesh;
}

function aplicarShear(mesh, yz) {
  // 4º arg = yz: desloca Z conforme Y (topo → norte quando yz < 0)
  _shear.makeShear(0, 0, 0, yz, 0, 0);
  mesh.matrix.compose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.matrix.multiply(_shear);
  mesh.matrixWorldNeedsUpdate = true;
}

/** Shear contínuo: tan(inclinacao). Órbita −π/4 → norte; mira 0 → reta. */
export function atualizarParedesDual(inclinacao = 0) {
  const yz = Math.tan(inclinacao || 0);
  if (yz === yzAtual) return;
  yzAtual = yz;
  for (let i = 0; i < faixas.length; i++) aplicarShear(faixas[i], yz);
}
