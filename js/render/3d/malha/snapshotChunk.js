/**
 * Snapshot transferível do chunk + halo 1 — entrada do Worker de malha.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../../config.js";
import { kitDoRelevo } from "../../../mundo/bioma/catalogo.js";
import { amostraKanto } from "../../../mundo/regiao/amostraKanto.js";
import { colunaTemArInterno } from "../../../mundo/altura.js";
import {
  chunkCarregadoEm,
  obterBloco,
  obterChunk,
} from "../../../mundo/voxel/storeMundo.js";
import { colunaAgua } from "../../../mundo/agua/fluxo.js";
import { gradeDoChunk } from "../pecas/mascara.js";

const HALO = 1;
const LADO = CHUNK_XZ + HALO * 2;

/**
 * @param {object} chunk
 * @returns {{ meta: object, buffers: ArrayBuffer[], payload: object }}
 */
export function capturarSnapshotChunk(chunk) {
  const cx = chunk.cx | 0;
  const cy = chunk.cy | 0;
  const baseX = cx * CHUNK_XZ - HALO;
  const baseY = cy * CHUNK_XZ - HALO;
  const nCel = LADO * LADO;
  const blocos = new Uint8Array(nCel * CHUNK_Y);
  const aguaSurf = new Int16Array(nCel);
  const aguaProf = new Int16Array(nCel);
  const aguaFundo = new Int16Array(nCel);
  const aguaPiso = new Int16Array(nCel);
  const aguaCaindo = new Uint8Array(nCel);
  const fluido = new Uint8Array(nCel);
  const fluxoX = new Int8Array(nCel);
  const fluxoY = new Int8Array(nCel);
  const temAr = new Uint8Array(nCel);
  const modelo = new Uint8Array(nCel);
  const kitIdx = new Uint16Array(nCel);
  /** @type {string[]} */
  const kitNomes = [];
  const kitMap = new Map();

  function idxKit(nome) {
    const k = nome || "_";
    let i = kitMap.get(k);
    if (i != null) return i;
    i = kitNomes.length;
    kitNomes.push(k);
    kitMap.set(k, i);
    return i;
  }

  for (let ly = 0; ly < LADO; ly++) {
    for (let lx = 0; lx < LADO; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const ia = ly * LADO + lx;
      const off = ia * CHUNK_Y;
      for (let z = 0; z < CHUNK_Y; z++) {
        blocos[off + z] = obterBloco(wx, wy, z) & 255;
      }
      const ag = colunaAgua(wx, wy);
      aguaSurf[ia] = ag.superficie | 0;
      aguaProf[ia] = ag.profundidade | 0;
      aguaFundo[ia] = ag.fundo | 0;
      aguaPiso[ia] = ag.pisoQueda | 0;
      aguaCaindo[ia] = ag.caindo ? 1 : 0;
      fluido[ia] = ag.fluido | 0;
      // fluxo só no miolo do chunk store
      const noMiolo =
        lx >= HALO && lx < HALO + CHUNK_XZ && ly >= HALO && ly < HALO + CHUNK_XZ;
      if (noMiolo) {
        const ix = (ly - HALO) * CHUNK_XZ + (lx - HALO);
        fluxoX[ia] = chunk.fluxoX?.[ix] | 0;
        fluxoY[ia] = chunk.fluxoY?.[ix] | 0;
        if (chunk.aguaSuperficie) aguaSurf[ia] = chunk.aguaSuperficie[ix] | 0;
        if (chunk.aguaProf) aguaProf[ia] = chunk.aguaProf[ix] | 0;
        if (chunk.aguaFundo) aguaFundo[ia] = chunk.aguaFundo[ix] | 0;
        if (chunk.aguaPiso) aguaPiso[ia] = chunk.aguaPiso[ix] | 0;
        if (chunk.aguaCaindo) aguaCaindo[ia] = chunk.aguaCaindo[ix] | 0;
        if (chunk.fluido) fluido[ia] = chunk.fluido[ix] | 0;
      }
      temAr[ia] = colunaTemArInterno(wx, wy) ? 1 : 0;
      const am = amostraKanto(wx, wy);
      modelo[ia] = am?.modelo || am?.entradaLab ? 1 : 0;
      kitIdx[ia] = idxKit(kitDoRelevo(wx, wy) || "_");
    }
  }

  const grade = gradeDoChunk(cx, cy);
  const gradeCopy = Int16Array.from(grade);

  const payload = {
    cx,
    cy,
    rev: chunk.rev | 0,
    halo: HALO,
    lado: LADO,
    chunkXz: CHUNK_XZ,
    chunkY: CHUNK_Y,
    kitNomes,
    blocos,
    aguaSurf,
    aguaProf,
    aguaFundo,
    aguaPiso,
    aguaCaindo,
    fluido,
    fluxoX,
    fluxoY,
    temAr,
    modelo,
    kitIdx,
    grade: gradeCopy,
  };

  const buffers = [
    blocos.buffer,
    aguaSurf.buffer,
    aguaProf.buffer,
    aguaFundo.buffer,
    aguaPiso.buffer,
    aguaCaindo.buffer,
    fluido.buffer,
    fluxoX.buffer,
    fluxoY.buffer,
    temAr.buffer,
    modelo.buffer,
    kitIdx.buffer,
    gradeCopy.buffer,
  ];

  return { payload, buffers };
}

export function chunkExisteParaSnapshot(cx, cy) {
  return !!obterChunk(cx, cy) || chunkCarregadoEm(cx * CHUNK_XZ, cy * CHUNK_XZ);
}
