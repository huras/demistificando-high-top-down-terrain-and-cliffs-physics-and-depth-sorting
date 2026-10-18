/**
 * Janela do PC do Bill. Lê o time e estado.caixas.
 * Retrato no lugar do sprite de dungeon. Sem palco de bioma.
 */
import { POKEMON } from "../../config.js";
import { especie } from "../../pokemon/dados.js";
import { listaParty } from "../../pokemon/party.js";
import {
  depositarNoSlot,
  estado,
  fecharTopo,
  moverEntreCaixas,
  reordenarTime,
  retirarDoSlot,
  soltarDoSlot,
  soltarDoTime,
  trocarPartyComCaixa,
} from "../estado.js";

const DICA = "Arraste entre o time e as caixas. O último Pokémon fica com você.";
const MIME = "application/x-pokemon-pc-slot";

let raiz = null;
let caixaVista = 0;
let selecao = null;
let mensagem = "";
let confirmar = false;
let assinatura = "";
let arrastando = null;
let alvoEl = null;

export function ligarJanelaPc(overlay) {
  raiz = overlay.querySelector("#jogo-pc");
  if (!raiz || raiz.dataset.pronta) return;
  raiz.dataset.pronta = "1";
  montar();
  raiz.addEventListener("click", noClique);
  raiz.addEventListener("dragstart", noArraste);
  raiz.addEventListener("dragover", noSobre);
  raiz.addEventListener("drop", noSoltar);
  raiz.addEventListener("dragend", limparArraste);
}

export function sincronizarJanelaPc(aberta) {
  if (!raiz) return;
  if (!aberta) {
    if (raiz.hidden) return;
    raiz.hidden = true;
    raiz.classList.remove("is-in");
    document.body.classList.remove("is-pc-open");
    selecao = null;
    mensagem = "";
    confirmar = false;
    assinatura = "";
    limparArraste();
    return;
  }
  const abrindo = raiz.hidden;
  if (abrindo) {
    caixaVista = estado.caixaAtiva | 0;
    raiz.hidden = false;
    document.body.classList.add("is-pc-open");
    assinatura = "";
    requestAnimationFrame(() => raiz?.classList.add("is-in"));
  }
  const agora = lerAssinatura();
  if (agora === assinatura) return;
  assinatura = agora;
  pintar();
}

function montar() {
  const party = POKEMON.PARTY_MAX;
  const slots = estado.caixas[0]?.slots.length || 30;
  const caixas = estado.caixas.length;
  const abas = [];
  for (let i = 0; i < caixas; i++) {
    abas.push(
      `<button type="button" class="pc-hud__tab" data-pc="aba" data-caixa="${i}">
        <span data-rotulo>${i + 1}</span>
        <span class="pc-hud__tab-count" data-contagem>0</span>
      </button>`,
    );
  }
  const time = [];
  for (let i = 0; i < party; i++) time.push(htmlSlot("party", i, 0));
  const grade = [];
  for (let i = 0; i < slots; i++) grade.push(htmlSlot("caixa", i, 0));
  raiz.innerHTML = `<div class="pc-hud__backdrop" data-pc="fechar"></div>
    <div class="pc-hud__sheet" role="dialog" aria-modal="true" aria-labelledby="pc-titulo">
      <header class="pc-hud__header">
        <div>
          <p class="pc-hud__kicker">Centro Pokémon</p>
          <h2 class="pc-hud__title" id="pc-titulo">PC do Bill</h2>
        </div>
        <p class="pc-hud__summary" data-resumo></p>
        <button type="button" class="pc-hud__close" data-pc="fechar" aria-label="Fechar">×</button>
      </header>
      <div class="pc-hud__rail" data-abas>${abas.join("")}</div>
      <div class="pc-hud__main">
        <section class="pc-hud__party">
          <h3 class="pc-hud__pane-title">Time</h3>
          <div class="pc-hud__party-grid">${time.join("")}</div>
        </section>
        <section class="pc-hud__box">
          <h3 class="pc-hud__pane-title" data-caixa-nome>Caixa</h3>
          <div class="pc-hud__box-stage">
            <div class="pc-hud__box-grid">${grade.join("")}</div>
          </div>
        </section>
        <aside class="pc-hud__inspector">
          <div class="pc-hud__inspect-icon is-empty"><img class="pc-hud__sprite" alt="" /></div>
          <p class="pc-hud__inspect-name">Escolha um Pokémon</p>
          <p class="pc-hud__inspect-meta"></p>
          <p class="pc-hud__inspect-hp"></p>
          <p class="pc-hud__hint" data-dica>${DICA}</p>
          <button type="button" class="pc-hud__release" data-pc="soltar" hidden>Soltar</button>
        </aside>
      </div>
    </div>`;
}

