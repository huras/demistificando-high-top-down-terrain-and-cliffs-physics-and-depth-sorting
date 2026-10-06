import { CHUNK_XZ, CHUNK_Y } from "../config.js";
import {
  alturaEm,
  colunaTemArInterno,
  quedaVisualFace,
  superficieBaixa,
} from "../mundo/altura.js";
import { mundoParaChunk } from "../mundo/voxel/chunk.js";
import { obterChunk, onDirty } from "../mundo/voxel/storeMundo.js";
import { ehSolido } from "../mundo/voxel/tiposBloco.js";

const VAZIO = Object.freeze({
  topos: Object.freeze([]),
  facesS: Object.freeze([]),
  facesW: Object.freeze([]),
  facesE: Object.freeze([]),
  zSurf: 0,
});

/** @type {Map<string, object>} */
const cache = new Map();
let ouvinteOk = false;

/**
 * Peças 2D visíveis na coluna (cacheadas; invalida com onDirty).
 * Coluna sólida = O(1) via heightmap. Só escaneia voxel se tem ar interno.
 */
export function coletarPecasColuna(cx, cy) {
  garantirOuvinte();
  const x = cx | 0;
  const y = cy | 0;
  const k = x + "," + y;
  const hit = cache.get(k);
  if (hit) return hit;

  const pecas = construirPecas(x, y);
  cache.set(k, pecas);
  return pecas;
}

function garantirOuvinte() {
  if (ouvinteOk) return;
  ouvinteOk = true;
  onDirty((aabb) => {
    if (!aabb || aabb.unload) {
      cache.clear();
      return;
    }
    const x0 = (aabb.x0 | 0) - 1;
    const y0 = (aabb.y0 | 0) - 1;
    const x1 = (aabb.x1 | 0) + 1;
    const y1 = (aabb.y1 | 0) + 1;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        cache.delete(cx + "," + cy);
      }
    }
  });
}

function construirPecas(cx, cy) {
  const zSurf = alturaEm(cx, cy);
  if (zSurf <= 0) return VAZIO;

  // Maioria do mapa: coluna sólida — sem scan de 64×4.
  if (!colunaTemArInterno(cx, cy)) {
    return pecasColunaSolida(cx, cy, zSurf);
  }
  return pecasColunaComAr(cx, cy, zSurf);
}

function pecasColunaSolida(cx, cy, zSurf) {
  const topos = [zSurf];
  const facesS = [];
  const facesW = [];
  const facesE = [];

  const qS = quedaVisualFace(cx, cy, 0, 1);
  if (qS > 0) facesS.push({ zBase: zSurf - qS, zTopo: zSurf });
  const qW = quedaVisualFace(cx, cy, -1, 0);
  if (qW > 0) facesW.push({ zBase: zSurf - qW, zTopo: zSurf });
  const qE = quedaVisualFace(cx, cy, 1, 0);
  if (qE > 0) facesE.push({ zBase: zSurf - qE, zTopo: zSurf });

  return { topos, facesS, facesW, facesE, zSurf };
}

/**
 * Caverna / overhang: scan direto no Uint16Array do chunk (sem obterBloco/frame).
 * Limita a z < zSurf (acima da superfície é ar).
 */
function pecasColunaComAr(cx, cy, zSurf) {
  const col = ptrColuna(cx, cy);
  if (!col) return VAZIO;

  const zLim = Math.min(CHUNK_Y, zSurf);
  /** @type {number[]} */
  const topos = [];
  for (let lz = 0; lz < zLim; lz++) {
    if (!solidoIdx(col, lz)) continue;
    const temAcima = lz + 1 < zLim && solidoIdx(col, lz + 1);
    if (!temAcima) topos.push(lz + 1);
  }
  if (!topos.length || topos[topos.length - 1] !== zSurf) {
    topos.push(zSurf);
  }
  const zBaixo = superficieBaixa(cx, cy);
  if (zBaixo > 0 && zBaixo < zSurf) {
    let tem = false;
    for (let i = 0; i < topos.length; i++) {
      if (topos[i] === zBaixo) {
        tem = true;
        break;
      }
    }
    if (!tem) {
      topos.push(zBaixo);
      topos.sort(cmpNum);
    }
  }

  const facesS = [];
  const facesW = [];
  const facesE = [];
  coletarRunsDireto(col, ptrColuna(cx, cy + 1), zLim, facesS);
  coletarRunsDireto(col, ptrColuna(cx - 1, cy), zLim, facesW);
  coletarRunsDireto(col, ptrColuna(cx + 1, cy), zLim, facesE);

  return { topos, facesS, facesW, facesE, zSurf };
}

function cmpNum(a, b) {
  return a - b;
}

function ptrColuna(wx, wy) {
  const { cx, cy } = mundoParaChunk(wx, wy);
  const chunk = obterChunk(cx, cy);
  if (!chunk) return null;
  const lx = wx - cx * CHUNK_XZ;
  const ly = wy - cy * CHUNK_XZ;
  if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) return null;
  return {
    blocos: chunk.blocos,
    base: (ly * CHUNK_XZ + lx) * CHUNK_Y,
  };
}

function solidoIdx(ptr, z) {
  return ehSolido(ptr.blocos[ptr.base + z]);
}

function coletarRunsDireto(col, viz, zLim, out) {
  let z0 = -1;
  for (let z = 0; z < zLim; z++) {
    const solido = solidoIdx(col, z);
    const vizAr = !viz || !solidoIdx(viz, z);
    if (solido && vizAr) {
      if (z0 < 0) z0 = z;
    } else if (z0 >= 0) {
      out.push({ zBase: z0, zTopo: z });
      z0 = -1;
    }
  }
  if (z0 >= 0) out.push({ zBase: z0, zTopo: zLim });
}
