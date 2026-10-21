/** Grade da Pokédex: render em pedaços (24 cards / ~6 ms). */

import { getSpeciesDexStatus } from "./progresso.js";
import { t } from "../i18n.js";

/** @typedef {'all' | 'caught' | 'seen' | 'unseen'} FiltroDex */
/** @typedef {'unseen' | 'seen' | 'caught'} StatusDex */

const PEDACO = 24;
const ORCAMENTO_MS = 6;

export const MAX_FILTROS_TIPO = 3;

export const ORDEM_TIPOS = Object.freeze([
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
]);

export const META_STATUS = Object.freeze({
  caught: {
    classeCard: "is-caught",
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18"/>
      <path fill="#c62828" d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2z"/>
      <rect x="2" y="11" width="20" height="2" fill="#111"/>
      <circle cx="12" cy="12" r="3.2" fill="#f5f5f5" stroke="#111" stroke-width="1.1"/>
    </svg>`,
  },
  seen: {
    classeCard: "is-seen",
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>
    </svg>`,
  },
  unseen: {
    classeCard: "is-unseen",
    svg: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-1 4v6h2v-6h-2zm0-2v2h2V8h-2z"/>
    </svg>`,
  },
});

export function padDex(dex) {
  return String(dex).padStart(3, "0");
}

/**
 * @param {string} speciesKey
 * @param {FiltroDex} filtro
 */
function bateFiltroStatus(speciesKey, filtro) {
  const status = getSpeciesDexStatus(speciesKey);
  if (filtro === "caught") return status === "caught";
  if (filtro === "seen") return status === "seen";
  if (filtro === "unseen") return status === "unseen";
  return true;
}

/**
 * @param {{ tipos?: string[] }} entrada
 * @param {string[]} tiposAtivos
 */
function bateTipos(entrada, tiposAtivos) {
  if (!tiposAtivos.length) return true;
  const tipos = entrada.tipos ?? [];
  return tiposAtivos.every((tipo) => tipos.includes(tipo));
}

/**
 * @param {HTMLElement} card
 * @param {{ key: string, dex: number, nome: string }} entrada
 * @param {StatusDex} status
 */
function garantirRetrato(card, entrada, status) {
  const wrap = card.querySelector(".pokedex-hud__card-portrait-wrap");
  const silhueta = card.querySelector(".pokedex-hud__card-silhouette");
  /** @type {HTMLImageElement | null} */
  let img = card._retratoDex || null;

  if (status === "unseen") {
    if (img) img.hidden = true;
    if (silhueta) silhueta.hidden = false;
    return;
  }

  if (!img && wrap) {
    img = document.createElement("img");
    img.className = "pokedex-hud__card-portrait pokemon-portrait";
    img.alt = "";
    img.draggable = false;
    img.loading = "lazy";
    wrap.append(img);
    card._retratoDex = img;
  }
  if (img) {
    img.src = `/ref/sprites/pokemon-portraits/${entrada.dex | 0}.png`;
    img.hidden = false;
  }
  if (silhueta) silhueta.hidden = true;
}

/**
 * @param {HTMLElement} card
 * @param {{ key: string, dex: number, nome: string }} entrada
 * @param {StatusDex} status
 */
function aplicarCard(card, entrada, status) {
  card.dataset.status = status;
  card.classList.remove("is-caught", "is-seen", "is-unseen");
  card.classList.add(META_STATUS[status].classeCard);

  const interativo = status === "seen" || status === "caught";
  card.classList.toggle("is-interactive", interativo);
  if (interativo) {
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-label", t("pokedex.abrirEntrada", { nome: entrada.nome }));
  } else {
    card.removeAttribute("role");
    card.removeAttribute("tabindex");
    card.setAttribute("aria-label", t("pokedex.badgeNaoVisto"));
  }

  const numEl = card.querySelector(".pokedex-hud__card-num");
  if (numEl) numEl.textContent = `#${padDex(entrada.dex)}`;

  const nomeEl = card.querySelector(".pokedex-hud__card-name");
  if (nomeEl) nomeEl.textContent = status === "unseen" ? "" : entrada.nome;

  garantirRetrato(card, entrada, status);
}

/**
 * @param {{ key: string, dex: number, nome: string }} entrada
 */
function criarCascaCard(entrada) {
  const card = document.createElement("article");
  card.className = "pokedex-hud__card";
  card.dataset.speciesKey = entrada.key;
  card.dataset.dex = String(entrada.dex);

  const wrap = document.createElement("div");
  wrap.className = "pokedex-hud__card-portrait-wrap";

  const silhueta = document.createElement("span");
  silhueta.className = "pokedex-hud__card-silhouette";
  silhueta.textContent = "?";

  const num = document.createElement("span");
  num.className = "pokedex-hud__card-num";

  const nome = document.createElement("span");
  nome.className = "pokedex-hud__card-name";

  wrap.append(silhueta);
  card.append(wrap, num, nome);
  return card;
}

/**
 * @param {{
 *   gradeEl: HTMLElement,
 *   lista: { key: string, dex: number, nome: string, tipos: string[] }[],
 *   porChave: Map<string, { key: string, dex: number, nome: string, tipos: string[] }>,
 *   estadoFiltro: () => { busca: string, filtro: FiltroDex, tipos: string[] },
 * }} opts
 */
export function criarGradePokedex(opts) {
  const { gradeEl, lista, porChave, estadoFiltro } = opts;
  let montada = false;
  let montando = false;
  let cursor = 0;
  let raf = 0;

  function cardBate(card, entrada, status) {
    const { busca, filtro, tipos } = estadoFiltro();
    const nomeBusca = status === "unseen" ? "" : entrada.nome.toLowerCase();
    const padded = padDex(entrada.dex);
    const num = String(entrada.dex);
    const bateBusca =
      !busca ||
      nomeBusca.includes(busca) ||
      padded.includes(busca) ||
      num.includes(busca);
    return (
      bateBusca &&
      bateFiltroStatus(entrada.key, filtro) &&
      bateTipos(entrada, tipos)
    );
  }

  function apresentar(card, entrada, forcar) {
    const status = getSpeciesDexStatus(entrada.key);
    if (forcar || card.dataset.status !== status) {
      aplicarCard(card, entrada, status);
    }
    card.hidden = !cardBate(card, entrada, status);
  }

  function anexarPedaco() {
    if (!montando) return;
    const inicio = performance.now();
    const frag = document.createDocumentFragment();
    let n = 0;
    while (cursor < lista.length && n < PEDACO) {
      const entrada = lista[cursor];
      const card = criarCascaCard(entrada);
      apresentar(card, entrada, true);
      frag.append(card);
      cursor += 1;
      n += 1;
      if (performance.now() - inicio >= ORCAMENTO_MS) break;
    }
    gradeEl.append(frag);
    if (cursor < lista.length) {
      raf = requestAnimationFrame(anexarPedaco);
      return;
    }
    montando = false;
    montada = true;
    raf = 0;
  }

  function iniciarMontagem() {
    if (montada || montando || !gradeEl) return;
    montando = true;
    cursor = 0;
    gradeEl.replaceChildren();
    raf = requestAnimationFrame(anexarPedaco);
  }

  function cancelarMontagem() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    montando = false;
  }

  function aplicarFiltros(forcar = false) {
    if (!gradeEl || (!montada && !montando)) return;
    const cards = gradeEl.querySelectorAll(".pokedex-hud__card");
    for (const card of cards) {
      const key = card.dataset.speciesKey ?? "";
      const entrada = porChave.get(key);
      if (!entrada) continue;
      apresentar(card, entrada, forcar);
    }
  }

  /**
   * @param {HTMLElement[]} botoes
   * @param {FiltroDex} filtroAtivo
   */
  function sincronizarBotoesFiltro(botoes, filtroAtivo) {
    for (const btn of botoes) {
      btn.classList.toggle("is-active", btn.dataset.pokedexFilter === filtroAtivo);
      btn.classList.toggle(
        "pokedex-hud__filter--caught",
        btn.dataset.pokedexFilter === "caught",
      );
      btn.classList.toggle(
        "pokedex-hud__filter--seen",
        btn.dataset.pokedexFilter === "seen",
      );
      btn.classList.toggle(
        "pokedex-hud__filter--unseen",
        btn.dataset.pokedexFilter === "unseen",
      );
    }
  }

  return {
    estaMontada: () => montada,
    estaMontando: () => montando,
    iniciarMontagem,
    cancelarMontagem,
    aplicarFiltros,
    sincronizarBotoesFiltro,
  };
}
