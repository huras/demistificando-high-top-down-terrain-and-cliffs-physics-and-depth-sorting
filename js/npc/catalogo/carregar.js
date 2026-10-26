/**
 * Catálogo Platinum + metadados (sexo, walk, party, nomes).
 * peopleId é a chave universal.
 */

export const FOLHA_PLATINUM =
  "/assets/people/logic 2/DS _ DSi - Pokemon Platinum - Non-Playable Characters - NPCs.png";

const BASE = "/assets/people";

/** @type {Map<string, object>} */
const porId = new Map();
/** @type {string[]} */
let civisIds = [];
/** @type {Map<string, "male"|"female">} */
const generos = new Map();
/** @type {Map<string, string>} */
const walks = new Map();
/** @type {Set<string>} */
let elegiveis = new Set();
/** @type {{ templates: Record<string, object>, byPeopleId: Record<string, string> }} */
let parties = { templates: {}, byPeopleId: {} };
/** @type {{ masculino: string[], feminino: string[], neutro: string[] }} */
let nomes = { masculino: [], feminino: [], neutro: [] };
/** @type {{ cumprimentos: string[], casa: string[], viajante: string[] }} */
let falas = { cumprimentos: [], casa: [], viajante: [] };
/** @type {Map<string, string>} */
const papeis = new Map();

let pronto = false;
let carregando = null;

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao carregar ${url}`);
  return res.json();
}

export function catalogoPronto() {
  return pronto;
}

export function pessoaPorId(peopleId) {
  if (!peopleId) return null;
  return porId.get(peopleId) || null;
}

export function idsCivis() {
  return civisIds.slice();
}

export function generoDe(peopleId) {
  return generos.get(peopleId) || null;
}

export function walkAutoradoDe(peopleId) {
  return walks.get(peopleId) || null;
}

export function idsElegiveisViajante() {
  return [...elegiveis];
}

export function ehElegivelViajante(peopleId) {
  return !!peopleId && elegiveis.has(peopleId);
}

export function docParties() {
  return parties;
}

export function templateIdPara(peopleId) {
  return parties.byPeopleId[peopleId] || null;
}

export function templatePorId(templateId) {
  return parties.templates[templateId] || null;
}

export function nomesDoc() {
  return nomes;
}

export function falasDoc() {
  return falas;
}

export function papelDe(peopleId) {
  return papeis.get(peopleId) || null;
}

export async function carregarCatalogoNpc() {
  if (pronto) return true;
  if (carregando) return carregando;
  carregando = (async () => {
    const [
      platinum,
      genders,
      walkDoc,
      roles,
      elig,
      partyDoc,
      nomesDocRaw,
      falasDocRaw,
    ] = await Promise.all([
      fetchJson(`${BASE}/platinum-npcs-catalog.json`),
      fetchJson(`${BASE}/people-genders.json`).catch(() => ({ byPeopleId: {} })),
      fetchJson(`${BASE}/people-walk-profiles.json`).catch(() => ({ byPeopleId: {} })),
      fetchJson(`${BASE}/role-assignments.json`).catch(() => ({})),
      fetchJson(`${BASE}/overworld-trainer-eligibility.json`).catch(() => ({ ids: [] })),
      fetchJson(`${BASE}/overworld-trainer-parties.json`).catch(() => ({
        templates: {},
        byPeopleId: {},
      })),
      fetchJson(`${BASE}/nomes.json`).catch(() => null),
      fetchJson(`${BASE}/falas-civis.json`).catch(() => null),
    ]);

    porId.clear();
    civisIds = [];
    const chars = platinum.characters || [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (!c?.id) continue;
      const pessoa = {
        id: c.id,
        nome: c.name || c.id,
        label: c.name || c.id,
        coluna: c.column | 0,
        pool: c.pool || "civilian",
        origem: "platinum",
        sheetCols: platinum.sheetCols | 17,
        frameW: platinum.frameW | 32,
        frameH: platinum.frameH | 32,
        framesPerChar: platinum.framesPerChar | 9,
        gender: null,
        sexo: null,
      };
      porId.set(c.id, pessoa);
      if (pessoa.pool === "civilian") civisIds.push(c.id);
    }

    generos.clear();
    const byG = genders.byPeopleId || {};
    for (const id of Object.keys(byG)) {
      const g = byG[id];
      if (g === "male" || g === "female") generos.set(id, g);
    }
    // Espelha gênero no pack (paridade Pokemon AI syncPeopleGendersOntoPack).
    for (const [id, pessoa] of porId) {
      const g = generos.get(id);
      if (g) {
        pessoa.gender = g;
        pessoa.sexo = g;
      }
      Object.freeze(pessoa);
    }

    walks.clear();
    const byW = walkDoc.byPeopleId || {};
    for (const id of Object.keys(byW)) {
      const p = byW[id];
      if (p === "still" || p === "child" || p === "adult" || p === "elder") {
        walks.set(id, p);
      }
    }

    papeis.clear();
    if (roles && typeof roles === "object") {
      for (const [papel, id] of Object.entries(roles)) {
        if (typeof id === "string") papeis.set(id, papel);
      }
    }

    elegiveis = new Set(
      (elig.ids || []).filter((id) => typeof id === "string" && porId.has(id)),
    );
    if (!elegiveis.size) {
      for (const id of civisIds) {
        if (partyDoc.byPeopleId?.[id]) elegiveis.add(id);
      }
    }

    parties = {
      templates: partyDoc.templates || {},
      byPeopleId: partyDoc.byPeopleId || {},
    };

    if (nomesDocRaw) {
      nomes = {
        masculino: nomesDocRaw.masculino || [],
        feminino: nomesDocRaw.feminino || [],
        neutro: nomesDocRaw.neutro || [],
      };
    }
    if (falasDocRaw) {
      falas = {
        cumprimentos: falasDocRaw.cumprimentos || [],
        casa: falasDocRaw.casa || [],
        viajante: falasDocRaw.viajante || [],
      };
    }

    pronto = true;
    return true;
  })();
  try {
    return await carregando;
  } finally {
    carregando = null;
  }
}
