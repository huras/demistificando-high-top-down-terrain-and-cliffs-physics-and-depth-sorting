/**
 * Resolve a chave BGM a partir do estado do mundo (hub / santuário / bioma).
 */

import { biomaDominante } from "../../mundo/bioma/catalogo.js";
import {
  ehChaveBgmBiomaContexto,
  resolverChaveBgmBioma,
} from "./contextoBgm.js";

/** @type {Readonly<Record<string, string>>} */
export const PAPEL_HUB_BGM = Object.freeze({
  centro: "hub.center",
  loja: "hub.mart",
  lab: "hub.lab",
  ginasio: "hub.gym",
});

const HOLD_BIOMA_SEC = 3;
const HOLD_PERIODO_SEC = 1;

/** @type {string | null} */
let chaveCommitada = null;
/** @type {string | null} */
let chaveCandidata = null;
let holdRestante = 0;
/** @type {string | null} */
let biomaCommitado = null;

/**
 * @param {{ hasTrack?: (k: string) => boolean } | null} bgm
 * @param {string | null | undefined} key
 */
function seTem(bgm, key) {
  return !!(key && bgm?.hasTrack?.(key));
}

/**
 * Chave imediata (sem debounce) a partir do estado atual.
 * @param {object} ctx
 * @param {{ hasTrack?: (k: string) => boolean }} ctx.bgm
 * @param {number} [ctx.x]
 * @param {number} [ctx.y]
 * @param {{ papel?: string, element?: string, sala?: { kind?: string } } | null} [ctx.interior]
 * @param {{ tipo?: string } | null} [ctx.zona]
 * @param {number} [ctx.hora]
 * @param {object | null} [ctx.climaJogo]
 * @returns {string | null}
 */
export function chaveBgmImediata({
  bgm,
  x = 0,
  y = 0,
  interior = null,
  zona = null,
  hora = 12,
  climaJogo = null,
} = {}) {
  if (!bgm?.hasTrack) return null;

  if (interior) {
    const papel = String(interior.papel || "").toLowerCase();

    if (papel === "santuario" || papel === "shrine") {
      const el = String(interior.element || "normal").toLowerCase();
      const tipada = `shrine.${el}`;
      if (seTem(bgm, tipada)) return tipada;
      if (seTem(bgm, "shrine.motif-base")) return "shrine.motif-base";
      return null;
    }

    const hubKey = PAPEL_HUB_BGM[papel];
    if (hubKey && seTem(bgm, hubKey)) return hubKey;

    // Legado 2D: sala.kind
    const kind = String(interior.sala?.kind || "").toLowerCase();
    if (kind === "heal" && seTem(bgm, "hub.center")) return "hub.center";
    if (kind === "mart" && seTem(bgm, "hub.mart")) return "hub.mart";
    if (kind === "lab" && seTem(bgm, "hub.lab")) return "hub.lab";
    if (kind === "gym" && seTem(bgm, "hub.gym")) return "hub.gym";

    // Casa genérica / interior sem tema → silêncio
    if (papel === "casa" || kind === "house" || papel) return null;
  }

  const biomaId = biomaDominante?.(x, y)?.id || null;
  if (biomaId) {
    const key = resolverChaveBgmBioma({
      bgm,
      biomeId: biomaId,
      hora,
      clima: climaJogo,
    });
    if (key) return key;
  }

  if (zona?.tipo === "cidade" && seTem(bgm, "cidade")) return "cidade";

  // Rede de segurança: light-grass com período/clima, depois campo genérico
  const fallback = resolverChaveBgmBioma({
    bgm,
    biomeId: "light-grass",
    hora,
    clima: climaJogo,
  });
  if (fallback) return fallback;
  if (seTem(bgm, "campo")) return "campo";
  return null;
}

function extrairBiomaDaChave(key) {
  if (!key || !ehChaveBgmBiomaContexto(key)) return null;
  const i = key.indexOf(".");
  return i > 0 ? key.slice(0, i) : null;
}

function ehChaveImediata(key) {
  if (!key) return true; // silêncio (casa) aplica na hora
  return (
    key.startsWith("hub.") ||
    key.startsWith("shrine.") ||
    key.startsWith("cave.") ||
    key.startsWith("battle.") ||
    key.startsWith("meet.") ||
    key.startsWith("rest.") ||
    key.startsWith("dungeon.") ||
    key.startsWith("opening.")
  );
}

/**
 * Resolve com hold debounce outdoor (bioma 3s / período 1s).
 * Chamar a cada frame; passa `dt` para o timer.
 *
 * @param {object} ctx — mesmos campos de chaveBgmImediata + `dt`
 * @returns {string | null}
 */
export function resolverChaveBgm(ctx = {}) {
  const dt = Math.max(0, Number(ctx.dt) || 0);
  const desejada = chaveBgmImediata(ctx);

  if (ehChaveImediata(desejada)) {
    chaveCommitada = desejada;
    chaveCandidata = null;
    holdRestante = 0;
    biomaCommitado = null;
    return chaveCommitada;
  }

  const biomaNovo = extrairBiomaDaChave(desejada);
  const biomaAntigo =
    biomaCommitado ?? extrairBiomaDaChave(chaveCommitada);

  // Primeira outdoor ou ainda sem commit
  if (chaveCommitada == null || ehChaveImediata(chaveCommitada)) {
    chaveCommitada = desejada;
    biomaCommitado = biomaNovo;
    chaveCandidata = null;
    holdRestante = 0;
    return chaveCommitada;
  }

  if (desejada === chaveCommitada) {
    chaveCandidata = null;
    holdRestante = 0;
    return chaveCommitada;
  }

  const mudouBioma =
    biomaNovo && biomaAntigo && biomaNovo !== biomaAntigo;
  const holdAlvo = mudouBioma ? HOLD_BIOMA_SEC : HOLD_PERIODO_SEC;

  if (desejada !== chaveCandidata) {
    chaveCandidata = desejada;
    holdRestante = holdAlvo;
  } else {
    holdRestante -= dt;
  }

  if (holdRestante <= 0) {
    chaveCommitada = chaveCandidata;
    biomaCommitado = extrairBiomaDaChave(chaveCommitada);
    chaveCandidata = null;
    holdRestante = 0;
  }

  return chaveCommitada;
}

/** Reseta hold (útil em testes / reload). */
export function resetarResolverBgm() {
  chaveCommitada = null;
  chaveCandidata = null;
  holdRestante = 0;
  biomaCommitado = null;
}
