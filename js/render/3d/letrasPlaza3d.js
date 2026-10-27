/**
 * Chão shrine-floor-a sob o AABB do glifo de letra.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { getWorldLetterPuzzlePlan } from "../../letras/plano.js";
import { letraResolvida } from "../../letras/estado.js";
import { retanguloGlifoLetra } from "../../letras/plaza.js";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";

const ATLAS = "assets/terrain/skins/shrine-floor-a.png";
const TILE = 16;
const ATLAS_COLS = 4;
/** Índices no atlas 4×4 (mesma ordem da extração). */
const ROLE = Object.freeze({
  CENTER: 0,
  EDGE_N: 1,
  EDGE_E: 2,
  EDGE_S: 3,
  EDGE_W: 4,
  OUT_NW: 5,
  OUT_NE: 6,
  OUT_SE: 7,
  OUT_SW: 8,
  IN_NW: 9,
  IN_NE: 10,
  IN_SE: 11,
  IN_SW: 12,
});

const CAP_QUADS = 2400;
const EPS_Y = 0.035;

function papel(n, e, s, w) {
  const c = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);
  if (c === 4) return ROLE.CENTER;
  if (c === 3) {
    if (!n) return ROLE.EDGE_N;
    if (!e) return ROLE.EDGE_E;
    if (!s) return ROLE.EDGE_S;
    return ROLE.EDGE_W;
  }
  if (c === 2) {
    if (n && e) return ROLE.OUT_NE;
    if (e && s) return ROLE.OUT_SE;
    if (s && w) return ROLE.OUT_SW;
    if (w && n) return ROLE.OUT_NW;
    return ROLE.CENTER;
  }
  if (c === 1) {
    if (n) return ROLE.EDGE_N;
    if (e) return ROLE.EDGE_E;
    if (s) return ROLE.EDGE_S;
    return ROLE.EDGE_W;
  }
  return ROLE.CENTER;
}

function uvDoPapel(role, uvs, base) {
  const col = role % ATLAS_COLS;
  const row = (role / ATLAS_COLS) | 0;
  const u0 = col / ATLAS_COLS;
  const v1 = 1 - row / ATLAS_COLS;
  const u1 = (col + 1) / ATLAS_COLS;
  const v0 = 1 - (row + 1) / ATLAS_COLS;
  // quad: 0,1,2 / 0,2,3  (TL TR BR / TL BR BL) em XZ
  uvs[base] = u0;
  uvs[base + 1] = v1;
  uvs[base + 2] = u1;
  uvs[base + 3] = v1;
  uvs[base + 4] = u1;
  uvs[base + 5] = v0;
  uvs[base + 6] = u0;
  uvs[base + 7] = v1;
  uvs[base + 8] = u1;
  uvs[base + 9] = v0;
  uvs[base + 10] = u0;
  uvs[base + 11] = v0;
}

function carregarTex() {
  const img = new Image();
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  img.onload = () => {
    tex.needsUpdate = true;
  };
  img.src = ATLAS;
  return tex;
}

/**
 * @returns {{ grupo: THREE.Group, atualizar: (mx: number, my: number) => void, liberar: () => void }}
 */
export function criarLetrasPlaza3d() {
  const grupo = new THREE.Group();
  grupo.name = "letras-plaza";

  const maxV = CAP_QUADS * 4;
  const maxI = CAP_QUADS * 6;
  const pos = new Float32Array(maxV * 3);
  const uv = new Float32Array(maxV * 2);
  const idx = new Uint32Array(maxI);
  for (let q = 0; q < CAP_QUADS; q++) {
    const v = q * 4;
    const o = q * 6;
    idx[o] = v;
    idx[o + 1] = v + 1;
    idx[o + 2] = v + 2;
    idx[o + 3] = v;
    idx[o + 4] = v + 2;
    idx[o + 5] = v + 3;
  }

  const geo = new THREE.BufferGeometry();
  const atrPos = new THREE.BufferAttribute(pos, 3);
  const atrUv = new THREE.BufferAttribute(uv, 2);
  atrPos.setUsage(THREE.DynamicDrawUsage);
  atrUv.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", atrPos);
  geo.setAttribute("uv", atrUv);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);

  const mat = new THREE.MeshBasicMaterial({
    map: carregarTex(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  grupo.add(mesh);

  /** @type {Set<string>} */
  let mask = new Set();
  let lastKey = "";

  function rebuildMask(mx, my, raio = 56) {
    const key = `${(mx / 8) | 0},${(my / 8) | 0}`;
    if (key === lastKey && mask.size) return;
    lastKey = key;
    mask = new Set();
    const slots = getWorldLetterPuzzlePlan().slots;
    const r2 = raio * raio;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s) continue;
      const dx = s.x - mx;
      const dy = s.y - my;
      if (dx * dx + dy * dy > r2) continue;
      const rect = retanguloGlifoLetra(s);
      if (!rect) continue;
      for (let ty = rect.y0; ty < rect.y1; ty++) {
        for (let tx = rect.x0; tx < rect.x1; tx++) {
          mask.add(`${tx},${ty}`);
        }
      }
    }
  }

  function tem(x, y) {
    return mask.has(`${x},${y}`);
  }

  function atualizar(mx, my) {
    rebuildMask(mx, my);
    let quads = 0;
    const slots = getWorldLetterPuzzlePlan().slots;
    const r2 = 56 * 56;
    for (let si = 0; si < slots.length; si++) {
      const s = slots[si];
      if (!s) continue;
      const dx = s.x - mx;
      const dy = s.y - my;
      if (dx * dx + dy * dy > r2) continue;
      const rect = retanguloGlifoLetra(s);
      if (!rect) continue;
      const cleared = letraResolvida(s.id);
      for (let ty = rect.y0; ty < rect.y1; ty++) {
        for (let tx = rect.x0; tx < rect.x1; tx++) {
          if (quads >= CAP_QUADS) break;
          const n = tem(tx, ty - 1);
          const e = tem(tx + 1, ty);
          const sCell = tem(tx, ty + 1);
          const w = tem(tx - 1, ty);
          const role = papel(n, e, sCell, w);
          const h = (alturaDoRelevo(tx + 0.5, ty + 0.5) || s.z || 0) * ALTURA_BLOCO + EPS_Y;
          const x0 = tx;
          const z0 = ty;
          const x1 = tx + 1;
          const z1 = ty + 1;
          const v = quads * 4;
          const p = v * 3;
          // Y-up: XZ plano
          pos[p] = x0;
          pos[p + 1] = h;
          pos[p + 2] = z0;
          pos[p + 3] = x1;
          pos[p + 4] = h;
          pos[p + 5] = z0;
          pos[p + 6] = x1;
          pos[p + 7] = h;
          pos[p + 8] = z1;
          pos[p + 9] = x0;
          pos[p + 10] = h;
          pos[p + 11] = z1;
          uvDoPapel(role, uv, v * 2);
          // Resolvido: um pouco mais opaco / verde — usa CENTER mais claro via alpha no mat
          if (cleared) {
            // mantém UV; alpha global do mat
          }
          quads++;
        }
      }
    }
    atrPos.needsUpdate = true;
    atrUv.needsUpdate = true;
    geo.setDrawRange(0, quads * 6);
    mat.opacity = 0.92;
  }

  function liberar() {
    geo.dispose();
    mat.map?.dispose();
    mat.dispose();
  }

  return { grupo, atualizar, liberar };
}