function htmlSlot(lado, i, caixa) {
  const extra = lado === "party" ? "pc-hud__slot--party" : "pc-hud__slot--box";
  return `<button type="button" class="pc-hud__slot ${extra} is-empty" draggable="false" data-pc="slot" data-lado="${lado}" data-i="${i}" data-caixa="${caixa}">
    <span class="pc-hud__slot-icon"><img class="pc-hud__sprite" alt="" /></span>
    <span class="pc-hud__slot-copy">
      <span class="pc-hud__slot-name"></span>
      <span class="pc-hud__slot-level"></span>
      <span class="pc-hud__slot-hp"></span>
    </span>
  </button>`;
}

function pintar() {
  const party = listaParty();
  const caixa = estado.caixas[caixaVista] || estado.caixas[0];
  let noPc = 0;
  const abas = raiz.querySelectorAll("[data-pc='aba']");
  for (let i = 0; i < abas.length; i++) {
    const n = ocupados(estado.caixas[i]);
    noPc += n;
    abas[i].classList.toggle("is-active", i === caixaVista);
    abas[i].querySelector("[data-contagem]").textContent = String(n);
  }
  const resumo = raiz.querySelector("[data-resumo]");
  if (resumo) resumo.textContent = `${noPc} no PC · ${party.length} no time`;
  const titulo = raiz.querySelector("[data-caixa-nome]");
  if (titulo && caixa) titulo.textContent = caixa.nome;
  const doTime = raiz.querySelectorAll(".pc-hud__slot--party");
  for (let i = 0; i < doTime.length; i++) preencher(doTime[i], monDeAtor(party[i]), "party", i, 0);
  const daCaixa = raiz.querySelectorAll(".pc-hud__slot--box");
  for (let i = 0; i < daCaixa.length; i++) {
    daCaixa[i].dataset.caixa = String(caixaVista);
    preencher(daCaixa[i], monDeSnap(caixa?.slots[i]), "caixa", i, caixaVista);
  }
  pintarInspetor(party, caixa);
}

function preencher(btn, mon, lado, i, caixa) {
  const vazio = !mon;
  const escolhido = !!selecao && selecao.lado === lado && selecao.i === i && (lado === "party" || selecao.caixa === caixa);
  btn.classList.toggle("is-empty", vazio);
  btn.classList.toggle("is-fainted", !!mon && mon.hp <= 0);
  btn.classList.toggle("is-shiny", !!mon && mon.shiny);
  btn.classList.toggle("is-selected", escolhido);
  btn.draggable = !vazio;
  const img = btn.querySelector("img");
  const nome = btn.querySelector(".pc-hud__slot-name");
  const nivel = btn.querySelector(".pc-hud__slot-level");
  const hp = btn.querySelector(".pc-hud__slot-hp");
  if (!mon) {
    img.removeAttribute("src");
    img.dataset.url = "";
    nome.textContent = "";
    nivel.textContent = "";
    hp.textContent = "";
    return;
  }
  const url = urlRetrato(mon);
  if (img.dataset.url !== url) {
    img.dataset.url = url;
    if (url) img.src = url;
  }
  nome.textContent = mon.shiny ? `${mon.nome} ✦` : mon.nome;
  nivel.textContent = `Nv ${mon.nivel}`;
  hp.textContent = `${mon.hp}/${mon.hpMax}`;
}

function pintarInspetor(party, caixa) {
  const mon = monSelecionado(party, caixa);
  const icone = raiz.querySelector(".pc-hud__inspect-icon");
  const img = icone.querySelector("img");
  const nome = raiz.querySelector(".pc-hud__inspect-name");
  const meta = raiz.querySelector(".pc-hud__inspect-meta");
  const hp = raiz.querySelector(".pc-hud__inspect-hp");
  const dica = raiz.querySelector("[data-dica]");
  const soltar = raiz.querySelector("[data-pc='soltar']");
  icone.classList.toggle("is-empty", !mon);
  icone.classList.toggle("is-fainted", !!mon && mon.hp <= 0);
  if (!mon) {
    img.removeAttribute("src");
    img.dataset.url = "";
    nome.textContent = "Escolha um Pokémon";
    meta.textContent = "";
    hp.textContent = "";
    soltar.hidden = true;
    confirmar = false;
  } else {
    const url = urlRetrato(mon);
    if (img.dataset.url !== url) {
      img.dataset.url = url;
      if (url) img.src = url;
    }
    nome.textContent = mon.shiny ? `${mon.nome} ✦` : mon.nome;
    meta.textContent = selecao.lado === "party" ? `Nv ${mon.nivel} · Time` : `Nv ${mon.nivel} · ${caixa?.nome || "Caixa"}`;
    hp.textContent = `${mon.hp}/${mon.hpMax}`;
    const ultimo = selecao.lado === "party" && party.length <= 1;
    soltar.hidden = ultimo;
    soltar.disabled = ultimo;
    soltar.textContent = confirmar ? "Confirmar soltura" : "Soltar";
  }
  if (dica) dica.textContent = mensagem || DICA;
}

