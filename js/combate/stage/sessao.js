/**
 * Sessão de batalha em turno.
 * Wild Chrono: no overworld, Pokémon assumem formação.
 * Trainer: continua no overlay/sandbox (batalha.js).
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
import { aplicarFormacaoMundo } from "./layout.js";
import { limparCacheSceneryStage } from "./scenery.js";
import { fecharOverlayStage } from "./overlay.js";
import { abrirHudChrono, fecharHudChrono, tickHudChrono } from "../chrono/hud.js";
import { limparCameraChrono } from "../chrono/camera.js";
import { definirVolumeChrono, limparVolumeChrono } from "../chrono/volume.js";

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
 *  inplace: boolean,
 *  aliados: object[],
 *  foes: object[],
 *  parked: object[],
 *  fonteId: string|number,
 *  origemX: number,
 *  origemY: number,
 *  fase: "luta"|"fim",
 *  resultado: string|null,
 *  efeitos: object|null,
 * }} */
let sessao = null;

const scratchMates = [];

export function stageAtivo() {
  return !!(estado.batalhaStage || sessao);
}

/** True só no sandbox overlay (treinador). Wild inplace NÃO trava o mundo inteiro. */
export function stageSandboxAtivo() {
  return !!(sessao && !sessao.inplace) || estado.batalhaStage?.kind === "trainer";
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

export function sessaoChronoAtiva() {
  return !!(sessao && sessao.kind === "wild");
}

export function obterSessaoChrono() {
  return sessaoChronoAtiva() ? sessao : null;
}

export function combateChronoSeguraEntrada() {
  return sessaoChronoAtiva();
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

function facingDoEncontro(aliados, foes, ox, oy) {
  const a = aliados[0];
  const f = foes[0];
  if (a && f) {
    const dx = f.x - a.x;
    const dy = f.y - a.y;
    if (dx * dx + dy * dy > 0.04) return { fx: dx, fy: dy };
  }
  // Fallback: do jogador/party para o ninho.
  if (a) {
    const dx = ox - a.x;
    const dy = oy - a.y;
    if (dx * dx + dy * dy > 0.04) return { fx: dx, fy: dy };
  }
  return { fx: 1, fy: 0 };
}

/**
 * Wild: batalha no OW com formação.
 * Trainer: não usa este path (overlay em batalha.js).
 */
export function entrarStage(opts) {
  if (sessao) return false;
  if (estado.batalhaTreinador && opts.kind !== "trainer") return false;

  const aliados = (opts.aliados || []).filter(Boolean);
  const foes = (opts.foes || []).filter(Boolean);
  if (!aliados.length || !foes.length) return false;

  const kind = opts.kind === "trainer" ? "trainer" : "wild";
  // Wild sempre no mundo; trainer fica no sandbox via batalha.js.
  const inplace = kind === "wild";
  const origemX = opts.origemXY?.x ?? foes[0].x ?? 0;
  const origemY = opts.origemXY?.y ?? foes[0].y ?? 0;

  const parked = [];
  for (let i = 0; i < aliados.length; i++) {
    estacionarAtor(aliados[i], { ocultar: !inplace });
    marcarHoldChrono(aliados[i]);
    parked.push(aliados[i]);
  }
  for (let i = 0; i < foes.length; i++) {
    estacionarAtor(foes[i], { ocultar: !inplace });
    marcarHoldChrono(foes[i]);
    foes[i].alvo = aliados[0];
    if (!foes[i].participantes) foes[i].participantes = new Set();
    if (aliados[0]) foes[i].participantes.add(aliados[0].id);
    parked.push(foes[i]);
  }

  const face = facingDoEncontro(aliados, foes, origemX, origemY);
  aplicarFormacaoMundo(aliados, foes, origemX, origemY, face.fx, face.fy, {
    amostrarChao: inplace,
  });

  limparCampoCombate(parked);
  limparImpacto();

  sessao = {
    kind,
    inplace,
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
  estado.batalhaStage = { kind, inplace, fonteId: sessao.fonteId };

  definirModoLuta("turnos");
  prepararTurnosGrupo(aliados, foes);

  if (inplace) {
    definirVolumeChrono(origemX, origemY, CHRONO.RAIO_VOLUME);
    abrirHudChrono({
      nomeParty: opts.nomePlayer || aliados[0]?.especie?.nome || "Pokémon",
      nomeFoe: opts.nomeFoe || foes[0]?.especie?.nome || "Selvagem",
      onFuga: opts.onFuga || (() => sairStage("fuga")),
    });
  }

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
 * @param {string} resultado
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
  limparVolumeChrono();
  fecharHudChrono();
  limparCameraChrono();
  if (!snap.inplace) {
    fecharOverlayStage();
    limparCacheSceneryStage();
  }
  estado.batalhaStage = null;

  for (let i = 0; i < snap.parked.length; i++) {
    const ator = snap.parked[i];
    if (!ator) continue;
    const foeMorto =
      snap.kind === "wild" &&
      ator.faccao === "selvagem" &&
      resultado === "vitoria" &&
      (!vivo(ator) || ator.morto);
    restaurarAtor(ator, {
      // Vitória: mortos ficam onde caíram; vivos voltam à pose pré-luta.
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

  const combatentes = sessao.aliados.concat(sessao.foes);
  for (let i = 0; i < combatentes.length; i++) {
    const a = combatentes[i];
    tickPassivo(a, dt, agora);
    tickStatus(a, agora, efx, "turnos");
    tickDesmaio(a, agora);
    tickVisual(a, dt, agora);
  }

  const pedido = pedidoEscolha();
  const passo = pedido || avisoTurno() ? 0 : Math.min(0.05, dt);
  if (passo > 0) {
    const treinador = obterTreinadorRef ? obterTreinadorRef() : null;
    montarGrade(treinador ? combatentes.concat(treinador) : combatentes);
    for (let i = 0; i < combatentes.length; i++) {
      tickConjuracao(combatentes[i], passo, agora, efx);
    }
    tickTurnos(passo, agora, efx);
    atualizarProjeteis(passo, combatentes, (p, alvo) => {
      impactoProjetil(p, alvo, agora, efx);
    });
  }

  const fxDt = Math.min(0.05, dt);
  tickParticulas(fxDt);
  tickFx(fxDt);

  if (sessao.inplace) {
    tickHudChrono(pedidoEscolha(), avisoTurno(), sessao);
  }

  if (!algumVivo(sessao.aliados)) {
    sairStage("derrota");
    return;
  }
  if (!algumVivo(sessao.foes)) {
    sairStage("vitoria");
  }
}

export function tickSessaoChrono(dt, agora, efeitos) {
  tickStage(dt, agora, efeitos);
}
