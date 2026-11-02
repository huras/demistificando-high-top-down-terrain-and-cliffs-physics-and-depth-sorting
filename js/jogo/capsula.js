/**
 * HUD da cápsula do laboratório — overlay teal (parity Pokémon AI incubator).
 *
 *   #capsula-hud.capsula-hud[hidden]
 *     .capsula-hud__backdrop
 *     .capsula-hud__device
 *       header + screen (busca, nível, filtros de tipo, grade)
 */

import { COR_TIPO, nomeTipo } from "../pokemon/tipos.js";
import { listarEspecies } from "../pokemon/dados.js";
import { POKEMON } from "../config.js";
import { darDaCapsula, montarTimeCapsula } from "./laboratorio.js";
import { estado, avisar } from "./estado.js";
import { criarIconeTipo, garantirAtlasTipo } from "./tipoEscudo.js";

const NIVEL_PADRAO = 50;
const MAX_FILTROS_TIPO = 2;

const ORDEM_TIPOS = Object.freeze([
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

/** @type {{ key: string, dex: number, nome: string, tipos: readonly string[], busca: string }[] | null} */
let catalogoCache = null;

function listarCatalogo() {
  if (catalogoCache) return catalogoCache;
  const saida = [];
  const todos = listarEspecies();
  for (let i = 0; i < todos.length; i++) {
    const esp = todos[i];
    if (!esp) continue;
    const nome = esp.nome ?? esp.key;
    const dex = esp.dex | 0;
    const tipos = esp.tipos ?? [];
    saida.push({
      key: esp.key,
      dex,
      nome,
      tipos,
      busca: `${nome} ${esp.key} ${String(dex).padStart(3, "0")}`.toLowerCase(),
    });
  }
  saida.sort((a, b) => a.dex - b.dex);
  catalogoCache = Object.freeze(saida);
  return catalogoCache;
}

function casaComFiltros(entry, query, tipos) {
  if (query && !entry.busca.includes(query)) return false;
  if (!tipos.length) return true;
  for (let i = 0; i < tipos.length; i++) {
    if (!entry.tipos?.includes(tipos[i])) return false;
  }
  return true;
}

/**
 * @param {HTMLElement | null} root
 * @param {{ aoMudarAberto?: (aberto: boolean) => void, podeAbrir?: () => boolean }} [opts]
 */
export function montarHudCapsula(root, opts = {}) {
  if (!root) {
    return {
      abrir: () => false,
      fechar: () => false,
      estaAberta: () => false,
      atualizarRotulos: () => {},
    };
  }

  const gradeEl = root.querySelector("[data-capsula-grade]");
  const buscaEl = root.querySelector("[data-capsula-busca]");
  const filtrosEl = root.querySelector("[data-capsula-tipos]");
  const nivelEl = root.querySelector("[data-capsula-nivel]");
  const darBtn = root.querySelector("[data-capsula-dar]");
  const aleatorioBtn = root.querySelector("[data-capsula-aleatorio]");
  const statusEl = root.querySelector("[data-capsula-status]");
  const fecharBtn = root.querySelector(".capsula-hud__close");
  const tituloEl = root.querySelector("#capsula-hud-titulo");
  const nivelLabelEl = root.querySelector("[data-capsula-nivel-label]");

  const catalogo = listarCatalogo();
  /** @type {Map<string, (typeof catalogo)[number]>} */
  const porChave = new Map(catalogo.map((sp) => [sp.key, sp]));

  let query = "";
  /** @type {string[]} */
  let tiposAtivos = [];
  /** @type {string | null} */
  let selecionada = null;
  let gradePronta = false;

  function estaAberta() {
    return !root.hidden;
  }

  function lerNivel() {
    const raw = nivelEl instanceof HTMLInputElement ? Number(nivelEl.value) : NIVEL_PADRAO;
    if (!Number.isFinite(raw)) return NIVEL_PADRAO;
    return Math.max(1, Math.min(100, Math.round(raw)));
  }

  function setStatus(texto) {
    if (statusEl) statusEl.textContent = texto || "";
  }

  function syncFiltrosTipo() {
    if (!filtrosEl) return;
    for (const btn of filtrosEl.querySelectorAll("[data-capsula-tipo]")) {
      const tipo = btn.dataset.capsulaTipo ?? "";
      const on = tiposAtivos.includes(tipo);
      btn.classList.toggle("is-active", on);
      btn.classList.toggle("is-muted", tiposAtivos.length > 0 && !on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const limpar = filtrosEl.querySelector("[data-capsula-tipo-limpar]");
    if (limpar) limpar.hidden = tiposAtivos.length === 0;
  }

  function alternarTipo(tipo) {
    const i = tiposAtivos.indexOf(tipo);
    if (i >= 0) tiposAtivos = tiposAtivos.filter((t) => t !== tipo);
    else if (tiposAtivos.length < MAX_FILTROS_TIPO) tiposAtivos = [...tiposAtivos, tipo];
    else tiposAtivos = [tiposAtivos[1], tipo];
    syncFiltrosTipo();
    aplicarFiltros();
  }

  function limparTipos() {
    tiposAtivos = [];
    syncFiltrosTipo();
    aplicarFiltros();
  }

  function montarFiltrosTipo() {
    if (!filtrosEl || filtrosEl.dataset.built === "1") return;
    filtrosEl.dataset.built = "1";
    filtrosEl.setAttribute("aria-label", "Filtro por tipo");

    const dica = document.createElement("span");
    dica.className = "capsula-hud__type-hint";
    dica.dataset.capsulaTipoDica = "";
    dica.textContent = "Tipos";
    filtrosEl.append(dica);

    garantirAtlasTipo();
    for (const tipo of ORDEM_TIPOS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "capsula-hud__type-filter";
      btn.dataset.capsulaTipo = tipo;
      btn.style.setProperty("--type", COR_TIPO[tipo] ?? "#64748b");
      btn.setAttribute("aria-pressed", "false");
      const label = nomeTipo(tipo);
      btn.title = label;
      btn.setAttribute("aria-label", label);
      const icon = criarIconeTipo(tipo, 22);
      icon.tabIndex = -1;
      icon.removeAttribute("aria-label");
      icon.style.setProperty("--type", COR_TIPO[tipo] ?? "#64748b");
      btn.append(icon);
      btn.addEventListener("click", () => alternarTipo(tipo));
      filtrosEl.append(btn);
    }

    const limpar = document.createElement("button");
    limpar.type = "button";
    limpar.className = "capsula-hud__type-clear";
    limpar.dataset.capsulaTipoLimpar = "";
    limpar.hidden = true;
    limpar.textContent = "Limpar";
    limpar.addEventListener("click", () => limparTipos());
    filtrosEl.append(limpar);
  }

  function montarGradeSePreciso() {
    if (!gradeEl || gradePronta) return;
    gradeEl.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const entry of catalogo) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "capsula-hud__card";
      card.dataset.speciesKey = entry.key;
      card.dataset.dex = String(entry.dex);

      const retratoWrap = document.createElement("div");
      retratoWrap.className = "capsula-hud__card-portrait";
      const img = document.createElement("img");
      img.className = "pokemon-portrait";
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      img.src = `/ref/sprites/pokemon-portraits/${entry.dex}.png`;
      retratoWrap.append(img);

      const num = document.createElement("span");
      num.className = "capsula-hud__card-num";
      num.textContent = `#${String(entry.dex).padStart(3, "0")}`;

      const nome = document.createElement("span");
      nome.className = "capsula-hud__card-name";
      nome.textContent = entry.nome;

      const tipoWrap = document.createElement("span");
      tipoWrap.className = "capsula-hud__card-type";
      for (const tipo of entry.tipos) {
        const icon = criarIconeTipo(tipo, 14);
        icon.style.setProperty("--type", COR_TIPO[tipo] ?? "#64748b");
        tipoWrap.append(icon);
      }

      card.append(retratoWrap, num, nome, tipoWrap);
      card.setAttribute("aria-label", entry.nome);
      frag.append(card);
    }
    gradeEl.append(frag);
    gradePronta = true;
  }

  function syncSelecao() {
    if (!gradeEl) return;
    for (const card of gradeEl.querySelectorAll(".capsula-hud__card")) {
      const on = card.dataset.speciesKey === selecionada;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (darBtn instanceof HTMLButtonElement) darBtn.disabled = !selecionada;
  }

  function aplicarFiltros() {
    if (!gradeEl) return;
    montarGradeSePreciso();
    for (const card of gradeEl.querySelectorAll(".capsula-hud__card")) {
      const key = card.dataset.speciesKey ?? "";
      const entry = porChave.get(key);
      card.hidden = !(entry && casaComFiltros(entry, query, tiposAtivos));
    }
    syncFiltrosTipo();
    syncSelecao();
  }

  function poolFiltrado() {
    const pool = [];
    for (const entry of catalogo) {
      if (casaComFiltros(entry, query, tiposAtivos)) pool.push(entry);
    }
    return pool;
  }

  function selecionar(key) {
    selecionada = key || null;
    syncSelecao();
    if (selecionada) {
      const entry = porChave.get(selecionada);
      if (entry) setStatus(`Selecionado: ${entry.nome}`);
    }
  }

  function concederSelecionada() {
    if (!selecionada) {
      setStatus("Escolha uma espécie primeiro.");
      return false;
    }
    const entry = porChave.get(selecionada);
    if (!entry) return false;
    const nivel = lerNivel();
    if (nivelEl instanceof HTMLInputElement) nivelEl.value = String(nivel);
    const ok = darDaCapsula(entry.key, nivel);
    if (!ok) {
      setStatus(estado.itemGet || "Não foi possível entregar.");
      return false;
    }
    setStatus(estado.itemGet || `${entry.nome} (Nv.${nivel}) entregue.`);
    return true;
  }

  function timeAleatorio() {
    const pool = poolFiltrado();
    if (!pool.length) {
      setStatus("Nenhuma espécie com esse filtro.");
      return false;
    }
    const nivel = lerNivel();
    if (nivelEl instanceof HTMLInputElement) nivelEl.value = String(nivel);
    const bag = pool.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    const chaves = [];
    for (let i = 0; i < POKEMON.PARTY_MAX; i++) chaves.push(bag[i % bag.length].key);
    const ok = montarTimeCapsula(chaves, nivel);
    if (!ok) {
      setStatus(estado.itemGet || "Não foi possível montar o time.");
      return false;
    }
    setStatus(estado.itemGet || `Time aleatório no nível ${nivel}.`);
    return true;
  }

  function atualizarRotulos() {
    if (tituloEl) tituloEl.textContent = "Cápsula";
    if (buscaEl instanceof HTMLInputElement) buscaEl.placeholder = "Nome ou número";
    if (nivelLabelEl) nivelLabelEl.textContent = "Nível";
    if (darBtn) darBtn.textContent = "Colocar no time";
    if (aleatorioBtn) aleatorioBtn.textContent = "Time aleatório";
    if (fecharBtn) fecharBtn.setAttribute("aria-label", "Fechar");
    const dica = filtrosEl?.querySelector("[data-capsula-tipo-dica]");
    if (dica) dica.textContent = "Tipos";
    const limpar = filtrosEl?.querySelector("[data-capsula-tipo-limpar]");
    if (limpar) limpar.textContent = "Limpar";
  }

  function fechar() {
    if (root.hidden) return false;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("capsula-aberta");
    estado.capsulaAberta = false;
    opts.aoMudarAberto?.(false);
    avisar();
    return true;
  }

  function abrir() {
    if (opts.podeAbrir && !opts.podeAbrir()) return false;
    montarFiltrosTipo();
    query = "";
    if (buscaEl instanceof HTMLInputElement) buscaEl.value = "";
    tiposAtivos = [];
    selecionada = null;
    if (nivelEl instanceof HTMLInputElement) nivelEl.value = String(NIVEL_PADRAO);
    setStatus("");
    atualizarRotulos();
    aplicarFiltros();
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("capsula-aberta");
    estado.capsulaAberta = true;
    opts.aoMudarAberto?.(true);
    fecharBtn?.focus?.();
    avisar();
    return true;
  }

  root.querySelector(".capsula-hud__backdrop")?.addEventListener("click", () => {
    fechar();
  });
  fecharBtn?.addEventListener("click", () => {
    fechar();
  });
  darBtn?.addEventListener("click", () => {
    concederSelecionada();
  });
  aleatorioBtn?.addEventListener("click", () => {
    timeAleatorio();
  });
  buscaEl?.addEventListener("input", () => {
    query = String(buscaEl instanceof HTMLInputElement ? buscaEl.value : "")
      .trim()
      .toLowerCase();
    aplicarFiltros();
  });
  gradeEl?.addEventListener("click", (e) => {
    const card = e.target?.closest?.(".capsula-hud__card");
    if (!(card instanceof HTMLElement) || card.hidden) return;
    const key = card.dataset.speciesKey;
    if (!key) return;
    selecionar(key);
    concederSelecionada();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    }
  });

  atualizarRotulos();

  return {
    abrir,
    fechar,
    estaAberta,
    atualizarRotulos,
    open: abrir,
    close: fechar,
    isOpen: estaAberta,
    refreshLabels: atualizarRotulos,
  };
}

export const mountCapsulaHud = montarHudCapsula;
