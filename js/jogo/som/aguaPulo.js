/**
 * Borda de pulo seco, braçada, vau e nado.
 * A primeira amostra (spawn, teleporte) fica em silêncio.
 * A física não importa este módulo.
 */

import { tocar } from "./barramento.js";

const ESPERA = 0.22;
const TELEPORTE2 = 8 * 8;
/** Profundidade / águaProf acima disso conta como molhado (vau). */
const MOLHADO_MIN = 0.15;

/**
 * @typedef {{
 *   primed: boolean,
 *   x: number,
 *   y: number,
 *   nadando: boolean,
 *   molhado: boolean,
 *   acao: string,
 *   saida: number,
 *   entrada: number,
 * }} RastroAgua
 */

/** @type {WeakMap<object, RastroAgua>} */
const rastros = new WeakMap();

function rastroDe(corpo) {
  let r = rastros.get(corpo);
  if (!r) {
    r = {
      primed: false,
      x: corpo.x,
      y: corpo.y,
      nadando: !!corpo.nadando,
      molhado: (Number(corpo.aguaProf) || 0) > MOLHADO_MIN || !!corpo.nadando,
      acao: corpo.acao || "",
      saida: 0,
      entrada: 0,
    };
    rastros.set(corpo, r);
  }
  return r;
}

function tocarSaida(r) {
  if (r.saida > 0) return;
  tocar("puloAguaSai", { volume: 0.92 });
  r.saida = ESPERA;
}

function tocarEntrada(r) {
  if (r.entrada > 0) return;
  tocar("puloAguaEntra", { volume: 0.92 });
  r.entrada = ESPERA;
}

function amostrar(corpo, dt) {
  if (!corpo) return;
  const r = rastroDe(corpo);
  const passo = dt > 0 ? dt : 0;
  r.saida = Math.max(0, r.saida - passo);
  r.entrada = Math.max(0, r.entrada - passo);

  const acao = corpo.acao || "";
  const nadando = !!corpo.nadando;
  const molhado =
    nadando ||
    (Number(corpo.aguaProf) || 0) > MOLHADO_MIN ||
    acao === "vado" ||
    acao === "vadeando";
  const dx = corpo.x - r.x;
  const dy = corpo.y - r.y;
  r.x = corpo.x;
  r.y = corpo.y;

  if (!r.primed || dx * dx + dy * dy > TELEPORTE2) {
    r.primed = true;
    r.nadando = nadando;
    r.molhado = molhado;
    r.acao = acao;
    return;
  }

  if (acao === "braçada" && r.acao !== "braçada") {
    tocarSaida(r);
  } else if (acao === "pulando" && r.acao !== "pulando" && r.acao !== "braçada") {
    tocar("pulo", { volume: 0.9 });
  }

  const cachoeira = !!corpo.aguaCaindo || acao === "cachoeira";
  let tocouEntrada = false;

  if (nadando && !r.nadando && !cachoeira) {
    tocarEntrada(r);
    tocouEntrada = true;
  } else if (
    !nadando &&
    r.nadando &&
    acao !== "braçada" &&
    acao !== "afogou" &&
    r.acao !== "braçada"
  ) {
    tocarSaida(r);
  }

  // Vau: seco ↔ molhado (sem double-fire se já entrou direto no nado).
  if (!tocouEntrada && molhado && !r.molhado && !nadando && !cachoeira) {
    tocarEntrada(r);
  } else if (
    !molhado &&
    r.molhado &&
    !r.nadando &&
    acao !== "braçada" &&
    acao !== "afogou" &&
    r.acao !== "braçada"
  ) {
    // Saída do vau pra seco (saída do nado já tocou acima).
    tocarSaida(r);
  }

  r.nadando = nadando;
  r.molhado = molhado;
  r.acao = acao;
}

export function tickAguaPulo(dt, corpo, agente) {
  amostrar(corpo, dt);
  if (agente && agente !== corpo) amostrar(agente, dt);
}
