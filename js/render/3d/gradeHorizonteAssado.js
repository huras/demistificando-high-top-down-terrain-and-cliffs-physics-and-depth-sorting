/**
 * Formato do horizonte prebake (offline → assets → runtime).
 * Compacto: grades tipadas gzip, geometria montada no load.
 */
import {
  CHUNK_HORIZONTE,
  PASSO_HORIZONTE,
  QUANT_ALTURA_HORIZONTE,
  SEED_MUNDO,
  UV_ESCALA_HORIZONTE,
  UV_ESCALA_MAR_HORIZONTE,
} from "../../config.js";
import { LADO_MUNDO } from "../../mundo/bounds.js";

export const PASTA_HORIZONTE = "assets/horizonte/mundo";

/** Bump se o layout do .bin mudar. */
export const SCHEMA_GRADE_HORIZONTE = 1;

const MAGIC = 0x31545a48; // "HZT1" little-endian

export function chaveSchemaPrebakeHorizonte() {
  return [
    SCHEMA_GRADE_HORIZONTE,
    SEED_MUNDO,
    CHUNK_HORIZONTE,
    PASSO_HORIZONTE,
    QUANT_ALTURA_HORIZONTE,
    UV_ESCALA_HORIZONTE,
    UV_ESCALA_MAR_HORIZONTE,
  ].join(".");
}

export function gradeTilesHorizonte() {
  return Math.floor(LADO_MUNDO / CHUNK_HORIZONTE);
}

export function nomeArquivoTile(hx, hy) {
  return `${hx}_${hy}.bin.gz`;
}

export function urlTileHorizonte(hx, hy) {
  return `${PASTA_HORIZONTE}/${nomeArquivoTile(hx, hy)}`;
}

/**
 * Empacota a grade amostrada em ArrayBuffer (sem gzip).
 * @param {object} grade
 * @returns {ArrayBuffer}
 */
export function codificarGradeHorizonte(grade) {
  const { nx, ny, nivel, alturas, cores, bioma, splat, mar } = grade;
  const nAlt = (nx + 1) * (ny + 1);
  const nCel = nx * ny;
  const header = 32;
  const bytes =
    header +
    nAlt * 4 +
    nCel * 3 * 4 +
    nCel * 3 * 4 +
    nCel * 4 +
    ((nCel + 3) & ~3);
  const buf = new ArrayBuffer(bytes);
  const view = new DataView(buf);
  let o = 0;
  view.setUint32(o, MAGIC, true);
  o += 4;
  view.setUint16(o, SCHEMA_GRADE_HORIZONTE, true);
  o += 2;
  view.setUint16(o, nx, true);
  o += 2;
  view.setUint16(o, ny, true);
  o += 2;
  view.setUint16(o, 0, true);
  o += 2;
  view.setFloat32(o, nivel, true);
  o += 4;
  view.setInt16(o, grade.hx | 0, true);
  o += 2;
  view.setInt16(o, grade.hy | 0, true);
  o += 2;
  view.setUint32(o, 0, true);
  o += 4;
  view.setUint32(o, 0, true);
  o += 4;
  // o === 32
  const f32 = new Float32Array(buf, o, nAlt + nCel * 3 + nCel * 3 + nCel);
  let fi = 0;
  f32.set(alturas, fi);
  fi += nAlt;
  f32.set(cores, fi);
  fi += nCel * 3;
  f32.set(bioma, fi);
  fi += nCel * 3;
  f32.set(splat, fi);
  o += (nAlt + nCel * 3 + nCel * 3 + nCel) * 4;
  const u8 = new Uint8Array(buf, o, nCel);
  u8.set(mar);
  return buf;
}

/**
 * @param {ArrayBuffer} buf
 * @returns {object | null}
 */
export function decodificarGradeHorizonte(buf) {
  if (!buf || buf.byteLength < 32) return null;
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== MAGIC) return null;
  const schema = view.getUint16(4, true);
  if (schema !== SCHEMA_GRADE_HORIZONTE) return null;
  const nx = view.getUint16(6, true);
  const ny = view.getUint16(8, true);
  const nivel = view.getFloat32(12, true);
  const hx = view.getInt16(16, true);
  const hy = view.getInt16(18, true);
  if (nx < 1 || ny < 1 || nx > 256 || ny > 256) return null;
  const nAlt = (nx + 1) * (ny + 1);
  const nCel = nx * ny;
  const need = 32 + (nAlt + nCel * 7) * 4 + ((nCel + 3) & ~3);
  if (buf.byteLength < need - ((nCel + 3) & ~3) + nCel) return null;
  let o = 32;
  const alturas = new Float32Array(buf, o, nAlt).slice();
  o += nAlt * 4;
  const cores = new Float32Array(buf, o, nCel * 3).slice();
  o += nCel * 3 * 4;
  const bioma = new Float32Array(buf, o, nCel * 3).slice();
  o += nCel * 3 * 4;
  const splat = new Float32Array(buf, o, nCel).slice();
  o += nCel * 4;
  const mar = new Uint8Array(buf, o, nCel).slice();
  let celulasMar = 0;
  for (let i = 0; i < nCel; i++) if (mar[i]) celulasMar += 1;
  const passo = PASSO_HORIZONTE;
  const lado = CHUNK_HORIZONTE;
  return {
    hx,
    hy,
    ox: hx * lado,
    oy: hy * lado,
    passo,
    nx,
    ny,
    nivel,
    alturas,
    cores,
    bioma,
    splat,
    mar,
    celulas: nCel,
    celulasMar,
  };
}

export function manifestoHorizonteBase(kits) {
  return {
    schema: chaveSchemaPrebakeHorizonte(),
    semente: SEED_MUNDO,
    ladoMundo: LADO_MUNDO,
    chunk: CHUNK_HORIZONTE,
    passo: PASSO_HORIZONTE,
    quantAltura: QUANT_ALTURA_HORIZONTE,
    uvTerra: UV_ESCALA_HORIZONTE,
    uvMar: UV_ESCALA_MAR_HORIZONTE,
    grade: gradeTilesHorizonte(),
    kits: kits || [],
  };
}
