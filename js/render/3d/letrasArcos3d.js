/**
 * Arcos elétricos entre pedras vizinhas do glifo (Thunder stretch).
 * Folhas Thunder_01/02/03 (1×4, anim=variacao): cicla o tile no UV do mesh.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { arcosLetrasAtivos } from "../../letras/arcos.js";
import {
  carregarCatalogoElemental,
  layoutElemental,
  texturaElemental,
} from "../../efeitos/elemental.js";

const CAP = 64;
const TEX_IDS = Object.freeze(["Thunder_01", "Thunder_02", "Thunder_03"]);
/** Fallback se o catálogo ainda não veio (Thunder é sempre 1×4). */
const LAY_THUNDER = Object.freeze({ cols: 1, rows: 4, frames: 4 });
const AMP = 0.14;
/** Troca de variante ~12×/s — flicker elétrico. */
const FRAME_HZ = 12;

/** @type {Map<string, THREE.Texture>} */
const texBase = new Map();
/** @type {Set<string>} */
const pedindoBase = new Set();

function layoutThunder(id) {
  const lay = layoutElemental(id);
  // Catálogo vazio → 1×1; não cachear UV errado.
  if ((lay.rows | 0) <= 1 && (lay.cols | 0) <= 1 && (lay.frames | 0) <= 1) {
    return LAY_THUNDER;
  }
  return {
    cols: Math.max(1, lay.cols | 0),
    rows: Math.max(1, lay.rows | 0),
    frames: Math.max(1, lay.frames | 0),
  };
}

function garantirTexBase(id) {
  if (texBase.has(id) || pedindoBase.has(id)) return texBase.get(id) || null;
  const meta = texturaElemental(id);
  if (!meta?.path || typeof Image === "undefined") return null;
  pedindoBase.add(id);
  const img = new Image();
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    texBase.set(id, tex);
  };
  img.src = meta.path;
  return null;
}

/**
 * Isola 1 tile da folha mutando offset/repeat da textura do próprio material.
 * Evita trocar clones da mesma Source (UV às vezes não atualiza no renderer).
 * @param {THREE.MeshBasicMaterial} mat
 * @param {string} texId
 * @param {number} frame
 */
function aplicarFrameNoMaterial(mat, texId, frame) {
  const base = garantirTexBase(texId);
  if (!base) return false;
  const lay = layoutThunder(texId);
  const frames = Math.max(1, lay.frames);
  const f = ((frame % frames) + frames) % frames;
  const col = f % lay.cols;
  const row = Math.floor(f / lay.cols);
  const offX = col / lay.cols;
  const offY = (lay.rows - 1 - row) / lay.rows;
  const repX = 1 / lay.cols;
  const repY = 1 / lay.rows;

  let tex = mat.map;
  if (!tex || tex.userData?.texId !== texId) {
    tex = base.clone();
    tex.userData = { ...(tex.userData || {}), texId };
    tex.colorSpace = base.colorSpace;
    tex.magFilter = base.magFilter;
    tex.minFilter = base.minFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.matrixAutoUpdate = true;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  if (tex.repeat.x !== repX || tex.repeat.y !== repY) tex.repeat.set(repX, repY);
  if (tex.offset.x !== offX || tex.offset.y !== offY) {
    tex.offset.set(offX, offY);
    tex.updateMatrix();
  }
  return true;
}

function hash01(n) {
  const x = Math.sin(n * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function texIdDoSeed(seed) {
  return TEX_IDS[((seed >>> 0) + Math.imul(seed | 0, 7)) % TEX_IDS.length];
}

const _deX = new THREE.Vector3(1, 0, 0);
const _para = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _rollQ = new THREE.Quaternion();

function orientar(mesh, x1, y1, z1, x2, y2, z2, largura, roll) {
  const ax = x1;
  const ay = Math.max(0.08, z1 * ALTURA_BLOCO);
  const az = y1;
  const bx = x2;
  const by = Math.max(0.08, z2 * ALTURA_BLOCO);
  const bz = y2;
  _para.set(bx - ax, by - ay, bz - az);
  const len = _para.length() || 0.05;
  _para.normalize();
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  _quat.setFromUnitVectors(_deX, _para);
  if (roll) {
    _rollQ.setFromAxisAngle(_para, roll);
    _quat.premultiply(_rollQ);
  }
  mesh.quaternion.copy(_quat);
  mesh.scale.set(len, largura, 1);
}

/**
 * @returns {{ grupo: THREE.Group, atualizar: (foco: {x:number,y:number}) => void, liberar: () => void }}
 */
export function criarLetrasArcos3d() {
  void carregarCatalogoElemental();
  const grupo = new THREE.Group();
  grupo.name = "letras-arcos";

  const geo = new THREE.PlaneGeometry(1, 1);
  /** @type {THREE.Mesh[]} */
  const meshes = [];
  for (let i = 0; i < CAP; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      opacity: 0,
    });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.frustumCulled = false;
    m.renderOrder = 6;
    grupo.add(m);
    meshes.push(m);
  }

  function atualizar(foco) {
    for (let i = 0; i < TEX_IDS.length; i++) garantirTexBase(TEX_IDS[i]);
    const arcs = arcosLetrasAtivos(foco, 52);
    const agora = performance.now();
    const tWave = agora * 0.014;
    const tick = Math.floor(agora * 0.001 * FRAME_HZ);
    let used = 0;

    for (let a = 0; a < arcs.length && used < CAP; a++) {
      const arc = arcs[a];
      const dx = arc.ex - arc.sx;
      const dy = arc.ey - arc.sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const wave =
        Math.sin(tWave + arc.seed * 0.01) * AMP +
        (hash01(arc.seed + tick) - 0.5) * AMP * 0.4;
      const mx = (arc.sx + arc.ex) * 0.5 + nx * wave;
      const my = (arc.sy + arc.ey) * 0.5 + ny * wave;
      const mz = (arc.sz + arc.ez) * 0.5;

      const texId = texIdDoSeed(arc.seed);
      const lay = layoutThunder(texId);
      // Variacao: troca o tile (e a folha fica fixa por arco via seed).
      const frame = (arc.seed + tick) % lay.frames;
      const largura = 0.28 * (0.72 + 0.28 * arc.grow);
      const roll = (hash01(arc.seed + 9) - 0.5) * 0.35;
      const op = 0.55 + 0.4 * arc.grow;

      const mesh = meshes[used++];
      mesh.visible = true;
      aplicarFrameNoMaterial(/** @type {THREE.MeshBasicMaterial} */ (mesh.material), texId, frame);
      mesh.material.opacity = op;
      orientar(mesh, arc.sx, arc.sy, arc.sz, mx, my, mz, largura, roll);

      if (used < CAP) {
        const mesh2 = meshes[used++];
        mesh2.visible = true;
        // Meio-arco oposto: outro tile da mesma folha pra parecer raio vivo.
        aplicarFrameNoMaterial(
          /** @type {THREE.MeshBasicMaterial} */ (mesh2.material),
          texId,
          frame + 1 + (arc.seed & 1),
        );
        mesh2.material.opacity = op;
        orientar(mesh2, mx, my, mz, arc.ex, arc.ey, arc.ez, largura, -roll);
      }
    }

    for (let i = used; i < CAP; i++) meshes[i].visible = false;
  }

  function liberar() {
    geo.dispose();
    for (let i = 0; i < meshes.length; i++) {
      const mat = meshes[i].material;
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }
      mat.dispose();
    }
    for (const tex of texBase.values()) tex.dispose();
    texBase.clear();
    pedindoBase.clear();
  }

  return { grupo, atualizar, liberar };
}
