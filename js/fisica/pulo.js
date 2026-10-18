import {
  GRAVIDADE,
  GRAVIDADE_PULO_SEGURANDO,
  PULO_BUFFER,
  PULO_CORTE_SOLTAR,
  PULO_COYOTE,
  PULO_EPS_POUSO,
  PULO_VELOCIDADE,
} from "../config.js";
import { teclaBaixa } from "../entrada/teclado.js";
import { resolverAguaAereo } from "./agua.js";
import { alturaSobPes, aplicarTetoOverhang } from "./colisao.js";

/** Edge de pulo com buffer (aperta um pouco antes de pousar). */
export function registrarBufferPulo(corpo, apertou) {
  if (apertou) corpo.puloBufferT = PULO_BUFFER;
}

export function podeIniciarPulo(corpo) {
  if (
    corpo.escalando ||
    corpo.planando ||
    corpo.voando ||
    corpo.mantle ||
    corpo.nadando
  ) {
    return false;
  }
  if (corpo.noChao) return true;
  return corpo.coyoteT > 0;
}

/**
 * Impulso vertical — hold Space aumenta o pico (Mario);
 * 2º toque no ar abre asa-delta (separado).
 */
export function iniciarPulo(corpo) {
  if (!podeIniciarPulo(corpo)) return false;

  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.elevacao = corpo.z;
  corpo.vz = PULO_VELOCIDADE;
  corpo.puloCortado = false;
  corpo.coyoteT = 0;
  corpo.puloBufferT = 0;
  corpo.tempoAr = 0;
  corpo.hopLift = 0;
  corpo.acao = "pulando";
  return true;
}

/** Sai do chão sem impulso (beirada / degrau). */
export function iniciarQueda(corpo) {
  if (!corpo.noChao) return;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.vz = Math.min(corpo.vz, 0);
  corpo.puloCortado = true;
  corpo.coyoteT = PULO_COYOTE;
  corpo.tempoAr = 0;
  corpo.acao = "caindo";
}

/**
 * Gravidade Mario + pouso (queda livre — sem asa).
 * `segurarPulo` = IA segura o pulo (equivalente a Space).
 */
export function atualizarAereo(corpo, dt) {
  if (corpo.coyoteT > 0) corpo.coyoteT -= dt;
  corpo.tempoAr = (corpo.tempoAr ?? 0) + dt;

  const querSegurar =
    !!corpo.segurarPulo || teclaBaixa("Space");

  if (
    !corpo.puloCortado &&
    corpo.vz > 0 &&
    !querSegurar
  ) {
    corpo.vz *= PULO_CORTE_SOLTAR;
    corpo.puloCortado = true;
  }

  const segurando =
    !corpo.puloCortado && corpo.vz > 0 && querSegurar;
  const g = segurando ? GRAVIDADE_PULO_SEGURANDO : GRAVIDADE;

  corpo.vz -= g * dt;
  const elevAntes = corpo.elevacao;
  corpo._elevAnterior = elevAntes;
  corpo.elevacao += corpo.vz * dt;
  aplicarTetoOverhang(corpo);
  if (resolverAguaAereo(corpo)) return;

  // No ápice / descida: solta o “hold” da IA
  if (corpo.segurarPulo && corpo.vz <= 0) {
    corpo.segurarPulo = false;
  }

  const zChao = alturaSobPes(
    corpo.x,
    corpo.y,
    corpo.elevacao,
    elevAntes,
  );

  if (
    corpo.vz <= 0 &&
    zChao > 0 &&
    corpo.elevacao <= zChao + PULO_EPS_POUSO
  ) {
    pousarNoChao(corpo, zChao);
    return;
  }

  if (corpo.elevacao < -2) {
    corpo.elevacao = -2;
    corpo.vz = 0;
  }

  corpo.z = zChao > 0 ? zChao : 0;
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.pulando = true;
  corpo.acao = corpo.vz > 0.4 ? "pulando" : "caindo";
}

export function pousarNoChao(corpo, zChao) {
  const zAntes = corpo.elevacao;
  corpo.z = zChao;
  corpo.elevacao = zChao;
  corpo.vz = 0;
  corpo.hopLift = 0;
  corpo.noChao = true;
  corpo.pulando = false;
  corpo.planando = false;
  corpo.voando = false;
  corpo.puloCortado = false;
  corpo.segurarPulo = false;
  corpo.coyoteT = 0;
  corpo.tempoAr = 0;

  const queda = Math.max(0, Math.round(zAntes) - zChao);
  corpo.acao = queda >= 2 ? `pousou ${queda}↓` : "pousou";

  if (corpo.puloBufferT > 0) {
    iniciarPulo(corpo);
  }
}

