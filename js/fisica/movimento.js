import { RAIO_CORPO } from "../config.js";
import { teclaAgora, teclaEscaladaAgora, vetorMovimento } from "../entrada/teclado.js";
import { alturaEm } from "../mundo/altura.js";
import {
  atualizarAsaDelta,
  atualizarCorridaAsaDelta,
  estaPlanando,
  tratarInputAsaDelta,
} from "./asaDelta.js";
import {
  alturaSobPes,
  moverAereo,
  moverComColisao,
} from "./colisao.js";
import { atualizarCorrida } from "./corrida.js";
import {
  anexarEscalada,
  atualizarEscalada,
  soltarEscalada,
  tentarEscalar,
} from "./escalada.js";
import {
  atualizarAereo,
  empurrarForaDeCliff,
  iniciarPulo,
  iniciarQueda,
  podeIniciarPulo,
  registrarBufferPulo,
} from "./pulo.js";
import { iniciarStamina, regenerarStamina } from "./stamina.js";
import { resolverMovimentoPosMantle } from "./travaInputEscalada.js";

export function criarCorpo(spawn) {
  const corpo = {
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
    planando: false,
    escalando: false,
    pulo: null,
    escalada: null,
    travaEscalada: null,
    travaPosMantle: null,
    hopLift: 0,
    puloCortado: false,
    coyoteT: 0,
    puloBufferT: 0,
    tempoAr: 0,
    _glideTempo: 0,
    _glideYaw: 0,
    _glideBank: 0,
    acao: "parado",
    animT: 0,
    andando: false,
    stamina: 0,
    staminaMax: 0,
  };
  iniciarStamina(corpo);
  return corpo;
}

export function atualizarMovimento(corpo, dt) {
  let { dx, dy } = vetorMovimento();

  // —— Escalando: WASD na face; Space ou E/F solta ——
  if (corpo.escalando && corpo.escalada) {
    const apertouPulo = teclaAgora("Space");
    const apertouEscala = teclaEscaladaAgora();
    if (apertouPulo || apertouEscala) {
      soltarEscalada(corpo, {
        impulso: true,
        motivo: apertouEscala ? "escala" : "space",
      });
      // continua o frame na queda
    } else {
      corpo.hopLift = atualizarEscalada(corpo, dt, dx, dy);
      if (corpo.escalando) {
        corpo.andando = false;
        corpo.vx = 0;
        corpo.vy = 0;
        if (dx !== 0 || dy !== 0) corpo.animT += dt;
        return;
      }
      // mantle neste frame — segue pro chão com travaPosMantle
    }
  }

  // pós-mantle: tecla segurada → dentro do platô até soltar
  if (!corpo.escalando) {
    ({ dx, dy } = resolverMovimentoPosMantle(corpo, dx, dy));
  }

  if (corpo.puloBufferT > 0) corpo.puloBufferT = Math.max(0, corpo.puloBufferT - dt);

  const apertouPulo = teclaAgora("Space");
  registrarBufferPulo(corpo, apertouPulo);

  // Space: chão = hop Mario; 2º toque no ar = asa-delta
  if (estaPlanando(corpo)) {
    tratarInputAsaDelta(corpo, apertouPulo);
  } else if (
    (apertouPulo || corpo.puloBufferT > 0) &&
    podeIniciarPulo(corpo)
  ) {
    iniciarPulo(corpo);
  } else if (apertouPulo && !corpo.noChao) {
    tratarInputAsaDelta(corpo, true);
  }

  // E (2D) / F (3D): gruda na face — tecla segurada vira “subir”
  if (teclaEscaladaAgora() && !corpo.escalando) {
    const res = tentarEscalar(corpo);
    if (res?.ok) {
      anexarEscalada(corpo, res, dx, dy);
      corpo.hopLift = atualizarEscalada(corpo, 0, dx, dy);
      return;
    }
    corpo.acao = res?.motivo ? `escala bloqueada (${res.motivo})` : "escala bloqueada";
  }

  if (dx !== 0 || dy !== 0) {
    if (dx !== 0) corpo.dirX = Math.sign(dx);
    if (dy !== 0) corpo.dirY = Math.sign(dy);
    if (dx !== 0 && dy === 0) corpo.dirY = 0;
    if (dy !== 0 && dx === 0) corpo.dirX = 0;
    corpo.facing = facingDeDir(corpo.dirX || dx, corpo.dirY || dy);
  }

  if (corpo.noChao) atualizarNoChao(corpo, dx, dy, dt);
  else atualizarNoAr(corpo, dx, dy, dt);

  regenerarStamina(corpo, dt);
}

function atualizarNoChao(corpo, dx, dy, dt) {
  corpo.planando = false;
  corpo.tempoAr = 0;
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

  // degrau +1: sobe andando (sem Space)
  if (zChao > corpo.z) {
    corpo.acao = `degrau → z${zChao}`;
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
  } else if (
    !corpo.acao.startsWith("escala") &&
    !corpo.acao.startsWith("pousou") &&
    !corpo.acao.startsWith("mantle") &&
    !corpo.acao.startsWith("soltou") &&
    !corpo.acao.startsWith("desceu") &&
    !corpo.acao.startsWith("stamina")
  ) {
    corpo.acao = "parado";
  }
}

function atualizarNoAr(corpo, dx, dy, dt) {
  if (estaPlanando(corpo)) {
    atualizarCorridaAsaDelta(corpo, dx, dy, dt);
  } else {
    atualizarCorrida(corpo, dx, dy, dt, false);
  }

  const passoX = corpo.vx * dt;
  const passoY = corpo.vy * dt;
  const pos = moverAereo(corpo, passoX, passoY, corpo.elevacao);

  if (pos.bloqueouX) corpo.vx = 0;
  if (pos.bloqueouY) corpo.vy = 0;

  corpo.x = pos.x;
  corpo.y = pos.y;

  if (estaPlanando(corpo)) {
    atualizarAsaDelta(corpo, dt);
  } else {
    atualizarAereo(corpo, dt);
  }

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
