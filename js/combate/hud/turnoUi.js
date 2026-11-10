/**
 * Chrome compartilhado de turno (Chrono + Stage): cards de golpe e barras de HP.
 */
import { COR_TIPO } from "../../pokemon/tipos.js";
import { preencherIconeGolpe } from "../../jogo/iconesGolpe.js";
import { definirEscudoTipo, garantirAtlasTipo } from "../../jogo/tipoEscudo.js";
import { alvosEscolhaTurno, escolherAlvoTurno } from "../turnos.js";

export const ROTULO_TIPO = Object.freeze({
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
});

export const ROTULO_FORMA = Object.freeze({
  contact: "Contato",
  projectile: "Projétil",
  arc: "Arco",
  radius: "Área",
});

export const ROTULO_CATEGORIA = Object.freeze({
  physical: "Físico",
  special: "Especial",
  status: "Status",
});

garantirAtlasTipo().catch(() => {});

export function textoAcerto(acerto) {
  const n = Number(acerto);
  if (!Number.isFinite(n) || n > 100) return "sempre";
  return `${n | 0}%`;
}

export function corTipo(tipo) {
  return COR_TIPO[tipo] || "#9ca3af";
}

export function faixaHp(cur, max) {
  const r = max > 0 ? cur / max : 0;
  if (r <= 0.2) return "crit";
  if (r <= 0.5) return "mid";
  return "ok";
}

/**
 * Card clicável de golpe (DNA skill-card).
 * @param {object} g
 * @returns {HTMLButtonElement}
 */
export function montarCardGolpe(g) {
  const tipo = g?.tipo || "normal";
  const cor = corTipo(tipo);
  const poder = g?.poder | 0;
  const forma = ROTULO_FORMA[g?.forma] || g?.forma || "—";
  const categoria = ROTULO_CATEGORIA[g?.categoria] || g?.categoria || "—";
  const poderTxt = poder > 0 ? String(poder) : "—";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "batalha-turno__golpe";
  btn.dataset.golpe = g?.chave || "";
  btn.style.setProperty("--card-tipo", cor);

  const top = document.createElement("div");
  top.className = "batalha-turno__golpe-top";

  const typeHost = document.createElement("span");
  typeHost.className = "batalha-turno__golpe-tipo";
  typeHost.setAttribute("aria-hidden", "true");
  definirEscudoTipo(typeHost, tipo, 24);

  const titles = document.createElement("div");
  titles.className = "batalha-turno__golpe-titles";
  const nome = document.createElement("b");
  nome.className = "batalha-turno__golpe-nome";
  nome.textContent = g?.nome || "?";
  const sub = document.createElement("span");
  sub.className = "batalha-turno__golpe-sub";
  sub.textContent = `${forma} · ${categoria}`;
  titles.append(nome, sub);

  const art = document.createElement("span");
  art.className = "batalha-turno__golpe-art";
  art.hidden = true;
  const temArt = preencherIconeGolpe(art, g?.chave, tipo);
  if (temArt) art.hidden = false;

  top.append(typeHost, titles, art);

  const stats = document.createElement("dl");
  stats.className = "batalha-turno__golpe-stats";
  stats.innerHTML =
    `<div><dt>Poder</dt><dd>${poderTxt}</dd></div>` +
    `<div><dt>Acerto</dt><dd>${textoAcerto(g?.acerto)}</dd></div>` +
    `<div><dt>PP</dt><dd>${g?.custo | 0}</dd></div>`;

  btn.append(top, stats);
  return btn;
}

/**
 * @param {object|null|undefined} sessao
 * @param {{ soPrimeiroAliado?: boolean }} [opts]
 */
export function assinaturaVidas(sessao, opts = {}) {
  if (!sessao) return "";
  const partes = [];
  const aliados = sessao.aliados || [];
  const limAliado = opts.soPrimeiroAliado ? Math.min(1, aliados.length) : aliados.length;
  for (let i = 0; i < limAliado; i++) {
    const a = aliados[i];
    if (!a || a.morto || a.capturado) continue;
    partes.push(`a:${a.id}|${a.especie?.nome || ""}|${a.hpMax | 0}|${a.nivel | 0}`);
  }
  const foes = sessao.foes || [];
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (!f || f.morto || f.capturado) continue;
    if ((f.hp | 0) <= 0) continue;
    partes.push(`f:${f.id}|${f.especie?.nome || ""}|${f.hpMax | 0}|${f.nivel | 0}`);
  }
  return partes.join(";");
}

function montarLinhaVida(ator, lado) {
  const max = Math.max(1, ator.hpMax | 0);
  const cur = Math.max(0, ator.hp | 0);
  const row = document.createElement("div");
  row.className =
    lado === "aliado"
      ? "batalha-turno__vida batalha-turno__vida--aliado"
      : "batalha-turno__vida batalha-turno__vida--foe";
  row.dataset.atorId = String(ator.id);
  row.dataset.lado = lado;

  const nome = document.createElement("strong");
  nome.className = "batalha-turno__vida-nome";
  nome.textContent = ator.especie?.nome || "—";

  const nv = document.createElement("span");
  nv.className = "batalha-turno__vida-nv";
  const nivel = ator.nivel | 0;
  nv.textContent = nivel > 0 ? `Nv.${nivel}` : "";

  const barra = document.createElement("div");
  barra.className = "batalha-turno__barra";
  const fill = document.createElement("i");
  fill.dataset.hpFill = "1";
  barra.appendChild(fill);

  const num = document.createElement("span");
  num.className = "batalha-turno__vida-num";
  num.dataset.hpNum = "1";

  row.append(nome, nv, barra, num);
  aplicarHpNaLinha(row, cur, max);
  return row;
}

