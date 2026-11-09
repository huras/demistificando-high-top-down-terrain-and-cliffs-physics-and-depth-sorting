/**
 * BattleStage — sessão unificada (wild Chrono no sandbox 3D).
 */
import { CHRONO } from "../../config.js";
import { avisar, estado } from "../../jogo/estado.js";
import { matesVivos, vivoPack } from "../../pokemon/pack.js";
import { pokemonDeployado } from "../../pokemon/party.js";
import { selvagensAtivos } from "../../pokemon/populacao.js";
import { limparCampoCombate } from "../../pokemon/combate/limparCampo.js";
import {
  avisoTurno,
  definirModoLuta,
  encerrarTurnos,
  pedidoEscolha,
  prepararTurnosGrupo,
  tickTurnos,
} from "../turnos.js";
import { atualizarProjeteis, primeiroTiro } from "../../pokemon/combate/projeteis.js";
import {
  impactoProjetil,
  tickConjuracao,
  tickDesmaio,
} from "../../pokemon/combate/executor.js";
import { tickStatus } from "../../pokemon/combate/status.js";
import { tickParticulas } from "../../pokemon/combate/particulas.js";
import { tickFx } from "../../pokemon/combate/fx/index.js";
import { tickPassivo } from "../../pokemon/ator.js";
import { tickVisual } from "../../pokemon/sprites.js";
import { montarGrade } from "../../pokemon/grade.js";
import {
  limparImpacto,
  marcarImpacto,
  observarTiro,
  tickImpacto,
} from "../impacto.js";
import { estacionarAtor, restaurarAtor } from "./park.js";
import { aplicarFormacao, listaAtoresStage } from "./layout.js";
import { aplicarSceneryStage, limparCacheSceneryStage } from "./scenery.js";
import { aplicarLuzStage } from "./stage3d.js";
import {
  abrirOverlayStage,
  definirStatusStage,
  fecharOverlayStage,
  overlayStageAberto,
  tickOverlayStage,
} from "./overlay.js";

function efeitosComImpacto(efx) {
  if (!efx) return efx;
  if (efx._stageImpacto) return efx;
  const base = typeof efx.anotar === "function" ? efx.anotar.bind(efx) : null;
  efx.anotar = (item) => {
    if (base) base(item);
    if (item && (item.tipo === "dano" || item.tipo === "erro")) marcarImpacto(item);
  };
  efx._stageImpacto = true;
  return efx;
}

/** @type {null|((seg: number) => void)} */
let aplicarIframeTreinador = null;
/** @type {null|(() => object|null)} */
let obterTreinadorRef = null;
/** @type {null|{
 *  kind: "wild"|"trainer",
 *  aliados: object[],
 *  foes: object[],
 *  parked: object[],
 *  fonteId: string|number,
 *  origemX: number,
 *  origemY: number,
 *  fase: "luta"|"fim",
 *  resultado: "vitoria"|"derrota"|"fuga"|"troca"|null,
 *  efeitos: object|null,
 * }} */
let sessao = null;

const scratchMates = [];

export function stageAtivo() {
  return !!(estado.batalhaStage || sessao);
}

export function kindStage() {
  return sessao?.kind || estado.batalhaStage?.kind || null;
}

export function sessaoStageAtiva() {
  return !!sessao;
}

export function obterSessaoStage() {
  return sessao;
}

/** Compat Chrono: sessão wild no stage. */
export function sessaoChronoAtiva() {
  return !!(sessao && sessao.kind === "wild");
}

export function obterSessaoChrono() {
  return sessaoChronoAtiva() ? sessao : null;
}

export function combateChronoSeguraEntrada() {
  return stageAtivo();
}

export function ligarHooksChrono({ obterTreinador, aplicarIframe } = {}) {
  obterTreinadorRef = typeof obterTreinador === "function" ? obterTreinador : null;
  aplicarIframeTreinador = typeof aplicarIframe === "function" ? aplicarIframe : null;
}

