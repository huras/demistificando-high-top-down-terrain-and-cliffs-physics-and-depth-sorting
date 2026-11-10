/**
 * Skill loadout — cards candy dos golpes do mon em campo.
 */

import { pokemonDeployado, pokemonNoCampo } from "../../pokemon/party.js";
import { equiparGolpes, recargaDoGolpe } from "../../pokemon/ator.js";
import { listarGolpes } from "../../pokemon/dados.js";
import { COR_TIPO } from "../../pokemon/tipos.js";
import { definirEscudoTipo, garantirAtlasTipo } from "../tipoEscudo.js";
import { preencherIconeGolpe } from "../iconesGolpe.js";
import { estado, avisar } from "../estado.js";

const TECLAS = Object.freeze(["Z", "X", "C", "V"]);
const SLOTS = 4;

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

let root = null;
let aberto = false;
let assinatura = "";
let onEsc = null;
let optionsHtmlCache = "";

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function monAtivo() {
  return pokemonDeployado() || pokemonNoCampo();
}

function nomeMon(ator) {
  return ator?.especie?.nome || ator?.especie?.name || ator?.especie?.key || "Pokémon";
}

function tipoPrimario(ator) {
  const tipos = ator?.especie?.tipos || ator?.tipos || [];
  return tipos[0] || ator?.golpes?.[0]?.def?.tipo || "normal";
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

function htmlOptionsGolpes() {
  if (optionsHtmlCache) return optionsHtmlCache;
  const lista = listarGolpes().slice().sort((a, b) => {
    const na = String(a?.nome || a?.name || a?.key || "");
    const nb = String(b?.nome || b?.name || b?.key || "");
    return na.localeCompare(nb, "pt-BR");
  });
  let html = `<option value="">— vazio —</option>`;
  for (let i = 0; i < lista.length; i++) {
    const def = lista[i];
    if (!def?.key) continue;
    const nome = def.nome || def.name || def.key;
    html += `<option value="${escHtml(def.key)}">${escHtml(nome)} (${escHtml(def.key)})</option>`;
  }
  if (lista.length) optionsHtmlCache = html;
  return html;
}

function htmlDevSelect(slot, chaveAtual) {
  const options = htmlOptionsGolpes();
  const chave = chaveAtual || "";
  const marcado = chave
    ? options.replace(
        `value="${escHtml(chave)}"`,
        `value="${escHtml(chave)}" selected`,
      )
    : options;
  return `<label class="skill-card__dev">
    <span>DEV</span>
    <select data-skill-dev-slot="${slot}">${marcado}</select>
  </label>`;
}

function htmlCard(slot, g, ator) {
  const tecla = TECLAS[slot] || String(slot + 1);
  const def = g?.def || g;
  const chaveAtual = def?.key || g?.chave || "";
  const selectDev = htmlDevSelect(slot, chaveAtual);
  if (!def) {
    return `<article class="skill-card is-empty" data-move-slot="${slot}">
      <div class="skill-card__top">
        <span class="skill-card__badge">${tecla}</span>
      </div>
      <p class="skill-card__empty">Slot vazio</p>
      ${selectDev}
    </article>`;
  }

  const nome = def.nome || def.name || def.key || "?";
  const tipo = def.tipo || def.type || "normal";
  const key = def.key || "";
  const cor = COR_TIPO[tipo] || "#9ca3af";
  const poder = def.poder | 0;
  const cd = fmtCd(recargaDoGolpe(ator, def));
  const alcance = fmtAlcance(def);
  const sub = `${rotuloForma(def)} · ${rotuloCategoria(def)}`;
  const desc = def.desc || def.descricao || def.description || "";

  return `<article class="skill-card is-ready" data-move-slot="${slot}" data-move-key="${escHtml(key)}" data-move-tipo="${escHtml(tipo)}" style="--card-tipo:${cor}">
    <div class="skill-card__top">
      <span class="skill-card__icon" data-skill-type aria-hidden="true"></span>
      <div class="skill-card__titles">
        <b class="skill-card__name">${escHtml(nome)}</b>
        <span class="skill-card__sub">${escHtml(sub)}</span>
      </div>
      <span class="skill-card__badge">${tecla}</span>
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
    ${selectDev}
  </article>`;
}

export function montarSkillLoadout() {
  root = document.getElementById("skill-loadout-hud");
  if (!root) {
    root = document.createElement("div");
    root.id = "skill-loadout-hud";
    root.className = "skill-loadout-hud";
    root.hidden = true;
    document.getElementById("jogo-hud")?.appendChild(root);
  }

  root.innerHTML = `<div class="skill-loadout-hud__veil" data-skill-close></div>
    <div class="skill-loadout-hud__panel hud-panel" role="dialog" aria-modal="true" aria-label="Skills">
      <header class="skill-loadout-hud__head hud-head" data-skill-head>
        <div class="skill-loadout-hud__head-text">
          <b data-skill-title>Skills</b>
          <span data-skill-sub></span>
        </div>
        <button type="button" class="skill-loadout-hud__x" data-skill-close aria-label="Fechar">×</button>
      </header>
      <div class="skill-loadout-hud__grid" data-skill-grid></div>
      <footer class="skill-loadout-hud__foot">
        <button type="button" class="hud-btn red big" data-skill-close>
          Fechar
          <kbd class="hud-kbd">Esc</kbd>
        </button>
      </footer>
    </div>`;

  root.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-skill-close]")) {
      ev.preventDefault();
      fechar();
    }
  });

  root.addEventListener("change", (ev) => {
    const select = ev.target.closest("[data-skill-dev-slot]");
    if (!select) return;
    aplicarDevSlot(select);
  });

  return {
    open: abrir,
    close: fechar,
    toggle: () => (aberto ? fechar() : abrir()),
    isOpen: () => aberto,
    sync: pintar,
  };
}

