/**
 * Anel de impacto no chão. Um InstancedMesh; a vida escala o quad
 * para o fragmento não preencher transparente vazio.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";
import { CLIMA_CFG } from "../../../clima/config.js";
import { criarPingosChao } from "./pingoChao.js";

const VERT = /* glsl */ `
attribute float aFase;
varying float vFase;
varying vec2 vLocal;
void main() {
  vFase = aFase;
  vLocal = position.xy;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying float vFase;
varying vec2 vLocal;
uniform vec3 uCor;
uniform float uAlpha;
void main() {
  float r = length(vLocal);
  if (r > 1.0) discard;
  float u = clamp(vFase, 0.0, 1.0);
  float esp = mix(0.46, 0.2, u);
  float anel = 1.0 - smoothstep(0.0, esp, abs(r - (1.0 - esp * 0.5)));
  float mioloT = 1.0 - smoothstep(0.0, 0.15, u);
  float miolo = mioloT * (1.0 - smoothstep(0.02, 0.55, r));
  float cai = (1.0 - u) * (1.0 - u);
  float a = max(anel, miolo) * cai * uAlpha;
  if (a < 0.012) discard;
  gl_FragColor = vec4(uCor, a);
  #include <colorspace_fragment>
}
`;

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _yaw = new THREE.Quaternion();
const _ex = new THREE.Vector3(1, 0, 0);
const _ey = new THREE.Vector3(0, 1, 0);
const _tilt = new THREE.Quaternion().setFromAxisAngle(_ex, -Math.PI / 2);

function semRaycast() {}

function deitar(ang) {
  _q.copy(_tilt);
  if (ang) {
    _yaw.setFromAxisAngle(_ey, -ang);
    _q.premultiply(_yaw);
  }
}

export function criarPingoChao3d() {
  const cfg = CLIMA_CFG;
  const sim = criarPingosChao();
  const cap = sim.listar().length;
  const geo = new THREE.CircleGeometry(1, 12);
  const fases = new Float32Array(cap);
  const attr = new THREE.InstancedBufferAttribute(fases, 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aFase", attr);

  const mat = new THREE.ShaderMaterial({
    name: "ceu-pingo-chao",
    uniforms: {
      uCor: { value: new THREE.Color(0xd7e7f6).convertSRGBToLinear() },
      uAlpha: { value: cfg.pingoAlpha ?? 0.72 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false,
    fog: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = "ceu-pingo-chao";
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  mesh.raycast = semRaycast;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.visible = false;

  function atualizar(chuva, vento, dt, alvo, interior) {
    const n = sim.atualizar(dt, chuva, vento, alvo, interior);
    mesh.visible = n > 0;
    mesh.count = n;
    if (n === 0) return;

    const lista = sim.listar();
    for (let i = 0; i < n; i++) {
      const p = lista[i];
      const u = p.dur > 0 ? p.idade / p.dur : 1;
      fases[i] = u;
      const cresce = u * (2.0 - u);
      const s = p.raio * cresce;
      _p.set(p.x, p.z * ALTURA_BLOCO + 0.06, p.y);
      deitar(p.ang);
      _s.set(s, s * p.alonga, 1);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    attr.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, atualizar };
}
