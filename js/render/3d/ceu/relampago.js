import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";
import { alturaEm } from "../../../mundo/altura.js";
import { ALTURA_NUVEM } from "./parametros.js";

const MAX_PONTOS = 96;
const MAX_VERTS = MAX_PONTOS * 6;
const FOLGA_NUVEM = 18;

const VERT = /* glsl */ `
attribute vec3 aDir;
attribute float aLado;
attribute float aAoLongo;
attribute float aFadeTopo;
attribute float aMeia;
varying float vLado;
varying float vAoLongo;
varying float vFadeTopo;

void main() {
  vec3 vista = cameraPosition - position;
  float vlen = length(vista);
  vista = vlen > 0.001 ? vista / vlen : vec3(0.0, 0.0, 1.0);
  vec3 lado = cross(aDir, vista);
  float llen = length(lado);
  lado = llen > 0.0001 ? lado / llen : vec3(1.0, 0.0, 0.0);
  vec3 mundo = position + lado * aLado * aMeia;
  gl_Position = projectionMatrix * viewMatrix * vec4(mundo, 1.0);
  vLado = aLado;
  vAoLongo = aAoLongo;
  vFadeTopo = aFadeTopo;
}
`;

const FRAG = /* glsl */ `
varying float vLado;
varying float vAoLongo;
varying float vFadeTopo;
uniform float uFlash;

void main() {
  float eixo = vLado;
  float halo = exp(-eixo * eixo * 2.8);
  float nucleo = exp(-eixo * eixo * 22.0);
  float borda = 1.0 - smoothstep(0.78, 1.0, abs(eixo));
  float nasce = vFadeTopo > 0.5
    ? smoothstep(0.0, 0.25, vAoLongo)
    : smoothstep(0.0, 0.12, vAoLongo) * smoothstep(1.0, 0.82, vAoLongo);
  float alpha = (halo * 0.35 + nucleo) * borda * nasce * uFlash;
  vec3 cor = mix(vec3(0.55, 0.72, 1.0), vec3(1.0, 0.98, 0.95), nucleo);
  if (alpha < 0.015) discard;
  gl_FragColor = vec4(cor, alpha);
}
`;

function ladoDe(a, b, destino) {
  destino.set(-(b.z - a.z), 0, b.x - a.x);
  const len = Math.hypot(destino.x, destino.z);
  if (len < 1e-4) destino.set(1, 0, 0);
  else destino.multiplyScalar(1 / len);
  return destino;
}

function deslocar(pontos, amplitude, passos) {
  let atual = pontos;
  let amp = amplitude;
  const lado = new THREE.Vector3();
  for (let s = 0; s < passos; s++) {
    const prox = [atual[0]];
    for (let i = 0; i < atual.length - 1; i++) {
      const a = atual[i];
      const b = atual[i + 1];
      const m = new THREE.Vector3().lerpVectors(a, b, 0.5);
      ladoDe(a, b, lado);
      m.addScaledVector(lado, (Math.random() - 0.5) * 2 * amp);
      m.y += (Math.random() - 0.5) * amp * 0.2;
      prox.push(m, b);
    }
    atual = prox;
    amp *= 0.55;
  }
  return atual;
}

function escreverFita(pontos, meiaLargura, fadeTopo, buf, pi) {
  const total = pontos.length - 1;
  if (total < 1) return pi;
  const dir = new THREE.Vector3();
  let cursor = pi;
  for (let i = 0; i < total && cursor < MAX_VERTS - 6; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    dir.subVectors(b, a);
    if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
    else dir.normalize();
    const t0 = i / total;
    const t1 = (i + 1) / total;
    const verts = [
      [a, -1, t0],
      [a, 1, t0],
      [b, 1, t1],
      [a, -1, t0],
      [b, 1, t1],
      [b, -1, t1],
    ];
    for (let v = 0; v < 6; v++) {
      const p = verts[v][0];
      const o = cursor + v;
      buf.pos[o * 3] = p.x;
      buf.pos[o * 3 + 1] = p.y;
      buf.pos[o * 3 + 2] = p.z;
      buf.dir[o * 3] = dir.x;
      buf.dir[o * 3 + 1] = dir.y;
      buf.dir[o * 3 + 2] = dir.z;
      buf.lado[o] = verts[v][1];
      buf.aoLongo[o] = verts[v][2];
      buf.fade[o] = fadeTopo;
      buf.meia[o] = meiaLargura;
    }
    cursor += 6;
  }
  return cursor;
}