function noClique(ev) {
  const alvo = ev.target.closest("[data-pc]");
  if (!alvo) return;
  const tipo = alvo.dataset.pc;
  if (tipo === "fechar") {
    fecharTopo();
    return;
  }
  if (tipo === "aba") {
    caixaVista = alvo.dataset.caixa | 0;
    estado.caixaAtiva = caixaVista;
    redesenhar();
    return;
  }
  if (tipo === "slot") {
    const lado = alvo.dataset.lado;
    const i = alvo.dataset.i | 0;
    const mon = lado === "party" ? monDeAtor(listaParty()[i]) : monDeSnap(estado.caixas[caixaVista]?.slots[i]);
    selecao = mon ? { lado, i, caixa: caixaVista } : null;
    confirmar = false;
    redesenhar();
    return;
  }
  if (tipo === "soltar") {
    if (!selecao) return;
    if (!confirmar) {
      confirmar = true;
      redesenhar();
      return;
    }
    const msg = selecao.lado === "party" ? soltarDoTime(selecao.i) : soltarDoSlot(selecao.caixa, selecao.i);
    mensagem = msg;
    if (!msg) selecao = null;
    confirmar = false;
    redesenhar();
  }
}

function redesenhar() {
  pintar();
  assinatura = lerAssinatura();
}

function noArraste(ev) {
  const btn = ev.target.closest("[data-pc='slot']");
  if (!btn || btn.classList.contains("is-empty")) {
    ev.preventDefault();
    return;
  }
  arrastando = {
    lado: btn.dataset.lado,
    i: btn.dataset.i | 0,
    caixa: btn.dataset.caixa | 0,
  };
  btn.classList.add("is-dragging-source");
  ev.dataTransfer.effectAllowed = "move";
  ev.dataTransfer.setData(MIME, JSON.stringify(arrastando));
  ev.dataTransfer.setData("text/plain", `${arrastando.lado}:${arrastando.i}`);
}

function noSobre(ev) {
  const destino = ev.target.closest("[data-pc='slot'], [data-pc='aba']");
  if (!destino || !arrastando) return;
  ev.preventDefault();
  const ok = destino.dataset.pc === "aba" ? podeAba(arrastando, destino.dataset.caixa | 0) : podeSlot(arrastando, destino);
  if (alvoEl && alvoEl !== destino) alvoEl.classList.remove("is-drop-target", "is-drop-invalid");
  alvoEl = destino;
  destino.classList.toggle("is-drop-target", ok);
  destino.classList.toggle("is-drop-invalid", !ok);
  ev.dataTransfer.dropEffect = ok ? "move" : "none";
}

function noSoltar(ev) {
  const destino = ev.target.closest("[data-pc='slot'], [data-pc='aba']");
  const origem = arrastando;
  limparArraste();
  if (!destino || !origem) return;
  ev.preventDefault();
  let msg = "";
  if (destino.dataset.pc === "aba") {
    const caixaId = destino.dataset.caixa | 0;
    if (podeAba(origem, caixaId)) msg = soltarNaAba(origem, caixaId);
    else if (origem.lado === "party" && listaParty().length <= 1) msg = "O time precisa de pelo menos um Pokémon.";
    else if (!(origem.lado === "caixa" && origem.caixa === caixaId)) msg = "Caixa cheia.";
  } else if (podeSlot(origem, destino)) msg = soltarNoSlot(origem, destino);
  else if (!mesmoLugar(origem, destino)) msg = "Não deu para mover.";
  mensagem = msg || "";
  if (!msg) selecao = null;
  confirmar = false;
  redesenhar();
}

function mesmoLugar(origem, destino) {
  if (destino.dataset.pc !== "slot") return false;
  const lado = destino.dataset.lado;
  const i = destino.dataset.i | 0;
  const caixa = destino.dataset.caixa | 0;
  return origem.lado === lado && origem.i === i && (lado === "party" || origem.caixa === caixa);
}

function soltarNaAba(origem, caixaId) {
  const livre = estado.caixas[caixaId].slots.findIndex((s) => !s);
  if (livre < 0) return "Caixa cheia.";
  if (origem.lado === "party") return depositarNoSlot(origem.i, caixaId, livre);
  return moverEntreCaixas(origem.caixa, origem.i, caixaId, livre);
}

