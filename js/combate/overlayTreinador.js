/**
 * HUD + canvas da batalha treinador (overlay fullscreen).
 */
import { COR_TIPO } from "../pokemon/tipos.js";
import { desenharArena, ligarArena, definirOmbro } from "./arena3d.js";
import { atoresArena, estadoLuta } from "./luta.js";
import {
  avisoTurno,
  concluirFoco,
  escolherGolpeTurno,
  emFoco,
  enquadramentoTurno,
  modoTurnos,
  pedidoEscolha,
} from "./turnos.js";
import { limparInterludio } from "./luta.js";
import { observarTiro, poseDisparo, poseImpacto, ritmoImpacto } from "./impacto.js";
import { primeiroTiro } from "../pokemon/combate/projeteis.js";

const TIPO = {
  normal: "normal",
  fire: "fogo",
  water: "água",
  electric: "elétrico",
  grass: "planta",
  ice: "gelo",
  fighting: "lutador",
  poison: "veneno",
  ground: "terra",
  flying: "voador",
  psychic: "psíquico",
  bug: "inseto",
  rock: "pedra",
  ghost: "fantasma",
  dragon: "dragão",
  dark: "noturno",
  steel: "aço",
  fairy: "fada",
};

const FORMA = {
  contact: "contato",
  projectile: "projétil",
  arc: "arco",
  radius: "área",
};

const CATEGORIA = {
  physical: "físico",
  special: "especial",
  status: "status",
};

