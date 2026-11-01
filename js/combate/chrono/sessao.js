/**
 * Sessão Chrono in-place: party deployado vs pack (ou mon solo) no mapa.
 */
import { CHRONO } from "../../config.js";
import { avisar, estado } from "../../jogo/estado.js";
import { matesVivos, vivoPack } from "../../pokemon/pack.js";
import { pokemonDeployado } from "../../pokemon/party.js";
import { selvagensAtivos } from "../../pokemon/populacao.js";
import {
  avisoTurno,
  concluirFoco,
  definirModoLuta,
  emFoco,
  encerrarTurnos,
  pedidoEscolha,
  prepararTurnosGrupo,
  tickTurnos,
} from "../turnos.js";
import { atualizarProjeteis } from "../../pokemon/combate/projeteis.js";
import {
  impactoProjetil,
  tickConjuracao,
  tickDesmaio,
} from "../../pokemon/combate/executor.js";
import { tickStatus } from "../../pokemon/combate/status.js";
import { tickPassivo } from "../../pokemon/ator.js";
import { tickVisual } from "../../pokemon/sprites.js";
import { montarGrade } from "../../pokemon/grade.js";
import { definirVolumeChrono, limparVolumeChrono } from "./volume.js";
import { abrirHudChrono, fecharHudChrono, tickHudChrono } from "./hud.js";
import { limparCameraChrono } from "./camera.js";

/** @type {null|((seg: number) => void)} */
let aplicarIframeTreinador = null;
/** @type {null|(() => object|null)} */
let obterTreinadorRef = null;
let focoAcc = 0;

/** @type {null|{
 *  aliados: object[],
 *  foes: object[],
 *  fonteId: string|number,
 *  fase: "luta"|"fim",
 *  resultado: "vitoria"|"derrota"|"fuga"|"troca"|null,
 *  efeitos: object,
 * }} */
let sessao = null;

const scratchMates = [];

export function sessaoChronoAtiva() {
  return !!sessao;
}

export function obterSessaoChrono() {
  return sessao;
}

export function combateChronoSeguraEntrada() {
  return !!sessao;
}

/** Evita ciclo com sistema.js — o hub registra callbacks no boot. */
export function ligarHooksChrono({ obterTreinador, aplicarIframe } = {}) {
  obterTreinadorRef = typeof obterTreinador === "function" ? obterTreinador : null;
  aplicarIframeTreinador = typeof aplicarIframe === "function" ? aplicarIframe : null;
}

function vivo(ator) {
  return !!(ator && !ator.morto && !ator.capturado && (ator.hp == null || ator.hp > 0));
}

function marcarHome(ator) {
  ator.casaChronoX = ator.x;
  ator.casaChronoY = ator.y;
  ator.casaX = ator.x;
  ator.casaY = ator.y;
}

function travarCombatente(ator) {
  if (!ator) return;
  ator.combatHold = true;
  ator._chronoHold = true;
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
  ator.correndo = false;
  // Acorda sono de ninho; sleep de golpe (status) continua e pula turno.
  if (ator.status !== "sleep") {
    ator.sonoNatural = false;
    if ((ator.dormindo || 0) > 0) ator.dormindo = 0;
  }
  if (ator.faccao === "selvagem") {
    ator.modo = "agro";
    ator.agroPersistente = true;
  }
  if (ator.faccao === "party") {
    ator._emLutaCampo = true;
    ator.modo = "agro";
  }
}

function soltarCombatente(ator) {
  if (!ator || !ator._chronoHold) return;
  ator.combatHold = false;
  ator._chronoHold = false;
  ator._emLutaCampo = false;
  ator.resultadoTurno = null;
  ator.carregarDepois = false;
  ator.ensaioEvitar = null;
  if (ator.faccao === "selvagem" && vivo(ator)) {
    ator.modo = "roam";
    ator.agroPersistente = false;
    ator.alvo = null;
  }
  if (ator.faccao === "party") {
    ator.modo = "roam";
    ator.alvo = null;
    ator.ordemAlvo = null;
  }
}

function puxarFoes(fonte) {
  const lista = [];
  const todos = selvagensAtivos();
  if (fonte.packId != null) {
    matesVivos(todos, fonte.packId, scratchMates);
    for (let i = 0; i < scratchMates.length; i++) {
      if (vivoPack(scratchMates[i])) lista.push(scratchMates[i]);
    }
  }
  if (!lista.length && vivo(fonte)) lista.push(fonte);
  // Fonte primeiro na lista (alvo default).
  const idx = lista.indexOf(fonte);
  if (idx > 0) {
    lista.splice(idx, 1);
    lista.unshift(fonte);
  } else if (idx < 0 && vivo(fonte)) {
    lista.unshift(fonte);
  }
  return lista;
}

