/**
 * Atlas de escudos de tipo para pins de mapa / minimapa.
 * Layout 5×4 (phaser-noise player-shield-fx).
 */

const SHEET_URL = "/assets/shrines/type-shields.png";
const COLS = 5;
const ROWS = 4;

const TYPE_ORDER = [
  "grass",
  "fire",
  "water",
  "electric",
  "normal",
  "fighting",
  "dark",
  "steel",
  "dragon",
  "fairy",
  "bug",
  "flying",
  "ghost",
  null,
  "psychic",
  "rock",
  "ground",
  "poison",
  "ice",
  null,
];

/** @type {Record<string, number>} */
const TYPE_TO_SLOT = Object.create(null);
for (let i = 0; i < TYPE_ORDER.length; i++) {
  const type = TYPE_ORDER[i];
  if (type) TYPE_TO_SLOT[type] = i;
}

/** @type {HTMLImageElement | null} */
let sheet = null;
/** @type {Promise<boolean> | null} */
let loadPromise = null;
let cellW = 0;
let cellH = 0;
let cropPad = 0;
/** @type {Map<number, { x: number, y: number, w: number, h: number }>} */
const cropBySlot = new Map();
/** @type {HTMLCanvasElement | OffscreenCanvas | null} */
let probeCanvas = null;
/** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null} */
let probeCtx = null;

function getProbeCtx() {
  if (probeCtx) return probeCtx;
  if (typeof OffscreenCanvas !== "undefined") {
    probeCanvas = new OffscreenCanvas(1, 1);
    probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
    return probeCtx;
  }
  if (typeof document !== "undefined") {
    probeCanvas = document.createElement("canvas");
    probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  }
  return probeCtx;
}

function detectSlotCrop(slot) {
  if (cropBySlot.has(slot)) return cropBySlot.get(slot);
  if (!sheet || cellW <= 0 || cellH <= 0) return null;
  const ctx = getProbeCtx();
  if (!ctx || !probeCanvas) return null;
  const sx = (slot % COLS) * cellW;
  const sy = ((slot / COLS) | 0) * cellH;
  probeCanvas.width = cellW;
  probeCanvas.height = cellH;
  ctx.clearRect(0, 0, cellW, cellH);
  ctx.drawImage(sheet, sx, sy, cellW, cellH, 0, 0, cellW, cellH);
  const img = ctx.getImageData(0, 0, cellW, cellH).data;
  let minX = cellW;
  let minY = cellH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const a = img[(y * cellW + x) * 4 + 3];
      if (a < 20) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const crop =
    maxX >= minX && maxY >= minY
      ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      : { x: 0, y: 0, w: cellW, h: cellH };
  cropBySlot.set(slot, crop);
  return crop;
}

function detectGlobalCropPad() {
  const crop = detectSlotCrop(TYPE_TO_SLOT.grass);
  if (!crop) return;
  cropPad = Math.max(
    0,
    Math.min(crop.x, crop.y, cellW - (crop.x + crop.w), cellH - (crop.y + crop.h))
  );
}

function slotForElement(element) {
  const key = String(element || "normal").toLowerCase();
  const slot = TYPE_TO_SLOT[key];
  return slot != null ? slot : TYPE_TO_SLOT.normal;
}

export function ensureTypeShieldsLoaded() {
  if (sheet) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      sheet = img;
      cellW = Math.floor(img.width / COLS);
      cellH = Math.floor(img.height / ROWS);
      cropBySlot.clear();
      detectGlobalCropPad();
      resolve(true);
    };
    img.onerror = () => {
      loadPromise = null;
      sheet = null;
      console.warn("TipoEscudo: falha ao carregar", SHEET_URL);
      resolve(false);
    };
    img.src = SHEET_URL;
  });

  return loadPromise;
}

export function typeShieldsReady() {
  return !!(sheet && cellW > 0 && cellH > 0);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} element
 * @param {number} cx
 * @param {number} cy
 * @param {number} size diâmetro em px
 * @returns {boolean}
 */
export function drawTypeShield(ctx, element, cx, cy, size) {
  if (!ctx || !typeShieldsReady() || !(size > 0)) return false;
  const slot = slotForElement(element);
  const sx0 = (slot % COLS) * cellW;
  const sy0 = ((slot / COLS) | 0) * cellH;
  const crop = detectSlotCrop(slot);
  if (!crop) return false;
  const pad = cropPad > 0 ? cropPad : 0;
  const srcX = sx0 + Math.max(0, crop.x - pad);
  const srcY = sy0 + Math.max(0, crop.y - pad);
  const srcW = Math.min(cellW - (srcX - sx0), crop.w + pad * 2);
  const srcH = Math.min(cellH - (srcY - sy0), crop.h + pad * 2);
  if (!(srcW > 0) || !(srcH > 0)) return false;
  const half = size * 0.5;
  ctx.drawImage(sheet, srcX, srcY, srcW, srcH, cx - half, cy - half, size, size);
  return true;
}
