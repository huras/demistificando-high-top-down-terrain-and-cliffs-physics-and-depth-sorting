/**
 * Força de carregamento (tier 1–3) por espécie + humano.
 */
import { especie, listarEspecies } from "../pokemon/dados.js";

export const FORCA_MIN = 1;
export const FORCA_MAX = 3;
export const FORCA_HUMANO = 1;

/** @type {Record<string, number> | null} */
let overrides = null;
/** @type {Promise<void> | null} */
let carga = null;

/**
 * @param {unknown} raw
 * @param {number} [fallback]
 */
export function normalizarForca(raw, fallback = FORCA_MIN) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(FORCA_MIN, Math.min(FORCA_MAX, n));
}

/**
 * @param {number} [cfg]
 */
export function forcaHumana(cfg = FORCA_HUMANO) {
  return normalizarForca(cfg, FORCA_HUMANO);
}

/**
 * Score usado na duração do canal de lift.
 * @param {number} tier
 * @param {number} [bodyH]
 */
export function poderForca(tier, bodyH = 1.2) {
  const t = normalizarForca(tier);
  const h = Math.max(0.4, Number(bodyH) || 1.2);
  return t * (0.85 + h * 0.12);
}

/**
 * @param {string} chave
 * @param {{ altura?: number, peso?: number } | null} [corpo]
 * @param {string[]} [tipos]
 */
/** Dexes lendários / tanks clássicos com Força cheia. */
const FORCA_MAX_DEX = new Set([
  143, 150, 151, 249, 250, 376, 382, 383, 384, 483, 484, 486, 487, 493,
]);

export function inferirForcaEspecie(chave, corpo = null, tipos = null) {
  const esp = (chave && especie(chave)) || null;
  // Catálogo pode vir em m ou em dm (ex.: 20 = 2.0 m).
  let altura = Number(corpo?.altura ?? esp?.altura);
  let peso = Number(corpo?.peso ?? esp?.peso);
  if (!Number.isFinite(altura) || altura <= 0) altura = 0.6;
  else if (altura > 10) altura *= 0.1;
  if (!Number.isFinite(peso) || peso <= 0) peso = 10;
  else if (peso > 1000) peso *= 0.1;

  const typeList = (tipos ?? esp?.tipos ?? []).map((t) => String(t).toLowerCase());
  let tier = 1;
  if (altura >= 2.0 || peso >= 120) tier = 3;
  else if (altura >= 1.15 || peso >= 40) tier = 2;

  const tem = (t) => typeList.includes(t);
  if (tem("fighting") || tem("ground")) tier = Math.min(FORCA_MAX, tier + 1);
  if (tem("rock") || tem("steel")) tier = Math.min(FORCA_MAX, tier + 1);

  const dex = Math.floor(Number(esp?.dex) || 0);
  if (FORCA_MAX_DEX.has(dex)) tier = FORCA_MAX;
  const chaveNorm = String(chave || esp?.key || "").toLowerCase();
  if (
    chaveNorm.includes("mewtwo") ||
    chaveNorm.includes("snorlax") ||
    chaveNorm.includes("regigigas") ||
    chaveNorm.includes("groudon") ||
    chaveNorm.includes("dialga") ||
    chaveNorm.includes("palkia")
  ) {
    tier = FORCA_MAX;
  }
  return tier;
}

/**
 * @param {number|string} dex
 */
export function forcaPorDex(dex) {
  const n = Math.floor(Number(dex));
  if (!Number.isFinite(n) || n <= 0) return FORCA_MIN;
  if (overrides) {
    const pad = String(n).padStart(3, "0");
    if (overrides[pad] != null) return normalizarForca(overrides[pad]);
    if (overrides[String(n)] != null) return normalizarForca(overrides[String(n)]);
  }
  const lista = listarEspecies();
  for (let i = 0; i < lista.length; i++) {
    const esp = lista[i];
    if ((esp?.dex | 0) === n) {
      const chave = esp.key || esp.id || esp.chave;
      return forcaPorEspecie(chave, esp);
    }
  }
  return FORCA_MIN;
}

/**
 * @param {string} chave
 * @param {object | null} [esp]
 */
export function forcaPorEspecie(chave, esp = null) {
  const key = String(chave || "");
  const keyLow = key.toLowerCase();
  if (overrides && key) {
    if (overrides[key] != null) return normalizarForca(overrides[key]);
    if (overrides[keyLow] != null) return normalizarForca(overrides[keyLow]);
  }
  const e = esp || especie(key);
  if (overrides && e?.dex != null) {
    const pad = String(e.dex | 0).padStart(3, "0");
    if (overrides[pad] != null) return normalizarForca(overrides[pad]);
    if (overrides[String(e.dex | 0)] != null) {
      return normalizarForca(overrides[String(e.dex | 0)]);
    }
  }
  if (!e) return inferirForcaEspecie(key);
  return inferirForcaEspecie(key, e, e.tipos);
}

/**
 * @param {object | null} carrier
 * @param {{ humanoTier?: number } | null} [cfg]
 */
export function forcaDoCarrier(carrier, cfg = null) {
  if (!carrier) return forcaHumana(cfg?.humanoTier);
  if (carrier._forcaTierOverride != null) {
    return normalizarForca(carrier._forcaTierOverride);
  }
  // Humano só se não tiver espécie de Pokémon (evita mon marcado por engano).
  const esp = carrier.especie;
  if (esp && (esp.key || esp.dex != null || esp.altura != null || esp.peso != null)) {
    const chave = esp.key || esp.id || esp.chave || carrier.speciesKey;
    if (chave) return forcaPorEspecie(String(chave), esp);
    if (esp.dex != null) return forcaPorDex(esp.dex);
    return inferirForcaEspecie("", esp, esp.tipos);
  }
  if (carrier.ehHumano || carrier.isPlayer || carrier.peopleId != null) {
    return forcaHumana(cfg?.humanoTier);
  }
  const dex = carrier.dex ?? carrier.cfg?.dex;
  if (dex != null) return forcaPorDex(dex);
  const chave = carrier.speciesKey || carrier.species || carrier.cfg?.key;
  if (chave) return forcaPorEspecie(chave);
  return forcaHumana(cfg?.humanoTier);
}

export async function carregarOverridesForca(url = "/assets/data/forca-especies.json") {
  if (carga) return carga;
  carga = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        overrides = {};
        return;
      }
      const json = await res.json();
      overrides = json && typeof json === "object" ? json : {};
    } catch {
      overrides = {};
    }
  })();
  return carga;
}
