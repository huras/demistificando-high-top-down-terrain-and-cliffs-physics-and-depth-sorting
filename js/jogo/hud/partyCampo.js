/** Party mid-left + card de status bottom-left (HP/EXP/ride — sem moves). */

import {
  listaParty,
  pokemonDeployado,
  pokemonNoCampo,
} from "../../pokemon/party.js";
import { rideSlot, slotPodeMontar } from "../apiHud.js";
import { progressoExp } from "../../pokemon/experiencia.js";

let stripHost = null;
let detailHost = null;
let assinatura = "";
let assinaturaDetail = "";

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

function simboloGenero(ator) {
  const g = ator?.genero ?? ator?.gender ?? ator?.especie?.genero;
  if (g === "f" || g === "female" || g === 1) return "♀";
  if (g === "m" || g === "male" || g === 0) return "♂";
  if (typeof g === "number" && g >= 0 && g <= 8) {
    if (g === 8) return "";
    return g >= 4 ? "♀" : "♂";
  }
  return "";
}

function indiceNaParty(ator) {
  const party = listaParty();
  return party.indexOf(ator);
}

export function montarPartyCampo({ strip, detail }) {
  stripHost = strip || document.getElementById("jogo-equipe");
  detailHost = detail || document.getElementById("party-combat-detail");
  return { sync: pintarPartyCampo };
}

export function pintarPartyCampo() {
  pintarStrip();
  pintarDetail();
}

function pintarStrip() {
  if (!stripHost) return;
  const party = listaParty();
  const campo = pokemonNoCampo();
  const fora = campo && !campo.capturado;
  const montado = rideSlot();
  const sig = party
    .map(
      (ator, i) =>
        `${ator.id}:${ator.nivel}:${ator.shiny ? 1 : 0}:${Math.round(ator.hp)}:${fora && campo === ator ? 1 : 0}:${montado === i ? 1 : 0}:${ator.especie?.dex || 0}`,
    )
    .join("|");

  if (sig !== assinatura) {
    assinatura = sig;
    stripHost.innerHTML = party.length
      ? party
          .map((ator, i) => {
            const url = urlRetrato(ator);
            const face = url
              ? `<img class="party-slot__face" src="${url}" alt="" draggable="false" />`
              : `<span class="party-slot__face">${escHtml(nomeEspecie(ator).slice(0, 1))}</span>`;
            const faint = ator.hpMax > 0 && ator.hp <= 0;
            const rideOn = montado === i;
            return `<button type="button" class="party-slot${fora && campo === ator ? " is-on is-out" : ""}${faint ? " is-fainted" : ""}${rideOn ? " is-ride" : ""}" data-act="deploy" data-i="${i}" title="${escHtml(nomeEspecie(ator))} Nv${ator.nivel}">
              <span class="party-slot__portrait">${face}</span>
              <span class="party-slot__hp"><i data-hp="${i}"></i></span>
            </button>`;
          })
          .join("")
      : "";
  }

  for (let i = 0; i < party.length; i++) {
    const ator = party[i];
    const t = ator.hpMax > 0 ? Math.max(0, ator.hp) / ator.hpMax : 0;
    const bar = stripHost.querySelector(`[data-hp="${i}"]`);
    if (bar) {
      bar.style.width = `${Math.round(t * 100)}%`;
      bar.dataset.baixa = t < 0.35 ? "1" : "0";
    }
  }
}

function pintarDetail() {
  if (!detailHost) return;
  const ator = pokemonDeployado() || pokemonNoCampo();
  if (!ator || ator.capturado) {
    if (assinaturaDetail !== "empty") {
      assinaturaDetail = "empty";
      detailHost.hidden = true;
      detailHost.innerHTML = "";
    }
    return;
  }

  const i = indiceNaParty(ator);
  const hp = `${Math.max(0, Math.round(ator.hp))}/${ator.hpMax}`;
  const pctHp = ator.hpMax > 0 ? Math.round((Math.max(0, ator.hp) / ator.hpMax) * 100) : 0;
  const cresc = ator.crescimento || ator.especie?.crescimento || "mediumSlow";
  const pctExp = Math.round(progressoExp(ator.nivel | 0, ator.exp | 0, cresc) * 100);
  const montado = rideSlot() === i;
  const rideOk = i >= 0 && slotPodeMontar(i);
  const gen = simboloGenero(ator);

  const sig = `${ator.id}:${hp}:${pctExp}:${montado ? 1 : 0}:${ator.nivel}`;
  if (sig === assinaturaDetail) {
    const barHp = detailHost.querySelector("[data-combat-hp]");
    const barExp = detailHost.querySelector("[data-combat-exp]");
    if (barHp) barHp.style.width = `${pctHp}%`;
    if (barExp) barExp.style.width = `${pctExp}%`;
    return;
  }
  assinaturaDetail = sig;
  detailHost.hidden = false;

  const url = urlRetrato(ator);
  const face = url
    ? `<img class="party-combat__face" src="${url}" alt="" draggable="false" />`
    : `<span class="party-combat__face party-combat__face--fallback">${escHtml(nomeEspecie(ator).slice(0, 1))}</span>`;

  detailHost.innerHTML = `
    <div class="party-combat__detail is-visible">
      <div class="party-combat__head">
        ${face}
        <div class="party-combat__meta">
          <div class="party-combat__title-row">
            <b class="party-combat__name">${escHtml(nomeEspecie(ator))}</b>
            ${gen ? `<span class="party-combat__gender" aria-hidden="true">${gen}</span>` : ""}
            <span class="party-combat__lv">Lv. ${ator.nivel}</span>
          </div>
          <div class="party-combat__hp-wrap">
            <span class="party-combat__bar-tag">HP</span>
            <div class="party-combat__hp"><i data-combat-hp style="width:${pctHp}%"></i></div>
            <span class="party-combat__hp-num">${hp}</span>
          </div>
          <div class="party-combat__exp-wrap">
            <span class="party-combat__bar-tag">EXP</span>
            <div class="party-combat__exp"><i data-combat-exp style="width:${pctExp}%"></i></div>
          </div>
        </div>
      </div>
      <div class="party-combat__actions">
        <button type="button" class="party-combat__action" data-act="deploy" data-i="${i}" title="Campo">
          ${pokemonDeployado() === ator ? "Recolher" : "Campo"}
        </button>
        <button type="button" class="party-combat__action party-combat__action--ride${montado ? " is-on" : ""}" data-act="ride" data-i="${i}" ${rideOk ? "" : "disabled"} title="${montado ? "Desmontar" : "Montar"}">
          ${montado ? "Desmontar" : "Ride"}
        </button>
      </div>
    </div>`;
}
