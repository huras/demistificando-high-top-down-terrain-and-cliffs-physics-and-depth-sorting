/** Interface DOM: mochila, roda, party, PC, loja, diálogo, dex, quests, craft e móveis. */

import * as THREE from "three";
import { ALTURA_BLOCO } from "../config.js";
import { estaEm3d } from "../modoJogo.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import {
  BOLAS,
  BERRIES,
  BLOCOS,
  CHAVES,
  ESTOQUE_LOJA,
  FERRAMENTAS,
  MATERIAIS,
  MOVEIS,
  RECEITAS_BOLA,
  REMEDIOS,
  TIPO_ITEM,
  classificarChave,
  defItem,
  precoCompra,
  precoVenda,
  teclaDoSlot,
} from "../wild/catalogo.js";
import { listarEspecies } from "../pokemon/dados.js";
import { COR_TIPO } from "../pokemon/tipos.js";
import { darDaCapsula, montarTimeCapsula } from "./laboratorio.js";
import {
  curarParty,
  definirDeployado,
  listaParty,
  pokemonNoCampo,
  tirarDaParty,
} from "../pokemon/party.js";
import {
  abrirPainel,
  atribuirSlot,
  alternarSlot,
  avisar,
  comprar,
  contar,
  craftarBola,
  cicloSlot,
  estado,
  fecharTopo,
  hotbarAtivo,
  marcarQuest,
  moverDaCaixaParaParty,
  moverDaPartyParaCaixa,
  nomeDe,
  podePagarCusto,
  salvar,
  soltarDaCaixa,
  temChave,
  vender,
  colocarMovel,
} from "./estado.js";
import { celulaConstrucao, pertoDe, propsDaSala } from "./sala.js";
import { celulaLivre } from "../wild/salas.js";
import { sfx } from "./audio.js";
import { htmlIcone } from "./icones.js";
import { obterClima, obterHora } from "../render/3d/ceu/controleCeu.js";
import { obterBloco, superficieEm } from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";

let raiz = null;

export function ligarUi(overlay) {
  raiz = overlay;
  raiz.addEventListener("click", noClique);
  raiz.addEventListener("change", noChange);
  raiz.addEventListener("input", noCapsula);
  raiz.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || !estado.painel) return;
    ev.preventDefault();
    fecharTopo();
    pintar();
  });
}

function noChange(ev) {
  const sel = ev.target.closest("[data-caixa]");
  if (!sel) return;
  estado.caixaAtiva = sel.selectedIndex;
  pintar();
}

function noClique(ev) {
  const btn = ev.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const tipo = btn.dataset.tipo;
  const key = btn.dataset.key;
  const i = Number(btn.dataset.i);
  if (act === "fechar") fecharTopo();
  else if (act === "aba") abrirPainel(btn.dataset.painel);
  else if (act === "cat") {
    estado.categoria = btn.dataset.cat;
    avisar();
  } else if (act === "usar" || act === "usar-mon") usarSelecionado(tipo, key, "pokemon");
  else if (act === "usar-jogador") usarSelecionado(tipo, key, "jogador");
  else if (act === "slot") alternarSlot(i); else if (act === "ciclo") cicloSlot(i);
  else if (act === "limpar-slot") atribuirSlot(i, null, null);
  else if (act === "deploy") definirDeployado(i);
  else if (act === "depositar") toast(moverDaPartyParaCaixa(i));
  else if (act === "retirar") toast(moverDaCaixaParaParty(i));
  else if (act === "soltar-caixa") toast(soltarDaCaixa(i));
  else if (act === "soltar-party") {
    const ator = tirarDaParty(i);
    toast(ator ? `Soltou ${nomeEspecie(ator)}.` : "O time precisa de um Pokémon.");
    avisar();
  } else if (act === "comprar") toast(comprar(tipo, key, 1));
  else if (act === "vender") toast(vender(tipo, key, 1));
  else if (act === "craft") toast(craftarBola(key));
  else if (act === "movel") colocarSelecionado(key);
  else if (act === "salvar") salvar();
  else if (act === "escolha") escolher(btn.dataset.id);
  else if (act === "seguir") avancarDialogo();
  else if (act === "tipo-capsula") alternarTipoCapsula(btn.dataset.tipo);
  else if (act === "sel-capsula") {
    garantirCapsula().sel = btn.dataset.key || "";
  } else if (act === "dar-capsula") {
    const cap = garantirCapsula();
    if (cap.sel) darDaCapsula(cap.sel, cap.nivel);
  } else if (act === "time-capsula") sortearTimeCapsula();
  else if (act === "limpar-tipo-capsula") {
    garantirCapsula().tipos = [];
  }
  pintar();
}