function aplicarHpNaLinha(row, cur, max) {
  const fill = row.querySelector("[data-hp-fill]");
  const num = row.querySelector("[data-hp-num]");
  const r = Math.min(1, Math.max(0, cur / Math.max(1, max)));
  if (fill) {
    fill.style.transform = `scaleX(${r})`;
    fill.dataset.faixa = faixaHp(cur, max);
  }
  if (num) num.textContent = `${cur}/${max}`;
}

/**
 * Monta/atualiza barras de HP sem innerHTML a cada tick.
 * @param {HTMLElement} caixa
 * @param {object|null|undefined} sessao
 * @param {{ soPrimeiroAliado?: boolean, assinatura?: { atual: string } }} [opts]
 */
export function atualizarBarrasHp(caixa, sessao, opts = {}) {
  if (!caixa) return;
  if (!sessao) {
    caixa.replaceChildren();
    if (opts.assinatura) opts.assinatura.atual = "";
    return;
  }

  const chave = assinaturaVidas(sessao, opts);
  const precisaRebuild = !opts.assinatura || opts.assinatura.atual !== chave;
  if (precisaRebuild) {
    if (opts.assinatura) opts.assinatura.atual = chave;
    caixa.replaceChildren();
    const aliados = sessao.aliados || [];
    const limAliado = opts.soPrimeiroAliado ? Math.min(1, aliados.length) : aliados.length;
    for (let i = 0; i < limAliado; i++) {
      const a = aliados[i];
      if (!a || a.morto || a.capturado) continue;
      caixa.appendChild(montarLinhaVida(a, "aliado"));
    }
    const foes = sessao.foes || [];
    for (let i = 0; i < foes.length; i++) {
      const f = foes[i];
      if (!f || f.morto || f.capturado) continue;
      if ((f.hp | 0) <= 0) continue;
      caixa.appendChild(montarLinhaVida(f, "foe"));
    }
  }

  const mapa = new Map();
  const aliados = sessao.aliados || [];
  for (let i = 0; i < aliados.length; i++) {
    const a = aliados[i];
    if (a) mapa.set(String(a.id), a);
  }
  const foes = sessao.foes || [];
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (f) mapa.set(String(f.id), f);
  }
  const linhas = caixa.querySelectorAll(".batalha-turno__vida");
  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i];
    const ator = mapa.get(row.dataset.atorId || "");
    if (!ator) continue;
    aplicarHpNaLinha(row, Math.max(0, ator.hp | 0), Math.max(1, ator.hpMax | 0));
  }
}

/**
 * @param {HTMLElement} caixa
 * @param {{ versaoAlvo: number|string }} estadoUi
 */
export function pintarAlvosTurno(caixa, estadoUi) {
  if (!caixa) return;
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
    btn.className = a.selecionado
      ? "batalha-turno__alvo hud-pill is-on"
      : "batalha-turno__alvo hud-pill";
    btn.dataset.alvo = String(a.id);
    btn.textContent = `${a.nome} Nv.${a.nivel}`;
    caixa.appendChild(btn);
  }
}

/**
 * @param {HTMLElement} raiz
 * @param {{
 *  versaoMenu: number,
 *  versaoAlvo: number|string,
 *  statusEscolhaVersao?: number,
 *  onStatus?: (t: string) => void,
 * }} estadoUi
 * @param {object|null} pedido
 * @param {object|null} aviso
 * @param {{
 *  turno?: string,
 *  titulo?: string,
 *  golpes?: string,
 *  alvos?: string,
 * }} sels
 */
export function pintarPainelTurno(raiz, estadoUi, pedido, aviso, sels) {
  const painel = raiz.querySelector(sels.turno || "[data-turno]");
  const titulo = raiz.querySelector(sels.titulo || "[data-turno-titulo]");
  const caixa = raiz.querySelector(sels.golpes || "[data-golpes]");
  const alvos = raiz.querySelector(sels.alvos || "[data-alvos]");
  if (!painel || !titulo || !caixa) return;

  if (aviso) {
    painel.hidden = false;
    if (aviso.versao === estadoUi.versaoMenu && painel.dataset.modo === "carregar") return;
    estadoUi.versaoMenu = aviso.versao;
    painel.dataset.modo = "carregar";
    titulo.textContent = aviso.titulo;
    caixa.replaceChildren();
    if (alvos) alvos.hidden = true;
    return;
  }
  if (!pedido) {
    painel.hidden = true;
    painel.dataset.modo = "";
    estadoUi.versaoMenu = -1;
    return;
  }
  painel.hidden = false;
  if (alvos) pintarAlvosTurno(alvos, estadoUi);
  if (pedido.versao === estadoUi.versaoMenu && painel.dataset.modo === "escolha") return;
  estadoUi.versaoMenu = pedido.versao;
  painel.dataset.modo = "escolha";
  titulo.textContent = "Seu turno";
  if (
    typeof estadoUi.statusEscolhaVersao === "number" &&
    pedido.versao !== estadoUi.statusEscolhaVersao
  ) {
    estadoUi.statusEscolhaVersao = pedido.versao;
    if (estadoUi.onStatus) {
      const mon = pedido.nome || "Pokémon";
      estadoUi.onStatus(`O que ${mon} fará?`);
    }
  }
  caixa.replaceChildren();
  for (let i = 0; i < pedido.golpes.length; i++) {
    caixa.appendChild(montarCardGolpe(pedido.golpes[i]));
  }
}

/** Ligar clique em alvo (opcional — Chrono/Stage podem fazer no host). */
export function aoCliqueAlvo(ev) {
  const btn = ev.target.closest("button[data-alvo]");
  if (!btn) return false;
  escolherAlvoTurno(btn.dataset.alvo);
  return true;
}
