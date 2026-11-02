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
import { tocarCura } from "./som/combateSfx.js";
import { createQuestState, normalizeQuestState } from "../quests/tipos.js";
import {
  tocarBump,
  tocarHotbarEquip,
  tocarHotbarUnequip,
  tocarPcClose,
  tocarPcOpen,
  tocarSalvar,
} from "./som/mundoSfx.js";
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
import {
  hidratarConstrucao,
  moveisDasCasasJogador,
  resetConstrucao,
  serializarConstrucao,
} from "../construir/estadoConstrucao.js";
import { acharCasa, syncInteriorMoveis } from "../construir/estruturas.js";
import { dentroDoBolsoSala } from "../mundo/bounds.js";

/** v2: overworld 3× (AREA 384 / LADO 24576) — posições absolutas incompatíveis. */
const CHAVE_SAVE = "demo-jogo-v2";
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
  /** Quadro de missões diárias (resgate/entrega). */
  questState: createQuestState(),
  questBoardOpen: false,
  questBoardCityId: null,
  chaves: ["pokedex"],
  dialogo: null,
  prompt: "",
  promptEntrar: false,
  promptRotulo: "Entrar",
  /** Tecla destacada no chip: "e" (ação) ou "r" (falar/interagir). */
  promptTecla: "e",
  promptAncora: null,
  painel: null,
  menuAberto: false,
  skillAberto: false,
  dexAberta: false,
  capsulaAberta: false,
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
  /** Snapshot do interior no save — aplicado após o boot do mundo. */
  interiorSalvo: null,
  /** Posição dentro do bolso 3D (casa/hub/santuário). */
  posicaoInterior: null,
  construir: false,
  craft: false,
  saidaGrace: 0,
  /** Última posição no overworld (persistida no save). */
  posicao: null,
  /** Sessão de batalha treinador (overlay turnos). */
  batalhaTreinador: null,
};

/** Porta sul da pegada (centro da casa → fora da porta). */
function portaOutdoorDaCasa(house) {
  if (!house || !Number.isFinite(house.x) || !Number.isFinite(house.y)) return null;
  const rows = house.rows || 5;
  return {
    x: house.x,
    y: house.y + rows * 0.5 + 1.15,
    z: Number.isFinite(house.z) ? house.z : 0,
  };
}

/** Lê a 1ª casa do blob de save (obterSpawn roda antes de hidratar). */
function portaCasaDoSaveBruto(bruto) {
  const areas = bruto?.construcao?.playerStructures?.areas;
  if (!areas || typeof areas !== "object") return null;
  for (const b of Object.values(areas)) {
    const houses = b?.houses;
    if (!Array.isArray(houses)) continue;
    for (let i = 0; i < houses.length; i++) {
      const porta = portaOutdoorDaCasa(houses[i]);
      if (porta && !dentroDoBolsoSala(porta.x, porta.y)) return porta;
    }
  }
  return null;
}

/** Âncora outdoor enquanto está no bolso 3D (sala/lab/etc). */
function ancoraOutdoorInterior() {
  const interior = estado.interior;
  if (!interior?.sala3d) return null;
  if (Number.isFinite(interior.outdoorX) && Number.isFinite(interior.outdoorY)) {
    return {
      x: interior.outdoorX,
      y: interior.outdoorY,
      z: Number.isFinite(interior.outdoorZ) ? interior.outdoorZ : 0,
    };
  }
  const id = interior.playerHouseId || interior.predio?.playerHouseId;
  if (id) {
    const porta = portaOutdoorDaCasa(acharCasa(id));
    if (porta) return porta;
  }
  return null;
}

