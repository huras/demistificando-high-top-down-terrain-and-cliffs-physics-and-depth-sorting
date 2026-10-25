/** Estado único que a interface lê. A party e a bolsa moram em pokemon/party.js. */

import {
  BOLAS,
  BERRIES,
  BLOCOS,
  CHAVES,
  CRISTAIS,
  FERRAMENTAS,
  MOVEIS,
  PREMIER_A_CADA,
  RECEITAS_BOLA,
  REMEDIOS,
  SLOTS_HOTBAR,
  TIPO_ITEM,
  defItem,
  precoCompra,
  precoVenda,
} from "../wild/catalogo.js";
import { POKEMON } from "../config.js";
import { ESTAGIO } from "../wild/estagios.js";
import { hidratarPlot, serializarPlot } from "../wild/plots.js";
import { criarAtor } from "../pokemon/ator.js";
import { especie } from "../pokemon/dados.js";
import { restaurarPp } from "../pokemon/pp.js";
import { obterTreinador } from "../pokemon/sistema.js";
import { hidratarCampo, idsRemovidos, reaplicarCarregados, serializarCampo } from "../campo/estadoProps.js";
import { anunciarGanho, semearVistosDaBolsa } from "./ganhoItem.js";
import { nomeDoItem } from "./nomeItem.js";
import {
  ajustarItem,
  colocarNaParty,
  contarItem,
  curarParty,
  definirBolas,
  ganharBolas,
  itensBolsa,
  listaParty,
  obterBolas,
  substituirParty,
  tirarDaParty,
  trocarMembro,
  trocarOrdemParty,
} from "../pokemon/party.js";
import {
  hidratarSantuarios,
  resetEstadoSantuario,
  serializarSantuarios,
} from "../santuario/estadoSantuario.js";
import {
  hidratarDescobertaMapa,
  resetDescobertaMapa,
  serializarDescobertaMapa,
} from "../mapa/descoberta.js";

const CHAVE_SAVE = "demo-jogo-v1";
const CAIXAS = 8;
const SLOTS_CAIXA = 30;

/** Id do slot de save atual (localStorage + namespace IndexedDB). */
export function idSaveAtual() {
  return CHAVE_SAVE;
}

function caixasVazias() {
  const lista = [];
  for (let i = 0; i < CAIXAS; i++) {
    lista.push({ id: i, nome: `Caixa ${i + 1}`, slots: new Array(SLOTS_CAIXA).fill(null) });
  }
  return lista;
}

function questsIniciais() {
  return [
    { id: "berry", titulo: "Primeira colheita", texto: "Colha uma berry no campo.", feita: false, progresso: 0, meta: 1 },
    { id: "centro", titulo: "Centro Pokémon", texto: "Peça para a enfermeira curar o time.", feita: false, progresso: 0, meta: 1 },
    { id: "loja", titulo: "Poké Mart", texto: "Compre qualquer item no balcão.", feita: false, progresso: 0, meta: 1 },
    {
      id: "santuarioDevice",
      titulo: "Santuários elementais",
      texto: "Fale com a Rina no laboratório sobre os santuários.",
      feita: false,
      progresso: 0,
      meta: 1,
    },
  ];
}

export const estado = {
  dinheiro: 3000,
  hotbar: new Array(SLOTS_HOTBAR).fill(null),
  slotAtivo: -1,
  caixas: caixasVazias(),
  caixaAtiva: 0,
  plots: [],
  moveis: {},
  cortados: [],
  vistos: [],
  quests: questsIniciais(),
  chaves: ["pokedex"],
  dialogo: null,
  prompt: "",
  promptEntrar: false,
  promptRotulo: "Entrar",
  promptAncora: null,
  painel: null,
  menuAberto: false,
  dexAberta: false,
  statusAberto: false,
  capturadosMap: null,
  vistosMap: null,
  categoria: "balls",
  roda: false,
  itemGet: "",
  ganhoAberto: false,
  morteAberta: false,
  vistosItens: {},
  interior: null,
  construir: false,
  craft: false,
  saidaGrace: 0,
};

let ouvintes = [];

export function aoMudar(fn) {
  ouvintes.push(fn);
  return () => {
    ouvintes = ouvintes.filter((f) => f !== fn);
  };
}

