/** Party mid-left + card de status bottom-left (HP/EXP/ride + modos de IA). */

import {
  defaultFollowerMode,
  listaParty,
  pokemonDeployado,
  pokemonNoCampo,
  setDefaultFollowerMode,
  setFollowerMode,
} from "../../pokemon/party.js";
import { AI_MODE, rotuloModo } from "../../pokemon/aiModes.js";
import { modoEfetivo } from "../../pokemon/campo/modos.js";
import {
  ANEL_CIRC,
  assinaturaEstagios,
  listaEstagiosAtivos,
  progressoEstagio,
} from "../../pokemon/combate/estagios.js";
import { rideSlot, slotPodeMontar } from "../apiHud.js";
import { progressoExp } from "../../pokemon/experiencia.js";
import { relogioPokemon } from "../../pokemon/sistema.js";
import { MODE_ICONS } from "./iconesModo.js";
import { createModePicker, createTeamModePicker } from "./modePicker.js";

let stripHost = null;
let detailHost = null;
let railHost = null;
let teamBtn = null;
let assinatura = "";
let assinaturaDetail = "";
let modePicker = null;
let teamPicker = null;
let ligado = false;

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

function prefModo(ator) {
  return ator?.modePreference ?? AI_MODE.DEFAULT;
}

function iconeModo(mode) {
  return MODE_ICONS[mode] || MODE_ICONS[AI_MODE.DEFEND] || "";
}

function garantirPickers() {
  if (modePicker) return;
  modePicker = createModePicker({
    onSelect(index, mode) {
      setFollowerMode(index, mode);
      assinatura = "";
      assinaturaDetail = "";
      pintarPartyCampo();
    },
  });
  teamPicker = createTeamModePicker({
    onSelect(mode) {
      setDefaultFollowerMode(mode);
      assinatura = "";
      assinaturaDetail = "";
      pintarPartyCampo();
    },
  });
}

function garantirTeamBtn() {
  if (!railHost || teamBtn) return;
  teamBtn = document.createElement("button");
  teamBtn.type = "button";
  teamBtn.className = "party-team-mode";
  teamBtn.id = "party-team-ai";
  teamBtn.title = "IA da equipe";
  teamBtn.setAttribute("aria-label", "Modo padrão da equipe");
  railHost.insertBefore(teamBtn, stripHost);
  teamBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    garantirPickers();
    modePicker.close();
    teamPicker.open(teamBtn, defaultFollowerMode());
  });
}

function sincronizarTeamBtn() {
  if (!teamBtn) return;
  const mode = defaultFollowerMode();
  teamBtn.innerHTML = `<span class="party-team-mode__glyph">${iconeModo(mode)}</span>`;
  teamBtn.title = `IA da equipe: ${rotuloModo(mode)}`;
  teamBtn.setAttribute("aria-label", `Modo padrão da equipe: ${rotuloModo(mode)}`);
  teamPicker?.sync?.(mode);
}

function ligarCliques() {
  if (ligado || !stripHost) return;
  ligado = true;
  stripHost.addEventListener("click", (e) => {
    const modoBtn = e.target.closest("[data-act='modo']");
    if (!modoBtn || !stripHost.contains(modoBtn)) return;
    e.preventDefault();
    e.stopPropagation();
    const i = Number(modoBtn.dataset.i);
    const ator = listaParty()[i];
    if (!ator) return;
    garantirPickers();
    teamPicker.close();
    modePicker.open(i, ator, modoBtn, nomeEspecie(ator));
  });
  if (detailHost) {
    detailHost.addEventListener("click", (e) => {
      const modoBtn = e.target.closest("[data-act='modo']");
      if (!modoBtn || !detailHost.contains(modoBtn)) return;
      e.preventDefault();
      e.stopPropagation();
      const i = Number(modoBtn.dataset.i);
      const ator = listaParty()[i];
      if (!ator) return;
      garantirPickers();
      teamPicker.close();
      modePicker.open(i, ator, modoBtn, nomeEspecie(ator));
    });
  }
}

export function montarPartyCampo({ strip, detail }) {
  stripHost = strip || document.getElementById("jogo-equipe");
  detailHost = detail || document.getElementById("party-combat-detail");
  railHost = stripHost?.closest(".party-hud__rail") || stripHost?.parentElement || null;
  garantirPickers();
  garantirTeamBtn();
  ligarCliques();
  sincronizarTeamBtn();
  return { sync: pintarPartyCampo };
}

export function pintarPartyCampo() {
  pintarStrip();
  pintarDetail();
  sincronizarTeamBtn();
}