/** @type {HTMLElement|null} */
let raiz = null;
/** @type {HTMLCanvasElement|null} */
let canvas = null;
let versaoMenu = -1;
let ritmo = 1;
const poseTiro = { tipo: "tiro", alvo: null };

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.createElement("div");
  raiz.id = "batalha-treinador";
  raiz.className = "batalha-treinador";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="batalha-treinador__topo">
      <div class="batalha-treinador__nomes">
        <span data-bt-esq>Você</span>
        <span data-bt-dir>Treinador</span>
      </div>
      <p class="batalha-treinador__status" data-bt-status></p>
    </div>
    <canvas class="batalha-treinador__vista" data-bt-vista></canvas>
    <div class="batalha-treinador__vidas">
      <div class="batalha-treinador__vida" data-bt-vida-esq>
        <span data-bt-nome-esq>—</span>
        <div class="batalha-treinador__barra"><span data-bt-barra-esq></span></div>
        <span data-bt-hp-esq></span>
      </div>
      <div class="batalha-treinador__vida" data-bt-vida-dir>
        <span data-bt-nome-dir>—</span>
        <div class="batalha-treinador__barra"><span data-bt-barra-dir></span></div>
        <span data-bt-hp-dir></span>
      </div>
    </div>
    <div class="batalha-treinador__turno" data-bt-turno hidden>
      <p class="batalha-treinador__turno-titulo" data-bt-turno-titulo></p>
      <div class="batalha-treinador__golpes" data-bt-golpes></div>
    </div>
  `;
  document.body.appendChild(raiz);
  canvas = raiz.querySelector("[data-bt-vista]");
  const golpes = raiz.querySelector("[data-bt-golpes]");
  golpes.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn || !golpes.contains(btn)) return;
    escolherGolpeTurno(btn.dataset.golpe);
  });
  return raiz;
}

export function overlayAberto() {
  return !!(raiz && !raiz.hidden);
}

export function abrirOverlayTreinador({ nomePlayer, nomeFoe } = {}) {
  const host = garantirDom();
  host.hidden = false;
  host.querySelector("[data-bt-esq]").textContent = nomePlayer || "Você";
  host.querySelector("[data-bt-dir]").textContent = nomeFoe || "Treinador";
  host.querySelector("[data-bt-status]").textContent = "A batalha começou!";
  redimensionar();
  ligarArena(canvas);
  window.addEventListener("resize", redimensionar);
  return canvas;
}

export function fecharOverlayTreinador() {
  if (!raiz) return;
  raiz.hidden = true;
  window.removeEventListener("resize", redimensionar);
  versaoMenu = -1;
  ritmo = 1;
}

export function definirStatusBatalha(texto) {
  if (!raiz) return;
  raiz.querySelector("[data-bt-status]").textContent = texto || "";
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

function pintarVida(lado) {
  const e = estadoLuta();
  const ator = lado === "esquerda" ? e.esquerda : e.direita;
  const suf = lado === "esquerda" ? "esq" : "dir";
  const nome = raiz.querySelector(`[data-bt-nome-${suf}]`);
  const hp = raiz.querySelector(`[data-bt-hp-${suf}]`);
  const barra = raiz.querySelector(`[data-bt-barra-${suf}]`);
  if (!ator) {
    nome.textContent = "—";
    hp.textContent = "";
    barra.style.transform = "scaleX(0)";
    return;
  }
  nome.textContent = `${ator.especie?.nome || "—"} Nv.${ator.nivel | 0}`;
  const max = Math.max(1, ator.hpMax | 0);
  const cur = Math.max(0, ator.hp | 0);
  hp.textContent = `${cur}/${max}`;
  barra.style.transform = `scaleX(${Math.min(1, cur / max)})`;
}

function textoAcerto(acerto) {
  const n = Number(acerto);
  if (!Number.isFinite(n) || n > 100) return "sempre";
  return `${n}%`;
}

function pintarTurno(pedido, aviso) {
  const painel = raiz.querySelector("[data-bt-turno]");
  const titulo = raiz.querySelector("[data-bt-turno-titulo]");
  const caixa = raiz.querySelector("[data-bt-golpes]");
  if (aviso) {
    painel.hidden = false;
    if (aviso.versao === versaoMenu && painel.dataset.modo === "carregar") return;
    versaoMenu = aviso.versao;
    painel.dataset.modo = "carregar";
    titulo.textContent = aviso.titulo;
    caixa.replaceChildren();
    return;
  }
  if (!pedido) {
    painel.hidden = true;
    painel.dataset.modo = "";
    versaoMenu = -1;
    return;
  }
  painel.hidden = false;
  if (pedido.versao === versaoMenu && painel.dataset.modo === "escolha") return;
  versaoMenu = pedido.versao;
  painel.dataset.modo = "escolha";
  titulo.textContent = "Seu turno";
  caixa.replaceChildren();
  for (let i = 0; i < pedido.golpes.length; i++) {
    const g = pedido.golpes[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.golpe = g.chave;
    const nome = document.createElement("span");
    nome.className = "batalha-treinador__golpe-nome";
    nome.textContent = g.nome;
    const meta = document.createElement("span");
    meta.className = "batalha-treinador__golpe-meta";
    const forma = FORMA[g.forma] || g.forma;
    const tipo = TIPO[g.tipo] || g.tipo;
    const poderTxt =
      (g.poder | 0) <= 0
        ? CATEGORIA[g.categoria] || "status"
        : `poder ${g.poder}`;
    meta.textContent = `${tipo} · ${forma} · ${poderTxt} · ${textoAcerto(g.acerto)} · PP ${g.custo}`;
    meta.style.color = COR_TIPO[g.tipo] || "#9fb0a6";
    btn.append(nome, meta);
    caixa.appendChild(btn);
  }
}

function poseDoQuadro() {
  const impacto = poseImpacto();
  if (impacto) return impacto;
  const disparo = poseDisparo();
  if (disparo) return disparo;
  const tiro = primeiroTiro();
  if (tiro) {
    poseTiro.alvo = tiro;
    return poseTiro;
  }
  const e = estadoLuta();
  if (e.acabou && e.esquerda && e.direita) {
    return { tipo: "teatro", a: e.esquerda, b: e.direita, giro: Math.PI * 0.12 };
  }
  return enquadramentoTurno();
}

function andarRitmo(bruto) {
  const pedidoRitmo = ritmoImpacto();
  if (pedidoRitmo !== 1) {
    const passo = bruto / 0.12;
    ritmo =
      ritmo > pedidoRitmo
        ? Math.max(pedidoRitmo, ritmo - passo)
        : Math.min(pedidoRitmo, ritmo + passo);
    return;
  }
  if (!modoTurnos() || !estadoLuta().lutando) {
    if (ritmo > 1) ritmo = Math.max(1, ritmo - bruto / 0.2);
    else ritmo = ritmo < 1 ? Math.min(1, ritmo + bruto / 0.35) : 1;
    return;
  }
  if (emFoco()) {
    ritmo = Math.max(0, ritmo - bruto / 0.5);
    if (ritmo <= 0.02) {
      ritmo = 0;
      concluirFoco();
      limparInterludio();
    }
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
 * Avança um frame da arena. Retorna dt efetivo já aplicado em tickLuta (via caller).
 * @param {number} bruto dt bruto do jogo
 * @param {(passo: number) => void} tickFn
 */
export function tickOverlayTreinador(bruto, tickFn) {
  if (!overlayAberto()) return;
  if (modoTurnos()) observarTiro(primeiroTiro());
  else observarTiro(null);
  andarRitmo(bruto);
  const pedido = pedidoEscolha();
  let resto = pedido ? 0 : Math.min(0.1, bruto * ritmo);
  if (!Number.isFinite(resto) || resto < 0) resto = 0;
  while (resto > 1e-4) {
    if (pedidoEscolha()) break;
    const passo = Math.min(0.05, resto);
    tickFn(passo);
    resto -= passo;
  }
  definirOmbro(poseDoQuadro(), bruto);
  desenharArena(atoresArena(), bruto);
  pintarTurno(pedidoEscolha(), avisoTurno());
  pintarVida("esquerda");
  pintarVida("direita");
}