function toast(msg) {
  if (msg) estado.itemGet = msg;
}

function usarSelecionado(tipo, key) {
  const equipa =
    tipo === TIPO_ITEM.FERRAMENTA ||
    tipo === TIPO_ITEM.BLOCO ||
    tipo === TIPO_ITEM.BERRY ||
    tipo === TIPO_ITEM.REMEDIO ||
    tipo === TIPO_ITEM.BOLA;
  if (!equipa) return;
  const livre = estado.hotbar.findIndex((s) => !s);
  const idx = livre >= 0 ? livre : estado.slotAtivo >= 0 ? estado.slotAtivo : 0;
  atribuirSlot(idx, tipo, key);
  estado.slotAtivo = idx;
  estado.itemGet = `Equipou ${nomeDe(tipo, key)}.`;
}

function colocarSelecionado(key) {
  const interior = estado.interior;
  if (!interior || interior.papel !== "casa" || interior.sala3d || !interior.sala) {
    estado.itemGet = "Só dentro de casa.";
    return;
  }
  const cel = celulaConstrucao(interior);
  if (!cel || !celulaLivre(interior.sala, cel.x, cel.y)) {
    estado.itemGet = "Esse chão está ocupado.";
    return;
  }
  const props = propsDaSala(interior.sala, interior);
  for (let i = 0; i < props.length; i++) {
    if (props[i].x === cel.x && props[i].y === cel.y) {
      estado.itemGet = "Já tem alguma coisa aí.";
      return;
    }
  }
  toast(colocarMovel(interior.casaId, key, cel.x, cel.y));
}

function escolher(id) {
  const dlg = estado.dialogo;
  if (!dlg) return;
  if (dlg.acao === "curar" && id === "sim") {
    curarParty();
    marcarQuest("centro");
    sfx("cura");
    estado.dialogo = { nome: "Enfermeira", linhas: ["Pronto. Seu time está curado."], i: 0 };
  } else if (dlg.acao === "curar") {
    estado.dialogo = { nome: "Enfermeira", linhas: ["Volte quando precisar."], i: 0 };
  }
  avisar();
}

export function pintar() {
  if (!raiz) return;
  pintarHotbar();
  pintarPrompt();
  pintarDialogo();
  pintarToast();
  pintarEquipe();
  pintarPainel();
  pintarConstruir();
  pintarCraft();
  pintarMini();
}

function el(id) {
  return raiz.querySelector(id);
}

function pintarHotbar() {
  const host = el("#jogo-hotbar");
  if (!host) return;
  const partes = [];
  for (let i = 0; i < estado.hotbar.length; i++) {
    const slot = estado.hotbar[i];
    const nome = slot ? nomeDe(slot.tipo, slot.key) : "";
    const qtd = slot ? contar(slot.tipo, slot.key) : "";
    const tecla = (teclaDoSlot(i) || "").replace("Digit", "");
    const icone = slot ? htmlIcone(slot.key, "jogo-slot__icone") : `<span class="jogo-slot__icone jogo-icone--vazio"></span>`;
    partes.push(
      `<button type="button" class="jogo-slot${i === estado.slotAtivo ? " is-on" : ""}" data-act="slot" data-i="${i}" title="${nome}">
        <span class="jogo-slot__tecla">${tecla}</span>
        ${icone}
        <span class="jogo-slot__qtd">${qtd}</span>
      </button>`,
    );
  }
  host.innerHTML = partes.join("");
}

export function atualizarLeve() {
  pintarPrompt();
  pintarToast();
  pintarMini();
  pintarRelogio();
  pintarEquipe();
}

const _ancora = new THREE.Vector3();

function pintarPrompt() {
  const entrar = el("#jogo-entrar");
  const host = el("#jogo-prompt");
  const mostraEntrar = !!estado.promptEntrar && !estado.dialogo && !estado.painel;
  if (entrar) {
    const estava = !entrar.hidden;
    entrar.hidden = !mostraEntrar;
    if (mostraEntrar) {
      const rotulo = entrar.querySelector(".acao-prompt__rotulo");
      if (rotulo) rotulo.textContent = estado.promptRotulo || "Entrar";
      if (!estava) {
        entrar.classList.remove("acao-prompt--nova");
        void entrar.offsetWidth;
        entrar.classList.add("acao-prompt--nova");
      }
      colocarEntrar(entrar, estado.promptAncora || corpoRef);
    } else if (estava) {
      entrar.classList.remove("acao-prompt--nova");
    }
  }
  if (!host) return;
  host.hidden = mostraEntrar || !estado.prompt;
  host.textContent = estado.prompt || "";
}

