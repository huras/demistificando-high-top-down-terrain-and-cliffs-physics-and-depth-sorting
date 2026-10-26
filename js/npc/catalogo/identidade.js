/**
 * Sexo, perfil de andar, nomes e peopleId procedural.
 * Paridade Pokemon AI (`npcIdentity.js`): nome SEMPRE coerente com o gênero do sprite.
 */
import { hashPeopleSeed, mulberry32, pickIndex } from "../rng.js";
import {
  falasDoc,
  generoDe,
  idsCivis,
  nomesDoc,
  pessoaPorId,
  walkAutoradoDe,
} from "./carregar.js";

export const PERFIL_ANDAR = Object.freeze({
  STILL: "still",
  CHILD: "child",
  ADULT: "adult",
  ELDER: "elder",
});

/** Marcadores inequívocos — vencem catálogo autorado errado (ex.: battle-girl:male). */
const CLEAR_FEMALE_RE =
  /(?:^|[\s_-])(?:girl|woman|lady|lass|maid|beauty|nurse|maiden|aunt|female|socialite|kimono|aroma|twin)(?:$|[\s_-])|-f(?:$|[\s_-])|picnicker-f|cyclist-f|school-kid-f|clerk-f|shopkeeper-f|swimmer-f|skier-f|teacher-f|pokefan-f|bug-maniac-f|battle-girl|apron-girl|rich-girl|young-woman|old-woman|beach-girl|winter-girl|noblewoman|pt-girl|pt-woman|pt-beauty|pt-maid|pt-lass|pt-nurse|pt-twin/i;

const CLEAR_MALE_RE =
  /(?:^|[\s_-])(?:boy|man|male|gentleman|dad|father|youngster|hiker|biker|worker|farmer|engineer|carpenter|fisherman|sailor|scientist|clown|nobleman|police|black-belt|bug-catcher)(?:$|[\s_-])|-m(?:$|[\s_-])|cyclist-m|picnicker-m|clerk-m|shopkeeper-m|swimmer-m|skier-m|school-kid-m|farmer-m|bug-maniac-m|pokefan-m|old-man|beach-boy|winter-boy|overalls-kid|rich-kid|pt-boy|pt-man|pt-youngster|pt-hiker|pt-gentleman/i;

const FEMALE_HINT_RE =
  /\b(woman|girl|maid|lass|beauty|lady|female|mom|nurse|kimono|socialite|maiden|noblewoman|aroma)\b|picnicker-f|cyclist-f|school-kid-f|-f\b|pt-girl|pt-woman|pt-beauty|pt-maid|beach girl|winter-girl|shopkeeper-f|bug-maniac-f|pokefan-f|rich-old-woman|apron-girl|rich-girl|swimmer-f|skier-f|clerk-f|battle girl|young woman|old woman/i;

const MALE_HINT_RE =
  /\b(man|boy|male|gentleman|dad|father|youngster|hiker|biker|worker|farmer|engineer|carpenter|fisherman|sailor|scientist|clown|nobleman)\b|cyclist-m|school-kid-m|pt-man|pt-boy|pt-youngster|pt-gentleman|pt-hiker|pt-fisherman|pt-sailor|pt-scientist|pt-engineer|pt-carpenter|pt-biker|pt-clown|pt-cameraman|pt-nobleman|pt-police|pt-farmer-m|pt-cyclist-m|pt-picnicker-m|bug-catcher|black-belt|spiky-hair|rich-old-man|overalls-kid|old man|beach boy|winter-boy|clerk-m|swimmer-m|skier-m|rich-kid/i;

const STILL_ID_RE =
  /^(jenny|red|blue|leaf|oak|pt-prof-oak|pt-prof-rowan|pt-nurse|pt-clerk|pt-shopkeeper|pt-police)\b|jenny/i;
const STILL_HINT_RE =
  /\b(nurse|clerk|shopkeeper|police|officer|jenny|professor|oak|rowan)\b/i;
const ELDER_HINT_RE =
  /\bold(?:[\s-]?man|[\s-]?woman)?\b|rich-old|rich[\s-]aunt|\b(grandma|grandpa|elder|elderly)\b/i;
const CHILD_HINT_RE =
  /\b(kid|boy|girl|twin|youngster|little)\b|school[\s-]kid|overalls[\s-]kid|nerdy[\s-]kid|rich[\s-]kid|beach[\s-]boy|beach[\s-]girl|winter[\s-]boy|winter[\s-]girl/i;

function haystack(peopleId) {
  const p = pessoaPorId(peopleId);
  return `${peopleId || ""} ${p?.nome || p?.label || ""}`.replace(/[-_]+/g, " ");
}

/**
 * Gênero efetivo do sprite.
 * Ordem (paridade AI + correção de catálogo podre):
 * 1) marcador inequívoco no id/label
 * 2) people-genders.json
 * 3) gender no catálogo bake
 * 4) heurística fraca
 */