function soltarNoSlot(origem, destino) {
  const lado = destino.dataset.lado;
  const i = destino.dataset.i | 0;
  const caixa = destino.dataset.caixa | 0;
  if (origem.lado === "party" && lado === "party") return reordenarTime(origem.i, i);
  if (origem.lado === "party" && lado === "caixa") {
    return destino.classList.contains("is-empty")
      ? depositarNoSlot(origem.i, caixa, i)
      : trocarPartyComCaixa(origem.i, caixa, i);
  }
  if (origem.lado === "caixa" && lado === "party") {
    if (i >= listaParty().length) return retirarDoSlot(origem.caixa, origem.i);
    return trocarPartyComCaixa(i, origem.caixa, origem.i);
  }
  return moverEntreCaixas(origem.caixa, origem.i, caixa, i);
}

function podeAba(origem, caixaId) {
  if (origem.lado === "caixa" && origem.caixa === caixaId) return false;
  if (origem.lado === "party" && listaParty().length <= 1) return false;
  const caixa = estado.caixas[caixaId];
  return !!caixa && caixa.slots.some((s) => !s);
}

function podeSlot(origem, destino) {
  const lado = destino.dataset.lado;
  const i = destino.dataset.i | 0;
  const caixa = destino.dataset.caixa | 0;
  if (origem.lado === lado && origem.i === i && (lado === "party" || origem.caixa === caixa)) return false;
  if (origem.lado === "party" && lado === "party") return i < listaParty().length;
  if (origem.lado === "party" && lado === "caixa") {
    if (listaParty().length <= 1 && destino.classList.contains("is-empty")) return false;
    return true;
  }
  if (origem.lado === "caixa" && lado === "party") {
    if (i < listaParty().length) return true;
    return listaParty().length < POKEMON.PARTY_MAX;
  }
  return origem.lado === "caixa" && lado === "caixa";
}

function limparArraste() {
  arrastando = null;
  if (alvoEl) alvoEl.classList.remove("is-drop-target", "is-drop-invalid");
  alvoEl = null;
  raiz?.querySelectorAll(".is-dragging-source").forEach((el) => el.classList.remove("is-dragging-source"));
}

function ocupados(caixa) {
  if (!caixa) return 0;
  let n = 0;
  for (let i = 0; i < caixa.slots.length; i++) if (caixa.slots[i]) n += 1;
  return n;
}

function monSelecionado(party, caixa) {
  if (!selecao) return null;
  if (selecao.lado === "party") return monDeAtor(party[selecao.i]);
  if (selecao.caixa !== caixaVista) {
    const outra = estado.caixas[selecao.caixa];
    return monDeSnap(outra?.slots[selecao.i]);
  }
  return monDeSnap(caixa?.slots[selecao.i]);
}

function monDeAtor(ator) {
  if (!ator) return null;
  return {
    nome: ator.especie?.nome || ator.especie?.key || "Pokémon",
    nivel: ator.nivel | 0,
    hp: Math.max(0, Math.round(ator.hp)),
    hpMax: ator.hpMax | 0,
    shiny: !!ator.shiny,
    dex: ator.especie?.dex | 0,
  };
}

function monDeSnap(snap) {
  if (!snap) return null;
  const esp = especie(snap.especieKey);
  return {
    nome: esp?.nome || snap.especieKey || "Pokémon",
    nivel: snap.nivel | 0,
    hp: Math.max(0, Math.round(snap.hp ?? 0)),
    hpMax: snap.hpMax ?? snap.hp ?? 0,
    shiny: !!snap.shiny,
    dex: esp?.dex | 0,
  };
}

function urlRetrato(mon) {
  if (!mon?.dex) return "";
  return mon.shiny
    ? `/ref/sprites/pokemon-portraits/shiny/${mon.dex}.png`
    : `/ref/sprites/pokemon-portraits/${mon.dex}.png`;
}

function lerAssinatura() {
  const party = listaParty();
  let s = `${caixaVista}|${selecao?.lado || ""}|${selecao?.i ?? ""}|${selecao?.caixa ?? ""}|${confirmar ? 1 : 0}|${mensagem}|${party.length}`;
  for (let i = 0; i < party.length; i++) {
    const a = party[i];
    s += `;${a.especie?.key}:${a.nivel}:${Math.round(a.hp)}:${a.shiny ? 1 : 0}`;
  }
  for (let c = 0; c < estado.caixas.length; c++) {
    const slots = estado.caixas[c].slots;
    for (let i = 0; i < slots.length; i++) {
      const snap = slots[i];
      s += snap ? `|${snap.especieKey}:${snap.nivel}:${Math.round(snap.hp)}` : "|.";
    }
  }
  return s;
}
