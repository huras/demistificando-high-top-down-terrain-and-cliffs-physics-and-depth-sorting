/** Janela de status do Pokémon — shell persistente + patch incremental (sem recriar DOM a cada frame). */

import {
  BERRIES,
  HOLD_ITEMS,
  REMEDIOS,
  TIPO_ITEM,
} from "../../wild/catalogo.js";
import {
  desequiparAutoCure,
  desequiparAutoHeal,
  desequiparHold,
  equiparAutoCure,
  equiparAutoHeal,
  equiparHold,
  listarEquipaveis,
} from "../../pokemon/equipItens.js";
import { listaParty } from "../../pokemon/party.js";
import { progressoExp } from "../../pokemon/experiencia.js";
import { COR_TIPO, multiplicadorEstagio } from "../../pokemon/tipos.js";
import { rotuloStatus } from "../../pokemon/combate/status.js";
import {
  contar,
  estado,
  remedioAjuda,
  usarNoPokemon,
  avisar,
  nomeDe,
} from "../estado.js";
import { htmlIcone } from "../icones.js";
import { descricaoItem } from "../descricaoItem.js";

const STATS = Object.freeze([
  { key: "ataque", estagio: "estagioAtk", label: "Ataque" },
  { key: "defesa", estagio: "estagioDef", label: "Defesa" },
  { key: "ataqueEsp", estagio: "estagioSpa", label: "Atq. Esp." },
  { key: "defesaEsp", estagio: "estagioSpd", label: "Def. Esp." },
  { key: "velocidade", estagio: "estagioSpe", label: "Velocidade" },
]);

/** @type {HTMLElement | null} */
let layer = null;
/** @type {ReturnType<typeof criarRefs> | null} */
let refs = null;
let aberto = false;
let indice = -1;
let aba = "overview";
let userMoved = false;
let drag = null;
let shellPronto = false;

/** Assinaturas: só reconstroem o que mudou. */
let sigIdentidade = "";
let sigVivos = "";
let sigItens = "";
let sigAba = "";

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function nomeEspecie(ator) {
  return ator?.especie?.nome || ator?.especie?.name || ator?.especie?.key || "Pokémon";
}

function urlRetrato(ator) {
  const dex = ator?.especie?.dex | 0;
  if (!dex) return "";
  return ator.shiny
    ? `/ref/sprites/pokemon-portraits/shiny/${dex}.png`
    : `/ref/sprites/pokemon-portraits/${dex}.png`;
}

function simboloGenero(ator) {
  const g = ator?.genero ?? ator?.gender ?? ator?.especie?.genero;
  if (g === "f" || g === "female" || g === 1) return "♀";
  if (g === "m" || g === "male" || g === 0) return "♂";
  return "";
}

function atorAtual() {
  return listaParty()[indice] || null;
}

function criarRefs(root) {
  return {
    root,
    bar: root.querySelector("[data-status-bar]"),
    portrait: root.querySelector("[data-status-portrait]"),
    name: root.querySelector("[data-status-name]"),
    gender: root.querySelector("[data-status-gender]"),
    ailment: root.querySelector("[data-status-ailment]"),
    level: root.querySelector("[data-status-level]"),
    types: root.querySelector("[data-status-types]"),
    hpFill: root.querySelector("[data-status-hp-fill]"),
    hpNum: root.querySelector("[data-status-hp-num]"),
    expFill: root.querySelector("[data-status-exp-fill]"),
    expNum: root.querySelector("[data-status-exp-num]"),
    stats: root.querySelector("[data-status-stats]"),
    moves: root.querySelector("[data-status-moves]"),
    itemsHost: root.querySelector("[data-status-items]"),
    panelOverview: root.querySelector('[data-panel="overview"]'),
    panelMoves: root.querySelector('[data-panel="moves"]'),
    panelItems: root.querySelector('[data-panel="items"]'),
    tabs: root.querySelectorAll("[data-act='aba-status']"),
  };
}

