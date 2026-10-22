/**
 * Seletor flutuante de modo de IA (por mon + equipe).
 */
import { AI_MODE_OPTIONS, AI_MODES, rotuloModo } from "../../pokemon/aiModes.js";
import { MODE_ICONS } from "./iconesModo.js";

export function createModePicker({ onSelect }) {
  const el = document.createElement("div");
  el.className = "mode-picker";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Modo de IA");

  const header = document.createElement("div");
  header.className = "mode-picker__header";
  const title = document.createElement("span");
  title.className = "mode-picker__title";
  header.append(title);

  const grid = document.createElement("div");
  grid.className = "mode-picker__grid";
  const optionMap = new Map();

  for (const mode of AI_MODE_OPTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mode-picker__option";
    btn.innerHTML = `<span class="mode-picker__glyph">${MODE_ICONS[mode] || ""}</span><span class="mode-picker__label">${rotuloModo(mode)}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openIndex < 0) return;
      onSelect(openIndex, mode);
      close();
    });
    grid.append(btn);
    optionMap.set(mode, btn);
  }

  el.append(header, grid);
  el.addEventListener("click", (e) => e.stopPropagation());
  document.body.append(el);

  let openIndex = -1;
  let anchor = null;

  function position() {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const pr = el.getBoundingClientRect();
    let left = r.left + r.width / 2 - pr.width / 2;
    left = Math.min(Math.max(left, margin), window.innerWidth - pr.width - margin);
    let top = r.bottom + margin;
    if (top + pr.height > window.innerHeight - margin) {
      top = Math.max(margin, r.top - pr.height - margin);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function syncOptions(ator) {
    const pref = ator?.modePreference ?? ator?.modeIa ?? "default";
    for (const [mode, btn] of optionMap) {
      btn.classList.toggle("is-active", pref === mode);
    }
  }

  function close() {
    if (anchor) anchor.classList.remove("is-picker-open");
    el.hidden = true;
    openIndex = -1;
    anchor = null;
  }

  function open(index, ator, anchorEl, nome) {
    if (openIndex === index && !el.hidden) {
      close();
      return;
    }
    close();
    openIndex = index;
    anchor = anchorEl;
    title.textContent = nome || `Pokémon ${index + 1}`;
    syncOptions(ator);
    anchorEl?.classList.add("is-picker-open");
    el.hidden = false;
    requestAnimationFrame(() => {
      position();
      requestAnimationFrame(position);
    });
  }

  window.addEventListener("resize", () => {
    if (!el.hidden) position();
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden) close();
  });
  document.addEventListener("click", () => {
    if (!el.hidden) close();
  });

  return { el, open, close, syncOptions };
}

export function createTeamModePicker({ onSelect }) {
  const el = document.createElement("div");
  el.className = "mode-picker mode-picker--team";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Modo da equipe");

  const header = document.createElement("div");
  header.className = "mode-picker__header";
  const title = document.createElement("span");
  title.className = "mode-picker__title";
  title.textContent = "IA da equipe";
  header.append(title);

  const grid = document.createElement("div");
  grid.className = "mode-picker__grid";
  const optionMap = new Map();

  for (const mode of AI_MODES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mode-picker__option";
    btn.innerHTML = `<span class="mode-picker__glyph">${MODE_ICONS[mode] || ""}</span><span class="mode-picker__label">${rotuloModo(mode)}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect(mode);
      close();
    });
    grid.append(btn);
    optionMap.set(mode, btn);
  }

  el.append(header, grid);
  el.addEventListener("click", (e) => e.stopPropagation());
  document.body.append(el);

  let anchor = null;

  function position() {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const pr = el.getBoundingClientRect();
    let left = r.right + margin;
    if (left + pr.width > window.innerWidth - margin) {
      left = Math.max(margin, r.left - pr.width - margin);
    }
    let top = r.top;
    top = Math.min(Math.max(top, margin), window.innerHeight - pr.height - margin);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function sync(mode) {
    for (const [m, btn] of optionMap) {
      btn.classList.toggle("is-active", m === mode);
    }
  }

  function close() {
    if (anchor) anchor.classList.remove("is-picker-open");
    el.hidden = true;
    anchor = null;
  }

  function open(anchorEl, modeAtual) {
    if (!el.hidden && anchor === anchorEl) {
      close();
      return;
    }
    close();
    anchor = anchorEl;
    sync(modeAtual);
    anchorEl?.classList.add("is-picker-open");
    el.hidden = false;
    requestAnimationFrame(() => {
      position();
      requestAnimationFrame(position);
    });
  }

  window.addEventListener("resize", () => {
    if (!el.hidden) position();
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden) close();
  });
  document.addEventListener("click", () => {
    if (!el.hidden) close();
  });

  return { el, open, close, sync };
}
