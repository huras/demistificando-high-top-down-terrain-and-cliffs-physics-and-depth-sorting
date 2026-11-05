/**
 * Mapa de habitat no detalhe da Pokédex: terreno assado + overlay de presença.
 * O frame só roda enquanto a vista está suja ou o zoom anima.
 */

import { posicaoCorpoHud } from "../../apiHud.js";
import { LADO_MUNDO } from "../../../mundo/bounds.js";
import { pintarMapa } from "../../../ui/mapa/pintar.js";
import { limitesDoBioma } from "./gradeBioma.js";
import { bakeDaEspecie, tintaDoBake } from "./overlay.js";

const ZOOM_MAX = 4;

/**
 * @typedef {import("./overlay.js").FiltroHabitat} FiltroHabitat
 * @typedef {{ x: number, y: number } | null} Ponto
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} Caixa
 */

function reduzido() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/**
 * @param {HTMLCanvasElement | null} canvas
 * @param {HTMLElement | null} wrap
 */
export function criarMapaHabitat(canvas, wrap) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return {
      mostrar() {},
      definirFiltros() {},
      focarLocal() {},
      pausar() {},
      retomar() {},
      destruir() {},
    };
  }

  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let cx = LADO_MUNDO / 2;
  let cy = LADO_MUNDO / 2;
  let zoom = 0.05;
  let zoomAlvo = 0.05;
  /** @type {{ wx: number, wy: number, sx: number, sy: number } | null} */
  let ancora = null;
  /** @type {string | null} */
  let chave = null;
  /** @type {FiltroHabitat} */
  let filtros = { casa: true, extra: true, santuario: true };
  /** @type {HTMLCanvasElement | null} */
  let overlay = null;
  /** @type {Ponto} */
  let santuario = null;
  /** @type {Caixa | null} */
  let bounds = null;
  let ativo = false;
  let querer = false;
  let sujo = false;
  let quadro = 0;
  let pedido = 0;
  let medidaZero = false;
  /** @type {{ x: number, y: number, cx: number, cy: number } | null} */
  let arraste = null;

  function cssTamanho() {
    return {
      w: canvas.width / dpr,
      h: canvas.height / dpr,
    };
  }

  function zoomMinimo() {
    const { w, h } = cssTamanho();
    if (w < 2 || h < 2) return 0.02;
    return (Math.min(w, h) / LADO_MUNDO) * 0.92;
  }

  function travar() {
    const m = 280;
    if (cx < -m) cx = -m;
    else if (cx > LADO_MUNDO + m) cx = LADO_MUNDO + m;
    if (cy < -m) cy = -m;
    else if (cy > LADO_MUNDO + m) cy = LADO_MUNDO + m;
  }

  function ajustarTela() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.floor((rect.width || 320) * dpr));
    const h = Math.max(2, Math.floor((rect.height || 220) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function definirZoom(alvo, sx, sy) {
    const { w, h } = cssTamanho();
    const proximo = Math.max(zoomMinimo(), Math.min(ZOOM_MAX, alvo));
    ancora = {
      wx: cx + (sx - w / 2) / zoom,
      wy: cy + (sy - h / 2) / zoom,
      sx,
      sy,
    };
    zoomAlvo = proximo;
    if (reduzido()) {
      zoom = zoomAlvo;
      cx = ancora.wx - (ancora.sx - w / 2) / zoom;
      cy = ancora.wy - (ancora.sy - h / 2) / zoom;
      ancora = null;
      travar();
    }
    pedirFrame();
  }

  function encaixar(caixa) {
    ajustarTela();
    const rect = canvas.getBoundingClientRect();
    medidaZero = rect.width < 8 || rect.height < 8;
    const { w, h } = cssTamanho();
    if (!caixa || w < 2 || h < 2) {
      cx = LADO_MUNDO / 2;
      cy = LADO_MUNDO / 2;
      zoom = zoomAlvo = zoomMinimo();
      return;
    }
    const bw = Math.max(384, caixa.x1 - caixa.x0);
    const bh = Math.max(384, caixa.y1 - caixa.y0);
    cx = (caixa.x0 + caixa.x1) / 2;
    cy = (caixa.y0 + caixa.y1) / 2;
    const z = Math.min(w / bw, h / bh) * 0.86;
    zoom = zoomAlvo = Math.max(zoomMinimo(), Math.min(ZOOM_MAX, z));
    travar();
  }

  function desenharPin(wx, wy, cor) {
    if (!ctx) return;
    const z = zoom * dpr;
    const sx = (wx - cx) * z + canvas.width / 2;
    const sy = (wy - cy) * z + canvas.height / 2;
    const r = Math.max(4, 5.5 * dpr);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, r + 2 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.restore();
  }

  function desenhar() {
    if (!ctx) return;
    ajustarTela();
    const corpo = posicaoCorpoHud();
    pintarMapa(ctx, canvas.width, canvas.height, dpr, {
      cx,
      cy,
      zoom,
      mini: false,
      habitat: true,
      calorForca: false,
      jornada: false,
      overlayHabitat: overlay,
      jogadorX: corpo.x,
      jogadorY: corpo.y,
      agora: performance.now(),
    });
    if (filtros.santuario && santuario) desenharPin(santuario.x, santuario.y, "#ef5350");
  }

  function passo() {
    quadro = 0;
    if (!ativo) return;
    const animando = Math.abs(zoomAlvo - zoom) > 0.001;
    if (animando) {
      zoom += (zoomAlvo - zoom) * 0.28;
      if (ancora) {
        const { w, h } = cssTamanho();
        cx = ancora.wx - (ancora.sx - w / 2) / zoom;
        cy = ancora.wy - (ancora.sy - h / 2) / zoom;
        travar();
      }
      if (Math.abs(zoomAlvo - zoom) <= 0.001) {
        zoom = zoomAlvo;
        ancora = null;
      }
    }
    if (sujo || animando) desenhar();
    sujo = false;
    if (animando && ativo) quadro = requestAnimationFrame(passo);
  }

  function pedirFrame() {
    sujo = true;
    if (!ativo || quadro) return;
    quadro = requestAnimationFrame(passo);
  }

  function onPointerDown(ev) {
    if (ev.button != null && ev.button !== 0) return;
    canvas.setPointerCapture?.(ev.pointerId);
    arraste = { x: ev.clientX, y: ev.clientY, cx, cy };
  }

  function onPointerMove(ev) {
    if (!arraste) return;
    cx = arraste.cx - (ev.clientX - arraste.x) / zoom;
    cy = arraste.cy - (ev.clientY - arraste.y) / zoom;
    travar();
    pedirFrame();
  }

  function onPointerUp() {
    arraste = null;
  }

  function onWheel(ev) {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const fator = ev.deltaY > 0 ? 0.9 : 1.11;
    definirZoom(zoomAlvo * fator, ev.clientX - rect.left, ev.clientY - rect.top);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const observador =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (!ativo) return;
          if (medidaZero) {
            const caixa =
              santuario && (!bounds || (!filtros.casa && !filtros.extra))
                ? {
                    x0: santuario.x - 900,
                    y0: santuario.y - 900,
                    x1: santuario.x + 900,
                    y1: santuario.y + 900,
                  }
                : bounds;
            encaixar(caixa);
          }
          pedirFrame();
        })
      : null;
  observador?.observe(canvas);

  return {
    /**
     * @param {string} speciesKey
     * @param {FiltroHabitat} filtrosNovos
     * @param {Ponto} pontoSantuario
     */
    async mostrar(speciesKey, filtrosNovos, pontoSantuario) {
      const id = ++pedido;
      chave = String(speciesKey || "");
      filtros = filtrosNovos;
      santuario = pontoSantuario;
      querer = true;
      wrap?.classList.add("is-loading");
      const item = await bakeDaEspecie(chave);
      if (id !== pedido || !querer) {
        if (id === pedido) wrap?.classList.remove("is-loading");
        return;
      }
      overlay = tintaDoBake(item, filtros);
      bounds = item.bounds;
      const caixa =
        santuario && (!bounds || (!filtros.casa && !filtros.extra))
          ? {
              x0: santuario.x - 900,
              y0: santuario.y - 900,
              x1: santuario.x + 900,
              y1: santuario.y + 900,
            }
          : bounds;
      encaixar(caixa);
      wrap?.classList.remove("is-loading");
      ativo = true;
      pedirFrame();
    },

    /**
     * @param {FiltroHabitat} filtrosNovos
     * @param {Ponto} pontoSantuario
     */
    async definirFiltros(filtrosNovos, pontoSantuario) {
      filtros = filtrosNovos;
      santuario = pontoSantuario;
      if (!chave) return;
      const item = await bakeDaEspecie(chave);
      overlay = tintaDoBake(item, filtros);
      if (ativo) pedirFrame();
    },

    /**
     * @param {{ wx?: number | null, wy?: number | null, biomaId?: string | null }} local
     */
    async focarLocal(local) {
      if (!ativo) return;
      if (Number.isFinite(local?.wx) && Number.isFinite(local?.wy)) {
        const raio = 720;
        encaixar({
          x0: local.wx - raio,
          y0: local.wy - raio,
          x1: local.wx + raio,
          y1: local.wy + raio,
        });
        pedirFrame();
        return;
      }
      if (!local?.biomaId) return;
      const caixa = await limitesDoBioma(local.biomaId);
      if (!caixa || !ativo) return;
      encaixar(caixa);
      pedirFrame();
    },

    pausar() {
      querer = false;
      ativo = false;
      arraste = null;
      if (quadro) cancelAnimationFrame(quadro);
      quadro = 0;
    },

    retomar() {
      if (!chave) return;
      querer = true;
      ativo = true;
      pedirFrame();
    },

    destruir() {
      querer = false;
      this.pausar();
      pedido += 1;
      chave = null;
      overlay = null;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      observador?.disconnect();
    },
  };
}

/**
 * Mini mapa estático centrado no santuário.
 * @param {HTMLCanvasElement | null} canvas
 * @param {number} wx
 * @param {number} wy
 */
export function pintarMiniSantuario(canvas, wx, wy) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const css = Math.max(96, rect.width || 136);
  canvas.width = Math.floor(css * dpr);
  canvas.height = Math.floor(css * dpr);
  const zoom = 0.42;
  const corpo = posicaoCorpoHud();
  pintarMapa(ctx, canvas.width, canvas.height, dpr, {
    cx: wx,
    cy: wy,
    zoom,
    mini: true,
    habitat: true,
    calorForca: false,
    jornada: false,
    jogadorX: corpo.x,
    jogadorY: corpo.y,
    agora: 0,
  });
  const sx = canvas.width / 2;
  const sy = canvas.height / 2;
  const r = Math.max(4, 5 * dpr);
  ctx.beginPath();
  ctx.arc(sx, sy, r + 2 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ef5350";
  ctx.fill();
}
