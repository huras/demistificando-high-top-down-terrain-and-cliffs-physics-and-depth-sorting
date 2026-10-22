import { ALTURA_BLOCO, USAR_PATCH_DEMO } from "../config.js";
import { registrarMorte } from "../jogo/jornada.js";
import { SPAWN as SPAWN_DEMO } from "../mundo/mapaDemo.js";
import { SPAWN_PALLET } from "../mundo/regiao/spawnKanto.js";
import { tickPassivo, aplicarNivel } from "./ator.js";
import { tickStatus } from "./combate/status.js";
import { atualizarCaptura } from "./captura.js";
import {
  aplicarDanoLivre,
  impactoProjetil,
  tickConjuracao,
  tickDesmaio,
} from "./combate/executor.js";
import { impactoFx, tickFx } from "./combate/fx/index.js";
import { tickParticulas } from "./combate/particulas.js";
import { atualizarProjeteis } from "./combate/projeteis.js";
import { dadosProntos } from "./dados.js";
import { atualizarDrops, soltarDrop } from "./drops.js";
import { carregarEmocoes, tickEmocoes } from "./emocoes.js";
import { ganhoAoDerrotar, NIVEL_MAX, totalParaNivel } from "./experiencia.js";
import { flutuar, tickFlutuantes } from "./flutuantes.js";
import { atoresPerto, montarGrade } from "./grade.js";
import { atualizarRoamSelvagens } from "./ia.js";
import {
  tickGolpesCampo,
  tickPartyCampo,
  tickWildCampo,
} from "./campo/tickCampo.js";
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
import { tickFxBola } from "../fx/fxBola.js";
import { aoLiberarSom } from "../jogo/audio.js";
import { aquecerGrito, tickGritosAmbiente } from "../jogo/som/gritos.js";
import { markSpeciesSeen } from "../jogo/pokedex/progresso.js";

aoLiberarSom(() => {
  aquecerGrito(pokemonNoCampo());
});

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
  aoGolpe() {},
  aoImpacto(alvo, tipo, efet) {
    impactoFx(alvo, tipo, efet);
  },
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

/**
 * Flecha do arco no ponto mundo (x,y horizontal; zAltura em unidades Three).
 * Só selvagens. Retorna true se aplicou dano.
 */
export function tentarAcertoFlecha(x, y, zAltura, forca = 1) {
  if (!ligado) return false;
  const perto = atoresPerto(x, y, 0.65);
  let melhor = null;
  let melhorD = 0.65 * 0.65;
  for (let i = 0; i < perto.length; i++) {
    const a = perto[i];
    if (!a || a.faccao !== "selvagem" || a.morto || a.capturado || a.hp <= 0) continue;
    const elev = (a.elevacao ?? a.z ?? 0) * ALTURA_BLOCO + (a.hopLift || 0);
    const centro = elev + 0.55;
    if (Math.abs(zAltura - centro) > 0.85 && Math.abs(zAltura - elev) > 0.85) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > melhorD) continue;
    melhorD = d2;
    melhor = a;
  }
  if (!melhor) return false;
  const t = Math.min(1, Math.max(0, forca));
  const poder = 28 + Math.round(36 * t);
  return aplicarDanoLivre(treinador, melhor, poder, "normal", "physical", agora, efeitos);
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
  treinador.voando = !!corpo.voando;
  treinador.planando = !!corpo.planando;
  if (treinador.iframe > 0) treinador.iframe = Math.max(0, treinador.iframe - passo);

  atualizarPopulacao(corpo, passo, agora);
  definirCorposAtores(listarSolidosPokemon());
  const mon = pokemonDeployado();
  const selvagens = selvagensAtivos();
  aquecerGrito(pokemonNoCampo());
  tickGritosAmbiente(passo, corpo, selvagens);

  // Combate OW: wilds agroam antes do party (DEFEND enxerga no mesmo frame).
  for (let i = 0; i < selvagens.length; i++) {
    tickWildCampo(selvagens[i], mon, treinador, passo);
  }
  if (mon) {
    mon._emLutaCampo = tickPartyCampo(mon, selvagens, treinador, passo);
  }
  atualizarRoamSelvagens(selvagens, mon, treinador, passo);
  atualizarParty(corpo, passo, agora, perfilSeguidor);

  const atores = mon ? selvagens.concat(mon) : selvagens;
  for (let i = 0; i < atores.length; i++) tickPassivo(atores[i], passo, agora);
  for (let i = 0; i < atores.length; i++) tickStatus(atores[i], agora, efeitos, "real");
  for (let i = 0; i < atores.length; i++) tickDesmaio(atores[i], agora);
  montarGrade(atores.concat(treinador));
  for (let i = 0; i < atores.length; i++) tickConjuracao(atores[i], passo, agora, efeitos);
  tickGolpesCampo(atores, agora, efeitos);
  atualizarProjeteis(passo, atores.concat(treinador), (p, alvo) => {
    impactoProjetil(p, alvo, agora, efeitos);
  });
  atualizarCaptura(corpo, passo, agora, efeitos);
  tickFxBola(passo);
  atualizarDrops(corpo, passo, flutuar);
  const visiveis = atoresVisiveis();
  for (let i = 0; i < visiveis.length; i++) {
    const a = visiveis[i];
    if (a?.faccao === "selvagem" && a.especie?.key && !a.morto && !a.capturado) {
      markSpeciesSeen(a.especie.key);
    }
  }
  tickEmocoes(visiveis, passo);
  for (let i = 0; i < visiveis.length; i++) tickVisual(visiveis[i], passo, agora);
  tickFlutuantes(passo);
  tickParticulas(passo);
  tickFx(passo);

  if (treinador.hp <= 0 && !treinador.invulneravel) {
    registrarMorte(
      corpo.x,
      corpo.y,
      corpo.elevacao ?? corpo.z ?? 0,
    );
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