/** Atualiza a posição a gravar no save (chamar no tick / antes de salvar). */
export function registrarPosicao(corpo, cam = null) {
  if (!corpo || !Number.isFinite(corpo.x) || !Number.isFinite(corpo.y)) return;
  const anterior = estado.posicao;
  const yawCam = Number.isFinite(cam?.yaw)
    ? cam.yaw
    : Number.isFinite(anterior?.yawCam)
      ? anterior.yawCam
      : undefined;
  const pitchOrbita = Number.isFinite(cam?.pitchOrbita)
    ? cam.pitchOrbita
    : Number.isFinite(anterior?.pitchOrbita)
      ? anterior.pitchOrbita
      : undefined;
  const distancia = Number.isFinite(cam?.distancia)
    ? cam.distancia
    : Number.isFinite(anterior?.distancia)
      ? anterior.distancia
      : undefined;

  const facing = corpo.facing | 0;
  const dirX = Number.isFinite(corpo.dirX) ? corpo.dirX : 0;
  const dirY = Number.isFinite(corpo.dirY) ? corpo.dirY : 1;
  const zCorpo = Number.isFinite(corpo.elevacao)
    ? corpo.elevacao
    : Number.isFinite(corpo.z)
      ? corpo.z
      : 0;

  // Bolso 3D: guarda posição local; no overworld só a âncora outdoor.
  let x = corpo.x;
  let y = corpo.y;
  let z = zCorpo;
  if (dentroDoBolsoSala(x, y) || estado.interior?.sala3d) {
    estado.posicaoInterior = { x: corpo.x, y: corpo.y, z: zCorpo, facing, dirX, dirY };
    const ancora = ancoraOutdoorInterior();
    if (ancora) {
      x = ancora.x;
      y = ancora.y;
      z = ancora.z;
    } else if (anterior && !dentroDoBolsoSala(anterior.x, anterior.y)) {
      if (Number.isFinite(yawCam)) anterior.yawCam = yawCam;
      if (Number.isFinite(pitchOrbita)) anterior.pitchOrbita = pitchOrbita;
      if (Number.isFinite(distancia)) anterior.distancia = distancia;
      return;
    } else {
      return;
    }
  } else {
    estado.posicaoInterior = null;
  }

  estado.posicao = { x, y, z, facing, dirX, dirY };
  if (Number.isFinite(yawCam)) estado.posicao.yawCam = yawCam;
  if (Number.isFinite(pitchOrbita)) estado.posicao.pitchOrbita = pitchOrbita;
  if (Number.isFinite(distancia)) estado.posicao.distancia = distancia;
}

function serializarInterior() {
  const i = estado.interior;
  if (!i?.sala3d) return null;
  const out = {
    sala3d: true,
    papel: String(i.papel || ""),
    casaId: i.casaId || null,
    playerHouseId: i.playerHouseId || null,
    ax: Number.isFinite(i.ax) ? i.ax : null,
    ay: Number.isFinite(i.ay) ? i.ay : null,
    outdoorX: Number.isFinite(i.outdoorX) ? i.outdoorX : null,
    outdoorY: Number.isFinite(i.outdoorY) ? i.outdoorY : null,
    outdoorZ: Number.isFinite(i.outdoorZ) ? i.outdoorZ : null,
    shrineId: i.shrineId || null,
    element: i.element || null,
  };
  if (i.predio && typeof i.predio === "object") {
    out.predio = { ...i.predio };
  }
  return out.papel ? out : null;
}

function normalizarInteriorSalvo(bruto) {
  if (!bruto || typeof bruto !== "object" || !bruto.sala3d) return null;
  const papel = String(bruto.papel || "");
  if (!papel) return null;
  const out = {
    sala3d: true,
    papel,
    casaId: bruto.casaId || null,
    playerHouseId: bruto.playerHouseId || null,
    ax: Number.isFinite(bruto.ax) ? bruto.ax : null,
    ay: Number.isFinite(bruto.ay) ? bruto.ay : null,
    outdoorX: Number.isFinite(bruto.outdoorX) ? bruto.outdoorX : null,
    outdoorY: Number.isFinite(bruto.outdoorY) ? bruto.outdoorY : null,
    outdoorZ: Number.isFinite(bruto.outdoorZ) ? bruto.outdoorZ : null,
    shrineId: bruto.shrineId || null,
    element: bruto.element || null,
  };
  if (bruto.predio && typeof bruto.predio === "object") {
    out.predio = { ...bruto.predio };
  }
  return out;
}

function normalizarPosicaoInterior(p) {
  if (!p || typeof p !== "object") return null;
  const x = Number(p.x);
  const y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !dentroDoBolsoSala(x, y)) return null;
  const z = Number(p.z);
  return {
    x,
    y,
    z: Number.isFinite(z) ? z : 0,
    facing: Number.isFinite(p.facing) ? p.facing | 0 : 0,
    dirX: Number.isFinite(p.dirX) ? p.dirX : 0,
    dirY: Number.isFinite(p.dirY) ? p.dirY : 1,
  };
}

/** Atualiza só a câmera no blob de posição (após o frame 3D). */
export function registrarCamera(cam) {
  if (!estado.posicao || !cam) return;
  if (Number.isFinite(cam.yaw)) estado.posicao.yawCam = cam.yaw;
  if (Number.isFinite(cam.pitchOrbita)) estado.posicao.pitchOrbita = cam.pitchOrbita;
  if (Number.isFinite(cam.distancia)) estado.posicao.distancia = cam.distancia;
}

