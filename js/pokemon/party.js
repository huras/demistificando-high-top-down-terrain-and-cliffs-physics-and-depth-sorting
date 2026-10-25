import { POKEMON } from "../config.js";
import { AGENTE_DIST_SEGUIR, OFFSET_MON } from "../navegacao/espacoSeguir.js";
import { atualizarAgente, garantirCorpoLocomocao } from "../fisica/agente.js";
import { resetarNav } from "../navegacao/seguirCaminho.js";
import { resolverForaDeObstaculo } from "../fisica/obstaculos.js";
import { PERFIL_CAMPO } from "../navegacao/perfilMovimento.js";
import { AI_MODE } from "./aiModes.js";
import {
  aplicarModoParty,
  definirDefaultFollowerMode,
  obterDefaultFollowerMode,
  sincronizarModosParty,
} from "./campo/modos.js";
import { criarAtor } from "./ator.js";
import { especie } from "./dados.js";
import { encherPp } from "./pp.js";
import { definirEmocao, EMOCAO } from "./emocoes.js";
import { anunciarGanho } from "../jogo/ganhoItem.js";
import { soltarFxEnvio, soltarFxRecolher } from "../fx/fxBola.js";
import { markSpeciesCaught } from "../jogo/pokedex/progresso.js";

const party = [];
let deployado = 0;
const bolsa = new Map();

function hidratarModo(ator) {
  if (!ator) return;
  if (ator.modePreference == null) ator.modePreference = AI_MODE.DEFAULT;
  aplicarModoParty(ator, ator.modePreference);
}

export function iniciarParty() {
  party.length = 0;
  const esp = especie("bulbasaur") || especie("pidgey");
  if (!esp) return;
  const mon = criarAtor({
    id: "party-0",
    especie: esp,
    nivel: 5,
    faccao: "party",
    x: 0,
    y: 0,
    z: 1,
    hostil: false,
  });
  hidratarModo(mon);
  party.push(mon);
  deployado = 0;
}

export function setFollowerMode(indice, mode) {
  const ator = party[indice | 0];
  if (!ator) return false;
  aplicarModoParty(ator, mode);
  return true;
}

export function setDefaultFollowerMode(mode) {
  definirDefaultFollowerMode(mode);
  sincronizarModosParty(party);
  return obterDefaultFollowerMode();
}

export function defaultFollowerMode() {
  return obterDefaultFollowerMode();
}

export function listaParty() {
  return party;
}

export function pokemonNoCampo() {
  return party[deployado] || null;
}

export function pokemonDeployado() {
  const p = party[deployado];
  return p && !p.morto && !p.capturado && p.hp > 0 ? p : null;
}

function monVivo(ator) {
  return !!(ator && !ator.morto && ator.hp > 0);
}

function recolher(ator) {
  if (!ator || ator.capturado) return false;
  soltarFxRecolher(ator);
  ator.capturado = true;
  ator._colocado = false;
  ator.mortoAte = 0;
  ator.ordemCampo = null;
  ator.ordemForca = null;
  ator.ordemAlvo = null;
  ator.alvo = null;
  if (ator.modo === "agro") ator.modo = "roam";
  return true;
}

/** Recolhe mon do campo pra bola (desmaio / troca). */
export function recolherDoCampo(ator) {
  return recolher(ator);
}

function pedirEnvio(ator) {
  ator.capturado = false;
  ator.morto = false;
  ator._colocado = false;
  ator._pedidoEnvio = true;
}

/** O Pokémon em campo persegue e ataca esse selvagem. */
export function ordenarAtaque(alvo) {
  const mon = pokemonDeployado();
  if (!mon || !alvo || alvo === mon || alvo.morto || alvo.capturado) return false;
  if (alvo.faccao === "party") return false;
  mon.ordemAlvo = alvo;
  mon.modo = "agro";
  mon.alvo = alvo;
  mon.presoT = 0;
  definirEmocao(mon, EMOCAO.RAIVA, { duracao: 1.1 });
  definirEmocao(alvo, EMOCAO.EXCLAMACAO, { duracao: 1.1 });
  return true;
}

/** Selvagem que o Pokémon em campo foi mandado atacar, ou null. */
export function alvoDeOrdem() {
  const mon = pokemonDeployado();
  const alvo = mon?.ordemAlvo;
  if (!alvo || alvo.morto || alvo.capturado) return null;
  return alvo;
}

export function obterBolas() {
  return contarItem("pokeball");
}

