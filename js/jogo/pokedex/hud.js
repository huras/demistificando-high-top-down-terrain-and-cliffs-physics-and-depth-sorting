/**
 * HUD da Pokédex (lista + filtros + resumo).
 *
 * Shell HTML esperado (data-*):
 *   #pokedex-hud.pokedex-hud[hidden]
 *     .pokedex-hud__backdrop
 *     .pokedex-hud__device
 *       header.pokedex-hud__header  (#pokedex-hud-title, .pokedex-hud__close)
 *       .pokedex-hud__screen
 *         [data-pokedex-type-field]
 *         .pokedex-hud__screen-body
 *           [data-pokedex-list]
 *             [data-pokedex-toolbar]
 *               input[data-pokedex-search]
 *               .pokedex-hud__filters > button[data-pokedex-filter=all|caught|seen|unseen]
 *               [data-pokedex-type-filters]
 *             [data-pokedex-grid]
 *           #pokedex-detail[data-pokedex-detail-panel]  (ver detalhe.js)
 *         .pokedex-hud__flood / .pokedex-hud__shine
 *       footer.pokedex-hud__footer
 *         [data-pokedex-eval] [data-pokedex-summary]
 *         [data-pokedex-regions] [data-pokedex-legend]
 */

import { listarEspecies } from "../../pokemon/dados.js";
import { COR_TIPO, nomeTipo } from "../../pokemon/tipos.js";
import { temChave } from "../estado.js";
import { t } from "../i18n.js";
import {
  progressoDex,
  progressoPorGeracao,
} from "./progresso.js";
import {
  criarGradePokedex,
  MAX_FILTROS_TIPO,
  META_STATUS,
  ORDEM_TIPOS,
} from "./hudGrade.js";
import {
  medirAlturaTela,
  tocarEntradaPokedex,
  tocarSaidaPokedex,
} from "./hudMotion.js";
import { montarDetalhePokedex } from "./detalhe.js";

/** @typedef {import("./hudGrade.js").FiltroDex} FiltroDex */

const REGIOES = Object.freeze([
  { gen: 1, nomeKey: "pokedex.regiaoKanto" },
  { gen: 2, nomeKey: "pokedex.regiaoJohto" },
  { gen: 3, nomeKey: "pokedex.regiaoHoenn" },
  { gen: 4, nomeKey: "pokedex.regiaoSinnoh" },
]);

const API_VAZIA = {
  abrir: () => false,
  fechar: () => false,
  toggle: () => false,
  abrirEntrada: () => false,
  estaAberta: () => false,
  atualizar: () => {},
  open: () => false,
  close: () => false,
  openForEntry: () => false,
  isOpen: () => false,
  refresh: () => {},
};

/**
 * @param {HTMLElement | null} root
 * @param {{
 *   detalhe?: ReturnType<typeof montarDetalhePokedex>,
 *   podeAbrir?: () => boolean,
 *   aoMudarAberto?: (aberto: boolean) => void,
 * }} [opts]
 */
