/** Objetivo de missão sob o minimap (pill escura). */

import { estado } from "../estado.js";
import { objetivoQuadroAtivo } from "../../quests/runtime.js";
import { textoObjetivoAtivo } from "../../quests/textoMissao.js";

let root = null;
let assinatura = "";

export function montarObjetivoMissao(host) {
  root = host;
  return { sync: pintarObjetivo };
}

export function pintarObjetivo() {
  if (!root) return;

  const boardRec = objetivoQuadroAtivo();
  const boardTexto = boardRec ? textoObjetivoAtivo(boardRec) : null;
  if (boardTexto) {
    const sig = `board:${boardRec.posting.id}:${boardRec.escorting ? 1 : 0}`;
    if (sig === assinatura) {
      root.hidden = false;
      return;
    }
    assinatura = sig;
    root.hidden = false;
    root.innerHTML = `<div class="quest-objective" role="status">
    <span class="quest-objective__text">${esc(boardTexto)}</span>
  </div>`;
    return;
  }

  const ativa = (estado.quests || []).find((q) => !q.feita);
  if (!ativa) {
    if (assinatura !== "empty") {
      assinatura = "empty";
      root.hidden = true;
      root.innerHTML = "";
    }
    return;
  }
  const prog =
    ativa.meta > 0 ? ` (${ativa.progresso | 0}/${ativa.meta})` : "";
  const sig = `${ativa.id}:${ativa.progresso}|${ativa.feita ? 1 : 0}`;
  if (sig === assinatura) {
    root.hidden = false;
    return;
  }
  assinatura = sig;
  root.hidden = false;
  root.innerHTML = `<div class="quest-objective" role="status">
    <span class="quest-objective__text">${esc(ativa.texto)}${esc(prog)}</span>
  </div>`;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
