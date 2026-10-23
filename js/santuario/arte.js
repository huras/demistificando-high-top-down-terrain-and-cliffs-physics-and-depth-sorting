/**
 * Atlas elemental-shrines.png → recortes por coluna (billboard).
 */
import { SHRINE_TILE_PX } from "./catalogo.js";

const SHEET_URL = "/assets/shrines/elemental-shrines.png";

/** @type {HTMLImageElement | null} */
let sheetImage = null;
let loadStarted = false;
/** @type {Map<number, HTMLCanvasElement>} */
const recortes = new Map();
/** @type {Set<() => void>} */
const readyListeners = new Set();

function notifyReady() {
  for (const fn of readyListeners) fn();
  readyListeners.clear();
}

export function ensureShrineArtLoaded(onReady) {
  if (typeof onReady === "function") {
    if (sheetImage?.complete && sheetImage.naturalWidth > 0) onReady();
    else readyListeners.add(onReady);
  }
  if (loadStarted) return;
  loadStarted = true;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    sheetImage = img;
    recortes.clear();
    notifyReady();
    import("../mundo/voxel/storeMundo.js")
      .then((m) => m.avisarDirty?.())
      .catch(() => {});
  };
  img.onerror = () => {
    console.warn("ShrineArt: falha ao carregar", SHEET_URL);
    notifyReady();
  };
  img.src = SHEET_URL;
}

export function isShrineArtReady() {
  return !!(sheetImage?.complete && sheetImage.naturalWidth > 0);
}

/**
 * Canvas 16×32 com a coluna do atlas (norte+sul).
 * @param {number} atlasCol
 * @returns {HTMLCanvasElement | null}
 */
export function imagemSantuario(atlasCol) {
  ensureShrineArtLoaded();
  if (!isShrineArtReady()) return null;
  const col = atlasCol | 0;
  let c = recortes.get(col);
  if (c) return c;
  const px = SHRINE_TILE_PX;
  c = document.createElement("canvas");
  c.width = px;
  c.height = px * 2;
  const ctx = c.getContext("2d");
  if (!ctx || !sheetImage) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheetImage, col * px, 0, px, px * 2, 0, 0, px, px * 2);
  recortes.set(col, c);
  return c;
}
