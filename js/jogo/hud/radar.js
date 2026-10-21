/** Poké Radar: espécies da área atual (distribuição Kanto). */

import { amostraKanto, dentroDoKanto } from "../../mundo/regiao/amostraKanto.js";
import { especie } from "../../pokemon/dados.js";
import { getSpeciesDexStatus } from "../pokedex/progresso.js";
import { biomaDominante } from "../../mundo/bioma/catalogo.js";
import { poolDoBioma } from "../../pokemon/distribuicao/indice.js";

let root = null;
let aberto = false;
let assinatura = "";
let corpoRef = null;

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

export function montarRadar(host) {
  root = host;
  if (!root) {
    return { open() {}, close() {}, toggle() {}, isOpen: () => false, sync() {}, setCorpo() {} };
  }
  if (!root.querySelector(".poke-radar")) {
    root.innerHTML = `<div class="poke-radar" data-radar>
      <header class="poke-radar__head">
        <b class="poke-radar__title">Poké Radar</b>
        <button type="button" class="poke-radar__close" data-radar-close aria-label="Fechar">×</button>
      </header>
      <p class="poke-radar__area" data-radar-area>—</p>
      <div class="poke-radar__list" data-radar-list></div>
    </div>`;
  }
  root.querySelector("[data-radar-close]")?.addEventListener("click", () => {
    fechar();
  });
  return {
    open: abrir,
    close: fechar,
    toggle: () => (aberto ? fechar() : abrir()),
    isOpen: () => aberto,
    sync: pintar,
    setCorpo(c) {
      corpoRef = c;
    },
  };
}

function abrir() {
  aberto = true;
  if (root) {
    root.hidden = false;
    root.classList.add("is-open");
  }
  pintar();
  return true;
}

function fechar() {
  aberto = false;
  if (root) {
    root.hidden = true;
    root.classList.remove("is-open");
  }
  return true;
}

function listarEspeciesArea(x, y) {
  const chaves = new Set();
  try {
    const bioma = biomaDominante?.(x, y);
    const id = bioma?.id ?? bioma;
    const pool = poolDoBioma?.(id) || { casa: [], extras: [] };
    const listas = [pool.casa || [], pool.extras || []];
    for (let L = 0; L < listas.length; L++) {
      const arr = listas[L];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const key = typeof item === "string" ? item : item?.key || item?.species || item?.especie;
        if (key) chaves.add(key);
      }
    }
  } catch {
    /* pool opcional */
  }
  if (!chaves.size) {
    for (const fallback of ["pidgey", "rattata", "caterpie", "weedle", "pikachu", "oddish"]) {
      if (especie(fallback)) chaves.add(fallback);
    }
  }
  return [...chaves];
}

export function pintarRadar() {
  if (!aberto || !root) return;
  pintar();
}

function pintar() {
  if (!root || !aberto) return;
  const x = corpoRef?.x || 0;
  const y = corpoRef?.y || 0;
  let nomeArea = "Kanto";
  if (dentroDoKanto(x, y)) {
    const a = amostraKanto(x, y);
    if (a?.nome) nomeArea = a.nome;
  }
  const keys = listarEspeciesArea(x, y);
  const sig = `${nomeArea}|${keys.join(",")}`;
  if (sig === assinatura) return;
  assinatura = sig;

  const areaEl = root.querySelector("[data-radar-area]");
  if (areaEl) areaEl.textContent = nomeArea;

  const list = root.querySelector("[data-radar-list]");
  if (!list) return;
  list.innerHTML = keys
    .map((key) => {
      const esp = especie(key);
      const st = getSpeciesDexStatus(key);
      const dex = esp?.dex | 0;
      const nome = st === "unseen" ? "???" : esp?.nome || key;
      const url =
        st === "unseen" || !dex
          ? ""
          : `/ref/sprites/pokemon-portraits/${dex}.png`;
      const face = url
        ? `<img src="${url}" alt="" draggable="false" />`
        : `<span class="poke-radar__sil">?</span>`;
      return `<button type="button" class="poke-radar__card is-${st}" data-radar-key="${escHtml(key)}">
        <span class="poke-radar__face${st === "unseen" ? " is-sil" : ""}">${face}</span>
        <span class="poke-radar__name">${escHtml(nome)}</span>
        <span class="poke-radar__st">${st}</span>
      </button>`;
    })
    .join("");
}
