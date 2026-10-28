/**
 * Atlas 2D dos centros de kit → 1 textura / 1 material de topo por chunk.
 */
import * as THREE from "three";

const TILE = 64;
const PAD = 2;

/**
 * @param {Record<string, HTMLCanvasElement|HTMLImageElement|ImageBitmap>} centros
 * @param {string[]} idsKits
 */
export function construirAtlasTopoKits(centros, idsKits) {
  const ids = [];
  const imgs = [];
  for (let i = 0; i < idsKits.length; i++) {
    const id = idsKits[i];
    const img = centros?.[id];
    if (!img) continue;
    ids.push(id);
    imgs.push(img);
  }
  // Sempre inclui slot genérico "_" (grama fallback).
  if (!ids.includes("_")) {
    ids.unshift("_");
    imgs.unshift(null);
  }
  const n = Math.max(1, ids.length);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = TILE + PAD * 2;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#6a9e4e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /** @type {Map<string, {u0:number,v0:number,u1:number,v1:number}>} */
  const uvPorKit = new Map();
  for (let i = 0; i < ids.length; i++) {
    const col = i % cols;
    const row = (i / cols) | 0;
    const x = col * cell + PAD;
    const y = row * cell + PAD;
    const img = imgs[i];
    if (img) {
      try {
        ctx.drawImage(img, x, y, TILE, TILE);
      } catch (_) {
        ctx.fillStyle = "#6a9e4e";
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
    const u0 = (x + 0.5) / canvas.width;
    const v0 = 1 - (y + TILE - 0.5) / canvas.height;
    const u1 = (x + TILE - 0.5) / canvas.width;
    const v1 = 1 - (y + 0.5) / canvas.height;
    uvPorKit.set(ids[i], { u0, v0, u1, v1 });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  return { texture: tex, uvPorKit, canvas };
}

/** Remapeia UVs locais 0..1 do lote para o retângulo do atlas. */
export function remapUvLote(lote, rect) {
  if (!lote || !rect || lote.nVerts <= 0) return;
  const du = rect.u1 - rect.u0;
  const dv = rect.v1 - rect.v0;
  for (let i = 0; i < lote.nVerts; i++) {
    const iu = i * 2;
    const u = lote.uv[iu];
    const v = lote.uv[iu + 1];
    lote.uv[iu] = rect.u0 + u * du;
    lote.uv[iu + 1] = rect.v0 + v * dv;
  }
}

export function liberarAtlasTopo(atlas) {
  atlas?.texture?.dispose?.();
}
