import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import {
  alturaDoRelevo,
  nivelMarBlocos,
  plantaDoRelevo,
  superficieDoRelevo,
} from "../bioma/catalogo.js";
import { definirPropsChunk } from "../bioma/propsBioma.js";
import { COLUNAS, LINHAS } from "../regioes/mapaDemoPatch.js";
import { preencherColunaSolida, recalcularSuperficies } from "./chunk.js";
import { valueNoise3 } from "./ruido.js";
import { BLOCO, ehSolido } from "./tiposBloco.js";

/** Desligado para isolar o relevo do bioma (coluna sólida, sem bloco solto). */
const GERAR_CAVERNAS = false;

/**
 * Terreno procedural: colunas do bioma. Caverna só se GERAR_CAVERNAS.
 */
export function gerarChunkProcedural(chunk, seed) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const nivel = nivelMarBlocos();

  /** @type {Int16Array} */
  const alturas = new Int16Array(CHUNK_XZ * CHUNK_XZ);

  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const h = alturaDoRelevo(wx, wy);
      alturas[ly * CHUNK_XZ + lx] = h;
      preencherColunaSolida(chunk, lx, ly, h, superficieDoRelevo(wx, wy));
      if (h < nivel) {
        const topo = Math.min(CHUNK_Y, nivel);
        for (let lz = h; lz < topo; lz++) {
          chunk.blocos[((ly * CHUNK_XZ + lx) * CHUNK_Y + lz) | 0] = BLOCO.AGUA;
        }
      }
    }
  }

  // Cavernas: túneis horizontais com altura ≥ 3 e piso sólido
  if (GERAR_CAVERNAS) for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const h = alturas[ly * CHUNK_XZ + lx];
      if (h < 8) continue;
      const wx = baseX + lx;
      const wy = baseY + ly;

      for (let lz = 2; lz < h - 3; lz++) {
        const c = valueNoise3(wx * 0.07, wy * 0.07, lz * 0.11, seed + 77);
        if (c <= 0.68) continue;

        // Escava 3 blocos de altura (pés + cabeça + folga)
        for (let dz = 0; dz < 3; dz++) {
          const z = lz + dz;
          if (z >= h - 1) break;
          chunk.blocos[((ly * CHUNK_XZ + lx) * CHUNK_Y + z) | 0] = BLOCO.AR;
        }
        // Garante piso sob a caverna
        const zPiso = lz - 1;
        if (zPiso >= 0) {
          const i = ((ly * CHUNK_XZ + lx) * CHUNK_Y + zPiso) | 0;
          if (!ehSolido(chunk.blocos[i])) chunk.blocos[i] = BLOCO.PEDRA;
        }
      }
    }
  }

  // Bocas: se a coluna é bem mais alta que o vizinho e tem caverna baixa, abre face
  if (GERAR_CAVERNAS) for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const h = alturas[ly * CHUNK_XZ + lx];
      if (h < 8) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = lx + dx;
        const ny = ly + dy;
        let hViz = 0;
        if (nx >= 0 && ny >= 0 && nx < CHUNK_XZ && ny < CHUNK_XZ) {
          hViz = alturas[ny * CHUNK_XZ + nx];
        } else {
          // Fora do chunk: estima com o mesmo ruído
          hViz = alturaDoRelevo(baseX + nx, baseY + ny);
        }
        if (h - hViz < 3) continue;

        // Abre corredor na altura do topo do vizinho (entrada no cliff)
        const zEnt = Math.max(1, hViz);
        for (let z = zEnt; z < zEnt + 3 && z < h - 1; z++) {
          chunk.blocos[((ly * CHUNK_XZ + lx) * CHUNK_Y + z) | 0] = BLOCO.AR;
        }
        if (zEnt - 1 >= 0) {
          const i = ((ly * CHUNK_XZ + lx) * CHUNK_Y + (zEnt - 1)) | 0;
          if (!ehSolido(chunk.blocos[i])) chunk.blocos[i] = BLOCO.PEDRA;
        }
      }
    }
  }

  // Piso z=0 sempre sólido
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const i = ((ly * CHUNK_XZ + lx) * CHUNK_Y) | 0;
      if (!ehSolido(chunk.blocos[i])) chunk.blocos[i] = BLOCO.PEDRA;
    }
  }

  const props = [];
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      if (wx >= 0 && wy >= 0 && wx < COLUNAS && wy < LINHAS) continue;
      const h = alturas[ly * CHUNK_XZ + lx];
      let cliff = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = lx + dx;
        const ny = ly + dy;
        if (nx < 0 || ny < 0 || nx >= CHUNK_XZ || ny >= CHUNK_XZ) continue;
        if (h - alturas[ny * CHUNK_XZ + nx] >= 2) cliff = true;
      }
      if (cliff) continue;
      const planta = plantaDoRelevo(wx, wy);
      if (!planta) continue;
      props.push({
        id: `v${wx}_${wy}`,
        x: wx + 0.5,
        y: wy + 0.5,
        z: h,
        tipo: planta.classe,
        sprite: planta.sprite,
      });
    }
  }
  definirPropsChunk(chunk.cx, chunk.cy, props);

  recalcularSuperficies(chunk);
  chunk.gerado = true;
  chunk.sujo = true;
}