function normalizarPosicao(p, bruto = null) {
  if (!p || typeof p !== "object") return null;
  let x = Number(p.x);
  let y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let z = Number(p.z);
  if (!Number.isFinite(z)) z = 0;

  // Saves antigos gravavam o bolso 3D; remapeia pra porta outdoor / casa do jogador.
  if (dentroDoBolsoSala(x, y)) {
    const ox = Number(p.outdoorX);
    const oy = Number(p.outdoorY);
    if (Number.isFinite(ox) && Number.isFinite(oy) && !dentroDoBolsoSala(ox, oy)) {
      x = ox;
      y = oy;
      const oz = Number(p.outdoorZ);
      if (Number.isFinite(oz)) z = oz;
    } else {
      const porta = portaCasaDoSaveBruto(bruto);
      if (!porta) return null;
      x = porta.x;
      y = porta.y;
      z = porta.z;
    }
  }

  const out = {
    x,
    y,
    z,
    facing: Number.isFinite(p.facing) ? p.facing | 0 : 0,
    dirX: Number.isFinite(p.dirX) ? p.dirX : 0,
    dirY: Number.isFinite(p.dirY) ? p.dirY : 1,
  };
  const yawCam = Number(p.yawCam);
  const pitchOrbita = Number(p.pitchOrbita);
  const distancia = Number(p.distancia);
  if (Number.isFinite(yawCam)) out.yawCam = yawCam;
  if (Number.isFinite(pitchOrbita)) out.pitchOrbita = pitchOrbita;
  if (Number.isFinite(distancia)) out.distancia = distancia;
  return out;
}

/** Lê só a posição do save (antes do boot do mundo), sem hidratar o resto. */
export function obterSpawnSalvo() {
  let bruto = null;
  try {
    bruto = JSON.parse(localStorage.getItem(CHAVE_SAVE) || "null");
  } catch {
    bruto = null;
  }
  if (estado.posicao) {
    const atual = normalizarPosicao(estado.posicao, bruto);
    if (atual) return atual;
  }
  return normalizarPosicao(bruto?.posicao, bruto);
}

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
    tocarBump();
    return false;
  }
  if (def.efeito.curaHp || def.efeito.curaFrac || def.efeito.reviver) {
    tocarCura(ator);
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
  tocarCura(treino);
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
export function guardarCapturaNaCaixa(selvagem, ballKey = "pokeball") {
  if (!selvagem?.especie) return false;
  const ator = criarAtor({
    id: `pc-${selvagem.especie.key}`,
    especie: selvagem.especie,
    nivel: Math.max(1, selvagem.nivel | 0),
    shiny: !!selvagem.shiny,
    ballKey: typeof ballKey === "string" && ballKey ? ballKey : "pokeball",
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
    ballKey: typeof ator.ballKey === "string" && ator.ballKey ? ator.ballKey : "pokeball",
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
    ballKey: typeof snap.ballKey === "string" && snap.ballKey ? snap.ballKey : "pokeball",
    faccao: "party",
    x: 0,
    y: 0,
    z: 1,
    hostil: false,
  });
  ator.exp = snap.exp ?? ator.exp;
  if (snap.hp != null) ator.hp = Math.min(ator.hpMax, Math.max(0, snap.hp));
  if (ator.hp <= 0) {
    ator.hp = 0;
    ator.morto = true;
    ator.mortoAte = 0;
  }
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
    const tinha = !!estado.hotbar[indice];
    estado.hotbar[indice] = null;
    if (estado.slotAtivo === indice) estado.slotAtivo = -1;
    if (tinha) tocarHotbarUnequip();
  } else {
    estado.hotbar[indice] = { tipo, key };
    tocarHotbarEquip();
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
    estado.capsulaAberta ||
    estado.statusAberto ||
    estado.skillAberto ||
    estado.dialogo ||
    estado.roda ||
    estado.questBoardOpen ||
    interior2d ||
    estado.construir ||
    estado.craft ||
    estado.ganhoAberto
  );
}

