/**
 * Simbiose: o treinador funde num Pokémon e o corpo continua sendo a física.
 * Porta enxuta do Pokémon AI (symbioticFollower), no mesmo corte do ride.
 */
import { RAIO_CORPO, RAIO_POKEMON } from "../config.js";
import { obterPonteiroCanvas } from "../entrada/hoverBloco.js";
import { resetarNav } from "../navegacao/seguirCaminho.js";
import { atorSobPonteiro } from "../pokemon/clique.js";
import {
  dispararBasicoSimbiose,
  dispararSlotSimbiose,
} from "../pokemon/combate/executor.js";
import { projetar3d, projetarChao3d } from "../pokemon/hud.js";
import { listaParty, pokemonDeployado, alternarCampo } from "../pokemon/party.js";
import { efeitosPokemon, relogioPokemon } from "../pokemon/sistema.js";
import { selvagensAtivos } from "../pokemon/populacao.js";
import { avisar, estado } from "./estado.js";
import { t } from "./i18n.js";
import { cinemaRideAtivo, estaMontado, forcarDesmontar } from "./ride.js";
import {
  atorCinemaSimbiose,
  cinemaSimbioseAtivo,
  iniciarCinemaEntrada,
  iniciarCinemaSaida,
  limparCinemaSimbiose,
  tickCinemaSimbiose,
} from "./simbioseCinema.js";

const ALCANCE_CONE = 11;
const COS_CONE = 0.35;

let fundido = -1;

export function indiceSimbiose() {
  return fundido;
}

export function treinadorOcultoSimbiose(corpo) {
  return !!(cinemaSimbioseAtivo() || corpo?.simbioseAtivo);
}

export function estaEmSimbiose() {
  return fundido >= 0;
}

export function monSimbiose() {
  if (fundido < 0) return null;
  return listaParty()[fundido] || null;
}

export { cinemaSimbioseAtivo };

export function simbioseTravadaNoSantuario() {
  if (estado.interior?.papel !== "santuario") return false;
  const mon = monSimbiose() || atorCinemaSimbiose();
  return !!mon?._shrineAvatar;
}

function avisoTrava() {
  estado.itemGet = t("simbiose.unfuseLocked");
  avisar();
}

function limparFlags(ator) {
  if (!ator) return;
  ator.simbioseAtivo = false;
  delete ator._simbioseFreeze;
}

function sincronizarCorpo(corpo, ativo) {
  if (!corpo) return;
  corpo.simbioseAtivo = !!ativo;
}

function aplicarFundido(indice, ator, corpo) {
  fundido = indice;
  ator.simbioseAtivo = true;
  ator._simbioseFreeze = true;
  ator.capturado = false;
  sincronizarCorpo(corpo, true);
}

function limparFundido(corpo) {
  const party = listaParty();
  const ator = fundido >= 0 ? party[fundido] : null;
  limparFlags(ator);
  fundido = -1;
  sincronizarCorpo(corpo, false);
}

function pontoSaida(ator) {
  const ang = Math.random() * Math.PI * 2;
  const dist = RAIO_CORPO + (ator?.raioCorpo || RAIO_POKEMON) + 0.15;
  return {
    x: (ator?.x ?? 0) + Math.cos(ang) * dist,
    y: (ator?.y ?? 0) + Math.sin(ang) * dist,
  };
}

function snapMonNoCorpo(corpo, ator, dt = 0) {
  if (!corpo || !ator) return;
  const alvo = ator.alvo;
  const sp = Math.hypot(corpo.vx || 0, corpo.vy || 0);
  const movendo = sp > 0.35 || !!corpo.andando;
  // dirX/dirY do corpo é só o sinal. Com a câmera girada, esquerda vira (−1, +1)
  // e o sheet de 8 direções cai na diagonal. A velocidade é o eixo da tela.
  if (
    !movendo &&
    alvo &&
    alvo.faccao === "selvagem" &&
    !alvo.morto &&
    !alvo.capturado &&
    alvo.hp > 0
  ) {
    const dx = alvo.x - corpo.x;
    const dy = alvo.y - corpo.y;
    const len = Math.hypot(dx, dy) || 1;
    ator.dirX = dx / len;
    ator.dirY = dy / len;
  } else if (sp > 0.35) {
    ator.dirX = corpo.vx / sp;
    ator.dirY = corpo.vy / sp;
  } else if (!ator.dirX && !ator.dirY) {
    ator.dirX = 0;
    ator.dirY = 1;
  }
  ator.x = corpo.x;
  ator.y = corpo.y;
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  ator.elevacao = elev;
  ator.z = corpo.z ?? Math.floor(elev);
  ator.hopLift = Math.max(0, elev - (ator.z || 0));
  ator.voando = !!corpo.voando;
  ator.pulando = !!corpo.pulando;
  ator.noChao = corpo.noChao !== false;
  ator.nadando = !!corpo.nadando;
  ator.vx = movendo ? corpo.vx || 0 : 0;
  ator.vy = movendo ? corpo.vy || 0 : 0;
  ator.vz = 0;
  ator.andando = movendo;
  ator.correndo = movendo && !!corpo.correndo;
  if (movendo && dt > 0) ator.animT = (ator.animT || 0) + dt;
  ator._emLutaCampo = false;
  ator._simbioseFreeze = true;
  if (ator.path) ator.path = null;
  if (ator.nav) resetarNav(ator);
}

