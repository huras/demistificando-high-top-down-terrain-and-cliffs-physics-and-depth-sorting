import { VELOCIDADE } from "../config.js";
import { teclaAgora, vetorMovimento } from "../entrada/teclado.js";
import { moverComColisao } from "./colisao.js";
import { atualizarEscalada, tentarEscalar } from "./escalada.js";
import { atualizarPulo, tentarPulo } from "./pulo.js";

export function criarCorpo(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    dirX: 0,
    dirY: 1,
    facing: 0, // 0 sul, 1 oeste, 2 leste, 3 norte (sheet gold)
    pulando: false,
    escalando: false,
    pulo: null,
    escalada: null,
    hopLift: 0,
    acao: "parado",
    animT: 0,
    andando: false,
  };
}

export function atualizarMovimento(corpo, dt) {
  if (corpo.pulando || corpo.pulo) {
    corpo.hopLift = atualizarPulo(corpo, dt);
    corpo.andando = false;
    return;
  }
  if (corpo.escalando || corpo.escalada) {
    corpo.hopLift = atualizarEscalada(corpo, dt);
    corpo.andando = false;
    return;
  }

  corpo.hopLift = 0;

  if (teclaAgora("Space")) {
    const res = tentarPulo(corpo, corpo.dirX, corpo.dirY);
    if (res?.ok) {
      corpo.pulo = res.pulo;
      corpo.pulando = true;
      corpo.hopLift = atualizarPulo(corpo, 0);
      return;
    }
    corpo.acao = res?.motivo ? `pulo bloqueado (${res.motivo})` : "pulo bloqueado";
  }

  if (teclaAgora("KeyE")) {
    const res = tentarEscalar(corpo);
    if (res?.ok) {
      corpo.escalada = res.escalada;
      corpo.escalando = true;
      corpo.hopLift = atualizarEscalada(corpo, 0);
      return;
    }
    corpo.acao = res?.motivo ? `escala bloqueada (${res.motivo})` : "escala bloqueada";
  }

  const { dx, dy } = vetorMovimento();
  if (dx === 0 && dy === 0) {
    corpo.andando = false;
    if (!corpo.acao.startsWith("pulo") && !corpo.acao.startsWith("escala") && !corpo.acao.startsWith("caiu")) {
      corpo.acao = "parado";
    }
    return;
  }

  // atualiza olhar só nos eixos pressionados (evita diagonal fantasma no E/Space)
  if (dx !== 0) corpo.dirX = Math.sign(dx);
  if (dy !== 0) corpo.dirY = Math.sign(dy);
  if (dx !== 0 && dy === 0) corpo.dirY = 0;
  if (dy !== 0 && dx === 0) corpo.dirX = 0;
  corpo.facing = facingDeDir(corpo.dirX || dx, corpo.dirY || dy);

  const passoX = dx * VELOCIDADE * dt;
  const passoY = dy * VELOCIDADE * dt;
  const novo = moverComColisao(corpo, passoX, passoY, "andar");
  corpo.x = novo.x;
  corpo.y = novo.y;
  corpo.z = novo.z;
  corpo.andando = true;
  corpo.animT += dt;
  corpo.acao = "andando";
}

function facingDeDir(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2; // O / L
  return dy < 0 ? 3 : 0; // N / S
}
