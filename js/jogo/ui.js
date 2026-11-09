/** Interface DOM: mochila, roda, party, PC, loja, diálogo, dex, quests, craft e móveis. */

import {
  BOLAS,
  BERRIES,
  BLOCOS,
  CHAVES,
  FERRAMENTAS,
  MATERIAIS,
  MOVEIS,
  RECEITAS_BOLA,
  REMEDIOS,
  TIPO_ITEM,
  classificarChave,
  materiaisDaBolsa,
  teclaDoSlot,
} from "../wild/catalogo.js";
import { origemDoChao, medidasSala } from "../mundo/cidade/sala3d.js";
import { definirMoveisJogador } from "../mundo/cidade/interiorCasa.js";
import { syncInteriorMoveis } from "../construir/estruturas.js";
import { especie, listarEspecies } from "../pokemon/dados.js";
import {
  curarParty,
  alternarCampo,
  listaParty,
  pokemonNoCampo,
  reporBolasCura,
  tirarDaParty,
} from "../pokemon/party.js";
import { cancelarRanged } from "./ranged.js";
import { npcPorId } from "../npc/runtime.js";
import { iniciarBatalhaViajante } from "../npc/viajantes/batalha.js";
import { ancoraDeFalante, sincronizarDialogoBalao } from "./dialogoBalao.js";
import { abrirQuestBoard } from "./hud/questBoard/janela.js";
import {
  acharTomado,
  comecarEscortMissao,
  tentarEntregarMaterial,
} from "../quests/runtime.js";
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
import { tocarChoose } from "./som/mundoSfx.js";
import { htmlIcone } from "./icones.js";
import { abrirDex, dexAberta, fecharDex, soltarSimbioseParaTrocaHud, toggleRideSlot, toggleSimbioseSlot, toggleSkillLoadout, toggleStatusMon } from "./apiHud.js";
import { tratarUtilityHud } from "./hud/bootHud.js";
import { htmlMochilaMenu } from "./uiMenuPaginas.js";
import { aoMudarIdioma, definirIdioma, idiomaAtual, t } from "./i18n.js";
import { ligarJanelaPc, sincronizarJanelaPc } from "./pc/janela.js";
import { ligarJanelaLoja, sincronizarJanelaLoja } from "./loja/janela.js";
import { quantidadeLoja, tratarLoja } from "./loja.js";
import { obterHora } from "../render/3d/ceu/controleCeu.js";
import { ligarHudClima, tickHudPrevisao } from "./hudClima.js";
import { ligarHudVento, tickHudVento } from "./hudVento.js";
import { deLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, CENTRO_AREA } from "../mundo/regiao/grafoKanto.js";
import { amostraKanto, dentroDoKanto } from "../mundo/regiao/amostraKanto.js";
import { tickTiles } from "../ui/mapa/atlas.js";
import { pintarMapa } from "../ui/mapa/pintar.js";
import { abrirMapa, mapaAberto } from "../ui/mapa/mapaMundo.js";
import { ancoraCameraTeleporte, teleporteMapaAmpliado, vistaMapaTeleporte } from "./teleporte.js";

let raiz = null;

