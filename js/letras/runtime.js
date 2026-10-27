/**
 * Encaixe de pedra solta no buraco + conclusão do puzzle.
 */
import { LETRA_ALCANCE_ENCAIXE, LETRA_BURACOS } from "./catalogo.js";
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

export function ehPedraLetra(prop) {
  return !!(prop && prop.letterPuzzle);
}

export function ehPedraLetraSolta(prop) {
  return ehPedraLetra(prop) && !!prop.letterPuzzleLoose;
}

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
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
    reindexarEm(p.x, p.y);
  }
}

/**
 * Após soltar/arremessar: tenta snap num buraco aberto.
 * @param {object} prop
 * @returns {boolean} true se encaixou
 */
export function tentarEncaixarPedraLetra(prop) {
  if (!ehPedraLetraSolta(prop)) return false;
  if (letraResolvida(prop.letterPuzzleId)) return false;
  const abertos = buracosAbertos(prop);
  if (!abertos.length) return false;

  let best = null;
  let bestD = LETRA_ALCANCE_ENCAIXE;
  for (let i = 0; i < abertos.length; i++) {
    const h = abertos[i];
    const d = Math.hypot(prop.x - h.x, prop.y - h.y);
    if (d <= bestD) {
      bestD = d;
      best = h;
    }
  }
  if (!best) return false;

  const ox = prop.x;
  const oy = prop.y;
  prop.x = best.x;
  prop.y = best.y;
  prop.z = alturaDoRelevo(best.x, best.y) || prop.z || 0;
  prop.letterHoleX = best.x;
  prop.letterHoleY = best.y;
  prop.letterCellX = best.cellX;
  prop.letterCellY = best.cellY;
  prop.letterPuzzleLoose = false;
  marcarBuracoPreenchido(prop.letterPuzzleId, best.cellX, best.cellY);
  reindexarEm(ox, oy);
  reindexarEm(prop.x, prop.y);

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
  return true;
}

/**
 * Chebyshev legado (tile) — útil pra debug/teleporte perto.
 */
export function pedraPertoDoBuraco(prop, hole) {
  if (!prop || !hole) return false;
  return chebyshev(prop.x, prop.y, hole.x, hole.y) <= LETRA_ALCANCE_ENCAIXE;
}
