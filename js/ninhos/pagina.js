import { carregarDados } from "../pokemon/dados.js";
import { varrerCensoNinhos } from "../pokemon/censoNinhos.js";
import { urlIconeMinimap } from "../pokemon/minimapIcone.js";

const COLUNAS = [
  { id: "dex", rotulo: "Dex" },
  { id: "nome", rotulo: "Pokémon" },
  { id: "total", rotulo: "Ninhos" },
  { id: "pct", rotulo: "%" },
  { id: "shiny", rotulo: "Shiny" },
  { id: "land", rotulo: "Terra" },
  { id: "high", rotulo: "Alto" },
  { id: "surface", rotulo: "Superfície" },
  { id: "undersea", rotulo: "Fundo" },
  { id: "nivelMin", rotulo: "Nível mín." },
  { id: "situacao", rotulo: "Situação" },
];

const statusEl = document.getElementById("status");
const barraEl = document.getElementById("barra");
const resumoEl = document.getElementById("resumo");
const corpoEl = document.getElementById("corpo");
const cabecaEl = document.getElementById("cabeca");
const buscaEl = document.getElementById("busca");
const modoEl = document.getElementById("modo");

let linhas = [];
let ninhos = 0;
let ordem = "total";
let desc = true;
let filtro = "";
let modo = "todos";

function pct(n) {
  if (!ninhos) return "0";
  return ((n / ninhos) * 100).toFixed(2);
}

function cmp(a, b) {
  const dir = desc ? -1 : 1;
  if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt-BR") * dir;
  if (ordem === "pct") return (a.total - b.total) * dir;
  const va = a[ordem];
  const vb = b[ordem];
  if (typeof va === "number" && typeof vb === "number") {
    if (va !== vb) return (va - vb) * dir;
    return a.dex - b.dex;
  }
  const texto = String(va).localeCompare(String(vb), "pt-BR") * dir;
  if (texto) return texto;
  return a.dex - b.dex;
}

function visiveis() {
  const q = filtro.trim().toLowerCase();
  const lista = [];
  for (let i = 0; i < linhas.length; i++) {
    const r = linhas[i];
    if (modo === "com" && !r.total) continue;
    if (modo === "sem" && r.total) continue;
    if (q && !r.nome.toLowerCase().includes(q) && !r.key.includes(q) && String(r.dex) !== q) continue;
    lista.push(r);
  }
  lista.sort(cmp);
  return lista;
}

function pintarResumo(totais, comNinho, catalogo) {
  const itens = [
    ["Ninhos", totais.ninhos],
    ["Com ninho", comNinho],
    ["Catálogo", catalogo],
    ["Sem ninho", catalogo - comNinho],
    ["Shiny", totais.shiny],
    ["Terra", totais.land],
    ["Alto", totais.high],
    ["Superfície", totais.surface],
    ["Fundo", totais.undersea],
  ];
  resumoEl.replaceChildren();
  for (let i = 0; i < itens.length; i++) {
    const box = document.createElement("div");
    box.className = "resumo__item";
    const rotulo = document.createElement("span");
    rotulo.textContent = itens[i][0];
    const valor = document.createElement("strong");
    valor.textContent = String(itens[i][1]);
    box.append(rotulo, valor);
    resumoEl.append(box);
  }
}

function celulaNome(r) {
  const td = document.createElement("td");
  const wrap = document.createElement("span");
  wrap.className = "ninho-nome";
  const url = urlIconeMinimap(r.dex);
  if (url) {
    const img = document.createElement("img");
    img.className = "ninho-icone";
    img.src = url;
    img.alt = "";
    img.width = 32;
    img.height = 32;
    img.decoding = "async";
    wrap.append(img);
  }
  const nome = document.createElement("span");
  nome.textContent = r.nome;
  wrap.append(nome);
  td.append(wrap);
  return td;
}

function pintarTabela() {
  const lista = visiveis();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < lista.length; i++) {
    const r = lista[i];
    const tr = document.createElement("tr");
    if (!r.total) tr.classList.add("is-zero");
    const celulas = [
      String(r.dex).padStart(3, "0"),
      null,
      String(r.total),
      pct(r.total),
      String(r.shiny),
      String(r.land),
      String(r.high),
      String(r.surface),
      String(r.undersea),
      String(r.nivelMin || 1),
      r.situacao || "",
    ];
    for (let c = 0; c < celulas.length; c++) {
      if (c === 1) {
        tr.append(celulaNome(r));
        continue;
      }
      const td = document.createElement("td");
      td.textContent = celulas[c];
      if (c === celulas.length - 1) td.className = "situacao";
      tr.append(td);
    }
    frag.append(tr);
  }
  corpoEl.replaceChildren(frag);
}

function pintarCabeca() {
  cabecaEl.replaceChildren();
  const tr = document.createElement("tr");
  for (let i = 0; i < COLUNAS.length; i++) {
    const col = COLUNAS[i];
    const th = document.createElement("th");
    th.textContent = col.rotulo + (ordem === col.id ? (desc ? " ↓" : " ↑") : "");
    if (ordem === col.id) th.classList.add("is-ativo");
    th.addEventListener("click", () => {
      if (ordem === col.id) desc = !desc;
      else {
        ordem = col.id;
        desc = col.id !== "nome" && col.id !== "dex" && col.id !== "situacao";
      }
      pintarCabeca();
      pintarTabela();
    });
    tr.append(th);
  }
  cabecaEl.append(tr);
}

buscaEl.addEventListener("input", () => {
  filtro = buscaEl.value;
  pintarTabela();
});

modoEl.addEventListener("change", () => {
  modo = modoEl.value;
  pintarTabela();
});

pintarCabeca();
statusEl.textContent = "Carregando catálogo…";

carregarDados()
  .then(() => {
    statusEl.textContent = "Contando ninhos…";
    varrerCensoNinhos((p) => {
      const pctVar = p.total > 0 ? Math.min(100, (p.feitos / p.total) * 100) : 0;
      barraEl.style.width = `${pctVar}%`;
      if (!p.pronto) {
        statusEl.textContent = `Contando ${Math.round(pctVar)}% · ${p.ninhos} ninhos`;
        return;
      }
      linhas = p.linhas;
      ninhos = p.totais.ninhos;
      let comNinho = 0;
      for (let i = 0; i < linhas.length; i++) if (linhas[i].total) comNinho++;
      statusEl.textContent = `${comNinho} com ninho de ${linhas.length} no catálogo`;
      pintarResumo(p.totais, comNinho, linhas.length);
      pintarTabela();
      buscaEl.disabled = false;
      modoEl.disabled = false;
    });
  })
  .catch((erro) => {
    statusEl.textContent = erro?.message || "Falha ao carregar o catálogo";
  });