function colocarEntrar(entrar, corpo) {
  const canvas = document.getElementById(estaEm3d() ? "canvas-3d" : "canvas");
  const hud = entrar.offsetParent || entrar.parentElement;
  if (!canvas || !hud || !corpo) return;
  const cRect = canvas.getBoundingClientRect();
  const hRect = hud.getBoundingClientRect();
  let x = cRect.width * 0.5;
  let y = cRect.height * 0.42;
  if (estaEm3d()) {
    const cam = obterCenario3d()?.camera3d?.cam;
    if (cam) {
      _ancora.set(corpo.x, (corpo.z || 0) * ALTURA_BLOCO + 2.6, corpo.y);
      _ancora.project(cam);
      if (_ancora.z >= -1 && _ancora.z <= 1) {
        x = (_ancora.x * 0.5 + 0.5) * cRect.width;
        y = (-_ancora.y * 0.5 + 0.5) * cRect.height;
      }
    }
  }
  entrar.style.left = `${cRect.left - hRect.left + x}px`;
  entrar.style.top = `${cRect.top - hRect.top + y}px`;
}

function pintarToast() {
  const host = el("#jogo-toast");
  if (!host) return;
  host.hidden = !estado.itemGet;
  host.textContent = estado.itemGet || "";
}

function pintarDialogo() {
  const host = el("#jogo-dialogo");
  if (!host) return;
  const dlg = estado.dialogo;
  host.hidden = !dlg;
  if (!dlg) {
    host.innerHTML = "";
    return;
  }
  const linha = dlg.linhas[dlg.i] || "";
  const escolhas = dlg.escolhas && dlg.i >= dlg.linhas.length - 1
    ? dlg.escolhas.map((e) => `<button type="button" data-act="escolha" data-id="${e.id}">${e.rotulo}</button>`).join("")
    : `<button type="button" data-act="seguir">Continuar</button>`;
  const retrato = dlg.retrato
    ? `<img class="jogo-dialogo__retrato" alt="" src="${escHtml(dlg.retrato)}" />`
    : "";
  host.innerHTML = `<div class="jogo-dialogo__corpo">${retrato}<div><p class="jogo-dialogo__nome">${escHtml(dlg.nome || "")}</p><p>${escHtml(linha)}</p><div class="jogo-dialogo__acoes">${escolhas}</div></div></div>`;
}

export function avancarDialogo() {
  const dlg = estado.dialogo;
  if (!dlg) return;
  if (dlg.escolhas && dlg.i >= dlg.linhas.length - 1) return;
  dlg.i += 1;
  if (dlg.i >= dlg.linhas.length) {
    if (dlg.acao === "loja") {
      estado.dialogo = null;
      abrirPainel("loja");
      return;
    }
    if (dlg.acao === "pc") {
      estado.dialogo = null;
      abrirPainel("pc");
      return;
    }
    estado.dialogo = null;
  }
  avisar();
}

let assinaturaEquipe = "";

function urlRetrato(ator) {
  const dex = ator?.especie?.dex | 0;
  if (!dex) return "";
  return ator.shiny
    ? `/ref/sprites/pokemon-portraits/shiny/${dex}.png`
    : `/ref/sprites/pokemon-portraits/${dex}.png`;
}

