/**
 * Botão direito no mundo: action-first (paridade Pokemon AI).
 * Uma linha por ação com retrato do assignee (ou stub travado).
 */

import { propPorId } from "../mundo/bioma/propsBioma.js";
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { listaParty, pokemonDeployado } from "../pokemon/party.js";
import { estaMontado } from "../jogo/ride.js";
import { acoesDoPokemon } from "./capacidades.js";
import { ordenarCampo } from "./ordem.js";
import { FASE } from "./estadoProps.js";
import {
  ACAO_FORCA,
  ALCANCE_COMANDO,
  RAIO_MIRA,
  montarOpcoesMenuForca,
} from "../forca/ordemCompanheiro.js";
import { snapshotSistemaForca, obterCfgForca } from "../forca/sistemaForca.js";
import { ordenarForca } from "../forca/tickOrdensForca.js";
import { definirDeployado } from "../pokemon/party.js";
import { t } from "../jogo/i18n.js";

let host = null;
let alvoId = "";
/** @type {object[]} */
let opcoesAtivas = [];
let miraX = 0;
let miraY = 0;
let escuta = false;

function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function interagivelFarm(prop) {
  if (!prop || prop.oculto || prop.fase === FASE.REMOVIDO || prop.forcaCarregado) return false;
  return (
    prop.tipo === "arvore" ||
    prop.tipo === "grama" ||
    prop.tipo === "pedra" ||
    prop.tipo === "cristal"
  );
}

export function buscarAlvoCampo(x, y) {
  const props = vegetacaoNaArea(x - 2, y - 2, x + 2, y + 2);
  let melhor = null;
  let dist = RAIO_MIRA;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (!interagivelFarm(p)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= dist) continue;
    dist = d;
    melhor = p;
  }
  return melhor;
}

function retratoDe(mon) {
  const dex = mon?.especie?.dex | 0;
  if (!dex) return "";
  const pasta = mon.shiny ? "shiny/" : "";
  return `/ref/sprites/pokemon-portraits/${pasta}${dex}.png`;
}

function indiceDoMon(mon) {
  if (!mon) return -1;
  const party = listaParty();
  return party.indexOf(mon);
}

/**
 * Action-first: cada opção é uma linha.
 * @param {object[]} forcaOpts
 * @param {object | null} propFarm
 */
function htmlAcoes(forcaOpts, propFarm) {
  let html = "";
  let algum = false;

  for (let i = 0; i < forcaOpts.length; i++) {
    const op = forcaOpts[i];
    algum = true;
    const src = op.locked ? "" : retratoDe(op.mon);
    const face = src
      ? `<img class="campo-menu__face" alt="" src="${esc(src)}" />`
      : `<span class="campo-menu__face campo-menu__face--lock">?</span>`;
    const nome = op.locked
      ? esc(op.lockHint || t("forca.precisaSolto"))
      : esc(op.mon?.especie?.nome || "Pokémon");
    const lockedCls = op.locked ? " is-locked" : "";
    html += `<button type="button" class="campo-menu__row${lockedCls}" data-kind="forca" data-i="${i}" ${
      op.locked ? "disabled" : ""
    }>${face}<span class="campo-menu__row-txt"><strong>${esc(
      op.rotulo,
    )}</strong><small>${nome}</small></span></button>`;
  }

  // Farm: uma linha por ação, assignee = deployado se pode, senão primeiro do party que pode (sem auto-deploy do menu antigo — só deployado)
  if (propFarm) {
    const deployado = pokemonDeployado();
    const party = listaParty();
    const candidatos = [];
    if (deployado && !deployado.morto) candidatos.push(deployado);
    // Se ninguém deployado, mostra locked farm com hint
    const acoesVistas = new Set();
    for (let c = 0; c < candidatos.length; c++) {
      const mon = candidatos[c];
      const acoes = acoesDoPokemon(mon.tipos, propFarm);
      for (let a = 0; a < acoes.length; a++) {
        const acao = acoes[a];
        if (acoesVistas.has(acao.id)) continue;
        acoesVistas.add(acao.id);
        algum = true;
        const src = retratoDe(mon);
        const face = src
          ? `<img class="campo-menu__face" alt="" src="${esc(src)}" />`
          : "";
        const idx = indiceDoMon(mon);
        html += `<button type="button" class="campo-menu__row" data-kind="farm" data-i="${idx}" data-acao="${esc(
          acao.id,
        )}">${face}<span class="campo-menu__row-txt"><strong>${esc(
          acao.nome,
        )}</strong><small>${esc(mon.especie?.nome || "Pokémon")}</small></span></button>`;
      }
    }
    // Sem deployado: stub das farm actions possíveis por alguém do party
    if (!candidatos.length) {
      for (let i = 0; i < party.length; i++) {
        const mon = party[i];
        if (!mon || mon.morto) continue;
        const acoes = acoesDoPokemon(mon.tipos, propFarm);
        for (let a = 0; a < acoes.length; a++) {
          const acao = acoes[a];
          if (acoesVistas.has(acao.id)) continue;
          acoesVistas.add(acao.id);
          algum = true;
          html += `<button type="button" class="campo-menu__row is-locked" data-kind="farm" disabled><span class="campo-menu__face campo-menu__face--lock">?</span><span class="campo-menu__row-txt"><strong>${esc(
            acao.nome,
          )}</strong><small>${esc(t("forca.precisaSolto"))}</small></span></button>`;
        }
      }
    }
  }

  if (!algum) {
    return `<p class="campo-menu__vazio">${esc(t("forca.menuVazio"))}</p>`;
  }
  return html;
}

