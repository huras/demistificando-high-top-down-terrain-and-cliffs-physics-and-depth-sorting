/** Estado único que a interface lê. A party e a bolsa moram em pokemon/party.js. */

import {
  BOLAS,
  BERRIES,
  CHAVES,
  CRISTAIS,
  FERRAMENTAS,
  MOVEIS,
  PREMIER_A_CADA,
  RECEITAS_BOLA,
  REMEDIOS,
  SLOTS_HOTBAR,
  TIPO_ITEM,
  classificarChave,
  defItem,
  precoCompra,
  precoVenda,
} from "../wild/catalogo.js";
import { POKEMON } from "../config.js";
import { ESTAGIO } from "../wild/estagios.js";
import { hidratarPlot, serializarPlot } from "../wild/plots.js";
import { criarAtor } from "../pokemon/ator.js";
import { especie } from "../pokemon/dados.js";
import { obterTreinador } from "../pokemon/sistema.js";
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
} from "../pokemon/party.js";

const CHAVE_SAVE = "demo-jogo-v1";
const CAIXAS = 8;
const SLOTS_CAIXA = 30;

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
  painel: null,
  categoria: "balls",
  roda: false,
  itemGet: "",
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
  if (tipo === TIPO_ITEM.BOLA && key === "pokeball") return obterBolas();
  if (tipo === TIPO_ITEM.CHAVE) return temChave(key) ? 1 : 0;
  if (tipo === TIPO_ITEM.FERRAMENTA) return contarItem(key);
  return contarItem(key);
}

export function darItem(tipo, key, n = 1) {
  const qtd = n | 0;
  if (qtd === 0) return;
  if (tipo === TIPO_ITEM.BOLA && key === "pokeball") {
    ganharBolas(qtd);
  } else if (tipo === TIPO_ITEM.CHAVE) {
    if (qtd > 0) darChave(key);
  } else {
    ajustarItem(key, qtd);
  }
  const def = defItem(tipo, key);
  if (qtd > 0 && def) estado.itemGet = `${def.nome} ×${qtd}`;
  avisar();
}

export function gastar(tipo, key, n = 1) {
  if (contar(tipo, key) < n) return false;
  if (tipo === TIPO_ITEM.BOLA && key === "pokeball") {
    ganharBolas(-n);
    return true;
  }
  if (tipo === TIPO_ITEM.CHAVE) return false;
  ajustarItem(key, -n);
  return true;
}

export function aplicarEfeito(ator, efeito) {
  if (!ator || !efeito) return false;
  if (efeito.reviver) {
    if (!ator.morto && ator.hp > 0) return false;
    ator.morto = false;
    ator.mortoAte = 0;
    ator.hp = Math.max(1, Math.round(ator.hpMax * efeito.reviver));
    return true;
  }
  if (ator.morto || ator.hp <= 0) return false;
  if (efeito.curaHp) ator.hp = Math.min(ator.hpMax, ator.hp + efeito.curaHp);
  if (efeito.curaFrac) ator.hp = Math.min(ator.hpMax, ator.hp + Math.round(ator.hpMax * efeito.curaFrac));
  if (efeito.pp) ator.pp = Math.min(ator.ppMax, (ator.pp || 0) + efeito.pp);
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
  const total = preco * n;
  if (estado.dinheiro < total) return "Dinheiro insuficiente.";
  estado.dinheiro -= total;
  darItem(tipo, key, n);
  if (tipo === TIPO_ITEM.BOLA && key === "pokeball") {
    const brinde = Math.floor(n / PREMIER_A_CADA);
    if (brinde > 0) estado.itemGet = `Pokébola ×${n}`;
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
  if (key === "pokeball") ganharBolas(1);
  else ajustarItem(key, 1);
  estado.itemGet = `${receita.nome} ×1`;
  avisar();
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
  const berries = Object.keys(BERRIES);
  for (let i = 0; i < berries.length; i++) {
    if (contarItem(berries[i]) > 0) lista.push({ tipo: TIPO_ITEM.BERRY, key: berries[i] });
  }
  const med = Object.keys(REMEDIOS);
  for (let i = 0; i < med.length; i++) {
    if (contarItem(med[i]) > 0) lista.push({ tipo: TIPO_ITEM.REMEDIO, key: med[i] });
  }
  if (obterBolas() > 0) lista.push({ tipo: TIPO_ITEM.BOLA, key: "pokeball" });
  for (const key of Object.keys(BOLAS)) {
    if (key !== "pokeball" && contarItem(key) > 0) lista.push({ tipo: TIPO_ITEM.BOLA, key });
  }
  return lista;
}

export function uiAberta() {
  const interior2d = estado.interior && !estado.interior.sala3d;
  return !!(
    estado.painel ||
    estado.dialogo ||
    estado.roda ||
    interior2d ||
    estado.construir ||
    estado.craft
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
    cortados: estado.cortados,
    vistos: estado.vistos,
    quests: estado.quests,
    chaves: estado.chaves,
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
  definirBolas(Math.max(bruto.bolas | 0, POKEMON.BOLAS));
  const mapa = itensBolsa();
  mapa.clear();
  const pares = bruto.bolsa || [];
  for (let i = 0; i < pares.length; i++) {
    const par = pares[i];
    if (par && par[1] > 0) mapa.set(par[0], par[1] | 0);
  }
  estado.hotbar = new Array(SLOTS_HOTBAR).fill(null);
  const hot = bruto.hotbar || [];
  for (let i = 0; i < SLOTS_HOTBAR; i++) estado.hotbar[i] = hot[i] || null;
  estado.slotAtivo = bruto.slotAtivo | 0;
  estado.caixas = bruto.caixas?.length === CAIXAS ? bruto.caixas : caixasVazias();
  estado.plots = [];
  const plots = bruto.plots || [];
  for (let i = 0; i < plots.length; i++) {
    const plot = hidratarPlot(plots[i]);
    if (plot) estado.plots.push(plot);
  }
  estado.moveis = bruto.moveis || {};
  estado.cortados = bruto.cortados || [];
  estado.vistos = bruto.vistos || [];
  estado.quests = bruto.quests || questsIniciais();
  estado.chaves = bruto.chaves || ["pokedex"];
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
  if (contarItem("oran") <= 0) ajustarItem("oran", 5);
  if (contarItem("potion") <= 0) ajustarItem("potion", 2);
  const ferr = Object.keys(FERRAMENTAS);
  for (let i = 0; i < ferr.length; i++) {
    if (contarItem(ferr[i]) <= 0) ajustarItem(ferr[i], 1);
  }
  estado.hotbar[0] = { tipo: TIPO_ITEM.FERRAMENTA, key: "hoe" };
  estado.hotbar[1] = { tipo: TIPO_ITEM.FERRAMENTA, key: "wateringCan" };
  estado.hotbar[2] = { tipo: TIPO_ITEM.BERRY, key: "oran" };
  estado.hotbar[3] = { tipo: TIPO_ITEM.REMEDIO, key: "potion" };
  darChave("pokedex");
  registrarParty();
}

export function nomeDe(tipo, key) {
  return defItem(tipo, key)?.nome || defItem(classificarChave(key), key)?.nome || key;
}

export { ESTAGIO, TIPO_ITEM, BOLAS, BERRIES, REMEDIOS, FERRAMENTAS, MOVEIS, RECEITAS_BOLA, CHAVES };
