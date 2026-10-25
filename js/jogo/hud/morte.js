/**
 * Tela de morte: snapshot do golpe letal, overlay e respawn via teleporte.
 */

import { USAR_PATCH_DEMO } from "../../config.js";
import { definirOlharLivre } from "../../entrada/ponteiro3d.js";
import { limparCampoCombate } from "../../pokemon/combate/limparCampo.js";
import { pokemonDeployado } from "../../pokemon/party.js";
import { SPAWN as SPAWN_DEMO } from "../../mundo/mapaDemo.js";
import { SPAWN_PALLET } from "../../mundo/regiao/spawnKanto.js";
import { estado, avisar } from "../estado.js";
import { aoMudarIdioma, t } from "../i18n.js";
import { registrarMorte } from "../jornada.js";
import { comecarSubida, teleporteOcupado } from "../teleporte.js";

const RESPAWN = USAR_PATCH_DEMO ? SPAWN_DEMO : SPAWN_PALLET;

/** @type {null | object} */
let treinadorRef = null;

/** @type {null | {
 *   causa: string,
 *   dano: number,
 *   golpeKey: string,
 *   golpeNome: string,
 *   matadorNome: string,
 *   matadorDex: number,
 *   matadorShiny: boolean,
 *   x: number,
 *   y: number,
 *   z: number,
 *   horaIso: string,
 *   horaRotulo: string,
 * }} */
let relatorio = null;
let raiz = null;
let corpoRef = null;
let pendentePouso = false;

function urlRetrato(dex, shiny) {
  const id = dex | 0;
  if (!id) return "";
  return shiny
    ? `/ref/sprites/pokemon-portraits/shiny/${id}.png`
    : `/ref/sprites/pokemon-portraits/${id}.png`;
}

export function obterRelatorioMorte() {
  return relatorio;
}

export function jogadorMorto() {
  return !!estado.morteAberta || pendentePouso;
}

export function definirCorpoMorte(corpo) {
  corpoRef = corpo || null;
}

export function definirTreinadorMorte(treinador) {
  treinadorRef = treinador || null;
}

function garantirDom() {
  if (raiz) return raiz;
  if (typeof document === "undefined") return null;
  const el = document.createElement("div");
  el.id = "morte-hud";
  el.className = "morte-hud";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.innerHTML =
    `<div class="morte-hud__veil" aria-hidden="true"></div>` +
    `<div class="morte-hud__card">` +
    `<div class="morte-hud__face" hidden>` +
    `<img class="morte-hud__sprite" alt="" />` +
    `</div>` +
    `<div class="morte-hud__copy">` +
    `<p class="morte-hud__eyebrow" data-morte="eyebrow"></p>` +
    `<h2 class="morte-hud__titulo" data-morte="titulo"></h2>` +
    `<p class="morte-hud__linha" data-morte="causa"></p>` +
    `<p class="morte-hud__linha" data-morte="matador"></p>` +
    `<p class="morte-hud__linha" data-morte="dano"></p>` +
    `<p class="morte-hud__linha morte-hud__linha--hora" data-morte="hora"></p>` +
    `<p class="morte-hud__dica" data-morte="dica"></p>` +
    `</div>` +
    `<button type="button" class="morte-hud__btn" data-morte="btn"></button>` +
    `</div>`;
  document.body.appendChild(el);
  el.querySelector("[data-morte=btn]")?.addEventListener("click", () => {
    pedirRenascer();
  });
  raiz = el;
  return el;
}

function pintarTextos() {
  const el = garantirDom();
  if (!el) return;
  const r = relatorio;
  el.querySelector("[data-morte=eyebrow]").textContent = t("morte.eyebrow");
  el.querySelector("[data-morte=titulo]").textContent = t("morte.titulo");
  el.querySelector("[data-morte=dica]").textContent = t("morte.dicaOlhar");
  el.querySelector("[data-morte=btn]").textContent = t("morte.renascer");

  const causa =
    r?.causa === "combate"
      ? t("morte.causaCombate", { golpe: r.golpeNome || t("morte.golpeDesconhecido") })
      : t("morte.causaDesconhecida");
  el.querySelector("[data-morte=causa]").textContent = causa;

  const matador = r?.matadorNome
    ? t("morte.matador", { nome: r.matadorNome })
    : t("morte.matadorDesconhecido");
  el.querySelector("[data-morte=matador]").textContent = matador;

  el.querySelector("[data-morte=dano]").textContent = t("morte.dano", {
    n: String(r?.dano ?? 0),
  });
  el.querySelector("[data-morte=hora]").textContent = t("morte.hora", {
    hora: r?.horaRotulo || "--:--",
  });

  const face = el.querySelector(".morte-hud__face");
  const img = el.querySelector(".morte-hud__sprite");
  const url = urlRetrato(r?.matadorDex, r?.matadorShiny);
  if (url && img) {
    img.src = url;
    img.alt = r?.matadorNome || "";
    face.hidden = false;
  } else if (face) {
    face.hidden = true;
  }
}

