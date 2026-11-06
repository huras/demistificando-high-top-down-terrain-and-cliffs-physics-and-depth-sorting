/** Sugestões rápidas de remédio/berry no card de combate (estilo Pokemon AI). */

import { BERRIES, REMEDIOS, TIPO_ITEM, defItem } from "../../wild/catalogo.js";
import { pokemonNoCampo } from "../../pokemon/party.js";
import { contar, nomeDe, remedioAjuda, usarNoPokemon } from "../estado.js";
import { htmlIcone } from "../icones.js";

const LIMITE = 6;
const TECLAS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"];

/** @type {HTMLElement | null} */
let wrapHost = null;
/** @type {WeakMap<HTMLElement, { ator: object | null, sugestoes: object[] }>} */
const pendingUpdates = new WeakMap();
/** @type {WeakSet<HTMLElement>} */
const hoverBound = new WeakSet();
let hotkeyLigado = false;
let leftCtrlHeld = false;
/** @type {((ator: object | null) => void) | null} */
let onAposUsar = null;

function berryDedicada(efeito) {
  if (!efeito) return false;
  if (efeito.cura || efeito.curaFrac || efeito.pp) return true;
  if ((efeito.curaHp | 0) >= 10) return true;
  return false;
}

function scoreItem(tipo, key, ator, def) {
  const efeito = def?.efeito;
  if (!efeito) return 0;
  let score = 0;
  if (efeito.reviver != null || efeito.reviverParty) score += 200;
  if (efeito.cura) score += 100;
  const faltando = Math.max(0, (ator.hpMax | 0) - Math.max(0, ator.hp | 0));
  if (efeito.curaFrac || (efeito.curaHp | 0) >= 10) {
    const healAmt = efeito.curaFrac
      ? Math.round((ator.hpMax | 0) * efeito.curaFrac)
      : efeito.curaHp | 0;
    score += Math.min(50, Math.min(faltando, healAmt || faltando));
  }
  if (efeito.pp && remedioAjuda(tipo, key, ator)) score += 20;
  return score;
}

/**
 * @param {object | null | undefined} ator
 * @returns {Array<{ tipo: string, key: string, count: number, def: object, score: number }>}
 */
export function listarSugestoesCampo(ator) {
  if (!ator || ator.capturado) return [];
  const noCampo = pokemonNoCampo();
  if (!noCampo || noCampo !== ator) return [];

  const desmaiado = !!(ator.morto || ator.hp <= 0);
  const out = [];

  for (const key of Object.keys(REMEDIOS)) {
    const count = contar(TIPO_ITEM.REMEDIO, key);
    if (count <= 0) continue;
    if (!remedioAjuda(TIPO_ITEM.REMEDIO, key, ator)) continue;
    const def = defItem(TIPO_ITEM.REMEDIO, key) || REMEDIOS[key];
    out.push({
      tipo: TIPO_ITEM.REMEDIO,
      key,
      count,
      def,
      score: scoreItem(TIPO_ITEM.REMEDIO, key, ator, def),
    });
  }

  if (!desmaiado) {
    for (const key of Object.keys(BERRIES)) {
      const def = BERRIES[key];
      const efeito = def?.efeito;
      if (!berryDedicada(efeito)) continue;
      const count = contar(TIPO_ITEM.BERRY, key);
      if (count <= 0) continue;
      if (!remedioAjuda(TIPO_ITEM.BERRY, key, ator)) continue;
      out.push({
        tipo: TIPO_ITEM.BERRY,
        key,
        count,
        def,
        score: scoreItem(TIPO_ITEM.BERRY, key, ator, def),
      });
    }
  }

  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.tipo !== b.tipo) {
      return a.tipo === TIPO_ITEM.REMEDIO ? -1 : 1;
    }
    return a.key.localeCompare(b.key);
  });
  return out.slice(0, LIMITE);
}

function wrapEmHover(wrap) {
  return (
    !!wrap &&
    !wrap.hidden &&
    typeof wrap.matches === "function" &&
    wrap.matches(":hover")
  );
}

function deferUpdate(wrap, ator, sugestoes) {
  pendingUpdates.set(wrap, { ator, sugestoes });
  if (hoverBound.has(wrap)) return;
  hoverBound.add(wrap);
  wrap.addEventListener("pointerleave", () => {
    const pending = pendingUpdates.get(wrap);
    if (!pending) return;
    pendingUpdates.delete(wrap);
    if (pending.sugestoes.length) {
      preencherWrap(wrap, pending.ator, pending.sugestoes, true);
    } else {
      limparWrap(wrap, true);
    }
  });
}

