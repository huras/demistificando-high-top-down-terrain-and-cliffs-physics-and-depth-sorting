/**
 * BufferGeometry a partir de lote tipado — só no main thread (Three).
 */
import * as THREE from "three";
import { anexarLoteAoLote, criarLoteTipado, garantirCapLote } from "./loteTipado.js";

function fatiar(src, n) {
  return src.length === n ? src : src.slice(0, n);
}

/** @returns {THREE.BufferGeometry | null} */
export function geoDoLoteTipado(lote) {
  if (!lote || lote.nVerts <= 0) return null;
  const n = lote.nVerts;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(fatiar(lote.pos, n * 3), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(fatiar(lote.uv, n * 2), 2));
  geo.setAttribute("normal", new THREE.BufferAttribute(fatiar(lote.nor, n * 3), 3));
  if (lote.cor) {
    geo.setAttribute("color", new THREE.BufferAttribute(fatiar(lote.cor, n * 3), 3));
  }
  if (lote.splat) {
    geo.setAttribute("splat", new THREE.BufferAttribute(fatiar(lote.splat, n), 1));
  }
  if (lote.pele) {
    geo.setAttribute("peleUv", new THREE.BufferAttribute(fatiar(lote.pele, n * 2), 2));
  }
  return geo;
}

/** Junta vários lotes tipados (mesmo layout) num geo. */
export function geoDeLotes(lotes) {
  const vivos = lotes.filter((l) => l && l.nVerts > 0);
  if (!vivos.length) return null;
  if (vivos.length === 1) return geoDoLoteTipado(vivos[0]);
  let total = 0;
  for (let i = 0; i < vivos.length; i++) total += vivos[i].nVerts;
  const comCor = vivos.some((l) => l.cor);
  const comSplat = vivos.some((l) => l.splat);
  const dest = criarLoteTipado(comCor, comSplat);
  garantirCapLote(dest, total);
  for (let i = 0; i < vivos.length; i++) anexarLoteAoLote(dest, vivos[i]);
  return geoDoLoteTipado(dest);
}

export { anexarGeoAoLote } from "./loteTipado.js";