export function avisar() {
  for (let i = 0; i < ouvintes.length; i++) ouvintes[i]();
}

export function temChave(key) {
  return estado.chaves.includes(key);
}

export function darChave(key) {
  if (!temChave(key)) estado.chaves.push(key);
}

export function contar(tipo, key) {
  if (tipo === TIPO_ITEM.CHAVE) return temChave(key) ? 1 : 0;
  if (tipo === TIPO_ITEM.FERRAMENTA) return contarItem(key);
  return contarItem(key);
}

export function darItem(tipo, key, n = 1) {
  const qtd = n | 0;
  if (qtd === 0) return;
  if (tipo === TIPO_ITEM.CHAVE) {
    if (qtd > 0) {
      darChave(key);
      anunciarGanho(key, 1);
    }
  } else {
    ajustarItem(key, qtd);
  }
  avisar();
}

export function gastar(tipo, key, n = 1) {
  if (contar(tipo, key) < n) return false;
  if (tipo === TIPO_ITEM.CHAVE) return false;
  ajustarItem(key, -n, "mudo");
  return true;
}

export function aplicarEfeito(ator, efeito) {
  if (!ator || !efeito) return false;
  if (efeito.reviver) {
    if (!ator.morto && ator.hp > 0) return false;
    ator.morto = false;
    ator.mortoAte = 0;
    ator.desmaioEm = 0;
    ator.hp = Math.max(1, Math.round(ator.hpMax * efeito.reviver));
    return true;
  }
  if (ator.morto || ator.hp <= 0) return false;
  if (efeito.curaHp) ator.hp = Math.min(ator.hpMax, ator.hp + efeito.curaHp);
  if (efeito.curaFrac) ator.hp = Math.min(ator.hpMax, ator.hp + Math.round(ator.hpMax * efeito.curaFrac));
  if (efeito.pp) restaurarPp(ator, efeito.pp);
  return true;
}

export function usarNoPokemon(tipo, key, ator) {
  const def = defItem(tipo, key);
  if (!def?.efeito || !ator) return false;
  if (!gastar(tipo, key, 1)) return false;
  const ok = aplicarEfeito(ator, def.efeito);
  if (!ok) {
    darItem(tipo, key, 1);
    estado.itemGet = "";
    return false;
  }
  avisar();
  return true;
}

export function usarNoJogador(tipo, key) {
  const def = defItem(tipo, key);
  const treino = obterTreinador();
  if (!def?.efeito || !treino) return false;
  if (!def.efeito.curaHp && !def.efeito.curaFrac) return false;
  if (treino.hp >= treino.hpMax) return false;
  if (!gastar(tipo, key, 1)) return false;
  if (def.efeito.curaHp) treino.hp = Math.min(treino.hpMax, treino.hp + def.efeito.curaHp);
  if (def.efeito.curaFrac) {
    treino.hp = Math.min(treino.hpMax, treino.hp + Math.round(treino.hpMax * def.efeito.curaFrac));
  }
  avisar();
  return true;
}

export function comprar(tipo, key, qtd) {
  const n = Math.max(1, qtd | 0);
  const preco = precoCompra(tipo, key);
  if (!(preco >= 0) || (preco === 0 && key !== "masterball")) return "Esse item não está à venda.";
  if (tipo === TIPO_ITEM.CHAVE && temChave(key)) return "Você já tem esse item.";
  const total = preco * n;
  if (estado.dinheiro < total) return "Dinheiro insuficiente.";
  estado.dinheiro -= total;
  darItem(tipo, key, n);
  if (tipo === TIPO_ITEM.BOLA && key === "pokeball") {
    const brinde = Math.floor(n / PREMIER_A_CADA);
    if (brinde > 0) {
      darItem(TIPO_ITEM.BOLA, "premierball", brinde);
      estado.itemGet = `Pokébola ×${n} + Premier ×${brinde}`;
    }
  }
  marcarQuest("loja");
  avisar();
  return "";
}

export function vender(tipo, key, qtd) {
  const n = Math.max(1, qtd | 0);
  const preco = precoVenda(tipo, key);
  if (preco <= 0) return "A loja não compra isso.";
  if (!gastar(tipo, key, n)) return "Quantidade insuficiente.";
  estado.dinheiro += preco * n;
  avisar();
  return "";
}

