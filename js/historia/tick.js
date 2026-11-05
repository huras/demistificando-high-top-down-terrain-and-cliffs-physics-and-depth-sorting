/** Tick unificado da história. */

import { estado } from "../jogo/estado.js";
import { garantirHistoria, registrarEstadoHistoria, hidratarHistoria } from "./persistencia.js";
import { historiaTravaMovimento } from "./travas.js";
import { tickOpening, interagirAtorOpening } from "./opening/flow.js";
import { garantirGuardsWarehouses, garantirJennyViridian, interagirGuard } from "./warehouses/guards.js";
import { falarJenny } from "./warehouses/quest.js";
import { checarSaidaArmazem, interagirTrainerArmazem, promptArmazem, tentarEntrarArmazem } from "./warehouses/entrar.js";
import { tickOverhearViridian } from "./warehouses/overhear.js";
import { atorScriptadoPerto } from "./atoresScriptados.js";

let bootFeito = false;

export function bootHistoria() {
  registrarEstadoHistoria(() => estado);
  // Re-hidrata se o save já veio no blob (carregar rodou antes do register)
  const bruto = (() => {
    try {
      return JSON.parse(localStorage.getItem("demo-jogo-v2") || "null");
    } catch {
      return null;
    }
  })();
  if (bruto?.historia) {
    hidratarHistoria(bruto.historia, { partyLen: (bruto.party || []).length });
  } else {
    garantirHistoria();
  }
  garantirGuardsWarehouses();
  garantirJennyViridian();
  bootFeito = true;
}

export function tickHistoria(corpo, dt) {
  if (!bootFeito) bootHistoria();
  garantirHistoria();
  if (!estado.interior) {
    garantirGuardsWarehouses();
    tickOpening(corpo, dt);
    tickOverhearViridian(corpo, dt);
  } else if (estado.interior.papel === "armazem") {
    checarSaidaArmazem(corpo);
  }
}

export function historiaBloqueiaMovimento() {
  return historiaTravaMovimento();
}

/**
 * Interação E/R com atores de história.
 * @param {object} corpo
 * @param {(sp: string) => void} [darPokemon]
 */
export function interagirHistoria(corpo, darPokemon) {
  const ator = atorScriptadoPerto(corpo.x, corpo.y, 1.8);
  if (!ator) {
    if (promptArmazem(corpo)?.entrar) return tentarEntrarArmazem(corpo);
    return false;
  }
  if (ator.role === "officerJenny") return falarJenny();
  if (ator.role?.startsWith("guard")) return interagirGuard(ator);
  if (ator.role === "warehouseTrainer") return interagirTrainerArmazem(ator);
  if (ator.openingActor) return interagirAtorOpening(ator, darPokemon);
  return false;
}

export function promptHistoria(corpo) {
  const ator = atorScriptadoPerto(corpo.x, corpo.y, 1.8);
  if (ator) {
    return { rotulo: "Falar", tecla: "e", ator };
  }
  return promptArmazem(corpo);
}
