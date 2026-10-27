/**
 * Arcos elétricos entre pedras vizinhas do glifo (Thunder stretch).
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
const TEX_ID = "Thunder_01";
const AMP = 0.14;

/** @type {Map<string, THREE.Texture>} */
const texCache = new Map();
/** @type {THREE.Texture | null} */
let texBase = null;
/** @type {boolean} */
let pedindoBase = false;

function garantirTexBase() {
  if (texBase || pedindoBase) return texBase;
  const meta = texturaElemental(TEX_ID);
  if (!meta?.path || typeof Image === "undefined") return null;
  pedindoBase = true;
  const img = new Image();
  img.onload = () => {
    texBase = new THREE.Texture(img);
    texBase.colorSpace = THREE.SRGBColorSpace;
    texBase.magFilter = THREE.LinearFilter;
    texBase.minFilter = THREE.LinearFilter;
    texBase.wrapS = THREE.ClampToEdgeWrapping;
    texBase.wrapT = THREE.ClampToEdgeWrapping;
    texBase.needsUpdate = true;
  };
  img.src = meta.path;
  return null;
}

function texDoFrame(frame) {
  garantirTexBase();
  if (!texBase) return null;
  const chave = `${TEX_ID}#${frame}`;
  if (texCache.has(chave)) return texCache.get(chave);
  const lay = layoutElemental(TEX_ID);
  const f = Math.max(0, Math.min(lay.frames - 1, frame | 0));
  const col = f % lay.cols;
  const row = Math.floor(f / lay.cols);
  const tex = texBase.clone();
  tex.needsUpdate = true;
  tex.repeat.set(1 / lay.cols, 1 / lay.rows);
  tex.offset.set(col / lay.cols, (lay.rows - 1 - row) / lay.rows);
  texCache.set(chave, tex);
  return tex;
}

function hash01(n) {
  const x = Math.sin(n * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
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
    garantirTexBase();
    const arcs = arcosLetrasAtivos(foco, 52);
    const t = performance.now() * 0.014;
    let used = 0;

    for (let a = 0; a < arcs.length && used < CAP; a++) {
      const arc = arcs[a];
      const dx = arc.ex - arc.sx;
      const dy = arc.ey - arc.sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const envelope = 1;
      const wave =
        Math.sin(t + arc.seed * 0.01) * AMP * envelope +
        (hash01(arc.seed + (t | 0)) - 0.5) * AMP * 0.4;
      const mx = (arc.sx + arc.ex) * 0.5 + nx * wave;
      const my = (arc.sy + arc.ey) * 0.5 + ny * wave;
      const mz = (arc.sz + arc.ez) * 0.5;

      const mesh = meshes[used++];
      mesh.visible = true;
      const frame = (arc.seed + (t | 0)) % 4;
      const tex = texDoFrame(frame);
      if (tex && mesh.material.map !== tex) {
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
      }
      mesh.material.opacity = 0.55 + 0.4 * arc.grow;
      const largura = 0.28 * (0.72 + 0.28 * arc.grow);
      const roll = (hash01(arc.seed + 9) - 0.5) * 0.35;
      // Dois meios-arcos passando pelo ponto médio jitterado
      orientar(mesh, arc.sx, arc.sy, arc.sz, mx, my, mz, largura, roll);

      if (used < CAP) {
        const mesh2 = meshes[used++];
        mesh2.visible = true;
        if (tex && mesh2.material.map !== tex) {
          mesh2.material.map = tex;
          mesh2.material.needsUpdate = true;
        }
        mesh2.material.opacity = 0.55 + 0.4 * arc.grow;
        orientar(mesh2, mx, my, mz, arc.ex, arc.ey, arc.ez, largura, -roll);
      }
    }

    for (let i = used; i < CAP; i++) meshes[i].visible = false;
  }

  function liberar() {
    geo.dispose();
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].material.map = null;
      meshes[i].material.dispose();
    }
  }

  return { grupo, atualizar, liberar };
}
