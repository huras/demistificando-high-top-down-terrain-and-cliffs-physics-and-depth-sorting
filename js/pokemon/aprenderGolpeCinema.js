/**
 * Fila + modal de aprendizado de golpe (pause overworld).
 */

import { COR_TIPO } from "./tipos.js";
import { golpe } from "./dados.js";
import { recargaDoGolpe } from "./ator.js";
import {
  SLOTS_GOLPE,
  jaSabe,
  substituirGolpe,
  temSlotLivre,
  adicionarGolpe,
  chaveDoSlot,
} from "./aprenderGolpe.js";
import { preencherIconeGolpe } from "../jogo/iconesGolpe.js";
import { definirEscudoTipo, garantirAtlasTipo } from "../jogo/tipoEscudo.js";
import { estado, avisar } from "../jogo/estado.js";
import { t } from "../jogo/i18n.js";
import { tocarChoose, tocarObtido } from "../jogo/som/mundoSfx.js";
import { flutuar } from "./flutuantes.js";

/** Gate externo (UI/morte/mapa). */
let liberarCinema = () => true;

export function definirGateAprenderGolpe(fn) {
  liberarCinema = typeof fn === "function" ? fn : () => true;
}

function podeAbrir() {
  try {
    return !!liberarCinema();
  } catch {
    return true;
  }
}

/** @type {{ ator: object, chave: string }[]} */
const fila = [];
/**
 * @type {{
 *   ator: object,
 *   chave: string,
 *   fase: "escolha" | "confirmTroca" | "confirmRecusa",
 *   sel: number,
 * } | null}
 */
let ativo = null;
/** @type {HTMLElement | null} */
let raiz = null;
let assinatura = "";

const FORMA = Object.freeze({
  contact: "Contato",
  projectile: "Projétil",
  arc: "Arco",
  radius: "Área",
});

const CATEGORIA = Object.freeze({
  physical: "Físico",
  special: "Especial",
  status: "Status",
});

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function nomeMon(ator) {
  return ator?.especie?.nome || ator?.especie?.name || ator?.especie?.key || "Pokémon";
}

function nomeGolpe(chave) {
  const def = golpe(chave);
  return def?.nome || def?.name || chave;
}

function rotuloForma(def) {
  return FORMA[def?.forma] || def?.forma || "—";
}

function rotuloCategoria(def) {
  return CATEGORIA[def?.categoria] || def?.categoria || "—";
}

function fmtCd(seg) {
  const n = Number(seg);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(n >= 10 ? 0 : 1)}s`;
}

function fmtAlcance(def) {
  const a = Number(def?.alcance);
  if (!Number.isFinite(a) || a <= 0) return "—";
  return a.toFixed(a >= 10 ? 0 : 1);
}

function htmlCard(slot, g, ator, opts = {}) {
  const tecla = String((slot | 0) + 1);
  const def = g?.def || g;
  const hero = !!opts.hero;
  const selected = !!opts.selected;
  if (!def) {
    return `<article class="skill-card is-empty aprender-golpe__card" data-move-slot="${slot}">
      <div class="skill-card__top">
        <span class="skill-card__badge">${tecla}</span>
      </div>
      <p class="skill-card__empty">—</p>
    </article>`;
  }

  const nome = def.nome || def.name || def.key || "?";
  const tipo = def.tipo || def.type || "normal";
  const key = def.key || "";
  const cor = COR_TIPO[tipo] || "#9ca3af";
  const poder = def.poder | 0;
  const cd = fmtCd(ator ? recargaDoGolpe(ator, def) : def.recarga);
  const alcance = fmtAlcance(def);
  const sub = `${rotuloForma(def)} · ${rotuloCategoria(def)}`;
  const desc = def.desc || def.descricao || def.description || "";
  const cls = [
    "skill-card",
    "is-ready",
    "aprender-golpe__card",
    hero ? "is-hero" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<article class="${cls}" data-move-slot="${slot}" data-move-key="${escHtml(key)}" data-move-tipo="${escHtml(tipo)}" style="--card-tipo:${cor}">
    <div class="skill-card__top">
      <span class="skill-card__icon" data-skill-type aria-hidden="true"></span>
      <div class="skill-card__titles">
        <b class="skill-card__name">${escHtml(nome)}</b>
        <span class="skill-card__sub">${escHtml(sub)}</span>
      </div>
      <span class="skill-card__badge">${hero ? "NEW" : tecla}</span>
    </div>
    <div class="skill-card__art-row">
      <span class="skill-card__art" data-skill-art hidden></span>
      ${desc ? `<p class="skill-card__desc">${escHtml(desc)}</p>` : `<p class="skill-card__desc skill-card__desc--muted">${escHtml(tipo)} · poder ${poder}</p>`}
    </div>
    <dl class="skill-card__stats">
      <div><dt>Damage</dt><dd>${poder || "—"}</dd></div>
      <div><dt>Cooldown</dt><dd>${escHtml(cd)}</dd></div>
      <div><dt>Reach</dt><dd>${escHtml(alcance)}</dd></div>
    </dl>
  </article>`;
}

