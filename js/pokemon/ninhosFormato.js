/** Binário dos ninhos. Mesmo layout no script e no jogo. */

export const MAGIA = "NIN1";
export const VERSAO_NINHOS = 1;
export const OVER_BYTES = 14;
export const CAVE_BYTES = 11;

const KIND_COD = { land: 0, high: 1, surface: 2, undersea: 3 };
const KIND_NOME = ["land", "high", "surface", "undersea"];

export function codKind(nome) {
  const n = KIND_COD[nome];
  return n === undefined ? 0 : n;
}

export function nomeKind(cod) {
  return KIND_NOME[cod] || "land";
}

function utf8(texto) {
  return new TextEncoder().encode(String(texto || ""));
}

/**
 * @param {object[]} over
 * @param {object[]} caves
 * @returns {Uint8Array}
 */
export function gravarNinhos(over, caves) {
  const nomes = [];
  const indiceNome = new Map();
  for (let i = 0; i < caves.length; i++) {
    const id = String(caves[i].caveId || "");
    if (indiceNome.has(id)) continue;
    indiceNome.set(id, nomes.length);
    nomes.push(id);
  }

  const blocos = [];
  let nomesBytes = 0;
  for (let i = 0; i < nomes.length; i++) {
    const bytes = utf8(nomes[i]);
    blocos.push(bytes);
    nomesBytes += 2 + bytes.length;
  }

  const total = 4 + 2 + 4 + 4 + 2 + nomesBytes + over.length * OVER_BYTES + caves.length * CAVE_BYTES;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  buf[0] = 78;
  buf[1] = 73;
  buf[2] = 78;
  buf[3] = 49;
  let o = 4;
  view.setUint16(o, VERSAO_NINHOS, true);
  o += 2;
  view.setUint32(o, over.length, true);
  o += 4;
  view.setUint32(o, caves.length, true);
  o += 4;
  view.setUint16(o, nomes.length, true);
  o += 2;
  for (let i = 0; i < blocos.length; i++) {
    const bytes = blocos[i];
    view.setUint16(o, bytes.length, true);
    o += 2;
    buf.set(bytes, o);
    o += bytes.length;
  }

  const ordenado = over.slice().sort((a, b) => {
    if (a.cy !== b.cy) return a.cy - b.cy;
    if (a.cx !== b.cx) return a.cx - b.cx;
    return a.indice - b.indice;
  });
  for (let i = 0; i < ordenado.length; i++) {
    const rec = ordenado[i];
    view.setUint16(o, rec.cx | 0, true);
    view.setUint16(o + 2, rec.cy | 0, true);
    view.setUint8(o + 4, rec.indice | 0);
    view.setUint16(o + 5, Math.max(0, Math.min(65535, Math.floor(rec.x))), true);
    view.setUint16(o + 7, Math.max(0, Math.min(65535, Math.floor(rec.y))), true);
    view.setUint16(o + 9, rec.dex | 0, true);
    view.setUint8(o + 11, codKind(rec.kind));
    view.setUint8(o + 12, rec.shiny ? 1 : 0);
    view.setUint8(o + 13, Math.max(1, Math.min(255, rec.nivel | 0)));
    o += OVER_BYTES;
  }

  const cavesOrd = caves.slice().sort((a, b) => {
    if (a.caveId !== b.caveId) return String(a.caveId).localeCompare(String(b.caveId));
    return (a.posto | 0) - (b.posto | 0);
  });
  for (let i = 0; i < cavesOrd.length; i++) {
    const rec = cavesOrd[i];
    const flags = (rec.shiny ? 1 : 0) | (rec.hostil ? 2 : 0);
    view.setUint16(o, indiceNome.get(String(rec.caveId)) | 0, true);
    view.setUint8(o + 2, rec.posto | 0);
    view.setUint16(o + 3, rec.tx | 0, true);
    view.setUint16(o + 5, rec.ty | 0, true);
    view.setUint16(o + 7, rec.dex | 0, true);
    view.setUint8(o + 9, Math.max(1, Math.min(255, rec.nivel | 0)));
    view.setUint8(o + 10, flags);
    o += CAVE_BYTES;
  }
  return buf;
}

/**
 * @param {ArrayBuffer|Uint8Array} bruto
 */
export function lerNinhos(bruto) {
  const bytes = bruto instanceof Uint8Array ? bruto : new Uint8Array(bruto);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 16 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== MAGIA) {
    throw new Error("ninhos.bin inválido");
  }
  let o = 4;
  const versao = view.getUint16(o, true);
  o += 2;
  if (versao !== VERSAO_NINHOS) throw new Error(`ninhos.bin versão ${versao}`);
  const nOver = view.getUint32(o, true);
  o += 4;
  const nCave = view.getUint32(o, true);
  o += 4;
  const nNomes = view.getUint16(o, true);
  o += 2;
  const decoder = new TextDecoder();
  const nomes = new Array(nNomes);
  for (let i = 0; i < nNomes; i++) {
    const len = view.getUint16(o, true);
    o += 2;
    nomes[i] = decoder.decode(bytes.subarray(o, o + len));
    o += len;
  }
  const over = new Array(nOver);
  for (let i = 0; i < nOver; i++) {
    const cx = view.getUint16(o, true);
    const cy = view.getUint16(o + 2, true);
    const indice = view.getUint8(o + 4);
    const x = view.getUint16(o + 5, true) + 0.5;
    const y = view.getUint16(o + 7, true) + 0.5;
    const dex = view.getUint16(o + 9, true);
    const kind = nomeKind(view.getUint8(o + 11));
    const shiny = (view.getUint8(o + 12) & 1) !== 0;
    const nivel = view.getUint8(o + 13);
    o += OVER_BYTES;
    over[i] = {
      id: `${cx},${cy},${indice}`,
      cx,
      cy,
      indice,
      x,
      y,
      z: 0,
      dex,
      kind,
      shiny,
      nivel,
      speciesKey: "",
    };
  }
  const caves = new Array(nCave);
  for (let i = 0; i < nCave; i++) {
    const nomeIndex = view.getUint16(o, true);
    const posto = view.getUint8(o + 2);
    const tx = view.getUint16(o + 3, true);
    const ty = view.getUint16(o + 5, true);
    const dex = view.getUint16(o + 7, true);
    const nivel = view.getUint8(o + 9);
    const flags = view.getUint8(o + 10);
    o += CAVE_BYTES;
    const caveId = nomes[nomeIndex] || "";
    caves[i] = {
      id: `cave:${caveId}:${posto}`,
      caveId,
      posto,
      tx,
      ty,
      dex,
      nivel,
      shiny: (flags & 1) !== 0,
      hostil: (flags & 2) !== 0,
      speciesKey: "",
    };
  }
  return { over, caves };
}