export function inferirSexo(peopleId) {
  if (!peopleId) return "neutral";
  const hay = haystack(peopleId);
  const clearF = CLEAR_FEMALE_RE.test(peopleId) || CLEAR_FEMALE_RE.test(hay);
  const clearM = CLEAR_MALE_RE.test(peopleId) || CLEAR_MALE_RE.test(hay);
  if (clearF && !clearM) return "female";
  if (clearM && !clearF) return "male";
  if (clearF && clearM) {
    if (/-f\b|girl|woman|lady|lass|maid|nurse/i.test(peopleId)) return "female";
    if (/-m\b|boy|(?:^|-)man(?:$|-)|gentleman|youngster/i.test(peopleId)) {
      return "male";
    }
  }

  const authored = generoDe(peopleId);
  if (authored === "male" || authored === "female") return authored;

  const pessoa = pessoaPorId(peopleId);
  const catalog = pessoa?.sexo || pessoa?.gender || null;
  if (catalog === "male" || catalog === "female") return catalog;

  if (FEMALE_HINT_RE.test(hay)) return "female";
  if (MALE_HINT_RE.test(hay)) return "male";
  return "neutral";
}

export function inferirPerfilAndar(peopleId, opts = {}) {
  const authored = walkAutoradoDe(peopleId);
  if (authored) return authored;
  if (opts.role === "officerJenny" || opts.forceStill) return PERFIL_ANDAR.STILL;
  if (peopleId && STILL_ID_RE.test(peopleId)) return PERFIL_ANDAR.STILL;
  const hay = haystack(peopleId);
  if (STILL_HINT_RE.test(hay)) return PERFIL_ANDAR.STILL;
  if (ELDER_HINT_RE.test(hay)) return PERFIL_ANDAR.ELDER;
  if (CHILD_HINT_RE.test(hay)) return PERFIL_ANDAR.CHILD;
  return PERFIL_ANDAR.ADULT;
}

export function escolherPeopleIdCivil(seed) {
  const pool = idsCivis();
  if (!pool.length) return "pt-youngster";
  const rng = mulberry32(hashPeopleSeed(seed));
  return pool[pickIndex(rng, pool.length)];
}

/** Pool de nomes estritamente pelo sexo — nunca mistura. */
export function poolNomesPorSexo(sexo) {
  const doc = nomesDoc();
  if (sexo === "male") {
    return doc.masculino?.length ? doc.masculino : doc.neutro || [];
  }
  if (sexo === "female") {
    return doc.feminino?.length ? doc.feminino : doc.neutro || [];
  }
  if (doc.neutro?.length) return doc.neutro;
  return ["Alex", "Sam", "Chris"];
}

export function nomeNpc(seed, sexo = "neutral") {
  const pool = poolNomesPorSexo(sexo);
  if (!pool.length) {
    if (sexo === "female") return "Ana";
    if (sexo === "male") return "Alex";
    return "Morador";
  }
  const rng = mulberry32(hashPeopleSeed(seed));
  return pool[pickIndex(rng, pool.length)];
}

export function nomeNpcUnico(peopleId, seedBase, usados) {
  const sexo = inferirSexo(peopleId);
  const pool = poolNomesPorSexo(sexo);
  const limite = Math.max(24, (pool.length || 1) * 3);
  for (let attempt = 0; attempt < limite; attempt++) {
    const nome = nomeNpc(`${peopleId}:${seedBase}:n${attempt}`, sexo);
    if (!usados?.has(nome)) return nome;
  }
  // Sufixo só se o pool esgotou — mantém coerência de gênero.
  const base = nomeNpc(`${peopleId}:${seedBase}:x`, sexo);
  let n = 2;
  while (usados?.has(`${base} ${n}`) && n < 99) n += 1;
  return `${base} ${n}`;
}

export function falaCivil(seed, tipo = "cumprimentos") {
  const doc = falasDoc();
  const pool = doc[tipo] || doc.cumprimentos || [];
  if (!pool.length) return "Olá!";
  const rng = mulberry32(hashPeopleSeed(seed));
  return pool[pickIndex(rng, pool.length)];
}

/**
 * Resolve identidade completa a partir de seed / peopleId autorado.
 * Nome sempre derivado do sexo do sprite (a menos que nomeFixo explícito).
 */
export function resolverNpc(opts = {}) {
  const seed = opts.seed ?? opts.id ?? "npc";
  const peopleId = opts.peopleId || escolherPeopleIdCivil(seed);
  const pessoa = pessoaPorId(peopleId);
  const sexo = inferirSexo(peopleId);
  const perfilAndar = inferirPerfilAndar(peopleId, opts);
  let nome = opts.nomeFixo || opts.nome || null;
  if (!nome) {
    nome = nomeNpc(`${seed}:nome`, sexo);
  }
  return {
    peopleId,
    nome,
    sexo,
    origem: pessoa?.origem || "platinum",
    pool: pessoa?.pool || "civilian",
    coluna: pessoa?.coluna ?? 36,
    perfilAndar,
    label: pessoa?.nome || peopleId,
  };
}
