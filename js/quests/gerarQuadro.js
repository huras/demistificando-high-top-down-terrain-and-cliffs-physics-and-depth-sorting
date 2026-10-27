/**
 * Gera avisos diários por cidade (resgate + entrega).
 */

import { idsCivis, nomeNpc, resolverNpc } from "../npc/catalogo/index.js";
import { listarCidadesQuadro } from "./cidades.js";
import {
  celulasResgate,
  escolherAreaResgate,
  distanciaArea,
} from "./locaisResgate.js";
import { npcsEntregaDaCidade, npcsOcupadosPorCidade } from "./npcsEntrega.js";
import {
  QUEST_TYPE,
  QUEST_BOARD_SLOTS,
  MISSING_PERSON_FLAVOR,
  DELIVERY_MATERIALS,
  TIER_MONEY,
  hashQuestId,
} from "./tipos.js";

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0;
    return s / 4294967296;
  };
}

function pick(rand, list) {
  if (!list?.length) return null;
  return list[Math.floor(rand() * list.length) % list.length];
}

function rewardFor(zone, seed, areaDistance = 1) {
  const base = TIER_MONEY[zone.tier] ?? TIER_MONEY.town;
  const dist = Math.max(1, areaDistance | 0);
  const berryReward = (seed & 1) === 1;
  return {
    money: base * dist,
    areaDistance: dist,
    rewardKind: berryReward ? "berry" : "medicine",
    rewardKey: berryReward ? "oran" : "potion",
  };
}

function deliveryAmount(zone, rand) {
  const base = zone.tier === "starter" ? 2 : zone.tier === "city" ? 4 : 3;
  return base + Math.floor(rand() * 4);
}

function peopleIdResgate(cityIndex, slot) {
  const pool = idsCivis();
  if (!pool.length) return "pt-youngster";
  return pool[(cityIndex * 7 + slot * 3) % pool.length];
}

function makeMissingPerson(zone, boardDay, slot, cityIndex, rand) {
  const id = `${zone.id}-d${boardDay}-m${slot}`;
  const seed = hashQuestId(id);
  const cells = celulasResgate(zone.id);
  const peopleId = peopleIdResgate(cityIndex, slot);
  const idNpc = resolverNpc({ peopleId, seed: id });
  const posting = {
    id,
    type: QUEST_TYPE.MISSING_PERSON,
    cityId: zone.id,
    cityName: zone.nome,
    cityAx: zone.ax,
    cityAy: zone.ay,
    peopleId,
    npcNome: idNpc.nome || nomeNpc(id, idNpc.sexo),
    flavor: MISSING_PERSON_FLAVOR[Math.floor(rand() * MISSING_PERSON_FLAVOR.length)],
    rescueLocation: "wild",
  };
  const area = escolherAreaResgate(posting, cells);
  if (area) {
    posting.targetAx = area.ax;
    posting.targetAy = area.ay;
  }
  const dist = distanciaArea(
    zone.ax,
    zone.ay,
    posting.targetAx ?? zone.ax,
    posting.targetAy ?? zone.ay,
  );
  Object.assign(posting, rewardFor(zone, seed, dist));
  return posting;
}

function makeDelivery(zone, boardDay, slot, npc, rand) {
  const id = `${zone.id}-d${boardDay}-p${slot}`;
  const seed = hashQuestId(id);
  const materialKey = pick(rand, DELIVERY_MATERIALS) ?? "bellLeaf";
  return {
    id,
    type: QUEST_TYPE.MATERIAL_DELIVERY,
    cityId: zone.id,
    cityName: zone.nome,
    cityAx: zone.ax,
    cityAy: zone.ay,
    npcId: npc.id,
    houseId: npc.houseId ?? null,
    peopleId: npc.peopleId ?? null,
    npcNome: npc.nome || null,
    materialKey,
    amount: deliveryAmount(zone, rand),
    ...rewardFor(zone, seed),
  };
}

/** Só resgate + entrega (sem capture/skill). */
function pickSlotTypes(slots, canDeliver, rand) {
  const types = [];
  let missingCount = 0;
  for (let i = 0; i < slots; i++) {
    const wantMissing =
      missingCount === 0 && (!canDeliver || rand() < (i === 0 ? 0.5 : 0.18));
    if (wantMissing) {
      types.push(QUEST_TYPE.MISSING_PERSON);
      missingCount++;
      continue;
    }
    if (canDeliver) types.push(QUEST_TYPE.MATERIAL_DELIVERY);
    else {
      types.push(QUEST_TYPE.MISSING_PERSON);
      missingCount++;
    }
  }
  if (missingCount === 0 && rand() < 0.35) {
    types[0] = QUEST_TYPE.MISSING_PERSON;
  }
  return types;
}

/**
 * @param {object} zone
 * @param {number} boardDay
 * @param {number} cityIndex
 * @param {Set<string>} [busy]
 */
export function gerarQuadroCidade(zone, boardDay, cityIndex, busy = new Set()) {
  const rand = mulberry(hashQuestId(`${zone.id}:${boardDay}`));
  const npcs = npcsEntregaDaCidade(zone.id).filter((n) => !busy.has(n.id));
  const canDeliver = npcs.length > 0;
  const types = pickSlotTypes(QUEST_BOARD_SLOTS, canDeliver, rand);
  const usedNpc = new Set();
  const postings = [];

  for (let slot = 0; slot < types.length; slot++) {
    if (types[slot] === QUEST_TYPE.MISSING_PERSON) {
      postings.push(makeMissingPerson(zone, boardDay, slot, cityIndex, rand));
      continue;
    }
    const pool = npcs.filter((n) => !usedNpc.has(n.id));
    const npc = pick(rand, pool);
    if (!npc) {
      postings.push(makeMissingPerson(zone, boardDay, slot, cityIndex, rand));
      continue;
    }
    usedNpc.add(npc.id);
    postings.push(makeDelivery(zone, boardDay, slot, npc, rand));
  }
  while (postings.length < QUEST_BOARD_SLOTS) {
    postings.push(
      makeMissingPerson(zone, boardDay, postings.length, cityIndex, rand),
    );
  }
  return postings;
}

/**
 * @param {number} boardDay
 * @param {object[]} taken
 */
export function gerarTodosQuadros(boardDay, taken = []) {
  const boards = {};
  const busyByCity = npcsOcupadosPorCidade(taken);
  const cities = listarCidadesQuadro();
  for (let i = 0; i < cities.length; i++) {
    const zone = cities[i];
    boards[zone.id] = gerarQuadroCidade(
      zone,
      boardDay,
      i,
      busyByCity.get(zone.id) ?? new Set(),
    );
  }
  return boards;
}
