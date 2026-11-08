/**
 * Encaixe de pedra solta no buraco + conclusão do puzzle.
 * Snap vira tween ease-out (LETRA_ENCAIXE_MS).
 */
import {
  LETRA_ALCANCE_ENCAIXE,
  LETRA_BURACOS,
  LETRA_ENCAIXE_MS,
} from "./catalogo.js";
import {
  buracoPreenchido,
  contarBuracosPreenchidos,
  letraResolvida,
  marcarBuracoPreenchido,
  marcarLetraResolvida,
} from "./estado.js";
import { estado, avisar } from "../jogo/estado.js";
import { t } from "../jogo/i18n.js";
import { alturaDoRelevo } from "../mundo/bioma/catalogo.js";
import { reindexarEm, todaVegetacao } from "../mundo/bioma/propsBioma.js";

/** @type {object[]} */
const encaixesAtivos = [];

export function ehPedraLetra(prop) {
  return !!(prop && prop.letterPuzzle);
}

export function ehPedraLetraSolta(prop) {
  return ehPedraLetra(prop) && !!prop.letterPuzzleLoose;
}

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function easeOutCubic(t) {
  const x = 1 - Math.max(0, Math.min(1, t));
  return 1 - x * x * x;
}

/**
 * @param {object} prop
 * @returns {{ x: number, y: number, cellX: number, cellY: number }[]}
 */
function buracosAbertos(prop) {
  const id = prop?.letterPuzzleId;
  const holes = prop?.letterPuzzleHoles;
  if (!id || !holes?.length) return [];
  const out = [];
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    if (buracoPreenchido(id, h.cellX, h.cellY)) continue;
    out.push(h);
  }
  return out;
}

/**
 * @param {object} prop
 * @param {number} ax
 * @param {number} ay
 * @param {number} [alcance]
 */
