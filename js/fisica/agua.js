/**
 * Vau, nado na superfície, corrente e cachoeira.
 * Não importa pulo.js — o pouso no ar chama daqui pra evitar ciclo.
 */
import {
  ACELERACAO_AR,
  ACELERACAO_CHAO,
  AGUA_AFOGA_EXTRA,
  AGUA_AFOGA_SEG,
  AGUA_BRACADA_CUSTO,
  AGUA_BRACADA_VZ,
  AGUA_CORRENTE,
  AGUA_FLUTUA,
  AGUA_LIMIAR_VADO,
  AGUA_QUEDA_VEL,
  AGUA_VEL_NADO,
  STAMINA_MAX,
} from "../config.js";
import { amostraAgua } from "../mundo/agua/amostra.js";
import { moverAereo } from "./colisao.js";
import { drenarStaminaNado } from "./stamina.js";

function aproximar(atual, alvo, maxDelta) {
  const d = alvo - atual;
  if (Math.abs(d) <= maxDelta) return alvo;
  return atual + Math.sign(d) * maxDelta;
}

export function deveNadar(agua, elev) {
  if (!agua || agua.caindo || agua.profundidade <= AGUA_LIMIAR_VADO) return false;
  return elev <= agua.superficie + 0.08;
}

export function fatorVado(profundidade) {
  const p = Math.max(0, profundidade || 0);
  if (p <= 0.05) return 1;
  const t = Math.min(1, p / AGUA_LIMIAR_VADO);
  return 1 - t * 0.5;
}

export function lembrarChaoSeguro(corpo) {
  const agua = amostraAgua(corpo.x, corpo.y, corpo.z);
  if (agua.caindo || agua.profundidade > AGUA_LIMIAR_VADO) return;
  corpo.aguaSegura = { x: corpo.x, y: corpo.y, z: corpo.z };
}

function gravarAmostra(corpo, agua) {
  corpo.aguaProf = agua.caindo
    ? Math.max(0, agua.superficie - agua.pisoQueda)
    : agua.profundidade || 0;
  corpo.aguaCaindo = agua.caindo ? 1 : 0;
}

export function entrarNado(corpo, agua) {
  const alvo = agua.caindo ? agua.pisoQueda : agua.superficie - AGUA_FLUTUA;
  corpo.nadando = true;
  corpo.noChao = false;
  corpo.pulando = false;
  corpo.planando = false;
  corpo.correndo = false;
  corpo.vz = 0;
  corpo.elevacao = alvo;
  corpo.z = agua.fundo > 0 ? agua.fundo : Math.floor(alvo);
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.afogandoT = corpo.afogandoT || 0;
  gravarAmostra(corpo, agua);
  corpo.acao = agua.caindo ? "cachoeira" : "nadando";
}

export function sairNado(corpo, zChao) {
  const z = zChao > 0 ? zChao : corpo.z;
  corpo.nadando = false;
  corpo.afogandoT = 0;
  corpo.noChao = true;
  corpo.pulando = false;
  corpo.planando = false;
  corpo.vz = 0;
  corpo.z = z;
  corpo.elevacao = z;
  corpo.hopLift = 0;
  corpo.aguaCaindo = 0;
  lembrarChaoSeguro(corpo);
  corpo.acao = corpo.aguaProf > 0.2 ? "vadeando" : "pousou";
}

function integrarHorizontal(corpo, dx, dy, dt, velMax, agua, noChao) {
  const cx = (agua.fluxoX || 0) * AGUA_CORRENTE;
  const cy = (agua.fluxoY || 0) * AGUA_CORRENTE;
  const acel = noChao ? ACELERACAO_CHAO : ACELERACAO_AR;
  const alvoX = dx * velMax + cx;
  const alvoY = dy * velMax + cy;
  corpo.vx = aproximar(corpo.vx, alvoX, acel * dt);
  corpo.vy = aproximar(corpo.vy, alvoY, acel * dt);
  const cap = velMax + Math.hypot(cx, cy);
  const sp = Math.hypot(corpo.vx, corpo.vy);
  if (sp > cap && sp > 0) {
    corpo.vx *= cap / sp;
    corpo.vy *= cap / sp;
  }
  return Math.hypot(dx, dy) > 0.01 || sp > 0.05;
}

/**
 * Antes do passo no chão.
 * @returns {"chao"|"nado"|"queda"}
 */
export function inicioPassoChao(corpo, velMax) {
  const agua = amostraAgua(corpo.x, corpo.y, corpo.elevacao ?? corpo.z);
  gravarAmostra(corpo, agua);
  const elev = corpo.elevacao ?? corpo.z;
  if (agua.caindo && elev <= agua.superficie + 0.2) return "queda";
  if (deveNadar(agua, elev)) {
    entrarNado(corpo, agua);
    return "nado";
  }
  lembrarChaoSeguro(corpo);
  corpo._velAgua = velMax * fatorVado(agua.profundidade);
  corpo._aguaPasso = agua;
  return "chao";
}

/** Depois do XY no chão, antes de grudar no piso. */
export function fimPassoChao(corpo) {
  const agua = amostraAgua(corpo.x, corpo.y, corpo.elevacao ?? corpo.z);
  gravarAmostra(corpo, agua);
  if (agua.caindo) return "queda";
  if (agua.profundidade > AGUA_LIMIAR_VADO) {
    entrarNado(corpo, agua);
    return "nado";
  }
  return "chao";
}

export function aplicarCorrenteChao(corpo, dx, dy, dt) {
  const agua = corpo._aguaPasso;
  const vel = corpo._velAgua ?? 0;
  if (agua && agua.profundidade > 0.05) {
    return integrarHorizontal(corpo, dx, dy, dt, vel, agua, true);
  }
  return null;
}