export function ligarUi(overlay) {
  raiz = overlay;
  ligarIdioma();
  pintarUtilityIcons();
  // Libera pointer lock antes do clique na hotbar (troca/desliga item).
  raiz.addEventListener(
    "pointerdown",
    (ev) => {
      const btn = ev.target.closest('[data-act="slot"]');
      if (btn) cancelarRanged();
    },
    true,
  );
  raiz.addEventListener("click", noClique);
  raiz.addEventListener("change", noChange);
  ligarJanelaPc(raiz);
  ligarJanelaLoja(raiz);
  ligarHudClima();
  ligarHudVento();
  ligarChrome();
  ligarTelaCheia();
  raiz.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (
      !estado.painel &&
      !estado.menuAberto &&
      !estado.dexAberta &&
      !estado.capsulaAberta &&
      !estado.statusAberto &&
      !estado.skillAberto &&
      !estado.statusMonAberto
    )
      return;
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
    dexHud()?.atualizarRotulos?.() ?? dexHud()?.refreshLabels?.();
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
  else   if (act === "ride") {
    toggleRideSlot(Number(btn.dataset.i));
    pintar();
    return;
  } else if (act === "simbiose") {
    toggleSimbioseSlot(Number(btn.dataset.i));
    pintar();
    return;
  } else if (act === "skills") {
    toggleSkillLoadout();
    pintar();
    return;
  } else if (act === "status-mon") {
    toggleStatusMon(Number(btn.dataset.i));
    pintar();
    return;
  } else if (act === "utility") {
    tratarUtility(btn.dataset.utility);
    pintar();
    return;
  } else if (act === "cat") {
    estado.categoria = btn.dataset.cat;
    estado.itemBagSel = null;
    const hostBag = document.querySelector('[data-menu-host="bag"]');
    if (estado.menuAberto && hostBag) hostBag.innerHTML = htmlMochilaMenu();
    avisar();
  } else if (act === "bag-sel") {
    estado.itemBagSel = tipo && key ? { tipo, key } : null;
    const hostBag = document.querySelector('[data-menu-host="bag"]');
    if (estado.menuAberto && hostBag) hostBag.innerHTML = htmlMochilaMenu();
  } else if (act === "usar" || act === "usar-mon") usarSelecionado(tipo, key, "pokemon");
  else if (act === "usar-jogador") usarSelecionado(tipo, key, "jogador");
  else if (act === "slot") {
    cancelarRanged();
    alternarSlot(i);
  } else if (act === "ciclo") cicloSlot(i);
  else if (act === "limpar-slot") atribuirSlot(i, null, null);
  else if (act === "deploy") {
    if (soltarSimbioseParaTrocaHud()) {
      pintar();
      return;
    }
    const mon = listaParty()[i];
    if (mon && (mon.morto || mon.hp <= 0)) toggleStatusMon(i);
    else alternarCampo(i);
  }
  else if (act === "depositar") {
    if (soltarSimbioseParaTrocaHud()) {
      pintar();
      return;
    }
    toast(moverDaPartyParaCaixa(i));
  }
  else if (act === "retirar") toast(moverDaCaixaParaParty(i));
  else if (act === "soltar-caixa") toast(soltarDaCaixa(i));
  else if (act === "soltar-party") {
    if (soltarSimbioseParaTrocaHud()) {
      pintar();
      return;
    }
    const ator = tirarDaParty(i);
    toast(ator ? `Soltou ${nomeEspecie(ator)}.` : "O time precisa de um Pokémon.");
    avisar();
  } else if (act === "comprar") toast(comprar(tipo, key, quantidadeLoja({ tipo, key, qtd: Number(btn.dataset.max) || 99, preco: 1 })));
  else if (act === "vender") toast(vender(tipo, key, quantidadeLoja({ tipo, key, qtd: Number(btn.dataset.max) || 1, preco: 1 })));
  else if (act === "craft") toast(craftarBola(key));
  else if (act === "movel") colocarSelecionado(key);
  else if (act === "salvar") salvar();
  else if (act === "escolha") escolher(btn.dataset.id);
  else if (act === "seguir") avancarDialogo();
  else if (tratarLoja(act, btn)) {
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
  if (!interior || interior.papel !== "casa") {
    estado.itemGet = "Só dentro de casa.";
    return;
  }
  if (interior.sala3d) {
    colocarMovelSala3d(key);
    return;
  }
  if (!interior.sala) {
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

function colocarMovelSala3d(key) {
  const corpo = corpoRef;
  const interior = estado.interior;
  if (!corpo || !interior?.casaId) {
    estado.itemGet = "Só dentro de casa.";
    return;
  }
  const chao = origemDoChao();
  const med = medidasSala();
  let fx = Number(corpo.dirX);
  let fy = Number(corpo.dirY);
  if (!Number.isFinite(fx)) fx = 0;
  if (!Number.isFinite(fy)) fy = 0;
  const len2 = fx * fx + fy * fy;
  if (len2 < 0.01) {
    fx = 0;
    fy = 1;
  } else {
    const len = Math.sqrt(len2);
    fx /= len;
    fy /= len;
  }
  const wx = corpo.x + fx * 1.25;
  const wy = corpo.y + fy * 1.25;
  if (wx < med.chaoX0 || wx >= med.chaoX1 || wy < med.chaoY0 || wy >= med.chaoY1) {
    estado.itemGet = "Aponte para o chão da sala.";
    return;
  }
  const tx = Math.floor(wx - chao.x);
  const ty = Math.floor(wy - chao.y);
  const lista = estado.moveis[interior.casaId] || [];
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].x === tx && lista[i].y === ty) {
      estado.itemGet = "Já tem alguma coisa aí.";
      return;
    }
  }
  const msg = colocarMovel(interior.casaId, key, tx, ty);
  if (msg) {
    toast(msg);
    return;
  }
  definirMoveisJogador(estado.moveis[interior.casaId] || []);
  if (interior.playerHouseId) {
    syncInteriorMoveis(interior.playerHouseId, estado.moveis[interior.casaId] || []);
  }
}

