/** Conteúdo das páginas do menu Tab (HTML strings reutilizando catálogo). */

import {
  BOLAS,
  BERRIES,
  BLOCOS,
  CHAVES,
  FERRAMENTAS,
  REMEDIOS,
  TIPO_ITEM,
  materiaisDaBolsa,
} from "../wild/catalogo.js";
import { listaParty } from "../pokemon/party.js";
import { contar, estado, temChave, nomeDe } from "./estado.js";
import { htmlIcone } from "./icones.js";
import { t } from "./i18n.js";

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
        <button type="button" data-act="deploy" data-i="${i}">Campo</button>
        <button type="button" data-act="ride" data-i="${i}">Ride</button>
        <button type="button" data-act="soltar-party" data-i="${i}">Soltar</button></div>`;
    })
    .join("")}</div>`;
}

export function htmlMochilaMenu() {
  const cats = [
    ["balls", t("ui.bolas")],
    ["berries", t("ui.berries")],
    ["medicine", t("ui.remedios")],
    ["materials", t("ui.materiais")],
    ["blocks", t("ui.blocos")],
    ["tools", t("ui.ferramentas")],
    ["key", t("ui.chave")],
  ];
  const botoes = cats
    .map(
      ([id, rotulo]) =>
        `<button type="button" data-act="cat" data-cat="${id}" class="${estado.categoria === id ? "is-on" : ""}">${rotulo}</button>`,
    )
    .join("");
  return `<p class="jogo-dinheiro">₽ ${estado.dinheiro}</p><div class="jogo-cats">${botoes}</div><div class="jogo-grade">${linhasCategoria(estado.categoria)}</div>`;
}

function linhasCategoria(cat) {
  const mapa = {
    balls: entradas(BOLAS, TIPO_ITEM.BOLA),
    berries: entradas(BERRIES, TIPO_ITEM.BERRY),
    medicine: entradas(REMEDIOS, TIPO_ITEM.REMEDIO),
    materials: entradas(materiaisDaBolsa(), TIPO_ITEM.MATERIAL),
    blocks: entradas(BLOCOS, TIPO_ITEM.BLOCO),
    tools: entradas(FERRAMENTAS, TIPO_ITEM.FERRAMENTA),
    key: entradas(CHAVES, TIPO_ITEM.CHAVE),
  };
  const lista = mapa[cat] || [];
  if (!lista.length) return `<p>${t("ui.vazio")}</p>`;
  return lista
    .map((item) => {
      const qtd = contar(item.tipo, item.key);
      if (qtd <= 0 && item.tipo !== TIPO_ITEM.CHAVE) return "";
      if (item.tipo === TIPO_ITEM.CHAVE && !temChave(item.key)) return "";
      const equipa =
        item.tipo === TIPO_ITEM.BOLA ||
        item.tipo === TIPO_ITEM.BERRY ||
        item.tipo === TIPO_ITEM.REMEDIO ||
        item.tipo === TIPO_ITEM.BLOCO ||
        item.tipo === TIPO_ITEM.FERRAMENTA;
      const usar = equipa
        ? `<button type="button" data-act="usar" data-tipo="${item.tipo}" data-key="${item.key}">Equipar</button>`
        : "";
      const nome = nomeDe(item.tipo, item.key);
      return `<div class="jogo-item">${htmlIcone(item.key, "jogo-item__icone")}<span>${nome} ×${qtd || 1}</span>${usar}</div>`;
    })
    .join("");
}

function entradas(obj, tipo) {
  return Object.keys(obj).map((key) => ({ ...obj[key], tipo }));
}

export function htmlQuestsMenu() {
  return `<div class="jogo-grade">${estado.quests
    .map(
      (q) =>
        `<div class="jogo-item"><span>${escHtml(q.titulo)}</span><span>${q.feita ? "feita" : escHtml(q.texto)}</span></div>`,
    )
    .join("")}</div>`;
}

export function htmlSaveMenu() {
  return `<p>O save fica neste navegador.</p><button type="button" data-act="salvar">Salvar agora</button>`;
}
