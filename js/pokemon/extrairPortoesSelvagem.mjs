/**
 * Tabela nivelMin selvagem (paridade Pokemon AI minWildLevel).
 * Endpoint separado do catálogo pra não ficar preso em cache velho.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const VERSAO = 1;

let cache = null;
let pendente = null;

export function extrairPortoesSelvagem(raizRef) {
  if (cache?.versao === VERSAO) return Promise.resolve(cache);
  if (pendente) return pendente;
  pendente = montar(raizRef)
    .then((dados) => {
      cache = dados;
      pendente = null;
      return dados;
    })
    .catch((erro) => {
      pendente = null;
      throw erro;
    });
  return pendente;
}

async function importOpcional(arquivo) {
  try {
    return await import(pathToFileURL(arquivo).href);
  } catch {
    return null;
  }
}

async function montar(raizRef) {
  const base = path.join(raizRef, "src", "data", "pokemon");
  const [evoMod, overrideMod, gatesMod] = await Promise.all([
    importOpcional(path.join(base, "evolutions.js")),
    importOpcional(path.join(base, "levelEvolutionOverrides.js")),
    importOpcional(path.join(base, "wildSpawnGates.js")),
  ]);
  /** @type {Record<string, number>} */
  const min = {};
  const levelEvo = evoMod?.LEVEL_EVOLUTIONS || {};
  const overrides = overrideMod?.LEVEL_EVOLUTION_OVERRIDES || {};
  const held = overrideMod?.HELD_LEVEL_EVOLUTIONS || {};
  const branchParent = gatesMod?.WILD_BRANCH_PARENT || {};
  const branchFloor = Number(gatesMod?.WILD_BRANCH_MIN_LEVEL) || 20;

  const regras = [
    ...Object.values(levelEvo),
    ...Object.values(overrides),
    ...Object.values(held).flat(),
  ];
  for (let i = 0; i < regras.length; i++) {
    const row = regras[i];
    if (!row?.into || !row.level) continue;
    min[row.into] = Math.max(min[row.into] ?? 1, row.level | 0);
  }

  let mudou = true;
  while (mudou) {
    mudou = false;
    const juntos = { ...levelEvo, ...overrides };
    const de = Object.keys(juntos);
    for (let i = 0; i < de.length; i++) {
      const from = de[i];
      const row = juntos[from];
      if (!row?.into) continue;
      const precisa = Math.max(row.level | 0, min[from] ?? 1);
      if ((min[row.into] ?? 1) < precisa) {
        min[row.into] = precisa;
        mudou = true;
      }
    }
  }

  const visitando = new Set();
  function resolver(chave) {
    if (visitando.has(chave)) return min[chave] ?? 1;
    visitando.add(chave);
    let nivel = min[chave] ?? 1;
    const pai = branchParent[chave];
    if (pai) {
      nivel = Math.max(nivel, resolver(pai), branchFloor);
    }
    min[chave] = nivel;
    visitando.delete(chave);
    return nivel;
  }
  const ramos = Object.keys(branchParent);
  for (let i = 0; i < ramos.length; i++) resolver(ramos[i]);

  return { versao: VERSAO, nivelMin: min };
}
