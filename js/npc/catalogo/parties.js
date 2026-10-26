/**
 * Templates de party para viajantes — só dados (sem spawn de mon).
 */
import { hashStr, mulberry32, pickIndex } from "../rng.js";
import { docParties, templateIdPara, templatePorId } from "./carregar.js";

function pesosPara(entries) {
  const out = [];
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const w = Math.max(0, Number(e.w) || 0);
    total += w;
    out.push({ key: e.key, w, acumulado: total });
  }
  return { out, total };
}

function pickWeighted(rng, pesos) {
  if (!pesos.total) return pesos.out[0]?.key || null;
  const roll = rng() * pesos.total;
  for (let i = 0; i < pesos.out.length; i++) {
    if (roll < pesos.out[i].acumulado) return pesos.out[i].key;
  }
  return pesos.out[pesos.out.length - 1]?.key || null;
}

function tamanhoParty(rng, weights) {
  const entries = Object.entries(weights || {}).map(([k, w]) => ({
    key: k,
    w: Number(w) || 0,
  }));
  const pesos = pesosPara(entries);
  const raw = pickWeighted(rng, pesos);
  const n = Math.max(1, Math.min(6, Number(raw) || 1));
  return n;
}

/**
 * @param {string} peopleId
 * @param {string|number} seed
 * @param {{ nivelMin?: number, nivelMax?: number }} [opts]
 * @returns {{ especie: string, nivel: number }[]}
 */
export function sortearParty(peopleId, seed, opts = {}) {
  const templateId = templateIdPara(peopleId);
  const def = templateId ? templatePorId(templateId) : null;
  const rng = mulberry32(hashStr(`${peopleId}:${seed}:party`));
  const nivelMin = opts.nivelMin ?? 5;
  const nivelMax = opts.nivelMax ?? 12;

  if (!def) {
    return [
      {
        especie: "rattata",
        nivel: nivelMin + pickIndex(rng, Math.max(1, nivelMax - nivelMin + 1)),
      },
    ];
  }

  const size = tamanhoParty(rng, def.partySizeWeights);
  const pesos = pesosPara(def.species || []);
  const party = [];
  const usados = new Set();
  for (let i = 0; i < size; i++) {
    let key = pickWeighted(rng, pesos) || "rattata";
    let tries = 0;
    while (usados.has(key) && tries < 8) {
      key = pickWeighted(rng, pesos) || key;
      tries += 1;
    }
    usados.add(key);
    const nivel = nivelMin + pickIndex(rng, Math.max(1, nivelMax - nivelMin + 1));
    party.push({ especie: key, nivel });
  }
  return party;
}

export function rotuloTemplate(peopleId) {
  const id = templateIdPara(peopleId);
  if (!id) return null;
  return docParties().templates[id]?.label || id;
}