export function gastarBola() {
  if (contarItem("pokeball") <= 0) return false;
  ajustarItem("pokeball", -1, "mudo");
  return true;
}

export function partyCheia() {
  return party.length >= POKEMON.PARTY_MAX;
}

export function receberCaptura(selvagem) {
  if (party.length >= POKEMON.PARTY_MAX) return null;
  const copia = criarAtor({
    id: `party-${party.length}`,
    especie: selvagem.especie,
    nivel: selvagem.nivel,
    shiny: selvagem.shiny,
    hp: Math.max(1, selvagem.hp),
    faccao: "party",
    x: selvagem.x,
    y: selvagem.y,
    z: selvagem.z,
  });
  copia.exp = selvagem.exp;
  hidratarModo(copia);
  party.push(copia);
  const key = selvagem?.especie?.key || copia?.especie?.key;
  if (key) markSpeciesCaught(key);
  return copia;
}

export function ganharBolas(n) {
  const d = n | 0;
  if (!d) return;
  ajustarItem("pokeball", d, "mudo");
}

export function definirBolas(n) {
  const alvo = Math.max(0, n | 0);
  const atual = contarItem("pokeball");
  if (alvo === atual) return;
  if (atual > 0) ajustarItem("pokeball", -atual, "mudo");
  if (alvo > 0) ajustarItem("pokeball", alvo, "mudo");
}

export function guardarItem(chave) {
  ajustarItem(chave, 1);
}

export function contarItem(chave) {
  return bolsa.get(chave) || 0;
}

export function ajustarItem(chave, delta, fonte) {
  const d = delta | 0;
  const n = (bolsa.get(chave) || 0) + d;
  if (n <= 0) bolsa.delete(chave);
  else bolsa.set(chave, n);
  if (d > 0) anunciarGanho(chave, d, fonte);
  return Math.max(0, n);
}

export function curarParty() {
  for (let i = 0; i < party.length; i++) {
    const p = party[i];
    p.hp = p.hpMax;
    encherPp(p);
    p.morto = false;
    p.mortoAte = 0;
  }
}

export function definirDeployado(indice) {
  if (indice < 0 || indice >= party.length) return false;
  const prox = party[indice];
  if (!monVivo(prox)) return false;
  const atual = party[deployado];
  if (atual && atual !== prox) recolher(atual);
  deployado = indice;
  const jaNoMundo = atual === prox && !prox.capturado && prox._colocado;
  if (!jaNoMundo) pedirEnvio(prox);
  else prox.morto = false;
  return true;
}

/** Clique no slot: se já está fora, recolhe. Senão manda para o campo. */
export function alternarCampo(indice) {
  if (indice < 0 || indice >= party.length) return false;
  const alvo = party[indice];
  const atual = party[deployado];
  if (alvo === atual && !alvo.capturado) return recolher(alvo);
  return definirDeployado(indice);
}

export function tirarDaParty(indice) {
  if (indice < 0 || indice >= party.length || party.length <= 1) return null;
  const ator = party[indice];
  const eraCampo = indice === deployado && ator && !ator.capturado;
  if (eraCampo) recolher(ator);
  party.splice(indice, 1);
  if (deployado >= party.length) deployado = party.length - 1;
  else if (indice < deployado) deployado -= 1;
  const vivo = party[deployado];
  if (vivo) {
    vivo.capturado = false;
    vivo._colocado = false;
    if (eraCampo) vivo._pedidoEnvio = true;
  }
  return ator;
}

export function colocarNaParty(ator) {
  if (!ator || party.length >= POKEMON.PARTY_MAX) return false;
  ator.faccao = "party";
  ator.hostil = false;
  ator.capturado = party.length > 0;
  hidratarModo(ator);
  party.push(ator);
  return true;
}

export function trocarOrdemParty(a, b) {
  const i = a | 0;
  const j = b | 0;
  if (i === j || i < 0 || j < 0 || i >= party.length || j >= party.length) return false;
  const tmp = party[i];
  party[i] = party[j];
  party[j] = tmp;
  if (deployado === i) deployado = j;
  else if (deployado === j) deployado = i;
  const vivo = party[deployado];
  if (vivo) {
    vivo.capturado = false;
    vivo._colocado = false;
  }
  return true;
}

export function trocarMembro(indice, ator) {
  if (!ator || indice < 0 || indice >= party.length) return null;
  const antigo = party[indice];
  ator.faccao = "party";
  ator.hostil = false;
  ator.capturado = indice !== deployado;
  party[indice] = ator;
  if (indice === deployado) {
    if (antigo && antigo !== ator && !antigo.capturado) recolher(antigo);
    pedirEnvio(ator);
  }
  return antigo;
}