function cristaisDisponiveis() {
  let n = 0;
  for (let i = 0; i < CRISTAIS.length; i++) n += contarItem(CRISTAIS[i]);
  return n;
}

function gastarCristal(n) {
  let falta = n;
  for (let i = 0; i < CRISTAIS.length && falta > 0; i++) {
    const tem = contarItem(CRISTAIS[i]);
    const usa = Math.min(tem, falta);
    if (usa > 0) ajustarItem(CRISTAIS[i], -usa);
    falta -= usa;
  }
  return falta === 0;
}

export function podePagarCusto(custo) {
  const chaves = Object.keys(custo || {});
  for (let i = 0; i < chaves.length; i++) {
    const k = chaves[i];
    if (k === "anyCrystal") {
      if (cristaisDisponiveis() < custo[k]) return false;
    } else if (contarItem(k) < custo[k]) return false;
  }
  return true;
}

export function pagarCusto(custo) {
  if (!podePagarCusto(custo)) return false;
  const chaves = Object.keys(custo);
  for (let i = 0; i < chaves.length; i++) {
    const k = chaves[i];
    if (k === "anyCrystal") gastarCristal(custo[k]);
    else ajustarItem(k, -custo[k]);
  }
  return true;
}

export function craftarBola(key) {
  const receita = RECEITAS_BOLA[key];
  if (!receita) return "Receita desconhecida.";
  if (!pagarCusto(receita.custo)) return "Faltam cristais.";
  darItem(TIPO_ITEM.BOLA, key, 1);
  return "";
}

export function colocarMovel(casaId, key, x, y) {
  const def = MOVEIS[key];
  if (!def) return "Móvel desconhecido.";
  if (!pagarCusto(def.custo)) return "Materiais insuficientes.";
  if (!estado.moveis[casaId]) estado.moveis[casaId] = [];
  estado.moveis[casaId].push({ key, x, y });
  avisar();
  return "";
}

export function vagasNasCaixas() {
  let n = 0;
  for (let c = 0; c < estado.caixas.length; c++) {
    const slots = estado.caixas[c].slots;
    for (let i = 0; i < slots.length; i++) if (!slots[i]) n += 1;
  }
  return n;
}

export function guardarNaCaixa(snap, silencioso = false) {
  if (!snap) return false;
  for (let c = 0; c < estado.caixas.length; c++) {
    const slots = estado.caixas[c].slots;
    const livre = slots.findIndex((s) => !s);
    if (livre < 0) continue;
    slots[livre] = snap;
    if (!silencioso) avisar();
    return true;
  }
  return false;
}

/** Captura curada na primeira vaga das caixas. Não avisa: quem chama decide o texto. */
export function guardarCapturaNaCaixa(selvagem) {
  if (!selvagem?.especie) return false;
  const ator = criarAtor({
    id: `pc-${selvagem.especie.key}`,
    especie: selvagem.especie,
    nivel: Math.max(1, selvagem.nivel | 0),
    shiny: !!selvagem.shiny,
    faccao: "party",
    x: 0,
    y: 0,
    z: 1,
    hostil: false,
  });
  ator.exp = selvagem.exp ?? ator.exp;
  ator.hp = ator.hpMax;
  return guardarNaCaixa(snapshot(ator), true);
}

function caixaDe(id) {
  const n = id | 0;
  if (n < 0 || n >= estado.caixas.length) return null;
  return estado.caixas[n];
}

export function depositarNoSlot(indiceParty, caixaId, slot) {
  const caixa = caixaDe(caixaId);
  if (!caixa) return "Caixa inválida.";
  const i = slot | 0;
  if (i < 0 || i >= caixa.slots.length) return "Slot inválido.";
  if (caixa.slots[i]) return "Slot ocupado.";
  const tirado = tirarDaParty(indiceParty);
  if (!tirado) return "O time precisa de pelo menos um Pokémon.";
  caixa.slots[i] = snapshot(tirado);
  estado.caixaAtiva = caixaId | 0;
  avisar();
  return "";
}

