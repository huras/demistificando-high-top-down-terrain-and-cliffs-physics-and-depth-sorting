/**
 * Hover de bloco — pick barato (dirty + cache sem alloc).
 */
import { ESCALA, FACE_H, TILE } from "../config.js";
import { obterModo } from "../modoJogo.js";
import { estaEmCena } from "../cena/modoCena.js";
import { alvoBloco2d, alvoBloco3dCursor } from "../mundo/voxel/alvoBloco.js";
import { nomeBloco } from "../mundo/voxel/tiposBloco.js";
import { obterVisaoCaverna2d } from "../render/visaoCaverna2d.js";

/** @type {{ x:number, y:number, z:number, id:number, nx:number, ny:number, nz:number } | null} */
let hover = null;
let hoverKey = "";
let hoverTexto = "";

let clientX = 0;
let clientY = 0;
let ponteiroDentro = false;
let sujo = true;

let canvas2d = null;
let canvas3d = null;
let obterCorpo = () => null;
let obterCamera2d = () => null;
let obterCenario3d = () => null;
let ligado = false;

function marcarSujo() {
  sujo = true;
}

function aoMove(ev) {
  clientX = ev.clientX;
  clientY = ev.clientY;
  ponteiroDentro = true;
  marcarSujo();
}

function aoLeave() {
  ponteiroDentro = false;
  marcarSujo();
}

function telaParaMundo2d(camera, canvas, corpo) {
  const rect = canvas.getBoundingClientRect();
  const sx = ((clientX - rect.left) / rect.width) * canvas.width;
  const sy = ((clientY - rect.top) / rect.height) * canvas.height;
  const mx = (sx / camera.zoom + camera.x) / (TILE * ESCALA);
  const z = corpo?.z ?? 1;
  const my =
    (sy / camera.zoom + camera.y) / (TILE * ESCALA) + (z * FACE_H) / TILE;
  return { mx, my };
}

function ndcDoCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  return { ndcX: u * 2 - 1, ndcY: -(v * 2 - 1) };
}

function aplicarHover(alvo) {
  if (!alvo) {
    if (hoverKey === "") return false;
    hover = null;
    hoverKey = "";
    hoverTexto = "";
    return true;
  }
  const k = alvo.x + "," + alvo.y + "," + alvo.z + "," + (alvo.id | 0);
  if (k === hoverKey) return false;
  // Reusa objeto pra não gerar GC no hot path
  if (!hover) hover = { x: 0, y: 0, z: 0, id: 0, nx: 0, ny: 0, nz: 0 };
  hover.x = alvo.x;
  hover.y = alvo.y;
  hover.z = alvo.z;
  hover.id = alvo.id | 0;
  hover.nx = alvo.nx | 0;
  hover.ny = alvo.ny | 0;
  hover.nz = alvo.nz | 0;
  hoverKey = k;
  hoverTexto = `${alvo.x},${alvo.y},${alvo.z} · ${nomeBloco(alvo.id)}`;
  return true;
}

/**
 * Resolve o bloco sob o cursor. Barato: só re-pick se sujo ou câmera/corpo mudou célula.
 * @returns {typeof hover}
 */
export function atualizarHoverBloco() {
  const modo = obterModo();
  const corpo = obterCorpo();

  if (modo === "3d") {
    if (estaEmCena() || !ponteiroDentro || !corpo || !canvas3d) {
      aplicarHover(null);
      sujo = false;
      return hover;
    }
    const cen = obterCenario3d();
    if (!cen?.camera3d) {
      aplicarHover(null);
      sujo = false;
      return hover;
    }
    const { ndcX, ndcY } = ndcDoCanvas(canvas3d);
    aplicarHover(alvoBloco3dCursor(cen.camera3d, ndcX, ndcY));
    sujo = false;
    return hover;
  }

  if (!ponteiroDentro || !corpo || !canvas2d) {
    aplicarHover(null);
    sujo = false;
    return hover;
  }

  const camera = obterCamera2d();
  if (!camera) {
    aplicarHover(null);
    sujo = false;
    return hover;
  }

  // Pick todo frame: coluna ≤64 é barato e a câmera se move com o player.
  const { mx, my } = telaParaMundo2d(camera, canvas2d, corpo);
  const cx = Math.floor(mx);
  const cy = Math.floor(my);
  const visao = obterVisaoCaverna2d(corpo);
  const zMax = visao ? visao.teto : undefined;
  const alvo = alvoBloco2d(cx, cy, zMax);
  aplicarHover(alvo);
  sujo = false;
  return hover;
}

/** Força re-pick no próximo frame (ex.: após editar bloco). */
export function invalidarHoverBloco() {
  marcarSujo();
}

export function obterHoverBloco() {
  return hover;
}

export function textoHoverBloco() {
  return hoverTexto;
}

/**
 * @param {{
 *   canvas2d: HTMLCanvasElement,
 *   canvas3d: HTMLCanvasElement,
 *   obterCorpo: () => object,
 *   obterCamera2d: () => object,
 *   obterCenario3d: () => object,
 * }} opts
 */
export function ligarHoverBloco(opts) {
  if (ligado) return;
  canvas2d = opts.canvas2d;
  canvas3d = opts.canvas3d;
  obterCorpo = opts.obterCorpo;
  obterCamera2d = opts.obterCamera2d;
  obterCenario3d = opts.obterCenario3d;
  ligado = true;

  const optsMove = { passive: true };
  canvas2d.addEventListener("pointermove", aoMove, optsMove);
  canvas2d.addEventListener("pointerenter", aoMove, optsMove);
  canvas2d.addEventListener("pointerleave", aoLeave, optsMove);
  canvas3d.addEventListener("pointermove", aoMove, optsMove);
  canvas3d.addEventListener("pointerenter", aoMove, optsMove);
  canvas3d.addEventListener("pointerleave", aoLeave, optsMove);
}

export function desligarHoverBloco() {
  if (!ligado) return;
  canvas2d?.removeEventListener("pointermove", aoMove);
  canvas2d?.removeEventListener("pointerenter", aoMove);
  canvas2d?.removeEventListener("pointerleave", aoLeave);
  canvas3d?.removeEventListener("pointermove", aoMove);
  canvas3d?.removeEventListener("pointerenter", aoMove);
  canvas3d?.removeEventListener("pointerleave", aoLeave);
  ligado = false;
  hover = null;
  hoverKey = "";
  hoverTexto = "";
}
