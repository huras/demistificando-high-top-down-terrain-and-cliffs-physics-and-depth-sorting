/**
 * Sexo, perfil de andar, nomes e peopleId procedural.
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

const FEMALE_HINT_RE =
  /\b(woman|girl|maid|lass|beauty|lady|female|mom|nurse|kimono|socialite|maiden|noblewoman|aroma)\b|picnicker-f|cyclist-f|school-kid-f|-f\b|pt-girl|pt-woman|pt-beauty|pt-maid|beach girl|winter-girl|shopkeeper-f|bug-maniac-f|pokefan-f|rich-old-woman|apron-girl|rich-girl|swimmer-f|skier-f|clerk-f/i;
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
  return `${peopleId || ""} ${p?.nome || ""}`.replace(/[-_]+/g, " ");
}

export function inferirSexo(peopleId) {
  const authored = generoDe(peopleId);
  if (authored === "male" || authored === "female") return authored;
  const hay = haystack(peopleId);
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

export function nomeNpc(seed, sexo = "neutral") {
  const doc = nomesDoc();
  let pool = doc.neutro;
  if (sexo === "male" && doc.masculino.length) pool = doc.masculino;
  else if (sexo === "female" && doc.feminino.length) pool = doc.feminino;
  if (!pool.length) return "Morador";
  const rng = mulberry32(hashPeopleSeed(seed));
  return pool[pickIndex(rng, pool.length)];
}

export function nomeNpcUnico(peopleId, seedBase, usados) {
  const sexo = inferirSexo(peopleId);
  for (let attempt = 0; attempt < 24; attempt++) {
    const nome = nomeNpc(`${peopleId}:${seedBase}:n${attempt}`, sexo);
    if (!usados?.has(nome)) return nome;
  }
  return nomeNpc(`${peopleId}:${seedBase}`, sexo);
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
 */
export function resolverNpc(opts = {}) {
  const seed = opts.seed ?? opts.id ?? "npc";
  const peopleId = opts.peopleId || escolherPeopleIdCivil(seed);
  const pessoa = pessoaPorId(peopleId);
  const sexo = inferirSexo(peopleId);
  const perfilAndar = inferirPerfilAndar(peopleId, opts);
  const nome =
    opts.nome ||
    (opts.nomeFixo ? opts.nomeFixo : nomeNpc(`${seed}:nome`, sexo));
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