function escolher(id) {
  const dlg = estado.dialogo;
  if (!dlg) return;
  if (dlg.acao === "curar" && id === "sim") {
    curarParty();
    reporBolasCura();
    marcarQuest("centro");
    sfx("cura");
    estado.dialogo = { nome: "Enfermeira", linhas: ["Pronto. Seu time está curado e as Pokébolas foram repostas."], i: 0 };
  } else if (dlg.acao === "curar") {
    estado.dialogo = { nome: "Enfermeira", linhas: ["Volte quando precisar."], i: 0 };
  } else if (dlg.acao === "desafioViajante") {
    const npc = dlg.npcRef || (dlg.npcId ? npcPorId(dlg.npcId) : null);
    const ancora = dlg.ancora || ancoraDeFalante(npc);
    if (id === "batalhar" && npc) {
      estado.dialogo = null;
      if (!iniciarBatalhaViajante(npc)) {
        if (npc) npc.combatHold = false;
        estado.dialogo = {
          nome: dlg.nome,
          linhas: ["Hmm… agora não vai dar. Depois a gente tenta!"],
          i: 0,
          npcRef: npc,
          ancora,
        };
      }
    } else {
      if (npc) npc.combatHold = false;
      estado.dialogo = {
        nome: dlg.nome,
        linhas: ["Beleza, a gente se vê na estrada!"],
        i: 0,
        npcRef: npc,
        ancora,
      };
    }
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
  // equipe via partyCampo (bootHud)
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

const UTILITY_ICONES = Object.freeze({
  pokedex: "pokedex",
  map: "townMap",
  pokeRadar: "pokeRadar",
  bag: "bag",
  quests: "quest",
  party: "party",
  status: "statusCard",
  menu: "menu",
  save: "saveDisk",
});

function pintarUtilityIcons() {
  if (!raiz) return;
  const botoes = raiz.querySelectorAll(".hud-utility-btn[data-utility]");
  for (let i = 0; i < botoes.length; i++) {
    const btn = botoes[i];
    const chave = UTILITY_ICONES[btn.dataset.utility];
    if (!chave) continue;
    if (btn.dataset.iconePronto === chave) continue;
    const grande =
      btn.dataset.utility === "pokedex" ||
      btn.dataset.utility === "map" ||
      btn.dataset.utility === "pokeRadar";
    btn.innerHTML = htmlIcone(chave, "hud-utility-btn__icon", grande ? 42 : 28);
    btn.dataset.iconePronto = chave;
  }
}

function botaoUtility(id) {
  return document.querySelector(`.hud-utility-btn[data-utility="${id}"]`);
}

function aplicarChrome(oculto) {
  document.body.classList.toggle("sem-chrome", oculto);
  const btn = botaoUtility("chrome");
  if (!btn) return;
  btn.setAttribute("aria-pressed", oculto ? "true" : "false");
  btn.setAttribute(
    "aria-label",
    oculto ? "Mostrar cabeçalho e painel" : "Esconder cabeçalho e painel",
  );
}

function ligarChrome() {
  let oculto = false;
  try {
    oculto = localStorage.getItem(CHAVE_CHROME) === "0";
  } catch {
    oculto = false;
  }
  aplicarChrome(oculto);
  if (oculto) window.dispatchEvent(new Event("resize"));
}

function alternarChrome() {
  const oculto = !document.body.classList.contains("sem-chrome");
  aplicarChrome(oculto);
  try {
    localStorage.setItem(CHAVE_CHROME, oculto ? "0" : "1");
  } catch {
    /* preferência local indisponível */
  }
  window.dispatchEvent(new Event("resize"));
}

function sincronizarTelaCheia() {
  const btn = botaoUtility("telaCheia");
  if (!btn) return;
  const on = document.fullscreenElement === document.documentElement;
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.setAttribute("aria-label", on ? "Sair da tela cheia" : "Tela cheia");
}

function ligarTelaCheia() {
  if (document.documentElement.dataset.telaCheia) return;
  document.documentElement.dataset.telaCheia = "1";
  document.addEventListener("fullscreenchange", sincronizarTelaCheia);
  sincronizarTelaCheia();
}

function alternarTelaCheia() {
  const doc = document.documentElement;
  const pedido = document.fullscreenElement
    ? document.exitFullscreen?.()
    : doc.requestFullscreen?.();
  pedido?.catch?.(() => {});
}

function tratarUtility(id) {
  if (id === "chrome") {
    alternarChrome();
    return;
  }
  if (id === "telaCheia") {
    alternarTelaCheia();
    return;
  }
  if (id === "pokedex") {
    if (dexAberta()) fecharDex();
    else abrirDex();
    return;
  }
  if (tratarUtilityHud(id)) return;
  if (id === "save") {
    salvar();
    return;
  }
  if (id === "map") {
    const p = pontoMini();
    abrirMapa(p.x, p.y);
  }
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
    const vazio = !slot;
    const ativo = i === estado.slotAtivo;
    const pronto = ativo && !vazio;
    const guardado = !vazio && !pronto;
    const classes = [
      "hotbar-hud__slot",
      vazio ? "is-empty" : "",
      ativo ? "is-active" : "",
      pronto ? "is-ready" : "",
      guardado ? "is-stowed" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const icone = slot
      ? htmlIcone(slot.key, "hotbar-hud__icon", 42)
      : `<span class="hotbar-hud__icon jogo-icone--vazio"></span>`;
    partes.push(
      `<button type="button" class="${classes}" data-act="slot" data-i="${i}" title="${escHtml(nome)}">
        <span class="hotbar-hud__key">${tecla}</span>
        ${icone}
        <span class="hotbar-hud__count">${qtd || ""}</span>
      </button>`,
    );
  }
  host.innerHTML = partes.join("");
}

export function atualizarLeve(dt = 0.016) {
  pintarPrompt();
  pintarDinheiro();
  pintarToast();
  pintarMini();
  pintarRelogio();
  tickHudPrevisao();
  tickHudVento(dt);
  if (estado.dialogo) sincronizarDialogoBalao();
  // party strip / combat card: tickHudCampo em index.js
}

function pintarPrompt() {
  const entrar = el("#jogo-entrar");
  const host = el("#jogo-prompt");
  const bloqueia =
    estado.dialogo ||
    estado.painel ||
    estado.menuAberto ||
    estado.dexAberta ||
    estado.capsulaAberta ||
    estado.statusAberto ||
    estado.skillAberto ||
    estado.statusMonAberto ||
    estado.roda ||
    estado.construir ||
    estado.craft ||
    estado.ganhoAberto;
  const mostraEntrar = !!estado.promptEntrar && !bloqueia;
  if (entrar) {
    const estava = !entrar.hidden;
    entrar.hidden = !mostraEntrar;
    if (mostraEntrar) {
      const rotulo = entrar.querySelector(".acao-prompt__rotulo");
      const texto = estado.promptRotulo || "Entrar";
      const tecla = estado.promptTecla === "r" ? "r" : "e";
      const teclaAntes = entrar.dataset.teclaAtiva || "e";
      const mudou =
        (!!rotulo && rotulo.textContent !== texto) || teclaAntes !== tecla;
      if (rotulo) rotulo.textContent = texto;
      const teclas = entrar.querySelectorAll(".acao-prompt__tecla");
      for (let i = 0; i < teclas.length; i++) {
        teclas[i].classList.toggle(
          "acao-prompt__tecla--ativa",
          teclas[i].classList.contains(`acao-prompt__tecla--${tecla}`),
        );
      }
      entrar.dataset.teclaAtiva = tecla;
      if (!estava || mudou) {
        entrar.classList.remove("acao-prompt--nova");
        void entrar.offsetWidth;
        entrar.classList.add("acao-prompt--nova");
      }
      // Centro inferior via CSS; limpa leftovers de âncora no mundo.
      entrar.style.left = "";
      entrar.style.top = "";
    } else if (estava) {
      entrar.classList.remove("acao-prompt--nova");
      entrar.dataset.teclaAtiva = "";
    }
  }
  if (!host) return;
  host.hidden = !estado.prompt;
  host.textContent = estado.prompt || "";
}

function pintarDinheiro() {
  const host = el("#jogo-dinheiro");
  if (!host) return;
  const b = host.querySelector("[data-dinheiro]") || host.querySelector("b");
  const texto = `₽ ${estado.dinheiro}`;
  if (b) b.textContent = texto;
  else host.textContent = texto;
}

function pintarToast() {
  const host = el("#jogo-toast");
  if (!host) return;
  host.hidden = !estado.itemGet;
  host.textContent = estado.itemGet || "";
}

function pintarDialogo() {
  sincronizarDialogoBalao();
}

export function avancarDialogo() {
  const dlg = estado.dialogo;
  if (!dlg) return;
  if (dlg.escolhas && dlg.i >= dlg.linhas.length - 1) return;
  dlg.i += 1;
  tocarChoose();
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
    if (dlg.npcRef && !estado.batalhaTreinador) {
      dlg.npcRef.combatHold = false;
    }
    const onClose = dlg.onClose;
    estado.dialogo = null;
    if (typeof onClose === "function") onClose();
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
              ? `<img class="party-slot__face" src="${url}" alt="" draggable="false" />`
              : `<span class="party-slot__face">${escHtml(nomeEspecie(ator).slice(0, 1))}</span>`;
            const faint = ator.hpMax > 0 && ator.hp <= 0;
            const actSlot = faint ? "status-mon" : "deploy";
            return `<div class="party-slot-wrap">
              <button type="button" class="party-slot${fora && campo === ator ? " is-on is-out" : ""}${faint ? " is-fainted" : ""}" data-act="${actSlot}" data-i="${i}" title="${escHtml(nomeEspecie(ator))}">
                <span class="party-slot__portrait">${face}</span>
                <span class="party-slot__hp"><i data-hp="${i}"></i></span>
              </button>
              <button type="button" class="party-slot__lv" data-act="status-mon" data-i="${i}" title="Status · Nv${ator.nivel}" aria-label="Abrir status">Nv${ator.nivel}</button>
            </div>`;
          })
          .join("")
      : "";
  }
  for (let i = 0; i < party.length; i++) {
    const ator = party[i];
    const t = ator.hpMax > 0 ? Math.max(0, ator.hp) / ator.hpMax : 0;
    const bar = host.querySelector(`[data-hp="${i}"]`);
    if (bar) {
      bar.style.width = `${Math.round(t * 100)}%`;
      bar.dataset.baixa = t < 0.35 ? "1" : "0";
    }
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
    sincronizarJanelaLoja(false);
    return;
  }
  if (nome === "loja") {
    host.hidden = true;
    host.innerHTML = "";
    sincronizarJanelaPc(false);
    sincronizarJanelaLoja(true);
    return;
  }
  sincronizarJanelaPc(false);
  sincronizarJanelaLoja(false);
  host.hidden = !nome;
  host.classList.remove("jogo-painel--capsula");
  if (!nome) {
    host.innerHTML = "";
    return;
  }
  host.innerHTML = htmlMenu(nome);
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

