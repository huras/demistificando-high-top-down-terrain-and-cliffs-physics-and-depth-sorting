import { USAR_PATCH_DEMO } from "../config.js";
import { SPAWN as SPAWN_DEMO } from "../mundo/mapaDemo.js";
import { SPAWN_PALLET } from "../mundo/regiao/spawnKanto.js";
import { tickPassivo, aplicarNivel } from "./ator.js";
import { atualizarCaptura } from "./captura.js";
import { impactoProjetil, tentarGolpe } from "./combate/executor.js";
import { atualizarProjeteis } from "./combate/projeteis.js";
import { dadosProntos } from "./dados.js";
import { atualizarDrops, soltarDrop } from "./drops.js";
import { carregarEmocoes, tickEmocoes } from "./emocoes.js";
import { ganhoAoDerrotar, NIVEL_MAX, totalParaNivel } from "./experiencia.js";
import { flutuar, tickFlutuantes } from "./flutuantes.js";
import { montarGrade } from "./grade.js";
import { atualizarIa } from "./ia.js";
import {
  atualizarParty,
  iniciarParty,
  listaParty,
  pokemonDeployado,
  pokemonNoCampo,
} from "./party.js";
import { definirCorposAtores } from "../fisica/obstaculos.js";
import { atualizarPopulacao, selvagensAtivos } from "./populacao.js";
import { tickVisual } from "./sprites.js";

let agora = 0;
let ligado = false;
const RESPAWN = USAR_PATCH_DEMO ? SPAWN_DEMO : SPAWN_PALLET;

const treinador = {
  faccao: "treinador",
  hp: 120,
  hpMax: 120,
  tipos: [],
  morto: false,
  iframe: 0,
  x: 0,
  y: 0,
  z: 0,
  elevacao: 0,
};

const efeitos = {
  flutuar,
  aoDerrotar(alvo) {
    if (alvo.faccao === "party") {
      alvo.mortoAte = agora + 15;
      return;
    }
    if (alvo.faccao !== "selvagem" || alvo.dropou) return;
    alvo.dropou = true;
    soltarDrop(alvo);
    const ganho = ganhoAoDerrotar(alvo.especie.baseExp, alvo.nivel);
    const quem = listaParty();
    for (let i = 0; i < quem.length; i++) {
      const p = quem[i];
      if (!alvo.participantes?.has(p.id)) continue;
      p.exp += ganho;
      flutuar(p, `+${ganho} XP`, "#86efac");
      while (p.nivel < NIVEL_MAX && p.exp >= totalParaNivel(p.nivel + 1, p.crescimento)) {
        aplicarNivel(p, p.nivel + 1);
        flutuar(p, `Nv ${p.nivel}`, "#fde68a");
      }
    }
  },
};

export function definirInvulneravel(ativo) {
  treinador.invulneravel = !!ativo;
  if (!ativo) return;
  treinador.morto = false;
  if (treinador.hp <= 0) treinador.hp = treinador.hpMax;
}

export function pokemonLigado() {
  return ligado;
}

export function relogioPokemon() {
  return agora;
}

export function obterTreinador() {
  return treinador;
}

export function ligarPokemon() {
  if (!dadosProntos() || ligado) return ligado;
  carregarEmocoes();
  iniciarParty();
  ligado = true;
  return true;
}

export function tickPokemon(corpo, dt, perfilSeguidor) {
  if (!ligado || !corpo) return;
  const passo = Math.min(0.05, dt);
  agora += passo;
  treinador.x = corpo.x;
  treinador.y = corpo.y;
  treinador.z = corpo.elevacao ?? corpo.z ?? 0;
  treinador.elevacao = treinador.z;
  if (treinador.iframe > 0) treinador.iframe = Math.max(0, treinador.iframe - passo);

  atualizarPopulacao(corpo, passo, agora);
  definirCorposAtores(listarSolidosPokemon());
  atualizarParty(corpo, passo, agora, perfilSeguidor);
  const mon = pokemonDeployado();
  const selvagens = selvagensAtivos();
  atualizarIa(selvagens, mon, treinador, passo);

  const atores = mon ? selvagens.concat(mon) : selvagens;
  for (let i = 0; i < atores.length; i++) tickPassivo(atores[i], passo, agora);
  montarGrade(atores.concat(treinador));
  for (let i = 0; i < atores.length; i++) tentarGolpe(atores[i], agora, efeitos);
  atualizarProjeteis(passo, atores.concat(treinador), (p, alvo) => {
    impactoProjetil(p, alvo, agora, efeitos);
  });
  atualizarCaptura(corpo, passo, agora, efeitos);
  atualizarDrops(corpo, passo, flutuar);
  const visiveis = atoresVisiveis();
  tickEmocoes(visiveis, passo);
  for (let i = 0; i < visiveis.length; i++) tickVisual(visiveis[i], passo, agora);
  tickFlutuantes(passo);

  if (treinador.hp <= 0 && !treinador.invulneravel) {
    corpo.x = RESPAWN.x;
    corpo.y = RESPAWN.y;
    corpo.z = RESPAWN.z;
    corpo.elevacao = RESPAWN.z;
    corpo.vx = 0;
    corpo.vy = 0;
    corpo.vz = 0;
    corpo.pulando = false;
    corpo.planando = false;
    corpo.escalando = false;
    corpo.voando = false;
    corpo.nadando = false;
    corpo.afogandoT = 0;
    corpo.noChao = true;
    corpo.hopLift = 0;
    corpo.pulo = null;
    corpo.escalada = null;
    corpo.mantle = null;
    corpo.puloCortado = false;
    corpo.coyoteT = 0;
    corpo.puloBufferT = 0;
    corpo.tempoAr = 0;
    corpo._renasceu = true;
    treinador.x = RESPAWN.x;
    treinador.y = RESPAWN.y;
    treinador.z = RESPAWN.z;
    treinador.elevacao = RESPAWN.z;
    treinador.hp = treinador.hpMax;
    treinador.morto = false;
    treinador.iframe = 2.5;
    flutuar(treinador, "desmaiou", "#fca5a5");
  }
}

export function listarSolidosPokemon() {
  if (!ligado) return [];
  const saida = [];
  const selvagens = selvagensAtivos();
  for (let i = 0; i < selvagens.length; i++) {
    const a = selvagens[i];
    if (!a.morto && !a.capturado) saida.push(a);
  }
  const mon = pokemonNoCampo();
  if (mon && !mon.morto && !mon.capturado) saida.push(mon);
  return saida;
}

export function atoresVisiveis() {
  if (!ligado) return [];
  const lista = [];
  const selvagens = selvagensAtivos();
  for (let i = 0; i < selvagens.length; i++) {
    if (!selvagens[i].capturado) lista.push(selvagens[i]);
  }
  const mon = pokemonNoCampo();
  if (mon && !mon.capturado) lista.push(mon);
  return lista;
}
