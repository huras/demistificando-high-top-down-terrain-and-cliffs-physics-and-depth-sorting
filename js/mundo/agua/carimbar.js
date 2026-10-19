/**
 * Cava o leito e enche a coluna com o fluido do corpo.
 * O mar continua água: o byte de família só muda onde um corpo pisa.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { indiceLocal } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";
import { amostraCorpo } from "./corpos.js";
import { fluidoDe } from "./fluidos.js";

const HIT = { tem: 0 };

export function carimbarCorpos(chunk) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  let tocou = false;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      amostraCorpo(baseX + lx + 0.5, baseY + ly + 0.5, HIT);
      if (!HIT.tem) continue;
      escrever(chunk, lx, ly, HIT);
      chunk.corpo[ly * CHUNK_XZ + lx] = 1;
      chunk.fluido[ly * CHUNK_XZ + lx] = HIT.fluido | 0;
      tocou = true;
    }
  }
  if (!tocou) return;
  chunk.fluxoPronto = false;
  chunk.sujo = true;
}

function escrever(chunk, lx, ly, hit) {
  const piso = Math.max(1, Math.min(CHUNK_Y - 1, hit.piso | 0));
  let a0 = Math.max(0, Math.min(CHUNK_Y, hit.a0 | 0));
  let a1 = Math.max(a0, Math.min(CHUNK_Y, hit.a1 | 0));
  const fam = fluidoDe(hit.fluido);
  const liquido = fam ? fam.bloco : 0;
  const pedra = hit.solido === BLOCO.PEDRA;
  if (!liquido) {
    a0 = piso;
    a1 = piso;
  }
  for (let z = 0; z < CHUNK_Y; z++) {
    let id = BLOCO.AR;
    if (z < piso) {
      if (pedra || z < piso - 3) id = BLOCO.PEDRA;
      else id = BLOCO.TERRA;
    } else if (liquido && z >= a0 && z < a1) {
      id = liquido;
    }
    chunk.blocos[indiceLocal(lx, ly, z)] = id;
  }
}
