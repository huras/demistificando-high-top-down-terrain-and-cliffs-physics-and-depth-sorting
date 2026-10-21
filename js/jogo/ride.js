/**
 * Ride 3D: monta o Pokémon da party (ground / fly / surf por tipos).
 */

import { listaParty, pokemonDeployado, alternarCampo } from "../pokemon/party.js";
import { obterTreinador } from "../pokemon/sistema.js";
import { avisar, estado } from "./estado.js";

let montado = -1;
let modo = null;
let cinemaT = 0;

function tiposDe(ator) {
  const t = ator?.especie?.tipos || ator?.especie?.types || [];
  return Array.isArray(t) ? t.map((x) => String(x).toLowerCase()) : [];
}

export function resolverModoRide(ator) {
  const tipos = tiposDe(ator);
  if (tipos.includes("flying") || tipos.includes("dragon")) return "fly";
  if (tipos.includes("water")) return "surf";
  return "ride";
}

export function podeMontar(indice) {
  const party = listaParty();
  const ator = party[indice];
  if (!ator || ator.morto || ator.hp <= 0) return false;
  return true;
}

export function indiceMontado() {
  return montado;
}

export function modoRideAtual() {
  return modo;
}

export function estaMontado() {
  return montado >= 0;
}

export function cinemaRideAtivo() {
  return cinemaT > 0;
}

export function alternarRide(indice) {
  const party = listaParty();
  if (!party[indice]) return false;
  if (montado === indice) {
    desmontar();
    return true;
  }
  if (!podeMontar(indice)) {
    estado.itemGet = "Esse Pokémon não pode carregar você agora.";
    avisar();
    return false;
  }
  return montar(indice);
}

function montar(indice) {
  const party = listaParty();
  const ator = party[indice];
  if (!ator) return false;

  const campo = pokemonDeployado();
  if (!campo || campo !== ator) {
    if (ator.capturado) alternarCampo(indice);
  }

  montado = indice;
  modo = resolverModoRide(ator);
  cinemaT = 0.45;
  ator.rideAtivo = true;
  ator.capturado = false;

  const tre = obterTreinador();
  if (tre) {
    tre.rideAtivo = true;
    tre.rideModo = modo;
    tre.rideMon = ator;
  }

  estado.itemGet = modo === "fly" ? "Decolou!" : modo === "surf" ? "Surfou!" : "Montou!";
  avisar();
  return true;
}

export function desmontar() {
  if (montado < 0) return false;
  const party = listaParty();
  const ator = party[montado];
  if (ator) ator.rideAtivo = false;
  montado = -1;
  modo = null;
  cinemaT = 0.35;

  const tre = obterTreinador();
  if (tre) {
    tre.rideAtivo = false;
    tre.rideModo = null;
    tre.rideMon = null;
  }
  avisar();
  return true;
}

/** Chamado no tick do jogo: cola o treinador no mon montado. */
export function tickRide(dt) {
  if (cinemaT > 0) cinemaT = Math.max(0, cinemaT - dt);
  if (montado < 0) return;

  const party = listaParty();
  const ator = party[montado];
  const tre = obterTreinador();
  if (!ator || !tre || ator.morto || ator.hp <= 0) {
    desmontar();
    return;
  }

  const offY = modo === "fly" ? 0.15 : modo === "surf" ? 0.05 : -0.05;
  const offZ = modo === "fly" ? 1.2 : 0.35;
  tre.x = ator.x;
  tre.y = ator.y + offY;
  if (Number.isFinite(ator.z)) tre.z = (ator.z || 0) + offZ;
  if (Number.isFinite(ator.facing)) tre.facing = ator.facing;
  if (ator.vx != null) {
    tre.vx = ator.vx;
    tre.vy = ator.vy;
  }
}