function aoClique(ev) {
  const btn = ev.target.closest?.("button");
  if (!btn || !host?.contains(btn) || btn.disabled) return;
  const kind = btn.dataset.kind || "";
  const i = btn.dataset.i | 0;
  // Captura ANTES de fechar — fecharMenuCampo zera opcoesAtivas/alvoId.
  const op = kind === "forca" ? opcoesAtivas[i] : null;
  const farmPropId = alvoId;
  const farmAcao = btn.dataset.acao || "";
  fecharMenuCampo();
  if (kind === "forca") {
    if (!op || op.locked || !op.mon) return;
    if (op.id === ACAO_FORCA.LEVANTAR) {
      const alvo =
        op.kind === "faintedWild" || op.enemy
          ? { kind: "faintedWild", enemy: op.enemy, weightTier: op.weightTier, x: op.enemy.x, y: op.enemy.y, z: op.enemy.z }
          : { kind: "rock", id: op.prop?.id, prop: op.prop, weightTier: op.weightTier, x: op.prop.x, y: op.prop.y, z: op.prop.z, tipo: op.prop?.tipo };
      const idx = indiceDoMon(op.mon);
      const monAntes = idx >= 0 ? listaParty()[idx] : op.mon;
      const jaEmCampo =
        !!monAntes && !monAntes.capturado && !!monAntes._colocado;
      if (idx >= 0) definirDeployado(idx);
      // Usa o mon da party pós-deploy (referência viva).
      const mon = idx >= 0 ? listaParty()[idx] : op.mon;
      if (mon) {
        mon.capturado = false;
        if (jaEmCampo) mon._colocado = true;
        ordenarForca(mon, ACAO_FORCA.LEVANTAR, alvo, miraX, miraY);
      }
    } else if (op.id === ACAO_FORCA.SOLTAR) {
      const idx = indiceDoMon(op.mon);
      const mon = idx >= 0 ? listaParty()[idx] : op.mon;
      if (mon) ordenarForca(mon, ACAO_FORCA.SOLTAR, null, miraX, miraY);
    } else if (op.id === ACAO_FORCA.ARREMESSAR) {
      const idx = indiceDoMon(op.mon);
      const mon = idx >= 0 ? listaParty()[idx] : op.mon;
      if (mon) ordenarForca(mon, ACAO_FORCA.ARREMESSAR, null, miraX, miraY);
    }
    return;
  }
  if (kind === "farm") {
    const prop = propPorId(farmPropId);
    const indice = i;
    if (prop) ordenarCampo(indice, farmAcao, prop);
  }
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
  opcoesAtivas = [];
  if (!host) return;
  host.hidden = true;
  host.innerHTML = "";
}

export function menuCampoAberto() {
  return !!host && !host.hidden;
}

export function abrirMenuCampo(clientX, clientY, mundoX, mundoY, corpo) {
  if (!corpo || estaMontado()) return false;

  miraX = mundoX;
  miraY = mundoY;
  const sys = snapshotSistemaForca();
  const forcaOpts = montarOpcoesMenuForca(mundoX, mundoY, corpo, sys, obterCfgForca());
  const propFarm = buscarAlvoCampo(mundoX, mundoY);

  // Sem opções de força nem farm
  if (!forcaOpts.length && !propFarm) return false;
  if (
    !forcaOpts.length &&
    propFarm &&
    Math.hypot(propFarm.x - corpo.x, propFarm.y - corpo.y) > ALCANCE_COMANDO
  ) {
    return false;
  }

  const painel = garantir();
  ligar();
  alvoId = propFarm?.id || "";
  opcoesAtivas = forcaOpts;
  painel.innerHTML = htmlAcoes(forcaOpts, propFarm);
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