function chipCustoMovel(key, amount) {
  const tem = contar(TIPO_ITEM.MATERIAL, key) | 0;
  const nome = MATERIAIS[key]?.nome || key;
  const empty = tem < amount ? " is-empty" : "";
  return `<span class="bch-mat${empty}" title="${escHtml(nome)} (${tem}/${amount})">${htmlIcone(key, "bch-mat__ico", 16)}<b>${amount}</b></span>`;
}

function pintarConstruir() {
  const host = el("#jogo-construir");
  if (!host) return;
  host.hidden = !estado.construir;
  if (!estado.construir) return;
  host.className = "bch-hud bch-hud--indoor";
  const chaves = Object.keys(MOVEIS);
  const cards = chaves
    .map((key) => {
      const m = MOVEIS[key];
      const ok = podePagarCusto(m.custo);
      const custo = Object.entries(m.custo)
        .map(([k, n]) => chipCustoMovel(k, n))
        .join("");
      return `<article class="bch-card${ok ? "" : " is-off"}">
        <span class="bch-card__nome">${escHtml(m.nome)}</span>
        <button type="button" class="hud-btn yellow small" data-act="movel" data-key="${key}" ${ok ? "" : "disabled"}>Colocar</button>
        <div class="bch-card__custo">${custo}</div>
      </article>`;
    })
    .join("");
  host.innerHTML = `<div class="bch-hud__panel hud-panel" role="dialog" aria-label="Móveis">
    <header class="bch-hud__head hud-head">
      <div class="bch-hud__head-text">
        <b>Móveis</b>
        <span>Decore o interior da casa</span>
      </div>
      <button type="button" class="bch-hud__x" data-act="fechar" aria-label="Fechar">×</button>
    </header>
    <div class="bch-hud__lista">${cards}</div>
    <footer class="bch-hud__foot">
      <p class="bch-hud__hint">Olhe para o chão livre e coloque.</p>
      <button type="button" class="hud-btn red big" data-act="fechar">
        Fechar
        <kbd class="hud-kbd">Esc</kbd>
      </button>
    </footer>
  </div>`;
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
  const chave = `${texto}|${periodo.chave}`;
  if (host.dataset.chave === chave) return;
  host.dataset.chave = chave;
  host.dataset.periodo = periodo.chave;
  const horaEl = host.querySelector("[data-hora]");
  const perEl = host.querySelector("[data-periodo]");
  if (horaEl) horaEl.textContent = texto;
  if (perEl) perEl.textContent = periodo.nome;
}

