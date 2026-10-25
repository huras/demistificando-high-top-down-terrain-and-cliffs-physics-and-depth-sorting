/**
 * Fila + modal + FX de evolução (cinema overworld).
 */

import {
  encerrarAudioEvolucao,
  iniciarAudioEvolucao,
} from "../jogo/audio.js";
import { markSpeciesSeen } from "../jogo/pokedex/progresso.js";
import { especie } from "./dados.js";
import { aplicarEvolucao, proximaEvolucao } from "./evolucao.js";

/** Gate externo (UI/morte) — evita ciclo estado↔sistema. */
let liberarCinema = () => true;

export function definirGateEvolucao(fn) {
  liberarCinema = typeof fn === "function" ? fn : () => true;
}

function podeAbrirCinema() {
  try {
    return !!liberarCinema();
  } catch {
    return true;
  }
}

export const EVO_WHITEN_MS = 1400;
export const EVO_MORPH_MS = 3400;
export const EVO_REVEAL_MS = 1000;

/** @type {{ ator: object, pending: object }[]} */
const fila = [];
/** @type {{ ator: object, pending: object, fase: string, t0: number, aplicado: boolean } | null} */
let ativo = null;
/** @type {HTMLElement | null} */
let raiz = null;
/** @type {number[]} */
const timers = [];

function limparTimers() {
  for (let i = 0; i < timers.length; i++) clearTimeout(timers[i]);
  timers.length = 0;
}

function nomeDe(key) {
  return especie(key)?.nome || key;
}

