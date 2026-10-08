import { RAIO_CORPO, VELOCIDADE_MAX, VELOCIDADE_SPRINT } from "../config.js";
import {
  teclaAgora,
  teclaBaixa,
  teclaEscaladaAgora,
  vetorMovimento,
} from "../entrada/teclado.js";
import {
  atualizarAsaDelta,
  atualizarCorridaAsaDelta,
  estaPlanando,
  tratarInputAsaDelta,
} from "./asaDelta.js";
import {
  alturaSobPes,
  corpoColideSolido,
  moverAereo,
  moverComColisao,
} from "./colisao.js";
import {
  aplicarCorrenteChao,
  atualizarNado,
  fimPassoChao,
  inicioPassoChao,
  tentarBracada,
} from "./agua.js";
import { atualizarCorrida } from "./corrida.js";
import {
  anexarEscalada,
  atualizarEscalada,
  atualizarMantle,
  soltarEscalada,
  tentarEscalar,
} from "./escalada.js";
import {
  atualizarAereo,
  empurrarForaDeCliff,
  empurrarForaDePisoAlto,
  iniciarPulo,
  iniciarQueda,
  liberarCorpoAereo,
  podeIniciarPulo,
  registrarBufferPulo,
} from "./pulo.js";
import { iniciarStamina, regenerarStamina } from "./stamina.js";
import { resolverMovimentoPosMantle } from "./travaInputEscalada.js";
import { atualizarVoo, entrarVoo, estaVoando, sairVoo } from "./voo.js";

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
    voando: false,
    nadando: false,
    aguaSegura: null,
    afogandoT: 0,
    aguaProf: 0,
    aguaCaindo: 0,
    pulo: null,
    escalada: null,
    mantle: null,
    travaEscalada: null,
    travaPosMantle: null,
    hopLift: 0,
    puloCortado: false,
    segurarPulo: false,
    coyoteT: 0,
    puloBufferT: 0,
    tempoAr: 0,
    _glideTempo: 0,
    _glideYaw: 0,
    _glideBank: 0,
    acao: "parado",
    animT: 0,
    andando: false,
    correndo: false,
    stamina: 0,
    staminaMax: 0,
  };
  iniciarStamina(corpo);
  return corpo;
}

export function atualizarMovimento(corpo, dt) {
  let { dx, dy } = vetorMovimento();

  // F: toggle fly (não drena stamina)
  if (teclaAgora("KeyF")) {
    if (estaVoando(corpo)) sairVoo(corpo, { pousar: false });
    else {
      corpo.nadando = false;
      entrarVoo(corpo);
    }
  }

  if (estaVoando(corpo)) {
    if (dx !== 0 || dy !== 0) {
      if (dx !== 0) corpo.dirX = Math.sign(dx);
      if (dy !== 0) corpo.dirY = Math.sign(dy);
      if (dx !== 0 && dy === 0) corpo.dirY = 0;
      if (dy !== 0 && dx === 0) corpo.dirX = 0;
      corpo.facing = facingDeDir(corpo.dirX || dx, corpo.dirY || dy);
    }
    const sobe = teclaBaixa("Space");
    const desce = teclaBaixa("ShiftLeft") || teclaBaixa("ShiftRight");
    corpo.correndo = false;
    atualizarVoo(corpo, dx, dy, sobe, desce, dt, VELOCIDADE_MAX);
    regenerarStamina(corpo, dt);
    return;
  }

  // —— Mantle: arco pro topo (bloqueia resto do input) ——
  if (corpo.mantle) {
    const ainda = atualizarMantle(corpo, dt);
    corpo.andando = false;
    if (ainda) return;
    // pousou — continua o frame no chão com travaPosMantle
  }

  // —— Escalando: WASD na face; Space ou E solta ——
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
      if (corpo.escalando || corpo.mantle) {
        corpo.andando = false;
        corpo.vx = 0;
        corpo.vy = 0;
        if (dx !== 0 || dy !== 0) corpo.animT += dt;
        return;
      }
    }
  }

  // pós-mantle: tecla segurada → dentro do platô até soltar
  if (!corpo.escalando) {
    ({ dx, dy } = resolverMovimentoPosMantle(corpo, dx, dy));
  }

  if (corpo.puloBufferT > 0) corpo.puloBufferT = Math.max(0, corpo.puloBufferT - dt);

  const apertouPulo = teclaAgora("Space");
  registrarBufferPulo(corpo, apertouPulo);

  // Space: chão = hop Mario; nado = braçada; 2º toque no ar = asa-delta
  if (corpo.nadando && apertouPulo) {
    tentarBracada(corpo);
  } else if (estaPlanando(corpo)) {
    tratarInputAsaDelta(corpo, apertouPulo);
  } else if (
    (apertouPulo || corpo.puloBufferT > 0) &&
    podeIniciarPulo(corpo)
  ) {
    iniciarPulo(corpo);
  } else if (apertouPulo && !corpo.noChao && !corpo.nadando) {
    tratarInputAsaDelta(corpo, true);
  }

  // E: gruda na face — tecla segurada vira “subir”
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

  const shift =
    teclaBaixa("ShiftLeft") || teclaBaixa("ShiftRight");
  corpo.correndo =
    !!shift &&
    corpo.noChao &&
    !corpo.escalando &&
    !corpo.mantle &&
    (dx !== 0 || dy !== 0);

  if (corpo.nadando && !corpo.escalando && !corpo.voando) {
    atualizarNado(corpo, dx, dy, dt);
    return;
  }

  if (corpo.noChao) atualizarNoChao(corpo, dx, dy, dt);
  else {
    corpo.correndo = false;
    atualizarNoAr(corpo, dx, dy, dt);
  }

  regenerarStamina(corpo, dt);
}