export function fecharTopo() {
  if (estado.dialogo) {
    const dlg = estado.dialogo;
    if (dlg.npcRef && !estado.batalhaTreinador) dlg.npcRef.combatHold = false;
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
  if (
    estado.capsulaAberta ||
    estado.dexAberta ||
    estado.statusAberto ||
    estado.menuAberto ||
    estado.skillAberto
  ) {
    if (typeof estado._fecharHudExtra === "function") {
      estado._fecharHudExtra();
      avisar();
      return true;
    }
    estado.capsulaAberta = false;
    estado.dexAberta = false;
    estado.statusAberto = false;
    estado.menuAberto = false;
    estado.skillAberto = false;
    avisar();
    return true;
  }
  if (estado.painel) {
    if (estado.painel === "pc") tocarPcClose();
    estado.painel = null;
    avisar();
    return true;
  }
  return false;
}

export function abrirPainel(nome) {
  const anterior = estado.painel;
  estado.roda = false;
  estado.construir = false;
  estado.craft = false;
  estado.painel = nome;
  if (nome === "pc" && anterior !== "pc") tocarPcOpen();
  else if (anterior === "pc" && nome !== "pc") tocarPcClose();
  avisar();
}

function bolsaParaLista() {
  const lista = [];
  for (const [key, qtd] of itensBolsa()) lista.push([key, qtd]);
  return lista;
}

export function salvar() {
  registrarParty();
  if (estado.interior?.papel === "casa" && estado.interior.playerHouseId) {
    syncInteriorMoveis(
      estado.interior.playerHouseId,
      estado.moveis[estado.interior.casaId] || []
    );
  }
  const party = listaParty().map(snapshot);
  const construcao = serializarConstrucao();
  const posicao = normalizarPosicao(estado.posicao, { construcao });
  const interior = serializarInterior();
  const posicaoInterior = interior ? normalizarPosicaoInterior(estado.posicaoInterior) : null;
  const dados = {
    dinheiro: estado.dinheiro,
    bolas: obterBolas(),
    bolsa: bolsaParaLista(),
    hotbar: estado.hotbar,
    caixas: estado.caixas,
    plots: estado.plots.map(serializarPlot),
    moveis: estado.moveis,
    campo: serializarCampo(),
    cortados: idsRemovidos(),
    vistos: estado.vistos,
    capturados: estado.capturadosMap ? { ...estado.capturadosMap } : {},
    vistosItens: estado.vistosItens || {},
    posicao,
    interior,
    posicaoInterior,
    quests: estado.quests,
    questState: (() => {
      const qs = estado.questState || createQuestState();
      return {
        boardDay: qs.boardDay,
        ultimaHora: qs.ultimaHora,
        boardForceSalt: qs.boardForceSalt | 0,
        boards: qs.boards,
        taken: qs.taken,
        completed: qs.completed,
      };
    })(),
    chaves: estado.chaves,
    santuarios: serializarSantuarios(),
    descobertaMapa: serializarDescobertaMapa(),
    construcao,
    party,
  };
  try {
    localStorage.setItem(CHAVE_SAVE, JSON.stringify(dados));
    estado.itemGet = "Jogo salvo.";
    tocarSalvar();
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
  // Slot ativo é sessão — não restaura do save.
  estado.slotAtivo = -1;
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
  estado.questState = normalizeQuestState(bruto.questState);
  estado.chaves = bruto.chaves || ["pokedex"];
  hidratarSantuarios(bruto.santuarios);
  hidratarDescobertaMapa(bruto.descobertaMapa);
  hidratarConstrucao(bruto.construcao);
  const moveisPlayer = moveisDasCasasJogador();
  for (const [casaId, lista] of Object.entries(moveisPlayer)) {
    if (!estado.moveis[casaId]?.length) estado.moveis[casaId] = lista;
  }
  estado.posicao = normalizarPosicao(bruto.posicao, bruto);
  estado.interior = null;
  estado.interiorSalvo = normalizarInteriorSalvo(bruto.interior);
  estado.posicaoInterior = estado.interiorSalvo
    ? normalizarPosicaoInterior(bruto.posicaoInterior)
    : null;
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
  resetConstrucao();
  estado.interior = null;
  estado.interiorSalvo = null;
  estado.posicaoInterior = null;
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
  estado.hotbar[3] = { tipo: TIPO_ITEM.FERRAMENTA, key: "hammer" };
  estado.hotbar[4] = { tipo: TIPO_ITEM.FERRAMENTA, key: "flag" };
  estado.hotbar[5] = { tipo: TIPO_ITEM.FERRAMENTA, key: "bow" };
  if (contarItem("pickaxe") <= 0) ajustarItem("pickaxe", 1, "mudo");
  if (contarItem("axe") <= 0) ajustarItem("axe", 1, "mudo");
  if (contarItem("wood") <= 0) ajustarItem("wood", 120, "mudo");
  if (contarItem("stone") <= 0) ajustarItem("stone", 80, "mudo");
  if (contarItem("plantFiber") <= 0) ajustarItem("plantFiber", 60, "mudo");
  darChave("pokedex");
  anunciarGanho("pokedex", 1, "mudo");
  registrarParty();
}

export function nomeDe(tipo, key) {
  return nomeDoItem(key, tipo);
}

export { ESTAGIO, TIPO_ITEM, BOLAS, BERRIES, REMEDIOS, FERRAMENTAS, MOVEIS, RECEITAS_BOLA, CHAVES };
