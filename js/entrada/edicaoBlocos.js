/**
 * Input de edição de blocos e de ataque no Pokémon sob o cursor.
 */
import { obterModo } from "../modoJogo.js";
import { estaEmCena } from "../cena/modoCena.js";
import { alvoBloco2d, alvoBloco3dCursor } from "../mundo/voxel/alvoBloco.js";
import { ESCALA, FACE_H, TILE } from "../config.js";
import { obterVisaoCaverna2d } from "../render/visaoCaverna2d.js";
import { invalidarHoverBloco } from "./hoverBloco.js";
import { tentarColocar, tentarQuebrar } from "../jogo/blocos.js";
import { uiAberta } from "../jogo/estado.js";
import { tentarAtaqueNoClique } from "../pokemon/clique.js";

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

function ndcDoEvento(ev, canvas) {
  const rect = canvas.getBoundingClientRect();
  const u = (ev.clientX - rect.left) / rect.width;
  const v = (ev.clientY - rect.top) / rect.height;
  return { ndcX: u * 2 - 1, ndcY: -(v * 2 - 1) };
}

function aoMouseDown2d(ev) {
  if (obterModo() !== "2d") return;
  if (ev.button !== 0 && ev.button !== 2) return;
  const corpo = obterCorpo();
  const camera = obterCamera2d();
  if (!corpo || !camera || !canvas2d) return;
  if (ev.button === 0 && tentarAtaqueNoClique(ev, camera, obterCenario3d())) {
    ev.preventDefault();
    return;
  }

  const { mx, my } = telaParaMundo2d(ev.clientX, ev.clientY, camera, canvas2d);
  const cx = Math.floor(mx);
  const cy = Math.floor(my);
  const visao = obterVisaoCaverna2d(corpo);
  const alvo = alvoBloco2d(cx, cy, visao ? visao.teto : undefined);
  if (!alvo) return;

  ev.preventDefault();
  if (uiAberta()) return;
  if (ev.button === 0) tentarQuebrar(corpo, alvo);
  else tentarColocar(corpo, alvo);
  invalidarHoverBloco();
}

function aoMouseDown3d(ev) {
  if (obterModo() !== "3d" || estaEmCena()) return;
  if (ev.button !== 0 && ev.button !== 2) return;
  const corpo = obterCorpo();
  const cen = obterCenario3d();
  if (!corpo || !cen?.camera3d || !canvas3d) return;
  if (uiAberta()) return;
  if (ev.button === 0 && tentarAtaqueNoClique(ev, null, cen)) {
    ev.preventDefault();
    return;
  }

  const { ndcX, ndcY } = ndcDoEvento(ev, canvas3d);
  const alvo = alvoBloco3dCursor(cen.camera3d, ndcX, ndcY);
  if (!alvo) return;

  ev.preventDefault();
  if (ev.button === 2) tentarColocar(corpo, alvo);
  else tentarQuebrar(corpo, alvo);
  invalidarHoverBloco();
}

function aoContextMenu(ev) {
  ev.preventDefault();
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
