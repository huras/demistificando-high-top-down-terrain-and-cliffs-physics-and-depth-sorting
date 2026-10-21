/**
 * Atlas de escudos elementais (type-shields.png do Pokémon AI via /ref).
 */

const SHEET_URL = "/ref/sprites/shields/type-shields.png";
const COLS = 5;
const ROWS = 4;

const ORDEM = [
  "grass", "fire", "water", "electric", "normal",
  "fighting", "dark", "steel", "dragon", "fairy",
  "bug", "flying", "ghost", null, "psychic",
  "rock", "ground", "poison", "ice", null,
];

/** @type {Record<string, number>} */
const TIPO_PARA_SLOT = Object.create(null);
for (let i = 0; i < ORDEM.length; i++) {
  if (ORDEM[i]) TIPO_PARA_SLOT[ORDEM[i]] = i;
}

let folha = null;
/** @type {Promise<boolean> | null} */
let carga = null;
let celW = 0;
let celH = 0;
let padCorte = 0;
/** @type {Map<number, { x: number, y: number, w: number, h: number }>} */
const cortePorSlot = new Map();
/** @type {HTMLCanvasElement | OffscreenCanvas | null} */
let probeCanvas = null;
/** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null} */
let probeCtx = null;
/** @type {Set<HTMLElement>} */
const hosts = new Set();

function ctxProbe() {
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

function slotDoTipo(tipo) {
  const key = String(tipo || "normal").toLowerCase();
  const slot = TIPO_PARA_SLOT[key];
  return slot != null ? slot : TIPO_PARA_SLOT.normal;
}

function detectarCorte(slot) {
  if (cortePorSlot.has(slot)) return cortePorSlot.get(slot);
  if (!folha || celW <= 0 || celH <= 0) return null;
  const ctx = ctxProbe();
  if (!ctx || !probeCanvas) return null;
  const sx = (slot % COLS) * celW;
  const sy = ((slot / COLS) | 0) * celH;
  probeCanvas.width = celW;
  probeCanvas.height = celH;
  ctx.clearRect(0, 0, celW, celH);
  ctx.drawImage(folha, sx, sy, celW, celH, 0, 0, celW, celH);
  const img = ctx.getImageData(0, 0, celW, celH).data;
  let minX = celW;
  let minY = celH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < celH; y++) {
    for (let x = 0; x < celW; x++) {
      if (img[(y * celW + x) * 4 + 3] < 20) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const crop =
    maxX >= minX && maxY >= minY
      ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      : { x: 0, y: 0, w: celW, h: celH };
  cortePorSlot.set(slot, crop);
  return crop;
}

function detectarPadGlobal() {
  const crop = detectarCorte(TIPO_PARA_SLOT.grass);
  if (!crop) return;
  padCorte = Math.max(
    0,
    Math.min(crop.x, crop.y, celW - (crop.x + crop.w), celH - (crop.y + crop.h)),
  );
}

function pintarHost(host) {
  if (!host || !folha) return;
  const tipo = host.dataset.typeShield;
  if (!tipo) return;
  const sizePx = Number(host.dataset.typeShieldSize) || 24;
  let canvas = host.querySelector("canvas.type-shield-icon");
  if (!canvas) return;
  if (canvas.width !== sizePx || canvas.height !== sizePx) {
    canvas.width = sizePx;
    canvas.height = sizePx;
    canvas.style.width = `${sizePx}px`;
    canvas.style.height = `${sizePx}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, sizePx, sizePx);
  desenharEscudoTipo(ctx, tipo, sizePx * 0.5, sizePx * 0.5, sizePx);
  host.classList.add("is-loaded");
}

export function garantirAtlasTipo() {
  if (folha) return Promise.resolve(true);
  if (carga) return carga;
  carga = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      folha = img;
      celW = Math.floor(img.width / COLS);
      celH = Math.floor(img.height / ROWS);
      detectarPadGlobal();
      for (const host of hosts) {
        if (host.isConnected) pintarHost(host);
      }
      resolve(true);
    };
    img.onerror = () => {
      carga = null;
      folha = null;
      resolve(false);
    };
    img.src = SHEET_URL;
  });
  return carga;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} tipo
 * @param {number} cx
 * @param {number} cy
 * @param {number} size
 */
export function desenharEscudoTipo(ctx, tipo, cx, cy, size) {
  if (!ctx || !folha || celW <= 0 || celH <= 0) return;
  const slot = slotDoTipo(tipo);
  const sx0 = (slot % COLS) * celW;
  const sy0 = ((slot / COLS) | 0) * celH;
  const crop = detectarCorte(slot);
  if (!crop) return;
  const pad = padCorte > 0 ? padCorte : 0;
  const srcX = sx0 + Math.max(0, crop.x - pad);
  const srcY = sy0 + Math.max(0, crop.y - pad);
  const srcW = Math.min(celW - (srcX - sx0), crop.w + pad * 2);
  const srcH = Math.min(celH - (srcY - sy0), crop.h + pad * 2);
  const half = size * 0.5;
  ctx.drawImage(folha, srcX, srcY, srcW, srcH, cx - half, cy - half, size, size);
}

/**
 * @param {HTMLElement} host
 * @param {string | null | undefined} tipo
 * @param {number} [sizePx=24]
 */
export function definirEscudoTipo(host, tipo, sizePx = 24) {
  if (!host || typeof document === "undefined") return;
  const el = String(tipo || "normal").toLowerCase();
  host.dataset.typeShield = el;
  host.dataset.typeShieldSize = String(sizePx);
  hosts.add(host);

  let canvas = host.querySelector("canvas.type-shield-icon");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "type-shield-icon";
    canvas.setAttribute("aria-hidden", "true");
    host.replaceChildren(canvas);
  }

  if (folha) {
    pintarHost(host);
    return;
  }
  garantirAtlasTipo().then((ok) => {
    if (ok && host.dataset.typeShield === el) pintarHost(host);
  });
}

/**
 * @param {string | null | undefined} tipo
 * @param {number} [sizePx=24]
 * @param {string} [extraClass]
 */
export function criarIconeTipo(tipo, sizePx = 24, extraClass = "") {
  const el = document.createElement("span");
  el.className = extraClass ? `type-icon ${extraClass}` : "type-icon";
  el.style.setProperty("--type", "");
  definirEscudoTipo(el, tipo, sizePx);
  return el;
}