const ZOOM_MINI = 2;
const MINI_PX = 220;
const CHAVE_CHROME = "hud-chrome";
/** Último ponto da âncora, reusado. A seta segue o deslocamento da viagem. */
const rumoMini = { x: 0, y: 0, dx: 0, dy: 1, tem: false };
let miniNoHud = false;

function pontoMini() {
  const voo = ancoraCameraTeleporte();
  if (voo) return { x: voo.x, y: voo.mapaY };
  if (estado.interior && Number.isFinite(estado.interior.ax)) {
    return deLocalKanto(
      estado.interior.ax * AREA_KANTO + CENTRO_AREA + 0.5,
      estado.interior.ay * AREA_KANTO + CENTRO_AREA + 0.5,
    );
  }
  return { x: corpoRef?.x || 0, y: corpoRef?.y || 0 };
}

function rumoDaViagem(x, y, corpo) {
  if (rumoMini.tem) {
    const mx = x - rumoMini.x;
    const my = y - rumoMini.y;
    if (mx * mx + my * my > 0.04) {
      const len = Math.hypot(mx, my) || 1;
      rumoMini.dx = mx / len;
      rumoMini.dy = my / len;
    }
  } else {
    rumoMini.dx = corpo?.dirX || 0;
    rumoMini.dy = corpo?.dirY || 1;
  }
  rumoMini.x = x;
  rumoMini.y = y;
  rumoMini.tem = true;
  return rumoMini;
}

