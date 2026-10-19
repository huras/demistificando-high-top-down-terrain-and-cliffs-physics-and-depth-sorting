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
  FERRAMENTAS,
  MOVEIS,
  RECEITAS_BOLA,
  REMEDIOS,
  TIPO_ITEM,
  classificarChave,
  materiaisDaBolsa,
  teclaDoSlot,
} from "../wild/catalogo.js";
import { especie, listarEspecies } from "../pokemon/dados.js";
import {
  curarParty,
  alternarCampo,
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
import { aoMudarIdioma, definirIdioma, idiomaAtual, t } from "./i18n.js";
import { capsulaEh, htmlCapsula, ligarCapsula, montarJanelaCapsula, tratarCliqueCapsula, tratarInputCapsula } from "./capsula.js";
import { ligarJanelaPc, sincronizarJanelaPc } from "./pc/janela.js";
import { htmlLoja, quantidadeLoja, tratarLoja } from "./loja.js";
import { obterClima, obterHora } from "../render/3d/ceu/controleCeu.js";
import { AREA_KANTO, CENTRO_AREA } from "../mundo/regiao/grafoKanto.js";
import { pintarMapa } from "../ui/mapa/pintar.js";

let raiz = null;

export function ligarUi(overlay) {
  raiz = overlay;
  ligarIdioma();
  raiz.addEventListener("click", noClique);
  raiz.addEventListener("change", noChange);
  raiz.addEventListener("input", tratarInputCapsula);
  ligarCapsula(raiz);
  ligarJanelaPc(raiz);
  raiz.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || !estado.painel) return;
    ev.preventDefault();
    fecharTopo();
    pintar();
  });
}

