/**
 * Preview em pixels da porta de árvore do bioma (editor).
 * Modos: spawn · negar (clareira). WASD / arraste = pan · scroll = zoom.
 */
import {
  classificarArvorePreview,
  forcaClareiraPreview,
  temClareiraArvore,
} from "../mundo/bioma/detalhe.js";
import { obterKit } from "../mundo/bioma/kits.js";

const COR_VAZIO = [18, 24, 20];
const COR_CLAREIRA = [168, 120, 48];
const COR_SPAWN = [56, 170, 88];
const COR_NEGAR_BASE = [28, 22, 14];
const COR_NEGAR = [210, 140, 42];

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 8;
const PASSO_PAN = 8;

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {HTMLElement | null} */
let caption = null;
/** @type {HTMLElement | null} */
let modosEl = null;
/** @type {"spawn" | "negar"} */
let modo = "spawn";
/** @type {string} */
let biomaId = "";
/** @type {string | null} */
let kitId = null;
let origemX = 0;
let origemY = 0;
let celulasPorPixel = 1.5;
let pedido = 0;
let panRaf = 0;

const teclas = { w: false, a: false, s: false, d: false };
let arrastando = false;
let ultimoX = 0;
let ultimoY = 0;

function focoEmCampo() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

function misturar(a, b, t) {
  return [
    (a[0] + (b[0] - a[0]) * t) | 0,
    (a[1] + (b[1] - a[1]) * t) | 0,
    (a[2] + (b[2] - a[2]) * t) | 0,
  ];
}

function pedirDesenho() {
  if (pedido) return;
  pedido = requestAnimationFrame(() => {
    pedido = 0;
    desenhar();
  });
}

function atualizarModosUi() {
  if (!modosEl) return;
  const temNegar = temClareiraArvore(biomaId);
  modosEl.hidden = false;
  const botoes = modosEl.querySelectorAll("button[data-modo]");
  for (let i = 0; i < botoes.length; i++) {
    const btn = botoes[i];
    const m = btn.getAttribute("data-modo");
    btn.classList.toggle("ativo", m === modo);
    if (m === "negar") btn.disabled = !temNegar;
  }
  if (modo === "negar" && !temNegar) modo = "spawn";
}

function desenhar() {
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const kit = kitId ? obterKit(kitId) : null;
  const temArvore = !!(kit?.arvore?.length);
  const temNegar = temClareiraArvore(biomaId);
  atualizarModosUi();

  if (caption) {
    if (!temArvore) caption.textContent = "Árvores · sem kit de árvore";
    else if (modo === "negar") {
      caption.textContent = temNegar
        ? "Negar árvore · âmbar = zona limpa"
        : "Negar árvore · sem clareira neste bioma";
    } else caption.textContent = "Spawn · WASD pan · scroll zoom";
  }

  if (!temArvore || !biomaId || (modo === "negar" && !temNegar)) {
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      data[o] = COR_VAZIO[0];
      data[o + 1] = COR_VAZIO[1];
      data[o + 2] = COR_VAZIO[2];
      data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return;
  }

  const passo = celulasPorPixel;
  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const verNegar = modo === "negar";

  for (let py = 0; py < h; py++) {
    const wy = Math.floor(origemY + (py - halfH) * passo);
    for (let px = 0; px < w; px++) {
      const wx = Math.floor(origemX + (px - halfW) * passo);
      let cor = COR_VAZIO;
      if (verNegar) {
        const f = forcaClareiraPreview(biomaId, wx, wy);
        cor = f > 0 ? misturar(COR_NEGAR_BASE, COR_NEGAR, f) : COR_VAZIO;
      } else {
        const cls = classificarArvorePreview(biomaId, wx, wy);
        cor = cls === 2 ? COR_SPAWN : cls === 1 ? COR_CLAREIRA : COR_VAZIO;
      }
      const o = (py * w + px) * 4;
      data[o] = cor[0];
      data[o + 1] = cor[1];
      data[o + 2] = cor[2];
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function tickPan() {
  panRaf = 0;
  if (focoEmCampo()) {
    if (teclas.w || teclas.a || teclas.s || teclas.d) {
      panRaf = requestAnimationFrame(tickPan);
    }
    return;
  }
  let dx = 0;
  let dy = 0;
  if (teclas.w) dy -= 1;
  if (teclas.s) dy += 1;
  if (teclas.a) dx -= 1;
  if (teclas.d) dx += 1;
  if (dx || dy) {
    const passo = PASSO_PAN * celulasPorPixel;
    origemX += dx * passo;
    origemY += dy * passo;
    pedirDesenho();
    panRaf = requestAnimationFrame(tickPan);
  }
}

function garantirPanLoop() {
  if (!panRaf && (teclas.w || teclas.a || teclas.s || teclas.d)) {
    panRaf = requestAnimationFrame(tickPan);
  }
}

/**
 * @param {HTMLCanvasElement} el
 * @param {HTMLElement | null} [legenda]
 * @param {HTMLElement | null} [modos]
 */
export function ligarPreviewArvore(el, legenda = null, modos = null) {
  canvas = el;
  caption = legenda;
  modosEl = modos;
  canvas.style.cursor = "grab";

  if (modosEl) {
    modosEl.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-modo]");
      if (!btn || btn.disabled) return;
      const prox = btn.getAttribute("data-modo");
      if (prox !== "spawn" && prox !== "negar") return;
      modo = prox;
      pedirDesenho();
    });
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    arrastando = true;
    ultimoX = ev.clientX;
    ultimoY = ev.clientY;
    canvas.classList.add("arrastando");
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!arrastando) return;
    const dx = ev.clientX - ultimoX;
    const dy = ev.clientY - ultimoY;
    ultimoX = ev.clientX;
    ultimoY = ev.clientY;
    origemX -= dx * celulasPorPixel;
    origemY -= dy * celulasPorPixel;
    pedirDesenho();
  });

  const soltar = (ev) => {
    if (!arrastando) return;
    arrastando = false;
    canvas.classList.remove("arrastando");
    canvas.style.cursor = "grab";
    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);

  canvas.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const fator = ev.deltaY > 0 ? 1.12 : 1 / 1.12;
      celulasPorPixel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, celulasPorPixel * fator));
      pedirDesenho();
    },
    { passive: false },
  );

  window.addEventListener("keydown", (ev) => {
    if (focoEmCampo()) return;
    const k = ev.key.toLowerCase();
    if (k !== "w" && k !== "a" && k !== "s" && k !== "d") return;
    if (teclas[k]) return;
    teclas[k] = true;
    garantirPanLoop();
  });

  window.addEventListener("keyup", (ev) => {
    const k = ev.key.toLowerCase();
    if (k === "w" || k === "a" || k === "s" || k === "d") teclas[k] = false;
  });

  pedirDesenho();
}

/**
 * @param {{ id?: string, kit?: string | null } | null} bioma
 */
export function atualizarPreviewArvore(bioma) {
  biomaId = bioma?.id || "";
  kitId = bioma?.kit || bioma?.id || null;
  pedirDesenho();
}