function pintarEquipe() {
  const host = el("#jogo-equipe");
  if (!host) return;
  const party = listaParty();
  const campo = pokemonNoCampo();
  const sig = party
    .map((ator) => `${ator.id}:${ator.nivel}:${ator.shiny ? 1 : 0}:${ator.hpMax}:${campo === ator ? 1 : 0}:${ator.especie?.dex || 0}`)
    .join("|");
  if (sig !== assinaturaEquipe) {
    assinaturaEquipe = sig;
    host.innerHTML = party.length
      ? party
          .map((ator, i) => {
            const url = urlRetrato(ator);
            const face = url
              ? `<img class="jogo-mon__face" src="${url}" alt="" draggable="false" />`
              : `<span class="jogo-mon__face">${nomeEspecie(ator).slice(0, 1)}</span>`;
            return `<button type="button" class="jogo-mon${campo === ator ? " is-on" : ""}" data-act="deploy" data-i="${i}">
              ${face}
              <span class="jogo-mon__nome">${nomeEspecie(ator)} <small>Nv${ator.nivel}</small></span>
              <span class="jogo-mon__barra"><i data-hp="${i}"></i></span>
              <span class="jogo-mon__txt" data-hp-txt="${i}"></span>
            </button>`;
          })
          .join("")
      : "";
  }
  for (let i = 0; i < party.length; i++) {
    const ator = party[i];
    const t = ator.hpMax > 0 ? Math.max(0, ator.hp) / ator.hpMax : 0;
    const bar = host.querySelector(`[data-hp="${i}"]`);
    const txt = host.querySelector(`[data-hp-txt="${i}"]`);
    if (bar) {
      bar.style.width = `${Math.round(t * 100)}%`;
      bar.dataset.baixa = t < 0.35 ? "1" : "0";
    }
    if (txt) txt.textContent = `${Math.max(0, Math.round(ator.hp))}/${ator.hpMax}`;
  }
}

function pintarPainel() {
  const host = el("#jogo-painel");
  if (!host) return;
  const nome = estado.painel;
  host.hidden = !nome;
  host.classList.toggle("jogo-painel--capsula", nome === "capsula");
  if (!nome) {
    host.innerHTML = "";
    return;
  }
  if (nome === "loja") host.innerHTML = htmlLoja();
  else if (nome === "pc") host.innerHTML = htmlPc();
  else if (nome === "capsula") host.innerHTML = htmlCapsula();
  else host.innerHTML = htmlMenu(nome);
}

const TIPOS_CAPSULA = Object.freeze([
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

let catalogoCapsula = null;

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function garantirCapsula() {
  if (!estado.capsula) estado.capsula = { busca: "", tipos: [], nivel: 5, sel: "" };
  return estado.capsula;
}

function nivelCapsula(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(100, Math.round(n)));
}

function listaCatalogo() {
  if (catalogoCapsula) return catalogoCapsula;
  catalogoCapsula = listarEspecies()
    .slice()
    .sort((a, b) => (a.dex | 0) - (b.dex | 0));
  return catalogoCapsula;
}

function filtrarCapsula(cap) {
  const q = cap.busca.trim().toLowerCase();
  const tipos = cap.tipos;
  const todos = listaCatalogo();
  const visiveis = [];
  let total = 0;
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
    total += 1;
    if (visiveis.length < 72) visiveis.push(esp);
  }
  return { visiveis, total };
}

function htmlListaCapsula(cap) {
  const { visiveis, total } = filtrarCapsula(cap);
  if (!total) return "<p>Nenhuma espécie com esse filtro.</p>";
  const itens = visiveis
    .map((esp) => {
      const dex = String(esp.dex | 0).padStart(3, "0");
      const tipos = (esp.tipos || []).map((tipo) => TIPOS_CAPSULA.find((item) => item[0] === tipo)?.[1] || tipo).join(" / ");
      const on = cap.sel === esp.key ? " is-on" : "";
      return `<button type="button" class="capsula-item${on}" data-act="sel-capsula" data-key="${escHtml(esp.key)}"><b>${dex}</b><span>${escHtml(esp.nome)}</span><small>${escHtml(tipos)}</small></button>`;
    })
    .join("");
  const resto = total > visiveis.length ? `<p class="capsula-resto">Mostrando ${visiveis.length} de ${total}. Afine a busca.</p>` : "";
  return `${itens}${resto}`;
}

