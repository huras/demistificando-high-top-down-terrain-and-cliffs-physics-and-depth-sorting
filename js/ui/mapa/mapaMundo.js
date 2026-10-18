/**
 * Mapa de Kanto em tela cheia. M abre e fecha. Arraste, scroll e o zoom
 * trocam o quanto do ruído do terreno cabe na tela.
 */
import { EXTENSAO_KANTO, zonaNoMundo } from "../../mundo/regiao/grafoKanto.js";
import { iniciarAtlas, tickAtlas, tickTiles } from "./atlas.js";
import { prepararMapa } from "./amostra.js";
import { pintarMapa } from "./pintar.js";

const ZOOM_MAX = 3.2;

let raiz = null;
let tela = null;
let titulo = null;
let aberto = false;
let cx = 0;
let cy = 0;
let zoom = 0.55;
let zoomAlvo = 0.55;
let ancora = null;
let arraste = null;
let dpr = 1;

export function mapaAberto() {
  return aberto;
}

function zoomMinimo() {
  if (!tela) return 0.12;
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  return (Math.min(cssW, cssH) / EXTENSAO_KANTO) * 0.92;
}

function travar() {
  const m = 280;
  if (cx < -m) cx = -m;
  else if (cx > EXTENSAO_KANTO + m) cx = EXTENSAO_KANTO + m;
  if (cy < -m) cy = -m;
  else if (cy > EXTENSAO_KANTO + m) cy = EXTENSAO_KANTO + m;
}

function ajustarTela() {
  const rect = tela.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.floor(rect.width * dpr));
  const h = Math.max(2, Math.floor(rect.height * dpr));
  if (tela.width !== w || tela.height !== h) {
    tela.width = w;
    tela.height = h;
  }
}

function definirZoom(alvo, sx, sy) {
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  const wx = cx + (sx - cssW / 2) / zoom;
  const wy = cy + (sy - cssH / 2) / zoom;
  zoomAlvo = Math.max(zoomMinimo(), Math.min(ZOOM_MAX, alvo));
  ancora = { wx, wy, sx, sy };
}

export function zoomMapa(fator) {
  if (!aberto || !tela) return;
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  definirZoom(zoomAlvo * fator, cssW / 2, cssH / 2);
}

export function abrirMapa(x, y) {
  if (!raiz) return;
  cx = x;
  cy = y;
  aberto = true;
  raiz.hidden = false;
}

export function fecharMapa() {
  if (!raiz) return;
  aberto = false;
  ancora = null;
  arraste = null;
  tela?.classList.remove("mapa-mundo__tela--arraste");
  raiz.hidden = true;
}

export function ligarMapaMundo() {
  raiz = document.getElementById("mapa-mundo");
  tela = document.getElementById("mapa-mundo-tela");
  titulo = document.getElementById("mapa-mundo-titulo");
  if (!raiz || !tela) return;
  prepararMapa();
  iniciarAtlas();

  tela.addEventListener("pointerdown", (ev) => {
    if (!aberto) return;
    tela.setPointerCapture(ev.pointerId);
    arraste = { x: ev.clientX, y: ev.clientY, cx, cy };
    ancora = null;
    tela.classList.add("mapa-mundo__tela--arraste");
  });
  tela.addEventListener("pointermove", (ev) => {
    if (!arraste) return;
    cx = arraste.cx - (ev.clientX - arraste.x) / zoom;
    cy = arraste.cy - (ev.clientY - arraste.y) / zoom;
    travar();
  });
  const soltar = () => {
    arraste = null;
    tela.classList.remove("mapa-mundo__tela--arraste");
  };
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);
  tela.addEventListener(
    "wheel",
    (ev) => {
      if (!aberto) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = tela.getBoundingClientRect();
      const fator = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      definirZoom(zoomAlvo * fator, ev.clientX - rect.left, ev.clientY - rect.top);
    },
    { passive: false },
  );
  window.addEventListener("resize", () => {
    if (aberto) ajustarTela();
  });
}

export function tickMapaMundo(px, py) {
  tickAtlas();
  if (!aberto || !tela) return;
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  if (Math.abs(zoomAlvo - zoom) > 0.0008) {
    zoom += (zoomAlvo - zoom) * 0.28;
    if (ancora) {
      cx = ancora.wx - (ancora.sx - cssW / 2) / zoom;
      cy = ancora.wy - (ancora.sy - cssH / 2) / zoom;
    }
  } else {
    zoom = zoomAlvo;
    ancora = null;
  }
  travar();
  const meioW = cssW / (2 * zoom);
  const meioH = cssH / (2 * zoom);
  tickTiles(cx, cy, zoom, cx - meioW, cy - meioH, cx + meioW, cy + meioH);
  const ctx = tela.getContext("2d");
  pintarMapa(ctx, tela.width, tela.height, dpr, {
    cx,
    cy,
    zoom,
    jogadorX: px,
    jogadorY: py,
    agora: performance.now(),
  });
  if (titulo) {
    const zona = zonaNoMundo(px, py);
    const nome = zona?.nome || "Kanto";
    if (titulo.textContent !== nome) titulo.textContent = nome;
  }
}
