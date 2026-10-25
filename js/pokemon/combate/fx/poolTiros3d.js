/**
 * Pool GPU de projéteis: InstancedMesh por folha + orbes procedurais.
 * Mata o fallback de “bola Sprite” para efeitos catalogados.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";
import { efeitoDe, idEfeito } from "../../../efeitos/catalogo.js";
import {
  anguloDoMovimento,
  carregarFolhasGolpe,
  folhaGolpe,
  poseImpacto,
  poseTiro,
  texturaFolha,
} from "../folhasGolpe.js";
import { impactosVivos, projeteisVivos } from "../projeteis.js";

export const CAP_TIROS = 64;

const VERT = /* glsl */ `
attribute float aFrame;
attribute float aAlpha;
attribute vec3 aColor;
varying vec2 vUv;
varying vec3 vColor;
varying float vFrame;
varying float vAlpha;

void main() {
  vUv = uv;
  vColor = aColor;
  vFrame = aFrame;
  vAlpha = aAlpha;
  #ifdef USE_INSTANCING
  vec3 mundo = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(vec3(instanceMatrix[0][0], instanceMatrix[1][0], instanceMatrix[2][0]));
  float sy = length(vec3(instanceMatrix[0][1], instanceMatrix[1][1], instanceMatrix[2][1]));
  float ang = atan(instanceMatrix[0][1], instanceMatrix[0][0]);
  #else
  vec3 mundo = vec3(0.0);
  float sx = 1.0;
  float sy = 1.0;
  float ang = 0.0;
  #endif
  float c = cos(ang);
  float s = sin(ang);
  vec2 local = vec2(position.x * sx, position.y * sy);
  vec2 rot = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec3 direita = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cima = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 pos = mundo + direita * rot.x + cima * rot.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

const FRAG_FOLHA = /* glsl */ `
uniform sampler2D map;
uniform float uFrames;
varying vec2 vUv;
varying vec3 vColor;
varying float vFrame;
varying float vAlpha;

void main() {
  float frames = max(1.0, uFrames);
  float f = clamp(floor(vFrame + 1e-4), 0.0, frames - 1.0);
  vec2 uv = vec2(vUv.x, 1.0 - (f + (1.0 - vUv.y)) / frames);
  vec4 tex = texture2D(map, uv);
  if (tex.a * vAlpha < 0.04) discard;
  gl_FragColor = vec4(tex.rgb * vColor, tex.a * vAlpha);
}
`;

const FRAG_ORBE = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 d = vUv - vec2(0.5);
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.15, r) * vAlpha;
  if (a < 0.04) discard;
  float nucleo = smoothstep(0.55, 0.0, r);
  vec3 col = mix(vColor, vec3(1.0), nucleo * 0.65);
  gl_FragColor = vec4(col, a);
}
`;

