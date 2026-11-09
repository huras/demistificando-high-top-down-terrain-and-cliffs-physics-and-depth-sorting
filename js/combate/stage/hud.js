/**
 * HUD de comando do BattleStage (golpes, alvos, HP, fuga).
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

function textoAcerto(acerto) {
  const n = Number(acerto);
  if (!Number.isFinite(n) || n > 100) return "sempre";
  return `${n}%`;
}

/**
 * @param {HTMLElement} raiz
 * @param {{
 *  versaoMenu: number,
 *  versaoAlvo: number|string,
 *  statusEscolhaVersao: number,
 *  onStatus?: (t: string) => void,
 * }} estadoUi
 * @param {object|null} pedido
 * @param {object|null} aviso
 */
export function pintarTurnoStage(raiz, estadoUi, pedido, aviso) {
  const painel = raiz.querySelector("[data-bs-turno]");
  const titulo = raiz.querySelector("[data-bs-turno-titulo]");
  const caixa = raiz.querySelector("[data-bs-golpes]");
  const alvos = raiz.querySelector("[data-bs-alvos]");
  if (aviso) {
    painel.hidden = false;
    if (aviso.versao === estadoUi.versaoMenu && painel.dataset.modo === "carregar") return;
    estadoUi.versaoMenu = aviso.versao;
    painel.dataset.modo = "carregar";
    titulo.textContent = aviso.titulo;
    caixa.replaceChildren();
    alvos.hidden = true;
    return;
  }
  if (!pedido) {
    painel.hidden = true;
    painel.dataset.modo = "";
    estadoUi.versaoMenu = -1;
    return;
  }
  painel.hidden = false;
  pintarAlvosStage(raiz, estadoUi);
  if (pedido.versao === estadoUi.versaoMenu && painel.dataset.modo === "escolha") return;
  estadoUi.versaoMenu = pedido.versao;
  painel.dataset.modo = "escolha";
  titulo.textContent = "Seu turno";
  if (pedido.versao !== estadoUi.statusEscolhaVersao) {
    estadoUi.statusEscolhaVersao = pedido.versao;
    if (estadoUi.onStatus) {
      const mon = pedido.nome || "Pokémon";
      estadoUi.onStatus(`O que ${mon} fará?`);
    }
  }
  caixa.replaceChildren();
  for (let i = 0; i < pedido.golpes.length; i++) {
    const g = pedido.golpes[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.golpe = g.chave;
    const nome = document.createElement("span");
    nome.className = "batalha-stage__golpe-nome";
    nome.textContent = g.nome;
    const meta = document.createElement("span");
    meta.className = "batalha-stage__golpe-meta";
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

function pintarAlvosStage(raiz, estadoUi) {
  const caixa = raiz.querySelector("[data-bs-alvos]");
  const alvos = alvosEscolhaTurno();
  if (!alvos || alvos.length <= 1) {
    caixa.hidden = true;
    caixa.replaceChildren();
    estadoUi.versaoAlvo = -1;
    return;
  }
  caixa.hidden = false;
  const chave = alvos.map((a) => `${a.id}:${a.selecionado ? 1 : 0}`).join("|");
  if (chave === String(estadoUi.versaoAlvo)) return;
  estadoUi.versaoAlvo = chave;
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

/**
 * @param {HTMLElement} raiz
 * @param {{ aliados?: object[], foes?: object[] }|null} sessao
 */
export function pintarVidasStage(raiz, sessao) {
  const caixa = raiz.querySelector("[data-bs-vidas]");
  if (!sessao) {
    caixa.replaceChildren();
    return;
  }
  const partes = [];
  const aliados = sessao.aliados || [];
  for (let i = 0; i < aliados.length; i++) {
    const a = aliados[i];
    if (!a || a.morto || a.capturado) continue;
    const max = Math.max(1, a.hpMax | 0);
    const cur = Math.max(0, a.hp | 0);
    partes.push(
      `<div class="batalha-stage__vida batalha-stage__vida--aliado">` +
        `<strong>${a.especie?.nome || "—"}</strong>` +
        `<div class="batalha-stage__barra"><span style="transform:scaleX(${Math.min(1, cur / max)})"></span></div>` +
        `<span>${cur}/${max}</span></div>`,
    );
  }
  const foes = sessao.foes || [];
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (!f || f.morto || f.capturado) continue;
    const max = Math.max(1, f.hpMax | 0);
    const cur = Math.max(0, f.hp | 0);
    if (cur <= 0) continue;
    partes.push(
      `<div class="batalha-stage__vida">` +
        `<strong>${f.especie?.nome || "—"}</strong>` +
        `<div class="batalha-stage__barra"><span style="transform:scaleX(${Math.min(1, cur / max)})"></span></div>` +
        `<span>${cur}/${max}</span></div>`,
    );
  }
  caixa.innerHTML = partes.join("");
}

export function ligarCliquesHud(raiz) {
  raiz.querySelector("[data-bs-golpes]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-golpe]");
    if (!btn) return;
    escolherGolpeTurno(btn.dataset.golpe);
  });
  raiz.querySelector("[data-bs-alvos]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-alvo]");
    if (!btn) return;
    escolherAlvoTurno(btn.dataset.alvo);
  });
}
