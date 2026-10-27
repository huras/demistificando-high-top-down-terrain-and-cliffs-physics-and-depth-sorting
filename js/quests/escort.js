/**
 * NPC de resgate: espera no mato, segue o jogador, dispensa no Centro.
 */

import { alturaEm } from "../mundo/altura.js";
import { deLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { irParaNpc, garantirNpcLoco, alturaSpawnNpc } from "../npc/locomocao.js";
import { pessoaPorId, resolverNpc } from "../npc/catalogo/index.js";
import { t } from "../jogo/i18n.js";
import { cidadePorId } from "./cidades.js";
import { nomeNpcResgate } from "./textoMissao.js";
import { QUEST_HP_FRAC } from "./tipos.js";

const ESCORT = Object.freeze({
  preferred: 3.05,
  content: 3.85,
  catchUp: 6.2,
  snap: 13,
  sideBias: 0.42,
  maxSpeed: 5.4,
  crawlSpeed: 2.2,
});

const DISMISS_SPEED = 3.2;
const FADE_SEC = 0.5;
const DISMISS_TIMEOUT = 24;

/** @type {object|null} */
let questNpc = null;

export function obterQuestNpc() {
  return questNpc;
}

export function limparQuestNpc() {
  questNpc = null;
}

function sideSignFor(id) {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h & 1 ? 1 : -1;
}

/**
 * @param {object} posting
 * @param {{ x: number, y: number }} spawn
 * @param {boolean} escorting
 */
export function criarQuestNpc(posting, spawn, escorting = false) {
  const z0 = alturaSpawnNpc(spawn.x, spawn.y);
  const maxHp = 40;
  const hp = Math.max(1, Math.round(maxHp * QUEST_HP_FRAC));
  const idNpc = resolverNpc({
    peopleId: posting.peopleId,
    seed: posting.id,
  });
  const pessoa = pessoaPorId(posting.peopleId);
  const nome =
    posting.npcNome ||
    nomeNpcResgate({ ...posting, peopleId: idNpc.peopleId }) ||
    idNpc.nome;
  questNpc = {
    id: `quest-rescue:${posting.id}`,
    tipo: "quest-rescue",
    escopo: "quest",
    questId: posting.id,
    peopleId: posting.peopleId || idNpc.peopleId,
    coluna: idNpc.coluna ?? pessoa?.coluna ?? 0,
    nome,
    flavor: posting.flavor,
    cityId: posting.cityId,
    x: spawn.x,
    y: spawn.y,
    z: z0,
    elevacao: z0,
    facing: { x: 0, y: 1 },
    raio: 0.4,
    vx: 0,
    vy: 0,
    hp,
    maxHp,
    visivel: true,
    modo: escorting ? "seguir" : "parado",
    forceIdle: !escorting,
    escorting: !!escorting,
    dismissing: false,
    drawAlpha: 1,
    dismissTx: null,
    dismissTy: null,
    _dismissAge: 0,
    _sideSign: sideSignFor(posting.id),
    fala: linhasResgate(posting, false),
  };
  garantirNpcLoco(questNpc);
  return questNpc;
}

function linhasResgate(posting, escorting) {
  const name = nomeNpcResgate(posting);
  const city = posting.cityName || "";
  if (escorting) {
    return [t("quests.missingPerson.talkEscort", { name, city })];
  }
  const flavor = posting.flavor || "afraid";
  return [
    t(`quests.missingPerson.talk.${flavor}`, { name, city }),
    t("quests.missingPerson.talkFollow", { city }),
  ];
}

function trainerFacing(player) {
  const fx = Number(player?.facing?.x);
  const fy = Number(player?.facing?.y);
  const len = Math.hypot(
    Number.isFinite(fx) ? fx : 0,
    Number.isFinite(fy) ? fy : 0,
  );
  if (len > 1e-4) return { x: fx / len, y: fy / len };
  const dx = Number(player?.dirX) || 0;
  const dy = Number(player?.dirY) || 0;
  const dlen = Math.hypot(dx, dy);
  if (dlen > 1e-4) return { x: dx / dlen, y: dy / dlen };
  return { x: 0, y: 1 };
}

function trailSlot(npc, player, gap = ESCORT.preferred) {
  const f = trainerFacing(player);
  const side = npc._sideSign ?? 1;
  return {
    x: player.x - f.x * gap + -f.y * side * ESCORT.sideBias,
    y: player.y - f.y * gap + f.x * side * ESCORT.sideBias,
  };
}

function escortSpeed(dist) {
  if (dist <= ESCORT.content) return 0;
  if (dist >= ESCORT.catchUp) return ESCORT.maxSpeed;
  const u = (dist - ESCORT.content) / (ESCORT.catchUp - ESCORT.content);
  const ease = u * u * (3 - 2 * u);
  return ESCORT.crawlSpeed + (ESCORT.maxSpeed - ESCORT.crawlSpeed) * ease;
}

export function pontoDismiss(cityId) {
  const city = cidadePorId(cityId);
  if (!city) return null;
  return deLocalKanto(
    city.ax * AREA_KANTO + AREA_KANTO * 0.5,
    city.ay * AREA_KANTO + AREA_KANTO * 0.38,
  );
}

export function jogadorNaCidadeDaMissao(player, cityId) {
  if (!player || !cityId) return false;
  return zonaEhCidadeMissao(zonaNoMundo(player.x, player.y), cityId);
}

/**
 * Checa se zona da cidade casa com cityId do posting.
 */
export function zonaEhCidadeMissao(zona, cityId) {
  if (!zona || !cityId) return false;
  if (zona.tipo !== "cidade") return false;
  if (zona.id === cityId || zona.key === cityId) return true;
  // id no grafo costuma ser tipo-ax-ay; key fica no layout/def
  const def = cidadePorId(cityId);
  if (!def) return false;
  return (zona.ax | 0) === def.ax && (zona.ay | 0) === def.ay;
}

export function iniciarEscort(cityName = "") {
  if (!questNpc) return false;
  questNpc.escorting = true;
  questNpc.forceIdle = false;
  questNpc.modo = "seguir";
  questNpc.fala = [
    t("quests.missingPerson.talkEscort", {
      name: questNpc.nome,
      city: cityName,
    }),
  ];
  return true;
}

/**
 * Após completar: caminha ao centro e some.
 */
export function iniciarDismiss(cityId) {
  if (!questNpc) return;
  const alvo = pontoDismiss(cityId);
  questNpc.dismissing = true;
  questNpc.escorting = false;
  questNpc.forceIdle = false;
  questNpc._dismissAge = 0;
  if (alvo) {
    questNpc.dismissTx = alvo.x;
    questNpc.dismissTy = alvo.y;
  }
}

/**
 * @param {object} player
 * @param {number} dt
 * @param {{ onDismissDone?: () => void }} [hooks]
 */
export function tickQuestNpc(player, dt, hooks = {}) {
  const npc = questNpc;
  if (!npc || !player) return;

  if (npc.dismissing) {
    npc._dismissAge = (npc._dismissAge || 0) + dt;
    const tx = npc.dismissTx ?? player.x;
    const ty = npc.dismissTy ?? player.y;
    const chegou = irParaNpc(npc, tx, ty, dt, DISMISS_SPEED);
    const dist = Math.hypot(tx - npc.x, ty - npc.y);
    if (chegou || dist < 0.7 || npc._dismissAge > DISMISS_TIMEOUT) {
      npc.drawAlpha = Math.max(0, (npc.drawAlpha ?? 1) - dt / FADE_SEC);
      if (npc.drawAlpha <= 0.02 || npc._dismissAge > DISMISS_TIMEOUT + FADE_SEC) {
        questNpc = null;
        hooks.onDismissDone?.();
      }
    }
    return;
  }

  if (!npc.escorting || npc.forceIdle) {
    npc.vx = 0;
    npc.vy = 0;
    npc.andando = false;
    const h = alturaEm(npc.x | 0, npc.y | 0);
    if (h > 0) {
      npc.z = h;
      npc.elevacao = h;
    }
    return;
  }

  const slot = trailSlot(npc, player);
  const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
  if (dist > ESCORT.snap) {
    npc.x = slot.x;
    npc.y = slot.y;
    const h = alturaSpawnNpc(npc.x, npc.y);
    npc.z = h;
    npc.elevacao = h;
    npc.vx = 0;
    npc.vy = 0;
    return;
  }
  const speed = escortSpeed(dist);
  if (speed <= 0) {
    npc.vx = 0;
    npc.vy = 0;
    npc.andando = false;
    return;
  }
  irParaNpc(npc, slot.x, slot.y, dt, speed);
}

/** Inclui o NPC de quest na lista de visíveis se perto. */
export function anexarQuestNpcVisivel(lista, px, py, reachSq) {
  if (!questNpc || questNpc.drawAlpha < 0.05) return lista;
  const dx = questNpc.x - px;
  const dy = questNpc.y - py;
  if (dx * dx + dy * dy > reachSq) return lista;
  questNpc.visivel = true;
  lista.push(questNpc);
  return lista;
}
