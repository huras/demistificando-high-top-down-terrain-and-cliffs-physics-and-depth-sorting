/**
 * Runtime do quadro: accept/abandon/complete, refresh, escort, entrega.
 */

import { estado, avisar, darItem, gastar, contar } from "../jogo/estado.js";
import { t } from "../jogo/i18n.js";
import { nomeDoItem } from "../jogo/nomeItem.js";
import { TIPO_ITEM } from "../wild/catalogo.js";
import { paraLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { gerarTodosQuadros, gerarQuadroCidade } from "./gerarQuadro.js";
import { listarCidadesQuadro, cidadePorId } from "./cidades.js";
import { sincronizarDiaQuadro } from "./relogio.js";
import { escolherAreaResgate, escolherTileResgate } from "./locaisResgate.js";
import { npcCasaComEntrega, npcsEntregaDaCidade } from "./npcsEntrega.js";
import {
  criarQuestNpc,
  obterQuestNpc,
  limparQuestNpc,
  iniciarEscort,
  iniciarDismiss,
  tickQuestNpc,
  zonaEhCidadeMissao,
  jogadorNaCidadeDaMissao,
} from "./escort.js";
import { nomeItemRecompensa, nomeNpcEntrega } from "./textoMissao.js";
import {
  QUEST_TYPE,
  QUEST_STATUS,
  QUEST_COMPLETED_CAP,
  createQuestState,
  normalizeQuestState,
} from "./tipos.js";

function qs() {
  if (!estado.questState) estado.questState = createQuestState();
  return estado.questState;
}

function notificar() {
  avisar();
}

export function garantirQuestState(raw) {
  estado.questState = normalizeQuestState(raw ?? estado.questState);
  return estado.questState;
}

export function postagensDisponiveis(cityId) {
  if (!cityId) return [];
  return qs().boards[cityId] ?? [];
}

export function registrosTomados() {
  return qs().taken;
}

export function tomadosDaCidade(cityId) {
  return qs().taken.filter((rec) => rec.posting?.cityId === cityId);
}

export function postagensConcluidas(cityId = null) {
  const list = qs().completed;
  if (!cityId) return list;
  return list.filter((p) => p.cityId === cityId);
}

export function acharTomado(questId) {
  if (!questId) return null;
  return qs().taken.find((rec) => rec.posting?.id === questId) ?? null;
}

export function statusPostagem(posting) {
  if (!posting) return QUEST_STATUS.POSTED;
  const id = posting.id;
  if (qs().completed.some((p) => p.id === id)) return QUEST_STATUS.COMPLETED;
  const rec = acharTomado(id);
  if (!rec) return QUEST_STATUS.POSTED;
  if (rec.posting.type === QUEST_TYPE.MISSING_PERSON && rec.escorting) {
    return QUEST_STATUS.ESCORT;
  }
  return QUEST_STATUS.ACTIVE;
}

export function garantirQuadroCidade(cityId) {
  if (!cityId) return;
  const state = qs();
  const day = sincronizarDiaQuadro(state);
  const existing = state.boards[cityId];
  const npcs = npcsEntregaDaCidade(cityId);
  const temEntrega = existing?.some(
    (p) => p.type === QUEST_TYPE.MATERIAL_DELIVERY,
  );
  // Regenera se vazio, ou se só havia resgates gerados antes dos civis carregarem.
  if (existing?.length && (temEntrega || !npcs.length)) return;
  const cities = listarCidadesQuadro();
  const idx = cities.findIndex((c) => c.id === cityId);
  const zone = cidadePorId(cityId);
  if (!zone) return;
  const salt = state.boardForceSalt | 0;
  const genDay = salt > 0 ? day * 1000 + salt : day;
  const busy = new Set(
    state.taken
      .filter((r) => r.posting?.cityId === cityId && r.posting?.npcId)
      .map((r) => r.posting.npcId),
  );
  state.boards[cityId] = gerarQuadroCidade(zone, genDay, Math.max(0, idx), busy);
}

function refreshDiario(force = false) {
  const state = qs();
  const day = sincronizarDiaQuadro(state);
  if (!force && state.boardDay === day && Object.keys(state.boards).length) {
    // boardDay já sincronizado em sincronizarDiaQuadro; se boards vazios, gera
    if (Object.keys(state.boards).length > 0) return false;
  }
  // Se o dia mudou (ou force), regenera
  const precisa =
    force ||
    state._geradoParaDia !== day ||
    !Object.keys(state.boards).length;
  if (!precisa) return false;
  const salt = state.boardForceSalt | 0;
  const genDay = salt > 0 ? day * 1000 + salt : day;
  state.boards = gerarTodosQuadros(genDay, state.taken);
  state._geradoParaDia = day;
  notificar();
  return true;
}

export function tickQuadrosMissao() {
  const state = qs();
  const prevDay = state._geradoParaDia;
  const day = sincronizarDiaQuadro(state);
  if (prevDay != null && day !== prevDay) {
    state.boards = gerarTodosQuadros(
      (state.boardForceSalt | 0) > 0 ? day * 1000 + state.boardForceSalt : day,
      state.taken,
    );
    state._geradoParaDia = day;
    notificar();
    return true;
  }
  if (state._geradoParaDia == null) {
    refreshDiario(true);
  }
  return false;
}

export function forcarRefreshQuadros(opts = {}) {
  const state = qs();
  const day = sincronizarDiaQuadro(state);
  state.boardForceSalt = (state.boardForceSalt | 0) + 1;
  state._geradoParaDia = day;
  const genDay = day * 1000 + state.boardForceSalt;
  state.boards = gerarTodosQuadros(genDay, state.taken);
  if (opts.priorityCityId) garantirQuadroCidade(opts.priorityCityId);
  notificar();
  return true;
}

export function aceitarMissaoQuadro(posting) {
  if (!posting) return { ok: false, reason: "missing" };
  tickQuadrosMissao();
  if (statusPostagem(posting) === QUEST_STATUS.COMPLETED) {
    return { ok: false, reason: "done" };
  }
  if (acharTomado(posting.id)) return { ok: true, already: true };

  const state = qs();
  const board = state.boards[posting.cityId];
  const idx = board?.findIndex((p) => p.id === posting.id) ?? -1;
  if (idx < 0) return { ok: false, reason: "gone" };

  const [accepted] = board.splice(idx, 1);
  const rec = { posting: accepted, escorting: false };
  if (accepted.type === QUEST_TYPE.MISSING_PERSON) {
    rec.targetAx = accepted.targetAx ?? null;
    rec.targetAy = accepted.targetAy ?? null;
    if (rec.targetAx == null) {
      const area = escolherAreaResgate(accepted);
      if (area) {
        rec.targetAx = area.ax;
        rec.targetAy = area.ay;
        accepted.targetAx = area.ax;
        accepted.targetAy = area.ay;
      }
    }
  }
  state.taken.push(rec);
  notificar();
  return { ok: true };
}

export function abandonarMissaoQuadro(posting) {
  const rec = acharTomado(posting?.id);
  if (!rec) return { ok: false };
  const state = qs();
  state.taken = state.taken.filter((r) => r.posting.id !== posting.id);
  if (obterQuestNpc()?.questId === posting.id) limparQuestNpc();
  notificar();
  return { ok: true };
}

function concederRecompensa(posting) {
  const money = Math.max(0, posting.money | 0);
  if (money > 0) estado.dinheiro = (estado.dinheiro | 0) + money;
  let itemName = "";
  if (posting.rewardKind === "berry") {
    darItem(TIPO_ITEM.BERRY, posting.rewardKey || "oran", 1);
    itemName = nomeDoItem(posting.rewardKey || "oran", TIPO_ITEM.BERRY);
  } else {
    darItem(TIPO_ITEM.REMEDIO, posting.rewardKey || "potion", 1);
    itemName = nomeDoItem(posting.rewardKey || "potion", TIPO_ITEM.REMEDIO);
  }
  return { money, itemName };
}

export function completarMissaoQuadro(questId, opts = {}) {
  const id = questId ?? obterQuestNpc()?.questId ?? qs().taken[0]?.posting?.id;
  const rec = acharTomado(id);
  if (!rec) return null;
  const posting = rec.posting;
  const reward = concederRecompensa(posting);
  const state = qs();
  state.taken = state.taken.filter((r) => r.posting.id !== posting.id);
  state.completed.unshift(posting);
  if (state.completed.length > QUEST_COMPLETED_CAP) {
    state.completed.length = QUEST_COMPLETED_CAP;
  }
  if (obterQuestNpc()?.questId === posting.id) {
    if (opts.dismiss) iniciarDismiss(posting.cityId);
    else if (!opts.keepNpc) limparQuestNpc();
  }
  estado.itemGet = t("quests.board.rewardToast", {
    money: reward.money,
    item: reward.itemName,
  });
  notificar();
  return { posting, ...reward };
}

export function jogadorTemEntrega(posting) {
  if (!posting || posting.type !== QUEST_TYPE.MATERIAL_DELIVERY) return false;
  return contar(TIPO_ITEM.MATERIAL, posting.materialKey) >= (posting.amount | 0);
}

/**
 * Tentativa de turn-in ao falar com NPC.
 * @returns {{ handled: boolean, linhas?: string[], onClose?: () => void }}
 */
export function tentarEntregarMaterial(npc) {
  if (!npc) return { handled: false };
  const taken = qs().taken;
  let match = null;
  for (let i = 0; i < taken.length; i++) {
    const rec = taken[i];
    if (rec.posting?.type !== QUEST_TYPE.MATERIAL_DELIVERY) continue;
    if (!npcCasaComEntrega(npc, rec.posting)) continue;
    match = rec;
    break;
  }
  if (!match) return { handled: false };

  const posting = match.posting;
  const name = nomeNpcEntrega(posting);
  const item = nomeDoItem(posting.materialKey, TIPO_ITEM.MATERIAL);
  const count = posting.amount | 0;

  if (!jogadorTemEntrega(posting)) {
    return {
      handled: true,
      linhas: [
        t("quests.delivery.wait", { name, item, count }),
      ],
    };
  }

  return {
    handled: true,
    linhas: [t("quests.delivery.thanks", { name, item, count })],
    onClose() {
      gastar(TIPO_ITEM.MATERIAL, posting.materialKey, count);
      completarMissaoQuadro(posting.id);
    },
  };
}

export function comecarEscortMissao() {
  const npc = obterQuestNpc();
  const rec = acharTomado(npc?.questId);
  if (!npc || !rec) return false;
  for (const other of qs().taken) {
    if (other.posting.type === QUEST_TYPE.MISSING_PERSON) other.escorting = false;
  }
  rec.escorting = true;
  iniciarEscort(rec.posting.cityName);
  notificar();
  return true;
}

/**
 * Garante spawn do NPC se o jogador está na área alvo.
 */
export function garantirNpcResgateNaArea(player) {
  if (!player) return;
  const taken = qs().taken;
  let ativo = null;
  for (let i = 0; i < taken.length; i++) {
    const rec = taken[i];
    if (rec.posting?.type !== QUEST_TYPE.MISSING_PERSON) continue;
    ativo = rec;
    if (rec.escorting) break;
  }
  if (!ativo) {
    if (obterQuestNpc()) limparQuestNpc();
    return;
  }

  const posting = ativo.posting;
  const existing = obterQuestNpc();
  if (existing && existing.questId === posting.id) return;
  if (existing) limparQuestNpc();

  const ax = ativo.targetAx ?? posting.targetAx;
  const ay = ativo.targetAy ?? posting.targetAy;
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) return;

  const local = paraLocalKanto(player.x, player.y);
  const pax = (local.x / AREA_KANTO) | 0;
  const pay = (local.y / AREA_KANTO) | 0;
  // Só spawna se jogador na célula alvo OU já escortando (precisa existir)
  if (!ativo.escorting && (pax !== ax || pay !== ay)) return;

  let spawn = null;
  if (Number.isFinite(ativo.spawnX) && Number.isFinite(ativo.spawnY)) {
    spawn = { x: ativo.spawnX, y: ativo.spawnY };
  } else {
    spawn = escolherTileResgate(posting, ax, ay);
    if (spawn) {
      ativo.spawnX = spawn.x;
      ativo.spawnY = spawn.y;
    }
  }
  if (!spawn) return;
  criarQuestNpc(posting, spawn, !!ativo.escorting);
}

/**
 * Tick por frame: refresh + escort + complete na cidade.
 */
export function tickMissoesQuadro(player, dt) {
  tickQuadrosMissao();
  garantirNpcResgateNaArea(player);

  const npc = obterQuestNpc();
  const rec = npc ? acharTomado(npc.questId) : null;

  tickQuestNpc(player, dt);

  if (rec?.escorting && npc && !npc.dismissing && player) {
    if (jogadorNaCidadeDaMissao(player, rec.posting.cityId) &&
        zonaEhCidadeMissao(zonaNoMundo(npc.x, npc.y), rec.posting.cityId)) {
      completarMissaoQuadro(rec.posting.id, { dismiss: true, keepNpc: true });
    }
  }
}

/** Contagem de missões board ativas (para badge). */
export function contagemMissoesQuadroAtivas() {
  return qs().taken.length;
}

export function objetivoQuadroAtivo() {
  const taken = qs().taken;
  if (!taken.length) return null;
  // Prioriza escort, depois qualquer taken
  for (let i = 0; i < taken.length; i++) {
    if (taken[i].escorting) return taken[i];
  }
  return taken[0];
}

void nomeItemRecompensa;