function htmlCapsula() {
  const cap = garantirCapsula();
  const escolhida = listaCatalogo().find((esp) => esp.key === cap.sel);
  const retrato = escolhida
    ? `<img class="capsula-retrato" alt="" src="/ref/sprites/pokemon-portraits/${escolhida.dex | 0}.png" />`
    : `<span class="capsula-retrato capsula-retrato--vazio">?</span>`;
  const tipos = TIPOS_CAPSULA.map(([id, rotulo]) => {
    const on = cap.tipos.includes(id) ? " is-on" : "";
    const cor = COR_TIPO[id] || "#94a3b8";
    return `<button type="button" class="capsula-tipo${on}" data-act="tipo-capsula" data-tipo="${id}" title="${rotulo}" aria-label="${rotulo}" aria-pressed="${on ? "true" : "false"}" style="--tipo:${cor}"></button>`;
  }).join("");
  const nome = escolhida ? escHtml(escolhida.nome) : "Escolha uma espécie";
  return `<header class="jogo-topo"><h2>Cápsula</h2><button type="button" data-act="fechar">Fechar</button></header>
    <div class="capsula-topo">${retrato}<div><p class="capsula-nome">${nome}</p>
    <label class="capsula-nivel">Nível <input data-capsula="nivel" type="number" min="1" max="100" value="${cap.nivel}" /></label>
    <div class="capsula-acoes"><button type="button" data-act="dar-capsula">Colocar no time</button><button type="button" data-act="time-capsula">Time aleatório</button></div></div></div>
    <input class="capsula-busca" data-capsula="busca" type="search" placeholder="Nome ou número" value="${escHtml(cap.busca)}" />
    <div class="capsula-tipos" aria-label="Tipos">${tipos}<button type="button" class="capsula-limpar" data-act="limpar-tipo-capsula" ${cap.tipos.length ? "" : "hidden"}>Limpar</button></div>
    <div class="capsula-lista" id="capsula-lista">${htmlListaCapsula(cap)}</div>`;
}

function noCapsula(ev) {
  const campo = ev.target.closest("[data-capsula]");
  if (!campo || estado.painel !== "capsula") return;
  const cap = garantirCapsula();
  if (campo.dataset.capsula === "busca") cap.busca = campo.value;
  if (campo.dataset.capsula === "nivel") cap.nivel = nivelCapsula(campo.value);
  const lista = el("#capsula-lista");
  if (lista) lista.innerHTML = htmlListaCapsula(cap);
}

function alternarTipoCapsula(tipo) {
  if (!tipo) return;
  const cap = garantirCapsula();
  const i = cap.tipos.indexOf(tipo);
  if (i >= 0) cap.tipos.splice(i, 1);
  else if (cap.tipos.length < 2) cap.tipos.push(tipo);
  else cap.tipos = [cap.tipos[1], tipo];
}

function sortearTimeCapsula() {
  const todos = listaCatalogo();
  if (!todos.length) return;
  const chaves = [];
  const usados = new Set();
  let guarda = 0;
  while (chaves.length < 6 && usados.size < todos.length && guarda < 40) {
    guarda += 1;
    const esp = todos[(Math.random() * todos.length) | 0];
    if (usados.has(esp.key)) continue;
    usados.add(esp.key);
    chaves.push(esp.key);
  }
  montarTimeCapsula(chaves, garantirCapsula().nivel);
}

function abas(ativa) {
  const itens = [
    ["mochila", "Mochila"],
    ["party", "Time"],
    ["pokedex", "Pokédex"],
    ["quests", "Missões"],
    ["save", "Salvar"],
  ];
  return `<nav class="jogo-abas">${itens
    .map(([id, rotulo]) => `<button type="button" data-act="aba" data-painel="${id}" class="${ativa === id ? "is-on" : ""}">${rotulo}</button>`)
    .join("")}<button type="button" data-act="fechar">Fechar</button></nav>`;
}

function htmlMenu(nome) {
  let corpo = "";
  if (nome === "mochila") corpo = htmlMochila();
  else if (nome === "party") corpo = htmlParty(true);
  else if (nome === "pokedex") corpo = htmlDex();
  else if (nome === "quests") corpo = htmlQuests();
  else if (nome === "save") corpo = htmlSave();
  return `${abas(nome)}<div class="jogo-corpo">${corpo}</div>`;
}

function htmlMochila() {
  const cats = [
    ["balls", "Bolas"],
    ["berries", "Berries"],
    ["medicine", "Remédios"],
    ["materials", "Materiais"],
    ["blocks", "Blocos"],
    ["tools", "Ferramentas"],
    ["key", "Chave"],
  ];
  const botoes = cats
    .map(([id, rotulo]) => `<button type="button" data-act="cat" data-cat="${id}" class="${estado.categoria === id ? "is-on" : ""}">${rotulo}</button>`)
    .join("");
  return `<p class="jogo-dinheiro">¥ ${estado.dinheiro}</p><div class="jogo-cats">${botoes}</div><div class="jogo-grade">${linhasCategoria(estado.categoria)}</div>`;
}

