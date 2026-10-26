/**
 * Feixes 3D (port visual do BattleParticles Canvas laser + Elemental stretch).
 * Ribbon billboarded origem→ponta + bloom na ponta; modo stretch usa Ray/Thunder.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";
import {
  carregarCatalogoElemental,
  layoutElemental,
  texturaElemental,
} from "../../../efeitos/elemental.js";

export const CAP_FEIXES = 8;

/**
 * @typedef {{
 *   viva: boolean,
 *   x1: number, y1: number, z1: number,
 *   x2: number, y2: number, z2: number,
 *   largura: number,
 *   primaria: string,
 *   secundaria: string,
 *   nucleo: string,
 *   alpha: number,
 *   pulso: number,
 *   grossuraExtra: boolean,
 *   t: number,
 *   modo: string,
 *   textura: string,
 *   lengthScale: number,
 *   frame: number,
 *   roll: number
 * }} FeixeVivo
 */

/** @type {FeixeVivo[]} */
const vivos = [];

/**
 * @type {{
 *   cena: THREE.Scene,
 *   tronco: THREE.Mesh[],
 *   nucleo: THREE.Mesh[],
 *   ponta: THREE.Sprite[],
 *   geo: THREE.PlaneGeometry,
 *   dummy: THREE.Object3D
 * } | null}
 */
let gpu = null;

/** @type {Map<string, THREE.Texture>} */
const texStretch = new Map();
/** @type {Set<string>} */
const pedindoStretch = new Set();

function pedirTexStretch(id) {
  if (!id) return null;
  if (texStretch.has(id)) return texStretch.get(id);
  const meta = texturaElemental(id);
  if (!meta?.path || pedindoStretch.has(id) || typeof Image === "undefined") return null;
  pedindoStretch.add(id);
  const img = new Image();
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    texStretch.set(id, tex);
  };
  img.src = meta.path;
  return null;
}

/**
 * Clona a textura base e isola 1 tile da folha (Thunder 1×4, etc.).
 * @param {string} id
 * @param {number} frame
 */
function texStretchDoFrame(id, frame) {
  const base = pedirTexStretch(id) || texStretch.get(id);
  if (!base) return null;
  const lay = layoutElemental(id);
  const chave = `${id}#${frame}`;
  if (texStretch.has(chave)) return texStretch.get(chave);
  const tex = base.clone();
  tex.needsUpdate = true;
  const cols = lay.cols;
  const rows = lay.rows;
  const f = Math.max(0, Math.min(lay.frames - 1, frame | 0));
  const col = f % cols;
  const row = Math.floor(f / cols);
  const rowUv = rows - 1 - row;
  tex.repeat.set(1 / cols, 1 / rows);
  tex.offset.set(col / cols, rowUv / rows);
  texStretch.set(chave, tex);
  return tex;
}

function hex(c) {
  return new THREE.Color(c || "#ffffff");
}

function materialTronco(additive) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    opacity: 1,
  });
}

function criarPonta() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.55, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spr = new THREE.Sprite(mat);
  spr.renderOrder = 12;
  spr.visible = false;
  return spr;
}

/** @param {THREE.Scene} cena */
export function ligarFeixes(cena) {
  carregarCatalogoElemental();
  if (gpu?.cena === cena) return;
  desligarFeixes();
  const geo = new THREE.PlaneGeometry(1, 1);
  const tronco = [];
  const nucleo = [];
  const ponta = [];
  for (let i = 0; i < CAP_FEIXES; i++) {
    const t = new THREE.Mesh(geo, materialTronco(true));
    t.frustumCulled = false;
    t.renderOrder = 11;
    t.visible = false;
    cena.add(t);
    tronco.push(t);
    const n = new THREE.Mesh(geo, materialTronco(true));
    n.frustumCulled = false;
    n.renderOrder = 12;
    n.visible = false;
    cena.add(n);
    nucleo.push(n);
    const p = criarPonta();
    cena.add(p);
    ponta.push(p);
  }
  gpu = { cena, tronco, nucleo, ponta, geo, dummy: new THREE.Object3D() };
}

export function desligarFeixes() {
  if (!gpu) return;
  for (let i = 0; i < CAP_FEIXES; i++) {
    gpu.cena.remove(gpu.tronco[i]);
    gpu.cena.remove(gpu.nucleo[i]);
    gpu.cena.remove(gpu.ponta[i]);
    gpu.tronco[i].material.dispose();
    gpu.nucleo[i].material.dispose();
    gpu.ponta[i].material.map?.dispose();
    gpu.ponta[i].material.dispose();
  }
  gpu.geo.dispose();
  gpu = null;
}