export function retirarDoSlot(caixaId, slot) {
  const caixa = caixaDe(caixaId);
  if (!caixa) return "Caixa inválida.";
  const i = slot | 0;
  if (i < 0 || i >= caixa.slots.length) return "Slot inválido.";
  const snap = caixa.slots[i];
  if (!snap) return "Slot vazio.";
  const ator = atorDoSnapshot(snap);
  if (!ator) return "Espécie desconhecida.";
  if (!colocarNaParty(ator)) return "O time está cheio.";
  caixa.slots[i] = null;
  estado.caixaAtiva = caixaId | 0;
  avisar();
  return "";
}

export function trocarPartyComCaixa(indiceParty, caixaId, slot) {
  const caixa = caixaDe(caixaId);
  if (!caixa) return "Caixa inválida.";
  const i = slot | 0;
  if (i < 0 || i >= caixa.slots.length) return "Slot inválido.";
  if (!caixa.slots[i]) return depositarNoSlot(indiceParty, caixaId, i);
  const atual = listaParty()[indiceParty];
  if (!atual) return "Slot vazio.";
  const novo = atorDoSnapshot(caixa.slots[i]);
  if (!novo) return "Espécie desconhecida.";
  const antigo = trocarMembro(indiceParty, novo);
  if (!antigo) return "Não deu para trocar.";
  caixa.slots[i] = snapshot(antigo);
  estado.caixaAtiva = caixaId | 0;
  avisar();
  return "";
}

export function moverEntreCaixas(deCaixa, deSlot, paraCaixa, paraSlot) {
  const origem = caixaDe(deCaixa);
  const destino = caixaDe(paraCaixa);
  if (!origem || !destino) return "Caixa inválida.";
  const a = deSlot | 0;
  const b = paraSlot | 0;
  if (a < 0 || b < 0 || a >= origem.slots.length || b >= destino.slots.length) return "Slot inválido.";
  if ((deCaixa | 0) === (paraCaixa | 0) && a === b) return "";
  const snap = origem.slots[a];
  if (!snap) return "Slot vazio.";
  const outro = destino.slots[b];
  origem.slots[a] = outro || null;
  destino.slots[b] = snap;
  estado.caixaAtiva = paraCaixa | 0;
  avisar();
  return "";
}

export function soltarDoSlot(caixaId, slot) {
  const caixa = caixaDe(caixaId);
  if (!caixa) return "Caixa inválida.";
  const i = slot | 0;
  if (i < 0 || i >= caixa.slots.length || !caixa.slots[i]) return "Slot vazio.";
  caixa.slots[i] = null;
  estado.caixaAtiva = caixaId | 0;
  avisar();
  return "";
}

export function soltarDoTime(indice) {
  if (listaParty().length <= 1) return "O time precisa de pelo menos um Pokémon.";
  if (!tirarDaParty(indice)) return "Não deu para soltar.";
  avisar();
  return "";
}

export function reordenarTime(a, b) {
  if (!trocarOrdemParty(a, b)) return "Não deu para trocar.";
  avisar();
  return "";
}

export function guardarVariosNaCaixa(snaps) {
  if (!snaps?.length) return true;
  if (vagasNasCaixas() < snaps.length) return false;
  for (let i = 0; i < snaps.length; i++) {
    if (!guardarNaCaixa(snaps[i], true)) return false;
  }
  avisar();
  return true;
}

export function moverDaPartyParaCaixa(indiceParty) {
  const ator = listaParty()[indiceParty];
  if (!ator) return "Slot vazio.";
  const caixa = estado.caixas[estado.caixaAtiva];
  const livre = caixa.slots.findIndex((s) => !s);
  if (livre < 0) return "Caixa cheia.";
  const tirado = tirarDaParty(indiceParty);
  if (!tirado) return "O time precisa de pelo menos um Pokémon.";
  caixa.slots[livre] = snapshot(tirado);
  avisar();
  return "";
}

export function moverDaCaixaParaParty(slot) {
  const caixa = estado.caixas[estado.caixaAtiva];
  const snap = caixa.slots[slot];
  if (!snap) return "Slot vazio.";
  const ator = atorDoSnapshot(snap);
  if (!ator) return "Espécie desconhecida.";
  if (!colocarNaParty(ator)) return "O time está cheio.";
  caixa.slots[slot] = null;
  avisar();
  return "";
}

export function soltarDaCaixa(slot) {
  const caixa = estado.caixas[estado.caixaAtiva];
  if (!caixa.slots[slot]) return "Slot vazio.";
  caixa.slots[slot] = null;
  avisar();
  return "";
}