function atualizarNoChao(corpo, dx, dy, dt) {
  corpo.planando = false;
  corpo.tempoAr = 0;
  const velMax = corpo.correndo ? VELOCIDADE_SPRINT : VELOCIDADE_MAX;
  const fase = inicioPassoChao(corpo, velMax);
  if (fase === "nado") {
    atualizarNado(corpo, dx, dy, dt);
    return;
  }
  if (fase === "queda") {
    iniciarQueda(corpo);
    atualizarAereo(corpo, dt);
    corpo.andando = false;
    corpo.correndo = false;
    return;
  }

  const vel = corpo._velAgua ?? velMax;
  const comCorrente = aplicarCorrenteChao(corpo, dx, dy, dt);
  const movendo =
    comCorrente == null
      ? atualizarCorrida(corpo, dx, dy, dt, true, vel)
      : comCorrente;
  const passoX = corpo.vx * dt;
  const passoY = corpo.vy * dt;
  const novo = moverComColisao(corpo, passoX, passoY, "andar");

  if (novo.bloqueouX) corpo.vx = 0;
  if (novo.bloqueouY) corpo.vy = 0;

  corpo.x = novo.x;
  corpo.y = novo.y;

  const depois = fimPassoChao(corpo);
  if (depois === "nado") {
    atualizarNado(corpo, dx, dy, dt);
    return;
  }

  const zChao = alturaSobPes(corpo.x, corpo.y, corpo.z);

  if (zChao <= 0 || zChao < corpo.z) {
    iniciarQueda(corpo);
    corpo.elevacao = corpo.z;
    // Tira cantos do piso alto — senão o AABB trava o XY a queda inteira.
    empurrarForaDePisoAlto(corpo, zChao);
    atualizarAereo(corpo, dt);
    corpo.andando = false;
    corpo.correndo = false;
    return;
  }

  corpo.z = zChao;
  corpo.elevacao = zChao;
  corpo.hopLift = 0;
  corpo.vz = 0;

  if (cantoEmCliffAlto(corpo)) empurrarForaDeCliff(corpo);

  corpo.andando = movendo && (dx !== 0 || dy !== 0);
  if (corpo.aguaProf > 0.2) {
    corpo.correndo = false;
    corpo.acao = corpo.andando ? "vadeando" : "vado";
    if (corpo.andando) corpo.animT += dt;
  } else if (corpo.andando) {
    corpo.animT += dt * (corpo.correndo ? 1.35 : 1);
    corpo.acao = corpo.correndo ? "sprint" : "correndo";
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

  liberarCorpoAereo(corpo);

  const passoX = corpo.vx * dt;
  const passoY = corpo.vy * dt;
  const pos = moverAereo(corpo, passoX, passoY, corpo.elevacao);

  if (pos.bloqueouX) corpo.vx = 0;
  if (pos.bloqueouY) corpo.vy = 0;

  corpo.x = pos.x;
  corpo.y = pos.y;

  liberarCorpoAereo(corpo);

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
  const elev = corpo.elevacao ?? corpo.z;
  for (const [px, py] of [
    [corpo.x - r, corpo.y - r],
    [corpo.x + r, corpo.y - r],
    [corpo.x - r, corpo.y + r],
    [corpo.x + r, corpo.y + r],
  ]) {
    if (corpoColideSolido(Math.floor(px), Math.floor(py), elev)) return true;
  }
  return false;
}