const FRAG_ESTRELA = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float ang = atan(p.y, p.x);
  float r = length(p);
  float spike = abs(cos(ang * 2.5)) * 0.55 + 0.2;
  float a = smoothstep(spike, spike * 0.35, r) * vAlpha;
  if (a < 0.05) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.45), a);
}
`;

/**
 * @typedef {{
 *   mesh: THREE.InstancedMesh,
 *   mat: THREE.ShaderMaterial,
 *   frame: Float32Array,
 *   alpha: Float32Array,
 *   cor: Float32Array,
 *   frames: number,
 *   chave: string
 * }} PaginaFolha
 */

/** @type {{
 *   cena: THREE.Scene,
 *   folhas: Map<string, PaginaFolha>,
 *   orbe: PaginaFolha,
 *   estrela: PaginaFolha,
 *   dummy: THREE.Object3D,
 *   _q: THREE.Quaternion,
 *   _eixo: THREE.Vector3
 * } | null} */
let gpu = null;

function hexRgb(hex) {
  const h = String(hex || "#ffffff").replace("#", "");
  const n = parseInt(h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function criarPagina(frag, frames, map) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const frame = new Float32Array(CAP_TIROS);
  const alpha = new Float32Array(CAP_TIROS);
  const cor = new Float32Array(CAP_TIROS * 3);
  geo.setAttribute("aFrame", new THREE.InstancedBufferAttribute(frame, 1));
  geo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(alpha, 1));
  geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(cor, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map || null },
      uFrames: { value: frames || 1 },
    },
    vertexShader: VERT,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  if (map) mat.uniforms.map.value = map;
  const mesh = new THREE.InstancedMesh(geo, mat, CAP_TIROS);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return { mesh, mat, frame, alpha, cor, frames: frames || 1, chave: "" };
}

function garantirPaginaFolha(chave) {
  if (!gpu) return null;
  const id = idEfeito(chave) || chave;
  let pag = gpu.folhas.get(id);
  if (pag) {
    const tex = texturaFolha(id);
    if (tex && pag.mat.uniforms.map.value !== tex) {
      pag.mat.uniforms.map.value = tex;
      pag.mat.needsUpdate = true;
    }
    return pag;
  }
  const cfg = folhaGolpe(id);
  const tex = texturaFolha(id);
  if (!cfg || !tex) return null;
  pag = criarPagina(FRAG_FOLHA, cfg.frames || 1, tex);
  pag.chave = id;
  pag.frames = cfg.frames || 1;
  pag.mat.uniforms.uFrames.value = pag.frames;
  gpu.cena.add(pag.mesh);
  gpu.folhas.set(id, pag);
  return pag;
}

function liberar() {
  if (!gpu) return;
  for (const pag of gpu.folhas.values()) {
    gpu.cena.remove(pag.mesh);
    pag.mesh.geometry.dispose();
    pag.mat.dispose();
  }
  for (const pag of [gpu.orbe, gpu.estrela]) {
    if (!pag) continue;
    gpu.cena.remove(pag.mesh);
    pag.mesh.geometry.dispose();
    pag.mat.dispose();
  }
  gpu = null;
}

/** @param {THREE.Scene} cena */
export function ligarPoolTiros(cena) {
  carregarFolhasGolpe();
  if (gpu?.cena === cena) return;
  liberar();
  const orbe = criarPagina(FRAG_ORBE, 1, null);
  orbe.chave = "orbe";
  orbe.mat.blending = THREE.AdditiveBlending;
  cena.add(orbe.mesh);
  const estrela = criarPagina(FRAG_ESTRELA, 1, null);
  estrela.chave = "estrela";
  estrela.mat.blending = THREE.AdditiveBlending;
  cena.add(estrela.mesh);
  gpu = {
    cena,
    folhas: new Map(),
    orbe,
    estrela,
    dummy: new THREE.Object3D(),
    _q: new THREE.Quaternion(),
    _eixo: new THREE.Vector3(0, 0, 1),
  };
}

export function desligarPoolTiros() {
  liberar();
}

/**
 * @param {object} p
 * @param {THREE.Camera} camera
 */
function poseDe(p, camera) {
  if (p.impacto) return poseImpacto(p, camera);
  return poseTiro(p, camera);
}

/**
 * @param {PaginaFolha} pag
 * @param {number} i
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} escala
 * @param {number} angulo
 * @param {number} frame
 * @param {number} alpha
 * @param {{r:number,g:number,b:number}} rgb
 */
function escreverInstancia(pag, i, x, y, z, escala, angulo, frame, alpha, rgb) {
  const { dummy } = gpu;
  const s = Math.max(0.05, escala || 0.3);
  const c = Math.cos(angulo || 0);
  const sn = Math.sin(angulo || 0);
  dummy.matrix.identity();
  const m = dummy.matrix.elements;
  // Colunas 0/1: rotação 2D * escala (shader billboard reconstrói com view right/up)
  m[0] = c * s;
  m[1] = sn * s;
  m[2] = 0;
  m[4] = -sn * s;
  m[5] = c * s;
  m[6] = 0;
  m[8] = 0;
  m[9] = 0;
  m[10] = 1;
  m[12] = x;
  m[13] = Math.max(0.08, z * ALTURA_BLOCO);
  m[14] = y;
  pag.mesh.setMatrixAt(i, dummy.matrix);
  pag.frame[i] = frame || 0;
  pag.alpha[i] = alpha == null ? 1 : alpha;
  const o = i * 3;
  pag.cor[o] = rgb.r;
  pag.cor[o + 1] = rgb.g;
  pag.cor[o + 2] = rgb.b;
}

/**
 * @param {THREE.Camera} camera
 */
export function sincronizarPoolTiros(camera) {
  if (!gpu) return;
  /** @type {Map<string, number>} */
  const contagem = new Map();
  const bump = (k) => contagem.set(k, (contagem.get(k) || 0) + 1);

  const lista = [];
  const vivos = projeteisVivos();
  for (let i = 0; i < vivos.length; i++) if (vivos[i].viva) lista.push(vivos[i]);
  const imps = impactosVivos();
  for (let i = 0; i < imps.length; i++) lista.push(imps[i]);

  /** @type {Map<string, object[]>} */
  const porPagina = new Map();
  const pegar = (k) => {
    let a = porPagina.get(k);
    if (!a) {
      a = [];
      porPagina.set(k, a);
    }
    return a;
  };

  for (let i = 0; i < lista.length && i < CAP_TIROS; i++) {
    const p = lista[i];
    const pose = poseDe(p, camera);
    if (pose) {
      const id = pose.chave;
      if (garantirPaginaFolha(id)) {
        pegar(`folha:${id}`).push({ p, pose, tipo: "folha" });
        bump(`folha:${id}`);
        continue;
      }
    }
    const ef = efeitoDe(p.folha) || efeitoDe(idEfeito(p.folha));
    const visual = ef?.visual || (ef?.orbe?.estrela ? "estrela" : ef?.orbe ? "orbe" : "");
    if (visual === "estrela" || p.folha === "swift") {
      pegar("estrela").push({ p, pose: null, tipo: "estrela", ef });
      continue;
    }
    if (visual || ef?.orbe || p.folha) {
      pegar("orbe").push({ p, pose: null, tipo: "orbe", ef });
      continue;
    }
    // Sem catálogo: orbe tintado (debug) — ainda melhor que Sprite solto
    pegar("orbe").push({ p, pose: null, tipo: "orbe", ef: null });
  }

  for (const pag of gpu.folhas.values()) pag.mesh.count = 0;
  gpu.orbe.mesh.count = 0;
  gpu.estrela.mesh.count = 0;

  for (const [chave, itens] of porPagina) {
    let pag = null;
    if (chave === "orbe") pag = gpu.orbe;
    else if (chave === "estrela") pag = gpu.estrela;
    else if (chave.startsWith("folha:")) pag = gpu.folhas.get(chave.slice(6));
    if (!pag) continue;
    const n = Math.min(itens.length, CAP_TIROS);
    for (let i = 0; i < n; i++) {
      const { p, pose, tipo, ef } = itens[i];
      if (tipo === "folha" && pose) {
        escreverInstancia(
          pag,
          i,
          p.x,
          p.y,
          p.z,
          pose.escala || 0.4,
          pose.angulo || 0,
          pose.frame || 0,
          pose.alpha == null ? 1 : pose.alpha,
          { r: 1, g: 1, b: 1 },
        );
      } else {
        const orbe = ef?.orbe || {};
        const escala = p.escala || orbe.escala || 0.28;
        const rgb = hexRgb(orbe.cor || p.cor || "#ffffff");
        const ang = anguloDoMovimento(camera, p.vx, p.vy, "direita", 0) || p.ang || 0;
        const sy = tipo === "estrela" ? escala : p.giro ? escala * 0.42 : escala;
        escreverInstancia(pag, i, p.x, p.y, p.z, sy, tipo === "estrela" ? ang : 0, 0, 1, rgb);
      }
    }
    pag.mesh.count = n;
    pag.mesh.instanceMatrix.needsUpdate = true;
    pag.mesh.geometry.attributes.aFrame.needsUpdate = true;
    pag.mesh.geometry.attributes.aAlpha.needsUpdate = true;
    pag.mesh.geometry.attributes.aColor.needsUpdate = true;
  }
}
