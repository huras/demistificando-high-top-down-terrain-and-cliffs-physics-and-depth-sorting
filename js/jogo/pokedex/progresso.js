/** Progresso Pokédex: unseen / seen / caught. */

import { estado, avisar, registrarEspecie } from "../estado.js";
import { listarEspecies } from "../../pokemon/dados.js";
import { listaParty } from "../../pokemon/party.js";

const GEN_RANGES = Object.freeze([
  Object.freeze({ gen: 1, min: 1, max: 151 }),
  Object.freeze({ gen: 2, min: 152, max: 251 }),
  Object.freeze({ gen: 3, min: 252, max: 386 }),
  Object.freeze({ gen: 4, min: 387, max: 493 }),
]);

function mapaSeen() {
  if (!estado.vistosMap) {
    estado.vistosMap = Object.create(null);
    for (const key of estado.vistos || []) estado.vistosMap[key] = true;
  }
  return estado.vistosMap;
}

function mapaCaught() {
  if (!estado.capturadosMap) estado.capturadosMap = Object.create(null);
  return estado.capturadosMap;
}

export function getSpeciesDexStatus(speciesKey) {
  const key = String(speciesKey || "");
  if (!key) return "unseen";
  if ((mapaCaught()[key] | 0) > 0) return "caught";
  if (mapaSeen()[key]) return "seen";
  return "unseen";
}

export function markSpeciesSeen(speciesKey) {
  const key = String(speciesKey || "");
  if (!key) return false;
  const seen = mapaSeen();
  if (seen[key]) return false;
  seen[key] = true;
  if (!estado.vistos.includes(key)) estado.vistos.push(key);
  // sem avisar() — hot path (tick). Dex HUD dá refresh ao abrir.
  return true;
}

export function markSpeciesCaught(speciesKey) {
  const key = String(speciesKey || "");
  if (!key) return false;
  let mudou = false;
  const caught = mapaCaught();
  if (!caught[key]) {
    caught[key] = 1;
    mudou = true;
  }
  if (markSpeciesSeen(key)) mudou = true;
  if (mudou) {
    registrarEspecie(key);
    avisar();
  }
  return mudou;
}

export function progressoDex() {
  const especies = listarEspecies();
  let caught = 0;
  let seenOnly = 0;
  const total = especies.length;
  for (let i = 0; i < total; i++) {
    const st = getSpeciesDexStatus(especies[i].key);
    if (st === "caught") caught += 1;
    else if (st === "seen") seenOnly += 1;
  }
  return {
    caught,
    seenOnly,
    unseen: Math.max(0, total - caught - seenOnly),
    total,
  };
}

export function progressoPorGeracao() {
  const especies = listarEspecies();
  const porDex = new Map();
  for (const esp of especies) porDex.set(esp.dex | 0, esp.key);
  return GEN_RANGES.map(({ gen, min, max }) => {
    let caught = 0;
    let seen = 0;
    let total = 0;
    for (let d = min; d <= max; d++) {
      const key = porDex.get(d);
      if (!key) continue;
      total += 1;
      const st = getSpeciesDexStatus(key);
      if (st === "caught") {
        caught += 1;
        seen += 1;
      } else if (st === "seen") seen += 1;
    }
    return {
      gen,
      caught,
      seen,
      total,
      percent: total ? Math.round((caught / total) * 100) : 0,
    };
  });
}

export function bootstrapDexDaParty() {
  for (const ator of listaParty()) {
    const key = ator?.especie?.key;
    if (key) markSpeciesCaught(key);
  }
}

export function serializarDex() {
  return {
    vistos: estado.vistos.slice(),
    capturados: { ...mapaCaught() },
  };
}

export function hidratarDex(bruto) {
  if (!bruto) return;
  if (Array.isArray(bruto.vistos)) {
    estado.vistos = bruto.vistos.slice();
    estado.vistosMap = Object.create(null);
    for (const key of estado.vistos) estado.vistosMap[key] = true;
  }
  if (bruto.capturados && typeof bruto.capturados === "object") {
    estado.capturadosMap = Object.create(null);
    for (const [k, v] of Object.entries(bruto.capturados)) {
      if (v) estado.capturadosMap[k] = v | 0 || 1;
    }
  }
}
