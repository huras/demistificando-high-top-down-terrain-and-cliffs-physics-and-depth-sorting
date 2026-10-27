/**
 * Liga menu Tab, party chrome, hearts, radar, status e páginas do menu.
 */

import { criarMenuJogo } from "./menuJogo.js";
import { montarPartyCampo, pintarPartyCampo } from "./partyCampo.js";
import { montarCoracoes, pintarCoracoes } from "./coracoes.js";
import { montarRadar } from "./radar.js";
import { montarStatusJogador } from "./statusJogador.js";
import { montarObjetivoMissao, pintarObjetivo } from "./objetivoMissao.js";
import { montarHudPokedex } from "../pokedex/hud.js";
import {
  definirCorpoHud,
  definirDexApi,
  definirMenuApi,
  definirRadarApi,
  definirStatusApi,
  definirSkillApi,
  abrirMapaMundo,
  questsAtivas,
  salvarJogo,
  toggleMenu,
  toggleStatus,
  posicaoCorpoHud,
} from "../apiHud.js";
import { estado, avisar } from "../estado.js";
import { definirIdioma, idiomaAtual } from "../i18n.js";
import { htmlMochilaMenu, htmlPartyMenu, htmlQuestsMenu, htmlSaveMenu } from "../uiMenuPaginas.js";
import { aoFecharMapa } from "../../ui/mapa/mapaMundo.js";
import { ligarFecharMapaMenu, notificarMapaFechou, sincronizarMapaMenu } from "./mapaNoMenu.js";
import { montarSkillLoadout } from "./skillLoadout.js";
import { montarMovesCampo } from "./movesCampo.js";
import { montarMorteHud } from "./morte.js";
import { bootQuestBoard } from "./questBoard/janela.js";
import { aquecerPinMissao } from "../../mapa/pinMissao.js";

let menu = null;
let partyApi = null;
let heartsApi = null;
let radarApi = null;
let statusApi = null;
let objetivoApi = null;
let skillApi = null;
let movesApi = null;

export function bootHudCompleto() {
  const dexApi = montarHudPokedex(document.getElementById("pokedex-hud"), {
    aoMudarAberto(aberto) {
      estado.dexAberta = !!aberto;
      avisar();
    },
  });
  definirDexApi(dexApi);

  menu = criarMenuJogo(document.getElementById("game-menu"), {
    onPageChange(page, open) {
      estado.menuAberto = !!open;
      if (open) pintarPaginasMenu(page);
      sincronizarMapaMenu(page, open, posicaoCorpoHud());
      const badge = document.querySelector("[data-quests-tab-badge]");
      if (badge) {
        const n = questsAtivas();
        badge.hidden = n <= 0;
        badge.textContent = n > 0 ? String(n) : "";
      }
      avisar();
    },
  });
  definirMenuApi(menu);
  ligarFecharMapaMenu(() => {
    if (menu?.isOpen?.() && menu.page?.() === "map") menu.close();
  });
  aoFecharMapa(() => notificarMapaFechou());

  // backdrop fecha
  document.querySelectorAll("#game-menu [data-menu-close]").forEach((el) => {
    if (el.classList.contains("game-menu__backdrop")) {
      el.addEventListener("click", () => menu.close());
    }
  });

  partyApi = montarPartyCampo({
    strip: document.getElementById("jogo-equipe"),
    detail: document.getElementById("party-combat-detail"),
  });
  heartsApi = montarCoracoes(document.getElementById("player-hearts-hud"));
  radarApi = montarRadar(document.getElementById("poke-radar-host"));
  definirRadarApi(radarApi);
  statusApi = montarStatusJogador(document.getElementById("player-status-hud"));
  definirStatusApi({
    ...statusApi,
    toggle() {
      const r = statusApi.toggle();
      estado.statusAberto = statusApi.isOpen();
      avisar();
      return r;
    },
    close() {
      statusApi.close();
      estado.statusAberto = false;
    },
  });
  objetivoApi = montarObjetivoMissao(document.getElementById("quest-objective-hud"));
  movesApi = montarMovesCampo(document.getElementById("party-moves-combat"));
  skillApi = montarSkillLoadout();
  definirSkillApi(skillApi);
  montarMorteHud();
  bootQuestBoard();
  aquecerPinMissao();

  ligarIdiomaMenu();
  return { menu, dexApi, radarApi, statusApi, skillApi, movesApi };
}

function ligarIdiomaMenu() {
  const sel = document.getElementById("jogo-idioma-menu");
  if (!sel || sel.dataset.pronto) return;
  sel.dataset.pronto = "1";
  sel.innerHTML =
    `<option value="pt-BR">Português (BR)</option>` +
    `<option value="en">English</option>` +
    `<option value="ja">日本語</option>`;
  sel.value = idiomaAtual();
  sel.addEventListener("change", () => definirIdioma(sel.value));
}

function pintarPaginasMenu(page) {
  const hostParty = document.querySelector('[data-menu-host="party"]');
  const hostBag = document.querySelector('[data-menu-host="bag"]');
  const hostQuests = document.querySelector('[data-menu-host="quests"]');
  const hostSave = document.querySelector('[data-menu-host="save"]');
  if (page === "party" && hostParty) hostParty.innerHTML = htmlPartyMenu();
  if (page === "bag" && hostBag) hostBag.innerHTML = htmlMochilaMenu();
  if (page === "quests" && hostQuests) hostQuests.innerHTML = htmlQuestsMenu();
  if (page === "save" && hostSave) hostSave.innerHTML = htmlSaveMenu();
}

export function tickHudCampo(dt, corpo) {
  definirCorpoHud(corpo);
  radarApi?.setCorpo?.(corpo);
  partyApi?.sync?.();
  heartsApi?.sync?.();
  movesApi?.sync?.();
  objetivoApi?.sync?.();
  if (radarApi?.isOpen?.()) radarApi.sync?.();
  if (statusApi?.isOpen?.()) statusApi.sync?.();
  if (skillApi?.isOpen?.()) skillApi.sync?.();
  menu?.syncMoney?.();
}

export function tratarUtilityHud(id) {
  if (id === "menu") {
    toggleMenu();
    return true;
  }
  if (id === "status") {
    toggleStatus();
    return true;
  }
  if (id === "pokeRadar") {
    radarApi?.toggle?.();
    return true;
  }
  if (id === "bag") {
    toggleMenu("bag");
    return true;
  }
  if (id === "party") {
    toggleMenu("party");
    return true;
  }
  if (id === "quests") {
    toggleMenu("quests");
    return true;
  }
  if (id === "save") {
    if (menu?.isOpen?.() && menu.page?.() === "save") salvarJogo();
    else toggleMenu("save");
    return true;
  }
  if (id === "map") {
    if (menu?.isOpen?.()) menu.close();
    abrirMapaMundo();
    return true;
  }
  return false;
}

export function menuHud() {
  return menu;
}

export { pintarPartyCampo, pintarCoracoes, pintarObjetivo };
