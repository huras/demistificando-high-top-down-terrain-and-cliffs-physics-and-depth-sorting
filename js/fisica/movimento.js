import { ASA_DELTA_CORRIDA_MUL, VELOCIDADE_MAX, VELOCIDADE_SPRINT } from "../config.js";
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
import { alturaSobPes, moverAereo, moverComColisao } from "./colisao.js";
import {
  aplicarCorrenteChao,
  atualizarNado,
  fimPassoChao,
  inicioPassoChao,
  tentarBracada,
  tickFluido,
} from "./agua.js";
import { aplicarMulPalha } from "./palha.js";
import { atualizarCorrida } from "./corrida.js";
import { ritmoAndar } from "./ritmoAndar.js";
import {
  anexarEscalada,
  atualizarEscalada,
  atualizarMantle,
  soltarEscalada,
  tentarEscalar,
} from "./escalada.js";
import {
  atualizarAereo,
  iniciarPulo,
  iniciarQueda,
  podeIniciarPulo,
  registrarBufferPulo,
} from "./pulo.js";
import { iniciarStamina, regenerarStamina } from "./stamina.js";
import { resolverMovimentoPosMantle } from "./travaInputEscalada.js";
import { atualizarVoo, entrarVoo, estaVoando, sairVoo } from "./voo.js";
import { entradaJogadorSuspensa } from "../cena/modoCena.js";

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
    ancora: true,
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

/**
 * Pipeline de locomoção com vetor externo (teclado ou passeio).
 * opts: correndo, apertouPulo, querEscalar, podeSoltarEscala, autoEscalar, desceAsa
 */