function linhasCategoria(cat) {
  const mapa = {
    balls: entradas(BOLAS, TIPO_ITEM.BOLA),
    berries: entradas(BERRIES, TIPO_ITEM.BERRY),
    medicine: entradas(REMEDIOS, TIPO_ITEM.REMEDIO),
    materials: entradas(MATERIAIS, TIPO_ITEM.MATERIAL),
    blocks: entradas(BLOCOS, TIPO_ITEM.BLOCO),
    tools: entradas(FERRAMENTAS, TIPO_ITEM.FERRAMENTA),
    key: entradas(CHAVES, TIPO_ITEM.CHAVE),
  };
  const lista = mapa[cat] || [];
  if (!lista.length) return "<p>Vazio.</p>";
  return lista
    .map((item) => {
      const qtd = contar(item.tipo, item.key);
      if (qtd <= 0 && item.tipo !== TIPO_ITEM.CHAVE) return "";
      if (item.tipo === TIPO_ITEM.CHAVE && !temChave(item.key)) return "";
      const equipa =
        item.tipo === TIPO_ITEM.BOLA ||
        item.tipo === TIPO_ITEM.BERRY ||
        item.tipo === TIPO_ITEM.REMEDIO ||
        item.tipo === TIPO_ITEM.BLOCO ||
        item.tipo === TIPO_ITEM.FERRAMENTA;
      const usar = equipa
        ? `<button type="button" data-act="usar" data-tipo="${item.tipo}" data-key="${item.key}">Equipar</button>`
        : "";
      return `<div class="jogo-item">${htmlIcone(item.key, "jogo-item__icone")}<span>${item.nome} ×${qtd || 1}</span>${usar}</div>`;
    })
    .join("");
}

function entradas(obj, tipo) {
  return Object.keys(obj).map((key) => ({ ...obj[key], tipo }));
}

function nomeEspecie(ator) {
  return ator?.especie?.nome || ator?.especie?.name || ator?.especie?.key || "Pokémon";
}

function htmlParty(comSoltar) {
  const party = listaParty();
  if (!party.length) return "<p>Time vazio.</p>";
  return party
    .map((ator, i) => {
      const hp = `${Math.max(0, Math.round(ator.hp))}/${ator.hpMax}`;
      const soltar = comSoltar ? `<button type="button" data-act="soltar-party" data-i="${i}">Soltar</button>` : "";
      const dep = estado.painel === "pc"
        ? `<button type="button" data-act="depositar" data-i="${i}">Depositar</button>`
        : `<button type="button" data-act="deploy" data-i="${i}">Campo</button>`;
      return `<div class="jogo-item"><span>${nomeEspecie(ator)} Lv${ator.nivel}${ator.shiny ? " ✦" : ""}</span><span>${hp}</span>${dep}${soltar}</div>`;
    })
    .join("");
}

function htmlPc() {
  const caixa = estado.caixas[estado.caixaAtiva];
  const opcoes = estado.caixas
    .map((c, i) => `<option${i === estado.caixaAtiva ? " selected" : ""}>${c.nome}</option>`)
    .join("");
  const slots = caixa.slots
    .map((snap, i) => {
      if (!snap) return `<div class="jogo-item"><span>vazio</span></div>`;
      return `<div class="jogo-item"><span>${snap.especieKey} Lv${snap.nivel}</span><button type="button" data-act="retirar" data-i="${i}">Retirar</button><button type="button" data-act="soltar-caixa" data-i="${i}">Soltar</button></div>`;
    })
    .join("");
  return `<header class="jogo-topo"><h2>PC</h2><button type="button" data-act="fechar">Fechar</button></header>
    <select data-caixa>${opcoes}</select>
    <h3>Time</h3>${htmlParty(false)}<h3>${caixa.nome}</h3><div class="jogo-grade">${slots}</div>`;
}

function htmlLoja() {
  const compra = ESTOQUE_LOJA.map((e) => {
    const def = defItem(e.tipo, e.key);
    if (!def) return "";
    const preco = precoCompra(e.tipo, e.key);
    if (preco < 0) return "";
    return `<div class="jogo-item"><span>${def.nome}</span><span>¥${preco}</span><button type="button" data-act="comprar" data-tipo="${e.tipo}" data-key="${e.key}">Comprar</button></div>`;
  }).join("");
  const venda = itensVendaveis()
    .map((e) => `<div class="jogo-item"><span>${e.nome} ×${e.qtd}</span><span>¥${e.venda}</span><button type="button" data-act="vender" data-tipo="${e.tipo}" data-key="${e.key}">Vender</button></div>`)
    .join("");
  return `<header class="jogo-topo"><h2>Poké Mart</h2><button type="button" data-act="fechar">Fechar</button></header>
    <p class="jogo-dinheiro">¥ ${estado.dinheiro}</p><h3>Comprar</h3><div class="jogo-grade">${compra}</div><h3>Vender</h3><div class="jogo-grade">${venda || "<p>Nada para vender.</p>"}</div>`;
}