function vivo(ator) {
  return !!(ator && !ator.morto && !ator.capturado && (ator.hp == null || ator.hp > 0));
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
  const idx = lista.indexOf(fonte);
  if (idx > 0) {
    lista.splice(idx, 1);
    lista.unshift(fonte);
  } else if (idx < 0 && vivo(fonte)) {
    lista.unshift(fonte);
  }
  return lista;
}

function marcarHoldChrono(ator) {
  ator._chronoHold = true;
  if (ator.faccao === "selvagem") {
    ator.modo = "agro";
    ator.agroPersistente = true;
  }
  if (ator.faccao === "party") {
    ator._emLutaCampo = true;
    ator.modo = "agro";
  }
}

/**
 * @param {{
 *  kind?: "wild"|"trainer",
 *  aliados: object[],
 *  foes: object[],
 *  fonte?: object,
 *  origemXY?: { x: number, y: number },
 *  efeitos?: object,
 *  motivo?: string,
 *  nomePlayer?: string,
 *  nomeFoe?: string,
 *  onFuga?: () => void,
 * }} opts
 */
export function entrarStage(opts) {
  if (sessao) return false;
  if (estado.batalhaTreinador && opts.kind !== "trainer") return false;

  const aliados = (opts.aliados || []).filter(Boolean);
  const foes = (opts.foes || []).filter(Boolean);
  if (!aliados.length || !foes.length) return false;

  const kind = opts.kind === "trainer" ? "trainer" : "wild";
  const origemX = opts.origemXY?.x ?? foes[0].x ?? 0;
  const origemY = opts.origemXY?.y ?? foes[0].y ?? 0;

  const parked = [];
  for (let i = 0; i < aliados.length; i++) {
    estacionarAtor(aliados[i]);
    marcarHoldChrono(aliados[i]);
    parked.push(aliados[i]);
  }
  for (let i = 0; i < foes.length; i++) {
    estacionarAtor(foes[i]);
    marcarHoldChrono(foes[i]);
    foes[i].alvo = aliados[0];
    if (!foes[i].participantes) foes[i].participantes = new Set();
    if (aliados[0]) foes[i].participantes.add(aliados[0].id);
    parked.push(foes[i]);
  }

  aplicarFormacao(aliados, foes);
  limparCampoCombate(parked);
  limparImpacto();

  sessao = {
    kind,
    aliados,
    foes,
    parked,
    fonteId: opts.fonte?.id ?? foes[0]?.id,
    origemX,
    origemY,
    fase: "luta",
    resultado: null,
    efeitos: opts.efeitos || null,
    motivo: opts.motivo || "contato",
  };
  estado.batalhaStage = { kind, fonteId: sessao.fonteId };

  definirModoLuta("turnos");
  prepararTurnosGrupo(aliados, foes);

  // Overlay liga o WebGL antes do scenery 3-step.
  abrirOverlayStage({
    nomePlayer: opts.nomePlayer || aliados[0]?.especie?.nome || "Você",
    nomeFoe: opts.nomeFoe || foes[0]?.especie?.nome || "Oponente",
    podeFugir: kind === "wild",
    onFuga: opts.onFuga || (() => sairStage("fuga")),
    obterAtores: () => listaAtoresStage(sessao?.aliados, sessao?.foes),
    obterSessaoHud: () => sessao,
  });
  const perfil = aplicarSceneryStage(origemX, origemY, {
    forcar: true,
    activePerSide: Math.max(aliados.length, foes.length),
  });
  if (perfil?.luz) aplicarLuzStage(perfil.luz);
  definirStatusStage("A batalha começou!");
  return true;
}

/**
 * @param {object} fonte
 * @param {{motivo?: string, efeitos?: object}} [opts]
 */