function hudJogo() {
  if (raiz?.id === "jogo-hud") return raiz;
  return el("#jogo-hud") || document.getElementById("jogo-hud");
}

function sincronizarMiniViagem(ativo) {
  const mini = el("#area-minimap");
  const hud = hudJogo();
  const dock = el("#hud-map-dock");
  if (!mini || !hud || !dock) return;
  if (ativo === miniNoHud && hud.classList.contains("is-mapa-viagem") === ativo) return;
  if (ativo && !miniNoHud) {
    hud.appendChild(mini);
    miniNoHud = true;
  } else if (!ativo && miniNoHud) {
    const readouts = dock.querySelector(".area-minimap__readouts");
    if (readouts) dock.insertBefore(mini, readouts);
    else dock.appendChild(mini);
    miniNoHud = false;
    rumoMini.tem = false;
  }
  hud.classList.toggle("is-mapa-viagem", ativo);
  document.body.classList.toggle("is-teleporte-mapa", ativo);
}

function pintarMini() {
  const tela = el("#jogo-mini");
  if (!tela) return;
  const voo = ancoraCameraTeleporte();
  if (!voo) rumoMini.tem = false;
  const ampliado = teleporteMapaAmpliado();
  const viagem = ampliado ? vistaMapaTeleporte() : null;
  sincronizarMiniViagem(ampliado);
  const caixa = ampliado ? el("#area-minimap") : null;
  const cssW = ampliado ? Math.max(MINI_PX, caixa?.clientWidth || MINI_PX) : MINI_PX;
  const cssH = ampliado ? Math.max(MINI_PX, caixa?.clientHeight || MINI_PX) : MINI_PX;
  const dpr = ampliado ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const LIMITE_VIAGEM = 1600;
  const maiorCss = Math.max(cssW, cssH);
  const escalaBuf = ampliado && maiorCss > LIMITE_VIAGEM ? LIMITE_VIAGEM / maiorCss : 1;
  const bw = Math.max(1, Math.round(cssW * (ampliado ? escalaBuf : dpr)));
  const bh = Math.max(1, Math.round(cssH * (ampliado ? escalaBuf : dpr)));
  const ponto = viagem ? { x: viagem.x, y: viagem.y } : pontoMini();
  const ZOOM_PERTO = 1.55;
  let zoomMini = ZOOM_MINI;
  if (viagem) {
    const zoomLonge = Math.min(ZOOM_PERTO * 0.92, bw / Math.max(viagem.alcance * 1.5, 240));
    zoomMini = ZOOM_PERTO + (zoomLonge - ZOOM_PERTO) * viagem.afastamento;
    if (cssW > 0) zoomMini *= bw / cssW;
  }
  if (tela.width !== bw || tela.height !== bh) {
    tela.width = bw;
    tela.height = bh;
  }
  // No voo ampliado fica só o atlas geral: tile de perto no corredor trava o jogo.
  if (!mapaAberto() && !ampliado) {
    const meioX = cssW / (2 * ZOOM_MINI);
    const meioY = cssH / (2 * ZOOM_MINI);
    tickTiles(
      ponto.x,
      ponto.y,
      ZOOM_MINI,
      ponto.x - meioX,
      ponto.y - meioY,
      ponto.x + meioX,
      ponto.y + meioY,
    );
  }
  const corpo = corpoRef;
  const rumo = voo ? rumoDaViagem(ponto.x, ponto.y, corpo) : null;
  pintarMapa(tela.getContext("2d"), bw, bh, dpr, {
    cx: ponto.x,
    cy: ponto.y,
    zoom: zoomMini,
    jogadorX: ponto.x,
    jogadorY: ponto.y,
    jogadorDirX: rumo ? rumo.dx : corpo?.dirX ?? 0,
    jogadorDirY: rumo ? rumo.dy : corpo?.dirY ?? 0,
    jogadorFacing: corpo?.facing ?? 0,
    agora: performance.now(),
    mini: true,
    soVisao: ampliado,
    qualidade: ampliado ? "low" : "high",
  });
  const place = raiz?.querySelector("[data-minimap-place]");
  if (place) {
    let nome = "Kanto";
    if (dentroDoKanto(ponto.x, ponto.y)) {
      const a = amostraKanto(ponto.x, ponto.y);
      if (a?.nome) nome = a.nome;
    }
    if (place.textContent !== nome) place.textContent = nome;
  }
}

