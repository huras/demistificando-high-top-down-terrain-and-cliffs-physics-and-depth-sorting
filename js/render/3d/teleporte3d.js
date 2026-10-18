/**
 * Triângulos da viagem, um InstancedMesh só.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { pecasAgora, pecasContagem } from "../../jogo/teleporte.js";

const CAP = 96;
const _m = new THREE.Object3D();
const _giro = new THREE.Quaternion();
const _base = new THREE.Quaternion();
const _eixo = new THREE.Vector3(0, 0, 1);
const alfas = new Float32Array(CAP);

let malha = null;
let atributoAlfa = null;

export function criarTeleporte3d(scene) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0.22, 0, -0.16, -0.14, 0, 0.16, -0.14, 0], 3),
  );
  atributoAlfa = new THREE.InstancedBufferAttribute(alfas, 1);
  geo.setAttribute("alfaPeca", atributoAlfa);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf4f7ff,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vAlfa;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAlfa = alfaPeca;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vAlfa;")
      .replace(
        "#include <opaque_fragment>",
        "#include <opaque_fragment>\ngl_FragColor.a *= vAlfa;",
      );
  };
  mat.customProgramCacheKey = () => "teleporte-alfa";
  malha = new THREE.InstancedMesh(geo, mat, CAP);
  malha.name = "teleporte";
  malha.frustumCulled = false;
  malha.renderOrder = 6;
  malha.count = 0;
  scene.add(malha);
}

export function atualizarTeleporte3d(camera) {
  if (!malha) return;
  const n = pecasContagem();
  const lista = pecasAgora();
  if (n <= 0) {
    malha.count = 0;
    malha.visible = false;
    return;
  }
  malha.visible = true;
  if (camera) _base.copy(camera.quaternion);
  else _base.identity();
  const total = Math.min(n, CAP);
  for (let i = 0; i < total; i++) {
    const p = lista[i];
    _m.position.set(p.x, p.z * ALTURA_BLOCO, p.y);
    _giro.setFromAxisAngle(_eixo, p.giro);
    _m.quaternion.copy(_base).multiply(_giro);
    _m.scale.setScalar(p.tam);
    _m.updateMatrix();
    malha.setMatrixAt(i, _m.matrix);
    alfas[i] = p.alfa;
  }
  malha.count = total;
  malha.instanceMatrix.needsUpdate = true;
  atributoAlfa.needsUpdate = true;
}