export function montarHudPokedex(root, opts = {}) {
  if (!(root instanceof HTMLElement)) return API_VAZIA;

  const gradeEl = root.querySelector("[data-pokedex-grid]");
  const searchEl = root.querySelector("[data-pokedex-search]");
  const summaryEl = root.querySelector("[data-pokedex-summary]");
  const regionsEl = root.querySelector("[data-pokedex-regions]");
  const legendEl = root.querySelector("[data-pokedex-legend]");
  const evalEl = root.querySelector("[data-pokedex-eval]");
  const closeBtn = root.querySelector(".pokedex-hud__close");
  const titleEl = root.querySelector("#pokedex-hud-title");
  const typeFiltersEl = root.querySelector("[data-pokedex-type-filters]");
  const deviceEl = root.querySelector(".pokedex-hud__device");
  /** @type {HTMLButtonElement[]} */
  const filterButtons = [...root.querySelectorAll("[data-pokedex-filter]")];

  const detalheRoot =
    root.querySelector("#pokedex-detail") ||
    root.querySelector("[data-pokedex-detail-panel]");
  const detalhe =
    opts.detalhe ||
    montarDetalhePokedex(
      detalheRoot instanceof HTMLElement ? detalheRoot : null,
      {
        aoFechar: () => sairEntrada(),
      },
    );

  /** @type {FiltroDex} */
  let filtroAtivo = "all";
  /** @type {string[]} */
  let tiposAtivos = [];
  let busca = "";
  /** @type {(() => void) | null} */
  let cancelarEntrada = null;
  /** @type {(() => void) | null} */
  let cancelarSaida = null;
  let saindo = false;
  let pendenteEntrada = false;
  /** @type {string | null} */
  let chavePendente = null;

  const lista = listarEspecies()
    .map((esp) => ({
      key: esp.key,
      dex: esp.dex | 0,
      nome: esp.nome || esp.name || esp.key,
      tipos: Array.isArray(esp.tipos) ? esp.tipos.slice() : [],
    }))
    .sort((a, b) => a.dex - b.dex);

  const porChave = new Map(lista.map((e) => [e.key, e]));

  const grade = gradeEl
    ? criarGradePokedex({
        gradeEl,
        lista,
        porChave,
        estadoFiltro: () => ({
          busca,
          filtro: filtroAtivo,
          tipos: tiposAtivos,
        }),
      })
    : null;

  function desbloqueada() {
    return temChave("pokedex");
  }

  function hudVisivel() {
    return !root.hidden;
  }

  function estaAberta() {
    return hudVisivel() || saindo;
  }

  function setAberto(aberto) {
    opts.aoMudarAberto?.(aberto);
  }

  function pintarResumo() {
    const counts = progressoDex();
    if (summaryEl) {
      summaryEl.textContent = t("pokedex.resumo", counts);
    }
    if (evalEl) {
      const pct =
        counts.total > 0 ? Math.floor((100 * counts.caught) / counts.total) : 0;
      evalEl.textContent = `${t("pokedex.evalTitulo")} — ${t("pokedex.evalImpressao", {
        percent: pct,
      })}`;
    }

    if (regionsEl) {
      regionsEl.setAttribute("aria-label", t("pokedex.regioesGrupo"));
      regionsEl.replaceChildren();
      const gens = progressoPorGeracao();
      const porGen = new Map(gens.map((g) => [g.gen, g]));
      const frag = document.createDocumentFragment();
      for (const reg of REGIOES) {
        const row = porGen.get(reg.gen);
        const percent = Number.isFinite(row?.percent) ? row.percent : 0;
        const nome = t(reg.nomeKey);
        const chip = document.createElement("span");
        chip.className = "pokedex-hud__region-chip";
        chip.title = t("pokedex.regiaoPct", { nome, percent });
        const nameSpan = document.createElement("span");
        nameSpan.className = "pokedex-hud__region-name";
        nameSpan.textContent = nome;
        const pctSpan = document.createElement("span");
        pctSpan.className = "pokedex-hud__region-pct";
        pctSpan.textContent = `${percent}%`;
        chip.append(nameSpan, pctSpan);
        frag.append(chip);
      }
      const totalPct =
        counts.total > 0 ? Math.floor((100 * counts.caught) / counts.total) : 0;
      const totalChip = document.createElement("span");
      totalChip.className = "pokedex-hud__region-chip pokedex-hud__region-chip--total";
      totalChip.title = t("pokedex.regiaoPct", {
        nome: t("pokedex.regiaoTotal"),
        percent: totalPct,
      });
      const tn = document.createElement("span");
      tn.className = "pokedex-hud__region-name";
      tn.textContent = t("pokedex.regiaoTotal");
      const tp = document.createElement("span");
      tp.className = "pokedex-hud__region-pct";
      tp.textContent = `${totalPct}%`;
      totalChip.append(tn, tp);
      frag.append(totalChip);
      regionsEl.append(frag);
    }

    if (legendEl) {
      legendEl.replaceChildren();
      const frag = document.createDocumentFragment();
      for (const key of /** @type {const} */ (["caught", "seen", "unseen"])) {
        const meta = META_STATUS[key];
        const count =
          key === "caught"
            ? counts.caught
            : key === "seen"
              ? counts.seenOnly
              : counts.unseen;
        const label =
          key === "caught"
            ? t("pokedex.legendaCapturado")
            : key === "seen"
              ? t("pokedex.legendaVisto")
              : t("pokedex.legendaNaoVisto");
        const chip = document.createElement("span");
        chip.className = `pokedex-hud__legend-chip pokedex-hud__legend-chip--${key}`;
        chip.innerHTML = `<span class="pokedex-hud__legend-icon">${meta.svg}</span><span class="pokedex-hud__legend-text">${label} ${count}</span>`;
        frag.append(chip);
      }
      legendEl.append(frag);
    }

    for (const btn of filterButtons) {
      const filter = btn.dataset.pokedexFilter;
      if (!filter || filter === "all") {
        btn.textContent = t("pokedex.filtroTodos");
        continue;
      }
      const count =
        filter === "caught"
          ? counts.caught
          : filter === "seen"
            ? counts.seenOnly
            : counts.unseen;
      const label =
        filter === "caught"
          ? t("pokedex.filtroCapturado")
          : filter === "seen"
            ? t("pokedex.filtroVisto")
            : t("pokedex.filtroNaoVisto");
      btn.textContent = `${label} (${count})`;
    }
  }

  function aplicarLista() {
    if (!grade) return;
    grade.aplicarFiltros();
    grade.sincronizarBotoesFiltro(filterButtons, filtroAtivo);
    syncTipoUi();
    pintarResumo();
  }

  function syncTipoUi() {
    if (!typeFiltersEl) return;
    const noLimite = tiposAtivos.length >= MAX_FILTROS_TIPO;
    for (const btn of typeFiltersEl.querySelectorAll("[data-pokedex-type]")) {
      if (!(btn instanceof HTMLElement)) continue;
      const tipo = btn.dataset.pokedexType ?? "";
      const on = tiposAtivos.includes(tipo);
      btn.classList.toggle("is-active", on);
      btn.classList.toggle("is-muted", noLimite && !on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const clearBtn = typeFiltersEl.querySelector("[data-pokedex-type-clear]");
    if (clearBtn instanceof HTMLElement) {
      clearBtn.hidden = tiposAtivos.length === 0;
    }
  }

  function toggleTipo(tipo) {
    const idx = tiposAtivos.indexOf(tipo);
    if (idx >= 0) {
      tiposAtivos = tiposAtivos.filter((x) => x !== tipo);
    } else if (tiposAtivos.length < MAX_FILTROS_TIPO) {
      tiposAtivos = [...tiposAtivos, tipo];
    } else {
      tiposAtivos = [tiposAtivos[1], tiposAtivos[2], tipo];
    }
    syncTipoUi();
    aplicarLista();
  }

  function limparTipos() {
    if (!tiposAtivos.length) return;
    tiposAtivos = [];
    syncTipoUi();
    aplicarLista();
  }

  function montarFiltrosTipo() {
    if (!typeFiltersEl || typeFiltersEl.dataset.built === "1") return;
    typeFiltersEl.dataset.built = "1";
    typeFiltersEl.setAttribute("aria-label", t("pokedex.filtroTipoGrupo"));

    const hint = document.createElement("span");
    hint.className = "pokedex-hud__type-hint";
    hint.dataset.pokedexTypeHint = "";
    hint.textContent = t("pokedex.filtroTipoDica");
    typeFiltersEl.append(hint);

    for (const tipo of ORDEM_TIPOS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pokedex-hud__type-filter";
      btn.dataset.pokedexType = tipo;
      btn.style.setProperty("--type", COR_TIPO[tipo] ?? "#64748b");
      btn.setAttribute("aria-pressed", "false");
      const label = nomeTipo(tipo);
      btn.title = label;
      btn.setAttribute("aria-label", label);
      const icon = document.createElement("span");
      icon.className = "type-icon";
      icon.style.background = COR_TIPO[tipo] ?? "#64748b";
      icon.setAttribute("aria-hidden", "true");
      btn.append(icon);
      btn.addEventListener("click", () => toggleTipo(tipo));
      typeFiltersEl.append(btn);
    }

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "pokedex-hud__type-clear";
    clearBtn.dataset.pokedexTypeClear = "";
    clearBtn.hidden = true;
    clearBtn.textContent = t("pokedex.filtroTipoLimpar");
    clearBtn.addEventListener("click", () => limparTipos());
    typeFiltersEl.append(clearBtn);
  }

  function mostrarEntrada() {
    root.classList.add("is-entry");
    medirAlturaTela(deviceEl);
  }

  function sairEntrada() {
    if (!estaAberta() || saindo) return false;
    detalhe.fechar?.({ silencioso: true });
    if (!desbloqueada()) return fechar();
    root.classList.remove("is-entry");
    medirAlturaTela(deviceEl);
    if (grade && !grade.estaMontada() && !grade.estaMontando()) {
      grade.iniciarMontagem();
      aplicarLista();
    }
    return true;
  }

  function esconderFim() {
    cancelarSaida = null;
    saindo = false;
    root.classList.remove("is-entry");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    setAberto(false);
  }

  function revelarTela() {
    if (grade?.estaMontada()) {
      aplicarLista();
      return;
    }
    grade?.iniciarMontagem();
    aplicarLista();
  }

  function revelarHud() {
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    if (pendenteEntrada) {
      mostrarEntrada();
      if (chavePendente) {
        detalhe.abrir?.(chavePendente);
        chavePendente = null;
      }
    } else {
      root.classList.remove("is-entry");
    }
    cancelarEntrada?.();
    cancelarEntrada = tocarEntradaPokedex(root, {
      aoTelaPronta: () => {
        if (!root.classList.contains("is-entry")) revelarTela();
      },
      aoTerminar: () => {
        cancelarEntrada = null;
      },
    });
    closeBtn?.focus?.();
  }

  function fechar() {
    if (root.hidden && !saindo) return false;
    if (saindo) return true;
    detalhe.fechar?.({ silencioso: true });
    cancelarEntrada?.();
    cancelarEntrada = null;
    grade?.cancelarMontagem();
    saindo = true;
    cancelarSaida = tocarSaidaPokedex(root, esconderFim);
    return true;
  }

  /**
   * @param {{ paraEntrada?: boolean, chave?: string }} [cfg]
   */
  function abrir(cfg = {}) {
    const paraEntrada = !!cfg.paraEntrada;
    if (!paraEntrada && !desbloqueada()) return false;
    if (opts.podeAbrir && !opts.podeAbrir()) return false;

    if (saindo) {
      cancelarSaida?.();
      cancelarSaida = null;
      saindo = false;
    }

    if (hudVisivel()) {
      pendenteEntrada = paraEntrada;
      if (paraEntrada) {
        mostrarEntrada();
        if (cfg.chave) detalhe.abrir?.(cfg.chave);
      } else {
        root.classList.remove("is-entry");
        detalhe.fechar?.({ silencioso: true });
      }
      return true;
    }

    pendenteEntrada = paraEntrada;
    chavePendente = paraEntrada && cfg.chave ? String(cfg.chave) : null;
    if (!paraEntrada) {
      busca = "";
      if (searchEl instanceof HTMLInputElement) searchEl.value = "";
      filtroAtivo = "all";
      tiposAtivos = [];
      syncTipoUi();
      pintarResumo();
      grade?.sincronizarBotoesFiltro(filterButtons, filtroAtivo);
      root.classList.remove("is-entry");
    }
    setAberto(true);
    revelarHud();
    return true;
  }

  /**
   * @param {string} [chave]
   */
  function abrirEntrada(chave) {
    return abrir({ paraEntrada: true, chave: chave || undefined });
  }

  function toggle() {
    if (estaAberta() && !saindo) return fechar();
    return abrir();
  }

  function atualizar() {
    pintarResumo();
    if (!estaAberta() || saindo) return;
    if (grade && (grade.estaMontada() || grade.estaMontando())) aplicarLista();
  }

  function atualizarRotulos() {
    if (closeBtn) closeBtn.setAttribute("aria-label", t("pokedex.fechar"));
    if (searchEl instanceof HTMLInputElement) {
      searchEl.placeholder = t("pokedex.busca");
    }
    if (titleEl) titleEl.textContent = t("pokedex.titulo");
    if (typeFiltersEl) {
      typeFiltersEl.setAttribute("aria-label", t("pokedex.filtroTipoGrupo"));
      const hint = typeFiltersEl.querySelector("[data-pokedex-type-hint]");
      if (hint) hint.textContent = t("pokedex.filtroTipoDica");
      const clearBtn = typeFiltersEl.querySelector("[data-pokedex-type-clear]");
      if (clearBtn) clearBtn.textContent = t("pokedex.filtroTipoLimpar");
    }
    pintarResumo();
    if (estaAberta() && !saindo && grade?.estaMontada()) {
      grade.aplicarFiltros(true);
      grade.sincronizarBotoesFiltro(filterButtons, filtroAtivo);
    }
  }

  root.querySelector(".pokedex-hud__backdrop")?.addEventListener("click", () => {
    fechar();
  });
  closeBtn?.addEventListener("click", () => fechar());

  function tentarAbrirEntrada(card) {
    if (!(card instanceof HTMLElement)) return;
    if (!card.classList.contains("is-interactive")) return;
    const key = card.dataset.speciesKey;
    if (!key) return;
    if (detalhe.abrir?.(key)) mostrarEntrada();
  }

  gradeEl?.addEventListener("click", (e) => {
    const card = e.target?.closest?.(".pokedex-hud__card");
    tentarAbrirEntrada(card);
  });

  gradeEl?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target?.closest?.(".pokedex-hud__card");
    if (!(card instanceof HTMLElement)) return;
    e.preventDefault();
    tentarAbrirEntrada(card);
  });

  for (const btn of filterButtons) {
    btn.addEventListener("click", () => {
      const next = btn.dataset.pokedexFilter;
      if (!next) return;
      filtroAtivo = /** @type {FiltroDex} */ (next);
      aplicarLista();
    });
  }

  searchEl?.addEventListener("input", () => {
    busca = String(
      searchEl instanceof HTMLInputElement ? searchEl.value : "",
    )
      .trim()
      .toLowerCase();
    aplicarLista();
  });

  montarFiltrosTipo();
  syncTipoUi();
  atualizarRotulos();

  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (detalhe.estaAberta?.()) {
      detalhe.fechar();
      return;
    }
    fechar();
  });

  let resizeRaf = 0;
  function onViewport() {
    if (!estaAberta() || saindo) return;
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!estaAberta() || saindo) return;
      medirAlturaTela(deviceEl);
    });
  }
  window.addEventListener("resize", onViewport);
  window.addEventListener("orientationchange", onViewport);

  return {
    abrir,
    fechar,
    toggle,
    abrirEntrada,
    sairEntrada,
    mostrarEntrada,
    estaAberta,
    atualizar,
    atualizarRotulos,
    open: abrir,
    close: fechar,
    openForEntry: abrirEntrada,
    leaveEntry: sairEntrada,
    showEntryView: mostrarEntrada,
    isOpen: estaAberta,
    refresh: atualizar,
    refreshLabels: atualizarRotulos,
  };
}

export const mountPokedexHud = montarHudPokedex;
