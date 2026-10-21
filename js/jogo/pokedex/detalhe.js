/**
 * Modal de detalhe da Pokédex (abas: visão geral, golpes, breeding, treino).
 */

import { especie, golpe } from "../../pokemon/dados.js";
import { COR_TIPO, nomeTipo } from "../../pokemon/tipos.js";
import { getSpeciesDexStatus } from "./progresso.js";
import { listarHabitats } from "./habitat.js";
import { padDex } from "./hudGrade.js";
import { t } from "../i18n.js";

/** @typedef {'overview' | 'moves' | 'breeding' | 'training'} AbaDetalhe */

const ABAS = Object.freeze(["overview", "moves", "breeding", "training"]);

const LINHAS_STAT = Object.freeze([
  { key: "hp", rotulo: "pokedex.detail.statHp" },
  { key: "atk", rotulo: "pokedex.detail.statAtk" },
  { key: "def", rotulo: "pokedex.detail.statDef" },
  { key: "spa", rotulo: "pokedex.detail.statSpa" },
  { key: "spd", rotulo: "pokedex.detail.statSpd" },
  { key: "spe", rotulo: "pokedex.detail.statSpe" },
]);

const STAT_MAX = 255;

const CRESCIMENTO = Object.freeze({
  fast: "pokedex.detail.growthFast",
  mediumFast: "pokedex.detail.growthMediumFast",
  mediumSlow: "pokedex.detail.growthMediumSlow",
  slow: "pokedex.detail.growthSlow",
  erratic: "pokedex.detail.growthErratic",
  fluctuating: "pokedex.detail.growthFluctuating",
});

const API_VAZIA = {
  abrir: () => false,
  fechar: () => false,
  estaAberta: () => false,
  open: () => false,
  close: () => false,
  isOpen: () => false,
};

/**
 * @param {HTMLElement | null} root
 * @param {{
 *   aoFechar?: () => void,
 *   podeAbrir?: () => boolean,
 * }} [opts]
 */