function limparWrap(wrap, force = false) {
  if (!wrap) return;
  if (!force && wrapEmHover(wrap)) {
    deferUpdate(wrap, null, []);
    return;
  }
  pendingUpdates.delete(wrap);
  wrap.hidden = true;
  if (wrap.childElementCount) wrap.replaceChildren();
  wrap.dataset.sig = "";
}

function montarIcone(key) {
  const tmp = document.createElement("div");
  tmp.innerHTML = htmlIcone(key, "hud__item-suggest-icon", 28);
  const el = tmp.firstElementChild;
  if (el) return el;
  const dot = document.createElement("span");
  dot.className = "hud__item-suggest-dot";
  dot.setAttribute("aria-hidden", "true");
  return dot;
}

function aplicarSugestao(ator, sugestao) {
  if (!ator || !sugestao) return false;
  const ok = usarNoPokemon(sugestao.tipo, sugestao.key, ator);
  if (!ok) return false;
  sincronizarSugestoesItens(ator, { force: true });
  onAposUsar?.(ator);
  return true;
}

function preencherWrap(wrap, ator, sugestoes, force = false) {
  if (!wrap) return;
  if (!sugestoes.length) {
    limparWrap(wrap, force);
    return;
  }

  const sig = sugestoes.map((s) => `${s.tipo}:${s.key}:${s.count}`).join("|");
  if (wrap.dataset.sig === sig) {
    pendingUpdates.delete(wrap);
    wrap.hidden = false;
    return;
  }
  if (!force && wrapEmHover(wrap)) {
    deferUpdate(wrap, ator, sugestoes);
    return;
  }

  pendingUpdates.delete(wrap);
  wrap.dataset.sig = sig;
  wrap.hidden = false;
  wrap.replaceChildren();

  sugestoes.forEach((sugestao, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hud__item-suggest-btn hud__item-suggest-btn--icon";
    const cor = sugestao.def?.cor ?? "#93c5fd";
    btn.style.setProperty("--berry", cor);
    const nome = nomeDe(sugestao.tipo, sugestao.key) || sugestao.key;
    btn.title = `${nome} ×${sugestao.count}\nCtrl+${idx + 1}`;
    btn.setAttribute("aria-label", `${nome}, ${sugestao.count}`);

    btn.append(montarIcone(sugestao.key));

    const count = document.createElement("span");
    count.className = "hud__item-suggest-count";
    count.textContent = String(sugestao.count);
    btn.append(count);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      aplicarSugestao(ator, sugestao);
    });
    wrap.append(btn);
  });
}

/**
 * @param {HTMLElement | null} host
 * @returns {HTMLElement | null}
 */
export function garantirWrapSugestao(host) {
  if (!host) return null;
  let wrap = host.querySelector(":scope > .party-detail__suggest");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "hud__item-suggest party-detail__suggest";
    wrap.hidden = true;
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Itens sugeridos");
    host.insertBefore(wrap, host.firstChild);
  }
  wrapHost = wrap;
  return wrap;
}

/**
 * @param {object | null | undefined} ator
 * @param {{ force?: boolean }} [opts]
 */
export function sincronizarSugestoesItens(ator, opts = {}) {
  const wrap = wrapHost || (typeof document !== "undefined"
    ? document.querySelector("#party-combat-detail > .party-detail__suggest")
    : null);
  if (!wrap) return;
  wrapHost = wrap;

  const sugestoes = listarSugestoesCampo(ator);
  if (!sugestoes.length) {
    limparWrap(wrap, !!opts.force);
    return;
  }
  preencherWrap(wrap, ator, sugestoes, !!opts.force);
}

export function limparSugestoesItens(force = true) {
  if (!wrapHost) return;
  limparWrap(wrapHost, force);
}

/**
 * @param {number} slotIndex 0..5
 */
export function usarSugestaoPorHotkey(slotIndex) {
  const ator = pokemonNoCampo();
  if (!ator || ator.capturado) return false;
  const sugestao = listarSugestoesCampo(ator)[slotIndex];
  return aplicarSugestao(ator, sugestao);
}

/**
 * @param {{ onAposUsar?: (ator: object | null) => void }} [opts]
 */
export function ligarHotkeysSugestao(opts = {}) {
  if (opts.onAposUsar) onAposUsar = opts.onAposUsar;
  if (hotkeyLigado) return;
  hotkeyLigado = true;

  window.addEventListener("keydown", (e) => {
    if (e.code === "ControlLeft") leftCtrlHeld = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ControlLeft") leftCtrlHeld = false;
  });
  window.addEventListener("blur", () => {
    leftCtrlHeld = false;
  });

  window.addEventListener("keydown", (e) => {
    if (!leftCtrlHeld || e.altKey || e.metaKey || e.repeat) return;
    const idx = TECLAS.indexOf(e.code);
    if (idx < 0) return;
    if (usarSugestaoPorHotkey(idx)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}
