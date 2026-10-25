import {
  aplicarCatalogoEfeitos,
  carregarCatalogoEfeitos,
  catalogoEfeitos,
  defaultsEfeitos,
  listaEfeitos,
} from "../efeitos/catalogo.js";
import {
  carregarCatalogoElemental,
  catalogoElemental,
  listaTexturasElemental,
} from "../efeitos/elemental.js";
import { carregarFolhasGolpe, sincronizarFolhasDoCatalogo } from "../pokemon/combate/folhasGolpe.js";
import {
  aplicarCatalogoParticulas,
  catalogoParticulas,
  defaultsParticulas,
  idsElemento,
} from "./catalogo.js";
import { criarPreviewParticulas } from "./preview.js";

/** @type {"orbe"|"rastro"|"impacto"} */
let papelElf = "rastro";

const statusEl = document.getElementById("status");
const abasEl = document.getElementById("abas");
const listaEl = document.getElementById("lista");
const buscaEl = document.getElementById("busca");
const inspectorEl = document.getElementById("inspector");
const canvas = document.getElementById("vista");
const hudEl = document.getElementById("hud-perf");
const btnLoop = document.getElementById("loop");

const CATEGORIAS = [
  { id: "efeitos", rotulo: "Efeitos" },
  { id: "combate", rotulo: "Combate" },
  { id: "passo", rotulo: "Passo" },
  { id: "campo", rotulo: "Campo" },
  { id: "agua", rotulo: "Água" },
  { id: "bola", rotulo: "Bola" },
];

const ROTULOS = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Veneno",
  ground: "Terra",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada",
  andar: "Andar",
  correr: "Correr",
  fagulha: "Fagulha",
  fagulhaForte: "Fagulha forte",
  lasca: "Lasca",
  onda: "Onda",
  gota: "Gota",
  pegada: "Pegada",
  nado: "Nado (bob)",
  envio: "Envio",
  recolher: "Recolher",
  shiny: "Shiny / arrasto",
};

