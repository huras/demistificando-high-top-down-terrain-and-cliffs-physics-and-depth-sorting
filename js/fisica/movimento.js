import { RAIO_CORPO } from "../config.js";
import { teclaAgora, vetorMovimento } from "../entrada/teclado.js";
import { alturaEm } from "../mundo/altura.js";
import {
  alturaSobPes,
  moverAereo,
  moverComColisao,
} from "./colisao.js";
import { atualizarCorrida } from "./corrida.js";
import { atualizarEscalada, tentarEscalar } from "./escalada.js";
import {
  atualizarAereo,
  empurrarForaDeCliff,
  iniciarPulo,
  iniciarQueda,
  podeIniciarPulo,
  registrarBufferPulo,
} from "./pulo.js";

export function criarCorpo(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    elevacao: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    dirX: 0,
    dirY: 1,
    facing: 0,
    noChao: true,
    pulando: false,
    escalando: false,
    pulo: null,
    escalada: null,
    hopLift: 0,
    puloCortado: false,
    coyoteT: 0,
    puloBufferT: 0,
    acao: "parado",
    animT: 0,
    andando: false,
  };
}

export function atualizarMovimento(corpo, dt) {
  if (corpo.escalando || corpo.escalada) {
    corpo.hopLift = atualizarEscalada(corpo, dt);
    if (!corpo.escalando) {
      // terminou neste frame
      corpo.elevacao = corpo.z;
      corpo.noChao = true;
      corpo.vz = 0;
      corpo.hopLift = 0;
    }
    corpo.andando = false;
    corpo.vx = 0;
    corpo.vy = 0;
    return;
  }

  if (corpo.puloBufferT > 0) corpo.puloBufferT = Math.max(0, corpo.puloBufferT - dt);

  const apertouPulo = teclaAgora("Space");
  registrarBufferPulo(corpo, apertouPulo);

  if (
    (apertouPulo || corpo.puloBufferT > 0) &&
    podeIniciarPulo(corpo)
  ) {
    iniciarPulo(corpo);
  }

  if (teclaAgora("KeyE") && corpo.noChao) {
    const res = tentarEscalar(corpo);
    if (res?.ok) {
      corpo.escalada = res.escalada;
      corpo.escalando = true;
      corpo.vx = 0;
      corpo.vy = 0;
      corpo.vz = 0;
      corpo.hopLift = atualizarEscalada(corpo, 0);
      return;
    }
    corpo.acao = res?.motivo ? `escala bloqueada (${res.motivo})` : "escala bloqueada";
  }

  const { dx, dy } = vetorMovimento();
  if (dx !== 0 || dy !== 0) {
    if (dx !== 0) corpo.dirX = Math.sign(dx);
    if (dy !== 0) corpo.dirY = Math.sign(dy);
    if (dx !== 0 && dy === 0) corpo.dirY = 0;
    if (dy !== 0 && dx === 0) corpo.dirX = 0;
    corpo.facing = facingDeDir(corpo.dirX || dx, corpo.dirY || dy);
  }

  if (corpo.noChao) atualizarNoChao(corpo, dx, dy, dt);
  else atualizarNoAr(corpo, dx, dy, dt);
}

function atualizarNoChao(corpo, dx, dy, dt) {
  const movendo = atualizarCorrida(corpo, dx, dy, dt, true);
  const passoX = corpo.vx * dt;
  const passoY = corpo.vy * dt;
  const novo = moverComColisao(corpo, passoX, passoY, "andar");

  if (novo.bloqueouX) corpo.vx = 0;
  if (novo.bloqueouY) corpo.vy = 0;

  corpo.x = novo.x;
  corpo.y = novo.y;

  const zChao = alturaSobPes(corpo.x, corpo.y);

  if (zChao <= 0 || zChao < corpo.z) {
    iniciarQueda(corpo);
    corpo.elevacao = corpo.z;
    atualizarAereo(corpo, dt);
    corpo.andando = false;
    return;
  }

  corpo.z = zChao;
  corpo.elevacao = zChao;
  corpo.hopLift = 0;
  corpo.vz = 0;

  if (cantoEmCliffAlto(corpo)) empurrarForaDeCliff(corpo);

  corpo.andando = movendo && (dx !== 0 || dy !== 0);
  if (corpo.andando) {
    corpo.animT += dt;
    corpo.acao = "correndo";
  } else if (!corpo.acao.startsWith("escala") && !corpo.acao.startsWith("pousou")) {
    corpo.acao = "parado";
  }
}

function atualizarNoAr(corpo, dx, dy, dt) {
  atualizarCorrida(corpo, dx, dy, dt, false);

  const passoX = corpo.vx * dt;
  const passoY = corpo.vy * dt;
  const pos = moverAereo(corpo, passoX, passoY, corpo.elevacao);

  if (pos.bloqueouX) corpo.vx = 0;
  if (pos.bloqueouY) corpo.vy = 0;

  corpo.x = pos.x;
  corpo.y = pos.y;

  atualizarAereo(corpo, dt);
  corpo.andando = false;
  if (Math.hypot(corpo.vx, corpo.vy) > 0.4) corpo.animT += dt * 0.6;
}

function facingDeDir(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2;
  return dy < 0 ? 3 : 0;
}

function cantoEmCliffAlto(corpo) {
  const r = RAIO_CORPO;
  for (const [px, py] of [
    [corpo.x - r, corpo.y - r],
    [corpo.x + r, corpo.y - r],
    [corpo.x - r, corpo.y + r],
    [corpo.x + r, corpo.y + r],
  ]) {
    if (alturaEm(Math.floor(px), Math.floor(py)) > corpo.z) return true;
  }
  return false;
}
