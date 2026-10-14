import { POKEMON } from "../config.js";
import { atualizarAgente, garantirCorpoLocomocao } from "../fisica/agente.js";
import { resetarNav } from "../navegacao/seguirCaminho.js";
import { PERFIL_COMPANHEIRO } from "../navegacao/perfilMovimento.js";
import { criarAtor, reviverAtor } from "./ator.js";
import { especie } from "./dados.js";
import { definirEmocao, EMOCAO } from "./emocoes.js";

const party = [];
let deployado = 0;
let bolas = POKEMON.BOLAS;
const bolsa = new Map();

export function iniciarParty() {
  party.length = 0;
  const esp = especie("bulbasaur") || especie("pidgey");
  if (!esp) return;
  party.push(
    criarAtor({
      id: "party-0",
      especie: esp,
      nivel: 5,
      faccao: "party",
      x: 0,
      y: 0,
      z: 1,
      hostil: false,
    }),
  );
  deployado = 0;
}

export function listaParty() {
  return party;
}

export function pokemonNoCampo() {
  return party[deployado] || null;
}

export function pokemonDeployado() {
  const p = party[deployado];
  return p && !p.morto ? p : null;
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

export function obterBolas() {
  return bolas;
}

export function gastarBola() {
  if (bolas <= 0) return false;
  bolas -= 1;
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
  party.push(copia);
  return copia;
}

export function ganharBolas(n) {
  bolas = Math.max(0, bolas + (n | 0));
}

export function definirBolas(n) {
  bolas = Math.max(0, n | 0);
}

export function guardarItem(chave) {
  bolsa.set(chave, (bolsa.get(chave) || 0) + 1);
}

export function contarItem(chave) {
  return bolsa.get(chave) || 0;
}

export function ajustarItem(chave, delta) {
  const n = (bolsa.get(chave) || 0) + (delta | 0);
  if (n <= 0) bolsa.delete(chave);
  else bolsa.set(chave, n);
  return Math.max(0, n);
}

export function curarParty() {
  for (let i = 0; i < party.length; i++) {
    const p = party[i];
    p.hp = p.hpMax;
    p.pp = p.ppMax;
    p.morto = false;
    p.mortoAte = 0;
  }
}

export function definirDeployado(indice) {
  if (indice < 0 || indice >= party.length) return false;
  const atual = party[deployado];
  if (atual && atual !== party[indice]) atual.capturado = true;
  deployado = indice;
  const prox = party[deployado];
  prox.capturado = false;
  prox.morto = false;
  prox._colocado = false;
  return true;
}

export function tirarDaParty(indice) {
  if (indice < 0 || indice >= party.length || party.length <= 1) return null;
  const [ator] = party.splice(indice, 1);
  if (deployado >= party.length) deployado = party.length - 1;
  else if (indice < deployado) deployado -= 1;
  const vivo = party[deployado];
  if (vivo) {
    vivo.capturado = false;
    vivo._colocado = false;
  }
  return ator;
}

export function colocarNaParty(ator) {
  if (!ator || party.length >= POKEMON.PARTY_MAX) return false;
  ator.faccao = "party";
  ator.hostil = false;
  ator.capturado = party.length > 0;
  party.push(ator);
  return true;
}

export function substituirParty(atores) {
  party.length = 0;
  for (let i = 0; i < atores.length && i < POKEMON.PARTY_MAX; i++) party.push(atores[i]);
  deployado = 0;
  if (party[0]) {
    party[0].capturado = false;
    party[0]._colocado = false;
  }
}

export function itensBolsa() {
  return bolsa;
}

export function atualizarParty(corpo, dt, agora, perfil) {
  const mon = pokemonNoCampo();
  if (mon?.morto && mon.mortoAte > 0 && agora >= mon.mortoAte) {
    const z = corpo.elevacao ?? corpo.z ?? mon.z;
    reviverAtor(mon, corpo.x - 0.8, corpo.y + 0.6, z);
  }
  const vivo = pokemonDeployado();
  if (!vivo || vivo.capturado) return;
  const z = corpo.elevacao ?? corpo.z ?? mon.z;
  if (!mon._colocado) {
    mon.x = corpo.x - 1.1;
    mon.y = corpo.y + 0.8;
    mon.z = z;
    mon.elevacao = z;
    mon._colocado = true;
  }
  if (mon.modo === "agro" && mon.alvo && !mon.alvo.morto) return;
  const usar = perfil || PERFIL_COMPANHEIRO;
  if (mon.perfil !== usar) {
    mon.perfil = usar;
    resetarNav(mon);
  }
  garantirCorpoLocomocao(mon, usar);
  atualizarAgente(mon, corpo, dt);
}
