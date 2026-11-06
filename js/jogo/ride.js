/**
 * Ride 3D: cinema de montaria + corpo controlado com mon no assento.
 * Surf / fly via flags no corpo (física em agua.js / voo.js / movimento.js).
 */

import { listaParty, pokemonDeployado, alternarCampo } from "../pokemon/party.js";
import { obterTreinador } from "../pokemon/sistema.js";
import { entrarVoo, estaVoando, sairVoo } from "../fisica/voo.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { resetarNav } from "../navegacao/seguirCaminho.js";
import { avisar, estado } from "./estado.js";
import {
  garantirRideAssentos,
  obterAssentoRide,
  offsetAssentoMundo,
} from "./rideAssentos.js";
import {
  atorCinemaRide,
  cinemaRideAtivo,
  iniciarDesmontariaCinema,
  iniciarMontariaCinema,
  limparCinemaRide,
  tickRideCinema,
} from "./rideCinema.js";
import { rideBloqueadoPelaSimbiose } from "./simbiose.js";

garantirRideAssentos();

/** Altitude de cruzeiro acima do chão no fly-ride. */
const FLY_CRUZEIRO = 3.2;

let montado = -1;
let modo = null;

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

/** Slot do botão Ride: montado ou cinema em andamento. */
export function indiceRideHud() {
  if (montado >= 0) return montado;
  const ator = atorCinemaRide();
  if (!ator) return -1;
  const party = listaParty();
  return party.indexOf(ator);
}

export function modoRideAtual() {
  return modo;
}

export function estaMontado() {
  return montado >= 0;
}

export { cinemaRideAtivo };

function sincronizarFlagsCorpo(corpo, ativo) {
  if (!corpo) return;
  if (ativo) {
    corpo.rideAtivo = true;
    corpo.rideModo = modo;
  } else {
    corpo.rideAtivo = false;
    corpo.rideModo = null;
    delete corpo._rideSeatElev;
  }
}

function sincronizarTreinador(ator, ativo) {
  const tre = obterTreinador();
  if (!tre) return;
  if (ativo) {
    tre.rideAtivo = true;
    tre.rideModo = modo;
    tre.rideMon = ator || null;
  } else {
    tre.rideAtivo = false;
    tre.rideModo = null;
    tre.rideMon = null;
  }
}

function limparFlagsAtor(ator) {
  if (!ator) return;
  ator.rideAtivo = false;
  delete ator._rideFreeze;
}

function aplicarMontado(indice, ator, corpo) {
  montado = indice;
  modo = resolverModoRide(ator);
  ator.rideAtivo = true;
  ator.capturado = false;
  delete ator._rideFreeze;
  sincronizarFlagsCorpo(corpo, true);
  sincronizarTreinador(ator, true);

  if (modo === "fly" && corpo) {
    corpo.nadando = false;
    if (!estaVoando(corpo)) entrarVoo(corpo);
    const chao = alturaSobPes(corpo.x, corpo.y, corpo.elevacao ?? corpo.z);
    const base = chao > 0 ? chao : corpo.z || 0;
    const alvo = base + FLY_CRUZEIRO;
    if ((corpo.elevacao ?? 0) < alvo - 0.2) {
      corpo.elevacao = Math.max(corpo.elevacao ?? base, base + FLY_CRUZEIRO * 0.45);
      corpo.hopLift = corpo.elevacao - (corpo.z || 0);
    }
  }

  estado.itemGet =
    modo === "fly" ? "Decolou!" : modo === "surf" ? "Surfou!" : "Montou!";
  avisar();
}

function limparMontado(corpo, { pousar = true } = {}) {
  const party = listaParty();
  const ator = montado >= 0 ? party[montado] : null;
  limparFlagsAtor(ator);
  montado = -1;
  modo = null;
  sincronizarFlagsCorpo(corpo, false);
  sincronizarTreinador(null, false);
  if (corpo) delete corpo._rideFlyManual;
  if (corpo && estaVoando(corpo) && pousar) {
    sairVoo(corpo, { pousar: true });
  } else if (corpo && estaVoando(corpo)) {
    sairVoo(corpo, { pousar: false });
  }
}

/** Desmonta sem cinema (morte / HP 0 / emergência). */
export function forcarDesmontar(corpo) {
  if (cinemaRideAtivo()) limparCinemaRide();
  if (montado < 0 && !corpo?.rideAtivo) return false;
  limparMontado(corpo, { pousar: true });
  return true;
}

export function desmontar(corpo) {
  if (montado < 0) return false;
  if (cinemaRideAtivo()) return false;
  const party = listaParty();
  const ator = party[montado];
  if (!ator || !corpo) {
    limparMontado(corpo);
    return true;
  }
  const modoAtual = modo;
  // Sai do estado montado no início do jumpOff; cinema ainda anima.
  limparFlagsAtor(ator);
  montado = -1;
  modo = null;
  sincronizarFlagsCorpo(corpo, false);
  sincronizarTreinador(null, false);
  delete corpo._rideFlyManual;
  if (estaVoando(corpo)) sairVoo(corpo, { pousar: false });

  return iniciarDesmontariaCinema(corpo, ator, {
    modo: modoAtual || "ride",
    onConcluir: () => {
      if (corpo) {
        corpo.rideAtivo = false;
        corpo.rideModo = null;
        delete corpo._rideFlyManual;
      }
    },
  });
}