/**
 * Fita que olha a câmera. O halo é o falloff do fragmento, não um quad opaco.
 * O topo nasce acima da nuvem e dissolve; o pé acerta o relevo.
 */
export function criarRelampago() {
  const buf = {
    pos: new Float32Array(MAX_VERTS * 3),
    dir: new Float32Array(MAX_VERTS * 3),
    lado: new Float32Array(MAX_VERTS),
    aoLongo: new Float32Array(MAX_VERTS),
    fade: new Float32Array(MAX_VERTS),
    meia: new Float32Array(MAX_VERTS),
  };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(buf.pos, 3));
  geo.setAttribute("aDir", new THREE.BufferAttribute(buf.dir, 3));
  geo.setAttribute("aLado", new THREE.BufferAttribute(buf.lado, 1));
  geo.setAttribute("aAoLongo", new THREE.BufferAttribute(buf.aoLongo, 1));
  geo.setAttribute("aFadeTopo", new THREE.BufferAttribute(buf.fade, 1));
  geo.setAttribute("aMeia", new THREE.BufferAttribute(buf.meia, 1));
  geo.setDrawRange(0, 0);

  const uniforms = { uFlash: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    name: "ceu-relampago-fita",
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const fita = new THREE.Mesh(geo, material);
  fita.frustumCulled = false;
  fita.renderOrder = 6;
  fita.visible = false;

  const luz = new THREE.PointLight(0xd6e6ff, 0, 56, 2);
  luz.castShadow = false;

  const grupo = new THREE.Group();
  grupo.name = "ceu-relampago";
  grupo.add(fita, luz);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  let flash = 0;
  let espera = 2.5 + Math.random() * 2;
  let eco = 0;
  let evento = null;

  function publicar(cursor) {
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aDir.needsUpdate = true;
    geo.attributes.aLado.needsUpdate = true;
    geo.attributes.aAoLongo.needsUpdate = true;
    geo.attributes.aFadeTopo.needsUpdate = true;
    geo.attributes.aMeia.needsUpdate = true;
    geo.setDrawRange(0, cursor);
  }

  function disparar(alvo, secundario) {
    const alcance = 8 + Math.random() * 16;
    const ang = Math.random() * Math.PI * 2;
    const x = alvo.x + Math.cos(ang) * alcance;
    const z = alvo.z + Math.sin(ang) * alcance;
    const topo = ALTURA_NUVEM + FOLGA_NUVEM;
    const chao = alturaEm(Math.floor(x), Math.floor(z)) * ALTURA_BLOCO + 0.08;
    a.set(x + (Math.random() - 0.5) * 6, topo, z + (Math.random() - 0.5) * 6);
    b.set(x, chao, z);
    const tronco = deslocar([a.clone(), b.clone()], 4.5, 5);
    const meio = tronco[Math.max(1, (tronco.length * 0.42) | 0)];
    const ramoFim = meio.clone();
    ramoFim.x += (Math.random() - 0.5) * 10;
    ramoFim.y = chao + 6 + Math.random() * 8;
    ramoFim.z += (Math.random() - 0.5) * 10;
    const ramo = deslocar([meio.clone(), ramoFim], 2.2, 4);

    let cursor = 0;
    cursor = escreverFita(tronco, 0.7, 1, buf, cursor);
    cursor = escreverFita(ramo, 0.32, 0, buf, cursor);
    publicar(cursor);

    luz.position.set(b.x, chao + 6, b.z);
    fita.visible = true;
    flash = secundario ? Math.max(flash, 0.72) : 1;
    evento = secundario ? "eco" : "golpe";
    if (!secundario && Math.random() < 0.38) eco = 0.09 + Math.random() * 0.07;
  }

  function atualizar(dt, taxa, alvo) {
    evento = null;
    if (taxa > 0.04) {
      espera -= dt * (0.45 + taxa * 1.35);
      if (espera <= 0) {
        disparar(alvo, false);
        espera = 1.6 + Math.random() * 4.2;
      }
      if (eco > 0) {
        eco -= dt;
        if (eco <= 0) {
          eco = 0;
          disparar(alvo, true);
        }
      }
    }
    flash *= Math.exp(-dt * 7.2);
    const visivel = flash > 0.04;
    fita.visible = visivel;
    uniforms.uFlash.value = visivel ? Math.min(1, flash * 1.15) : 0;
    luz.intensity = visivel ? flash * 36 : 0;
    return flash;
  }

  return {
    grupo,
    atualizar,
    get flash() {
      return flash;
    },
    consumirEvento() {
      const e = evento;
      evento = null;
      return e;
    },
  };
}