function aplicarDevSlot(select) {
  const ator = monAtivo();
  if (!ator || ator.capturado) return;
  const slot = Number(select.dataset.skillDevSlot);
  if (!Number.isFinite(slot) || slot < 0 || slot >= SLOTS) return;

  const chaves = [];
  for (let i = 0; i < SLOTS; i++) {
    const atual = ator.golpes?.[i];
    chaves[i] = atual?.chave || atual?.def?.key || "";
  }
  chaves[slot] = select.value || "";
  equiparGolpes(ator, chaves.filter(Boolean));
  assinatura = "";
  pintar();
}

function ligarEsc() {
  if (onEsc) return;
  onEsc = (ev) => {
    if (ev.key === "Escape" && aberto) {
      ev.preventDefault();
      fechar();
    }
  };
  window.addEventListener("keydown", onEsc);
}

function desligarEsc() {
  if (!onEsc) return;
  window.removeEventListener("keydown", onEsc);
  onEsc = null;
}

function abrir() {
  aberto = true;
  estado.skillAberto = true;
  if (root) {
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add("is-open"));
  }
  ligarEsc();
  assinatura = "";
  pintar();
  avisar();
  return true;
}

function fechar() {
  aberto = false;
  estado.skillAberto = false;
  if (root) {
    root.classList.remove("is-open");
    root.hidden = true;
  }
  desligarEsc();
  avisar();
  return true;
}

function pintar() {
  if (!root || !aberto) return;
  garantirAtlasTipo();
  const ator = monAtivo();
  const grid = root.querySelector("[data-skill-grid]");
  const title = root.querySelector("[data-skill-title]");
  const sub = root.querySelector("[data-skill-sub]");
  const head = root.querySelector("[data-skill-head]");

  if (!ator || ator.capturado) {
    if (title) title.textContent = "Skills";
    if (sub) sub.textContent = "Nenhum Pokémon em campo";
    if (grid) {
      grid.innerHTML = TECLAS.map((_, i) => htmlCard(i, null, null)).join("");
    }
    assinatura = "empty";
    return;
  }

  const golpes = (ator.golpes || []).slice(0, 4);
  const tipo = tipoPrimario(ator);
  const cor = COR_TIPO[tipo] || "#8a5cff";
  const sig = `${ator.id}:${golpes.map((g) => g?.def?.key || g?.chave || "").join(",")}:${ator.nivel}`;

  if (head) {
    head.style.setProperty("--head-c", cor);
    head.style.setProperty(
      "--head-cd",
      `color-mix(in srgb, ${cor} 70%, #1a1246)`,
    );
  }
  if (title) title.textContent = `Passive & kit · ${nomeMon(ator)}`;
  if (sub) sub.textContent = `Lv. ${ator.nivel} · ${tipo}`;

  if (sig !== assinatura) {
    assinatura = sig;
    if (grid) {
      grid.innerHTML = TECLAS.map((_, i) => htmlCard(i, golpes[i], ator)).join("");
      const cards = grid.querySelectorAll(".skill-card.is-ready");
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
      const selects = grid.querySelectorAll("[data-skill-dev-slot]");
      for (let i = 0; i < selects.length; i++) {
        const select = selects[i];
        const slot = Number(select.dataset.skillDevSlot);
        const atual = golpes[slot];
        select.value = atual?.chave || atual?.def?.key || "";
      }
    }
  }
}
