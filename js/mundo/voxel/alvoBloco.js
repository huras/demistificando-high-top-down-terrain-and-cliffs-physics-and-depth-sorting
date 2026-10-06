import { ALCANCE_EDICAO, CHUNK_Y } from "../../config.js";
import { obterBloco } from "./storeMundo.js";
import { ehSolido } from "./tiposBloco.js";

const FACES = [
  { nx: 1, ny: 0, nz: 0 },
  { nx: -1, ny: 0, nz: 0 },
  { nx: 0, ny: 1, nz: 0 },
  { nx: 0, ny: -1, nz: 0 },
  { nx: 0, ny: 0, nz: 1 },
  { nx: 0, ny: 0, nz: -1 },
];

/**
 * Raycast voxel DDA (Amanatides & Woo).
 * Origem/dir em coords mundo (x,y horizontal, z altura).
 * @returns {{x:number,y:number,z:number,nx:number,ny:number,nz:number,id:number}|null}
 */
export function raycastVoxel(ox, oy, oz, dx, dy, dz, maxDist = ALCANCE_EDICAO) {
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx >= 0 ? 1 : -1;
  const stepY = dy >= 0 ? 1 : -1;
  const stepZ = dz >= 0 ? 1 : -1;

  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);

  let tMaxX =
    dx === 0
      ? Infinity
      : dx > 0
        ? (Math.floor(ox) + 1 - ox) * tDeltaX
        : (ox - Math.floor(ox)) * tDeltaX;
  let tMaxY =
    dy === 0
      ? Infinity
      : dy > 0
        ? (Math.floor(oy) + 1 - oy) * tDeltaY
        : (oy - Math.floor(oy)) * tDeltaY;
  let tMaxZ =
    dz === 0
      ? Infinity
      : dz > 0
        ? (Math.floor(oz) + 1 - oz) * tDeltaZ
        : (oz - Math.floor(oz)) * tDeltaZ;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;

  for (let i = 0; i < 128; i++) {
    if (z >= 0 && z < CHUNK_Y) {
      const id = obterBloco(x, y, z);
      if (ehSolido(id)) {
        return { x, y, z, nx, ny, nz, id };
      }
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        if (dist > maxDist) break;
        x += stepX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else {
        dist = tMaxZ;
        if (dist > maxDist) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    } else if (tMaxY < tMaxZ) {
      dist = tMaxY;
      if (dist > maxDist) break;
      y += stepY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      dist = tMaxZ;
      if (dist > maxDist) break;
      z += stepZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }
  return null;
}

/**
 * Alvo 2D: célula sob cursor → bloco de superfície.
 * Colocar usa normal +Z.
 */
export function alvoBloco2d(cx, cy) {
  const x = cx | 0;
  const y = cy | 0;
  for (let z = CHUNK_Y - 1; z >= 0; z--) {
    const id = obterBloco(x, y, z);
    if (ehSolido(id)) {
      return { x, y, z, nx: 0, ny: 0, nz: 1, id };
    }
  }
  return null;
}

/**
 * Direção de olhar da câmera Three (forward -Z da camera).
 */
export function direcaoCamera3d(camera) {
  const e = camera.matrixWorld.elements;
  // -Z da câmera em world
  return { dx: -e[8], dy: -e[10], dz: -e[9] };
}

/**
 * Ray a partir dos olhos do jogador na direção da câmera 3D.
 * Three: (x, y_altura, z_horiz) ↔ mundo (x, y_horiz, z_altura).
 */
export function alvoBloco3d(corpo, camera3d, maxDist = ALCANCE_EDICAO) {
  const elev = (corpo.elevacao ?? corpo.z ?? 0) + 1.2;
  const cam = camera3d.cam ?? camera3d;
  cam.updateMatrixWorld?.(true);
  const m = cam.matrixWorld.elements;
  const fwx = -m[8];
  const fwAltura = -m[9];
  const fwHorizY = -m[10];
  return raycastVoxel(corpo.x, corpo.y, elev, fwx, fwHorizY, fwAltura, maxDist);
}

/** Expõe vizinho ar na face atingida (pra highlight). */
export function celulaAdjacente(alvo) {
  if (!alvo) return null;
  return {
    x: alvo.x + (alvo.nx | 0),
    y: alvo.y + (alvo.ny | 0),
    z: alvo.z + (alvo.nz | 0),
  };
}

export { FACES };
