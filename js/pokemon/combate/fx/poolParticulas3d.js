/**
 * Pool fixo de partículas de combate (CPU) + mesh Points (GPU) por cena.
 * Sem alocação no caminho quente depois do warm-up.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";

export const CAP_FX = 512;
export const CAP_ARCOS = 48;

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
    drag: 0.92,
    grav: 0,
  };
}

/** @type {{ mesh: THREE.Points, pos: Float32Array, col: Float32Array, cena: THREE.Scene } | null} */
let gpu = null;

/** @type {THREE.Sprite[]} */
const arcos = [];
let arcosLigados = false;

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

/** @param {THREE.Scene} cena */
export function ligarPoolGpu(cena) {
  if (gpu?.cena === cena && gpu.mesh?.parent === cena) {
    for (let i = 0; i < arcos.length; i++) {
      if (arcos[i].parent !== cena) cena.add(arcos[i]);
    }
    return;
  }
  if (gpu?.mesh) {
    gpu.cena?.remove(gpu.mesh);
    gpu.mesh.geometry.dispose();
    /** @type {THREE.Material} */ (gpu.mesh.material).dispose();
    gpu = null;
  }
  const pos = new Float32Array(CAP_FX * 3);
  const col = new Float32Array(CAP_FX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    map: texturaSuave(),
    size: 0.32,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    opacity: 1,
  });
  const mesh = new THREE.Points(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  cena.add(mesh);
  gpu = { mesh, pos, col, cena };

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
  if (!gpu) return;
  gpu.cena.remove(gpu.mesh);
  gpu.mesh.geometry.dispose();
  /** @type {THREE.Material} */ (gpu.mesh.material).dispose();
  gpu = null;
}

/**
 * Copia o pool CPU → buffer GPU. Chamar depois do tick de sim.
 * @param {number} [distMax] cull por distância ao foco (overworld); 0 = sem cull
 * @param {{x:number,y:number}|null} [foco]
 */
export function sincronizarPoolGpu(distMax = 0, foco = null) {
  if (!gpu) return;
  const { pos, col, mesh } = gpu;
  let n = 0;
  let tamMedio = 0;
  const d2max = distMax > 0 ? distMax * distMax : 0;
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
    const o = n * 3;
    pos[o] = p.x;
    pos[o + 1] = Math.max(0.06, p.z * ALTURA_BLOCO);
    pos[o + 2] = p.y;
    const fade = poeira ? t * 0.85 : t;
    col[o] = p.r * fade;
    col[o + 1] = p.g * fade;
    col[o + 2] = p.b * fade;
    tamMedio += p.tam * (0.6 + t);
    n += 1;
  }
  mesh.geometry.setDrawRange(0, n);
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.attributes.color.needsUpdate = true;
  /** @type {THREE.PointsMaterial} */ (mesh.material).size = n
    ? Math.max(0.18, Math.min(0.55, tamMedio / n))
    : 0.32;
}

/** Sprites de arco/estrela pré-alocados (Growl, Swift). */
export function spritesArco() {
  return arcos;
}

export function esconderArcos() {
  for (let i = 0; i < arcos.length; i++) {
    arcos[i].visible = false;
    arcos[i].material.opacity = 0;
  }
}