function ligarIdioma() {
  const sel = document.getElementById("jogo-idioma");
  if (!sel || sel.dataset.pronto) return;
  sel.dataset.pronto = "1";
  sel.innerHTML =
    `<option value="pt-BR">Português (BR)</option>` +
    `<option value="en">English</option>` +
    `<option value="ja">日本語</option>`;
  sel.value = idiomaAtual();
  sel.addEventListener("change", () => {
    definirIdioma(sel.value);
  });
  aoMudarIdioma(() => {
    sel.value = idiomaAtual();
    avisar();
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
  else if (act === "deploy") alternarCampo(i);
  else if (act === "depositar") toast(moverDaPartyParaCaixa(i));
  else if (act === "retirar") toast(moverDaCaixaParaParty(i));
  else if (act === "soltar-caixa") toast(soltarDaCaixa(i));
  else if (act === "soltar-party") {
    const ator = tirarDaParty(i);
    toast(ator ? `Soltou ${nomeEspecie(ator)}.` : "O time precisa de um Pokémon.");
    avisar();
  }   else if (act === "comprar") toast(comprar(tipo, key, quantidadeLoja(btn)));
  else if (act === "vender") toast(vender(tipo, key, quantidadeLoja(btn)));
  else if (act === "craft") toast(craftarBola(key));
  else if (act === "movel") colocarSelecionado(key);
  else if (act === "salvar") salvar();
  else if (act === "escolha") escolher(btn.dataset.id);
  else if (act === "seguir") avancarDialogo();
  else if (capsulaEh(act)) {
    const modo = tratarCliqueCapsula(act, btn);
    if (modo === "lista") {
      pintar();
      return;
    }
    atualizarLeve();
    return;
  } else if (tratarLoja(act, btn)) {
    pintar();
    return;
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
  pintarDinheiro();
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

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
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
  pintarDinheiro();
  pintarToast();
  pintarMini();
  pintarRelogio();
  pintarEquipe();
}

const _ancora = new THREE.Vector3();

function pintarPrompt() {
  const entrar = el("#jogo-entrar");
  const host = el("#jogo-prompt");
  const bloqueia =
    estado.dialogo || estado.painel || estado.roda || estado.construir || estado.craft || estado.ganhoAberto;
  const mostraEntrar = !!estado.promptEntrar && !bloqueia;
  if (entrar) {
    const estava = !entrar.hidden;
    entrar.hidden = !mostraEntrar;
    if (mostraEntrar) {
      const rotulo = entrar.querySelector(".acao-prompt__rotulo");
      const texto = estado.promptRotulo || "Entrar";
      const mudou = !!rotulo && rotulo.textContent !== texto;
      if (rotulo) rotulo.textContent = texto;
      if (!estava || mudou) {
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
  host.hidden = !estado.prompt;
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

function pintarDinheiro() {
  const host = el("#jogo-dinheiro");
  if (!host) return;
  host.textContent = `¥ ${estado.dinheiro}`;
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
  const fora = campo && !campo.capturado;
  const sig = party
    .map((ator) => `${ator.id}:${ator.nivel}:${ator.shiny ? 1 : 0}:${ator.hpMax}:${fora && campo === ator ? 1 : 0}:${ator.capturado ? 1 : 0}:${ator.especie?.dex || 0}`)
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
            return `<button type="button" class="jogo-mon${fora && campo === ator ? " is-on" : ""}" data-act="deploy" data-i="${i}">
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
  if (nome === "pc") {
    host.hidden = true;
    host.innerHTML = "";
    sincronizarJanelaPc(true);
    return;
  }
  sincronizarJanelaPc(false);
  host.hidden = !nome;
  host.classList.toggle("jogo-painel--capsula", nome === "capsula");
  if (!nome) {
    host.innerHTML = "";
    return;
  }
  if (nome === "loja") host.innerHTML = htmlLoja();
  else if (nome === "capsula") {
    host.innerHTML = htmlCapsula();
    montarJanelaCapsula();
  } else host.innerHTML = htmlMenu(nome);
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
    ["balls", t("ui.bolas")],
    ["berries", t("ui.berries")],
    ["medicine", t("ui.remedios")],
    ["materials", t("ui.materiais")],
    ["blocks", t("ui.blocos")],
    ["tools", t("ui.ferramentas")],
    ["key", t("ui.chave")],
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
    materials: entradas(materiaisDaBolsa(), TIPO_ITEM.MATERIAL),
    blocks: entradas(BLOCOS, TIPO_ITEM.BLOCO),
    tools: entradas(FERRAMENTAS, TIPO_ITEM.FERRAMENTA),
    key: entradas(CHAVES, TIPO_ITEM.CHAVE),
  };
  const lista = mapa[cat] || [];
  if (!lista.length) return `<p>${t("ui.vazio")}</p>`;
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
      const nome = nomeDe(item.tipo, item.key);
      return `<div class="jogo-item">${htmlIcone(item.key, "jogo-item__icone")}<span>${nome} ×${qtd || 1}</span>${usar}</div>`;
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
      const foto = urlRetrato(ator);
      const img = foto ? `<img class="pc-retrato" alt="" src="${foto}" />` : "";
      return `<div class="jogo-item">${img}<span>${escHtml(nomeEspecie(ator))} Lv${ator.nivel}${ator.shiny ? " ✦" : ""}</span><span>${hp}</span>${dep}${soltar}</div>`;
    })
    .join("");
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

const ZOOM_MINI = 0.42;

function pontoMini() {
  if (estado.interior && Number.isFinite(estado.interior.ax)) {
    return {
      x: estado.interior.ax * AREA_KANTO + CENTRO_AREA + 0.5,
      y: estado.interior.ay * AREA_KANTO + CENTRO_AREA + 0.5,
    };
  }
  return { x: corpoRef?.x || 0, y: corpoRef?.y || 0 };
}

function pintarMini() {
  const tela = el("#jogo-mini");
  if (!tela) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.round(144 * dpr);
  if (tela.width !== px || tela.height !== px) {
    tela.width = px;
    tela.height = px;
  }
  const ponto = pontoMini();
  pintarMapa(tela.getContext("2d"), px, px, dpr, {
    cx: ponto.x,
    cy: ponto.y,
    zoom: ZOOM_MINI,
    jogadorX: ponto.x,
    jogadorY: ponto.y,
    agora: performance.now(),
    mini: true,
  });
}

let corpoRef = null;

export function definirCorpo(corpo) {
  corpoRef = corpo;
}

export function lerPlaca(placa) {
  if (!placa || estado.dialogo || estado.painel) return;
  estado.dialogo = {
    nome: placa.nome,
    linhas: placa.linhas.slice(),
    i: 0,
  };
  avisar();
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