export function abrirSessaoChrono(fonte, opts = {}) {
  if (sessao || !fonte) return false;
  if (estado.batalhaTreinador || estado.batalhaStage) return false;

  const mon = pokemonDeployado();
  if (!mon || !vivo(mon)) {
    estado.itemGet = "Você precisa de um Pokémon em campo para batalhar.";
    avisar();
    return false;
  }

  const foes = puxarFoes(fonte);
  if (!foes.length) return false;

  return entrarStage({
    kind: "wild",
    aliados: [mon],
    foes,
    fonte,
    origemXY: { x: fonte.x, y: fonte.y },
    efeitos: opts.efeitos,
    motivo: opts.motivo || "contato",
    nomePlayer: mon.especie?.nome || "Pokémon",
    nomeFoe: fonte.especie?.nome || "Selvagem",
  });
}

export function encerrarSessaoChrono(resultado = "fuga") {
  sairStage(resultado);
}

/**
 * @param {"vitoria"|"derrota"|"fuga"|"troca"|string} resultado
 */
export function sairStage(resultado = "fuga") {
  if (!sessao) return;
  const snap = sessao;
  sessao = null;
  snap.fase = "fim";
  snap.resultado = resultado;

  encerrarTurnos();
  definirModoLuta("real");
  limparImpacto();
  limparCampoCombate(snap.parked);
  fecharOverlayStage();
  limparCacheSceneryStage();
  estado.batalhaStage = null;

  for (let i = 0; i < snap.parked.length; i++) {
    const ator = snap.parked[i];
    if (!ator) continue;
    // Vitória: selvagens mortos não voltam à pose OW (população culle).
    const foeMorto =
      snap.kind === "wild" &&
      ator.faccao === "selvagem" &&
      resultado === "vitoria" &&
      (!vivo(ator) || ator.morto);
    restaurarAtor(ator, {
      restaurarPose: !foeMorto,
      soltarHold: true,
    });
    if (foeMorto) {
      ator._chronoHold = false;
      ator.combatHold = false;
    }
  }

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
 * @param {number} dt
 * @param {number} agora
 * @param {object} [efeitos]
 */
export function tickStage(dt, agora, efeitos) {
  if (!sessao) return;
  const efx = efeitosComImpacto(efeitos || sessao.efeitos);
  sessao.efeitos = efx;

  tickImpacto(dt);
  observarTiro(primeiroTiro());

  // Passivo/status/visual mesmo com menu aberto (turno pausado).
  const combatentes = sessao.aliados.concat(sessao.foes);
  for (let i = 0; i < combatentes.length; i++) {
    const a = combatentes[i];
    tickPassivo(a, dt, agora);
    tickStatus(a, agora, efx, "turnos");
    tickDesmaio(a, agora);
    tickVisual(a, dt, agora);
  }

  tickOverlayStage(dt, (passo) => {
    if (pedidoEscolha() || avisoTurno()) return;
    const treinador = obterTreinadorRef ? obterTreinadorRef() : null;
    montarGrade(treinador ? combatentes.concat(treinador) : combatentes);
    for (let i = 0; i < combatentes.length; i++) {
      tickConjuracao(combatentes[i], passo, agora, efx);
    }
    tickTurnos(passo, agora, efx);
    atualizarProjeteis(passo, combatentes, (p, alvo) => {
      impactoProjetil(p, alvo, agora, efx);
    });
  });

  // FX no relógio de parede (mesmo com menu/foco) — senão faiscas ficam congeladas.
  const fxDt = Math.min(0.05, dt);
  tickParticulas(fxDt);
  tickFx(fxDt);

  if (!overlayStageAberto()) return;

  if (!algumVivo(sessao.aliados)) {
    sairStage("derrota");
    return;
  }
  if (!algumVivo(sessao.foes)) {
    sairStage("vitoria");
  }
}

/** Alias Chrono. */
export function tickSessaoChrono(dt, agora, efeitos) {
  tickStage(dt, agora, efeitos);
}
