import { ALCANCE_EDICAO } from "../../config.js";
import { invalidarNavCache } from "../../navegacao/navGrade.js";
import { definirBloco, obterBloco, superficieEm } from "./storeMundo.js";
import { BLOCO, ehLiquido, ehSolido } from "./tiposBloco.js";

let blocoNaMao = BLOCO.PEDRA;

export function obterBlocoNaMao() {
  return blocoNaMao;
}

export function definirBlocoNaMao(id) {
  if ((id | 0) === BLOCO.AR) return;
  blocoNaMao = id | 0;
}

function alcanceOk(corpo, x, y, z) {
  const dx = x + 0.5 - corpo.x;
  const dy = y + 0.5 - corpo.y;
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const dz = z + 0.5 - elev;
  return dx * dx + dy * dy + dz * dz <= ALCANCE_EDICAO * ALCANCE_EDICAO;
}

/**
 * Quebra bloco sólido. Retorna id quebrado ou 0.
 */
export function quebrarBloco(corpo, alvo) {
  if (!alvo) return BLOCO.AR;
  const { x, y, z } = alvo;
  if (!alcanceOk(corpo, x, y, z)) return BLOCO.AR;
  const id = obterBloco(x, y, z);
  if (!ehSolido(id) && !ehLiquido(id)) return BLOCO.AR;
  if (!definirBloco(x, y, z, BLOCO.AR)) return BLOCO.AR;
  definirBlocoNaMao(id);
  invalidarNavCache();
  return id;
}

/**
 * Coloca blocoNaMao no ar adjacente.
 */
export function colocarBloco(corpo, alvo) {
  if (!alvo) return false;
  let px = alvo.x;
  let py = alvo.y;
  let pz = alvo.z;
  if (alvo.nx != null) {
    px = alvo.x + (alvo.nx | 0);
    py = alvo.y + (alvo.ny | 0);
    pz = alvo.z + (alvo.nz | 0);
  }
  if (!alcanceOk(corpo, px, py, pz)) return false;
  if (ehSolido(obterBloco(px, py, pz))) return false;

  const cx = Math.floor(corpo.x);
  const cy = Math.floor(corpo.y);
  const elev = Math.floor(corpo.elevacao ?? corpo.z ?? 0);
  if (px === cx && py === cy && (pz === elev || pz === elev + 1)) return false;

  const ok = definirBloco(px, py, pz, blocoNaMao);
  if (ok) invalidarNavCache();
  return ok;
}

export function quebrarSuperficie(corpo, cx, cy) {
  const surf = superficieEm(cx, cy);
  if (surf <= 0) return BLOCO.AR;
  return quebrarBloco(corpo, { x: cx, y: cy, z: surf - 1 });
}

export function colocarSobreSuperficie(corpo, cx, cy) {
  const surf = superficieEm(cx, cy);
  return colocarBloco(corpo, {
    x: cx,
    y: cy,
    z: Math.max(0, surf - 1),
    nx: 0,
    ny: 0,
    nz: 1,
  });
}
