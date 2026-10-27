/**
 * Quadro de missões — madeira + papéis (HUD diegética).
 */

import { t } from "../../i18n.js";
import { estado } from "../../estado.js";
import {
  QUEST_STATUS,
  QUEST_BOARD_TAB,
  QUEST_BOARD_TYPE_TAB,
  QUEST_BOARD_TYPE_ORDER,
  QUEST_TYPE,
} from "../../../quests/tipos.js";
import {
  postagensDisponiveis,
  tomadosDaCidade,
  postagensConcluidas,
  statusPostagem,
  aceitarMissaoQuadro,
  abandonarMissaoQuadro,
  tickQuadrosMissao,
  forcarRefreshQuadros,
  garantirQuadroCidade,
} from "../../../quests/runtime.js";
import {
  tituloMissao,
  detalheMissao,
  textoRecompensa,
  nomeNpcEntrega,
} from "../../../quests/textoMissao.js";
import { aquecerMadeiraQuadro } from "./assets.js";
import {
  QUEST_BOARD_ICON,
  preencherIconeQuadro,
  srcIconeTipoMissao,
  criarIconeQuadro,
} from "./icones.js";
import { playQuestBoardEnter, playQuestBoardLeave } from "./motion.js";

const COUNT_MARK = "§";

function tabLabelBase(key) {
  return t(key, { count: COUNT_MARK })
    .replace(/\s*[(\[{]?§[)\]}]?\s*/g, "")
    .trim();
}

/**
 * @param {HTMLElement} root
 * @param {{ onToast?: (msg: string) => void, onOpen?: () => void, onClose?: () => void }} [hooks]
 */