export function snapshot(ator) {
  return {
    especieKey: ator.especie?.key,
    nivel: ator.nivel,
    hp: ator.hp,
    hpMax: ator.hpMax,
    exp: ator.exp,
    shiny: !!ator.shiny,
  };
}

export function atorDoSnapshot(snap) {
  const esp = especie(snap?.especieKey);
  if (!esp) return null;
  const ator = criarAtor({
    especie: esp,
    nivel: snap.nivel || 1,
    shiny: !!snap.shiny,
    hp: snap.hp,
    faccao: "party",
    x: 0,
    y: 0,
    z: 1,
    hostil: false,
  });
  ator.exp = snap.exp ?? ator.exp;
  if (snap.hp != null) ator.hp = Math.min(ator.hpMax, snap.hp);
  return ator;
}

export function marcarQuest(id) {
  const q = estado.quests.find((item) => item.id === id);
  if (!q || q.feita) return;
  q.progresso = q.meta;
  q.feita = true;
  estado.itemGet = `Missão: ${q.titulo}`;
}

export function registrarEspecie(key) {
  if (!key || estado.vistos.includes(key)) return;
  estado.vistos.push(key);
}

export function registrarParty() {
  const party = listaParty();
  for (let i = 0; i < party.length; i++) registrarEspecie(party[i].especie?.key);
}

export function plotEm(x, y) {
  const ix = x | 0;
  const iy = y | 0;
  for (let i = 0; i < estado.plots.length; i++) {
    const p = estado.plots[i];
    if (p.x === ix && p.y === iy) return p;
  }
  return null;
}

export function hotbarAtivo() {
  const item = estado.hotbar[estado.slotAtivo];
  return item || null;
}

/** Toque no número ou no slot: liga se estava desligado, desliga se já era esse. */
export function alternarSlot(indice) {
  if (indice < 0 || indice >= estado.hotbar.length) return;
  const antes = estado.slotAtivo;
  const item = estado.hotbar[indice];
  const tem = !!(item && contar(item.tipo, item.key) > 0);
  if (!tem) {
    if (estado.slotAtivo === indice) estado.slotAtivo = -1;
  } else if (estado.slotAtivo === indice) estado.slotAtivo = -1;
  else estado.slotAtivo = indice;
  if (estado.slotAtivo !== antes) avisar();
}

/** Item zerado não fica armado. */
export function soltarSlotVazio() {
  const item = hotbarAtivo();
  if (item && contar(item.tipo, item.key) > 0) return;
  if (estado.slotAtivo < 0) return;
  estado.slotAtivo = -1;
  avisar();
}

export function atribuirSlot(indice, tipo, key) {
  if (indice < 0 || indice >= SLOTS_HOTBAR) return;
  if (!tipo || !key) {
    estado.hotbar[indice] = null;
    if (estado.slotAtivo === indice) estado.slotAtivo = -1;
  } else {
    estado.hotbar[indice] = { tipo, key };
  }
  avisar();
}

export function cicloSlot(indice) {
  const opcoes = opcoesHotbar();
  const atual = estado.hotbar[indice];
  let i = 0;
  if (atual) {
    const achou = opcoes.findIndex((o) => o.tipo === atual.tipo && o.key === atual.key);
    i = achou < 0 ? 0 : (achou + 1) % (opcoes.length + 1);
  }
  if (i >= opcoes.length) atribuirSlot(indice, null, null);
  else atribuirSlot(indice, opcoes[i].tipo, opcoes[i].key);
}

function opcoesHotbar() {
  const lista = [];
  const ferr = Object.keys(FERRAMENTAS);
  for (let i = 0; i < ferr.length; i++) {
    if (contarItem(ferr[i]) > 0) lista.push({ tipo: TIPO_ITEM.FERRAMENTA, key: ferr[i] });
  }
  const blocos = Object.keys(BLOCOS);
  for (let i = 0; i < blocos.length; i++) {
    if (contarItem(blocos[i]) > 0) lista.push({ tipo: TIPO_ITEM.BLOCO, key: blocos[i] });
  }
  const berries = Object.keys(BERRIES);
  for (let i = 0; i < berries.length; i++) {
    if (contarItem(berries[i]) > 0) lista.push({ tipo: TIPO_ITEM.BERRY, key: berries[i] });
  }
  const med = Object.keys(REMEDIOS);
  for (let i = 0; i < med.length; i++) {
    if (contarItem(med[i]) > 0) lista.push({ tipo: TIPO_ITEM.REMEDIO, key: med[i] });
  }
  for (const key of Object.keys(BOLAS)) {
    if (contarItem(key) > 0) lista.push({ tipo: TIPO_ITEM.BOLA, key });
  }
  return lista;
}