/** Entra no estado de morte no local atual — sem teleporte. */
export function entrarMorte(corpo, treinador) {
  if (estado.morteAberta) return;
  const tr = treinador || treinadorRef;
  const c = corpo || corpoRef;
  if (!tr || !c) return;
  treinadorRef = tr;

  if (tr.relatorioMorte) {
    relatorio = { ...tr.relatorioMorte };
  }
  if (!relatorio) {
    const agora = new Date();
    relatorio = {
      causa: "combate",
      dano: tr.ultimoDano | 0,
      golpeKey: tr.ultimoGolpe || "",
      golpeNome: t("morte.golpeDesconhecido"),
      matadorNome: t("morte.desconhecido"),
      matadorDex: 0,
      matadorShiny: false,
      x: c.x,
      y: c.y,
      z: c.elevacao ?? c.z ?? 0,
      horaIso: agora.toISOString(),
      horaRotulo: `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`,
    };
    tr.relatorioMorte = relatorio;
  } else {
    if (!relatorio.golpeNome) relatorio.golpeNome = t("morte.golpeDesconhecido");
    if (!relatorio.matadorNome) relatorio.matadorNome = t("morte.desconhecido");
    relatorio.x = c.x;
    relatorio.y = c.y;
    relatorio.z = c.elevacao ?? c.z ?? 0;
  }

  registrarMorte(c.x, c.y, c.elevacao ?? c.z ?? 0);
  limparCampoCombate([tr, pokemonDeployado()]);

  c.vx = 0;
  c.vy = 0;
  c.vz = 0;
  c.pulando = false;
  c.planando = false;
  c.escalando = false;
  c.voando = false;
  c.nadando = false;
  c.afogandoT = 0;
  c.hopLift = 0;
  c.pulo = null;
  c.escalada = null;
  c.mantle = null;
  c.puloCortado = false;
  c.coyoteT = 0;
  c.puloBufferT = 0;
  c.andando = false;
  // Sprite de costas + queda de lado (roll no personagem3d).
  c.facingForcado = 3;
  c.morteDesde = performance.now();
  c.morteRollSinal = (c.dirX || 0) >= 0 ? 1 : -1;

  tr.hp = 0;
  tr.morto = true;
  tr.iframe = 0;

  estado.morteAberta = true;
  pendentePouso = false;
  if (typeof document !== "undefined" && document.pointerLockElement) {
    document.exitPointerLock();
  }
  definirOlharLivre(true);

  const el = garantirDom();
  pintarTextos();
  if (el) {
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("is-visible"));
  }
  document.body.classList.add("is-morte");
  avisar();
}

function fecharOverlay() {
  estado.morteAberta = false;
  definirOlharLivre(false);
  document.body.classList.remove("is-morte");
  if (raiz) {
    raiz.classList.remove("is-visible");
    raiz.hidden = true;
  }
  avisar();
}

export function pedirRenascer() {
  if (!estado.morteAberta || pendentePouso || teleporteOcupado()) return;
  if (!RESPAWN) return;
  fecharOverlay();
  pendentePouso = true;
  comecarSubida(RESPAWN, { aoPousar: concluirRenascer });
}

function limparPoseMorte(corpo) {
  if (!corpo) return;
  corpo.facingForcado = null;
  corpo.morteDesde = null;
  corpo.morteRollSinal = null;
}

/** Chamado no pouso do teleporte de respawn. */
export function concluirRenascer(ctx) {
  pendentePouso = false;
  const tr = treinadorRef;
  const corpo = ctx?.corpo || corpoRef;
  limparCampoCombate([tr, pokemonDeployado()]);
  limparPoseMorte(corpo);
  if (tr) {
    tr.hp = tr.hpMax;
    tr.morto = false;
    tr.iframe = 2.5;
    tr.relatorioMorte = null;
    tr.ultimoDano = 0;
    tr.ultimoGolpe = "";
    tr.ultimoAtacanteId = null;
    if (corpo) {
      tr.x = corpo.x;
      tr.y = corpo.y;
      tr.z = corpo.elevacao ?? corpo.z ?? 0;
      tr.elevacao = tr.z;
    }
  }
  relatorio = null;
  avisar();
}

export function montarMorteHud() {
  garantirDom();
  aoMudarIdioma(() => {
    if (estado.morteAberta) pintarTextos();
  });
}

export function morteAberta() {
  return !!estado.morteAberta;
}
