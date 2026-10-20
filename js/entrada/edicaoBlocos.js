/**
 * Input de edição de blocos e de ataque no Pokémon sob o cursor.
 */
import { obterModo } from "../modoJogo.js";
import { estaEmCena } from "../cena/modoCena.js";
import { alvoBloco2d, alvoBloco3dCursor } from "../mundo/voxel/alvoBloco.js";
import { ALCANCE_MIRA, ESCALA, FACE_H, TILE } from "../config.js";
import { obterVisaoCaverna2d } from "../render/visaoCaverna2d.js";
import { invalidarHoverBloco } from "./hoverBloco.js";
import { raioDoPonteiro } from "../render/3d/camera3d.js";
import { ponteiroTravado } from "./ponteiro3d.js";
import { abrirMenuCampo } from "../campo/menu.js";
import { tentarAtaqueNoClique } from "../pokemon/clique.js";
import { definirSegurarBola, definirMiraCursor } from "../pokemon/captura.js";
import { usarNoClique } from "../jogo/campo.js";
import { estado, hotbarAtivo, uiAberta } from "../jogo/estado.js";
import { atualizarLeve, pintar } from "../jogo/ui.js";
import { TIPO_ITEM } from "../wild/catalogo.js";

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

function pontoNoChao(raio, z) {
  const dz = raio.dz;
  if (Math.abs(dz) < 1e-4) return { x: raio.ox + raio.dx * 12, y: raio.oy + raio.dy * 12 };
  const t = (z - raio.oz) / dz;
  if (!Number.isFinite(t)) return { x: raio.ox, y: raio.oy };
  return { x: raio.ox + raio.dx * t, y: raio.oy + raio.dy * t };
}

function dispararItem(corpo, celula, alvo, mira) {
  if (uiAberta()) return;
  const item = hotbarAtivo();
  if (item?.tipo === TIPO_ITEM.BOLA) {
    definirSegurarBola(true, mira.x, mira.y);
    return;
  }
  const msg = usarNoClique(corpo, celula, alvo);
  if (msg) estado.itemGet = msg;
  if (estado.construir) pintar();
  else if (msg) atualizarLeve();
  invalidarHoverBloco();
}

function aoMouseUp() {
  definirSegurarBola(false);
}

function aoMove2d(ev) {
  if (obterModo() !== "2d" || !canvas2d) return;
  const camera = obterCamera2d();
  if (!camera) return;
  const { mx, my } = telaParaMundo2d(ev.clientX, ev.clientY, camera, canvas2d);
  definirMiraCursor(mx, my);
}

function aoMove3d(ev) {
  if (obterModo() !== "3d" || estaEmCena() || !canvas3d) return;
  const corpo = obterCorpo();
  const cen = obterCenario3d();
  if (!corpo || !cen?.camera3d) return;
  const { ndcX, ndcY } = ndcDoEvento(ev, canvas3d);
  const raio = raioDoPonteiro(cen.camera3d, ndcX, ndcY);
  const chao = pontoNoChao(raio, corpo.z ?? 0);
  definirMiraCursor(chao.x, chao.y);
}

function aoMouseDown2d(ev) {
  if (obterModo() !== "2d" || ev.button !== 0) return;
  const corpo = obterCorpo();
  const camera = obterCamera2d();
  if (!corpo || !camera || !canvas2d || uiAberta()) return;
  if (tentarAtaqueNoClique(ev, camera, obterCenario3d())) {
    ev.preventDefault();
    return;
  }
  const { mx, my } = telaParaMundo2d(ev.clientX, ev.clientY, camera, canvas2d);
  const visao = obterVisaoCaverna2d(corpo);
  const alvo = alvoBloco2d(Math.floor(mx), Math.floor(my), visao ? visao.teto : undefined);
  ev.preventDefault();
  dispararItem(corpo, { x: Math.floor(mx), y: Math.floor(my) }, alvo, { x: mx, y: my });
}

function aoMouseDown3d(ev) {
  if (obterModo() !== "3d" || estaEmCena() || ev.button !== 0) return;
  const corpo = obterCorpo();
  const cen = obterCenario3d();
  if (!corpo || !cen?.camera3d || !canvas3d || uiAberta()) return;
  if (tentarAtaqueNoClique(ev, null, cen)) {
    ev.preventDefault();
    return;
  }
  const { ndcX, ndcY } = ndcDoEvento(ev, canvas3d);
  // Mira longa como o hover; o alcance de ação é do player (emAlcanceEdicao).
  const alvo = alvoBloco3dCursor(cen.camera3d, ndcX, ndcY, ALCANCE_MIRA);
  const raio = raioDoPonteiro(cen.camera3d, ndcX, ndcY);
  const chao = pontoNoChao(raio, corpo.z ?? 0);
  const celula = alvo ? { x: alvo.x, y: alvo.y } : { x: Math.floor(chao.x), y: Math.floor(chao.y) };
  ev.preventDefault();
  dispararItem(corpo, celula, alvo, chao);
}

function mundoDoClique(ev) {
  if (ev.currentTarget === canvas3d && canvas3d) {
    const corpo = obterCorpo();
    const cen = obterCenario3d();
    if (!corpo || !cen?.camera3d) return null;
    const { ndcX, ndcY } = ndcDoEvento(ev, canvas3d);
    const raio = raioDoPonteiro(cen.camera3d, ndcX, ndcY);
    return pontoNoChao(raio, corpo.z ?? 0);
  }
  const camera = obterCamera2d();
  if (!camera || !canvas2d) return null;
  const { mx, my } = telaParaMundo2d(ev.clientX, ev.clientY, camera, canvas2d);
  return { x: mx, y: my };
}

function aoContextMenu(ev) {
  ev.preventDefault();
  if (ponteiroTravado() || uiAberta() || estaEmCena()) return;
  const corpo = obterCorpo();
  const mundo = mundoDoClique(ev);
  if (!corpo || !mundo) return;
  abrirMenuCampo(ev.clientX, ev.clientY, mundo.x, mundo.y, corpo);
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
  canvas2d.addEventListener("pointermove", aoMove2d);
  canvas3d.addEventListener("pointermove", aoMove3d);
  window.addEventListener("mouseup", aoMouseUp);
  canvas2d.addEventListener("contextmenu", aoContextMenu);
  canvas3d.addEventListener("contextmenu", aoContextMenu);
}

export function desligarEdicaoBlocos() {
  if (!ligado) return;
  canvas2d?.removeEventListener("mousedown", aoMouseDown2d);
  canvas3d?.removeEventListener("mousedown", aoMouseDown3d);
  canvas2d?.removeEventListener("pointermove", aoMove2d);
  canvas3d?.removeEventListener("pointermove", aoMove3d);
  window.removeEventListener("mouseup", aoMouseUp);
  canvas2d?.removeEventListener("contextmenu", aoContextMenu);
  canvas3d?.removeEventListener("contextmenu", aoContextMenu);
  ligado = false;
}