export function uiAberta() {
  const interior2d = estado.interior && !estado.interior.sala3d;
  return !!(
    estado.painel ||
    estado.menuAberto ||
    estado.dexAberta ||
    estado.statusAberto ||
    estado.dialogo ||
    estado.roda ||
    interior2d ||
    estado.construir ||
    estado.craft ||
    estado.ganhoAberto
  );
}

export function fecharTopo() {
  if (estado.dialogo) {
    estado.dialogo = null;
    avisar();
    return true;
  }
  if (estado.construir) {
    estado.construir = false;
    avisar();
    return true;
  }
  if (estado.craft) {
    estado.craft = false;
    avisar();
    return true;
  }
  if (estado.roda) {
    estado.roda = false;
    avisar();
    return true;
  }
  if (estado.dexAberta || estado.statusAberto || estado.menuAberto) {
    if (typeof estado._fecharHudExtra === "function") {
      estado._fecharHudExtra();
      avisar();
      return true;
    }
    estado.dexAberta = false;
    estado.statusAberto = false;
    estado.menuAberto = false;
    avisar();
    return true;
  }
  if (estado.painel) {
    estado.painel = null;
    avisar();
    return true;
  }
  return false;
}

export function abrirPainel(nome) {
  estado.roda = false;
  estado.construir = false;
  estado.craft = false;
  estado.painel = nome;
  avisar();
}

function bolsaParaLista() {
  const lista = [];
  for (const [key, qtd] of itensBolsa()) lista.push([key, qtd]);
  return lista;
}

export function salvar() {
  registrarParty();
  const party = listaParty().map(snapshot);
  const dados = {
    dinheiro: estado.dinheiro,
    bolas: obterBolas(),
    bolsa: bolsaParaLista(),
    hotbar: estado.hotbar,
    slotAtivo: estado.slotAtivo,
    caixas: estado.caixas,
    plots: estado.plots.map(serializarPlot),
    moveis: estado.moveis,
    campo: serializarCampo(),
    cortados: idsRemovidos(),
    vistos: estado.vistos,
    capturados: estado.capturadosMap ? { ...estado.capturadosMap } : {},
    vistosItens: estado.vistosItens || {},
    quests: estado.quests,
    chaves: estado.chaves,
    santuarios: serializarSantuarios(),
    descobertaMapa: serializarDescobertaMapa(),
    party,
  };
  try {
    localStorage.setItem(CHAVE_SAVE, JSON.stringify(dados));
    estado.itemGet = "Jogo salvo.";
    avisar();
    return true;
  } catch {
    return false;
  }
}