function itensVendaveis() {
  const lista = [];
  const grupos = [
    [BOLAS, TIPO_ITEM.BOLA],
    [BERRIES, TIPO_ITEM.BERRY],
    [REMEDIOS, TIPO_ITEM.REMEDIO],
    [MATERIAIS, TIPO_ITEM.MATERIAL],
  ];
  for (let g = 0; g < grupos.length; g++) {
    const obj = grupos[g][0];
    const tipo = grupos[g][1];
    const chaves = Object.keys(obj);
    for (let i = 0; i < chaves.length; i++) {
      const key = chaves[i];
      const qtd = contar(tipo, key);
      const venda = precoVenda(tipo, key);
      if (qtd > 0 && venda > 0) lista.push({ tipo, key, nome: obj[key].nome, qtd, venda });
    }
  }
  return lista;
}

function htmlDex() {
  if (!temChave("pokedex")) return "<p>Você não tem a Pokédex.</p>";
  const especies = listarEspecies();
  if (!especies.length) return "<p>Catálogo ainda não carregou.</p>";
  return `<p>${estado.vistos.length} vistas</p><div class="jogo-grade">${especies
    .map((esp) => {
      const key = esp.key;
      const vista = estado.vistos.includes(key);
      const nome = vista ? esp.nome || esp.name || key : "???";
      return `<div class="jogo-item${vista ? "" : " is-off"}"><span>${nome}</span></div>`;
    })
    .join("")}</div>`;
}

function htmlQuests() {
  return estado.quests
    .map((q) => `<div class="jogo-item"><span>${q.titulo}</span><span>${q.feita ? "feita" : q.texto}</span></div>`)
    .join("");
}

function htmlSave() {
  return `<p>O save fica neste navegador.</p><button type="button" data-act="salvar">Salvar agora</button>`;
}

function pintarConstruir() {
  const host = el("#jogo-construir");
  if (!host) return;
  host.hidden = !estado.construir;
  if (!estado.construir) return;
  const chaves = Object.keys(MOVEIS);
  host.innerHTML = `<header class="jogo-topo"><h2>Móveis</h2><button type="button" data-act="fechar">Fechar</button></header>${chaves
    .map((key) => {
      const m = MOVEIS[key];
      const ok = podePagarCusto(m.custo);
      const custo = Object.entries(m.custo).map(([k, n]) => `${n} ${k}`).join(", ");
      return `<div class="jogo-item"><span>${m.nome}</span><span>${custo}</span><button type="button" data-act="movel" data-key="${key}" ${ok ? "" : "disabled"}>Colocar</button></div>`;
    })
    .join("")}`;
}

function pintarCraft() {
  const host = el("#jogo-craft");
  if (!host) return;
  host.hidden = !estado.craft;
  if (!estado.craft) return;
  const chaves = Object.keys(RECEITAS_BOLA);
  host.innerHTML = `<header class="jogo-topo"><h2>Bancada</h2><button type="button" data-act="fechar">Fechar</button></header>${chaves
    .map((key) => {
      const r = RECEITAS_BOLA[key];
      const ok = podePagarCusto(r.custo);
      return `<div class="jogo-item"><span>${r.nome}</span><span>${r.custo.anyCrystal} cristal</span><button type="button" data-act="craft" data-key="${key}" ${ok ? "" : "disabled"}>Craftar</button></div>`;
    })
    .join("")}`;
}

function corChao(id) {
  if (id === BLOCO.AGUA) return "#1d4ed8";
  if (id === BLOCO.PEDRA) return "#78716c";
  if (id === BLOCO.TERRA) return "#8a5a32";
  if (id === BLOCO.GRAMA) return "#3f8f46";
  return "#102018";
}

function periodoDe(hora) {
  if (hora < 5 || hora >= 20) return { nome: "Noite", chave: "noite" };
  if (hora < 8) return { nome: "Amanhecer", chave: "aurora" };
  if (hora < 17) return { nome: "Dia", chave: "dia" };
  return { nome: "Tarde", chave: "tarde" };
}