function preencherIcones(host) {
  if (!host) return;
  garantirAtlasTipo();
  const cards = host.querySelectorAll(".skill-card.is-ready");
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const moveTipo = card.dataset.moveTipo || "normal";
    const key = card.dataset.moveKey || "";
    const art = card.querySelector("[data-skill-art]");
    const typeHost = card.querySelector("[data-skill-type]");
    const temArt = preencherIconeGolpe(art, key, moveTipo);
    if (art) art.hidden = !temArt;
    if (typeHost) definirEscudoTipo(typeHost, moveTipo, 28);
  }
}

function garantirDom() {
  if (raiz && document.body.contains(raiz)) return raiz;
  raiz = document.createElement("div");
  raiz.id = "aprender-golpe-modal";
  raiz.className = "aprender-golpe-hud";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="aprender-golpe-hud__veil" aria-hidden="true"></div>
    <div class="aprender-golpe-hud__panel hud-panel" role="dialog" aria-modal="true" aria-labelledby="aprender-golpe-titulo">
      <header class="aprender-golpe-hud__head hud-head" data-aprender-head>
        <div class="aprender-golpe-hud__head-text">
          <b id="aprender-golpe-titulo" data-aprender-titulo></b>
          <span data-aprender-sub></span>
        </div>
      </header>
      <p class="aprender-golpe-hud__msg" data-aprender-msg></p>
      <div class="aprender-golpe-hud__hero" data-aprender-hero></div>
      <div class="aprender-golpe-hud__grid" data-aprender-grid></div>
      <footer class="aprender-golpe-hud__foot">
        <button type="button" class="hud-btn" data-aprender-recusar></button>
        <button type="button" class="hud-btn red big" data-aprender-confirmar hidden></button>
      </footer>
    </div>`;
  document.body.appendChild(raiz);

  raiz.addEventListener("click", (ev) => {
    if (!ativo) return;
    const card = ev.target.closest("[data-move-slot]");
    if (card && card.closest("[data-aprender-grid]")) {
      const idx = Number(card.dataset.moveSlot);
      if (Number.isFinite(idx)) selecionarSlot(idx);
      return;
    }
    if (ev.target.closest("[data-aprender-recusar]")) {
      ev.preventDefault();
      pedirRecusa();
      return;
    }
    if (ev.target.closest("[data-aprender-confirmar]")) {
      ev.preventDefault();
      confirmarAcao();
    }
  });

  return raiz;
}

function setFlagAberto(v) {
  estado.aprenderGolpeAberto = !!v;
  if (v) document.body.classList.add("is-aprender-golpe");
  else document.body.classList.remove("is-aprender-golpe");
  avisar();
}

function fecharUi() {
  if (!raiz) return;
  raiz.hidden = true;
  raiz.classList.remove("is-open");
  setFlagAberto(false);
  assinatura = "";
}

function pintar() {
  if (!ativo || !raiz) return;
  const { ator, chave, fase, sel } = ativo;
  const defNovo = golpe(chave);
  const titulo = raiz.querySelector("[data-aprender-titulo]");
  const sub = raiz.querySelector("[data-aprender-sub]");
  const msg = raiz.querySelector("[data-aprender-msg]");
  const hero = raiz.querySelector("[data-aprender-hero]");
  const grid = raiz.querySelector("[data-aprender-grid]");
  const head = raiz.querySelector("[data-aprender-head]");
  const btnRecusar = raiz.querySelector("[data-aprender-recusar]");
  const btnConfirmar = raiz.querySelector("[data-aprender-confirmar]");

  const nomePk = nomeMon(ator);
  const nomeMv = nomeGolpe(chave);
  const tipoMon = ator?.especie?.tipos?.[0] || ator?.tipos?.[0] || "normal";
  const cor = COR_TIPO[tipoMon] || "#8a5cff";

  if (head) {
    head.style.setProperty("--head-c", cor);
    head.style.setProperty("--head-cd", `color-mix(in srgb, ${cor} 70%, #1a1246)`);
  }
  if (titulo) titulo.textContent = t("aprenderGolpe.titulo");
  if (sub) sub.textContent = `${nomePk} · Lv. ${ator.nivel | 0}`;

  let textoMsg = t("aprenderGolpe.querAprender", { mon: nomePk, golpe: nomeMv });
  if (fase === "confirmTroca") {
    const velho = chaveDoSlot(ator.golpes?.[sel]);
    textoMsg = t("aprenderGolpe.confirmarTroca", {
      velho: nomeGolpe(velho),
      novo: nomeMv,
    });
  } else if (fase === "confirmRecusa") {
    textoMsg = t("aprenderGolpe.desistir", { golpe: nomeMv });
  } else {
    textoMsg = `${textoMsg} ${t("aprenderGolpe.escolherEsquecer")}`;
  }
  if (msg) msg.textContent = textoMsg;

  if (btnRecusar) {
    btnRecusar.textContent =
      fase === "confirmRecusa" || fase === "confirmTroca"
        ? t("aprenderGolpe.voltar")
        : t("aprenderGolpe.naoAprender");
    btnRecusar.hidden = false;
  }
  if (btnConfirmar) {
    if (fase === "confirmTroca") {
      btnConfirmar.hidden = false;
      btnConfirmar.textContent = t("aprenderGolpe.aprender");
    } else if (fase === "confirmRecusa") {
      btnConfirmar.hidden = false;
      btnConfirmar.textContent = t("aprenderGolpe.confirmarDesistir");
    } else {
      btnConfirmar.hidden = sel < 0;
      btnConfirmar.textContent = t("aprenderGolpe.aprender");
    }
  }

  const sig = `${ator.id}:${chave}:${fase}:${sel}:${(ator.golpes || [])
    .map((g) => chaveDoSlot(g))
    .join(",")}`;
  if (sig === assinatura) return;
  assinatura = sig;

  if (hero) {
    hero.innerHTML = htmlCard(0, defNovo, ator, { hero: true });
    preencherIcones(hero);
  }
  if (grid) {
    const golpes = ator.golpes || [];
    let html = "";
    for (let i = 0; i < SLOTS_GOLPE; i++) {
      html += htmlCard(i, golpes[i], ator, { selected: fase !== "confirmRecusa" && sel === i });
    }
    grid.innerHTML = html;
    preencherIcones(grid);
  }
}

