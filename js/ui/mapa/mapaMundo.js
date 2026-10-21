/**
 * Mapa de Kanto em tela cheia. M abre e fecha. Arraste, scroll e o zoom
 * trocam o quanto do ruído do terreno cabe na tela.
 */
import { deLocalKanto } from "../../mundo/bounds.js";
import { AREA_KANTO, CENTRO_AREA, zonaNoMundo } from "../../mundo/regiao/grafoKanto.js";
import { estado } from "../../jogo/estado.js";
import { comecarSubida, prepararViagem, teleporteOcupado } from "../../jogo/teleporte.js";
import { iniciarAtlas, tickAtlas, tickTiles } from "./atlas.js";
import { LADO_MUNDO } from "./grade.js";
import { tickIntimo } from "./intimo.js";
import { cidadesDoMapa } from "./marcas.js";
import { pintarMapa } from "./pintar.js";

const ZOOM_MAX = 8;

let raiz = null;
let tela = null;
let titulo = null;
let confirmEl = null;
let confirmTxt = null;
let aberto = false;
let cx = 0;
let cy = 0;
let zoom = 0.55;
let zoomAlvo = 0.55;
let ancora = null;
let arraste = null;
let dpr = 1;
let jogadorX = 0;
let jogadorY = 0;
let viagem = null;
let pendente = null;
let calorForca = false;
let botaoCalor = null;

const RAIO_CIDADE = 22;
const ZOOM_VIAGEM = 1.15;

function sincronizarBotaoCalor() {
  if (!botaoCalor) return;
  botaoCalor.setAttribute("aria-pressed", calorForca ? "true" : "false");
  botaoCalor.classList.toggle("is-ativo", calorForca);
}

export function mapaAberto() {
  return aberto;
}

export function mapaViajando() {
  return !!viagem;
}

function zoomMinimo() {
  if (!tela) return 0.12;
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  return (Math.min(cssW, cssH) / LADO_MUNDO) * 0.92;
}

