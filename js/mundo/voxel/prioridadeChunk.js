/**
 * Score compartilhado de stream e malha (menor = mais urgente).
 */
import {
  PRIORIDADE_BOOST_TELA,
  PRIORIDADE_LIMIAR_ADIAR,
  PRIORIDADE_LIMIAR_PREEMPT,
  PRIORIDADE_PESO_DIR,
} from "../../config.js";
import { chunkNaTela } from "../../render/3d/frustumChao.js";

/** @type {null | {
 *   px: number, py: number, pcx: number, pcy: number,
 *   predX: number, predY: number, predLen: number,
 *   aabbTela: null | {x0:number,y0:number,x1:number,y1:number}
 * }} */
let ctx = null;

export function definirContextoPrioridade(novo) {
  ctx = novo || null;
}

export function obterContextoPrioridade() {
  return ctx;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {typeof ctx} [c]
 */
export function scoreChunk(cx, cy, c = ctx) {
  const pcx = c?.pcx ?? 0;
  const pcy = c?.pcy ?? 0;
  const dx = cx - pcx;
  const dy = cy - pcy;
  const d = dx * dx + dy * dy;
  if (!c) return d;
  let score = d;

  const naTela = chunkNaTela(cx, cy, c.aabbTela);
  if (naTela) score -= PRIORIDADE_BOOST_TELA;

  const len = Math.hypot(dx, dy);
  if (len > 0.01 && c.predLen > 0.05) {
    const align = (dx / len) * c.predX + (dy / len) * c.predY;
    score -= align * PRIORIDADE_PESO_DIR;
    // Atrás + longe + fora da tela: penalidade pra cair no fim da fila.
    if (!naTela && align < -0.15 && d > 2) {
      score += PRIORIDADE_PESO_DIR * 0.85;
    }
  } else if (len > 0.01) {
    const align = (dx / len) * c.predX + (dy / len) * c.predY;
    score -= align * (PRIORIDADE_PESO_DIR * 0.35);
  }

  return score;
}

/** True se o candidato pode esperar enquanto há itens mais urgentes. */
export function podeAdiar(cx, cy, temUrgente, c = ctx) {
  if (!temUrgente || !c) return false;
  const s = scoreChunk(cx, cy, c);
  if (s < PRIORIDADE_LIMIAR_ADIAR) return false;
  if (chunkNaTela(cx, cy, c.aabbTela)) return false;
  const dx = cx - c.pcx;
  const dy = cy - c.pcy;
  const len = Math.hypot(dx, dy) || 1;
  const align = (dx / len) * c.predX + (dy / len) * c.predY;
  return align < -0.1 && dx * dx + dy * dy > 2;
}

export function devePreemptar(scoreAtual, scoreMelhor) {
  return scoreMelhor + PRIORIDADE_LIMIAR_PREEMPT < scoreAtual;
}

/** Ordena in-place: grupo (0 antes) depois score. */
export function ordenarPorPrioridade(lista, c = ctx) {
  if (!lista || lista.length < 2) return lista;
  if (!c) {
    lista.sort((a, b) => {
      const ga = a.grupo | 0;
      const gb = b.grupo | 0;
      if (ga !== gb) return ga - gb;
      const da = a.d != null ? a.d : 0;
      const db = b.d != null ? b.d : 0;
      return da - db || a.cx - b.cx || a.cy - b.cy;
    });
    return lista;
  }
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    item.score = scoreChunk(item.cx, item.cy, c);
  }
  lista.sort((a, b) => {
    const ga = a.grupo | 0;
    const gb = b.grupo | 0;
    if (ga !== gb) return ga - gb;
    return a.score - b.score;
  });
  return lista;
}

/** Índice do melhor item a partir de `inicio` (respeita adiar). */
export function indiceProximoUrgente(lista, inicio, c = ctx) {
  if (!lista || inicio >= lista.length) return -1;
  let primeiro = -1;
  let temUrgente = false;
  for (let i = inicio; i < lista.length; i++) {
    const it = lista[i];
    const s = it.score ?? scoreChunk(it.cx, it.cy, c);
    if (s < PRIORIDADE_LIMIAR_ADIAR || chunkNaTela(it.cx, it.cy, c?.aabbTela)) {
      temUrgente = true;
      break;
    }
  }
  for (let i = inicio; i < lista.length; i++) {
    const it = lista[i];
    if (primeiro < 0) primeiro = i;
    if (!podeAdiar(it.cx, it.cy, temUrgente, c)) return i;
  }
  return primeiro;
}