function abrirUi() {
  const el = garantirDom();
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("is-open"));
  setFlagAberto(true);
  assinatura = "";
  pintar();
  tocarChoose();
}

function iniciarProximo() {
  if (ativo || !fila.length) return;
  if (!podeAbrir()) return;

  while (fila.length && !ativo) {
    const oferta = fila.shift();
    if (!oferta?.ator || !oferta.chave) continue;
    const { ator, chave } = oferta;
    if (!ator || ator.morto || !golpe(chave) || jaSabe(ator, chave)) continue;
    if (temSlotLivre(ator)) {
      if (adicionarGolpe(ator, chave)) {
        flutuar(ator, t("aprenderGolpe.aprendeu", { golpe: nomeGolpe(chave) }), "#fda4af");
        tocarObtido(ator);
      }
      continue;
    }
    ativo = { ator, chave, fase: "escolha", sel: 0 };
    abrirUi();
    return;
  }
}

function concluir() {
  fecharUi();
  ativo = null;
  iniciarProximo();
}

function selecionarSlot(indice) {
  if (!ativo) return;
  const i = indice | 0;
  if (i < 0 || i >= SLOTS_GOLPE) return;
  if (!(ativo.ator.golpes?.[i])) return;
  if (ativo.fase === "confirmRecusa") {
    ativo.fase = "escolha";
  }
  ativo.sel = i;
  if (ativo.fase === "escolha") {
    // seleção só — confirmar via botão / Enter
  }
  tocarChoose();
  assinatura = "";
  pintar();
}

