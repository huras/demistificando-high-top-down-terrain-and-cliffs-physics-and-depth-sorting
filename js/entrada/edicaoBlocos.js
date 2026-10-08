/**
 * Input de edição de blocos (2D mouse + 3D click com pointer lock).
 */
import { obterModo } from "../modoJogo.js";
import { alvoBloco2d, alvoBloco3d } from "../mundo/voxel/alvoBloco.js";
import { colocarBloco, quebrarBloco } from "../mundo/voxel/editar.js";
import { ESCALA, FACE_H, TILE } from "../config.js";
import { obterVisaoCaverna2d } from "../render/visaoCaverna2d.js";
import { invalidarHoverBloco } from "./hoverBloco.js";
import { ponteiroTravado } from "./ponteiro3d.js";

let canvas2d = null;
let canvas3d = null;
let obterCorpo = () => null;
let obterCamera2d = () => null;
let obterCenario3d = () => null;
let ligado = false;

function telaParaMundo2d(clientX, clientY, camera, canvas) {
  const rect = canvas.getBoundingClientRect();
  const sx = ((clientX - rect.left) / rect.width) * canvas.width;
  const sy = ((clientY - rect.top) / rect.height) * canvas.height;
  const mx = (sx / camera.zoom + camera.x) / (TILE * ESCALA);
  // screenY = (y*TILE - z*FACE_H) * ESCALA → y aproximado no chão z≈corpo
  const corpo = obterCorpo();
  const z = corpo?.z ?? 1;
  const my =
    (sy / camera.zoom + camera.y) / (TILE * ESCALA) + (z * FACE_H) / TILE;
  return { mx, my };
}

function aoMouseDown2d(ev) {
  if (obterModo() !== "2d") return;
  if (ev.button !== 0 && ev.button !== 2) return;
  const corpo = obterCorpo();
  const camera = obterCamera2d();
  if (!corpo || !camera || !canvas2d) return;

  const { mx, my } = telaParaMundo2d(ev.clientX, ev.clientY, camera, canvas2d);
  const cx = Math.floor(mx);
  const cy = Math.floor(my);
  const visao = obterVisaoCaverna2d(corpo);
  const alvo = alvoBloco2d(cx, cy, visao ? visao.teto : undefined);
  if (!alvo) return;

  ev.preventDefault();
  if (ev.button === 0) quebrarBloco(corpo, alvo);
  else colocarBloco(corpo, alvo);
  invalidarHoverBloco();
}

function aoMouseDown3d(ev) {
  if (obterModo() !== "3d") return;
  if (!ponteiroTravado()) return;
  if (ev.button !== 0 && ev.button !== 2) return;
  const corpo = obterCorpo();
  const cen = obterCenario3d();
  if (!corpo || !cen?.camera3d) return;

  const alvo = alvoBloco3d(corpo, cen.camera3d);
  if (!alvo) return;

  ev.preventDefault();
  if (ev.button === 0) quebrarBloco(corpo, alvo);
  else colocarBloco(corpo, { ...alvo });
  invalidarHoverBloco();
}

function aoContextMenu(ev) {
  if (obterModo() === "2d" || (obterModo() === "3d" && ponteiroTravado())) {
    ev.preventDefault();
  }
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
export function ligarEdicaoBlocos(opts) {
  if (ligado) return;
  canvas2d = opts.canvas2d;
  canvas3d = opts.canvas3d;
  obterCorpo = opts.obterCorpo;
  obterCamera2d = opts.obterCamera2d;
  obterCenario3d = opts.obterCenario3d;
  ligado = true;

  canvas2d.addEventListener("mousedown", aoMouseDown2d);
  canvas3d.addEventListener("mousedown", aoMouseDown3d);
  canvas2d.addEventListener("contextmenu", aoContextMenu);
  canvas3d.addEventListener("contextmenu", aoContextMenu);
}

export function desligarEdicaoBlocos() {
  if (!ligado) return;
  canvas2d?.removeEventListener("mousedown", aoMouseDown2d);
  canvas3d?.removeEventListener("mousedown", aoMouseDown3d);
  canvas2d?.removeEventListener("contextmenu", aoContextMenu);
  canvas3d?.removeEventListener("contextmenu", aoContextMenu);
  ligado = false;
}
