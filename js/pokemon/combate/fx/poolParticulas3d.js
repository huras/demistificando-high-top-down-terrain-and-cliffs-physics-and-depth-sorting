/**
 * Pool fixo de partículas de combate (CPU) + GPU:
 * - Points (círculo suave) no geral
 * - InstancedMesh (atlas flamethrower) só no fogo
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";
import { carregarFolhasGolpe, FOLHAS, texturaFolha } from "../folhasGolpe.js";

export const CAP_FX = 512;
export const CAP_ARCOS = 48;

function framesChama() {
  return FOLHAS.flamethrower?.frames || FOLHAS["flamethrower"]?.frames || 4;
}
const TAM_CHAMA = 0.55;

const pool = new Array(CAP_FX);
let cursor = 0;

for (let i = 0; i < CAP_FX; i++) {
  pool[i] = {
    viva: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    idade: 0,
    vida: 0.4,
    r: 1,
    g: 1,
    b: 1,
    tam: 0.18,
    modo: "faisca", // faisca | poeira | estrela | po
    folha: "", // "" | "chama"
    drag: 0.92,
    grav: 0,
  };
}

/**
 * @type {{
 *   pontos: THREE.Points,
 *   pos: Float32Array,
 *   colP: Float32Array,
 *   chamas: THREE.InstancedMesh,
 *   colC: Float32Array,
 *   frame: Float32Array,
 *   matChama: THREE.ShaderMaterial,
 *   dummy: THREE.Object3D,
 *   cena: THREE.Scene
 * } | null}
 */
let gpu = null;

/** @type {THREE.Sprite[]} */
const arcos = [];
let arcosLigados = false;

/** @type {THREE.Texture | null} */
let texChamaLocal = null;
let pedidoChama = false;

const VERT_CHAMA = /* glsl */ `
attribute float aFrame;
attribute vec3 aColor;
varying vec2 vUv;
varying vec3 vColor;
varying float vFrame;

void main() {
  vUv = uv;
  vColor = aColor;
  vFrame = aFrame;
  #ifdef USE_INSTANCING
  vec3 mundo = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(vec3(instanceMatrix[0][0], instanceMatrix[1][0], instanceMatrix[2][0]));
  float sy = length(vec3(instanceMatrix[0][1], instanceMatrix[1][1], instanceMatrix[2][1]));
  #else
  vec3 mundo = vec3(0.0);
  float sx = 1.0;
  float sy = 1.0;
  #endif
  vec3 direita = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cima = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 pos = mundo + direita * (position.x * sx) + cima * (position.y * sy);
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG_CHAMA = /* glsl */ `
uniform sampler2D map;
uniform float uFrames;
varying vec2 vUv;
varying vec3 vColor;
varying float vFrame;

