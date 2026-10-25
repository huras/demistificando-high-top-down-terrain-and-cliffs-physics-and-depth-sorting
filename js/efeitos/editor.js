import {
  carregarCatalogoEfeitos,
  catalogoEfeitos,
  defaultsEfeitos,
  listaEfeitos,
} from "./catalogo.js";
import {
  carregarCatalogoElemental,
  catalogoElemental,
  listaTexturasElemental,
} from "./elemental.js";
import { sincronizarFolhasDoCatalogo, carregarFolhasGolpe } from "../pokemon/combate/folhasGolpe.js";
import { criarPreviewEfeitos } from "./preview.js";

const statusEl = document.getElementById("status");
const abasEl = document.getElementById("abas");
const listaEl = document.getElementById("lista");
const buscaEl = document.getElementById("busca");
const inspectorEl = document.getElementById("inspector");
const bancoEl = document.getElementById("banco");
const elfBrowserEl = document.getElementById("elf-browser");
const canvas = document.getElementById("vista");
const hudEl = document.getElementById("hud-perf");
const btnLoop = document.getElementById("loop");

/** @type {"orbe"|"rastro"|"impacto"} */
let papelElf = "rastro";

const KINDS = [
  { id: "todos", rotulo: "Todos" },
  { id: "projetil", rotulo: "Projétil" },
  { id: "jato", rotulo: "Jato" },
  { id: "feixe", rotulo: "Feixe" },
  { id: "raio", rotulo: "Raio" },
  { id: "status", rotulo: "Status" },
  { id: "melee", rotulo: "Melee" },
  { id: "overlay", rotulo: "Overlay" },
];

let kindAtivo = "todos";
let selecionado = "ember";
/** @type {ReturnType<typeof criarPreviewEfeitos> | null} */
let preview = null;
/** @type {{ id: string, url: string, frames: number }[]} */
let banco = [];

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function efeitoAtual() {
  return catalogoEfeitos().efeitos[selecionado] || null;
}