export function montarJanelaQuadro(root, hooks = {}) {
  if (!root) {
    return { open() {}, close() {}, sync() {}, destroy() {}, isOpen: () => false, handleKey() { return false; } };
  }

  root.classList.add("quest-board-hud");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "quest-board-title");
  root.replaceChildren();
  aquecerMadeiraQuadro();

  const backdrop = document.createElement("div");
  backdrop.className = "quest-board-hud__backdrop";
  backdrop.dataset.questBoardClose = "";

  const sheet = document.createElement("div");
  sheet.className = "quest-board-hud__sheet";
  sheet.dataset.questBoardSheet = "";
  sheet.innerHTML = `
    <header class="quest-board-hud__header">
      <div class="quest-board-hud__identity">
        <span class="quest-board-hud__header-icon" data-qb-header-icon aria-hidden="true"></span>
        <div class="quest-board-hud__titles">
          <p class="quest-board-hud__kicker" data-qb-intro></p>
          <h2 class="quest-board-hud__title" id="quest-board-title" data-qb-title></h2>
        </div>
      </div>
      <div class="quest-board-hud__tools">
        <button type="button" class="quest-board-hud__force" data-qb-force></button>
        <button type="button" class="quest-board-hud__close" data-quest-board-close aria-label="Close">×</button>
      </div>
    </header>
    <nav class="quest-board-hud__status" data-qb-status-tabs role="tablist"></nav>
    <div class="quest-board-hud__main" data-qb-main>
      <nav class="quest-board-hud__types" data-qb-type-tabs role="tablist"></nav>
      <div class="quest-board-hud__list" data-qb-list role="list" id="quest-board-list"></div>
    </div>
    <p class="quest-board-hud__message" data-qb-message aria-live="polite"></p>
  `;
  root.append(backdrop, sheet);

  const titleEl = sheet.querySelector("[data-qb-title]");
  const introEl = sheet.querySelector("[data-qb-intro]");
  const headerIconHost = sheet.querySelector("[data-qb-header-icon]");
  const forceRefreshBtn = sheet.querySelector("[data-qb-force]");
  const mainEl = sheet.querySelector("[data-qb-main]");
  const tabs = sheet.querySelector("[data-qb-status-tabs]");
  const typeTabs = sheet.querySelector("[data-qb-type-tabs]");
  const listEl = sheet.querySelector("[data-qb-list]");
  const messageEl = sheet.querySelector("[data-qb-message]");

  preencherIconeQuadro(headerIconHost, QUEST_BOARD_ICON.header, "header", {
    className: "quest-board-hud__icon quest-board-hud__icon--header",
    size: 40,
  });

  /** @type {Map<string, HTMLButtonElement>} */
  const statusTabBtns = new Map();
  /** @type {Map<string, HTMLButtonElement>} */
  const typeTabBtns = new Map();
  /** @type {Map<string, object>} */
  const cardsById = new Map();
  /** @type {Map<string, object>} */
  const groupsByType = new Map();
  /** @type {HTMLElement | null} */
  let emptyEl = null;

  let cityId = null;
  let tab = QUEST_BOARD_TAB.AVAILABLE;
  let typeTab = QUEST_BOARD_TYPE_TAB.ALL;
  let closing = false;
  /** @type {(() => void) | null} */
  let cancelEnter = null;
  /** @type {(() => void) | null} */
  let cancelLeave = null;

  function makeStatusTab(id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quest-board-hud__tab";
    btn.dataset.tab = id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", "quest-board-list");
    const iconHost = document.createElement("span");
    iconHost.className = "quest-board-hud__tab-icon";
    iconHost.setAttribute("aria-hidden", "true");
    preencherIconeQuadro(iconHost, QUEST_BOARD_ICON.status[id], `status:${id}`, {
      className: "quest-board-hud__icon",
      size: 18,
    });
    const label = document.createElement("span");
    label.className = "quest-board-hud__tab-label";
    label.dataset.qbTabLabel = "";
    const count = document.createElement("b");
    count.className = "quest-board-hud__tab-count";
    count.dataset.qbTabCount = "";
    btn.append(iconHost, label, count);
    btn.addEventListener("click", () => {
      tab = id;
      setMessage("");
      sync();
    });
    return btn;
  }

  function makeTypeTab(id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quest-board-hud__type";
    btn.dataset.type = id;
    btn.setAttribute("role", "tab");
    const iconHost = document.createElement("span");
    iconHost.className = "quest-board-hud__type-icon";
    iconHost.setAttribute("aria-hidden", "true");
    preencherIconeQuadro(iconHost, srcIconeTipoMissao(id), `type:${id}`, {
      className: "quest-board-hud__icon",
      size: 20,
    });
    const copy = document.createElement("span");
    copy.className = "quest-board-hud__type-copy";
    const label = document.createElement("span");
    label.className = "quest-board-hud__type-label";
    label.dataset.qbTabLabel = "";
    const count = document.createElement("b");
    count.className = "quest-board-hud__type-count";
    count.dataset.qbTabCount = "";
    copy.append(label, count);
    btn.append(iconHost, copy);
    btn.addEventListener("click", () => {
      typeTab = id;
      setMessage("");
      sync();
    });
    return btn;
  }

  for (const id of [
    QUEST_BOARD_TAB.AVAILABLE,
    QUEST_BOARD_TAB.TAKEN,
    QUEST_BOARD_TAB.COMPLETED,
  ]) {
    const btn = makeStatusTab(id);
    statusTabBtns.set(id, btn);
    tabs.append(btn);
  }

  {
    const allBtn = makeTypeTab(QUEST_BOARD_TYPE_TAB.ALL);
    typeTabBtns.set(QUEST_BOARD_TYPE_TAB.ALL, allBtn);
    typeTabs.append(allBtn);
    for (const type of QUEST_BOARD_TYPE_ORDER) {
      const btn = makeTypeTab(type);
      typeTabBtns.set(type, btn);
      typeTabs.append(btn);
    }
  }

  forceRefreshBtn?.addEventListener("click", () => {
    if (!forcarRefreshQuadros({ priorityCityId: cityId })) return;
    tab = QUEST_BOARD_TAB.AVAILABLE;
    const copy = t("quests.board.forceRefreshDone");
    setMessage(copy, "good");
    hooks.onToast?.(copy);
    sync();
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-quest-board-close]")) close();
  });

  function setMessage(text, tone = "") {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.hidden = !text;
    if (tone) messageEl.dataset.tone = tone;
    else delete messageEl.dataset.tone;
  }

  function paintTabBtn(btn, labelKey, count, active) {
    if (!btn) return;
    const label = btn.querySelector("[data-qb-tab-label]");
    const countEl = btn.querySelector("[data-qb-tab-count]");
    if (label) label.textContent = tabLabelBase(labelKey);
    if (countEl) countEl.textContent = String(count);
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.setAttribute("aria-label", t(labelKey, { count }));
  }

  function setTabLabels(available, taken, completed) {
    paintTabBtn(
      statusTabBtns.get(QUEST_BOARD_TAB.AVAILABLE),
      "quests.board.tabAvailable",
      available,
      tab === QUEST_BOARD_TAB.AVAILABLE,
    );
    paintTabBtn(
      statusTabBtns.get(QUEST_BOARD_TAB.TAKEN),
      "quests.board.tabTaken",
      taken,
      tab === QUEST_BOARD_TAB.TAKEN,
    );
    paintTabBtn(
      statusTabBtns.get(QUEST_BOARD_TAB.COMPLETED),
      "quests.board.tabCompleted",
      completed,
      tab === QUEST_BOARD_TAB.COMPLETED,
    );
  }

  function countByType(postings) {
    const counts = Object.create(null);
    counts[QUEST_BOARD_TYPE_TAB.ALL] = postings.length;
    for (const type of QUEST_BOARD_TYPE_ORDER) counts[type] = 0;
    for (const posting of postings) {
      const type = posting.type ?? QUEST_TYPE.MISSING_PERSON;
      counts[type] = (counts[type] ?? 0) + 1;
    }
    return counts;
  }

  function setTypeTabLabels(postings) {
    const availableView = tab === QUEST_BOARD_TAB.AVAILABLE;
    typeTabs.hidden = !availableView;
    typeTabs.setAttribute("aria-hidden", String(!availableView));
    mainEl?.classList.toggle("has-types", availableView);
    if (!availableView) return;
    const counts = countByType(postings);
    const specs = [
      [QUEST_BOARD_TYPE_TAB.ALL, "quests.board.tabTypeAll"],
      [QUEST_TYPE.MISSING_PERSON, "quests.board.tabTypeMissing"],
      [QUEST_TYPE.MATERIAL_DELIVERY, "quests.board.tabTypeDelivery"],
    ];
    for (const [id, key] of specs) {
      const btn = typeTabBtns.get(id);
      if (!btn) continue;
      const n = counts[id] ?? 0;
      paintTabBtn(btn, key, n, typeTab === id);
      btn.classList.toggle("is-empty", n === 0 && id !== QUEST_BOARD_TYPE_TAB.ALL);
      btn.disabled = n === 0 && id !== QUEST_BOARD_TYPE_TAB.ALL;
    }
    if (typeTab !== QUEST_BOARD_TYPE_TAB.ALL && (counts[typeTab] ?? 0) === 0) {
      typeTab = QUEST_BOARD_TYPE_TAB.ALL;
      paintTabBtn(
        typeTabBtns.get(QUEST_BOARD_TYPE_TAB.ALL),
        "quests.board.tabTypeAll",
        counts[QUEST_BOARD_TYPE_TAB.ALL] ?? 0,
        true,
      );
    }
  }

  function acceptedCopy(posting) {
    if (posting?.type === QUEST_TYPE.MATERIAL_DELIVERY) {
      return t("quests.board.acceptedDeliver", { name: nomeNpcEntrega(posting) });
    }
    return t("quests.board.acceptedSearch");
  }

  function emptyCopy() {
    if (tab === QUEST_BOARD_TAB.TAKEN) return t("quests.board.emptyTaken");
    if (tab === QUEST_BOARD_TAB.COMPLETED) return t("quests.board.emptyCompleted");
    if (typeTab === QUEST_TYPE.MISSING_PERSON) return t("quests.board.emptyTypeMissing");
    if (typeTab === QUEST_TYPE.MATERIAL_DELIVERY) return t("quests.board.emptyTypeDelivery");
    return t("quests.board.empty");
  }

  function questTypeLabel(type) {
    if (type === QUEST_TYPE.MATERIAL_DELIVERY) return t("quests.board.typeDelivery");
    return t("quests.board.typeMissing");
  }

  function paintReward(host, posting) {
    const text = textoRecompensa(posting);
    const money = posting.money | 0;
    const key = `${money}|${text}`;
    if (host.dataset.rewardKey === key && host.firstChild) return;
    host.dataset.rewardKey = key;
    host.replaceChildren();
    if (money > 0) {
      host.append(
        criarIconeQuadro(
          QUEST_BOARD_ICON.pokedollars,
          "quest-board-hud__icon quest-board-hud__icon--reward",
          16,
        ),
      );
    }
    const span = document.createElement("span");
    span.textContent = text;
    host.append(span);
  }

  function paintActions(entry) {
    const { posting, status, actions } = entry;
    actions.replaceChildren();
    if (status === QUEST_STATUS.POSTED) {
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "quest-board-hud__btn quest-board-hud__btn--primary";
      accept.textContent = t("quests.board.accept");
      accept.addEventListener("click", () => {
        const result = aceitarMissaoQuadro(posting);
        if (!result.ok) {
          setMessage(t("quests.board.fail"), "bad");
          return;
        }
        const copy = acceptedCopy(posting);
        setMessage(copy, "good");
        hooks.onToast?.(copy);
        tab = QUEST_BOARD_TAB.TAKEN;
        sync();
      });
      actions.append(accept);
      return;
    }
    if (status === QUEST_STATUS.ACTIVE || status === QUEST_STATUS.ESCORT) {
      const abandon = document.createElement("button");
      abandon.type = "button";
      abandon.className = "quest-board-hud__btn quest-board-hud__btn--abandon";
      abandon.textContent = t("quests.board.abandon");
      abandon.addEventListener("click", () => {
        abandonarMissaoQuadro(posting);
        setMessage(t("quests.board.abandoned"), "good");
        sync();
      });
      actions.append(abandon);
      return;
    }
    const done = document.createElement("span");
    done.className = "quest-board-hud__done";
    done.textContent = t("quests.board.done");
    actions.append(done);
  }

  function ensureCard(posting) {
    const id = posting.id;
    let entry = cardsById.get(id);
    const status = statusPostagem(posting);
    const type = posting.type ?? QUEST_TYPE.MISSING_PERSON;

    if (!entry) {
      const card = document.createElement("article");
      card.className = "quest-board-hud__card";
      card.dataset.postingId = id;
      card.setAttribute("role", "listitem");
      const media = document.createElement("div");
      media.className = "quest-board-hud__card-media";
      const typeIcon = document.createElement("span");
      typeIcon.className = "quest-board-hud__card-type-icon";
      typeIcon.setAttribute("aria-hidden", "true");
      media.append(typeIcon);
      const body = document.createElement("div");
      body.className = "quest-board-hud__card-body";
      const titleRow = document.createElement("div");
      titleRow.className = "quest-board-hud__card-title-row";
      const title = document.createElement("h3");
      title.className = "quest-board-hud__card-title";
      const typeChip = document.createElement("span");
      typeChip.className = "quest-board-hud__card-chip";
      titleRow.append(title, typeChip);
      const detail = document.createElement("p");
      detail.className = "quest-board-hud__card-detail";
      const reward = document.createElement("p");
      reward.className = "quest-board-hud__card-reward";
      body.append(titleRow, detail, reward);
      const actions = document.createElement("div");
      actions.className = "quest-board-hud__card-actions";
      card.append(media, body, actions);
      entry = { card, posting, status: "", type: "", title, detail, reward, actions, typeIcon, typeChip };
      cardsById.set(id, entry);
    }

    entry.posting = posting;
    entry.card.dataset.status = status;
    entry.card.dataset.type = type;
    preencherIconeQuadro(entry.typeIcon, srcIconeTipoMissao(type), `card-type:${type}`, {
      className: "quest-board-hud__icon",
      size: 32,
    });
    entry.title.textContent = tituloMissao(posting);
    entry.typeChip.textContent = questTypeLabel(type);
    entry.detail.textContent = detalheMissao(posting, status);
    paintReward(entry.reward, posting);
    entry.status = status;
    entry.type = type;
    paintActions(entry);
    return entry;
  }

  function ensureGroup(type) {
    let entry = groupsByType.get(type);
    if (!entry) {
      const section = document.createElement("section");
      section.className = "quest-board-hud__group";
      section.dataset.type = type;
      const heading = document.createElement("h2");
      heading.className = "quest-board-hud__group-title";
      const list = document.createElement("div");
      list.className = "quest-board-hud__group-list";
      section.append(heading, list);
      entry = { section, heading, list };
      groupsByType.set(type, entry);
    }
    entry.heading.textContent = questTypeLabel(type);
    return entry;
  }

  function clearEmpty() {
    if (emptyEl) {
      emptyEl.remove();
      emptyEl = null;
    }
  }

  function showEmpty() {
    clearEmpty();
    emptyEl = document.createElement("p");
    emptyEl.className = "quest-board-hud__empty";
    emptyEl.textContent = emptyCopy();
    listEl.append(emptyEl);
  }

  function pruneCards(keepIds) {
    for (const [id, entry] of cardsById) {
      if (keepIds.has(id)) continue;
      entry.card.remove();
      cardsById.delete(id);
    }
  }

  function pruneGroups(keepTypes) {
    for (const [type, entry] of groupsByType) {
      if (keepTypes.has(type)) continue;
      entry.section.remove();
      groupsByType.delete(type);
    }
  }

  function syncList(postings, grouped) {
    clearEmpty();
    const keepIds = new Set(postings.map((p) => p.id));
    pruneCards(keepIds);
    if (!postings.length) {
      for (const entry of groupsByType.values()) entry.section.remove();
      groupsByType.clear();
      showEmpty();
      return;
    }
    if (!grouped) {
      for (const entry of groupsByType.values()) entry.section.remove();
      groupsByType.clear();
      for (const posting of postings) {
        listEl.append(ensureCard(posting).card);
      }
      return;
    }
    const groups = new Map();
    for (const posting of postings) {
      const type = posting.type ?? QUEST_TYPE.MISSING_PERSON;
      const list = groups.get(type) ?? [];
      list.push(posting);
      groups.set(type, list);
    }
    const order = [...QUEST_BOARD_TYPE_ORDER];
    const keepTypes = new Set();
    for (const type of order) {
      const items = groups.get(type);
      if (!items?.length) continue;
      keepTypes.add(type);
      const group = ensureGroup(type);
      listEl.append(group.section);
      for (const posting of items) {
        group.list.append(ensureCard(posting).card);
      }
    }
    pruneGroups(keepTypes);
  }

  function sync() {
    tickQuadrosMissao();
    if (cityId) garantirQuadroCidade(cityId);
    if (root.hidden) return;
    if (titleEl) titleEl.textContent = t("quests.board.windowTitle");
    if (introEl) introEl.textContent = t("quests.board.intro");
    if (forceRefreshBtn) forceRefreshBtn.textContent = t("quests.board.forceRefresh");
    tabs.setAttribute("aria-label", t("quests.board.statusTabs"));
    typeTabs.setAttribute("aria-label", t("quests.board.typeTabs"));

    const available = cityId ? postagensDisponiveis(cityId) : [];
    const taken = cityId ? tomadosDaCidade(cityId) : [];
    const completed = cityId ? postagensConcluidas(cityId) : [];
    setTabLabels(available.length, taken.length, completed.length);
    setTypeTabLabels(available);

    let cards = [];
    if (tab === QUEST_BOARD_TAB.AVAILABLE) {
      cards =
        typeTab === QUEST_BOARD_TYPE_TAB.ALL
          ? available
          : available.filter((p) => (p.type ?? QUEST_TYPE.MISSING_PERSON) === typeTab);
    } else if (tab === QUEST_BOARD_TAB.TAKEN) {
      cards = taken.map((r) => r.posting);
    } else {
      cards = completed;
    }
    const grouped =
      tab === QUEST_BOARD_TAB.AVAILABLE && typeTab === QUEST_BOARD_TYPE_TAB.ALL;
    syncList(cards, grouped);
  }

  function open(nextCityId) {
    cancelLeave?.();
    cancelLeave = null;
    closing = false;
    cityId = nextCityId ?? null;
    estado.questBoardCityId = cityId;
    tab = QUEST_BOARD_TAB.AVAILABLE;
    typeTab = QUEST_BOARD_TYPE_TAB.ALL;
    estado.questBoardOpen = true;
    document.body.classList.add("is-quest-board-open");
    root.hidden = false;
    root.classList.remove("is-collapsed", "is-out");
    setMessage("");
    if (cityId) garantirQuadroCidade(cityId);
    sync();
    cancelEnter?.();
    cancelEnter = playQuestBoardEnter(root);
    hooks.onOpen?.();
  }

  function finishClose() {
    closing = false;
    cancelLeave = null;
    root.hidden = true;
    document.body.classList.remove("is-quest-board-open");
    estado.questBoardOpen = false;
    estado.questBoardCityId = null;
    hooks.onClose?.();
  }

  function close() {
    if (root.hidden || closing) return;
    closing = true;
    cancelEnter?.();
    cancelEnter = null;
    cancelLeave = playQuestBoardLeave(root, finishClose);
  }

  function handleKey(code) {
    if (code !== "Escape" || root.hidden) return false;
    close();
    return true;
  }

  function destroy() {
    cancelEnter?.();
    cancelLeave?.();
    document.body.classList.remove("is-quest-board-open");
    estado.questBoardOpen = false;
    estado.questBoardCityId = null;
    root.replaceChildren();
    cardsById.clear();
    groupsByType.clear();
  }

  setMessage("");
  root.hidden = true;

  return { open, close, sync, destroy, handleKey, isOpen: () => !root.hidden };
}

/** @type {ReturnType<typeof montarJanelaQuadro> | null} */
let apiQuadro = null;

export function bootQuestBoard() {
  let host = document.getElementById("win-quest-board");
  if (!host) {
    host = document.createElement("div");
    host.id = "win-quest-board";
    host.hidden = true;
    document.body.appendChild(host);
  }
  apiQuadro = montarJanelaQuadro(host, {
    onToast(msg) {
      if (msg) {
        estado.itemGet = msg;
      }
    },
  });
  return apiQuadro;
}

export function apiQuestBoard() {
  return apiQuadro;
}

export function abrirQuestBoard(cityId) {
  if (!apiQuadro) bootQuestBoard();
  apiQuadro?.open(cityId);
}

export function fecharQuestBoard() {
  apiQuadro?.close();
}