export function tentarBracada(corpo) {
  if (!corpo.nadando) return false;
  if ((corpo.stamina ?? 0) < AGUA_BRACADA_CUSTO) return false;
  corpo.stamina -= AGUA_BRACADA_CUSTO;
  corpo.nadando = false;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.puloCortado = true;
  corpo.vz = AGUA_BRACADA_VZ;
  corpo.vx += (corpo.dirX || 0) * 1.4;
  corpo.vy += (corpo.dirY || 0) * 1.4;
  corpo.acao = "braçada";
  return true;
}

function afogar(corpo) {
  const s = corpo.aguaSegura;
  corpo.nadando = false;
  corpo.afogandoT = 0;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.pulando = false;
  corpo.planando = false;
  if (s) {
    corpo.x = s.x;
    corpo.y = s.y;
    corpo.z = s.z;
    corpo.elevacao = s.z;
    corpo.hopLift = 0;
    corpo.noChao = true;
  }
  const max = corpo.staminaMax || STAMINA_MAX;
  corpo.stamina = max * 0.4;
  corpo.acao = "afogou";
}

/**
 * Tick de nado / fundo da cachoeira. Retorna false se voltou ao chão.
 */
export function atualizarNado(corpo, dx, dy, dt) {
  let agua = amostraAgua(corpo.x, corpo.y, corpo.elevacao);
  gravarAmostra(corpo, agua);
  corpo.correndo = false;
  corpo.planando = false;
  corpo.pulando = false;
  corpo.noChao = false;
  corpo.nadando = true;

  if (!agua.caindo && agua.profundidade <= AGUA_LIMIAR_VADO) {
    sairNado(corpo, agua.fundo > 0 ? agua.fundo : corpo.z);
    return false;
  }

  if (agua.caindo && corpo.elevacao > agua.pisoQueda + 0.08) {
    corpo.vz = Math.min(corpo.vz || 0, -AGUA_QUEDA_VEL);
    corpo.elevacao += corpo.vz * dt;
    if (corpo.elevacao < agua.pisoQueda) corpo.elevacao = agua.pisoQueda;
    corpo.acao = "cachoeira";
  } else if ((corpo.stamina ?? 0) <= 1e-4 && !corpo.invulneravel) {
    corpo.afogandoT = (corpo.afogandoT || 0) + dt;
    const linha = agua.caindo ? agua.pisoQueda : agua.superficie;
    const alvo = linha - (AGUA_FLUTUA + AGUA_AFOGA_EXTRA);
    corpo.elevacao += (alvo - corpo.elevacao) * Math.min(1, dt * 1.6);
    corpo.acao = "afogando";
    if (corpo.afogandoT >= AGUA_AFOGA_SEG) {
      afogar(corpo);
      return false;
    }
  } else {
    corpo.afogandoT = 0;
    const alvo = agua.caindo ? agua.pisoQueda : agua.superficie - AGUA_FLUTUA;
    corpo.elevacao += (alvo - corpo.elevacao) * Math.min(1, dt * 8);
    corpo.vz = 0;
    corpo.acao = agua.caindo ? "cachoeira" : "nadando";
  }

  corpo.z = agua.fundo > 0 ? agua.fundo : Math.floor(corpo.elevacao);
  corpo.hopLift = corpo.elevacao - corpo.z;

  const andando = integrarHorizontal(corpo, dx, dy, dt, AGUA_VEL_NADO, agua, false);
  // A quina da margem fica na linha d'água. O pé submerso não pode travar nela.
  const zMin =
    agua.caindo || agua.superficie <= 0 ? 0 : Math.floor(agua.superficie);
  const pos = moverAereo(corpo, corpo.vx * dt, corpo.vy * dt, corpo.elevacao, zMin);
  if (pos.bloqueouX) corpo.vx = 0;
  if (pos.bloqueouY) corpo.vy = 0;
  corpo.x = pos.x;
  corpo.y = pos.y;

  agua = amostraAgua(corpo.x, corpo.y, corpo.elevacao);
  gravarAmostra(corpo, agua);
  if (!agua.caindo && agua.profundidade <= AGUA_LIMIAR_VADO) {
    sairNado(corpo, agua.fundo > 0 ? agua.fundo : corpo.z);
    return false;
  }

  if (corpo.acao !== "afogando" && corpo.acao !== "cachoeira") {
    drenarStaminaNado(corpo, dt, andando);
  } else if (corpo.acao === "cachoeira" && (corpo.stamina ?? 0) > 0) {
    drenarStaminaNado(corpo, dt, true);
  }
  corpo.andando = andando && corpo.acao === "nadando";
  if (corpo.andando) corpo.animT += dt;
  return true;
}

/**
 * Durante a queda: entra na lâmina ou despenca na cachoeira.
 * true = o corpo já não está em queda livre.
 */
export function resolverAguaAereo(corpo) {
  const agua = amostraAgua(corpo.x, corpo.y, corpo.elevacao);
  if (agua.superficie <= 0) return false;
  gravarAmostra(corpo, agua);

  if (agua.caindo && corpo.elevacao <= agua.superficie + 0.35) {
    corpo.planando = false;
    if (corpo.elevacao > agua.pisoQueda) {
      corpo.vz = Math.min(corpo.vz, -AGUA_QUEDA_VEL);
      corpo.acao = "cachoeira";
      return false;
    }
    entrarNado(corpo, agua);
    return true;
  }

  if (
    corpo.vz <= 0 &&
    deveNadar(agua, corpo.elevacao) &&
    corpo.elevacao <= agua.superficie + 0.08
  ) {
    corpo.planando = false;
    entrarNado(corpo, agua);
    return true;
  }
  return false;
}