export function atualizarMovimentoDirecionado(corpo, dxIn, dyIn, dt, opts = {}) {
  tickFluido(corpo, dt);
  let dx = dxIn;
  let dy = dyIn;
  const apertouPulo = !!opts.apertouPulo;
  const querEscalar = !!opts.querEscalar;
  const podeSoltarEscala = opts.podeSoltarEscala !== false;
  const autoEscalar = !!opts.autoEscalar;
  const desceAsa = !!opts.desceAsa;
  const sobeVoo = !!opts.sobeVoo;
  const forcarCorrida = !!opts.correndo;

  if (estaVoando(corpo)) {
    if (dx !== 0 || dy !== 0) {
      if (dx !== 0) corpo.dirX = Math.sign(dx);
      if (dy !== 0) corpo.dirY = Math.sign(dy);
      if (dx !== 0 && dy === 0) corpo.dirY = 0;
      if (dy !== 0 && dx === 0) corpo.dirX = 0;
      corpo.facing = facingDeDir(corpo.dirX || dx, corpo.dirY || dy);
    }
    corpo.correndo = forcarCorrida;
    const velVoo = corpo.correndo ? VELOCIDADE_MAX * ASA_DELTA_CORRIDA_MUL : VELOCIDADE_MAX;
    const aindaVoo = atualizarVoo(corpo, dx, dy, sobeVoo, desceAsa, dt, velVoo);
    if (aindaVoo && corpo.correndo && desceAsa) corpo.acao = "voando sprint+desce";
    else if (aindaVoo && corpo.correndo) corpo.acao = "voando sprint";
    else if (aindaVoo && desceAsa) corpo.acao = "voando desce";
    regenerarStamina(corpo, dt);
    return;
  }

  // —— Mantle: arco pro topo (bloqueia resto do input) ——
  if (corpo.mantle) {
    const ainda = atualizarMantle(corpo, dt);
    corpo.andando = false;
    if (ainda) return;
  }

  // —— Escalando: WASD na face; Space/E soltam só se permitido ——
  if (corpo.escalando && corpo.escalada) {
    if (podeSoltarEscala && (apertouPulo || querEscalar)) {
      soltarEscalada(corpo, {
        impulso: true,
        motivo: querEscalar ? "escala" : "space",
      });
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

  registrarBufferPulo(corpo, apertouPulo);

  // Space: chão = hop Mario; nado = braçada; 2º toque no ar = asa-delta
  if (corpo.nadando && apertouPulo) {
    tentarBracada(corpo);
  } else if (estaPlanando(corpo)) {
    tratarInputAsaDelta(corpo, apertouPulo);
  } else if ((apertouPulo || corpo.puloBufferT > 0) && podeIniciarPulo(corpo)) {
    iniciarPulo(corpo);
  } else if (apertouPulo && !corpo.noChao && !corpo.nadando) {
    tratarInputAsaDelta(corpo, true);
  }

  // E: gruda na face (auto-escala só em colisão / ar — ver abaixo)
  if (querEscalar && !corpo.escalando) {
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

  const planando = estaPlanando(corpo);
  corpo.correndo =
    forcarCorrida &&
    !corpo.escalando &&
    !corpo.mantle &&
    (planando || (corpo.noChao && (dx !== 0 || dy !== 0)));

  if (corpo.nadando && !corpo.escalando && !corpo.voando) {
    atualizarNado(corpo, dx, dy, dt);
    return;
  }

  if (corpo.noChao) atualizarNoChao(corpo, dx, dy, dt, autoEscalar);
  else {
    if (!planando) corpo.correndo = false;
    atualizarNoAr(corpo, dx, dy, dt, desceAsa);
    if (autoEscalar && !corpo.escalando && !corpo.mantle) {
      const res = tentarEscalar(corpo);
      if (res?.ok) {
        anexarEscalada(corpo, res, dx, dy);
        corpo.hopLift = atualizarEscalada(corpo, 0, dx, dy);
      }
    }
  }

  regenerarStamina(corpo, dt);
}

export function atualizarMovimento(corpo, dt) {
  if (entradaJogadorSuspensa()) {
    tickFluido(corpo, dt);
    simularSemInput(corpo, dt);
    return;
  }
  let { dx, dy } = vetorMovimento();

  // F: toggle fly (não drena stamina)
  if (teclaAgora("KeyF")) {
    if (estaVoando(corpo)) sairVoo(corpo, { pousar: false });
    else {
      corpo.nadando = false;
      entrarVoo(corpo);
    }
  }

  const shift = teclaBaixa("ShiftLeft") || teclaBaixa("ShiftRight");
  atualizarMovimentoDirecionado(corpo, dx, dy, dt, {
    correndo: shift,
    apertouPulo: teclaAgora("Space"),
    querEscalar: teclaEscaladaAgora(),
    podeSoltarEscala: true,
    sobeVoo: teclaBaixa("Space"),
    desceAsa: teclaBaixa("ControlLeft"),
  });
}

function simularSemInput(corpo, dt) {
  if (estaVoando(corpo)) {
    corpo.correndo = false;
    atualizarVoo(corpo, 0, 0, false, false, dt, VELOCIDADE_MAX);
    regenerarStamina(corpo, dt);
    return;
  }

  if (corpo.mantle) {
    const ainda = atualizarMantle(corpo, dt);
    corpo.andando = false;
    if (ainda) return;
  }

  if (corpo.escalando && corpo.escalada) {
    corpo.hopLift = atualizarEscalada(corpo, dt, 0, 0);
    if (corpo.escalando || corpo.mantle) {
      corpo.andando = false;
      corpo.vx = 0;
      corpo.vy = 0;
      return;
    }
  }

  let dx = 0;
  let dy = 0;
  if (!corpo.escalando) {
    ({ dx, dy } = resolverMovimentoPosMantle(corpo, dx, dy));
  }
  if (corpo.puloBufferT > 0) corpo.puloBufferT = Math.max(0, corpo.puloBufferT - dt);
  corpo.correndo = false;

  if (corpo.nadando && !corpo.escalando && !corpo.voando) {
    atualizarNado(corpo, dx, dy, dt);
    return;
  }

  if (corpo.noChao) atualizarNoChao(corpo, dx, dy, dt, false);
  else atualizarNoAr(corpo, dx, dy, dt, false);
  regenerarStamina(corpo, dt);
}

function atualizarNoChao(corpo, dx, dy, dt, autoEscalar = false) {
  corpo.planando = false;
  corpo.tempoAr = 0;
  const mulForca = Number(corpo.forcaVelMul);
  const velBase = corpo.correndo ? VELOCIDADE_SPRINT : VELOCIDADE_MAX;
  const velMax = velBase * (Number.isFinite(mulForca) && mulForca > 0 ? mulForca : 1);
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

  aplicarMulPalha(corpo);
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

  // Parede na frente: tenta grudar (passeio / stress test).
  if (autoEscalar && (novo.bloqueouX || novo.bloqueouY) && !corpo.escalando) {
    const res = tentarEscalar(corpo);
    if (res?.ok) {
      anexarEscalada(corpo, res, dx, dy);
      corpo.hopLift = atualizarEscalada(corpo, 0, dx, dy);
      return;
    }
  }

  const depois = fimPassoChao(corpo);
  if (depois === "nado") {
    atualizarNado(corpo, dx, dy, dt);
    return;
  }

  const zChao = alturaSobPes(corpo.x, corpo.y, corpo.z);

  if (zChao <= 0 || zChao < corpo.z) {
    iniciarQueda(corpo);
    corpo.elevacao = corpo.z;
    atualizarAereo(corpo, dt);
    corpo.andando = false;
    corpo.correndo = false;
    return;
  }

  corpo.z = zChao;
  corpo.elevacao = zChao;
  corpo.hopLift = 0;
  corpo.vz = 0;

  corpo.andando = movendo && (dx !== 0 || dy !== 0);
  if (corpo.andando) {
    corpo.animT += dt * ritmoAndar(Math.hypot(corpo.vx, corpo.vy), VELOCIDADE_MAX);
  }
  if (corpo.aguaProf > 0.2) {
    corpo.correndo = false;
    corpo.acao = corpo.andando ? "vadeando" : "vado";
  } else if (corpo.andando) {
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

function atualizarNoAr(corpo, dx, dy, dt, desceAsa = false) {
  const planando = estaPlanando(corpo);
  if (planando) {
    atualizarCorridaAsaDelta(corpo, dx, dy, dt, corpo.correndo);
  } else {
    corpo.correndo = false;
    atualizarCorrida(corpo, dx, dy, dt, false);
  }

  const passoX = corpo.vx * dt;
  const passoY = corpo.vy * dt;
  const pos = moverAereo(corpo, passoX, passoY, corpo.elevacao);

  if (pos.bloqueouX) corpo.vx = 0;
  if (pos.bloqueouY) corpo.vy = 0;

  corpo.x = pos.x;
  corpo.y = pos.y;

  if (planando) {
    atualizarAsaDelta(corpo, dt, desceAsa);
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
