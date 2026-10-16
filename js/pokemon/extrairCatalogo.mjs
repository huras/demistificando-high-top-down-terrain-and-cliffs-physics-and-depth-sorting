/**
 * Monta o catálogo compacto a partir dos módulos do Pokemon AI.
 * Só roda no servidor — o browser recebe JSON.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

let cache = null;
let pendente = null;

export function extrairCatalogo(raizRef) {
  if (cache) return Promise.resolve(cache);
  if (pendente) return pendente;
  pendente = montar(raizRef)
    .then((cat) => {
      cache = cat;
      pendente = null;
      return cat;
    })
    .catch((erro) => {
      pendente = null;
      throw erro;
    });
  return pendente;
}

async function montar(raizRef) {
  const base = path.join(raizRef, "src", "data", "pokemon");
  const escalaMod = path.join(raizRef, "src", "sprites", "pmd", "pmdScale.js");
  const [especiesMod, golpesMod, pmdEscala] = await Promise.all([
    import(pathToFileURL(path.join(base, "index.js")).href),
    import(pathToFileURL(path.join(base, "moves.js")).href),
    import(pathToFileURL(escalaMod).href),
  ]);
  const escalaDe = pmdEscala.getPmdVisualScale;
  const offsetDe = pmdEscala.getPmdYOffset;

  const especies = {};
  const chaves = Object.keys(especiesMod.SPECIES);
  for (let i = 0; i < chaves.length; i++) {
    const sp = especiesMod.SPECIES[chaves[i]];
    if (!sp?.key || !sp.dex) continue;
    const stats = sp.baseStats || {};
    const learn = [];
    const lista = sp.learnset || [];
    for (let j = 0; j < lista.length; j++) {
      const passo = lista[j];
      if (!passo?.move) continue;
      learn.push([passo.level | 0, passo.move]);
    }
    especies[sp.key] = {
      key: sp.key,
      dex: sp.dex | 0,
      nome: sp.name || sp.key,
      tipos: Array.isArray(sp.types) ? sp.types.slice() : ["normal"],
      baseExp: sp.baseExp | 0 || 60,
      crescimento: sp.growthRate || "mediumSlow",
      hp: stats.hp | 0,
      atk: stats.atk | 0,
      def: stats.def | 0,
      spa: stats.spa | 0,
      spd: stats.spd | 0,
      spe: stats.spe | 0,
      captura: especiesMod.getSpeciesCatchRate(sp.key, 45),
      cor: sp.color || "#9ca3af",
      escala: numeroOu(escalaDe(sp.dex), 1),
      offsetY: numeroOu(offsetDe(sp.dex), 0),
      learnset: learn,
    };
  }

  const golpes = {};
  const brutos = golpesMod.GENERATED_MOVES || {};
  const nomes = Object.keys(brutos);
  for (let i = 0; i < nomes.length; i++) {
    const g = brutos[nomes[i]];
    if (!g?.key) continue;
    golpes[g.key] = {
      key: g.key,
      nome: g.name || g.key,
      forma: g.shape || "contact",
      categoria: g.category || "physical",
      tipo: g.type || "normal",
      poder: g.power | 0,
      acerto: Object.prototype.hasOwnProperty.call(g, "accuracy") ? g.accuracy : 100,
      pp: g.ppCost | 0 || 1,
      recarga: Number(g.cooldown) || 4,
      alcance: Number(g.range) || 1,
      vel: Number(g.projectileSpeed) || 14,
      raio: Number(g.projectileRadius) || 0.45,
    };
  }

  return { especies, golpes };
}

function numeroOu(valor, fallback) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}