/**
 * @param {object} fonte selvagem tocado/stompado
 * @param {{motivo?: string, efeitos?: object}} [opts]
 */
export function abrirSessaoChrono(fonte, opts = {}) {
  if (sessao || !fonte) return false;
  if (estado.batalhaTreinador) return false;

  const mon = pokemonDeployado();
  if (!mon || !vivo(mon)) {
    estado.itemGet = "Você precisa de um Pokémon em campo para batalhar.";
    avisar();
    return false;
  }

  const foes = puxarFoes(fonte);
  if (!foes.length) return false;

  const aliados = [mon];
  let sx = 0;
  let sy = 0;
  const n = aliados.length + foes.length;
  for (let i = 0; i < aliados.length; i++) {
    marcarHome(aliados[i]);
    travarCombatente(aliados[i]);
    sx += aliados[i].x;
    sy += aliados[i].y;
  }
  for (let i = 0; i < foes.length; i++) {
    marcarHome(foes[i]);
    travarCombatente(foes[i]);
    foes[i].alvo = mon;
    if (!foes[i].participantes) foes[i].participantes = new Set();
    foes[i].participantes.add(mon.id);
    sx += foes[i].x;
    sy += foes[i].y;
  }
  definirVolumeChrono(sx / n, sy / n, CHRONO.RAIO_VOLUME);

  sessao = {
    aliados,
    foes,
    fonteId: fonte.id,
    fase: "luta",
    resultado: null,
    efeitos: opts.efeitos || null,
    motivo: opts.motivo || "contato",
  };

  definirModoLuta("turnos");
  prepararTurnosGrupo(aliados, foes);
  focoAcc = 0;
  abrirHudChrono({
    nomeParty: mon.especie?.nome || "Pokémon",
    nomeFoe: fonte.especie?.nome || "Selvagem",
    onFuga: () => encerrarSessaoChrono("fuga"),
  });
  return true;
}

export function encerrarSessaoChrono(resultado = "fuga") {
  if (!sessao) return;
  const snap = sessao;
  sessao = null;
  snap.fase = "fim";
  snap.resultado = resultado;

  encerrarTurnos();
  definirModoLuta("real");
  limparVolumeChrono();
  fecharHudChrono();
  limparCameraChrono();

  for (let i = 0; i < snap.aliados.length; i++) soltarCombatente(snap.aliados[i]);
  for (let i = 0; i < snap.foes.length; i++) soltarCombatente(snap.foes[i]);

  if (resultado === "fuga" && aplicarIframeTreinador) {
    aplicarIframeTreinador(CHRONO.FUGA_IFRAME);
  }
}

function algumVivo(lista) {
  for (let i = 0; i < lista.length; i++) {
    if (vivo(lista[i])) return true;
  }
  return false;
}

/**
 * Avança a sessão Chrono. `efeitos` vem do hub Pokémon (XP/drops).
 */
export function tickSessaoChrono(dt, agora, efeitos) {
  if (!sessao) return;
  const efx = efeitos || sessao.efeitos;
  sessao.efeitos = efx;

  if (emFoco()) {
    focoAcc += dt;
    if (focoAcc >= 0.45) {
      focoAcc = 0;
      concluirFoco();
    }
  } else {
    focoAcc = 0;
  }

  const pedido = pedidoEscolha();
  const passoTurno = pedido || avisoTurno() ? 0 : Math.min(0.05, dt);

  const combatentes = sessao.aliados.concat(sessao.foes);
  const treinador = obterTreinadorRef ? obterTreinadorRef() : null;
  for (let i = 0; i < combatentes.length; i++) {
    const a = combatentes[i];
    tickPassivo(a, dt, agora);
    tickStatus(a, agora, efx, "turnos");
    tickDesmaio(a, agora);
  }
  montarGrade(treinador ? combatentes.concat(treinador) : combatentes);

  if (passoTurno > 0) {
    for (let i = 0; i < combatentes.length; i++) {
      tickConjuracao(combatentes[i], passoTurno, agora, efx);
    }
    tickTurnos(passoTurno, agora, efx);
    atualizarProjeteis(passoTurno, combatentes, (p, alvo) => {
      impactoProjetil(p, alvo, agora, efx);
    });
  }

  for (let i = 0; i < combatentes.length; i++) {
    tickVisual(combatentes[i], dt, agora);
  }

  tickHudChrono(pedidoEscolha(), avisoTurno(), sessao);

  if (!algumVivo(sessao.aliados)) {
    encerrarSessaoChrono("derrota");
    return;
  }
  if (!algumVivo(sessao.foes)) {
    encerrarSessaoChrono("vitoria");
  }
}
