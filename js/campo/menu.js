/**
 * Botão direito no mundo: o Pokémon e só a habilidade que aquele alvo aceita.
 */

import { vegetacaoNaArea, propPorId } from "../mundo/bioma/propsBioma.js";
import { listaParty } from "../pokemon/party.js";
import { acoesDoPokemon } from "./capacidades.js";
import { ordenarCampo } from "./ordem.js";
import { FASE } from "./estadoProps.js";

const RAIO_MIRA = 1.45;
const ALCANCE = 13.5;

let host = null;
let alvoId = "";
let escuta = false;

function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function interagivel(prop) {
  if (!prop || prop.oculto || prop.fase === FASE.REMOVIDO) return false;
  return prop.tipo === "arvore" || prop.tipo === "grama" || prop.tipo === "pedra" || prop.tipo === "cristal";
}

export function buscarAlvoCampo(x, y) {
  const props = vegetacaoNaArea(x - 2, y - 2, x + 2, y + 2);
  let melhor = null;
  let dist = RAIO_MIRA;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (!interagivel(p)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= dist) continue;
    dist = d;
    melhor = p;
  }
  return melhor;
}

function retratoDe(mon) {
  const dex = mon.especie?.dex | 0;
  if (!dex) return "";
  const pasta = mon.shiny ? "shiny/" : "";
  return `/ref/sprites/pokemon-portraits/${pasta}${dex}.png`;
}

function htmlDoTime(alvo) {
  const party = listaParty();
  let html = "";
  let algum = false;
  for (let i = 0; i < party.length; i++) {
    const mon = party[i];
    if (!mon || mon.morto) continue;
    const acoes = acoesDoPokemon(mon.tipos, alvo);
    if (!acoes.length) continue;
    algum = true;
    const nome = esc(mon.especie?.nome || "Pokémon");
    const src = retratoDe(mon);
    const face = src ? `<img class="campo-menu__face" alt="" src="${esc(src)}" />` : "";
    let botoes = "";
    for (let a = 0; a < acoes.length; a++) {
      const acao = acoes[a];
      botoes += `<button type="button" data-i="${i}" data-acao="${esc(acao.id)}">${esc(acao.nome)}</button>`;
    }
    html += `<article class="campo-menu__mon">${face}<div><p class="campo-menu__nome">${nome}</p><div class="campo-menu__acoes">${botoes}</div></div></article>`;
  }
  if (!algum) {
    return `<p class="campo-menu__vazio">Nenhum Pokémon do time pode usar uma habilidade aqui.</p>`;
  }
  return html;
}

function aoClique(ev) {
  const btn = ev.target.closest?.("button");
  if (!btn || !host?.contains(btn)) return;
  const prop = propPorId(alvoId);
  const indice = btn.dataset.i | 0;
  const acao = btn.dataset.acao || "";
  fecharMenuCampo();
  if (prop) ordenarCampo(indice, acao, prop);
}

function aoFora(ev) {
  if (!host || host.hidden) return;
  if (host.contains(ev.target)) return;
  fecharMenuCampo();
}

function aoTecla(ev) {
  if (ev.key === "Escape") fecharMenuCampo();
}

function garantir() {
  if (host) return host;
  host = document.createElement("div");
  host.className = "campo-menu";
  host.hidden = true;
  document.body.appendChild(host);
  host.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  host.addEventListener("click", aoClique);
  return host;
}

function ligar() {
  if (escuta) return;
  escuta = true;
  document.addEventListener("pointerdown", aoFora);
  document.addEventListener("keydown", aoTecla);
}

export function fecharMenuCampo() {
  alvoId = "";
  if (!host) return;
  host.hidden = true;
  host.innerHTML = "";
}

export function menuCampoAberto() {
  return !!host && !host.hidden;
}

export function abrirMenuCampo(clientX, clientY, mundoX, mundoY, corpo) {
  const alvo = buscarAlvoCampo(mundoX, mundoY);
  if (!alvo || !corpo) return false;
  if (Math.hypot(alvo.x - corpo.x, alvo.y - corpo.y) > ALCANCE) return false;
  const painel = garantir();
  ligar();
  alvoId = alvo.id;
  painel.innerHTML = htmlDoTime(alvo);
  painel.hidden = false;
  const margem = 8;
  const largura = painel.offsetWidth || 220;
  const altura = painel.offsetHeight || 80;
  const maxX = window.innerWidth - largura - margem;
  const maxY = window.innerHeight - altura - margem;
  painel.style.left = `${Math.max(margem, Math.min(clientX, maxX))}px`;
  painel.style.top = `${Math.max(margem, Math.min(clientY, maxY))}px`;
  return true;
}