function garantirNoCampo(indice, ator) {
  const campo = pokemonDeployado();
  if (campo === ator) return true;
  if (!ator || ator.morto || ator.hp <= 0) return false;
  if (ator.capturado) alternarCampo(indice);
  return pokemonDeployado() === ator;
}

function comecarEntrada(indice, corpo) {
  const party = listaParty();
  const ator = party[indice];
  if (!ator || !corpo || ator.morto || ator.hp <= 0) return false;
  if (!garantirNoCampo(indice, ator)) return false;
  if (ator._shrineAvatar) {
    ator.x = corpo.x;
    ator.y = corpo.y;
    ator.z = corpo.z ?? ator.z;
    ator.elevacao = corpo.elevacao ?? corpo.z ?? ator.elevacao;
    ator._colocado = true;
  }
  if (estaMontado()) forcarDesmontar(corpo);
  if (fundido >= 0 && fundido !== indice) limparFundido(corpo);
  ator._simbioseFreeze = true;
  ator.vx = 0;
  ator.vy = 0;
  return iniciarCinemaEntrada(corpo, ator, (dir) => {
    if (dir !== "in") return;
    const vivo = listaParty()[indice];
    if (!vivo || vivo.morto || vivo.hp <= 0) return;
    aplicarFundido(indice, vivo, corpo);
    snapMonNoCorpo(corpo, vivo, 0);
  });
}

function comecarSaida(corpo, onConcluir) {
  const party = listaParty();
  const ator = fundido >= 0 ? party[fundido] : null;
  if (!ator || !corpo) {
    limparFundido(corpo);
    if (onConcluir) onConcluir("out");
    return false;
  }
  const retorno = pontoSaida(ator);
  limparFlags(ator);
  fundido = -1;
  sincronizarCorpo(corpo, false);
  const ok = iniciarCinemaSaida(corpo, ator, retorno, () => {
    if (onConcluir) onConcluir("out");
  });
  if (!ok && onConcluir) onConcluir("out");
  return ok;
}

/** Sai na hora (morte, troca de campo, emergência). */
export function forcarSairSimbiose(corpo) {
  const tinha = fundido >= 0 || cinemaSimbioseAtivo() || !!corpo?.simbioseAtivo;
  if (cinemaSimbioseAtivo()) limparCinemaSimbiose();
  if (!tinha && fundido < 0) return false;
  const ator = fundido >= 0 ? listaParty()[fundido] : null;
  if (ator && corpo) {
    const p = pontoSaida(ator);
    corpo.x = p.x;
    corpo.y = p.y;
    corpo.vx = 0;
    corpo.vy = 0;
  }
  limparFundido(corpo);
  return true;
}

/** Ride não entra no cinema nem por cima da trava do santuário. */
export function rideBloqueadoPelaSimbiose(corpo) {
  if (cinemaSimbioseAtivo()) return true;
  if (simbioseTravadaNoSantuario()) {
    avisoTrava();
    return true;
  }
  if (estaEmSimbiose()) forcarSairSimbiose(corpo);
  return false;
}

export function alternarSimbiose(indice, corpo) {
  const party = listaParty();
  if (!party[indice] || !corpo) return false;
  if (cinemaSimbioseAtivo() || cinemaRideAtivo()) return estaEmSimbiose();

  if (simbioseTravadaNoSantuario()) {
    avisoTrava();
    return estaEmSimbiose();
  }

  if (fundido === indice) {
    comecarSaida(corpo);
    return false;
  }

  const ator = party[indice];
  if (ator.morto || ator.hp <= 0) {
    estado.itemGet = t("simbiose.fainted");
    avisar();
    return false;
  }

  return comecarEntrada(indice, corpo);
}

