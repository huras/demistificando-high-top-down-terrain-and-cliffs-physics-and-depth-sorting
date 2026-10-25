/**
 * Input R + LMB throw + tick do sistema Força no carrier do jogador.
 */
import { teclaAgora } from "../entrada/teclado.js";
import { botaoEsquerdoSegurado } from "../entrada/ponteiro3d.js";
import { estaMontado, indiceMontado } from "../jogo/ride.js";
import { estado, avisar } from "../jogo/estado.js";
import { listaParty } from "../pokemon/party.js";
import { rangedNaMao } from "../jogo/ranged.js";
import { t } from "../jogo/i18n.js";
import { carregarOverridesForca, forcaPorDex } from "./forcaEspecie.js";
import {
  atualizarCanal,
  configurarForca,
  consumirFalhaLift,
  consumirStruggleBreak,
  estaCarregandoForca,
  forcarSoltarPerto,
  infoPromptForca,
  obterCarryOwner,
  obterGrabActor,
  obterOrderCarrier,
  tentarInteragir,
} from "./sistemaForca.js";
import { tickOrdensForca } from "./tickOrdensForca.js";

let ponteiroMundo = null;
let boot = false;
let lmbAntes = false;

export async function iniciarForca(cfg = null) {
  if (cfg) configurarForca(cfg);
  if (!boot) {
    boot = true;
    await carregarOverridesForca();
  }
}

/**
 * @param {{ x: number, y: number } | null} pt
 */
export function definirPonteiroForca(pt) {
  ponteiroMundo = pt;
}

/**
 * Aplica tier do ride (ou humano) no corpo estável do jogador.
 * @param {object} corpo
 */
export function prepararCarrierJogador(corpo) {
  if (!corpo) return null;
  corpo.ehHumano = true;
  corpo.isPlayer = true;
  if (estaMontado()) {
    const mon = listaParty()[indiceMontado()];
    corpo._forcaTierOverride =
      mon && !mon.morto ? forcaPorDex(mon.especie?.dex) : null;
  } else {
    corpo._forcaTierOverride = null;
  }
  return corpo;
}

/**
 * @param {number} dt
 * @param {object} corpo
 * @param {{ trava?: boolean }} [opts]
 */
export function tickForca(dt, corpo, opts = {}) {
  if (!corpo || opts.trava) {
    lmbAntes = false;
    tickOrdensForca(dt);
    return;
  }

  const carrier = prepararCarrierJogador(corpo);

  if (teclaAgora("KeyR")) {
    tentarInteragir(carrier);
  }

  if (corpo.voando || corpo.escalando || (corpo.planando && !corpo.noChao)) {
    if (estaCarregandoForca()) forcarSoltarPerto(carrier);
  }

  const donoCarry = obterCarryOwner();
  const playerCarrega = estaCarregandoForca() && donoCarry === carrier;
  const lmbAgora = playerCarrega && !rangedNaMao() && botaoEsquerdoSegurado();
  const soltou = playerCarrega && !rangedNaMao() && lmbAntes && !lmbAgora;
  lmbAntes = lmbAgora;

  // Canal/carry do companion ou do jogador — um tick por frame.
  const actorCanal = obterGrabActor() || donoCarry || obterOrderCarrier() || carrier;
  atualizarCanal(dt, actorCanal, {
    carregando: lmbAgora && actorCanal === carrier,
    soltou: soltou && actorCanal === carrier,
    pointer: ponteiroMundo,
    playerCarrier: carrier,
  });

  const fail = consumirFalhaLift();
  if (fail) {
    estado.itemGet = t("forca.muitoPesado");
    avisar();
  }
  const struggle = consumirStruggleBreak();
  if (struggle) {
    estado.itemGet = t("forca.soltou");
    avisar();
  }

  tickOrdensForca(dt);
}

/**
 * @param {object} corpo
 */
export function promptForca(corpo) {
  return infoPromptForca(prepararCarrierJogador(corpo));
}