export function carregar() {
  let bruto = null;
  try {
    bruto = JSON.parse(localStorage.getItem(CHAVE_SAVE) || "null");
  } catch {
    bruto = null;
  }
  if (!bruto) {
    semearInicio();
    return false;
  }
  estado.dinheiro = bruto.dinheiro | 0;
  const mapa = itensBolsa();
  mapa.clear();
  const pares = bruto.bolsa || [];
  for (let i = 0; i < pares.length; i++) {
    const par = pares[i];
    if (par && par[1] > 0) mapa.set(par[0], par[1] | 0);
  }
  if (!mapa.has("pokeball") || (mapa.get("pokeball") | 0) <= 0) {
    definirBolas(Math.max(bruto.bolas | 0, POKEMON.BOLAS));
  }
  estado.hotbar = new Array(SLOTS_HOTBAR).fill(null);
  const hot = bruto.hotbar || [];
  for (let i = 0; i < SLOTS_HOTBAR; i++) estado.hotbar[i] = hot[i] || null;
  // Ferramentas novas (ex.: arco) entram na bolsa de saves antigos.
  const ferr = Object.keys(FERRAMENTAS);
  for (let i = 0; i < ferr.length; i++) {
    if (contarItem(ferr[i]) <= 0) ajustarItem(ferr[i], 1, "mudo");
  }
  if (!estado.hotbar[5] && contarItem("bow") > 0) {
    estado.hotbar[5] = { tipo: TIPO_ITEM.FERRAMENTA, key: "bow" };
  }
  {
    const s = Number(bruto.slotAtivo);
    estado.slotAtivo =
      Number.isInteger(s) && s >= -1 && s < SLOTS_HOTBAR ? s : -1;
  }
  soltarSlotVazio();
  estado.caixas = bruto.caixas?.length === CAIXAS ? bruto.caixas : caixasVazias();
  estado.plots = [];
  const plots = bruto.plots || [];
  for (let i = 0; i < plots.length; i++) {
    const plot = hidratarPlot(plots[i]);
    if (plot) estado.plots.push(plot);
  }
  estado.moveis = bruto.moveis || {};
  hidratarCampo(bruto.campo, bruto.cortados);
  estado.cortados = idsRemovidos();
  reaplicarCarregados();
  estado.vistos = bruto.vistos || [];
  estado.vistosMap = Object.create(null);
  for (const key of estado.vistos) estado.vistosMap[key] = true;
  estado.capturadosMap = Object.create(null);
  if (bruto.capturados && typeof bruto.capturados === "object") {
    for (const [k, v] of Object.entries(bruto.capturados)) {
      if (v) estado.capturadosMap[k] = v | 0 || 1;
    }
  }
  estado.quests = bruto.quests || questsIniciais();
  if (!estado.quests.some((q) => q.id === "santuarioDevice")) {
    estado.quests.push({
      id: "santuarioDevice",
      titulo: "Santuários elementais",
      texto: "Fale com a Rina no laboratório sobre os santuários.",
      feita: false,
      progresso: 0,
      meta: 1,
    });
  }
  estado.chaves = bruto.chaves || ["pokedex"];
  hidratarSantuarios(bruto.santuarios);
  hidratarDescobertaMapa(bruto.descobertaMapa);
  if (bruto.vistosItens && typeof bruto.vistosItens === "object" && !Array.isArray(bruto.vistosItens)) {
    estado.vistosItens = { ...bruto.vistosItens };
  } else {
    semearVistosDaBolsa();
  }
  const atores = [];
  const snaps = bruto.party || [];
  for (let i = 0; i < snaps.length; i++) {
    const ator = atorDoSnapshot(snaps[i]);
    if (ator) atores.push(ator);
  }
  if (atores.length) substituirParty(atores);
  registrarParty();
  avisar();
  return true;
}

function semearInicio() {
  resetEstadoSantuario();
  resetDescobertaMapa();
  estado.vistosItens = {};
  if (contarItem("oran") <= 0) ajustarItem("oran", 5, "mudo");
  if (contarItem("potion") <= 0) ajustarItem("potion", 2, "mudo");
  if (contarItem("pokeball") <= 0) definirBolas(POKEMON.BOLAS);
  const ferr = Object.keys(FERRAMENTAS);
  for (let i = 0; i < ferr.length; i++) {
    if (contarItem(ferr[i]) <= 0) ajustarItem(ferr[i], 1, "mudo");
  }
  estado.hotbar[0] = { tipo: TIPO_ITEM.FERRAMENTA, key: "hoe" };
  estado.hotbar[1] = { tipo: TIPO_ITEM.FERRAMENTA, key: "wateringCan" };
  estado.hotbar[2] = { tipo: TIPO_ITEM.BOLA, key: "pokeball" };
  estado.hotbar[3] = { tipo: TIPO_ITEM.REMEDIO, key: "potion" };
  estado.hotbar[4] = { tipo: TIPO_ITEM.FERRAMENTA, key: "pickaxe" };
  estado.hotbar[5] = { tipo: TIPO_ITEM.FERRAMENTA, key: "bow" };
  darChave("pokedex");
  anunciarGanho("pokedex", 1, "mudo");
  registrarParty();
}

export function nomeDe(tipo, key) {
  return nomeDoItem(key, tipo);
}

export { ESTAGIO, TIPO_ITEM, BOLAS, BERRIES, REMEDIOS, FERRAMENTAS, MOVEIS, RECEITAS_BOLA, CHAVES };
