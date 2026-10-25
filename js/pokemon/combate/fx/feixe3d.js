/**
 * Feixes 3D (port visual do BattleParticles Canvas laser).
 * Ribbon billboarded origem→ponta + bloom na ponta.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";

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
 *   t: number
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
  };
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
  // #region agent log
  {
    let vivaN = 0;
    let maxT = 0;
    for (let i = 0; i < vivos.length; i++) {
      if (!vivos[i].viva) continue;
      vivaN++;
      if (vivos[i].t > maxT) maxT = vivos[i].t;
    }
    if (vivaN > 0 && maxT > 1.5) {
      const agora = Date.now();
      if (!tickFeixes._dbgUlt || agora - tickFeixes._dbgUlt > 800) {
        tickFeixes._dbgUlt = agora;
        fetch("http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b822fd" },
          body: JSON.stringify({
            sessionId: "b822fd",
            hypothesisId: "A",
            location: "feixe3d.js:tickFeixes",
            message: "feixe vivo além do esperado",
            data: { vivaN, maxT: +maxT.toFixed(2), total: vivos.length },
            timestamp: agora,
          }),
        }).catch(() => {});
      }
    }
  }
  // #endregion
}

const _de = new THREE.Vector3(0, 1, 0);
const _para = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function orientarRibbon(mesh, x1, y1, z1, x2, y2, z2, largura) {
  const ax = x1;
  const ay = Math.max(0.1, z1 * ALTURA_BLOCO);
  const az = y1;
  const bx = x2;
  const by = Math.max(0.1, z2 * ALTURA_BLOCO);
  const bz = y2;
  _para.set(bx - ax, by - ay, bz - az);
  const len = _para.length() || 0.001;
  _para.multiplyScalar(1 / len);
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  _quat.setFromUnitVectors(_de, _para);
  mesh.quaternion.copy(_quat);
  mesh.scale.set(largura, len, 1);
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
    const tronco = gpu.tronco[slot];
    const nucleo = gpu.nucleo[slot];
    const ponta = gpu.ponta[slot];
    tronco.visible = true;
    nucleo.visible = true;
    ponta.visible = true;
    tronco.material.color.copy(hex(f.primaria));
    tronco.material.opacity = f.alpha * 0.55;
    nucleo.material.color.copy(hex(f.nucleo));
    nucleo.material.opacity = f.alpha * 0.9;
    ponta.material.color.copy(hex(f.nucleo));
    ponta.material.opacity = f.alpha;
    orientarRibbon(tronco, f.x1, f.y1, f.z1, f.x2, f.y2, f.z2, lw * (f.grossuraExtra ? 1.35 : 1.8));
    orientarRibbon(nucleo, f.x1, f.y1, f.z1, f.x2, f.y2, f.z2, Math.max(0.06, lw * 0.28));
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