export function especieNoTime(chave) {
  for (let i = 0; i < party.length; i++) {
    if (party[i].especie?.key === chave) return true;
  }
  return false;
}

export function receberEspecie(chave, nivel, shiny = false) {
  if (party.length >= POKEMON.PARTY_MAX) return null;
  const esp = especie(chave);
  if (!esp) return null;
  const ator = criarAtor({
    id: `party-${esp.key}-${party.length}-${(Math.random() * 1e6) | 0}`,
    especie: esp,
    nivel: Math.max(1, nivel | 0),
    shiny: !!shiny,
    faccao: "party",
    x: 0,
    y: 0,
    z: 1,
    hostil: false,
  });
  if (!colocarNaParty(ator)) return null;
  return ator;
}

export function montarTime(chaves, nivel) {
  const atores = [];
  const lv = Math.max(1, nivel | 0);
  for (let i = 0; i < chaves.length && atores.length < POKEMON.PARTY_MAX; i++) {
    const esp = especie(chaves[i]);
    if (!esp) continue;
    atores.push(
      criarAtor({
        id: `party-${i}-${esp.key}`,
        especie: esp,
        nivel: lv,
        faccao: "party",
        x: 0,
        y: 0,
        z: 1,
        hostil: false,
      }),
    );
  }
  if (!atores.length) return false;
  substituirParty(atores);
  return true;
}

export function substituirParty(atores) {
  party.length = 0;
  for (let i = 0; i < atores.length && i < POKEMON.PARTY_MAX; i++) {
    const a = atores[i];
    if (!a) continue;
    if (a.hp <= 0 || a.morto) {
      a.hp = 0;
      a.morto = true;
      a.capturado = true;
      a.mortoAte = 0;
    } else {
      a.capturado = true;
    }
    a._colocado = false;
    hidratarModo(a);
    party.push(a);
  }
  let primeiroVivo = -1;
  for (let i = 0; i < party.length; i++) {
    if (monVivo(party[i])) {
      primeiroVivo = i;
      break;
    }
  }
  deployado = primeiroVivo >= 0 ? primeiroVivo : 0;
  if (primeiroVivo >= 0) {
    party[primeiroVivo].capturado = false;
    party[primeiroVivo]._colocado = false;
  }
}

export function itensBolsa() {
  return bolsa;
}

const DELAY_RECOLHER_DESMAIO = 0.7;

export function atualizarParty(corpo, dt, agora, perfil) {
  const mon = pokemonNoCampo();
  // Desmaiou: após Hurt (morreuEm), volta pra bola — sem revive no campo.
  if (mon && !mon.capturado && mon.morto) {
    const desde = mon.morreuEm > 0 ? mon.morreuEm : agora;
    if (agora >= desde + DELAY_RECOLHER_DESMAIO) recolher(mon);
  }
  const vivo = pokemonDeployado();
  if (!vivo) return;
  const z = corpo.elevacao ?? corpo.z ?? vivo.z;
  if (!vivo._colocado) {
    vivo.x = corpo.x + OFFSET_MON.x;
    vivo.y = corpo.y + OFFSET_MON.y;
    vivo.z = z;
    vivo.elevacao = z;
    // Não nasce em cima de poste/pedra (Horse no começo).
    resolverForaDeObstaculo(vivo);
    vivo._colocado = true;
    if (vivo._pedidoEnvio) {
      vivo._pedidoEnvio = false;
      soltarFxEnvio(vivo);
    }
  }
  if (vivo.brilhoBola > 0) vivo.brilhoBola = Math.max(0, vivo.brilhoBola - dt);
  // Ordem farm/Força ou canal/carry de lift: não puxar de volta pro follow.
  if (mon.ordemCampo || mon.ordemForca || mon._forcaCanalLock) return;
  // Combate OW (tickPartyCampo) marca _emLutaCampo quando não deve follow.
  if (mon._emLutaCampo) return;
  if (mon.modo === "agro" && mon.alvo && !mon.alvo.morto) return;
  const usar = perfil || PERFIL_CAMPO;
  if (mon.perfil !== usar) {
    mon.perfil = usar;
    resetarNav(mon);
  }
  garantirCorpoLocomocao(mon, usar);
  atualizarAgente(mon, corpo, dt, 0, AGENTE_DIST_SEGUIR);
}