let corpoRef = null;

export function definirCorpo(corpo) {
  corpoRef = corpo;
}

export function lerPlaca(placa) {
  if (!placa || estado.dialogo || estado.painel) return;
  if (typeof placa.id === "string" && placa.id.startsWith("quadro:")) {
    abrirQuestBoard(placa.id.slice("quadro:".length));
    return;
  }
  estado.dialogo = {
    nome: placa.nome,
    linhas: placa.linhas.slice(),
    i: 0,
    ancora: ancoraDeFalante(placa),
  };
  avisar();
}

/** Abre diálogo a partir de um NPC do runtime (cidade / viajante / casa). */
export function falarNpcMundo(npc) {
  if (!npc) return;
  const ancora = ancoraDeFalante(npc);

  if (npc.tipo === "quest-rescue" || npc.questId) {
    const rec = acharTomado(npc.questId);
    const jaEscort = !!(rec?.escorting || npc.escorting);
    estado.dialogo = {
      nome: npc.nome,
      linhas: (npc.fala || ["…"]).slice(),
      i: 0,
      retrato: npc.retrato || "",
      npcRef: npc,
      ancora,
      onClose: jaEscort ? null : () => comecarEscortMissao(),
    };
    avisar();
    return;
  }

  const entrega = tentarEntregarMaterial(npc);
  if (entrega.handled) {
    estado.dialogo = {
      nome: npc.nome,
      linhas: (entrega.linhas || ["…"]).slice(),
      i: 0,
      retrato: npc.retrato || "",
      npcRef: npc,
      ancora,
      onClose: entrega.onClose || null,
    };
    avisar();
    return;
  }
  falarNpcMundoResto(npc, ancora);
}

