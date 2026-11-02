import { ALCANCE_EDICAO } from "../../config.js";
import { semearInundacao } from "../agua/inundar.js";
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

/** Alcance horizontal (tiles XY) a partir do player. Hot path: sem alloc. */
export function emAlcanceEdicao(corpo, x, y, _z) {
  if (!corpo) return false;
  const dx = (x | 0) + 0.5 - corpo.x;
  const dy = (y | 0) + 0.5 - corpo.y;
  return dx * dx + dy * dy <= ALCANCE_EDICAO * ALCANCE_EDICAO;
}

function alcanceOk(corpo, x, y, z) {
  return emAlcanceEdicao(corpo, x, y, z);
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
  semearInundacao(x, y, z);
  return id;
}

/**
 * Destino do place: líquido é replaceable (Minecraft) — escreve no voxel atingido.
 * Sólido → célula adjacente pela normal.
 */
export function celulaDestinoPlace(alvo) {
  if (!alvo) return null;
  const id =
    alvo.id != null ? alvo.id | 0 : obterBloco(alvo.x, alvo.y, alvo.z);
  if (ehLiquido(id)) {
    return { x: alvo.x | 0, y: alvo.y | 0, z: alvo.z | 0 };
  }
  return {
    x: (alvo.x | 0) + (alvo.nx | 0),
    y: (alvo.y | 0) + (alvo.ny | 0),
    z: (alvo.z | 0) + (alvo.nz | 0),
  };
}

/**
 * Coloca blocoNaMao no destino (adjacente, ou no líquido se replaceable).
 */
export function colocarBloco(corpo, alvo) {
  if (!alvo) return false;
  const dest = celulaDestinoPlace(alvo);
  if (!dest) return false;
  const { x: px, y: py, z: pz } = dest;
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
  const x = cx | 0;
  const y = cy | 0;
  const surf = superficieEm(x, y);
  const zTopo = Math.max(0, surf - 1);
  const idTopo = obterBloco(x, y, zTopo);
  // Líquido no topo: place no próprio voxel (cresce o chão). Senão, em cima.
  if (ehLiquido(idTopo)) {
    return colocarBloco(corpo, { x, y, z: zTopo, nx: 0, ny: 0, nz: 0, id: idTopo });
  }
  return colocarBloco(corpo, {
    x,
    y,
    z: zTopo,
    nx: 0,
    ny: 0,
    nz: 1,
    id: idTopo,
  });
}
