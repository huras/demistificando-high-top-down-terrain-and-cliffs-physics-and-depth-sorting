/**
 * Preview de pedra/cristal no inspector do editor.
 * Modos: spawn · depósito · veia. WASD / arraste = pan · scroll = zoom.
 */
import {
  classificarPedraPreview,
  forcaDepositoPreview,
  forcaVeiaPreview,
  temDepositoPedra,
  temVeiaCristal,
} from "../mundo/bioma/detalhe.js";

const COR_VAZIO = [18, 24, 20];
const COR_PEDRA = [140, 130, 118];
const COR_CRISTAL = [120, 180, 220];
const COR_DEP_BASE = [28, 24, 18];
const COR_DEP = [180, 150, 90];
const COR_VEIA_BASE = [18, 22, 32];
const COR_VEIA = [90, 160, 220];

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 8;
const PASSO_PAN = 8;

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {HTMLElement | null} */
let caption = null;
/** @type {HTMLElement | null} */
let modosEl = null;
/** @type {"spawn" | "deposito" | "veia"} */
let modo = "spawn";
/** @type {string} */
let biomaId = "";
let origemX = 0;
let origemY = 0;
let celulasPorPixel = 1.5;
let pedido = 0;
let panRaf = 0;
let tecladoLigado = false;

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
  const temDep = temDepositoPedra(biomaId);
  const temVeia = temVeiaCristal(biomaId);
  const botoes = modosEl.querySelectorAll("button[data-modo]");
  for (let i = 0; i < botoes.length; i++) {
    const btn = botoes[i];
    const m = btn.getAttribute("data-modo");
    btn.classList.toggle("ativo", m === modo);
    if (m === "deposito") btn.disabled = !temDep;
    if (m === "veia") btn.disabled = !temVeia;
  }
  if (modo === "deposito" && !temDep) modo = "spawn";
  if (modo === "veia" && !temVeia) modo = "spawn";
}

function desenhar() {
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const data = img.data;
  atualizarModosUi();

  if (caption) {
    if (!biomaId) caption.textContent = "Mineral · sem bioma";
    else if (modo === "deposito") caption.textContent = "Depósito · âmbar = afloramento";
    else if (modo === "veia") caption.textContent = "Veia · azul = zona de cristal";
    else caption.textContent = "Spawn · cinza pedra · azul cristal";
  }

  if (!biomaId) {
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

  for (let py = 0; py < h; py++) {
    const wy = Math.floor(origemY + (py - halfH) * passo);
    for (let px = 0; px < w; px++) {
      const wx = Math.floor(origemX + (px - halfW) * passo);
      let cor = COR_VAZIO;
      if (modo === "deposito") {
        const f = forcaDepositoPreview(biomaId, wx, wy);
        cor = f > 0 ? misturar(COR_DEP_BASE, COR_DEP, f) : COR_VAZIO;
      } else if (modo === "veia") {
        const f = forcaVeiaPreview(biomaId, wx, wy);
        cor = f > 0 ? misturar(COR_VEIA_BASE, COR_VEIA, f) : COR_VAZIO;
      } else {
        const cls = classificarPedraPreview(biomaId, wx, wy);
        cor = cls === 2 ? COR_CRISTAL : cls === 1 ? COR_PEDRA : COR_VAZIO;
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

function ligarTeclado() {
  if (tecladoLigado) return;
  tecladoLigado = true;
  window.addEventListener("keydown", (ev) => {
    if (!canvas || !canvas.isConnected) return;
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
}

function ligarCanvas() {
  if (!canvas) return;
  canvas.style.cursor = "grab";

  if (modosEl) {
    modosEl.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-modo]");
      if (!btn || btn.disabled) return;
      const prox = btn.getAttribute("data-modo");
      if (prox !== "spawn" && prox !== "deposito" && prox !== "veia") return;
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
}

/**
 * Monta o preview dentro de um container do inspector (DOM recriado a cada paint).
 * @param {HTMLElement} host
 * @param {string} biomaAtualId
 */
export function montarPreviewPedra(host, biomaAtualId) {
  if (!host) return;
  biomaId = biomaAtualId || "";

  const wrap = document.createElement("div");
  wrap.className = "previa-pedra";
  modosEl = document.createElement("div");
  modosEl.className = "previa-pedra__modos";
  for (const [id, rotulo] of [
    ["spawn", "Spawn"],
    ["deposito", "Depósito"],
    ["veia", "Veia"],
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.modo = id;
    btn.textContent = rotulo;
    if (id === modo) btn.classList.add("ativo");
    modosEl.append(btn);
  }
  canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 120;
  canvas.id = "prev-pedra";
  caption = document.createElement("p");
  caption.className = "previa-pedra__legenda";
  wrap.append(modosEl, canvas, caption);
  host.append(wrap);
  ligarTeclado();
  ligarCanvas();
  pedirDesenho();
}

/** @param {string} id */
export function atualizarPreviewPedra(id) {
  biomaId = id || "";
  pedirDesenho();
}