function falarNpcMundoResto(npc, ancora) {
  if (npc.owTrainer) {
    npc.combatHold = true;
    if (npc.defeatedByPlayer) {
      estado.dialogo = {
        nome: npc.nome,
        linhas: (npc.fala || ["Já treinamos bastante por hoje."]).slice(),
        i: 0,
        retrato: npc.retrato || "",
        npcId: npc.id,
        npcRef: npc,
        ancora,
        acao: "viajantePos",
      };
    } else {
      const base = (npc.fala || []).slice(0, 2);
      estado.dialogo = {
        nome: npc.nome,
        linhas: [...base, "Que tal uma batalha Pokémon?"],
        i: 0,
        retrato: npc.retrato || "",
        npcId: npc.id,
        npcRef: npc,
        ancora,
        acao: "desafioViajante",
        escolhas: [
          { id: "batalhar", rotulo: "Batalhar" },
          { id: "recusar", rotulo: "Depois" },
        ],
      };
    }
    avisar();
    return;
  }
  estado.dialogo = {
    nome: npc.nome,
    linhas: (npc.fala || ["…"]).slice(),
    i: 0,
    retrato: npc.retrato || "",
    npcRef: npc,
    ancora,
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
      retrato: ref.retrato || "",
      npcRef: ref,
      ancora: ancoraDeFalante(ref),
    };
    avisar();
    return;
  }
  if (ref.acao === "pc") {
    estado.dialogo = {
      nome: "PC",
      linhas: ["O PC do Centro está ligado."],
      i: 0,
      acao: "pc",
      ancora: ancoraDeFalante(ref),
    };
    avisar();
    return;
  }
  if (ref.cura) {
    curarParty();
    reporBolasCura();
    marcarQuest("centro");
    sfx("cura");
    estado.itemGet = "Descansou. Time curado e Pokébolas repostas.";
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
  if (estado.interior?.papel === "casa" && hotbarAtivo()?.key === "hammer") {
    return "Martelo — clique esquerdo abre os móveis";
  }
  if (!estado.interior && hotbarAtivo()?.key === "flag") {
    return "Bandeira — clique planta/reloca a base";
  }
  if (!estado.interior && hotbarAtivo()?.key === "hammer") {
    return "Martelo — 1º bandeira · catálogo · clique p/ Pokémon construir · Shift: demolir";
  }
  if (!estado.interior && ferramenta) return `${ferramenta} — clique esquerdo`;
  return "";
}

export function classeDeChave(key) {
  return classificarChave(key);
}
