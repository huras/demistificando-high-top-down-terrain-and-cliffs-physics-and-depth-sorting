/** Cápsula do laboratório: catálogo virtual, nível e envio ao PC. */

import { COR_TIPO } from "../pokemon/tipos.js";
import { listarEspecies } from "../pokemon/dados.js";
import { POKEMON } from "../config.js";
import { darDaCapsula, montarTimeCapsula } from "./laboratorio.js";
import { estado } from "./estado.js";

const COLUNAS = 4;
const LINHA = 96;

const TIPOS = Object.freeze([
  ["normal", "Normal"],
  ["fire", "Fogo"],
  ["water", "Água"],
  ["electric", "Elétrico"],
  ["grass", "Planta"],
  ["ice", "Gelo"],
  ["fighting", "Lutador"],
  ["poison", "Venenoso"],
  ["ground", "Terra"],
  ["flying", "Voador"],
  ["psychic", "Psíquico"],
  ["bug", "Inseto"],
  ["rock", "Pedra"],
  ["ghost", "Fantasma"],
  ["dragon", "Dragão"],
  ["dark", "Sombrio"],
  ["steel", "Aço"],
  ["fairy", "Fada"],
]);

let catalogo = null;
let raiz = null;

export function ligarCapsula(overlay) {
  raiz = overlay;
  overlay.addEventListener("scroll", aoRolar, true);
}

function capsula() {
  if (!estado.capsula) estado.capsula = { busca: "", tipos: [], nivel: 50, sel: "" };
  return estado.capsula;
}

function nivelDe(valor) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(100, n));
}

function lista() {
  if (catalogo) return catalogo;
  catalogo = listarEspecies()
    .slice()
    .sort((a, b) => (a.dex | 0) - (b.dex | 0));
  return catalogo;
}

function filtrar(cap) {
  const q = cap.busca.trim().toLowerCase();
  const tipos = cap.tipos;
  const todos = lista();
  const saida = [];
  for (let i = 0; i < todos.length; i++) {
    const esp = todos[i];
    if (q) {
      const texto = `${esp.nome} ${esp.key} ${esp.dex}`.toLowerCase();
      if (!texto.includes(q)) continue;
    }
    if (tipos.length) {
      let ok = true;
      for (let t = 0; t < tipos.length; t++) {
        if (!esp.tipos?.includes(tipos[t])) ok = false;
      }
      if (!ok) continue;
    }
    saida.push(esp);
  }
  return saida;
}

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function cartao(esp, sel) {
  const dex = String(esp.dex | 0).padStart(3, "0");
  const tipos = (esp.tipos || [])
    .map((tipo) => {
      const rotulo = TIPOS.find((item) => item[0] === tipo)?.[1] || tipo;
      const cor = COR_TIPO[tipo] || "#94a3b8";
      return `<i class="capsula-pill" style="--tipo:${cor}">${esc(rotulo)}</i>`;
    })
    .join("");
  const on = sel === esp.key ? " is-on" : "";
  return `<button type="button" class="capsula-item${on}" data-act="sel-capsula" data-key="${esc(esp.key)}">
    <img class="capsula-mini" alt="" loading="lazy" src="/ref/sprites/pokemon-portraits/${esp.dex | 0}.png" />
    <b>#${dex}</b><span>${esc(esp.nome)}</span><small>${tipos}</small>
  </button>`;
}

function hostLista() {
  return raiz?.querySelector("#capsula-lista") || null;
}

function pintarJanela(host) {
  if (!host) return;
  const cap = capsula();
  const visiveis = filtrar(cap);
  const linhas = Math.max(1, Math.ceil(visiveis.length / COLUNAS));
  let trilho = host.querySelector(".capsula-trilho");
  if (!trilho) {
    trilho = document.createElement("div");
    trilho.className = "capsula-trilho";
    host.appendChild(trilho);
  }
  trilho.style.height = `${linhas * LINHA}px`;
  const vista = host.clientHeight || 360;
  const i0 = Math.max(0, Math.floor(host.scrollTop / LINHA) - 1);
  const i1 = Math.min(linhas, Math.ceil((host.scrollTop + vista) / LINHA) + 2);
  const ini = Math.min(visiveis.length, i0 * COLUNAS);
  const fim = Math.min(visiveis.length, i1 * COLUNAS);
  let janela = trilho.querySelector(".capsula-janela");
  if (!janela) {
    janela = document.createElement("div");
    janela.className = "capsula-janela";
    trilho.appendChild(janela);
  }
  janela.style.transform = `translateY(${i0 * LINHA}px)`;
  if (!visiveis.length) {
    janela.innerHTML = `<p class="capsula-resto">Nenhuma espécie com esse filtro.</p>`;
    return;
  }
  let html = "";
  for (let i = ini; i < fim; i++) html += cartao(visiveis[i], cap.sel);
  janela.innerHTML = html;
}