export function alternarRide(indice, corpo) {
  const party = listaParty();
  if (!party[indice] || !corpo) return false;
  if (cinemaRideAtivo()) return false;
  if (rideBloqueadoPelaSimbiose(corpo)) return false;

  if (estado.interior?.sala3d) {
    estado.itemGet = "Só no overworld.";
    avisar();
    return false;
  }

  if (montado === indice) {
    return desmontar(corpo);
  }

  if (!podeMontar(indice)) {
    estado.itemGet = "Esse Pokémon não pode carregar você agora.";
    avisar();
    return false;
  }

  if (montado >= 0) {
    // Troca: desmonta o atual primeiro (forçado) e monta o novo.
    limparMontado(corpo, { pousar: true });
  }

  const ator = party[indice];
  const campo = pokemonDeployado();
  if (!campo || campo !== ator) {
    if (ator.capturado) alternarCampo(indice);
  }

  const modoAlvo = resolverModoRide(ator);
  congelarPreMount(ator);
  return iniciarMontariaCinema(corpo, ator, {
    modo: modoAlvo,
    onConcluir: (dir) => {
      if (dir !== "on") return;
      if (!podeMontar(indice) || !party[indice]) return;
      aplicarMontado(indice, party[indice], corpo);
    },
  });
}

function congelarPreMount(ator) {
  if (!ator) return;
  ator.vx = 0;
  ator.vy = 0;
  ator._rideFreeze = true;
}

/**
 * Corpo = pés no assento. Mon fica deslocado pra trás/baixo do pivot
 * (player nas costas), com elevação visual no personagem3d.
 */
function snapMonNoAssento(corpo, ator, dt = 0) {
  if (!corpo || !ator) return;
  const m = modo || "ride";
  if (Number.isFinite(corpo.dirX) || Number.isFinite(corpo.dirY)) {
    ator.dirX = corpo.dirX || 0;
    ator.dirY = corpo.dirY || 0;
  }
  ator.facing = corpo.facing ?? ator.facing;

  const seat = obterAssentoRide(ator, m);
  const off = offsetAssentoMundo(corpo.dirX, corpo.dirY, seat);
  // player = mon + off  ⇒  mon = player − off
  ator.x = corpo.x - off.x;
  ator.y = corpo.y - off.y;

  const elevCorpo = corpo.elevacao ?? corpo.z ?? 0;
  const zChao =
    Number.isFinite(corpo.z) && !corpo.voando
      ? corpo.z
      : Math.floor(elevCorpo);
  // Mon na base (chão ou altitude de voo); pés do player sobem com _rideSeatElev.
  if (corpo.voando || m === "fly") {
    ator.elevacao = elevCorpo;
    ator.z = Math.floor(elevCorpo);
    ator.hopLift = Math.max(0, elevCorpo - (ator.z || 0));
    ator.voando = true;
    ator.pulando = true;
    ator.noChao = false;
  } else {
    ator.elevacao = zChao;
    ator.z = zChao;
    ator.hopLift = 0;
    ator.voando = false;
    ator.pulando = false;
    ator.noChao = true;
  }
  ator.nadando = !!corpo.nadando && m === "surf";
  // Velocidade só pra anim Walk do mon (marcarPasso); posição é travada no snap.
  const sp = Math.hypot(corpo.vx || 0, corpo.vy || 0);
  const movendo = sp > 0.35 || !!corpo.andando;
  ator.vx = movendo ? corpo.vx || 0 : 0;
  ator.vy = movendo ? corpo.vy || 0 : 0;
  ator.vz = 0;
  ator.andando = movendo;
  ator.correndo = movendo && !!corpo.correndo;
  if (movendo && dt > 0) ator.animT = (ator.animT || 0) + dt;
  // Hitbox no chão/altitude do mon; sprite do player sobe até o pivot.
  if (!corpo.voando && m !== "fly") {
    corpo.elevacao = zChao;
    corpo.z = zChao;
    corpo.hopLift = 0;
  }
  corpo._rideSeatElev = off.elev;
  ator.alvo = null;
  ator._emLutaCampo = false;
  if (ator.path) ator.path = null;
  if (ator.nav) resetarNav(ator);
}

function sustentarFlyCruzeiro(corpo, dt) {
  if (!corpo || modo !== "fly" || !corpo.rideAtivo) return;
  if (!estaVoando(corpo)) {
    corpo.nadando = false;
    entrarVoo(corpo);
  }
  const chao = alturaSobPes(corpo.x, corpo.y, corpo.elevacao ?? corpo.z);
  const base = chao > 0 ? chao : 0;
  const alvo = base + FLY_CRUZEIRO;
  const elev = corpo.elevacao ?? base;
  // Sobe sozinho até o cruzeiro se estiver abaixo; Space/Ctrl ainda controlam no voo.
  if (elev < alvo - 0.15 && !corpo._rideFlyManual) {
    const passo = Math.min(alvo - elev, 4.2 * dt);
    corpo.elevacao = elev + passo;
    corpo.hopLift = corpo.elevacao - (corpo.z || 0);
    if (corpo.vz < 0.5) corpo.vz = Math.max(corpo.vz, 1.2);
  }
}

/**
 * @param {number} dt
 * @param {object} [corpo]
 */
export function tickRide(dt, corpo) {
  if (cinemaRideAtivo()) {
    tickRideCinema(dt, corpo);
    return;
  }

  if (montado < 0) return;

  const party = listaParty();
  const ator = party[montado];
  if (!ator || ator.morto || ator.hp <= 0) {
    forcarDesmontar(corpo);
    return;
  }

  if (corpo) {
    sincronizarFlagsCorpo(corpo, true);
    sustentarFlyCruzeiro(corpo, dt);
  }
  snapMonNoAssento(corpo, ator, dt);
}