/**
 * @param {object} opts
 * @returns {FeixeVivo}
 */
export function soltarFeixe(opts) {
  /** @type {FeixeVivo} */
  const f = {
    viva: true,
    x1: opts.x1,
    y1: opts.y1,
    z1: opts.z1 ?? 1.2,
    x2: opts.x2,
    y2: opts.y2,
    z2: opts.z2 ?? opts.z1 ?? 1.2,
    largura: opts.largura ?? 0.4,
    primaria: opts.primaria || "#ffffff",
    secundaria: opts.secundaria || "#ffffff",
    nucleo: opts.nucleo || "#ffffff",
    alpha: opts.alpha == null ? 1 : opts.alpha,
    pulso: opts.pulso || 0,
    grossuraExtra: !!opts.grossuraExtra,
    t: 0,
    modo: opts.modo || "ribbon",
    textura: opts.textura || "",
    lengthScale: opts.lengthScale > 0 ? opts.lengthScale : 3,
    frame: opts.frame != null ? opts.frame : -1,
    roll: opts.roll || 0,
  };
  if (f.textura) {
    pedirTexStretch(f.textura);
    if (f.frame < 0) {
      const lay = layoutElemental(f.textura);
      f.frame = lay.anim === "variacao" ? Math.floor(Math.random() * lay.frames) : 0;
    }
  }
  if (vivos.length >= CAP_FEIXES) {
    const velho = vivos.shift();
    if (velho) velho.viva = false;
  }
  vivos.push(f);
  return f;
}

export function limparFeixes() {
  for (let i = 0; i < vivos.length; i++) vivos[i].viva = false;
  vivos.length = 0;
}

export function feixesVivos() {
  return vivos;
}

/**
 * @param {number} px
 * @param {number} py
 * @param {FeixeVivo} f
 */
export function distanciaAoFeixe(px, py, f) {
  const dx = f.x2 - f.x1;
  const dy = f.y2 - f.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return Math.hypot(px - f.x1, py - f.y1);
  let t = ((px - f.x1) * dx + (py - f.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (f.x1 + t * dx), py - (f.y1 + t * dy));
}

/**
 * @param {{x:number,y:number}} origem
 * @param {{x:number,y:number}} mira
 * @param {number} alcanceMax
 */
export function calcularPontaFeixe(origem, mira, alcanceMax) {
  const dx = mira.x - origem.x;
  const dy = mira.y - origem.y;
  const dist = Math.hypot(dx, dy) || 1;
  const len = Math.min(Math.max(dist, 1), alcanceMax);
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x1: origem.x,
    y1: origem.y,
    x2: origem.x + nx * len,
    y2: origem.y + ny * len,
    nx,
    ny,
    comprimento: len,
  };
}

/** @param {number} dt */
export function tickFeixes(dt) {
  for (let i = vivos.length - 1; i >= 0; i--) {
    const f = vivos[i];
    if (!f.viva) {
      vivos.splice(i, 1);
      continue;
    }
    f.t += dt;
    f.pulso += dt;
  }
}

const _deY = new THREE.Vector3(0, 1, 0);
const _deX = new THREE.Vector3(1, 0, 0);
const _para = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _rollQ = new THREE.Quaternion();

/**
 * Ribbon origem→ponta.
 * Thunder (sprites horizontais): comprimento no eixo X local — U esquerda=origem, direita=impacto.
 * @param {{ alongX?: boolean, overhang?: number, roll?: number }} [opts]
 */
