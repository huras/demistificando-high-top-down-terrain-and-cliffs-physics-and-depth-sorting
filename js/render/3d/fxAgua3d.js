/**
 * Ondulação, pegada e gota. Um InstancedMesh por tipo.
 * Instância morta fica com escala 0.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { marcarAuxiliar } from "../../cena/registroCena.js";
import {
  amostraGota,
  amostraOnda,
  amostraPegada,
  gotasAgua,
  ondasAgua,
  pegadasAgua,
} from "../../fx/fxAgua.js";

const VERT = `
attribute float aAlpha;
varying float vAlpha;
varying vec2 vLocal;
void main() {
  vAlpha = aAlpha;
  vLocal = position.xy;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = `
uniform vec3 uCor;
uniform float uMiolo;
varying float vAlpha;
varying vec2 vLocal;
void main() {
  float r = length(vLocal);
  if (r > 1.0) discard;
  float borda = smoothstep(0.78, 0.9, r);
  float a = vAlpha * mix(uMiolo, 1.0, borda);
  a *= 1.0 - smoothstep(0.93, 1.0, r);
  if (a < 0.01) discard;
  gl_FragColor = vec4(uCor, a);
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
const _id = new THREE.Quaternion();

function semRaycast() {}

function criarMalha(cap, cor, miolo, nome, ordem) {
  const geo = new THREE.CircleGeometry(1, 16);
  const alphas = new Float32Array(cap);
  const attr = new THREE.InstancedBufferAttribute(alphas, 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aAlpha", attr);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCor: { value: new THREE.Color(cor) },
      uMiolo: { value: miolo },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = nome;
  mesh.count = cap;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = ordem;
  mesh.raycast = semRaycast;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return { mesh, alphas, attr };
}

function esconder(mesh, i) {
  _p.set(0, 0, 0);
  _s.set(0, 0, 0);
  _m.compose(_p, _id, _s);
  mesh.setMatrixAt(i, _m);
}

function deitar(ang) {
  _q.copy(_tilt);
  if (ang) {
    _yaw.setFromAxisAngle(_ey, -ang);
    _q.premultiply(_yaw);
  }
}

export function criarFxAgua3d() {
  const grupo = new THREE.Group();
  grupo.name = "fx-agua";
  const ondas = criarMalha(96, 0xf0faff, 0.22, "fx-agua-onda", 3);
  const pegadas = criarMalha(80, 0x4091d2, 0.72, "fx-agua-pegada", 2);
  const gotas = criarMalha(64, 0xdcf4ff, 1, "fx-agua-gota", 4);
  grupo.add(ondas.mesh, pegadas.mesh, gotas.mesh);
  marcarAuxiliar(grupo);

  function atualizar(camera) {
    const listaOnda = ondasAgua();
    for (let i = 0; i < listaOnda.length; i++) {
      const o = listaOnda[i];
      if (!o.viva) {
        ondas.alphas[i] = 0;
        esconder(ondas.mesh, i);
        continue;
      }
      const a = amostraOnda(o);
      ondas.alphas[i] = a.alfa;
      _p.set(o.x, o.z * ALTURA_BLOCO + 0.02, o.y);
      deitar(0);
      _s.set(a.rx, a.ry, 1);
      _m.compose(_p, _q, _s);
      ondas.mesh.setMatrixAt(i, _m);
    }
    ondas.attr.needsUpdate = true;
    ondas.mesh.instanceMatrix.needsUpdate = true;

    const listaPe = pegadasAgua();
    for (let i = 0; i < listaPe.length; i++) {
      const p = listaPe[i];
      if (!p.viva) {
        pegadas.alphas[i] = 0;
        esconder(pegadas.mesh, i);
        continue;
      }
      pegadas.alphas[i] = amostraPegada(p);
      _p.set(p.x, p.z * ALTURA_BLOCO + 0.02, p.y);
      deitar(p.ang);
      _s.set(p.sx, p.sy, 1);
      _m.compose(_p, _q, _s);
      pegadas.mesh.setMatrixAt(i, _m);
    }
    pegadas.attr.needsUpdate = true;
    pegadas.mesh.instanceMatrix.needsUpdate = true;

    const listaGota = gotasAgua();
    const olhar = camera ? camera.quaternion : _id;
    for (let i = 0; i < listaGota.length; i++) {
      const g = listaGota[i];
      if (!g.viva) {
        gotas.alphas[i] = 0;
        esconder(gotas.mesh, i);
        continue;
      }
      const a = amostraGota(g);
      gotas.alphas[i] = a.alfa;
      _p.set(g.x, g.z * ALTURA_BLOCO, g.y);
      _s.set(a.tam, a.tam, 1);
      _m.compose(_p, olhar, _s);
      gotas.mesh.setMatrixAt(i, _m);
    }
    gotas.attr.needsUpdate = true;
    gotas.mesh.instanceMatrix.needsUpdate = true;
  }

  return { grupo, atualizar };
}