void main() {
  float frames = max(1.0, uFrames);
  float f = clamp(floor(vFrame + 1e-4), 0.0, frames - 1.0);
  vec2 uv = vec2(vUv.x, 1.0 - (f + (1.0 - vUv.y)) / frames);
  vec4 tex = texture2D(map, uv);
  if (tex.a < 0.05) discard;
  gl_FragColor = vec4(tex.rgb * vColor, tex.a);
}
`;

/** @param {string|{id?:string}|null|undefined} elOuId */
export function folhaParticula(elOuId) {
  const id = typeof elOuId === "string" ? elOuId : elOuId?.id;
  return id === "fire" ? "chama" : "";
}

function hexParaRgb(hex) {
  const h = String(hex || "#ffffff").replace("#", "");
  const n = parseInt(h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function texturaSuave() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function soltarPretoCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] < 12 && px[i + 1] < 12 && px[i + 2] < 12) px[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function garantirTexturaChama() {
  const compartilhada = texturaFolha("flamethrower");
  if (compartilhada) return compartilhada;
  if (texChamaLocal) return texChamaLocal;
  if (pedidoChama || typeof Image === "undefined") return null;
  pedidoChama = true;
  const img = new Image();
  img.onload = () => {
    texChamaLocal = soltarPretoCanvas(img);
    atualizarMapaChama();
  };
  img.src = FOLHAS.flamethrower?.url || "assets/effects/golpes/flamethrower.png";
  return null;
}

function criarMaterialChama() {
  const mapa = garantirTexturaChama() || texturaSuave();
  const pronta = !!(texturaFolha("flamethrower") || texChamaLocal);
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: mapa },
      uFrames: { value: pronta ? framesChama() : 1 },
    },
    vertexShader: VERT_CHAMA,
    fragmentShader: FRAG_CHAMA,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function atualizarMapaChama() {
  if (!gpu?.matChama) return;
  const tex = texturaFolha("flamethrower") || texChamaLocal || garantirTexturaChama();
  if (!tex) return;
  if (gpu.matChama.uniforms.map.value !== tex) {
    gpu.matChama.uniforms.map.value = tex;
    gpu.matChama.uniforms.uFrames.value = framesChama();
    gpu.matChama.needsUpdate = true;
  } else if (gpu.matChama.uniforms.uFrames.value !== framesChama()) {
    gpu.matChama.uniforms.uFrames.value = framesChama();
  }
}

function ocupar() {
  for (let n = 0; n < CAP_FX; n++) {
    const i = (cursor + n) % CAP_FX;
    if (!pool[i].viva) {
      cursor = (i + 1) % CAP_FX;
      return pool[i];
    }
  }
  const p = pool[cursor];
  cursor = (cursor + 1) % CAP_FX;
  return p;
}

/**
 * @param {object} o
 * @param {number} o.x
 * @param {number} o.y
 * @param {number} o.z
 * @param {number} [o.vx]
 * @param {number} [o.vy]
 * @param {number} [o.vz]
 * @param {string} [o.cor]
 * @param {number} [o.vida]
 * @param {number} [o.tam]
 * @param {string} [o.modo]
 * @param {string} [o.folha] "" | "chama"
 * @param {number} [o.grav]
 * @param {number} [o.drag]
 */
export function emitir(o) {
  const p = ocupar();
  const rgb = hexParaRgb(o.cor);
  p.viva = true;
  p.x = o.x;
  p.y = o.y;
  p.z = o.z;
  p.vx = o.vx || 0;
  p.vy = o.vy || 0;
  p.vz = o.vz || 0;
  p.idade = 0;
  p.vida = o.vida > 0 ? o.vida : 0.35;
  p.r = rgb.r;
  p.g = rgb.g;
  p.b = rgb.b;
  p.tam = o.tam > 0 ? o.tam : 0.16;
  p.modo = o.modo || "faisca";
  p.folha = o.folha === "chama" ? "chama" : "";
  p.grav = o.grav || 0;
  p.drag = o.drag > 0 ? o.drag : 0.92;
  return p;
}

export function limparPoolFx() {
  for (let i = 0; i < CAP_FX; i++) pool[i].viva = false;
  cursor = 0;
}

export function tickPoolFx(dt) {
  const passo = Math.min(0.05, dt);
  for (let i = 0; i < CAP_FX; i++) {
    const p = pool[i];
    if (!p.viva) continue;
    p.idade += passo;
    if (p.idade >= p.vida) {
      p.viva = false;
      continue;
    }
    p.x += p.vx * passo;
    p.y += p.vy * passo;
    p.z += p.vz * passo;
    p.vz -= p.grav * passo;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.vz *= p.drag;
  }
}

export function poolFx() {
  return pool;
}

export function contarPoolFx() {
  let n = 0;
  for (let i = 0; i < CAP_FX; i++) if (pool[i].viva) n++;
  return n;
}

function liberarGpu() {
  if (!gpu) return;
  gpu.cena.remove(gpu.pontos);
  gpu.cena.remove(gpu.chamas);
  gpu.pontos.geometry.dispose();
  /** @type {THREE.Material} */ (gpu.pontos.material).dispose();
  gpu.chamas.geometry.dispose();
  gpu.matChama.dispose();
  gpu = null;
}

/** @param {THREE.Scene} cena */
export function ligarPoolGpu(cena) {
  carregarFolhasGolpe();
  garantirTexturaChama();
  if (gpu?.cena === cena && gpu.pontos?.parent === cena) {
    atualizarMapaChama();
    for (let i = 0; i < arcos.length; i++) {
      if (arcos[i].parent !== cena) cena.add(arcos[i]);
    }
    return;
  }
  liberarGpu();

  const pos = new Float32Array(CAP_FX * 3);
  const colP = new Float32Array(CAP_FX * 3);
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geoP.setAttribute("color", new THREE.BufferAttribute(colP, 3));
  const matP = new THREE.PointsMaterial({
    map: texturaSuave(),
    size: 0.32,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    opacity: 1,
  });
  const pontos = new THREE.Points(geoP, matP);
  pontos.frustumCulled = false;
  pontos.renderOrder = 8;
  cena.add(pontos);

  const geoC = new THREE.PlaneGeometry(1, 1);
  const colC = new Float32Array(CAP_FX * 3);
  const frame = new Float32Array(CAP_FX);
  geoC.setAttribute("aColor", new THREE.InstancedBufferAttribute(colC, 3));
  geoC.setAttribute("aFrame", new THREE.InstancedBufferAttribute(frame, 1));
  const matChama = criarMaterialChama();
  const chamas = new THREE.InstancedMesh(geoC, matChama, CAP_FX);
  chamas.count = 0;
  chamas.frustumCulled = false;
  chamas.renderOrder = 8;
  chamas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cena.add(chamas);

  gpu = {
    pontos,
    pos,
    colP,
    chamas,
    colC,
    frame,
    matChama,
    dummy: new THREE.Object3D(),
    cena,
  };

  if (!arcosLigados) {
    const mapa = texturaSuave();
    for (let i = 0; i < CAP_ARCOS; i++) {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: mapa,
          color: 0xffffff,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0,
        }),
      );
      spr.visible = false;
      spr.renderOrder = 9;
      arcos.push(spr);
    }
    arcosLigados = true;
  }
  for (let i = 0; i < arcos.length; i++) {
    if (arcos[i].parent && arcos[i].parent !== cena) arcos[i].parent.remove(arcos[i]);
    if (arcos[i].parent !== cena) cena.add(arcos[i]);
  }
}

export function desligarPoolGpu() {
  liberarGpu();
}

/**
 * @param {number} [distMax]
 * @param {{x:number,y:number}|null} [foco]
 */
export function sincronizarPoolGpu(distMax = 0, foco = null) {
  if (!gpu) return;
  atualizarMapaChama();
  const { pontos, pos, colP, chamas, colC, frame, dummy, matChama } = gpu;
  const frames = matChama.uniforms.uFrames.value || 1;
  const d2max = distMax > 0 ? distMax * distMax : 0;
  let nP = 0;
  let nC = 0;
  let tamMedio = 0;

  for (let i = 0; i < CAP_FX; i++) {
    const p = pool[i];
    if (!p.viva) continue;
    if (d2max && foco) {
      const dx = p.x - foco.x;
      const dy = p.y - foco.y;
      if (dx * dx + dy * dy > d2max) continue;
    }
    const t = 1 - p.idade / p.vida;
    const poeira = p.modo === "poeira" || p.modo === "po";
    const fade = poeira ? t * 0.85 : t;
    const y = Math.max(0.06, p.z * ALTURA_BLOCO);

    if (p.folha === "chama") {
      const lado = Math.max(0.35, (p.tam + TAM_CHAMA * 0.45) * (0.9 + t * 0.65));
      dummy.position.set(p.x, y, p.y);
      dummy.quaternion.identity();
      dummy.scale.set(lado, lado, 1);
      dummy.updateMatrix();
      chamas.setMatrixAt(nC, dummy.matrix);
      const o = nC * 3;
      colC[o] = p.r * fade;
      colC[o + 1] = p.g * fade;
      colC[o + 2] = p.b * fade;
      const u = p.idade / Math.max(1e-4, p.vida);
      const ciclo = poeira ? 0.55 + u * 0.45 : u;
      frame[nC] = Math.min(frames - 1, Math.floor(ciclo * frames));
      nC += 1;
      continue;
    }

    const o = nP * 3;
    pos[o] = p.x;
    pos[o + 1] = y;
    pos[o + 2] = p.y;
    colP[o] = p.r * fade;
    colP[o + 1] = p.g * fade;
    colP[o + 2] = p.b * fade;
    tamMedio += p.tam * (0.6 + t);
    nP += 1;
  }

  pontos.geometry.setDrawRange(0, nP);
  pontos.geometry.attributes.position.needsUpdate = true;
  pontos.geometry.attributes.color.needsUpdate = true;
  /** @type {THREE.PointsMaterial} */ (pontos.material).size = nP
    ? Math.max(0.18, Math.min(0.55, tamMedio / nP))
    : 0.32;

  chamas.count = nC;
  chamas.instanceMatrix.needsUpdate = true;
  /** @type {THREE.InstancedBufferAttribute} */ (chamas.geometry.getAttribute("aColor")).needsUpdate =
    true;
  /** @type {THREE.InstancedBufferAttribute} */ (chamas.geometry.getAttribute("aFrame")).needsUpdate =
    true;
}

export function spritesArco() {
  return arcos;
}

export function esconderArcos() {
  for (let i = 0; i < arcos.length; i++) {
    arcos[i].visible = false;
    arcos[i].material.opacity = 0;
  }
}