function orientarRibbon(mesh, x1, y1, z1, x2, y2, z2, largura, lengthMul = 1, opts = {}) {
  let ax = x1;
  let ay = Math.max(0.1, z1 * ALTURA_BLOCO);
  let az = y1;
  const bx = x2;
  const by = Math.max(0.1, z2 * ALTURA_BLOCO);
  const bz = y2;
  _para.set(bx - ax, by - ay, bz - az);
  let len = (_para.length() || 0.001) * lengthMul;
  _para.normalize();
  const over = opts.overhang > 0 ? opts.overhang * len : 0;
  if (over > 0) {
    // Thunder_01: origem além da edge esquerda — estende atrás do caster
    ax -= _para.x * over;
    ay -= _para.y * over;
    az -= _para.z * over;
    len += over;
  }
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  if (opts.alongX) {
    // U (esquerda→direita da folha) alinhado à direção do raio
    _quat.setFromUnitVectors(_deX, _para);
    if (opts.roll) {
      _rollQ.setFromAxisAngle(_para, opts.roll);
      _quat.premultiply(_rollQ);
    }
    mesh.quaternion.copy(_quat);
    mesh.scale.set(len, largura, 1);
  } else {
    _quat.setFromUnitVectors(_deY, _para);
    if (opts.roll) {
      _rollQ.setFromAxisAngle(_para, opts.roll);
      _quat.premultiply(_rollQ);
    }
    mesh.quaternion.copy(_quat);
    mesh.scale.set(largura, len, 1);
  }
}

/**
 * @param {THREE.MeshBasicMaterial} mat
 * @param {FeixeVivo} f
 * @param {boolean} nucleo
 */
function aplicarMaterialFeixe(mat, f, nucleo) {
  const stretch = f.modo === "stretch" && f.textura;
  const tex = stretch
    ? texStretchDoFrame(f.textura, f.frame >= 0 ? f.frame : 0) ||
      pedirTexStretch(f.textura) ||
      texStretch.get(f.textura)
    : null;
  if (tex && mat.map !== tex) {
    mat.map = tex;
    mat.needsUpdate = true;
  } else if (!tex && mat.map) {
    mat.map = null;
    mat.needsUpdate = true;
  }
  mat.color.copy(hex(nucleo ? f.nucleo : f.primaria));
  mat.opacity = f.alpha * (nucleo ? 0.95 : stretch ? 0.85 : 0.55);
  mat.transparent = true;
}

/**
 * @param {THREE.Camera} [_camera]
 */
export function sincronizarFeixes(_camera) {
  if (!gpu) return;
  let slot = 0;
  for (let i = 0; i < vivos.length && slot < CAP_FEIXES; i++) {
    const f = vivos[i];
    if (!f.viva || f.alpha <= 0.01) continue;
    const flicker = f.grossuraExtra ? 0 : Math.sin(f.pulso * 20) * Math.min(0.08, f.largura * 0.15);
    const lw = f.largura + flicker;
    const stretch = f.modo === "stretch";
    const lenMul = stretch ? Math.max(1, f.lengthScale || 3) / 3 : 1;
    const lay = stretch && f.textura ? layoutElemental(f.textura) : null;
    const alongX = !!(lay && lay.eixo === "horizontal");
    const overhang = lay?.overhang || 0;
    const orientOpts = { alongX, overhang, roll: f.roll || 0 };
    const tronco = gpu.tronco[slot];
    const nucleo = gpu.nucleo[slot];
    const ponta = gpu.ponta[slot];
    tronco.visible = true;
    nucleo.visible = true;
    ponta.visible = true;
    aplicarMaterialFeixe(/** @type {THREE.MeshBasicMaterial} */ (tronco.material), f, false);
    aplicarMaterialFeixe(/** @type {THREE.MeshBasicMaterial} */ (nucleo.material), f, true);
    ponta.material.color.copy(hex(f.nucleo));
    ponta.material.opacity = f.alpha;
    orientarRibbon(
      tronco,
      f.x1,
      f.y1,
      f.z1,
      f.x2,
      f.y2,
      f.z2,
      lw * (stretch ? 0.55 : f.grossuraExtra ? 1.35 : 1.8),
      lenMul,
      orientOpts,
    );
    orientarRibbon(
      nucleo,
      f.x1,
      f.y1,
      f.z1,
      f.x2,
      f.y2,
      f.z2,
      Math.max(0.06, lw * (stretch ? 0.18 : 0.28)),
      lenMul,
      orientOpts,
    );
    const rPonta = lw * (f.grossuraExtra ? 1.4 : 1.9);
    ponta.position.set(f.x2, Math.max(0.1, f.z2 * ALTURA_BLOCO), f.y2);
    ponta.scale.set(rPonta * 2.2, rPonta * 2.2, 1);
    slot += 1;
  }
  for (; slot < CAP_FEIXES; slot++) {
    gpu.tronco[slot].visible = false;
    gpu.nucleo[slot].visible = false;
    gpu.ponta[slot].visible = false;
  }
}