function pintarRelogio() {
  const host = el("#jogo-relogio");
  if (!host) return;
  const hora = obterHora();
  const h = Math.floor(hora);
  const m = Math.floor((hora - h) * 60);
  const texto = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const periodo = periodoDe(hora);
  const clima = obterClima();
  const nomes = { limpo: "Limpo", chuva: "Chuva", areia: "Areia", nevasca: "Neve" };
  if (host.dataset.chave === `${texto}|${periodo.chave}|${clima}`) return;
  host.dataset.chave = `${texto}|${periodo.chave}|${clima}`;
  host.dataset.periodo = periodo.chave;
  const horaEl = host.querySelector("[data-hora]");
  const perEl = host.querySelector("[data-periodo]");
  const cliEl = host.querySelector("[data-clima]");
  if (horaEl) horaEl.textContent = texto;
  if (perEl) perEl.textContent = periodo.nome;
  if (cliEl) cliEl.textContent = nomes[clima] || clima;
}

let miniEm = 0;

function pintarMini() {
  const tela = el("#jogo-mini");
  if (!tela) return;
  const agora = performance.now();
  if (agora - miniEm < 180) return;
  miniEm = agora;
  const ctx = tela.getContext("2d");
  const w = tela.width;
  const h = tela.height;
  ctx.fillStyle = "#102018";
  ctx.fillRect(0, 0, w, h);
  const corpo = corpoRef;
  if (!corpo) return;
  const alcance = 18;
  const cel = w / (alcance * 2);
  const ox = Math.floor(corpo.x);
  const oy = Math.floor(corpo.y);
  for (let dy = -alcance; dy < alcance; dy++) {
    for (let dx = -alcance; dx < alcance; dx++) {
      const x = ox + dx;
      const y = oy + dy;
      const topo = superficieEm(x, y);
      const id = topo > 0 ? obterBloco(x, y, topo - 1) : BLOCO.AR;
      ctx.fillStyle = corChao(id);
      ctx.fillRect((dx + alcance) * cel, (dy + alcance) * cel, Math.ceil(cel), Math.ceil(cel));
    }
  }
  for (let i = 0; i < estado.plots.length; i++) {
    const p = estado.plots[i];
    const dx = p.x - ox;
    const dy = p.y - oy;
    if (Math.abs(dx) >= alcance || Math.abs(dy) >= alcance) continue;
    ctx.fillStyle = p.stage === "ripe" ? "#facc15" : "#f59e0b";
    ctx.fillRect((dx + alcance) * cel, (dy + alcance) * cel, Math.ceil(cel), Math.ceil(cel));
  }
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1;
  ctx.stroke();
}

let corpoRef = null;

export function definirCorpo(corpo) {
  corpoRef = corpo;
}

export function falarCom(alvo) {
  if (!alvo) return;
  const ref = alvo.ref;
  if (alvo.tipo === "npc") {
    estado.dialogo = {
      nome: ref.nome,
      linhas: ref.fala.slice(),
      i: 0,
      acao: ref.acao || "",
      escolhas: ref.escolhas || null,
    };
    avisar();
    return;
  }
  if (ref.acao === "pc") {
    estado.dialogo = { nome: "PC", linhas: ["O PC do Centro está ligado."], i: 0, acao: "pc" };
    avisar();
    return;
  }
  if (ref.cura) {
    curarParty();
    marcarQuest("centro");
    sfx("cura");
    estado.itemGet = "Descansou. O time foi curado.";
    avisar();
    return;
  }
  if (ref.craft || ref.key === "bancada") {
    estado.craft = true;
    avisar();
  }
}

export function promptDe(alvo, ferramenta) {
  if (estado.dialogo || estado.painel) return "";
  if (alvo?.tipo === "npc") return `${alvo.ref.nome} — R`;
  if (alvo?.ref?.acao === "pc") return "PC — R";
  if (alvo?.ref?.cura) return "Cama — R";
  if (alvo?.ref?.craft || alvo?.ref?.key === "bancada") return "Bancada — R";
  if (estado.interior?.papel === "casa" && !estado.interior.sala3d && hotbarAtivo()?.key === "hammer") return "Martelo — clique esquerdo abre os móveis";
  if (!estado.interior && ferramenta) return `${ferramenta} — clique esquerdo`;
  return "";
}

export function classeDeChave(key) {
  return classificarChave(key);
}
