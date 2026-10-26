/** Mapa golpe → fábrica de padrão visual (catálogo + fallbacks). */

import { efeitoDe, idEfeito } from "../../../efeitos/catalogo.js";
import { PadraoFeixe, PadraoRaio, PadraoThunderWave } from "./padroes/feixe.js";
import { PadraoInvestida, PadraoScratch } from "./padroes/melee.js";
import { PadraoCastRanged, PadraoPistola, PadraoSwift } from "./padroes/ranged.js";
import { PadraoStatus } from "./padroes/status.js";

/**
 * @typedef {object} ReceitaFx
 * @property {() => import('./padraoBase.js').PadraoBase} criar
 * @property {object} [opts]
 * @property {string} [folha]
 */

/**
 * @param {object} ef
 * @returns {ReceitaFx | null}
 */
function receitaDoEfeito(ef) {
  if (!ef) return null;
  const folha = ef.folha ? ef.id : ef.visual ? ef.id : "";
  switch (ef.kind) {
    case "jato":
      return { criar: () => new PadraoCastRanged(), opts: { jato: true }, folha };
    case "projetil":
      if (ef.visual === "estrela" || ef.id === "swift") {
        return { criar: () => new PadraoSwift(), folha };
      }
      if (ef.visual === "orbe" || ef.visual === "faisca" || ef.visual === "semente" || ef.id === "water-gun") {
        return { criar: () => new PadraoPistola(), folha };
      }
      return { criar: () => new PadraoCastRanged(), folha };
    case "feixe":
      return { criar: () => new PadraoFeixe(), opts: { feixe: ef.feixe }, folha: "" };
    case "raio":
      return { criar: () => new PadraoRaio(), opts: { feixe: ef.feixe, raio: ef.raio }, folha: "" };
    case "cone":
      return {
        criar: () => new PadraoThunderWave(),
        opts: { cone: ef.cone || ef.status, status: ef.status },
        folha: "",
      };
    case "status":
      if (ef.id === "thunder-wave" || ef.status?.variante === "thunder-wave") {
        return {
          criar: () => new PadraoThunderWave(),
          opts: { cone: ef.cone || ef.status },
          folha: "",
        };
      }
      return {
        criar: () => new PadraoStatus(),
        opts: {
          variante: ef.status?.variante || "growl",
          alcance: ef.status?.alcance || 6,
          duracao: ef.status?.duracao,
        },
      };
    case "melee":
      if (ef.melee?.variante === "scratch") return { criar: () => new PadraoScratch() };
      return {
        criar: () => new PadraoInvestida(),
        opts: { rapido: !!ef.melee?.rapido },
      };
    default:
      return null;
  }
}

/** @type {Record<string, ReceitaFx>} */
const POR_CHAVE = {
  tackle: { criar: () => new PadraoInvestida() },
  quickAttack: { criar: () => new PadraoInvestida(), opts: { rapido: true } },
  scratch: { criar: () => new PadraoScratch() },
  ember: { criar: () => new PadraoCastRanged(), folha: "ember" },
  razorLeaf: { criar: () => new PadraoCastRanged(), folha: "razorLeaf" },
  bubble: { criar: () => new PadraoCastRanged(), folha: "bubble" },
  flamethrower: { criar: () => new PadraoCastRanged(), opts: { jato: true }, folha: "flamethrower" },
  waterGun: { criar: () => new PadraoPistola(), folha: "waterGun" },
  swift: { criar: () => new PadraoSwift(), folha: "swift" },
  gust: { criar: () => new PadraoCastRanged(), folha: "gust" },
  wingAttack: { criar: () => new PadraoCastRanged(), folha: "gust" },
  growl: { criar: () => new PadraoStatus(), opts: { variante: "growl", alcance: 7 } },
  tailWhip: { criar: () => new PadraoStatus(), opts: { variante: "tail", alcance: 5.5 } },
  poisonPowder: { criar: () => new PadraoStatus(), opts: { variante: "poison", alcance: 5 } },
  sleepPowder: { criar: () => new PadraoStatus(), opts: { variante: "sleep", alcance: 5 } },
  stunSpore: { criar: () => new PadraoStatus(), opts: { variante: "paralysis", alcance: 5 } },
  spore: { criar: () => new PadraoStatus(), opts: { variante: "sleep", alcance: 5 } },
  thunderWave: {
    criar: () => new PadraoThunderWave(),
    opts: {
      cone: {
        alcance: 6,
        angulo: 52,
        raios: 7,
        textura: "Thunder_01",
        largura: 0.28,
        brilho: 0.18,
      },
    },
  },
  willOWisp: { criar: () => new PadraoStatus(), opts: { variante: "burn", alcance: 6 } },
  solarBeam: { criar: () => new PadraoFeixe(), opts: {} },
  hyperBeam: { criar: () => new PadraoFeixe(), opts: {} },
  waterPulse: { criar: () => new PadraoFeixe(), opts: {} },
  waterCannon: { criar: () => new PadraoFeixe(), opts: {} },
  iceBeam: { criar: () => new PadraoFeixe(), opts: {} },
  psybeam: { criar: () => new PadraoFeixe(), opts: {} },
  thunder: { criar: () => new PadraoRaio(), opts: {} },
  thunderShock: { criar: () => new PadraoRaio(), opts: {} },
  spark: { criar: () => new PadraoPistola(), folha: "spark" },
};

/**
 * @param {object} def
 * @returns {ReceitaFx | null}
 */
export function receitaFx(def) {
  if (!def?.key) return null;
  const ef = efeitoDe(def.key);
  if (ef) {
    const r = receitaDoEfeito(ef);
    if (r) {
      if (ef.feixe && (ef.kind === "feixe" || ef.kind === "raio")) {
        r.opts = { ...(r.opts || {}), feixe: ef.feixe, raio: ef.raio };
      }
      return r;
    }
  }
  if (POR_CHAVE[def.key]) return POR_CHAVE[def.key];
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
  const ef = efeitoDe(def?.key);
  if (ef?.folha) return idEfeito(def.key) || ef.id;
  if (ef?.visual) return idEfeito(def.key) || ef.id;
  const r = POR_CHAVE[def?.key];
  return r?.folha || "";
}