function lerPath(obj, path) {
  const partes = path.split(".");
  let cur = obj;
  for (const p of partes) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function escreverPath(obj, path, valor) {
  const partes = path.split(".");
  let cur = obj;
  for (let i = 0; i < partes.length - 1; i++) {
    const p = partes[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[partes[partes.length - 1]] = valor;
}

function camposDo(ef) {
  /** @type {{ path: string, tipo: string, min?: number, max?: number, step?: number, rotulo: string }[]} */
  const campos = [{ path: "nome", tipo: "texto", rotulo: "Nome" }];
  if (ef.folha) {
    campos.push(
      { path: "folha.url", tipo: "texto", rotulo: "URL folha" },
      { path: "folha.frames", tipo: "range", min: 1, max: 16, step: 1, rotulo: "Frames" },
      { path: "folha.duracaoFrame", tipo: "range", min: 0.02, max: 0.3, step: 0.01, rotulo: "Dur. frame" },
      { path: "folha.escalaVoo", tipo: "range", min: 0.05, max: 4, step: 0.01, rotulo: "Escala voo" },
      { path: "folha.escalaImpacto", tipo: "range", min: 0.05, max: 4, step: 0.01, rotulo: "Escala impacto" },
      { path: "folha.offsetAngulo", tipo: "range", min: -3.14, max: 3.14, step: 0.01, rotulo: "Offset ângulo" },
      { path: "folha.giro", tipo: "range", min: 0, max: 8, step: 0.1, rotulo: "Giro (rps)" },
    );
  }
  if (ef.disparo) {
    campos.push(
      { path: "disparo.n", tipo: "range", min: 1, max: 12, step: 1, rotulo: "Pellets" },
      { path: "disparo.graus", tipo: "range", min: 0, max: 45, step: 1, rotulo: "Espalhamento°" },
      { path: "disparo.vel", tipo: "range", min: 4, max: 24, step: 0.1, rotulo: "Velocidade" },
    );
  }
  if (ef.feixe) {
    campos.push(
      { path: "feixe.largura", tipo: "range", min: 0.1, max: 1.5, step: 0.01, rotulo: "Largura" },
      { path: "feixe.alcance", tipo: "range", min: 4, max: 20, step: 0.5, rotulo: "Alcance" },
      { path: "feixe.primaria", tipo: "cor", rotulo: "Primária" },
      { path: "feixe.secundaria", tipo: "cor", rotulo: "Secundária" },
      { path: "feixe.nucleo", tipo: "cor", rotulo: "Núcleo" },
    );
  }
  if (ef.status) {
    campos.push(
      { path: "status.alcance", tipo: "range", min: 2, max: 14, step: 0.5, rotulo: "Alcance" },
      { path: "status.duracao", tipo: "range", min: 0.2, max: 2, step: 0.01, rotulo: "Duração" },
    );
  }
  if (ef.orbe) {
    campos.push(
      { path: "orbe.escala", tipo: "range", min: 0.1, max: 1, step: 0.01, rotulo: "Escala orbe" },
      { path: "orbe.cor", tipo: "cor", rotulo: "Cor orbe" },
    );
  }
  return campos;
}

function montarAbas() {
  abasEl.innerHTML = "";
  for (const k of KINDS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = k.rotulo;
    btn.className = k.id === kindAtivo ? "is-ativo" : "";
    btn.addEventListener("click", () => {
      kindAtivo = k.id;
      montarAbas();
      montarLista();
    });
    abasEl.appendChild(btn);
  }
}

function montarLista() {
  const q = (buscaEl.value || "").trim().toLowerCase();
  listaEl.innerHTML = "";
  const todos = listaEfeitos().filter((ef) => {
    if (kindAtivo !== "todos" && ef.kind !== kindAtivo) return false;
    if (!q) return true;
    return (ef.id + " " + (ef.nome || "")).toLowerCase().includes(q);
  });
  for (const ef of todos) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${ef.nome || ef.id} · ${ef.kind}`;
    btn.className = ef.id === selecionado ? "is-ativo" : "";
    btn.addEventListener("click", () => {
      selecionado = ef.id;
      montarLista();
      montarInspector();
      preview?.setEfeito(selecionado);
      preview?.disparar(selecionado);
    });
    li.appendChild(btn);
    listaEl.appendChild(li);
  }
}

function vincularElf(ef, papel, idTex) {
  if (!ef.elf || typeof ef.elf !== "object") ef.elf = {};
  ef.elf[papel] = idTex || "";
  if (papel === "orbe") {
    if (!ef.orbe || typeof ef.orbe !== "object") ef.orbe = { escala: 0.32 };
    ef.orbe.elf = idTex || "";
  }
  if (papel === "rastro" && ef.orbe && typeof ef.orbe === "object") {
    ef.orbe.rastroElf = idTex || "";
  }
  if ((ef.kind === "feixe" || ef.kind === "raio") && papel === "orbe") {
    if (!ef.feixe || typeof ef.feixe !== "object") ef.feixe = {};
    ef.feixe.modo = "stretch";
    ef.feixe.textura = idTex || "";
    if (!ef.feixe.lengthScale) ef.feixe.lengthScale = 3;
  }
}

function montarBrowserElf() {
  if (!elfBrowserEl) return;
  elfBrowserEl.innerHTML = "";
  const ef = efeitoAtual();
  if (!ef) {
    elfBrowserEl.innerHTML = "<p class='nota'>Selecione um efeito.</p>";
    return;
  }
  const binds = document.createElement("p");
  binds.className = "nota elf-browser__binds";
  const e = ef.elf || {};
  binds.textContent = `orbe: ${e.orbe || ef.orbe?.elf || "—"}${
    ef.feixe?.textura ? ` · feixe: ${ef.feixe.textura}` : ""
  } · rastro: ${e.rastro || ef.orbe?.rastroElf || "—"} · impacto: ${e.impacto || "—"}`;
  elfBrowserEl.appendChild(binds);

  const papeis = document.createElement("div");
  papeis.className = "elf-browser__papeis";
  for (const p of [
    { id: "orbe", rotulo: "Orbe/feixe" },
    { id: "rastro", rotulo: "Rastro" },
    { id: "impacto", rotulo: "Impacto" },
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.rotulo;
    if (papelElf === p.id) btn.classList.add("ativo");
    btn.addEventListener("click", () => {
      papelElf = /** @type {"orbe"|"rastro"|"impacto"} */ (p.id);
      montarBrowserElf();
    });
    papeis.appendChild(btn);
  }
  elfBrowserEl.appendChild(papeis);

  const grade = document.createElement("div");
  grade.className = "elf-browser__grade";
  const quentes = catalogoElemental().quentes || [];
  let itens = listaTexturasElemental();
  if (quentes.length) {
    const ordem = new Map(quentes.map((id, i) => [id, i]));
    itens = [...itens].sort((a, b) => (ordem.get(a.id) ?? 999) - (ordem.get(b.id) ?? 999));
  }
  const ativoId =
    papelElf === "orbe"
      ? ef.elf?.orbe || ef.orbe?.elf || ef.feixe?.textura || ""
      : papelElf === "rastro"
        ? ef.elf?.rastro || ef.orbe?.rastroElf || ""
        : ef.elf?.impacto || "";
  for (const tex of itens) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "elf-browser__item";
    if (tex.id === ativoId) btn.classList.add("ativo");
    const cols = tex.cols || 1;
    const rows = tex.rows || 1;
    const lay = cols * rows > 1 ? `${cols}×${rows}` : "1×1";
    btn.title = `${tex.id} · ${tex.blend || "additive"} · folha ${lay} · ${tex.anim || "estatico"}`;
    btn.style.backgroundImage = `url(${tex.path})`;
    if (tex.blend === "additive") btn.classList.add("is-additive");
    const cap = document.createElement("span");
    cap.textContent = `${tex.id.replace(/_/g, " ")} ${lay}`;
    btn.appendChild(cap);
    btn.addEventListener("click", () => {
      vincularElf(ef, papelElf, tex.id);
      sincronizarFolhasDoCatalogo();
      carregarFolhasGolpe();
      montarInspector();
      montarBrowserElf();
      preview?.disparar(selecionado);
      setStatus(`${tex.id} → ${selecionado}.${papelElf}`);
    });
    grade.appendChild(btn);
  }
  elfBrowserEl.appendChild(grade);
}

function montarInspector() {
  const ef = efeitoAtual();
  inspectorEl.innerHTML = "";
  if (!ef) return;
  const campos = camposDo(ef);
  for (const c of campos) {
    const wrap = document.createElement("label");
    wrap.className = "campo";
    const titulo = document.createElement("span");
    titulo.textContent = c.rotulo;
    wrap.appendChild(titulo);
    let input;
    const valor = lerPath(ef, c.path);
    if (c.tipo === "cor") {
      input = document.createElement("input");
      input.type = "color";
      input.value = String(valor || "#ffffff");
    } else if (c.tipo === "texto") {
      input = document.createElement("input");
      input.type = "text";
      input.value = String(valor ?? "");
    } else {
      input = document.createElement("input");
      input.type = "range";
      input.min = String(c.min ?? 0);
      input.max = String(c.max ?? 1);
      input.step = String(c.step ?? 0.01);
      input.value = String(valor ?? 0);
      const valEl = document.createElement("em");
      valEl.textContent = String(valor ?? 0);
      wrap.appendChild(valEl);
      input.addEventListener("input", () => {
        valEl.textContent = input.value;
      });
    }
    input.addEventListener("change", () => {
      let v = input.value;
      if (c.tipo === "range") v = Number(v);
      escreverPath(ef, c.path, v);
      sincronizarFolhasDoCatalogo();
      carregarFolhasGolpe();
      preview?.disparar(selecionado);
    });
    wrap.appendChild(input);
    inspectorEl.appendChild(wrap);
  }
  montarBrowserElf();
}

async function carregarBanco() {
  bancoEl.innerHTML = "<p class='banco__meta'>Carregando banco…</p>";
  try {
    const res = await fetch("/api/efeitos/banco");
    if (!res.ok) throw new Error("falha banco");
    banco = await res.json();
  } catch {
    banco = [];
  }
  bancoEl.innerHTML = "";
  if (!banco.length) {
    bancoEl.innerHTML = "<p class='banco__meta'>Rode o import ou inicie o servidor local.</p>";
    return;
  }
  for (const item of banco.slice(0, 80)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "banco__item";
    btn.title = `${item.id} · ${item.frames}f`;
    btn.style.backgroundImage = `url(${item.url})`;
    btn.addEventListener("click", () => {
      const ef = efeitoAtual();
      if (!ef || (ef.kind !== "projetil" && ef.kind !== "jato" && ef.kind !== "overlay")) {
        setStatus("Selecione um efeito projetil/jato para atribuir folha");
        return;
      }
      if (!ef.folha) ef.folha = {};
      ef.folha.url = item.url;
      ef.folha.frames = item.frames || 1;
      ef.folha.fw = item.fw || 32;
      ef.folha.fh = item.fh || item.fw || 32;
      sincronizarFolhasDoCatalogo();
      carregarFolhasGolpe();
      montarInspector();
      preview?.disparar(selecionado);
      setStatus(`Folha ${item.id} → ${selecionado}`);
    });
    bancoEl.appendChild(btn);
  }
}

async function salvar() {
  const cat = catalogoEfeitos();
  setStatus("Salvando…");
  try {
    const res = await fetch("/api/efeitos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cat),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.erro || res.statusText);
    }
    setStatus("Salvo em assets/efeitos/catalogo.json");
  } catch (e) {
    setStatus(`Erro ao salvar: ${e.message || e}`);
  }
}

function resetPreset() {
  const defs = defaultsEfeitos();
  const base = defs.efeitos[selecionado];
  if (!base) return;
  catalogoEfeitos().efeitos[selecionado] = JSON.parse(JSON.stringify(base));
  sincronizarFolhasDoCatalogo();
  montarInspector();
  preview?.disparar(selecionado);
  setStatus(`Reset ${selecionado}`);
}

async function boot() {
  await Promise.all([carregarCatalogoEfeitos(), carregarCatalogoElemental()]);
  sincronizarFolhasDoCatalogo();
  carregarFolhasGolpe();
  montarAbas();
  montarLista();
  montarInspector();
  preview = criarPreviewEfeitos(canvas, hudEl);
  preview.disparar(selecionado);
  await carregarBanco();
  setStatus(
    `${listaEfeitos().length} efeitos · ${listaTexturasElemental().length} texturas Elemental`,
  );
}

buscaEl.addEventListener("input", montarLista);
document.getElementById("disparar")?.addEventListener("click", () => preview?.disparar(selecionado));
document.getElementById("limpar")?.addEventListener("click", () => preview?.limpar());
btnLoop?.addEventListener("click", () => {
  const on = !preview?.getLoop();
  preview?.setLoop(on);
  btnLoop.classList.toggle("is-ativo", on);
});
document.getElementById("salvar")?.addEventListener("click", salvar);
document.getElementById("reset-preset")?.addEventListener("click", resetPreset);

boot();
