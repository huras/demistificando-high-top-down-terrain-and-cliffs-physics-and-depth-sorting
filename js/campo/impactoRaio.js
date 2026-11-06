/**
 * Pé do raio: fogo no que está em pé e a rajada no chão.
 * A marca e o flash ficam no céu — aqui só o que o campo já sabe queimar.
 */

import { ALTURA_BLOCO, CHUNK_XZ } from "../config.js";
import { amostraAgua } from "../mundo/agua/amostra.js";
import { alturaEm } from "../mundo/altura.js";
import { propsDoChunk } from "../mundo/bioma/propsBioma.js";
import { acenderArvore } from "./cicloArvore.js";
import { emitirImpactoRaio } from "./fx.js";
import { acenderGramaEm } from "./grama.js";

const RAIO_ARVORE = 2.4;
const MAX_ARVORE = 2;

function acenderArvores(x, y) {
  const cx = Math.floor(x / CHUNK_XZ);
  const cy = Math.floor(y / CHUNK_XZ);
  const r2 = RAIO_ARVORE * RAIO_ARVORE;
  let n = 0;
  for (let oy = -1; oy <= 1 && n < MAX_ARVORE; oy++) {
    for (let ox = -1; ox <= 1 && n < MAX_ARVORE; ox++) {
      const lista = propsDoChunk(cx + ox, cy + oy);
      if (!lista) continue;
      for (let i = 0; i < lista.length && n < MAX_ARVORE; i++) {
        const prop = lista[i];
        if (prop.tipo !== "arvore") continue;
        const dx = prop.x - x;
        const dy = prop.y - y;
        if (dx * dx + dy * dy > r2) continue;
        if (acenderArvore(prop)) n++;
      }
    }
  }
}

/** @returns {{ seco: boolean, y: number }} */
export function aplicarImpactoRaio(impacto) {
  const x = impacto.x;
  const y = impacto.z;
  const elev = impacto.y / ALTURA_BLOCO;
  const agua = amostraAgua(x, y, elev);
  const naAgua = agua.profundidade > 0.2;
  let zExtra = 0;
  let yLuz = impacto.y;
  if (naAgua) {
    const piso = alturaEm(Math.floor(x), Math.floor(y));
    yLuz = agua.superficie * ALTURA_BLOCO;
    zExtra = Math.max(0, yLuz - piso * ALTURA_BLOCO);
  } else {
    acenderArvores(x, y);
    acenderGramaEm(x, y, Date.now(), null);
  }
  emitirImpactoRaio(x, y, naAgua, zExtra);
  return { seco: !naAgua, y: yLuz };
}
