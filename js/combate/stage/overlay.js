/**
 * Overlay fullscreen do BattleStage (canvas + HUD).
 */
import {
  avisoTurno,
  concluirFoco,
  emFoco,
  enquadramentoTurno,
  modoTurnos,
  pedidoEscolha,
} from "../turnos.js";
import { limparInterludio } from "../luta.js";
import { observarTiro, poseDisparo, poseImpacto, ritmoImpacto } from "../impacto.js";
import { primeiroTiro } from "../../pokemon/combate/projeteis.js";
import { definirOmbro, desenharStage, ligarStage } from "./stage3d.js";
import {
  ligarCliquesHud,
  pintarTurnoStage,
  pintarVidasStage,
  resetarAssinaturaVidasStage,
} from "./hud.js";

const FOCO_MAX = 0.45;

/** @type {HTMLElement|null} */
let raiz = null;
/** @type {HTMLCanvasElement|null} */
let canvas = null;
let ritmo = 1;
let focoAcc = 0;
const poseTiro = { tipo: "tiro", alvo: null };
/** @type {null|(() => void)} */
let aoFugir = null;
/** @type {null|(() => object[])} */
let obterAtores = null;
/** @type {null|(() => { aliados?: object[], foes?: object[] }|null)} */
let obterSessaoHud = null;