function acharBuracoMaisPerto(prop, ax, ay, alcance = LETRA_ALCANCE_ENCAIXE) {
  const abertos = buracosAbertos(prop);
  if (!abertos.length) return null;
  let best = null;
  let bestD = alcance;
  for (let i = 0; i < abertos.length; i++) {
    const h = abertos[i];
    const d = Math.hypot(ax - h.x, ay - h.y);
    if (d <= bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/** Some pedras soltas restantes quando o glifo fecha. */
function limparSoltasRestantes(puzzleId, keepProp) {
  const id = String(puzzleId || "");
  if (!id) return;
  const lista = todaVegetacao();
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    if (p === keepProp) continue;
    if (!p?.letterPuzzleLoose || p.letterPuzzleId !== id) continue;
    if (p.oculto) continue;
    p.oculto = true;
    p.letterPuzzleLoose = false;
    delete p.letterEncaixe;
    reindexarEm(p.x, p.y);
  }
}

function finalizarEncaixe(prop) {
  delete prop.letterEncaixe;
  const filled = contarBuracosPreenchidos(prop.letterPuzzleId);
  if (filled >= LETRA_BURACOS) {
    marcarLetraResolvida(prop.letterPuzzleId);
    limparSoltasRestantes(prop.letterPuzzleId, prop);
    const letra = prop.letter || "?";
    estado.itemGet = t("letras.resolvida", { letra });
    avisar();
  } else {
    estado.itemGet = t("letras.encaixe");
    avisar();
  }
}

/**
 * Inicia deslize suave até o buraco (reserva o slot já).
 * @param {object} prop
 * @param {{
 *   fromX?: number,
 *   fromY?: number,
 *   fromZ?: number,
 *   alcance?: number,
 * } | null} [opts]
 * @returns {boolean}
 */
export function iniciarEncaixePedraLetra(prop, opts = null) {
  if (!ehPedraLetra(prop)) return false;
  if (prop.letterEncaixe) return false;
  if (!prop.letterPuzzleLoose) return false;
  if (letraResolvida(prop.letterPuzzleId)) return false;

  const fromX = Number.isFinite(opts?.fromX) ? opts.fromX : prop.x;
  const fromY = Number.isFinite(opts?.fromY) ? opts.fromY : prop.y;
  const fromZ = Number.isFinite(opts?.fromZ)
    ? opts.fromZ
    : (prop.z ?? alturaDoRelevo(fromX, fromY)) || 0;
  const alcance = opts?.alcance > 0 ? opts.alcance : LETRA_ALCANCE_ENCAIXE;

  const best = acharBuracoMaisPerto(prop, fromX, fromY, alcance);
  if (!best) return false;

  const paraZ = alturaDoRelevo(best.x, best.y) || fromZ || 0;
  const ox = prop.x;
  const oy = prop.y;

  prop.x = fromX;
  prop.y = fromY;
  prop.z = fromZ;
  prop.forcaCarregado = false;
  prop.letterPuzzleLoose = false;
  prop.letterHoleX = best.x;
  prop.letterHoleY = best.y;
  prop.letterCellX = best.cellX;
  prop.letterCellY = best.cellY;
  marcarBuracoPreenchido(prop.letterPuzzleId, best.cellX, best.cellY);

  prop.letterEncaixe = {
    deX: fromX,
    deY: fromY,
    deZ: fromZ,
    paraX: best.x,
    paraY: best.y,
    paraZ,
    t: 0,
    dur: Math.max(0.08, LETRA_ENCAIXE_MS / 1000),
    ox,
    oy,
  };
  encaixesAtivos.push(prop);
  reindexarEm(ox, oy);
  reindexarEm(fromX, fromY);
  return true;
}

/**
 * API legada: inicia o encaixe suave (antes era snap instantâneo).
 * @param {object} prop
 * @returns {boolean}
 */
export function tentarEncaixarPedraLetra(prop) {
  return iniciarEncaixePedraLetra(prop);
}

/**
 * @param {number} dt
 */
export function tickEncaixeLetras(dt) {
  if (!encaixesAtivos.length) return;
  const passo = Math.min(0.05, Math.max(0, dt));
  for (let i = encaixesAtivos.length - 1; i >= 0; i--) {
    const prop = encaixesAtivos[i];
    const anim = prop?.letterEncaixe;
    if (!prop || !anim) {
      encaixesAtivos.splice(i, 1);
      continue;
    }
    anim.t += passo;
    const u = easeOutCubic(anim.t / anim.dur);
    const ox = prop.x;
    const oy = prop.y;
    prop.x = anim.deX + (anim.paraX - anim.deX) * u;
    prop.y = anim.deY + (anim.paraY - anim.deY) * u;
    prop.z = anim.deZ + (anim.paraZ - anim.deZ) * u;
    if (anim.t >= anim.dur) {
      prop.x = anim.paraX;
      prop.y = anim.paraY;
      prop.z = anim.paraZ;
      reindexarEm(ox, oy);
      reindexarEm(prop.x, prop.y);
      encaixesAtivos.splice(i, 1);
      finalizarEncaixe(prop);
    }
  }
}

/**
 * Chebyshev legado (tile) — útil pra debug/teleporte perto.
 */
export function pedraPertoDoBuraco(prop, hole) {
  if (!prop || !hole) return false;
  return chebyshev(prop.x, prop.y, hole.x, hole.y) <= LETRA_ALCANCE_ENCAIXE;
}

/**
 * Há buraco aberto no alcance de (x,y) para esta pedra?
 * @param {object} prop
 * @param {number} x
 * @param {number} y
 * @param {number} [alcance]
 */
export function temBuracoNoAlcance(prop, x, y, alcance = LETRA_ALCANCE_ENCAIXE) {
  if (!ehPedraLetraSolta(prop)) return false;
  if (letraResolvida(prop.letterPuzzleId)) return false;
  return !!acharBuracoMaisPerto(prop, x, y, alcance);
}
