/** Conteúdo das páginas do menu Tab (HTML strings reutilizando catálogo). */

import {
  BOLAS,
  BERRIES,
  BLOCOS,
  CHAVES,
  FERRAMENTAS,
  HOLD_ITEMS,
  REMEDIOS,
  TIPO_ITEM,
  materiaisDaBolsa,
} from "../wild/catalogo.js";
import { listaParty } from "../pokemon/party.js";
import { contar, estado, temChave, nomeDe } from "./estado.js";
import { descricaoItem } from "./descricaoItem.js";
import { htmlIcone } from "./icones.js";
import { t } from "./i18n.js";
import {
  postagensConcluidas,
  registrosTomados,
  statusPostagem,
} from "../quests/runtime.js";
import { detalheMissao, tituloMissao } from "../quests/textoMissao.js";
import { QUEST_STATUS } from "../quests/tipos.js";

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function nomeEspecie(ator) {
  return ator?.especie?.nome || ator?.especie?.name || ator?.especie?.key || "Pokémon";
}

function urlRetrato(ator) {
  const dex = ator?.especie?.dex | 0;
  if (!dex) return "";
  return ator.shiny
    ? `/ref/sprites/pokemon-portraits/shiny/${dex}.png`
    : `/ref/sprites/pokemon-portraits/${dex}.png`;
}

export function htmlPartyMenu() {
  const party = listaParty();
  if (!party.length) return "<p>Time vazio.</p>";
  return `<div class="jogo-grade">${party
    .map((ator, i) => {
      const hp = `${Math.max(0, Math.round(ator.hp))}/${ator.hpMax}`;
      const foto = urlRetrato(ator);
      const img = foto ? `<img class="pc-retrato" alt="" src="${foto}" />` : "";
      return `<div class="jogo-item">${img}<span>${escHtml(nomeEspecie(ator))} Lv${ator.nivel}${ator.shiny ? " ✦" : ""}</span><span>${hp}</span>
        <button type="button" data-act="status-mon" data-i="${i}">Status</button>
        <button type="button" data-act="deploy" data-i="${i}">Campo</button>
        <button type="button" data-act="ride" data-i="${i}">Ride</button>
        <button type="button" data-act="simbiose" data-i="${i}">${escHtml(t("simbiose.fuse"))}</button>
        <button type="button" data-act="soltar-party" data-i="${i}">Soltar</button></div>`;
    })
    .join("")}</div>`;
}

const SLOT_ICONE_PX = 56;
const DETAIL_ICONE_PX = 64;

export function htmlMochilaMenu() {
  const cats = [
    ["balls", t("ui.bolas")],
    ["berries", t("ui.berries")],
    ["medicine", t("ui.remedios")],
    ["hold", t("ui.hold")],
    ["materials", t("ui.materiais")],
    ["blocks", t("ui.blocos")],
    ["tools", t("ui.ferramentas")],
    ["key", t("ui.chave")],
  ];
  const lista = itensVisiveis(estado.categoria);
  const sel = resolverSelecao(lista);
  const botoes = cats
    .map(([id, rotulo]) => {
      const on = estado.categoria === id ? " is-active" : "";
      return `<button type="button" data-act="cat" data-cat="${id}" class="bag-cats__btn${on}" aria-selected="${estado.categoria === id}">
        <span class="bag-cats__label">${escHtml(rotulo)}</span>
      </button>`;
    })
    .join("");
  const grade = lista.length
    ? lista
        .map((item) => {
          const qtd = item.tipo === TIPO_ITEM.CHAVE ? 1 : contar(item.tipo, item.key);
          const selected =
            sel && sel.tipo === item.tipo && sel.key === item.key ? " is-selected" : "";
          const nome = nomeDe(item.tipo, item.key);
          return `<button type="button" class="bag__slot${selected}" data-act="bag-sel" data-tipo="${item.tipo}" data-key="${escHtml(item.key)}" title="${escHtml(nome)}">
            <span class="bag__slot-icon">${htmlIcone(item.key, "bag__slot-img", SLOT_ICONE_PX)}</span>
            <span class="bag__slot-count">${qtd}</span>
          </button>`;
        })
        .join("")
    : `<p class="bag-detail__empty">${escHtml(t("ui.vazio"))}</p>`;
  return `<div class="bag-panel bag-panel--botw">
    <div class="bag-cats">${botoes}</div>
    <div class="bag-main">
      <div class="bag-grid-wrap"><div class="bag-grid">${grade}</div></div>
      ${htmlDetalheBag(sel)}
    </div>
  </div>`;
}

