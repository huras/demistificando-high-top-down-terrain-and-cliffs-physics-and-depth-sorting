/**
 * Enche só o buraco já cavado até a superfície do corpo (1 abaixo
 * do chão). Depois, onde há queda real para líquido mais baixo,
 * deixa ar sob um lip — a face de cachoeira (fluxo + malha) cobre.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { paraLocalKanto } from "../bounds.js";
import { indiceLocal, superficieLocal } from "../voxel/chunk.js";
import { amostraBaseKanto } from "../regiao/amostraKanto.js";
import { BLOCO, ehLiquido } from "../voxel/tiposBloco.js";
import { amostraCorpo } from "./corpos.js";
import { fluidoDe } from "./fluidos.js";

const HIT = {
  tem: 0,
  fluido: 0,
  cava: 0,
  sobe: 0,
  superficie: 0,
  altura: 0,
};

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function carimbarCorpos(chunk) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  let tocou = false;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const base = amostraBaseKanto(wx, wy);
      if (!base || base.reservado) continue;
      const local = paraLocalKanto(wx, wy);
      amostraCorpo(local.x, local.y, base.h, HIT);
      if (!HIT.tem) continue;
      const fam = fluidoDe(HIT.fluido);
      if (!fam) {
        chunk.corpo[ly * CHUNK_XZ + lx] = 1;
        chunk.fluido[ly * CHUNK_XZ + lx] = 0;
        tocou = true;
        continue;
      }
      const cava = Math.max(1, Math.min(2, HIT.cava | 0));
      const hSolido = superficieLocal(chunk, lx, ly);
      const superficie = Math.max(
        1,
        Math.min(CHUNK_Y, (HIT.superficie | 0) || Math.max(1, (base.h | 0) - 1)),
      );
      const a0 = hSolido;
      const a1 = Math.min(CHUNK_Y, Math.min(superficie, a0 + cava));
      if (a1 > a0) {
        for (let z = a0; z < a1; z++) {
          chunk.blocos[indiceLocal(lx, ly, z)] = fam.bloco;
        }
      }
      chunk.corpo[ly * CHUNK_XZ + lx] = 1;
      chunk.fluido[ly * CHUNK_XZ + lx] = HIT.fluido | 0;
      tocou = true;
    }
  }
  if (tocou) abrirQuedas(chunk, baseX, baseY);
  if (!tocou) return;
  chunk.fluxoPronto = false;
  chunk.sujo = true;
}

function topoLiquido(chunk, lx, ly) {
  for (let z = CHUNK_Y - 1; z >= 0; z--) {
    if (ehLiquido(chunk.blocos[indiceLocal(lx, ly, z)])) return z + 1;
  }
  return 0;
}

/** Nível do vizinho só se for coluna com líquido (queda real). 0 = seco. */
function nivelLiquidoVizinho(chunk, lx, ly, dx, dy, baseX, baseY) {
  const nx = lx + dx;
  const ny = ly + dy;
  if (nx >= 0 && ny >= 0 && nx < CHUNK_XZ && ny < CHUNK_XZ) {
    return topoLiquido(chunk, nx, ny);
  }
  const wx = baseX + nx;
  const wy = baseY + ny;
  const b = amostraBaseKanto(wx, wy);
  if (!b || b.reservado) return 0;
  const local = paraLocalKanto(wx, wy);
  amostraCorpo(local.x, local.y, b.h, HIT);
  if (!HIT.tem || !HIT.fluido) return 0;
  return (HIT.superficie | 0) || 0;
}

/**
 * Degrau >= 2 para líquido mais baixo (qualquer família): lip no topo,
 * ar até o nível de baixo. Ignora desnível só para terra seca.
 */
function abrirQuedas(chunk, baseX, baseY) {
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const famId = chunk.fluido[ly * CHUNK_XZ + lx] | 0;
      if (!famId) continue;
      const fam = fluidoDe(famId);
      if (!fam || !fam.queda) continue;
      const topo = topoLiquido(chunk, lx, ly);
      if (topo <= 0) continue;
      let melhor = 0;
      let alvo = topo;
      for (let d = 0; d < DIRS.length; d++) {
        const n = nivelLiquidoVizinho(chunk, lx, ly, DIRS[d][0], DIRS[d][1], baseX, baseY);
        if (n <= 0) continue;
        const drop = topo - n;
        if (drop > melhor) {
          melhor = drop;
          alvo = n;
        }
      }
      if (melhor < 2) continue;
      const lip = topo - 1;
      const ate = Math.max(0, alvo);
      for (let z = ate; z < lip; z++) {
        chunk.blocos[indiceLocal(lx, ly, z)] = BLOCO.AR;
      }
      if (lip >= 0 && lip < CHUNK_Y) {
        chunk.blocos[indiceLocal(lx, ly, lip)] = fam.bloco;
      }
    }
  }
}