function montarShell() {
  if (shellPronto && refs?.root) return;
  garantirLayer();
  layer.innerHTML = `<div class="party-status" role="dialog" aria-label="Status">
    <header class="party-status__bar" data-status-bar>
      <span class="party-status__title">Status</span>
      <button type="button" class="party-status__close" data-act="fechar-status" aria-label="Fechar">×</button>
    </header>
    <div class="party-status__tabs" role="tablist">
      <button type="button" class="party-status__tab" data-act="aba-status" data-tab="overview">Geral</button>
      <button type="button" class="party-status__tab" data-act="aba-status" data-tab="moves">Golpes</button>
      <button type="button" class="party-status__tab" data-act="aba-status" data-tab="items">Itens</button>
    </div>
    <div class="party-status__body">
      <div class="party-status__panel" data-panel="overview">
        <div class="party-status__hero">
          <div class="party-status__sprite-stage" data-status-portrait></div>
          <div class="party-status__summary">
            <div class="party-status__name-row">
              <span class="party-status__name" data-status-name></span>
              <span class="party-status__gender" data-status-gender hidden></span>
              <span class="party-status__ailment" data-status-ailment hidden></span>
            </div>
            <div class="party-status__meta">
              <span class="party-status__level" data-status-level></span>
              <span class="party-status__types" data-status-types></span>
            </div>
            <div class="party-status__bars">
              <div class="party-status__bar-row">
                <span class="party-status__bar-tag">HP</span>
                <div class="party-status__bar-track"><i data-status-hp-fill></i></div>
                <span class="party-status__bar-value" data-status-hp-num></span>
              </div>
              <div class="party-status__bar-row">
                <span class="party-status__bar-tag">EXP</span>
                <div class="party-status__bar-track party-status__bar-track--exp"><i data-status-exp-fill></i></div>
                <span class="party-status__bar-value" data-status-exp-num></span>
              </div>
            </div>
          </div>
        </div>
        <div class="party-status__section-title">Atributos</div>
        <div class="party-status__stat-list" data-status-stats></div>
      </div>
      <div class="party-status__panel" data-panel="moves" hidden>
        <div class="party-status__section-title">Golpes</div>
        <ul class="party-status__move-list" data-status-moves></ul>
      </div>
      <div class="party-status__panel" data-panel="items" hidden data-status-items></div>
    </div>
  </div>`;

  const root = layer.querySelector(".party-status");
  refs = criarRefs(root);
  // Stats rows fixas — só valores mudam.
  refs.stats.innerHTML = STATS.map(
    (s) => `<div class="party-status__stat-row" data-stat="${s.key}">
      <span class="party-status__stat-label">${escHtml(s.label)}</span>
      <b class="party-status__stat-value" data-stat-value>0</b>
      <span class="party-status__stat-stage" data-stat-stage hidden></span>
    </div>`,
  ).join("");
  wireDrag(refs.bar);
  shellPronto = true;
  sigIdentidade = "";
  sigVivos = "";
  sigItens = "";
  sigAba = "";
}

function garantirLayer() {
  if (layer) return layer;
  layer = document.getElementById("party-status-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "party-status-layer";
    layer.className = "party-status-layer candy-panel";
    layer.hidden = true;
    document.body.appendChild(layer);
  }
  if (!layer.dataset.clickWired) {
    layer.dataset.clickWired = "1";
    layer.addEventListener("click", noCliqueLayer);
  }
  return layer;
}

function clampPos(left, top) {
  const margin = 8;
  const pr = layer.getBoundingClientRect();
  return {
    left: Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - pr.width - margin)),
    top: Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - pr.height - margin)),
  };
}

function wireDrag(barEl) {
  if (!barEl || barEl.dataset.dragWired) return;
  barEl.dataset.dragWired = "1";
  barEl.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest("button")) return;
    e.preventDefault();
    const rect = layer.getBoundingClientRect();
    layer.style.left = `${rect.left}px`;
    layer.style.top = `${rect.top}px`;
    layer.style.right = "auto";
    layer.style.bottom = "auto";
    drag = {
      pointerId: e.pointerId,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      bar: barEl,
    };
    userMoved = true;
    layer.classList.add("is-dragging");
    try {
      barEl.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    window.addEventListener("pointermove", onDragMove, { passive: false });
    window.addEventListener("pointerup", onDragUp);
    window.addEventListener("pointercancel", onDragUp);
  });
}

function onDragMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  e.preventDefault();
  const pos = clampPos(e.clientX - drag.ox, e.clientY - drag.oy);
  layer.style.left = `${pos.left}px`;
  layer.style.top = `${pos.top}px`;
}

function onDragUp(e) {
  if (!drag) return;
  if (e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
  layer.classList.remove("is-dragging");
  try {
    drag.bar.releasePointerCapture?.(drag.pointerId);
  } catch {
    /* ignore */
  }
  drag = null;
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragUp);
  window.removeEventListener("pointercancel", onDragUp);
}

