/** Mapa golpe → fábrica de padrão visual. */

import { PadraoInvestida, PadraoScratch } from "./padroes/melee.js";
import { PadraoCastRanged, PadraoPistola, PadraoSwift } from "./padroes/ranged.js";
import { PadraoStatus } from "./padroes/status.js";

/**
 * @typedef {object} ReceitaFx
 * @property {() => import('./padraoBase.js').PadraoBase} criar
 * @property {object} [opts]
 * @property {string} [folha]
 */

/** @type {Record<string, ReceitaFx>} */
const POR_CHAVE = {
  tackle: { criar: () => new PadraoInvestida() },
  quickAttack: { criar: () => new PadraoInvestida(), opts: { rapido: true } },
  scratch: { criar: () => new PadraoScratch() },
  ember: { criar: () => new PadraoCastRanged(), folha: "ember" },
  razorLeaf: { criar: () => new PadraoCastRanged(), folha: "razorLeaf" },
  bubble: { criar: () => new PadraoCastRanged(), folha: "bubble" },
  flamethrower: { criar: () => new PadraoCastRanged(), opts: { jato: true }, folha: "flamethrower" },
  waterGun: { criar: () => new PadraoPistola(), folha: "" },
  swift: { criar: () => new PadraoSwift() },
  growl: { criar: () => new PadraoStatus(), opts: { variante: "growl", alcance: 7 } },
  tailWhip: { criar: () => new PadraoStatus(), opts: { variante: "tail", alcance: 5.5 } },
  poisonPowder: { criar: () => new PadraoStatus(), opts: { variante: "poison", alcance: 5 } },
  sleepPowder: { criar: () => new PadraoStatus(), opts: { variante: "sleep", alcance: 5 } },
  stunSpore: { criar: () => new PadraoStatus(), opts: { variante: "paralysis", alcance: 5 } },
  spore: { criar: () => new PadraoStatus(), opts: { variante: "sleep", alcance: 5 } },
  thunderWave: { criar: () => new PadraoStatus(), opts: { variante: "paralysis", alcance: 6 } },
  willOWisp: { criar: () => new PadraoStatus(), opts: { variante: "burn", alcance: 6 } },
};

/**
 * @param {object} def
 * @returns {ReceitaFx | null}
 */
export function receitaFx(def) {
  if (!def?.key) return null;
  if (POR_CHAVE[def.key]) return POR_CHAVE[def.key];
  // Fallbacks por forma/categoria.
  if (def.categoria === "status" || (def.poder || 0) <= 0) {
    const ail = def.ailment?.id;
    if (ail === "poison" || ail === "sleep" || ail === "paralysis" || ail === "burn" || ail === "freeze") {
      return { criar: () => new PadraoStatus(), opts: { variante: ail } };
    }
    if (def.debuff) {
      return { criar: () => new PadraoStatus(), opts: { variante: "growl", alcance: 6 } };
    }
    return null;
  }
  if (def.forma === "contact") {
    return { criar: () => new PadraoInvestida() };
  }
  if (def.forma === "projectile" || def.forma === "arc") {
    return { criar: () => new PadraoCastRanged() };
  }
  return null;
}

export function folhaDaReceita(def) {
  const r = POR_CHAVE[def?.key];
  return r?.folha || "";
}