function atualizarTopo() {
  if (!raiz) return;
  const cap = capsula();
  const escolhida = lista().find((esp) => esp.key === cap.sel);
  const nome = raiz.querySelector(".capsula-nome");
  const foto = raiz.querySelector(".capsula-retrato");
  if (nome) nome.textContent = escolhida ? escolhida.nome : "Escolha uma espécie";
  if (foto) {
    if (escolhida) {
      foto.outerHTML = `<img class="capsula-retrato" alt="" src="/ref/sprites/pokemon-portraits/${escolhida.dex | 0}.png" />`;
    } else if (foto.tagName !== "SPAN") {
      foto.outerHTML = `<span class="capsula-retrato capsula-retrato--vazio">?</span>`;
    }
  }
}

export function htmlCapsula() {
  const cap = capsula();
  const escolhida = lista().find((esp) => esp.key === cap.sel);
  const retrato = escolhida
    ? `<img class="capsula-retrato" alt="" src="/ref/sprites/pokemon-portraits/${escolhida.dex | 0}.png" />`
    : `<span class="capsula-retrato capsula-retrato--vazio">?</span>`;
  const tipos = TIPOS.map(([id, rotulo]) => {
    const on = cap.tipos.includes(id) ? " is-on" : "";
    const cor = COR_TIPO[id] || "#94a3b8";
    return `<button type="button" class="capsula-tipo${on}" data-act="tipo-capsula" data-tipo="${id}" title="${rotulo}" aria-label="${rotulo}" aria-pressed="${on ? "true" : "false"}" style="--tipo:${cor}"></button>`;
  }).join("");
  const nome = escolhida ? esc(escolhida.nome) : "Escolha uma espécie";
  return `<header class="jogo-topo"><h2>Cápsula</h2><button type="button" data-act="fechar">Fechar</button></header>
    <div class="capsula-topo">${retrato}<div><p class="capsula-nome">${nome}</p>
    <label class="capsula-nivel">Nível <input data-capsula="nivel" type="number" min="1" max="100" value="${cap.nivel}" /></label>
    <div class="capsula-acoes"><button type="button" data-act="dar-capsula">Colocar no time</button><button type="button" data-act="time-capsula">Time aleatório</button></div>
    <p class="capsula-dica">Até o nível 100. Time cheio vai para o PC. O aleatório usa o filtro e guarda o time atual.</p>
    </div></div>
    <input class="capsula-busca" data-capsula="busca" type="search" placeholder="Nome ou número" value="${esc(cap.busca)}" />
    <div class="capsula-tipos" aria-label="Tipos">${tipos}<button type="button" class="capsula-limpar" data-act="limpar-tipo-capsula" ${cap.tipos.length ? "" : "hidden"}>Limpar</button></div>
    <div class="capsula-lista" id="capsula-lista"><div class="capsula-trilho"></div></div>`;
}

export function montarJanelaCapsula() {
  pintarJanela(hostLista());
}

function aoRolar(ev) {
  if (ev.target?.id !== "capsula-lista") return;
  pintarJanela(ev.target);
}

export function tratarInputCapsula(ev) {
  const campo = ev.target.closest("[data-capsula]");
  if (!campo || estado.painel !== "capsula") return;
  const cap = capsula();
  if (campo.dataset.capsula === "busca") cap.busca = campo.value;
  if (campo.dataset.capsula === "nivel") cap.nivel = nivelDe(campo.value);
  const host = hostLista();
  if (host && campo.dataset.capsula === "busca") host.scrollTop = 0;
  pintarJanela(host);
}

function alternarTipo(tipo) {
  if (!tipo) return;
  const cap = capsula();
  const i = cap.tipos.indexOf(tipo);
  if (i >= 0) cap.tipos.splice(i, 1);
  else if (cap.tipos.length < 2) cap.tipos.push(tipo);
  else cap.tipos = [cap.tipos[1], tipo];
}

function sortear() {
  const visiveis = filtrar(capsula());
  if (!visiveis.length) return;
  const pool = visiveis.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const chaves = [];
  for (let i = 0; i < POKEMON.PARTY_MAX; i++) chaves.push(pool[i % pool.length].key);
  montarTimeCapsula(chaves, capsula().nivel);
}

export function tratarCliqueCapsula(act, btn) {
  if (act === "tipo-capsula") {
    alternarTipo(btn.dataset.tipo);
    return "lista";
  }
  if (act === "limpar-tipo-capsula") {
    capsula().tipos = [];
    return "lista";
  }
  if (act === "sel-capsula") {
    capsula().sel = btn.dataset.key || "";
    pintarJanela(hostLista());
    atualizarTopo();
    return "local";
  }
  if (act === "dar-capsula") {
    const cap = capsula();
    if (cap.sel) darDaCapsula(cap.sel, cap.nivel);
    return "local";
  }
  if (act === "time-capsula") {
    sortear();
    return "local";
  }
  return "";
}

export function capsulaEh(act) {
  return (
    act === "tipo-capsula" ||
    act === "limpar-tipo-capsula" ||
    act === "sel-capsula" ||
    act === "dar-capsula" ||
    act === "time-capsula"
  );
}