function posicionar(force = false) {
  if (!aberto || layer.hidden) return;
  if (userMoved && !force) return;
  const margin = 8;
  const detail = document.getElementById("party-combat-detail");
  const slot = document.querySelector(`.party-slot[data-i="${indice}"]`);
  const anchor = detail?.offsetParent ? detail : slot;
  const pr = layer.getBoundingClientRect();
  let left = (window.innerWidth - pr.width) / 2;
  let top = Math.max(margin, (window.innerHeight - pr.height) / 2);
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    left = r.left + r.width / 2 - pr.width / 2;
    top = r.top - pr.height - margin;
    if (top < margin) top = Math.max(margin, (window.innerHeight - pr.height) / 2);
  }
  const pos = clampPos(left, top);
  layer.style.left = `${pos.left}px`;
  layer.style.top = `${pos.top}px`;
  layer.style.right = "auto";
  layer.style.bottom = "auto";
}

function aplicarAba() {
  if (!refs || sigAba === aba) return;
  sigAba = aba;
  for (const tab of refs.tabs) {
    tab.classList.toggle("is-active", tab.dataset.tab === aba);
  }
  refs.panelOverview.hidden = aba !== "overview";
  refs.panelMoves.hidden = aba !== "moves";
  refs.panelItems.hidden = aba !== "items";
}

function sigDeIdentidade(ator) {
  const tipos = (ator.tipos || ator.especie?.tipos || []).join(",");
  return `${ator.id}|${ator.especie?.key}|${ator.shiny ? 1 : 0}|${ator.nivel}|${tipos}|${simboloGenero(ator)}`;
}

function sigDeVivos(ator) {
  const stages = STATS.map((s) => ator[s.estagio] | 0).join(",");
  const stats = STATS.map((s) => ator.stats?.[s.key] | 0).join(",");
  return `${Math.round(ator.hp)}|${ator.hpMax}|${ator.exp | 0}|${ator.status || ""}|${ator.morto ? 1 : 0}|${stats}|${stages}`;
}

function sigDeItens(ator) {
  const held = ator.heldItemKey || ator.itemSegurado || "";
  const parts = [
    held,
    ator.autoHealBerryKey || "",
    ator.autoCureBerryKey || "",
  ];
  for (const key of Object.keys(REMEDIOS)) {
    const n = contar(TIPO_ITEM.REMEDIO, key);
    if (n > 0) parts.push(`m:${key}:${n}`);
  }
  for (const key of Object.keys(BERRIES)) {
    const efeito = BERRIES[key]?.efeito;
    if (!efeito) continue;
    if (!efeito.curaHp && !efeito.curaFrac && !efeito.cura && !efeito.pp) continue;
    const n = contar(TIPO_ITEM.BERRY, key);
    if (n > 0) parts.push(`b:${key}:${n}`);
  }
  for (const key of Object.keys(HOLD_ITEMS)) {
    const n = contar(TIPO_ITEM.HOLD, key);
    if (n > 0) parts.push(`h:${key}:${n}`);
  }
  const party = listaParty();
  for (let i = 0; i < party.length; i++) {
    if (i === indice) continue;
    const m = party[i];
    if (m?.heldItemKey) parts.push(`x:${i}:${m.heldItemKey}`);
  }
  return parts.join("|");
}

function pintarRetrato(ator) {
  if (!refs?.portrait) return;
  const url = urlRetrato(ator);
  const atual = refs.portrait.dataset.url || "";
  if (url === atual && refs.portrait.firstChild) return;
  refs.portrait.dataset.url = url;
  refs.portrait.innerHTML = url
    ? `<img class="party-status__portrait" src="${url}" alt="" draggable="false" />`
    : `<span class="party-status__portrait party-status__portrait--fallback">${escHtml(nomeEspecie(ator).slice(0, 1))}</span>`;
}

function pintarTipos(ator) {
  if (!refs?.types) return;
  const tipos = ator?.tipos || ator?.especie?.tipos || [];
  const sig = tipos.join(",");
  if (refs.types.dataset.sig === sig) return;
  refs.types.dataset.sig = sig;
  refs.types.innerHTML = tipos
    .map((t) => {
      const cor = COR_TIPO[t] || "#9ca3af";
      return `<span class="party-status__type" style="--type:${cor}" title="${escHtml(t)}">${escHtml(t)}</span>`;
    })
    .join("");
}