function pedirRecusa() {
  if (!ativo) return;
  if (ativo.fase === "confirmTroca" || ativo.fase === "confirmRecusa") {
    ativo.fase = "escolha";
    assinatura = "";
    pintar();
    return;
  }
  ativo.fase = "confirmRecusa";
  assinatura = "";
  pintar();
}

function confirmarAcao() {
  if (!ativo) return;
  const { ator, chave, fase, sel } = ativo;

  if (fase === "escolha") {
    if (sel < 0 || !ator.golpes?.[sel]) return;
    ativo.fase = "confirmTroca";
    assinatura = "";
    pintar();
    return;
  }

  if (fase === "confirmTroca") {
    const velho = chaveDoSlot(ator.golpes?.[sel]);
    if (!substituirGolpe(ator, sel, chave)) {
      ativo.fase = "escolha";
      assinatura = "";
      pintar();
      return;
    }
    flutuar(
      ator,
      t("aprenderGolpe.aprendeuTrocando", {
        novo: nomeGolpe(chave),
        velho: nomeGolpe(velho),
      }),
      "#fda4af",
    );
    tocarObtido(ator);
    concluir();
    return;
  }

  if (fase === "confirmRecusa") {
    flutuar(ator, t("aprenderGolpe.naoAprendeu", { golpe: nomeGolpe(chave) }), "#94a3b8");
    concluir();
  }
}

/** Tenta abrir a próxima oferta quando o mundo fica livre. */
export function tickAprenderGolpe() {
  if (!ativo && fila.length) iniciarProximo();
}

/**
 * Enfileira aprendizado (dedupe ator+chave).
 * @param {object} ator
 * @param {string} chave
 */
export function enfileirarAprenderGolpe(ator, chave) {
  if (!ator || !chave || !golpe(chave)) return false;
  if (jaSabe(ator, chave)) return false;
  if (temSlotLivre(ator)) {
    if (adicionarGolpe(ator, chave)) {
      flutuar(ator, t("aprenderGolpe.aprendeu", { golpe: nomeGolpe(chave) }), "#fda4af");
      tocarObtido(ator);
      return true;
    }
    return false;
  }
  if (ativo?.ator === ator && ativo.chave === chave) return false;
  if (fila.some((o) => o.ator === ator && o.chave === chave)) return false;
  fila.push({ ator, chave });
  iniciarProximo();
  return true;
}

export function aprenderGolpeAberto() {
  return !!ativo;
}

export function aprenderGolpePendente() {
  return !!ativo || fila.length > 0;
}

/** Teclado: setas/1-4 selecionam; Enter confirma; Esc recusa/volta. */
export function tratarTeclaAprenderGolpe(code) {
  if (!ativo) return false;

  if (code === "Escape") {
    pedirRecusa();
    return true;
  }

  if (code === "Enter" || code === "Space" || code === "KeyZ" || code === "KeyX") {
    confirmarAcao();
    return true;
  }

  if (code === "ArrowLeft" || code === "KeyA") {
    const n = SLOTS_GOLPE;
    let i = ativo.sel;
    for (let k = 0; k < n; k++) {
      i = (i - 1 + n) % n;
      if (ativo.ator.golpes?.[i]) {
        selecionarSlot(i);
        break;
      }
    }
    return true;
  }
  if (code === "ArrowRight" || code === "KeyD") {
    const n = SLOTS_GOLPE;
    let i = ativo.sel;
    for (let k = 0; k < n; k++) {
      i = (i + 1) % n;
      if (ativo.ator.golpes?.[i]) {
        selecionarSlot(i);
        break;
      }
    }
    return true;
  }

  const digit = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
    Numpad1: 0,
    Numpad2: 1,
    Numpad3: 2,
    Numpad4: 3,
  }[code];
  if (digit != null) {
    selecionarSlot(digit);
    return true;
  }

  return false;
}