/** Santuário: cinema de entrada no avatar, sem poder recusar. */
export function iniciarSimbioseNoAvatar(corpo) {
  const party = listaParty();
  const i = party.findIndex((a) => a && a._shrineAvatar && !a.morto && a.hp > 0);
  if (i < 0 || !corpo) return false;
  if (cinemaSimbioseAtivo()) return true;
  if (fundido === i) return true;
  return comecarEntrada(i, corpo);
}

/** Load dentro do santuário: funde sem repetir o cinema. */
export function fundirAvatarSantuario(corpo) {
  const party = listaParty();
  const i = party.findIndex((a) => a && a._shrineAvatar && !a.morto && a.hp > 0);
  if (i < 0 || !corpo) return false;
  if (cinemaSimbioseAtivo()) limparCinemaSimbiose();
  if (estaMontado()) forcarDesmontar(corpo);
  if (fundido >= 0 && fundido !== i) limparFundido(corpo);
  const ator = party[i];
  aplicarFundido(i, ator, corpo);
  snapMonNoCorpo(corpo, ator, 0);
  return true;
}

/**
 * Saída do santuário: cinema primeiro, feixe no fim.
 * @param {object} corpo
 * @param {() => void} onConcluir
 */
export function sairSimbioseSantuario(corpo, onConcluir) {
  if (!estaEmSimbiose()) {
    if (onConcluir) onConcluir();
    return false;
  }
  return comecarSaida(corpo, () => {
    if (onConcluir) onConcluir();
  });
}

/** Troca / recolher de party. Trava no santuário. */
export function soltarSimbioseParaTroca(corpo) {
  if (simbioseTravadaNoSantuario()) {
    avisoTrava();
    return true;
  }
  if (estaEmSimbiose() || cinemaSimbioseAtivo()) forcarSairSimbiose(corpo);
  return false;
}

function hostilVivo(ator) {
  return !!(
    ator &&
    ator.faccao === "selvagem" &&
    !ator.morto &&
    !ator.capturado &&
    ator.hp > 0
  );
}

function garantirAlvoCone(ator) {
  if (hostilVivo(ator.alvo)) return ator.alvo;
  const fx = ator.dirX || 0;
  const fy = ator.dirY || 1;
  const fl = Math.hypot(fx, fy) || 1;
  const nx = fx / fl;
  const ny = fy / fl;
  const lista = selvagensAtivos();
  let melhor = null;
  let melhorD = ALCANCE_CONE * ALCANCE_CONE;
  for (let i = 0; i < lista.length; i++) {
    const w = lista[i];
    if (!hostilVivo(w) || w === ator) continue;
    const dx = w.x - ator.x;
    const dy = w.y - ator.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > melhorD || d2 < 1e-4) continue;
    const d = Math.sqrt(d2);
    if ((dx / d) * nx + (dy / d) * ny < COS_CONE) continue;
    melhor = w;
    melhorD = d2;
  }
  if (melhor) ator.alvo = melhor;
  return ator.alvo;
}

export function dispararTeclaSimbiose(indice) {
  const ator = monSimbiose();
  if (!ator || cinemaSimbioseAtivo()) return false;
  garantirAlvoCone(ator);
  return dispararSlotSimbiose(ator, indice, relogioPokemon(), efeitosPokemon());
}

export function cliqueSimbiose(cenario) {
  const ator = monSimbiose();
  if (!ator || !cenario || cinemaSimbioseAtivo()) return false;
  const canvas = cenario.canvas;
  const cam = cenario.camera3d?.cam;
  const ptr = canvas ? obterPonteiroCanvas(canvas) : null;
  if (ptr && cam) {
    const projetar = projetar3d(cam, canvas.width, canvas.height);
    const pes = projetarChao3d(cam, canvas.width, canvas.height);
    const sob = atorSobPonteiro(ptr.x, ptr.y, projetar, pes);
    if (hostilVivo(sob) && sob !== ator) ator.alvo = sob;
  }
  if (!hostilVivo(ator.alvo)) return false;
  return dispararBasicoSimbiose(ator, relogioPokemon(), efeitosPokemon());
}

/**
 * @param {number} dt
 * @param {object} corpo
 */
export function tickSimbiose(dt, corpo) {
  if (cinemaSimbioseAtivo()) {
    tickCinemaSimbiose(dt, corpo);
    return;
  }
  if (fundido < 0) return;
  const party = listaParty();
  const ator = party[fundido];
  if (!ator || ator.morto || ator.hp <= 0 || ator.capturado) {
    forcarSairSimbiose(corpo);
    return;
  }
  sincronizarCorpo(corpo, true);
  snapMonNoCorpo(corpo, ator, dt);
}
