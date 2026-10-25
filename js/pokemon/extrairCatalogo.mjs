/**
 * Monta o catálogo compacto a partir dos módulos do Pokemon AI.
 * Só roda no servidor — o browser recebe JSON.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extrairPortoesSelvagem } from "./extrairPortoesSelvagem.mjs";

/** Bumpe quando o schema do JSON muda (ex.: nivelMin). */
const VERSAO_SCHEMA = 2;

let cache = null;
let cacheVersao = 0;
let pendente = null;

export function extrairCatalogo(raizRef) {
  if (cache && cacheVersao === VERSAO_SCHEMA) return Promise.resolve(cache);
  if (pendente) return pendente;
  pendente = montar(raizRef)
    .then((cat) => {
      cache = cat;
      cacheVersao = VERSAO_SCHEMA;
      pendente = null;
      return cat;
    })
    .catch((erro) => {
      pendente = null;
      throw erro;
    });
  return pendente;
}

/**
 * Import opcional — não quebra o catálogo se o módulo faltar.
 * @param {string} arquivo
 */
async function importOpcional(arquivo) {
  try {
    return await import(pathToFileURL(arquivo).href);
  } catch {
    return null;
  }
}

async function montar(raizRef) {
  const base = path.join(raizRef, "src", "data", "pokemon");
  const escalaMod = path.join(raizRef, "src", "sprites", "pmd", "pmdScale.js");
  const [especiesMod, golpesMod, pmdEscala, bodyMod, metaMod, flavorMod, portoes] =
    await Promise.all([
      import(pathToFileURL(path.join(base, "index.js")).href),
      import(pathToFileURL(path.join(base, "moves.js")).href),
      import(pathToFileURL(escalaMod).href),
      importOpcional(path.join(base, "bodyMetrics.js")),
      importOpcional(path.join(base, "speciesDexMeta.js")),
      importOpcional(path.join(base, "speciesFlavor.js")),
      extrairPortoesSelvagem(raizRef),
    ]);
  const nivelMin = portoes?.nivelMin || {};
  const escalaDe = pmdEscala.getPmdVisualScale;
  const offsetDe = pmdEscala.getPmdYOffset;
  const corpoDe = bodyMod?.getSpeciesBody || null;
  const metaDe = metaMod?.getSpeciesDexMeta || null;
  const flavorDe = flavorMod?.getSpeciesFlavor || null;

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

    const item = {
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
      nivelMin: Math.max(1, nivelMin[sp.key] | 0 || 1),
      learnset: learn,
    };

    // Campos opcionais (body / dex meta / flavor) — try/catch já no import
    try {
      const corpo = corpoDe?.(sp.key);
      if (corpo) {
        if (Number.isFinite(corpo.heightM)) item.altura = Number(corpo.heightM);
        if (Number.isFinite(corpo.weightKg)) item.peso = Number(corpo.weightKg);
      }
    } catch {
      /* bodyMetrics ausente ou inválido */
    }

    try {
      const meta = metaDe?.(sp.key);
      if (meta) {
        if (Array.isArray(meta.abilities)) {
          item.habilidades = meta.abilities.map((a) =>
            typeof a === "string"
              ? a
              : { key: a.key, hidden: !!a.hidden },
          );
        }
        if (Array.isArray(meta.eggGroups)) {
          item.gruposOvo = meta.eggGroups.slice();
        }
        if (Number.isFinite(meta.genderRate)) item.genero = Number(meta.genderRate);
        if (Number.isFinite(meta.hatchCounter)) item.ciclosOvo = Number(meta.hatchCounter);
        if (Number.isFinite(meta.catchRate)) item.captura = Number(meta.catchRate);
        if (meta.growthRate) item.crescimento = meta.growthRate;
        if (Number.isFinite(meta.baseExp)) item.baseExp = Number(meta.baseExp);
      }
    } catch {
      /* speciesDexMeta ausente ou inválido */
    }

    try {
      // pt não existe no PokeAPI — tenta en (e ja se o locale do flavor pedir)
      const fl =
        flavorDe?.(sp.key, "en") ||
        flavorDe?.(sp.key, "ja") ||
        flavorDe?.(sp.key);
      if (fl) {
        if (fl.flavor) item.flavor = fl.flavor;
        if (fl.genus) item.categoria = fl.genus;
      }
    } catch {
      /* speciesFlavor ausente ou inválido */
    }

    especies[sp.key] = item;
  }

  const golpes = {};
  const brutos = golpesMod.GENERATED_MOVES || {};
  const nomes = Object.keys(brutos);
  for (let i = 0; i < nomes.length; i++) {
    const g = brutos[nomes[i]];
    if (!g?.key) continue;
    const item = {
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
    if (g.debuff?.stat) {
      item.debuff = {
        stat: g.debuff.stat,
        delta: g.debuff.delta | 0,
        target: g.debuff.target || "foe",
      };
    }
    if (g.ailment?.id) {
      item.ailment = {
        id: g.ailment.id,
        chance: Number.isFinite(g.ailment.chance) ? g.ailment.chance : 100,
      };
    }
    golpes[g.key] = item;
  }

  return { especies, golpes };
}

function numeroOu(valor, fallback) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}