function pintarGolpes(ator) {
  if (!refs?.moves) return;
  const golpes = ator.golpes || [];
  const sig = golpes.map((g) => g?.def?.key || g?.chave || "").join(",");
  if (refs.moves.dataset.sig === sig) return;
  refs.moves.dataset.sig = sig;
  if (!golpes.length) {
    refs.moves.innerHTML = `<li class="party-status__items-empty" style="list-style:none">Sem golpes.</li>`;
    return;
  }
  refs.moves.innerHTML = golpes
    .map((g, i) => {
      const def = g?.def || g;
      const tipo = def?.tipo || "normal";
      const cor = COR_TIPO[tipo] || "#9ca3af";
      return `<li class="party-status__move" style="--type:${cor}">
        <span class="party-status__move-slot">${i + 1}</span>
        <span class="party-status__move-name">${escHtml(def?.nome || def?.name || def?.key || "—")}</span>
        <span class="party-status__type">${escHtml(tipo)}</span>
        <span class="party-status__move-pow">${def?.poder | 0 || "—"}</span>
      </li>`;
    })
    .join("");
}

function patchVivos(ator) {
  if (!refs) return;
  const hp = Math.max(0, Math.round(ator.hp));
  const max = Math.max(1, ator.hpMax | 0);
  const pctHp = Math.round((hp / max) * 100);
  const cresc = ator.crescimento || ator.especie?.crescimento || "mediumSlow";
  const pctExp = Math.round(progressoExp(ator.nivel | 0, ator.exp | 0, cresc) * 100);

  if (refs.hpFill) refs.hpFill.style.width = `${pctHp}%`;
  if (refs.hpNum) refs.hpNum.textContent = `${hp}/${max}`;
  if (refs.expFill) refs.expFill.style.width = `${pctExp}%`;
  if (refs.expNum) refs.expNum.textContent = `${pctExp}%`;

  const ailmentTxt = ator.status
    ? rotuloStatus(ator.status)
    : ator.morto || ator.hp <= 0
      ? "desmaiado"
      : "";
  if (refs.ailment) {
    refs.ailment.hidden = !ailmentTxt;
    refs.ailment.textContent = ailmentTxt;
    refs.ailment.classList.toggle("is-faint", !ator.status && !!(ator.morto || ator.hp <= 0));
  }

  for (let i = 0; i < STATS.length; i++) {
    const s = STATS[i];
    const row = refs.stats.querySelector(`[data-stat="${s.key}"]`);
    if (!row) continue;
    const base = ator.stats?.[s.key] | 0;
    const stage = ator[s.estagio] | 0;
    const efetivo = Math.max(1, Math.floor(base * multiplicadorEstagio(stage)));
    const val = row.querySelector("[data-stat-value]");
    const st = row.querySelector("[data-stat-stage]");
    if (val) {
      val.textContent = String(stage !== 0 ? efetivo : base);
      val.classList.toggle("is-boosted", stage > 0);
      val.classList.toggle("is-lowered", stage < 0);
    }
    row.classList.toggle("is-boosted", stage > 0);
    row.classList.toggle("is-lowered", stage < 0);
    if (st) {
      if (stage !== 0) {
        st.hidden = false;
        st.textContent = stage > 0 ? `▲${stage}` : `▼${Math.abs(stage)}`;
        st.className = `party-status__stat-stage is-${stage > 0 ? "up" : "down"}`;
      } else {
        st.hidden = true;
        st.textContent = "";
      }
    }
  }
}

function htmlSlotEquip(label, slot, key) {
  const filled = !!key;
  const nome = key ? nomeDe(HOLD_ITEMS[key] ? TIPO_ITEM.HOLD : TIPO_ITEM.BERRY, key) : "—";
  const icone = key
    ? htmlIcone(key, "party-status__item-icon", 28)
    : `<span class="party-status__equip-slot-empty">—</span>`;
  return `<div class="party-status__equip-slot-row">
    <span class="party-status__equip-slot-label">${escHtml(label)}</span>
    <button type="button" class="party-status__equip-slot-btn${filled ? " is-filled" : ""}" data-act="unequip-slot" data-slot="${slot}" title="${filled ? `Remover ${escHtml(nome)}` : "Vazio"}">
      <span class="party-status__equip-slot-icon">${icone}</span>
      <span class="party-status__equip-slot-name">${escHtml(filled ? nome : "Vazio")}</span>
    </button>
  </div>`;
}