const ui = {
  versaoMenu: -1,
  versaoAlvo: /** @type {number|string} */ (-1),
  statusEscolhaVersao: -1,
  onStatus: /** @type {null|((t: string) => void)} */ (null),
};

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.createElement("div");
  raiz.id = "batalha-stage";
  raiz.className = "batalha-stage";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="batalha-stage__topo hud-head">
      <div class="batalha-stage__nomes">
        <span data-bs-esq>Você</span>
        <span data-bs-dir>Oponente</span>
      </div>
      <p class="batalha-stage__status" data-bs-status></p>
      <button type="button" class="batalha-stage__fuga hud-btn red small" data-bs-fuga hidden>Fugir</button>
    </div>
    <canvas class="batalha-stage__vista" data-bs-vista></canvas>
    <div class="batalha-stage__vidas batalha-turno__vidas" data-bs-vidas></div>
    <div class="batalha-stage__turno hud-panel" data-bs-turno hidden>
      <p class="batalha-turno__titulo" data-bs-turno-titulo></p>
      <div class="batalha-turno__alvos" data-bs-alvos hidden></div>
      <div class="batalha-turno__golpes" data-bs-golpes></div>
    </div>
  `;
  document.body.appendChild(raiz);
  canvas = raiz.querySelector("[data-bs-vista]");
  ligarCliquesHud(raiz);
  raiz.querySelector("[data-bs-fuga]").addEventListener("click", () => {
    if (aoFugir) aoFugir();
  });
  ui.onStatus = (t) => definirStatusStage(t);
  return raiz;
}

export function overlayStageAberto() {
  return !!(raiz && !raiz.hidden);
}

/**
 * @param {{
 *  nomePlayer?: string,
 *  nomeFoe?: string,
 *  podeFugir?: boolean,
 *  onFuga?: () => void,
 *  obterAtores?: () => object[],
 *  obterSessaoHud?: () => object|null,
 * }} [opts]
 */
export function abrirOverlayStage(opts = {}) {
  const host = garantirDom();
  host.hidden = false;
  host.querySelector("[data-bs-esq]").textContent = opts.nomePlayer || "Você";
  host.querySelector("[data-bs-dir]").textContent = opts.nomeFoe || "Oponente";
  host.querySelector("[data-bs-status]").textContent = "A batalha começou!";
  const fuga = host.querySelector("[data-bs-fuga]");
  fuga.hidden = !opts.podeFugir;
  aoFugir = typeof opts.onFuga === "function" ? opts.onFuga : null;
  obterAtores = typeof opts.obterAtores === "function" ? opts.obterAtores : null;
  obterSessaoHud = typeof opts.obterSessaoHud === "function" ? opts.obterSessaoHud : null;
  ui.versaoMenu = -1;
  ui.versaoAlvo = -1;
  ui.statusEscolhaVersao = -1;
  resetarAssinaturaVidasStage();
  ritmo = 1;
  focoAcc = 0;
  redimensionar();
  ligarStage(canvas);
  window.addEventListener("resize", redimensionar);
  document.body.classList.add("batalha-stage-ativa");
  document.body.dataset.batalhaStage = "1";
  return canvas;
}

export function fecharOverlayStage() {
  if (!raiz) return;
  raiz.hidden = true;
  window.removeEventListener("resize", redimensionar);
  aoFugir = null;
  obterAtores = null;
  obterSessaoHud = null;
  ui.versaoMenu = -1;
  ui.versaoAlvo = -1;
  ui.statusEscolhaVersao = -1;
  resetarAssinaturaVidasStage();
  const vidas = raiz.querySelector("[data-bs-vidas]");
  if (vidas) vidas.replaceChildren();
  ritmo = 1;
  focoAcc = 0;
  document.body.classList.remove("batalha-stage-ativa");
  delete document.body.dataset.batalhaStage;
}

export function definirStatusStage(texto) {
  if (!raiz) return;
  raiz.querySelector("[data-bs-status]").textContent = texto || "";
}

function redimensionar() {
  if (!canvas || !raiz) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width || window.innerWidth));
  const h = Math.max(240, Math.floor(rect.height || window.innerHeight * 0.55));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
}

function poseDoQuadro(atores) {
  const impacto = poseImpacto();
  if (impacto) return impacto;
  const disparo = poseDisparo();
  if (disparo) return disparo;
  const tiro = primeiroTiro();
  if (tiro) {
    poseTiro.alvo = tiro;
    return poseTiro;
  }
  const lista = atores || [];
  const vivoA = lista.find((a) => a && !a.morto && (a.hp == null || a.hp > 0) && a.faccao !== "selvagem" && a.faccao !== "direita");
  const vivoB = lista.find((a) => a && !a.morto && (a.hp == null || a.hp > 0) && (a.faccao === "selvagem" || a.faccao === "direita"));
  if (vivoA && vivoB) {
    return { tipo: "teatro", a: vivoA, b: vivoB, giro: Math.PI * 0.12 };
  }
  return enquadramentoTurno();
}

function sairDoFoco() {
  focoAcc = 0;
  ritmo = 0;
  concluirFoco();
  limparInterludio();
}

function andarRitmo(bruto) {
  if (emFoco()) {
    focoAcc += bruto;
    if (focoAcc >= FOCO_MAX) {
      sairDoFoco();
      return;
    }
  } else {
    focoAcc = 0;
  }

  const pedidoRitmo = ritmoImpacto();
  if (pedidoRitmo !== 1) {
    const passo = bruto / 0.12;
    ritmo =
      ritmo > pedidoRitmo
        ? Math.max(pedidoRitmo, ritmo - passo)
        : Math.min(pedidoRitmo, ritmo + passo);
    return;
  }
  if (!modoTurnos()) {
    if (ritmo > 1) ritmo = Math.max(1, ritmo - bruto / 0.2);
    else ritmo = ritmo < 1 ? Math.min(1, ritmo + bruto / 0.35) : 1;
    return;
  }
  if (emFoco()) {
    ritmo = Math.max(0, ritmo - bruto / 0.5);
    if (ritmo <= 0.02) sairDoFoco();
    return;
  }
  if (pedidoEscolha()) {
    ritmo = 0;
    return;
  }
  if (ritmo > 1) ritmo = Math.max(1, ritmo - bruto / 0.2);
  else if (ritmo < 1) ritmo = Math.min(1, ritmo + bruto / 0.4);
}

/**
 * @param {number} bruto
 * @param {(passo: number) => void} tickFn
 */
export function tickOverlayStage(bruto, tickFn) {
  if (!overlayStageAberto()) return;
  if (modoTurnos()) observarTiro(primeiroTiro());
  else observarTiro(null);
  andarRitmo(bruto);
  const pedido = pedidoEscolha();
  let resto = pedido ? 0 : Math.min(0.1, bruto * ritmo);
  if (!Number.isFinite(resto) || resto < 0) resto = 0;
  while (resto > 1e-4) {
    if (pedidoEscolha()) break;
    const passo = Math.min(0.05, resto);
    if (typeof tickFn === "function") tickFn(passo);
    resto -= passo;
  }
  const atores = obterAtores ? obterAtores() : [];
  definirOmbro(poseDoQuadro(atores), bruto);
  desenharStage(atores, bruto);
  const hudSessao = obterSessaoHud ? obterSessaoHud() : null;
  pintarVidasStage(raiz, hudSessao);
  pintarTurnoStage(raiz, ui, pedidoEscolha(), avisoTurno());
}
