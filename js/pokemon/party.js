import { POKEMON } from "../config.js";
import { atualizarAgente, garantirCorpoLocomocao } from "../fisica/agente.js";
import { resetarNav } from "../navegacao/seguirCaminho.js";
import { PERFIL_COMPANHEIRO } from "../navegacao/perfilMovimento.js";
import { criarAtor, reviverAtor } from "./ator.js";
import { especie } from "./dados.js";

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

export function guardarItem(chave) {
  bolsa.set(chave, (bolsa.get(chave) || 0) + 1);
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
