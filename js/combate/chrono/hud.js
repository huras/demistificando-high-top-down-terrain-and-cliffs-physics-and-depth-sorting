/**
 * HUD leve do Chrono no overworld (golpes + alvo + fuga). Sem canvas de arena.
 */
import { COR_TIPO } from "../../pokemon/tipos.js";
import {
  alvosEscolhaTurno,
  escolherAlvoTurno,
  escolherGolpeTurno,
} from "../turnos.js";

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

let raiz = null;
let versaoMenu = -1;
let versaoAlvo = -1;
/** @type {null|(() => void)} */
let aoFugir = null;

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.createElement("div");
  raiz.id = "batalha-chrono";
  raiz.className = "batalha-chrono";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="batalha-chrono__cabeca">
      <p class="batalha-chrono__status" data-ch-status></p>
      <button type="button" class="batalha-chrono__fuga" data-ch-fuga>Fugir</button>
    </div>
    <div class="batalha-chrono__vidas" data-ch-vidas></div>
    <div class="batalha-chrono__turno" data-ch-turno hidden>
      <p class="batalha-chrono__turno-titulo" data-ch-turno-titulo></p>
      <div class="batalha-chrono__alvos" data-ch-alvos hidden></div>
      <div class="batalha-chrono__golpes" data-ch-golpes></div>
    </div>
  `;
  document.body.appendChild(raiz);

  raiz.querySelector("[data-ch-fuga]").addEventListener("click", () => {
    if (aoFugir) aoFugir();
  });
  raiz.querySelector("[data-ch-golpes]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-golpe]");
    if (!btn) return;
    escolherGolpeTurno(btn.dataset.golpe);
  });
  raiz.querySelector("[data-ch-alvos]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-alvo]");
    if (!btn) return;
    escolherAlvoTurno(btn.dataset.alvo);
    versaoAlvo = -1;
  });
  return raiz;
}

export function abrirHudChrono({ nomeParty, nomeFoe, onFuga } = {}) {
  const host = garantirDom();
  host.hidden = false;
  aoFugir = typeof onFuga === "function" ? onFuga : null;
  host.querySelector("[data-ch-status]").textContent =
    `${nomeParty || "Pokémon"} vs ${nomeFoe || "Selvagem"}`;
  versaoMenu = -1;
  versaoAlvo = -1;
}

export function fecharHudChrono() {
  if (!raiz) return;
  raiz.hidden = true;
  aoFugir = null;
  versaoMenu = -1;
  versaoAlvo = -1;
}

function textoAcerto(acerto) {
  const n = Number(acerto);
  if (!Number.isFinite(n) || n > 100) return "sempre";
  return `${n}%`;
}

function pintarAlvos() {
  const caixa = raiz.querySelector("[data-ch-alvos]");
  const alvos = alvosEscolhaTurno();
  if (!alvos || alvos.length <= 1) {
    caixa.hidden = true;
    caixa.replaceChildren();
    versaoAlvo = -1;
    return;
  }
  caixa.hidden = false;
  const chave = alvos.map((a) => `${a.id}:${a.selecionado ? 1 : 0}`).join("|");
  if (chave === String(versaoAlvo)) return;
  versaoAlvo = chave;
  caixa.replaceChildren();
  for (let i = 0; i < alvos.length; i++) {
    const a = alvos[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.alvo = String(a.id);
    btn.className = a.selecionado ? "is-ativo" : "";
    btn.textContent = `${a.nome} Nv.${a.nivel}`;
    caixa.appendChild(btn);
  }
}

function pintarTurno(pedido, aviso) {
  const painel = raiz.querySelector("[data-ch-turno]");
  const titulo = raiz.querySelector("[data-ch-turno-titulo]");
  const caixa = raiz.querySelector("[data-ch-golpes]");
  if (aviso) {
    painel.hidden = false;
    if (aviso.versao === versaoMenu && painel.dataset.modo === "carregar") return;
    versaoMenu = aviso.versao;
    painel.dataset.modo = "carregar";
    titulo.textContent = aviso.titulo;
    caixa.replaceChildren();
    raiz.querySelector("[data-ch-alvos]").hidden = true;
    return;
  }
  if (!pedido) {
    painel.hidden = true;
    painel.dataset.modo = "";
    versaoMenu = -1;
    return;
  }
  painel.hidden = false;
  pintarAlvos();
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
    nome.className = "batalha-chrono__golpe-nome";
    nome.textContent = g.nome;
    const meta = document.createElement("span");
    meta.className = "batalha-chrono__golpe-meta";
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

function pintarVidas(sessao) {
  const caixa = raiz.querySelector("[data-ch-vidas]");
  if (!sessao) {
    caixa.replaceChildren();
    return;
  }
  const partes = [];
  const aliado = sessao.aliados[0];
  if (aliado) {
    const max = Math.max(1, aliado.hpMax | 0);
    const cur = Math.max(0, aliado.hp | 0);
    partes.push(
      `<div class="batalha-chrono__vida batalha-chrono__vida--aliado">` +
        `<strong>${aliado.especie?.nome || "—"}</strong>` +
        `<div class="batalha-chrono__barra"><span style="transform:scaleX(${Math.min(1, cur / max)})"></span></div>` +
        `<span>${cur}/${max}</span></div>`,
    );
  }
  for (let i = 0; i < sessao.foes.length; i++) {
    const f = sessao.foes[i];
    if (!f || f.morto || f.capturado) continue;
    const max = Math.max(1, f.hpMax | 0);
    const cur = Math.max(0, f.hp | 0);
    if (cur <= 0) continue;
    partes.push(
      `<div class="batalha-chrono__vida">` +
        `<strong>${f.especie?.nome || "—"}</strong>` +
        `<div class="batalha-chrono__barra"><span style="transform:scaleX(${Math.min(1, cur / max)})"></span></div>` +
        `<span>${cur}/${max}</span></div>`,
    );
  }
  caixa.innerHTML = partes.join("");
}

export function tickHudChrono(pedido, aviso, sessao) {
  if (!raiz || raiz.hidden) return;
  pintarVidas(sessao);
  pintarTurno(pedido, aviso);
}