function itensVisiveis(cat) {
  const mapa = {
    balls: entradas(BOLAS, TIPO_ITEM.BOLA),
    berries: entradas(BERRIES, TIPO_ITEM.BERRY),
    medicine: entradas(REMEDIOS, TIPO_ITEM.REMEDIO),
    hold: entradas(HOLD_ITEMS, TIPO_ITEM.HOLD),
    materials: entradas(materiaisDaBolsa(), TIPO_ITEM.MATERIAL),
    blocks: entradas(BLOCOS, TIPO_ITEM.BLOCO),
    tools: entradas(FERRAMENTAS, TIPO_ITEM.FERRAMENTA),
    key: entradas(CHAVES, TIPO_ITEM.CHAVE),
  };
  return (mapa[cat] || []).filter((item) => {
    if (item.tipo === TIPO_ITEM.CHAVE) return temChave(item.key);
    return contar(item.tipo, item.key) > 0;
  });
}

function resolverSelecao(lista) {
  const atual = estado.itemBagSel;
  if (atual && lista.some((it) => it.tipo === atual.tipo && it.key === atual.key)) {
    return atual;
  }
  if (atual) estado.itemBagSel = null;
  return null;
}

function itemEquipa(tipo) {
  return (
    tipo === TIPO_ITEM.BOLA ||
    tipo === TIPO_ITEM.BERRY ||
    tipo === TIPO_ITEM.REMEDIO ||
    tipo === TIPO_ITEM.BLOCO ||
    tipo === TIPO_ITEM.FERRAMENTA
  );
}

function htmlDetalheBag(sel) {
  if (!sel) {
    return `<aside class="bag-detail" data-bag-detail>
      <p class="bag-detail__empty">Selecione um item</p>
      <div class="bag-detail__body" hidden></div>
    </aside>`;
  }
  const qtd = sel.tipo === TIPO_ITEM.CHAVE ? 1 : contar(sel.tipo, sel.key);
  const nome = nomeDe(sel.tipo, sel.key);
  const desc = descricaoItem(sel.tipo, sel.key) || "";
  const acoes = itemEquipa(sel.tipo)
    ? `<div class="bag-detail__actions">
        <button type="button" class="bag-detail__btn" data-act="usar" data-tipo="${sel.tipo}" data-key="${escHtml(sel.key)}">Equipar</button>
      </div>`
    : "";
  return `<aside class="bag-detail" data-bag-detail>
    <p class="bag-detail__empty" hidden>Selecione um item</p>
    <div class="bag-detail__body">
      <div class="bag-detail__icon">${htmlIcone(sel.key, "bag__slot-img", DETAIL_ICONE_PX)}</div>
      <h3 class="bag-detail__name">${escHtml(nome)}</h3>
      <p class="bag-detail__count">×${qtd}</p>
      <p class="bag-detail__desc">${escHtml(desc)}</p>
      ${acoes}
    </div>
  </aside>`;
}

function entradas(obj, tipo) {
  return Object.keys(obj).map((key) => ({ ...obj[key], tipo, key }));
}

export function htmlQuestsMenu() {
  const historia = (estado.quests || [])
    .map(
      (q) =>
        `<div class="jogo-item quests-panel__row"><span class="quests-panel__row-meta">${escHtml(q.titulo)}</span><span class="quests-panel__detail-text">${q.feita ? escHtml(t("quests.menu.done")) : escHtml(q.texto)}</span></div>`,
    )
    .join("");

  const boardAtivas = registrosTomados()
    .map((rec) => {
      const st = statusPostagem(rec.posting);
      return `<div class="jogo-item quests-panel__row"><span class="quests-panel__row-meta">${escHtml(tituloMissao(rec.posting))}</span><span class="quests-panel__detail-text">${escHtml(detalheMissao(rec.posting, st))}</span></div>`;
    })
    .join("");

  const completed = postagensConcluidas()
    .slice(0, 12)
    .map(
      (p) =>
        `<div class="jogo-item quests-panel__row"><span class="quests-panel__row-meta">${escHtml(tituloMissao(p))}</span><span class="quests-panel__detail-text">${escHtml(detalheMissao(p, QUEST_STATUS.COMPLETED))}</span></div>`,
    )
    .join("");

  const secoes = [
    `<section class="quests-panel__section"><h3>${escHtml(t("quests.menu.story"))}</h3><div class="jogo-grade">${historia || `<p class="quests-panel__empty">${escHtml(t("quests.menu.emptyStory"))}</p>`}</div></section>`,
    `<section class="quests-panel__section"><h3>${escHtml(t("quests.menu.boardActive"))}</h3><div class="jogo-grade">${boardAtivas || `<p class="quests-panel__empty">${escHtml(t("quests.menu.emptyBoard"))}</p>`}</div></section>`,
  ];
  if (completed) {
    secoes.push(
      `<section class="quests-panel__section"><h3>${escHtml(t("quests.menu.boardDone"))}</h3><div class="jogo-grade">${completed}</div></section>`,
    );
  }
  return secoes.join("");
}

export function htmlSaveMenu() {
  return `<p>O save fica neste navegador.</p><button type="button" data-act="salvar">Salvar agora</button>`;
}