function travar() {
  const m = 280;
  if (cx < -m) cx = -m;
  else if (cx > LADO_MUNDO + m) cx = LADO_MUNDO + m;
  if (cy < -m) cy = -m;
  else if (cy > LADO_MUNDO + m) cy = LADO_MUNDO + m;
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

function mesmaCidade(cidade) {
  if (!Number.isFinite(cidade.ax) || !Number.isFinite(cidade.ay)) {
    return Math.hypot(jogadorX - cidade.x, jogadorY - cidade.y) < 48;
  }
  if (estado.interior) {
    return estado.interior.ax === cidade.ax && estado.interior.ay === cidade.ay;
  }
  return ((jogadorX / AREA_KANTO) | 0) === cidade.ax && ((jogadorY / AREA_KANTO) | 0) === cidade.ay;
}

function cidadeNoPonto(clientX, clientY) {
  if (!tela || !aberto) return null;
  const rect = tela.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const cidades = cidadesDoMapa();
  let melhor = null;
  let melhorD = RAIO_CIDADE * RAIO_CIDADE;
  for (let i = 0; i < cidades.length; i++) {
    const cidade = cidades[i];
    const px = (cidade.x - cx) * zoom + rect.width / 2;
    const py = (cidade.y - cy) * zoom + rect.height / 2;
    const dx = sx - px;
    const dy = sy - py;
    const d = dx * dx + dy * dy;
    if (d <= melhorD) {
      melhorD = d;
      melhor = cidade;
    }
  }
  return melhor;
}

function apontarCidade(ev) {
  if (!tela || viagem || pendente) return;
  const cidade = cidadeNoPonto(ev.clientX, ev.clientY);
  const viaja = cidade && !mesmaCidade(cidade);
  tela.classList.toggle("mapa-mundo__tela--cidade", !!viaja);
}

function mostrarConfirmacao(cidade) {
  pendente = cidade;
  if (confirmTxt) confirmTxt.textContent = `Teleportar para ${cidade.nome}?`;
  if (confirmEl) confirmEl.hidden = false;
  tela?.classList.remove("mapa-mundo__tela--cidade");
}

function ocultarConfirmacao() {
  pendente = null;
  if (confirmEl) confirmEl.hidden = true;
  if (confirmTxt) confirmTxt.textContent = "";
}

export function cancelarConfirmacaoMapa() {
  if (!pendente) return false;
  ocultarConfirmacao();
  return true;
}

function iniciarViagem(cidade) {
  if (!cidade || viagem || teleporteOcupado()) return;
  prepararViagem(cidade);
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  zoomAlvo = Math.min(ZOOM_MAX, Math.max(ZOOM_VIAGEM, zoom * 1.8));
  ancora = { wx: cidade.x, wy: cidade.y, sx: cssW / 2, sy: cssH / 2 };
  arraste = null;
  tela.classList.remove("mapa-mundo__tela--arraste");
  tela.classList.remove("mapa-mundo__tela--cidade");
  ocultarConfirmacao();
  viagem = { cidade, t: 0 };
}

function escolherCidade(ev) {
  if (!aberto || viagem || pendente || teleporteOcupado()) return;
  const cidade = cidadeNoPonto(ev.clientX, ev.clientY);
  if (!cidade || mesmaCidade(cidade)) return;
  arraste = null;
  tela.classList.remove("mapa-mundo__tela--arraste");
  mostrarConfirmacao(cidade);
}

export function zoomMapa(fator) {
  if (!aberto || !tela || viagem) return;
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  definirZoom(zoomAlvo * fator, cssW / 2, cssH / 2);
}

export function abrirMapa(x, y) {
  if (!raiz) return;
  if (estado.interior && Number.isFinite(estado.interior.ax)) {
    const p = deLocalKanto(
      estado.interior.ax * AREA_KANTO + CENTRO_AREA + 0.5,
      estado.interior.ay * AREA_KANTO + CENTRO_AREA + 0.5,
    );
    x = p.x;
    y = p.y;
  }
  cx = x;
  cy = y;
  aberto = true;
  raiz.hidden = false;
  soltarFoco();
}

function soltarFoco() {
  const limpar = () => {
    const ativo = document.activeElement;
    if (!ativo || ativo === document.body || ativo === document.documentElement) return;
    const tag = ativo.tagName;
    if (
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA" ||
      tag === "BUTTON" ||
      raiz?.contains(ativo)
    ) {
      ativo.blur();
    }
  };
  limpar();
  requestAnimationFrame(limpar);
}

/** @type {(() => void) | null} */
let aoFecharMapaCb = null;

/** Callback após fechar (ex.: sair da aba Map do menu). */
export function aoFecharMapa(fn) {
  aoFecharMapaCb = typeof fn === "function" ? fn : null;
}

export function fecharMapa() {
  if (!raiz) return;
  const estavaAberto = aberto;
  aberto = false;
  ancora = null;
  arraste = null;
  ocultarConfirmacao();
  tela?.classList.remove("mapa-mundo__tela--arraste");
  tela?.classList.remove("mapa-mundo__tela--cidade");
  raiz.hidden = true;
  soltarFoco();
  if (estavaAberto) aoFecharMapaCb?.();
}

export function ligarMapaMundo() {
  raiz = document.getElementById("mapa-mundo");
  tela = document.getElementById("mapa-mundo-tela");
  titulo = document.getElementById("mapa-mundo-titulo");
  confirmEl = document.getElementById("mapa-mundo-confirm");
  confirmTxt = document.getElementById("mapa-mundo-confirm-txt");
  botaoCalor = document.getElementById("mapa-calor-forca");
  if (!raiz || !tela) return;
  iniciarAtlas();
  calorForca = false;
  sincronizarBotaoCalor();
  botaoCalor?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    calorForca = !calorForca;
    sincronizarBotaoCalor();
  });
  document.getElementById("mapa-confirm-ir")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (pendente) iniciarViagem(pendente);
  });
  document.getElementById("mapa-confirm-nao")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ocultarConfirmacao();
  });

  tela.addEventListener("pointerdown", (ev) => {
    if (!aberto || viagem) return;
    if (ev.button === 2) {
      ev.preventDefault();
      escolherCidade(ev);
      return;
    }
    if (ev.button !== 0 || pendente) return;
    tela.setPointerCapture(ev.pointerId);
    arraste = { x: ev.clientX, y: ev.clientY, cx, cy };
    ancora = null;
    tela.classList.add("mapa-mundo__tela--arraste");
  });
  tela.addEventListener("pointermove", (ev) => {
    if (!arraste) {
      apontarCidade(ev);
      return;
    }
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
  tela.addEventListener("contextmenu", (ev) => ev.preventDefault());
  tela.addEventListener(
    "wheel",
    (ev) => {
      if (!aberto) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (viagem || pendente) return;
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

export function tickMapaMundo(px, py, dt = 1 / 60) {
  try {
  tickAtlas();
  if (estado.interior && Number.isFinite(estado.interior.ax)) {
    const p = deLocalKanto(
      estado.interior.ax * AREA_KANTO + CENTRO_AREA + 0.5,
      estado.interior.ay * AREA_KANTO + CENTRO_AREA + 0.5,
    );
    px = p.x;
    py = p.y;
  }
  jogadorX = px;
  jogadorY = py;
  if (!aberto || !tela) return;
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  if (viagem) {
    viagem.t += Math.min(0.05, dt);
    zoom += (zoomAlvo - zoom) * 0.28;
    cx += (viagem.cidade.x - cx) * 0.28;
    cy += (viagem.cidade.y - cy) * 0.28;
    const perto =
      Math.abs(zoomAlvo - zoom) < 0.04 &&
      Math.hypot(viagem.cidade.x - cx, viagem.cidade.y - cy) < 8;
    if ((viagem.t >= 0.42 && perto) || viagem.t >= 0.85) {
      const cidade = viagem.cidade;
      viagem = null;
      fecharMapa();
      comecarSubida(cidade);
      return;
    }
  } else if (Math.abs(zoomAlvo - zoom) > 0.0008) {
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
  tickIntimo(cx, cy, zoom, cx - meioW, cy - meioH, cx + meioW, cy + meioH);
  const ctx = tela.getContext("2d");
  pintarMapa(ctx, tela.width, tela.height, dpr, {
    cx,
    cy,
    zoom,
    jogadorX: px,
    jogadorY: py,
    agora: performance.now(),
    calorForca,
  });
  if (titulo) {
    const zona = zonaNoMundo(px, py);
    const nome = zona?.nome || "Mundo";
    if (titulo.textContent !== nome) titulo.textContent = nome;
  }
  } catch (err) {
    console.error(err);
    viagem = null;
    ocultarConfirmacao();
    aberto = false;
    if (raiz) raiz.hidden = true;
  }
}