function medicinaNaBolsa() {
  const out = [];
  for (const key of Object.keys(REMEDIOS)) {
    const n = contar(TIPO_ITEM.REMEDIO, key);
    if (n > 0) out.push({ tipo: TIPO_ITEM.REMEDIO, key, count: n });
  }
  for (const key of Object.keys(BERRIES)) {
    const efeito = BERRIES[key]?.efeito;
    if (!efeito) continue;
    if (!efeito.curaHp && !efeito.curaFrac && !efeito.cura && !efeito.pp) continue;
    const n = contar(TIPO_ITEM.BERRY, key);
    if (n > 0) out.push({ tipo: TIPO_ITEM.BERRY, key, count: n });
  }
  return out;
}

function pintarPainelItens(ator) {
  if (!refs?.itemsHost) return;
  const meds = medicinaNaBolsa();
  const medHtml = meds.length
    ? `<ul class="party-status__item-list">${meds
        .map((item) => {
          const pode = remedioAjuda(item.tipo, item.key, ator);
          const nome = nomeDe(item.tipo, item.key);
          const dica = descricaoItem(item.tipo, item.key) || "";
          return `<li class="party-status__item-row">
            <button type="button" class="party-status__item" data-act="usar-med" data-tipo="${item.tipo}" data-key="${escHtml(item.key)}" ${pode ? "" : "disabled"} title="${escHtml(nome)} ×${item.count}${dica ? `\n${dica}` : ""}">
              <span class="party-status__item-icon-wrap">${htmlIcone(item.key, "party-status__item-icon", 32)}</span>
              <span class="party-status__item-body">
                <span class="party-status__item-name">${escHtml(nome)}</span>
                <span class="party-status__item-meta">${escHtml(dica || (pode ? "Usar" : "Sem efeito"))}</span>
              </span>
              <span class="party-status__item-qty">×${item.count}</span>
              <span class="party-status__item-action">${pode ? "Usar" : "—"}</span>
            </button>
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="party-status__items-empty">Nenhum remédio na bolsa.</p>`;

  const equipList = listarEquipaveis(indice);
  const equipHtml = equipList.length
    ? `<ul class="party-status__item-list party-status__equip-list">${equipList
        .map((item) => {
          const tipo = item.kind === "hold" ? TIPO_ITEM.HOLD : TIPO_ITEM.BERRY;
          const nome = nomeDe(tipo, item.key);
          const kindLabel =
            item.kind === "hold" ? "Held" : item.kind === "autoHeal" ? "Auto-cura" : "Auto-status";
          const held = item.heldBy ? ` · em ${item.heldBy.nome}` : ` ×${item.count}`;
          return `<li class="party-status__item-row">
            <button type="button" class="party-status__item party-status__equip-pick${item.heldBy ? " party-status__equip-pick--held" : ""}" data-act="equip-pick" data-kind="${item.kind}" data-key="${escHtml(item.key)}" ${item.heldBy ? `data-from="${item.heldBy.index}"` : ""} title="${escHtml(nome)}${held}\n${kindLabel}">
              <span class="party-status__item-icon-wrap">${htmlIcone(item.key, "party-status__item-icon", 32)}</span>
              <span class="party-status__item-body">
                <span class="party-status__item-name">${escHtml(nome)}</span>
                <span class="party-status__item-meta">${escHtml(kindLabel)}${item.heldBy ? ` · ${escHtml(item.heldBy.nome)}` : ""}</span>
              </span>
              <span class="party-status__item-qty">${item.heldBy ? "↔" : `×${item.count}`}</span>
              <span class="party-status__item-action">Equipar</span>
            </button>
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="party-status__items-empty">Nada para equipar.</p>`;

  refs.itemsHost.innerHTML = `
    <div class="party-status__equip">
      <div class="party-status__section-title">Equipados</div>
      <div class="party-status__equip-slots">
        ${htmlSlotEquip("Held item", "held", ator.heldItemKey || ator.itemSegurado)}
        ${htmlSlotEquip("Auto-cura", "autoHeal", ator.autoHealBerryKey)}
        ${htmlSlotEquip("Auto-status", "autoCure", ator.autoCureBerryKey)}
      </div>
      <div class="party-status__section-title party-status__section-title--sub">Equipar da bolsa</div>
      ${equipHtml}
    </div>
    <div class="party-status__items">
      <div class="party-status__section-title">Usar item</div>
      ${medHtml}
    </div>`;
}

/** Sync barato: patch vivo; rebuild estrutural só se assinatura mudou. */
function syncPainel(forcarItens = false) {
  if (!aberto || !refs) return;
  const ator = atorAtual();
  if (!ator) {
    fechar();
    return;
  }

  aplicarAba();

  const idSig = sigDeIdentidade(ator);
  if (idSig !== sigIdentidade) {
    sigIdentidade = idSig;
    refs.root.setAttribute("aria-label", `Status: ${nomeEspecie(ator)}`);
    if (refs.name) refs.name.textContent = nomeEspecie(ator);
    if (refs.level) refs.level.textContent = `Nv. ${ator.nivel | 0}`;
    const gen = simboloGenero(ator);
    if (refs.gender) {
      refs.gender.hidden = !gen;
      refs.gender.textContent = gen;
    }
    pintarRetrato(ator);
    pintarTipos(ator);
    pintarGolpes(ator);
    sigItens = ""; // força refresh de itens ao trocar mon
  }

  const vivoSig = sigDeVivos(ator);
  if (vivoSig !== sigVivos) {
    sigVivos = vivoSig;
    patchVivos(ator);
    // Usabilidade de remédios (revive vs vivo) muda com HP — refresca lista se aba itens.
    if (aba === "items") forcarItens = true;
  }

  if (aba === "items") {
    const itemSig = sigDeItens(ator);
    if (forcarItens || itemSig !== sigItens) {
      sigItens = itemSig;
      pintarPainelItens(ator);
    }
  }
}

function invalidarItens() {
  sigItens = "";
  if (aberto && aba === "items") syncPainel(true);
}

function noCliqueLayer(ev) {
  const btn = ev.target.closest("[data-act]");
  if (!btn || !layer.contains(btn)) return;
  ev.preventDefault();
  ev.stopPropagation();
  const act = btn.dataset.act;
  if (act === "fechar-status") {
    fechar();
    return;
  }
  if (act === "aba-status") {
    aba = btn.dataset.tab || "overview";
    aplicarAba();
    if (aba === "items") syncPainel(true);
    return;
  }
  if (act === "usar-med") {
    const ator = atorAtual();
    if (!ator) return;
    if (usarNoPokemon(btn.dataset.tipo, btn.dataset.key, ator)) {
      invalidarItens();
      sigVivos = "";
      syncPainel(true);
      avisar();
    }
    return;
  }
  if (act === "unequip-slot") {
    const slot = btn.dataset.slot;
    if (slot === "held") desequiparHold(indice);
    else if (slot === "autoHeal") desequiparAutoHeal(indice);
    else if (slot === "autoCure") desequiparAutoCure(indice);
    invalidarItens();
    syncPainel(true);
    avisar();
    return;
  }
  if (act === "equip-pick") {
    const kind = btn.dataset.kind;
    const key = btn.dataset.key;
    const from = btn.dataset.from != null ? Number(btn.dataset.from) : undefined;
    let ok = false;
    if (kind === "hold") ok = equiparHold(indice, key, from != null ? { fromHolderIndex: from } : {});
    else if (kind === "autoHeal") ok = equiparAutoHeal(indice, key);
    else if (kind === "autoCure") ok = equiparAutoCure(indice, key);
    if (ok) {
      invalidarItens();
      syncPainel(true);
      avisar();
    }
  }
}

export function abrirStatusPokemon(i) {
  const party = listaParty();
  if (i < 0 || i >= party.length || !party[i]) return false;
  garantirLayer();
  montarShell();
  indice = i;
  aba = "overview";
  sigAba = "";
  sigIdentidade = "";
  sigVivos = "";
  sigItens = "";
  aberto = true;
  estado.statusMonAberto = true;
  layer.hidden = false;
  syncPainel(true);
  requestAnimationFrame(() => {
    posicionar(true);
    requestAnimationFrame(() => posicionar(!userMoved));
  });
  avisar();
  return true;
}

export function fecharStatusPokemon() {
  return fechar();
}

function fechar() {
  aberto = false;
  indice = -1;
  estado.statusMonAberto = false;
  if (layer) {
    layer.hidden = true;
    layer.classList.remove("is-dragging");
  }
  // Mantém shell montado — próximo open só faz patch.
  avisar();
  return true;
}

export function toggleStatusPokemon(i) {
  if (aberto && indice === i) return fechar();
  return abrirStatusPokemon(i);
}

export function statusPokemonAberto() {
  return aberto;
}

export function syncStatusPokemon() {
  if (!aberto) return;
  syncPainel(false);
}

export function montarStatusPokemon() {
  garantirLayer();
  return {
    open: abrirStatusPokemon,
    close: fecharStatusPokemon,
    toggle: toggleStatusPokemon,
    isOpen: statusPokemonAberto,
    sync: syncStatusPokemon,
  };
}