function garantirDom() {
  if (raiz && document.body.contains(raiz)) return raiz;
  raiz = document.createElement("div");
  raiz.id = "evoluir-modal";
  raiz.className = "evoluir-modal";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="evoluir-modal__painel" role="dialog" aria-modal="true">
      <p class="evoluir-modal__titulo" data-evo-titulo></p>
      <p class="evoluir-modal__texto" data-evo-texto></p>
      <div class="evoluir-modal__acoes">
        <button type="button" class="evoluir-modal__btn" data-evo-cancelar>Cancelar</button>
        <button type="button" class="evoluir-modal__btn evoluir-modal__btn--ok" data-evo-ok hidden>OK</button>
      </div>
    </div>`;
  document.body.appendChild(raiz);
  raiz.querySelector("[data-evo-cancelar]")?.addEventListener("click", () => cancelar());
  raiz.querySelector("[data-evo-ok]")?.addEventListener("click", () => dispensar());
  return raiz;
}

function setEvolveFx(ator, pending, fase) {
  if (!ator) return;
  const from = especie(pending.from);
  const into = especie(pending.into);
  ator._evolveFx = {
    fase,
    fromKey: pending.from,
    intoKey: pending.into,
    fromDex: from?.dex | 0,
    intoDex: into?.dex | 0,
    t0: performance.now(),
    brilho: fase === "whiten" || fase === "morph" ? 1 : 0,
    mostrarInto: fase === "reveal" || fase === "done",
  };
}

function limparFx(ator) {
  if (ator?._evolveFx) delete ator._evolveFx;
}

function confirmarEvolucao() {
  if (!ativo || ativo.aplicado) return false;
  const esp = aplicarEvolucao(ativo.ator, ativo.pending.into);
  if (ativo.pending.heldItem) {
    if (ativo.ator.heldItemKey === ativo.pending.heldItem) {
      ativo.ator.heldItemKey = null;
    }
    if (ativo.ator.itemSegurado === ativo.pending.heldItem) {
      ativo.ator.itemSegurado = null;
    }
  }
  if (esp?.key) markSpeciesSeen(esp.key);
  ativo.aplicado = true;
  return true;
}

function marcarFase(fase) {
  if (!ativo) return;
  ativo.fase = fase;
  ativo.t0 = performance.now();
  setEvolveFx(ativo.ator, ativo.pending, fase);
  const el = garantirDom();
  el.dataset.fase = fase;
}

function abrirUi(pending) {
  const el = garantirDom();
  const fromNome = nomeDe(pending.from);
  const titulo = el.querySelector("[data-evo-titulo]");
  const texto = el.querySelector("[data-evo-texto]");
  const cancel = el.querySelector("[data-evo-cancelar]");
  const ok = el.querySelector("[data-evo-ok]");
  if (titulo) titulo.textContent = "Evolução";
  if (texto) texto.textContent = `O quê? ${fromNome} está evoluindo!`;
  if (cancel) cancel.hidden = false;
  if (ok) ok.hidden = true;
  el.hidden = false;
  el.classList.add("is-aberto", "is-animando");
  el.classList.remove("is-pronto", "is-cancelado");
}

function uiPronto(pending) {
  const el = garantirDom();
  const intoNome = nomeDe(pending.into);
  const fromNome = nomeDe(pending.from);
  const texto = el.querySelector("[data-evo-texto]");
  const cancel = el.querySelector("[data-evo-cancelar]");
  const ok = el.querySelector("[data-evo-ok]");
  if (texto) texto.textContent = `${fromNome} evoluiu para ${intoNome}!`;
  if (cancel) cancel.hidden = true;
  if (ok) ok.hidden = false;
  el.classList.remove("is-animando");
  el.classList.add("is-pronto");
}

function fecharUi() {
  if (!raiz) return;
  raiz.hidden = true;
  raiz.classList.remove("is-aberto", "is-animando", "is-pronto", "is-cancelado");
}

function iniciarProximo() {
  if (ativo || !fila.length) return;
  if (!podeAbrirCinema()) return;
  const oferta = fila.shift();
  if (!oferta?.ator || !oferta.pending) {
    iniciarProximo();
    return;
  }
  // Revalida (pode ter cancelado / mudado nível)
  const ainda = proximaEvolucao(oferta.ator);
  if (!ainda || ainda.into !== oferta.pending.into) {
    iniciarProximo();
    return;
  }

  ativo = {
    ator: oferta.ator,
    pending: oferta.pending,
    fase: "whiten",
    t0: performance.now(),
    aplicado: false,
  };
  iniciarAudioEvolucao();
  abrirUi(oferta.pending);
  marcarFase("whiten");

  timers.push(
    setTimeout(() => {
      if (!ativo || ativo.fase === "cancelado") return;
      marcarFase("morph");
    }, EVO_WHITEN_MS)
  );
  timers.push(
    setTimeout(() => {
      if (!ativo || ativo.fase === "cancelado") return;
      marcarFase("reveal");
    }, EVO_WHITEN_MS + EVO_MORPH_MS)
  );
  timers.push(
    setTimeout(() => {
      if (!ativo || ativo.fase === "cancelado") return;
      confirmarEvolucao();
      marcarFase("done");
      uiPronto(ativo.pending);
      limparFx(ativo.ator);
      encerrarAudioEvolucao({ cancelled: false });
    }, EVO_WHITEN_MS + EVO_MORPH_MS + EVO_REVEAL_MS)
  );
}

/** Tenta abrir a próxima oferta quando o mundo fica livre. */
export function tickEvolucaoCinema() {
  if (!ativo && fila.length) iniciarProximo();
}

/**
 * Enfileira se o mon ainda pode evoluir.
 * @param {object} ator
 */
export function enfileirarEvolucao(ator) {
  const pending = proximaEvolucao(ator);
  if (!pending) return false;
  if (ativo?.ator === ator) return false;
  if (fila.some((o) => o.ator === ator)) return false;
  fila.push({ ator, pending });
  iniciarProximo();
  return true;
}

export function evolucaoAberta() {
  return !!ativo;
}

export function cancelar() {
  if (!ativo || ativo.fase === "done") return;
  limparTimers();
  const { ator, aplicado } = ativo;
  limparFx(ator);
  const el = garantirDom();
  const texto = el.querySelector("[data-evo-texto]");
  const cancel = el.querySelector("[data-evo-cancelar]");
  const ok = el.querySelector("[data-evo-ok]");
  if (texto) texto.textContent = "Hmm? A evolução foi cancelada!";
  if (cancel) cancel.hidden = true;
  if (ok) ok.hidden = false;
  el.classList.remove("is-animando");
  el.classList.add("is-cancelado");
  ativo.fase = "cancelado";
  encerrarAudioEvolucao({ cancelled: !aplicado });
}

export function evolucaoBloqueiaMundo() {
  return !!ativo && ativo.fase !== "done" && ativo.fase !== "cancelado";
}

export function dispensar() {
  if (!ativo) return;
  if (ativo.fase !== "done" && ativo.fase !== "cancelado") return;
  limparTimers();
  limparFx(ativo.ator);
  fecharUi();
  ativo = null;
  iniciarProximo();
}

/** Teclado: Esc cancela (antes do done); Enter/Espaço dispensa no done. */
export function tratarTeclaEvolucao(code) {
  if (!ativo) return false;
  if (ativo.fase === "done" || ativo.fase === "cancelado") {
    if (
      code === "Escape" ||
      code === "Enter" ||
      code === "Space" ||
      code === "KeyZ" ||
      code === "KeyX"
    ) {
      dispensar();
      return true;
    }
    return false;
  }
  if (code === "Escape" || code === "KeyN" || code === "KeyB") {
    cancelar();
    return true;
  }
  return false;
}

/** Multiplicador visual 0..1 para render (brilho). */
export function brilhoEvolucao(ator) {
  const fx = ator?._evolveFx;
  if (!fx) return 0;
  if (fx.fase === "whiten" || fx.fase === "morph") return 1;
  if (fx.fase === "reveal") {
    const u = Math.min(1, (performance.now() - fx.t0) / EVO_REVEAL_MS);
    return 1 - u;
  }
  return 0;
}

export function evolucaoMostraInto(ator) {
  const fx = ator?._evolveFx;
  if (!fx) return false;
  if (fx.fase === "reveal" || fx.fase === "done") return true;
  if (fx.fase === "morph") {
    const t = performance.now() - fx.t0;
    return Math.floor(t / 160) % 2 === 1;
  }
  return !!fx.mostrarInto;
}

/** Espécie a desenhar durante o cinema (from/into). */
export function especieVisualEvolucao(ator) {
  if (!evolucaoMostraInto(ator)) return null;
  const key = ator?._evolveFx?.intoKey;
  return key ? especie(key) : null;
}
