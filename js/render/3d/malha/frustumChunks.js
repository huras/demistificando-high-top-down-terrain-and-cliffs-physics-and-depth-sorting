/**
 * Frustum cull por grupo de chunk — AABB mundo vs câmera de render.
 */
import * as THREE from "three";
import { CHUNK_XZ } from "../../../config.js";

const _frustum = new THREE.Frustum();
const _mat = new THREE.Matrix4();
const _box = new THREE.Box3();

/**
 * @param {THREE.Camera} cam
 * @param {Map<string, object>} meshesPorChunk
 * @param {{ x: number, y: number }} foco — jogador (nunca culled, margem 1 chunk)
 */
export function atualizarFrustumChunks(cam, meshesPorChunk, foco) {
  if (!cam || !meshesPorChunk) return;
  _mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_mat);

  const pcx = Math.floor((foco?.x ?? 0) / CHUNK_XZ);
  const pcy = Math.floor((foco?.y ?? 0) / CHUNK_XZ);

  for (const [key, entry] of meshesPorChunk) {
    if (!entry) continue;
    const parts = key.split(",");
    const cx = parts[0] | 0;
    const cy = parts[1] | 0;
    const sobJogador = Math.abs(cx - pcx) <= 1 && Math.abs(cy - pcy) <= 1;

    let aabb = entry.aabb;
    if (!aabb) {
      const x0 = cx * CHUNK_XZ;
      const y0 = cy * CHUNK_XZ;
      aabb = {
        x0,
        y0,
        x1: x0 + CHUNK_XZ,
        y1: y0 + CHUNK_XZ,
        z0: 0,
        z1: entry.alturaMax ?? 48,
      };
      entry.aabb = aabb;
    }

    let visivel = sobJogador;
    if (!visivel) {
      _box.min.set(aabb.x0, aabb.z0, aabb.y0);
      _box.max.set(aabb.x1, aabb.z1, aabb.y1);
      visivel = _frustum.intersectsBox(_box);
    }

    if (entry._frustumVisivel === visivel) continue;
    entry._frustumVisivel = visivel;

    if (entry.real) entry.real.visible = visivel;
    if (entry.cubos) entry.cubos.visible = visivel;
    const folhas = [
      entry.agua,
      entry.espuma,
      entry.queda,
      ...(entry.folhas || []),
    ];
    for (let i = 0; i < folhas.length; i++) {
      const m = folhas[i];
      if (!m) continue;
      m.visible = visivel;
      if (m.isMesh) m.castShadow = visivel && !!m.userData?._castShadowOrig;
    }
    if (entry.real) {
      entry.real.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData._castShadowOrig == null) {
          o.userData._castShadowOrig = !!o.castShadow;
        }
        o.castShadow = visivel && o.userData._castShadowOrig;
      });
    }
  }
}

/** Grava AABB na install do chunk. */
export function aabbDoChunk(cx, cy, alturaMax = 48) {
  const x0 = cx * CHUNK_XZ;
  const y0 = cy * CHUNK_XZ;
  return {
    x0,
    y0,
    x1: x0 + CHUNK_XZ,
    y1: y0 + CHUNK_XZ,
    z0: 0,
    z1: Math.max(4, alturaMax),
  };
}