/** @type {Record<string, { path: string, tipo: string, min?: number, max?: number, step?: number, rotulo: string }[]>} */
const CAMPOS = {
  combate: [
    { path: "primaria", tipo: "cor", rotulo: "Primária" },
    { path: "secundaria", tipo: "cor", rotulo: "Secundária" },
    { path: "nucleo", tipo: "cor", rotulo: "Núcleo" },
    { path: "rastro.taxa", tipo: "range", min: 0, max: 60, step: 1, rotulo: "Rastro taxa" },
    { path: "rastro.vida", tipo: "range", min: 0.05, max: 1.5, step: 0.01, rotulo: "Rastro vida" },
    { path: "rastro.dispersao", tipo: "range", min: 0, max: 4, step: 0.05, rotulo: "Rastro dispersão" },
    { path: "impacto.particulas", tipo: "range", min: 4, max: 64, step: 1, rotulo: "Impacto qtd" },
    { path: "impacto.raio", tipo: "range", min: 0.1, max: 1.5, step: 0.01, rotulo: "Impacto raio" },
    { path: "impacto.duracao", tipo: "range", min: 0.05, max: 1.5, step: 0.01, rotulo: "Impacto duração" },
    { path: "impacto.gravidade", tipo: "range", min: -4, max: 8, step: 0.05, rotulo: "Impacto gravidade" },
  ],
  passo: [
    { path: "intervalo", tipo: "range", min: 0.04, max: 1.2, step: 0.01, rotulo: "Intervalo" },
    { path: "bolas", tipo: "range", min: 1, max: 6, step: 1, rotulo: "Bolas" },
    { path: "tam0", tipo: "range", min: 0.1, max: 1.5, step: 0.01, rotulo: "Tam inicial" },
    { path: "tam1", tipo: "range", min: 0.2, max: 2.5, step: 0.01, rotulo: "Tam final" },
    { path: "espalha", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Espalha" },
    { path: "dur", tipo: "range", min: 0.1, max: 2, step: 0.01, rotulo: "Duração" },
    { path: "atras", tipo: "range", min: 0, max: 0.8, step: 0.01, rotulo: "Atraso" },
    { path: "alfa", tipo: "range", min: 0.05, max: 1, step: 0.01, rotulo: "Alfa" },
  ],
  campoFagulha: [
    { path: "baseBaixa", tipo: "range", min: 0, max: 2, step: 0.01, rotulo: "Base baixa" },
    { path: "baseAlta", tipo: "range", min: 0, max: 3, step: 0.01, rotulo: "Base alta" },
    { path: "espalha", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Espalha" },
    { path: "velMin", tipo: "range", min: 0, max: 2, step: 0.01, rotulo: "Vel mín" },
    { path: "velExtra", tipo: "range", min: 0, max: 2, step: 0.01, rotulo: "Vel extra" },
    { path: "vzMin", tipo: "range", min: 0, max: 3, step: 0.01, rotulo: "Vz mín" },
    { path: "vzExtra", tipo: "range", min: 0, max: 3, step: 0.01, rotulo: "Vz extra" },
    { path: "vidaMin", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Vida mín" },
    { path: "vidaExtra", tipo: "range", min: 0, max: 1.5, step: 0.01, rotulo: "Vida extra" },
    { path: "chanceFuma", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Chance fumaça" },
    { path: "chanceQuente", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Chance quente" },
  ],
  campoFagulhaForte: [
    { path: "vzExtra", tipo: "range", min: 0, max: 4, step: 0.01, rotulo: "Vz extra" },
    { path: "vidaMin", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Vida mín" },
    { path: "vidaExtra", tipo: "range", min: 0, max: 1.5, step: 0.01, rotulo: "Vida extra" },
  ],
  campoLasca: [
    { path: "zMin", tipo: "range", min: 0, max: 2, step: 0.01, rotulo: "Z mín" },
    { path: "zExtra", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Z extra" },
    { path: "velMin", tipo: "range", min: 0, max: 4, step: 0.01, rotulo: "Vel mín" },
    { path: "velExtra", tipo: "range", min: 0, max: 4, step: 0.01, rotulo: "Vel extra" },
    { path: "vzMin", tipo: "range", min: 0, max: 4, step: 0.01, rotulo: "Vz mín" },
    { path: "vzExtra", tipo: "range", min: 0, max: 4, step: 0.01, rotulo: "Vz extra" },
    { path: "vidaMin", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Vida mín" },
    { path: "vidaExtra", tipo: "range", min: 0, max: 1.5, step: 0.01, rotulo: "Vida extra" },
    { path: "corR", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Cor R" },
    { path: "corG", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Cor G" },
    { path: "corB", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Cor B" },
    { path: "grav", tipo: "range", min: 0, max: 20, step: 0.1, rotulo: "Gravidade" },
  ],
  aguaOnda: [
    { path: "intervalo", tipo: "range", min: 0.02, max: 1, step: 0.01, rotulo: "Intervalo" },
    { path: "intervaloParado", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Intervalo parado" },
    { path: "vida", tipo: "range", min: 0.1, max: 3, step: 0.01, rotulo: "Vida" },
    { path: "rx", tipo: "range", min: 0.1, max: 3, step: 0.01, rotulo: "Raio X" },
    { path: "cresce", tipo: "range", min: 1, max: 6, step: 0.05, rotulo: "Cresce" },
    { path: "ry", tipo: "range", min: 0.05, max: 1.5, step: 0.01, rotulo: "Escala Y" },
    { path: "atras", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Atraso" },
    { path: "passo", tipo: "range", min: 0.001, max: 0.2, step: 0.001, rotulo: "Passo mín" },
    { path: "imersaoMin", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Imersão mín" },
    { path: "offsetLamina", tipo: "range", min: 0, max: 1, step: 0.01, rotulo: "Offset lâmina" },
  ],
  aguaGota: [
    { path: "vida", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Vida" },
    { path: "grav", tipo: "range", min: 1, max: 40, step: 0.1, rotulo: "Gravidade" },
    { path: "rajada", tipo: "range", min: 1, max: 20, step: 1, rotulo: "Rajada" },
    { path: "pinga", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Pinga" },
    { path: "molhaSeg", tipo: "range", min: 0.5, max: 20, step: 0.1, rotulo: "Molha (s)" },
  ],
  aguaPegada: [
    { path: "carga", tipo: "range", min: 1, max: 20, step: 1, rotulo: "Carga" },
    { path: "dist", tipo: "range", min: 0.1, max: 2, step: 0.01, rotulo: "Distância" },
    { path: "intervalo", tipo: "range", min: 0.02, max: 1, step: 0.01, rotulo: "Intervalo" },
    { path: "vel", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Vel mín" },
    { path: "vida", tipo: "range", min: 0.5, max: 20, step: 0.1, rotulo: "Vida" },
    { path: "tam", tipo: "range", min: 0.05, max: 1, step: 0.01, rotulo: "Tamanho" },
    { path: "lateral", tipo: "range", min: 0, max: 0.6, step: 0.01, rotulo: "Lateral" },
    { path: "cheio", tipo: "range", min: 0.1, max: 0.95, step: 0.01, rotulo: "Cheio" },
  ],
  aguaNado: [
    { path: "bobA", tipo: "range", min: 0, max: 0.3, step: 0.005, rotulo: "Bob A" },
    { path: "bobB", tipo: "range", min: 0, max: 0.3, step: 0.005, rotulo: "Bob B" },
    { path: "bobParado", tipo: "range", min: 0.1, max: 2, step: 0.01, rotulo: "Bob parado" },
  ],
  bolaBurst: [
    { path: "raio", tipo: "range", min: 0.1, max: 2, step: 0.01, rotulo: "Raio" },
    { path: "vidaAnel", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Vida anel" },
    { path: "vidaFlash", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Vida flash" },
    { path: "brancoR", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Branco R" },
    { path: "brancoG", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Branco G" },
    { path: "brancoB", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Branco B" },
    { path: "vermelhoR", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Vermelho R" },
    { path: "vermelhoG", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Vermelho G" },
    { path: "vermelhoB", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Vermelho B" },
    { path: "faiscaConta", tipo: "range", min: 2, max: 48, step: 1, rotulo: "Faiscas" },
    { path: "faiscaVida", tipo: "range", min: 0.05, max: 2, step: 0.01, rotulo: "Faisca vida" },
    { path: "faiscaVelMin", tipo: "range", min: 0.2, max: 12, step: 0.1, rotulo: "Vel mín" },
    { path: "faiscaVelMax", tipo: "range", min: 0.5, max: 16, step: 0.1, rotulo: "Vel máx" },
    { path: "faiscaTamMin", tipo: "range", min: 0.01, max: 0.4, step: 0.005, rotulo: "Tam mín" },
    { path: "faiscaTamMax", tipo: "range", min: 0.02, max: 0.5, step: 0.005, rotulo: "Tam máx" },
    { path: "puxa", tipo: "range", min: 0, max: 40, step: 0.5, rotulo: "Puxa" },
  ],
  bolaShiny: [
    { path: "douradoR", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Dourado R" },
    { path: "douradoG", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Dourado G" },
    { path: "douradoB", tipo: "range", min: 0, max: 255, step: 1, rotulo: "Dourado B" },
    { path: "arrasto", tipo: "range", min: 0.5, max: 12, step: 0.1, rotulo: "Arrasto" },
  ],
  efeitoFolha: [
    { path: "folha.frames", tipo: "range", min: 1, max: 16, step: 1, rotulo: "Frames" },
    { path: "folha.duracaoFrame", tipo: "range", min: 0.02, max: 0.3, step: 0.01, rotulo: "Dur. frame" },
    { path: "folha.escalaVoo", tipo: "range", min: 0.05, max: 4, step: 0.01, rotulo: "Escala voo" },
    { path: "folha.escalaImpacto", tipo: "range", min: 0.05, max: 4, step: 0.01, rotulo: "Escala impacto" },
    { path: "folha.offsetAngulo", tipo: "range", min: -3.14, max: 3.14, step: 0.01, rotulo: "Offset ângulo" },
    { path: "folha.giro", tipo: "range", min: 0, max: 8, step: 0.1, rotulo: "Giro (rps)" },
  ],
  efeitoDisparo: [
    { path: "disparo.n", tipo: "range", min: 1, max: 12, step: 1, rotulo: "Pellets" },
    { path: "disparo.graus", tipo: "range", min: 0, max: 45, step: 1, rotulo: "Espalhamento°" },
    { path: "disparo.vel", tipo: "range", min: 4, max: 24, step: 0.1, rotulo: "Velocidade" },
  ],
  efeitoFeixe: [
    { path: "feixe.largura", tipo: "range", min: 0.1, max: 1.5, step: 0.01, rotulo: "Largura" },
    { path: "feixe.alcance", tipo: "range", min: 4, max: 20, step: 0.5, rotulo: "Alcance" },
    { path: "feixe.lengthScale", tipo: "range", min: 1, max: 5, step: 0.1, rotulo: "LengthScale" },
    { path: "feixe.primaria", tipo: "cor", rotulo: "Primária" },
    { path: "feixe.secundaria", tipo: "cor", rotulo: "Secundária" },
    { path: "feixe.nucleo", tipo: "cor", rotulo: "Núcleo" },
  ],
  efeitoStatus: [
    { path: "status.alcance", tipo: "range", min: 2, max: 14, step: 0.5, rotulo: "Alcance" },
    { path: "status.duracao", tipo: "range", min: 0.2, max: 2, step: 0.01, rotulo: "Duração" },
  ],
  efeitoOrbe: [
    { path: "orbe.escala", tipo: "range", min: 0.1, max: 1, step: 0.01, rotulo: "Escala orbe" },
  ],
};

/** @type {object} */
let catalogo = defaultsParticulas();
/** @type {object} */
let catalogoFx = defaultsEfeitos();
let sujo = false;
let sujoFx = false;
let categoria = "efeitos";
let presetId = "ember";
const preview = criarPreviewParticulas(canvas, hudEl);

function dizer(texto) {
  statusEl.textContent = texto;
}

function marcarSujo() {
  if (categoria === "efeitos") {
    if (!sujoFx) {
      sujoFx = true;
      dizer("Efeito alterado — não salvo.");
    }
    return;
  }
  if (!sujo) {
    sujo = true;
    dizer("Alterado — não salvo.");
  }
}

function lerPath(obj, path) {
  const partes = path.split(".");
  let cur = obj;
  for (let i = 0; i < partes.length; i++) {
    if (cur == null) return undefined;
    cur = cur[partes[i]];
  }
  return cur;
}

function escreverPath(obj, path, valor) {
  const partes = path.split(".");
  let cur = obj;
  for (let i = 0; i < partes.length - 1; i++) {
    if (!cur[partes[i]] || typeof cur[partes[i]] !== "object") cur[partes[i]] = {};
    cur = cur[partes[i]];
  }
  cur[partes[partes.length - 1]] = valor;
}

function objetoPreset() {
  if (categoria === "efeitos") return catalogoFx.efeitos[presetId] || null;
  if (categoria === "combate") return catalogo.combate.elementos[presetId];
  if (categoria === "passo") return catalogo.passo[presetId];
  if (categoria === "campo") return catalogo.campo[presetId];
  if (categoria === "agua") return catalogo.agua[presetId];
  if (categoria === "bola") return catalogo.bola[presetId];
  return null;
}

function schemaCampos() {
  if (categoria === "efeitos") {
    const ef = catalogoFx.efeitos[presetId];
    if (!ef) return [];
    /** @type {typeof CAMPOS.efeitoFolha} */
    const out = [];
    if (ef.folha) out.push(...CAMPOS.efeitoFolha);
    if (ef.disparo) out.push(...CAMPOS.efeitoDisparo);
    if (ef.feixe) out.push(...CAMPOS.efeitoFeixe);
    if (ef.status) out.push(...CAMPOS.efeitoStatus);
    if (ef.orbe) out.push(...CAMPOS.efeitoOrbe);
    return out;
  }
  if (categoria === "combate") return CAMPOS.combate;
  if (categoria === "passo") return CAMPOS.passo;
  if (categoria === "campo") {
    if (presetId === "fagulhaForte") return CAMPOS.campoFagulhaForte;
    if (presetId === "lasca") return CAMPOS.campoLasca;
    return CAMPOS.campoFagulha;
  }
  if (categoria === "agua") {
    if (presetId === "gota") return CAMPOS.aguaGota;
    if (presetId === "pegada") return CAMPOS.aguaPegada;
    if (presetId === "nado") return CAMPOS.aguaNado;
    return CAMPOS.aguaOnda;
  }
  if (categoria === "bola") {
    if (presetId === "shiny") return CAMPOS.bolaShiny;
    return CAMPOS.bolaBurst;
  }
  return [];
}

function idsDaCategoria() {
  if (categoria === "efeitos") return listaEfeitos().map((e) => e.id);
  if (categoria === "combate") return idsElemento();
  if (categoria === "passo") return ["andar", "correr"];
  if (categoria === "campo") return ["fagulha", "fagulhaForte", "lasca"];
  if (categoria === "agua") return ["onda", "gota", "pegada", "nado"];
  if (categoria === "bola") return ["envio", "recolher", "shiny"];
  return [];
}

function rotuloPreset(id) {
  if (categoria === "efeitos") {
    const ef = catalogoFx.efeitos[id];
    if (!ef) return id;
    return `${ef.nome || id} · ${ef.kind}`;
  }
  return ROTULOS[id] || id;
}

function sincronizarRuntime() {
  aplicarCatalogoParticulas(catalogo);
  if (categoria === "efeitos") {
    aplicarCatalogoEfeitos(catalogoFx);
    sincronizarFolhasDoCatalogo();
    carregarFolhasGolpe();
  }
  preview.definirSelecao(categoria, presetId);
}

function pintarAbas() {
  abasEl.innerHTML = "";
  for (let i = 0; i < CATEGORIAS.length; i++) {
    const c = CATEGORIAS[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = c.rotulo;
    if (c.id === categoria) btn.classList.add("ativo");
    btn.addEventListener("click", () => {
      categoria = c.id;
      const ids = idsDaCategoria();
      presetId = ids[0];
      preview.limpar();
      pintarAbas();
      pintarLista();
      pintarInspector();
      sincronizarRuntime();
      preview.disparar();
    });
    abasEl.appendChild(btn);
  }
}

function pintarLista() {
  const filtro = (buscaEl.value || "").trim().toLowerCase();
  listaEl.innerHTML = "";
  const ids = idsDaCategoria();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const nome = rotuloPreset(id);
    if (filtro && !nome.toLowerCase().includes(filtro) && !id.includes(filtro)) continue;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = nome;
    if (id === presetId) btn.classList.add("ativo");
    btn.addEventListener("click", () => {
      presetId = id;
      pintarLista();
      pintarInspector();
      sincronizarRuntime();
      preview.disparar();
    });
    li.appendChild(btn);
    listaEl.appendChild(li);
  }
}

function formatarValor(n, step) {
  if (!Number.isFinite(n)) return "—";
  if (step >= 1) return String(Math.round(n));
  if (step <= 0.005) return n.toFixed(3);
  if (step <= 0.05) return n.toFixed(2);
  return n.toFixed(2);
}

function vincularElf(ef, papel, idTex) {
  if (!ef.elf || typeof ef.elf !== "object") ef.elf = {};
  ef.elf[papel] = idTex || "";
  if (papel === "orbe") {
    if (!ef.orbe || typeof ef.orbe !== "object") ef.orbe = { escala: 0.32 };
    ef.orbe.elf = idTex || "";
  }
  if (papel === "rastro") {
    if (ef.orbe && typeof ef.orbe === "object") ef.orbe.rastroElf = idTex || "";
  }
  if ((ef.kind === "feixe" || ef.kind === "raio") && papel === "orbe") {
    if (!ef.feixe || typeof ef.feixe !== "object") ef.feixe = {};
    ef.feixe.modo = "stretch";
    ef.feixe.textura = idTex || "";
    if (!ef.feixe.lengthScale) ef.feixe.lengthScale = 3;
  }
}

function pintarBrowserElf(alvo) {
  const bloco = document.createElement("div");
  bloco.className = "elf-browser";

  const titulo = document.createElement("h3");
  titulo.className = "elf-browser__titulo";
  titulo.textContent = "Elemental Free";
  bloco.appendChild(titulo);

  const binds = document.createElement("p");
  binds.className = "nota elf-browser__binds";
  const e = alvo.elf || {};
  binds.textContent = `orbe: ${e.orbe || alvo.orbe?.elf || "—"}${
    alvo.feixe?.textura ? ` · feixe: ${alvo.feixe.textura}` : ""
  } · rastro: ${e.rastro || alvo.orbe?.rastroElf || "—"} · impacto: ${e.impacto || "—"}`;
  bloco.appendChild(binds);

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
      pintarInspector();
    });
    papeis.appendChild(btn);
  }
  bloco.appendChild(papeis);

  const limpar = document.createElement("button");
  limpar.type = "button";
  limpar.className = "elf-browser__limpar";
  limpar.textContent = `Limpar ${papelElf}`;
  limpar.addEventListener("click", () => {
    vincularElf(alvo, papelElf, "");
    marcarSujo();
    sincronizarRuntime();
    pintarInspector();
    preview.disparar();
  });
  bloco.appendChild(limpar);

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
      ? alvo.elf?.orbe || alvo.orbe?.elf || alvo.feixe?.textura || ""
      : papelElf === "rastro"
        ? alvo.elf?.rastro || alvo.orbe?.rastroElf || ""
        : alvo.elf?.impacto || "";

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
      vincularElf(alvo, papelElf, tex.id);
      marcarSujo();
      sincronizarRuntime();
      pintarInspector();
      preview.disparar();
      dizer(`${tex.id} → ${presetId}.${papelElf}`);
    });
    grade.appendChild(btn);
  }
  if (!itens.length) {
    const vazio = document.createElement("p");
    vazio.className = "nota";
    vazio.textContent = "Catálogo Elemental vazio — rode o script de import.";
    bloco.appendChild(vazio);
  } else {
    bloco.appendChild(grade);
  }
  inspectorEl.appendChild(bloco);
}

function pintarInspector() {
  inspectorEl.innerHTML = "";
  const alvo = objetoPreset();
  if (!alvo) {
    inspectorEl.textContent = "Preset não encontrado.";
    return;
  }
  if (categoria === "efeitos") {
    const meta = document.createElement("p");
    meta.className = "nota";
    meta.textContent = `kind: ${alvo.kind}${alvo.folha?.url ? " · folha" : ""}${alvo.visual ? ` · visual ${alvo.visual}` : ""}`;
    inspectorEl.appendChild(meta);
  }
  const campos = schemaCampos();
  if (!campos.length && categoria === "efeitos") {
    const dica = document.createElement("p");
    dica.className = "nota";
    dica.textContent = "Sem parâmetros numéricos — Disparar pra ver o padrão.";
    inspectorEl.appendChild(dica);
  }
  for (let i = 0; i < campos.length; i++) {
    const def = campos[i];
    if (def.path === "puxa" && presetId !== "recolher") continue;
    const label = document.createElement("label");
    label.className = "campo";
    const valorAtual = lerPath(alvo, def.path);
    const valorEl = document.createElement("strong");
    valorEl.textContent = def.tipo === "cor" ? "" : formatarValor(Number(valorAtual), def.step || 0.01);
    label.appendChild(document.createTextNode(def.rotulo + " "));
    if (def.tipo !== "cor") label.appendChild(valorEl);

    let input;
    if (def.tipo === "cor") {
      input = document.createElement("input");
      input.type = "color";
      input.value = typeof valorAtual === "string" ? valorAtual : "#ffffff";
      input.addEventListener("input", () => {
        escreverPath(alvo, def.path, input.value);
        marcarSujo();
        sincronizarRuntime();
      });
    } else {
      input = document.createElement("input");
      input.type = "range";
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(valorAtual ?? def.min);
      input.addEventListener("input", () => {
        const n = Number(input.value);
        escreverPath(alvo, def.path, n);
        valorEl.textContent = formatarValor(n, def.step);
        marcarSujo();
        sincronizarRuntime();
      });
    }
    label.appendChild(input);
    inspectorEl.appendChild(label);
  }
  if (categoria === "efeitos") pintarBrowserElf(alvo);
}

function resetPreset() {
  if (categoria === "efeitos") {
    const base = defaultsEfeitos();
    if (base.efeitos[presetId]) {
      catalogoFx.efeitos[presetId] = structuredClone(base.efeitos[presetId]);
    }
  } else {
    const base = defaultsParticulas();
    if (categoria === "combate") {
      catalogo.combate.elementos[presetId] = structuredClone(base.combate.elementos[presetId]);
    } else if (categoria === "passo") {
      catalogo.passo[presetId] = structuredClone(base.passo[presetId]);
    } else if (categoria === "campo") {
      catalogo.campo[presetId] = structuredClone(base.campo[presetId]);
    } else if (categoria === "agua") {
      catalogo.agua[presetId] = structuredClone(base.agua[presetId]);
    } else if (categoria === "bola") {
      catalogo.bola[presetId] = structuredClone(base.bola[presetId]);
    }
  }
  marcarSujo();
  pintarInspector();
  sincronizarRuntime();
  preview.disparar();
  dizer(`Reset: ${rotuloPreset(presetId)}`);
}

document.getElementById("disparar").addEventListener("click", () => {
  sincronizarRuntime();
  preview.disparar();
});

btnLoop.addEventListener("click", () => {
  const on = preview.alternarLoop();
  btnLoop.textContent = on ? "Loop on" : "Loop";
  btnLoop.classList.toggle("ativo", on);
});

document.getElementById("limpar").addEventListener("click", () => preview.limpar());
document.getElementById("reset-preset").addEventListener("click", resetPreset);
buscaEl.addEventListener("input", pintarLista);

function payloadSalvar() {
  const out = structuredClone(catalogo);
  const els = out.combate?.elementos || {};
  for (const id of Object.keys(els)) {
    if (els[id] && typeof els[id] === "object") delete els[id].id;
  }
  return out;
}

document.getElementById("salvar").addEventListener("click", async () => {
  dizer("Salvando…");
  sincronizarRuntime();
  if (categoria === "efeitos" || sujoFx) {
    const resFx = await fetch("/api/efeitos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catalogoFx),
    });
    const jsonFx = await resFx.json().catch(() => ({}));
    if (!resFx.ok) {
      dizer(jsonFx.erro || "Não salvou efeitos.");
      return;
    }
    sujoFx = false;
  }
  if (categoria !== "efeitos" || sujo) {
    const res = await fetch("/api/particulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadSalvar()),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      dizer(json.erro || "Não salvou partículas.");
      return;
    }
    sujo = false;
  }
  dizer(categoria === "efeitos" ? "Efeitos salvos." : "Catálogo salvo.");
});

async function iniciar() {
  await Promise.all([carregarCatalogoEfeitos(), carregarCatalogoElemental()]);
  catalogoFx = structuredClone(catalogoEfeitos());
  sincronizarFolhasDoCatalogo();
  carregarFolhasGolpe();

  const res = await fetch("/assets/particulas/catalogo.json");
  if (res.ok) {
    const json = await res.json();
    aplicarCatalogoParticulas(json);
    catalogo = structuredClone(catalogoParticulas());
  } else {
    catalogo = defaultsParticulas();
    aplicarCatalogoParticulas(catalogo);
  }
  categoria = "efeitos";
  presetId = "ember";
  pintarAbas();
  pintarLista();
  pintarInspector();
  sincronizarRuntime();
  preview.disparar();
  const nElf = listaTexturasElemental().length;
  dizer(`Pronto — ${listaEfeitos().length} efeitos · ${nElf} texturas Elemental.`);
}

iniciar().catch((erro) => {
  console.error(erro);
  dizer(String(erro.message || erro));
});