export function montarDetalhePokedex(root, opts = {}) {
  if (!(root instanceof HTMLElement)) return API_VAZIA;

  const fecharBtn = root.querySelector("[data-pokedex-detail-close]");
  const retratoEl = root.querySelector("[data-pokedex-detail-portrait]");
  const numEl = root.querySelector("[data-pokedex-detail-num]");
  const nomeEl = root.querySelector("[data-pokedex-detail-name]");
  const genusEl = root.querySelector("[data-pokedex-detail-genus]");
  const tiposEl = root.querySelector("[data-pokedex-detail-types]");
  const corpoEl = root.querySelector("[data-pokedex-detail-body]");
  const flavorEl = root.querySelector("[data-pokedex-detail-flavor]");
  const habilidadesEl = root.querySelector("[data-pokedex-detail-abilities]");
  const statsEl = root.querySelector("[data-pokedex-detail-stats]");
  const locaisEl = root.querySelector("[data-pokedex-detail-locations]");
  const habitatVazioEl = root.querySelector("[data-pokedex-detail-habitat-empty]");
  const eggGroupsEl = root.querySelector("[data-pokedex-detail-egg-groups]");
  const genderEl = root.querySelector("[data-pokedex-detail-gender]");
  const hatchEl = root.querySelector("[data-pokedex-detail-hatch]");
  const catchEl = root.querySelector("[data-pokedex-detail-catch]");
  const growthEl = root.querySelector("[data-pokedex-detail-growth]");
  const baseExpEl = root.querySelector("[data-pokedex-detail-basexp]");
  const learnsetEl = root.querySelector("[data-pokedex-detail-learnset]");
  const learnsetTitleEl = root.querySelector("[data-pokedex-detail-learnset-title]");
  const panes = [...root.querySelectorAll("[data-pokedex-detail-pane]")];
  /** @type {HTMLButtonElement[]} */
  const tabBtns = [...root.querySelectorAll("[data-pokedex-detail-tab]")];

  /** @type {string | null} */
  let chaveAtiva = null;
  /** @type {AbaDetalhe} */
  let aba = "overview";

  function estaAberta() {
    return !root.hidden;
  }

  function setAba(proxima) {
    aba = ABAS.includes(proxima) ? proxima : "overview";
    for (const btn of tabBtns) {
      const id = btn.dataset.pokedexDetailTab;
      const on = id === aba;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", String(on));
    }
    for (const pane of panes) {
      pane.hidden = pane.getAttribute("data-pokedex-detail-pane") !== aba;
    }
  }

  function formatarAltura(m) {
    if (!Number.isFinite(m)) return "";
    return t("pokedex.detail.altura", { m: m.toFixed(1) });
  }

  function formatarPeso(kg) {
    if (!Number.isFinite(kg)) return "";
    return t("pokedex.detail.peso", { kg: kg.toFixed(1) });
  }

  function formatarGenero(rate) {
    if (!Number.isFinite(rate) || rate < 0) return t("pokedex.detail.semGenero");
    const fem = rate * 12.5;
    const masc = 100 - fem;
    return t("pokedex.detail.generoRatio", {
      male: masc.toFixed(1),
      female: fem.toFixed(1),
    });
  }

  function pintarTipos(tipos) {
    if (!tiposEl) return;
    tiposEl.replaceChildren();
    const lista = Array.isArray(tipos) ? tipos : [];
    for (let i = 0; i < lista.length; i++) {
      const tipo = lista[i];
      const chip = document.createElement("span");
      chip.className = "pokedex-detail__type type-icon";
      chip.style.setProperty("--type", COR_TIPO[tipo] || "#64748b");
      chip.textContent = nomeTipo(tipo);
      chip.title = nomeTipo(tipo);
      tiposEl.append(chip);
    }
  }

  function pintarStats(esp) {
    if (!statsEl) return;
    statsEl.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const row of LINHAS_STAT) {
      const valor = Number(esp?.[row.key] ?? 0);
      const item = document.createElement("div");
      item.className = "pokedex-detail__stat";
      const label = document.createElement("span");
      label.className = "pokedex-detail__stat-label";
      label.textContent = t(row.rotulo);
      const barWrap = document.createElement("div");
      barWrap.className = "pokedex-detail__stat-bar";
      const fill = document.createElement("div");
      fill.className = "pokedex-detail__stat-fill";
      fill.style.width = `${Math.max(4, Math.min(100, (valor / STAT_MAX) * 100))}%`;
      barWrap.append(fill);
      const num = document.createElement("span");
      num.className = "pokedex-detail__stat-value";
      num.textContent = String(valor);
      item.append(label, barWrap, num);
      frag.append(item);
    }
    statsEl.append(frag);
  }

  function pintarHabilidades(esp) {
    if (!habilidadesEl) return;
    habilidadesEl.replaceChildren();
    const lista = Array.isArray(esp?.habilidades) ? esp.habilidades : [];
    if (!lista.length) {
      const vazio = document.createElement("p");
      vazio.className = "pokedex-detail__empty";
      vazio.textContent = t("pokedex.detail.habilidadesVazio");
      habilidadesEl.append(vazio);
      return;
    }
    for (let i = 0; i < lista.length; i++) {
      const item = lista[i];
      const key = typeof item === "string" ? item : item?.key || "";
      const oculto = typeof item === "object" && !!item?.hidden;
      const row = document.createElement("div");
      row.className = "pokedex-detail__ability";
      const head = document.createElement("div");
      head.className = "pokedex-detail__ability-head";
      const nome = document.createElement("strong");
      nome.textContent = key;
      head.append(nome);
      if (oculto) {
        const tag = document.createElement("span");
        tag.className = "pokedex-detail__ability-hidden";
        tag.textContent = t("pokedex.detail.habilidadeOculta");
        head.append(tag);
      }
      row.append(head);
      habilidadesEl.append(row);
    }
  }

  function pintarHabitat(chave) {
    const nomes = listarHabitats(chave);
    if (locaisEl) {
      if (nomes.length) {
        locaisEl.hidden = false;
        locaisEl.textContent = nomes.join(" · ");
      } else {
        locaisEl.hidden = true;
        locaisEl.textContent = "";
      }
    }
    if (habitatVazioEl) {
      habitatVazioEl.hidden = nomes.length > 0;
    }
  }

  function pintarLearnset(esp) {
    if (!learnsetEl) return;
    learnsetEl.replaceChildren();
    if (learnsetTitleEl) {
      learnsetTitleEl.textContent = t("pokedex.detail.learnsetTitle");
    }
    const lista = Array.isArray(esp?.learnset) ? esp.learnset : [];
    if (!lista.length) {
      const vazio = document.createElement("p");
      vazio.className = "pokedex-detail__learnset-empty";
      vazio.textContent = t("pokedex.detail.learnsetEmpty");
      learnsetEl.append(vazio);
      return;
    }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < lista.length; i++) {
      const passo = lista[i];
      let nivel = 0;
      let moveKey = "";
      if (Array.isArray(passo)) {
        nivel = passo[0] | 0;
        moveKey = String(passo[1] || "");
      } else {
        nivel = passo?.level | 0;
        moveKey = String(passo?.move || "");
      }
      const def = golpe(moveKey);
      const row = document.createElement("div");
      row.className = "pokedex-detail__learn-row";
      const lv = document.createElement("span");
      lv.className = "pokedex-detail__learn-level";
      lv.textContent = t("pokedex.detail.learnLevel", { level: nivel });
      const nome = document.createElement("span");
      nome.className = "pokedex-detail__learn-name";
      nome.textContent = def?.nome || moveKey;
      const meta = document.createElement("span");
      meta.className = "pokedex-detail__learn-meta";
      if (def?.tipo) {
        const tipo = document.createElement("span");
        tipo.className = "type-icon";
        tipo.style.setProperty("--type", COR_TIPO[def.tipo] || "#64748b");
        tipo.textContent = nomeTipo(def.tipo);
        meta.append(tipo);
      }
      if (def?.poder > 0) {
        const poder = document.createElement("span");
        poder.className = "pokedex-detail__learn-power";
        poder.textContent = String(def.poder);
        meta.append(poder);
      }
      row.append(lv, nome, meta);
      frag.append(row);
    }
    learnsetEl.append(frag);
  }

  function pintarBreeding(esp) {
    if (eggGroupsEl) {
      eggGroupsEl.replaceChildren();
      const grupos = Array.isArray(esp?.gruposOvo) ? esp.gruposOvo : [];
      if (!grupos.length) {
        eggGroupsEl.textContent = t("pokedex.detail.placeholder");
      } else {
        for (let i = 0; i < grupos.length; i++) {
          const chip = document.createElement("span");
          chip.className = "pokedex-detail__egg-chip";
          chip.textContent = grupos[i];
          eggGroupsEl.append(chip);
        }
      }
    }
    if (genderEl) genderEl.textContent = formatarGenero(Number(esp?.genero));
    if (hatchEl) {
      const ciclos = esp?.ciclosOvo;
      hatchEl.textContent = Number.isFinite(ciclos)
        ? t("pokedex.detail.hatchCiclos", { n: ciclos })
        : t("pokedex.detail.placeholder");
    }
  }

  function pintarTreino(esp) {
    if (catchEl) {
      catchEl.textContent = String(esp?.captura ?? "—");
    }
    if (growthEl) {
      const chave = CRESCIMENTO[esp?.crescimento] || null;
      growthEl.textContent = chave ? t(chave) : esp?.crescimento || "—";
    }
    if (baseExpEl) {
      baseExpEl.textContent = String(esp?.baseExp ?? "—");
    }
  }

  function pintar(chave) {
    const esp = especie(chave);
    if (!esp) return false;
    const status = getSpeciesDexStatus(chave);
    if (status === "unseen") return false;

    chaveAtiva = chave;
    if (retratoEl instanceof HTMLImageElement) {
      retratoEl.src = `/ref/sprites/pokemon-portraits/${esp.dex | 0}.png`;
      retratoEl.alt = esp.nome || chave;
    }
    if (numEl) numEl.textContent = `#${padDex(esp.dex)}`;
    if (nomeEl) nomeEl.textContent = esp.nome || chave;
    if (genusEl) genusEl.textContent = esp.categoria || "";
    pintarTipos(esp.tipos);

    const partesCorpo = [];
    if (Number.isFinite(esp.altura)) partesCorpo.push(formatarAltura(esp.altura));
    if (Number.isFinite(esp.peso)) partesCorpo.push(formatarPeso(esp.peso));
    if (corpoEl) corpoEl.textContent = partesCorpo.join(" · ");

    if (flavorEl) {
      flavorEl.textContent =
        status === "caught"
          ? esp.flavor || t("pokedex.detail.flavorVazio")
          : t("pokedex.detail.flavorSoCapturado");
    }

    pintarHabilidades(esp);
    pintarStats(esp);
    pintarHabitat(chave);
    pintarLearnset(esp);
    pintarBreeding(esp);
    pintarTreino(esp);
    setAba(aba);
    return true;
  }

  function fechar(opcoes = {}) {
    if (root.hidden) return false;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    chaveAtiva = null;
    if (!opcoes.silencioso) opts.aoFechar?.();
    return true;
  }

  /**
   * @param {string} chave
   * @param {{ aba?: AbaDetalhe }} [cfg]
   */
  function abrir(chave, cfg = {}) {
    if (opts.podeAbrir && !opts.podeAbrir()) return false;
    const key = String(chave || "");
    if (!key) return false;
    if (cfg.aba) aba = cfg.aba;
    if (!pintar(key)) return false;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    fecharBtn?.focus?.();
    return true;
  }

  fecharBtn?.addEventListener("click", () => fechar());
  for (const btn of tabBtns) {
    btn.addEventListener("click", () => {
      const id = /** @type {AbaDetalhe} */ (btn.dataset.pokedexDetailTab);
      setAba(id);
    });
  }

  setAba("overview");

  return {
    abrir,
    fechar,
    estaAberta,
    open: abrir,
    close: fechar,
    isOpen: estaAberta,
  };
}

export const mountPokedexDetail = montarDetalhePokedex;