function pintarStrip() {
  if (!stripHost) return;
  const party = listaParty();
  const campo = pokemonNoCampo();
  const fora = campo && !campo.capturado;
  const montado = rideSlot();
  const teamMode = defaultFollowerMode();
  const sig = `${teamMode}|${party
    .map(
      (ator, i) =>
        `${ator.id}:${ator.nivel}:${ator.shiny ? 1 : 0}:${Math.round(ator.hp)}:${fora && campo === ator ? 1 : 0}:${montado === i ? 1 : 0}:${ator.especie?.dex || 0}:${prefModo(ator)}:${modoEfetivo(ator)}`,
    )
    .join("|")}`;

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
            const pref = prefModo(ator);
            const tipModo = pref === AI_MODE.DEFAULT
              ? `Padrão (${rotuloModo(modoEfetivo(ator))})`
              : rotuloModo(pref);
            return `<div class="party-slot-wrap">
              <button type="button" class="party-slot${fora && campo === ator ? " is-on is-out" : ""}${faint ? " is-fainted" : ""}${rideOn ? " is-ride" : ""}" data-act="deploy" data-i="${i}" title="${escHtml(nomeEspecie(ator))} Nv${ator.nivel}">
                <span class="party-slot__portrait">${face}</span>
                <span class="party-slot__hp"><i data-hp="${i}"></i></span>
              </button>
              <button type="button" class="party-slot__mode" data-act="modo" data-i="${i}" title="Modo: ${escHtml(tipModo)}" aria-label="Modo de IA: ${escHtml(tipModo)}">
                <span class="party-slot__mode-glyph">${iconeModo(pref)}</span>
              </button>
            </div>`;
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

function htmlBuffs(ator, agora) {
  const lista = listaEstagiosAtivos(ator);
  if (!lista.length) return "";
  return `<div class="party-combat__buffs" role="list" aria-label="Modificadores de status">${lista
    .map((b) => {
      const frac = progressoEstagio(ator, b.campo, agora);
      const offset = ANEL_CIRC * (1 - frac);
      const cls = b.buff ? "is-buff" : "is-debuff";
      return `<div class="party-combat__buff ${cls}" role="listitem" data-buff-campo="${b.campo}" title="${escHtml(b.curto)} ${escHtml(b.pctTxt)}">
        <svg class="party-combat__buff-ring" viewBox="0 0 28 28" aria-hidden="true">
          <circle class="party-combat__buff-track" cx="14" cy="14" r="11" />
          <circle class="party-combat__buff-arc" data-buff-ring="${b.campo}" cx="14" cy="14" r="11"
            stroke-dasharray="${ANEL_CIRC}" stroke-dashoffset="${offset}" />
        </svg>
        <span class="party-combat__buff-tag">${escHtml(b.curto)}</span>
        <span class="party-combat__buff-pct">${escHtml(b.pctTxt)}</span>
      </div>`;
    })
    .join("")}</div>`;
}

function atualizarAneisBuff(ator) {
  if (!detailHost || !ator) return;
  const agora = relogioPokemon();
  const aneis = detailHost.querySelectorAll("[data-buff-ring]");
  for (let i = 0; i < aneis.length; i++) {
    const el = aneis[i];
    const campo = el.getAttribute("data-buff-ring");
    const frac = progressoEstagio(ator, campo, agora);
    el.setAttribute("stroke-dashoffset", String(ANEL_CIRC * (1 - frac)));
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
  const pref = prefModo(ator);
  const tipModo = pref === AI_MODE.DEFAULT
    ? `Padrão (${rotuloModo(modoEfetivo(ator))})`
    : rotuloModo(pref);
  const sigEst = assinaturaEstagios(ator);

  const sig = `${ator.id}:${hp}:${pctExp}:${montado ? 1 : 0}:${ator.nivel}:${pref}:${modoEfetivo(ator)}:${sigEst}`;
  if (sig === assinaturaDetail) {
    const barHp = detailHost.querySelector("[data-combat-hp]");
    const barExp = detailHost.querySelector("[data-combat-exp]");
    if (barHp) barHp.style.width = `${pctHp}%`;
    if (barExp) barExp.style.width = `${pctExp}%`;
    atualizarAneisBuff(ator);
    return;
  }
  assinaturaDetail = sig;
  detailHost.hidden = false;

  const url = urlRetrato(ator);
  const face = url
    ? `<img class="party-combat__face" src="${url}" alt="" draggable="false" />`
    : `<span class="party-combat__face party-combat__face--fallback">${escHtml(nomeEspecie(ator).slice(0, 1))}</span>`;
  const agora = relogioPokemon();
  const buffs = htmlBuffs(ator, agora);

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
          ${buffs}
        </div>
      </div>
      <div class="party-combat__actions">
        <button type="button" class="party-combat__mode" data-act="modo" data-i="${i}" title="Modo: ${escHtml(tipModo)}" aria-label="Modo de IA: ${escHtml(tipModo)}">
          <span class="party-combat__mode-glyph">${iconeModo(pref)}</span>
        </button>
        <button type="button" class="party-combat__action party-combat__action--skills" data-act="skills" title="Ver golpes">
          Skills
        </button>
        <button type="button" class="party-combat__action" data-act="deploy" data-i="${i}" title="Campo">
          ${pokemonDeployado() === ator ? "Recolher" : "Campo"}
        </button>
        <button type="button" class="party-combat__action party-combat__action--ride${montado ? " is-on" : ""}" data-act="ride" data-i="${i}" ${rideOk ? "" : "disabled"} title="${montado ? "Desmontar" : "Montar"}">
          ${montado ? "Desmontar" : "Ride"}
        </button>
      </div>
    </div>`;
}
