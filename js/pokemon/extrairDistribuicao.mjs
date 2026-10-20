/**
 * Índice invertido bioma → espécies a partir do biomeDistribution do Pokemon AI.
 * Só roda no servidor — o browser recebe JSON.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

let cache = null;
let pendente = null;

export function extrairDistribuicao(raizRef) {
  if (cache) return Promise.resolve(cache);
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

async function montar(raizRef) {
  const arquivo = path.join(raizRef, "src", "data", "biomeDistribution.js");
  const mod = await import(pathToFileURL(arquivo).href);
  const tabela = mod.CASA_POR_ESPECIE || {};
  const porBioma = Object.create(null);

  function slot(id) {
    let s = porBioma[id];
    if (!s) {
      s = { casa: [], extras: [] };
      porBioma[id] = s;
    }
    return s;
  }

  const chaves = Object.keys(tabela);
  for (let i = 0; i < chaves.length; i++) {
    const key = chaves[i];
    const row = tabela[key];
    if (!Array.isArray(row) || !row.length) continue;
    const casa = row[0];
    if (casa) slot(casa).casa.push(key);
    for (let j = 1; j < row.length; j++) {
      const extra = row[j];
      if (!extra || extra === casa) continue;
      slot(extra).extras.push(key);
    }
  }

  return { porBioma };
}
