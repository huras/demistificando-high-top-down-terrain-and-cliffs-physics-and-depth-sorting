/**
 * Ordem Z/X/C/V com o treinador no corpo e um Pokémon fora.
 * O alvo trava no aperto: marcado, hover, bloco, chão.
 */
import { alturaSobPes } from "../../fisica/colisao.js";
import { obterHoverBloco, obterPonteiroCanvas, atualizarHoverBloco } from "../../entrada/hoverBloco.js";
import { raioDoPonteiro } from "../../render/3d/camera3d.js";
import { obterCenario3d } from "../../render/3d/cenario3d.js";
import { velocidadeDe } from "../ator.js";
import { atorSobPonteiro } from "../clique.js";
import { dispararSlotOrdenado, emConjuracao } from "../combate/executor.js";
import { isCombatMotionLocked } from "../combate/meleeApproach.js";
import { projetar3d, projetarChao3d } from "../hud.js";
import { alcanceCorpo, alcanceTiro } from "../ia/espaco.js";
import { irPara } from "../ia/locomocaoCampo.js";
import { alvoDeOrdem, pokemonDeployado } from "../party.js";
import { podeGastarPp } from "../pp.js";
import { efeitosPokemon, relogioPokemon } from "../sistema.js";

/** Ponto de mira reutilizado. Não é ator: fora de sólidos, party e save. */
const ponto = {
  _pontoOrdem: true,
  faccao: "ponto",
  invulneravel: true,
  hp: 1,
  hpMax: 1,
  morto: false,
  capturado: false,
  x: 0,
  y: 0,
  z: 0,
  elevacao: 0,
};

function ordemDe(mon) {
  let o = mon.ordemGolpe;
  if (!o) {
    o = { ativa: false, slot: 0, alvo: null, x: 0, y: 0, z: 0 };
    mon.ordemGolpe = o;
  }
  return o;
}

function encerrar(ordem) {
  ordem.ativa = false;
  ordem.alvo = null;
}

function atorUtil(mon, ator) {
  if (!ator || ator === mon || ator._pontoOrdem) return false;
  if (ator.morto || ator.capturado || !(ator.hp > 0)) return false;
  if (ator.faccao === "party" || ator.faccao === "treinador") return false;
  return true;
}

function pontoNoChao(raio, z) {
  const dz = raio.dz;
  if (Math.abs(dz) < 1e-6) return { x: raio.ox, y: raio.oy, z };
  const t = (z - raio.oz) / dz;
  if (!(t >= 0)) return { x: raio.ox, y: raio.oy, z };
  return { x: raio.ox + raio.dx * t, y: raio.oy + raio.dy * t, z };
}

function pisoEm(x, y, z) {
  const h = alturaSobPes(x, y, z + 8);
  return h > 0 ? h : z;
}

/** Marca do jogador, senão o mon sob o mouse, senão o voxel, senão o chão do raio. */
function resolverDestino(mon) {
  const marcado = alvoDeOrdem();
  if (atorUtil(mon, marcado)) {
    return {
      alvo: marcado,
      x: marcado.x,
      y: marcado.y,
      z: marcado.elevacao ?? marcado.z ?? 0,
    };
  }

  const canvas = document.getElementById("canvas-3d");
  const cen = obterCenario3d();
  const ptr = canvas ? obterPonteiroCanvas(canvas) : null;
  if (!ptr || !cen?.camera3d || !canvas?.width || !canvas?.height) return null;

  const cam = cen.camera3d.cam || cen.camera3d;
  const hover = atorSobPonteiro(
    ptr.x,
    ptr.y,
    projetar3d(cam, canvas.width, canvas.height),
    projetarChao3d(cam, canvas.width, canvas.height),
  );
  if (atorUtil(mon, hover)) {
    return {
      alvo: hover,
      x: hover.x,
      y: hover.y,
      z: hover.elevacao ?? hover.z ?? 0,
    };
  }

  atualizarHoverBloco();
  const bloco = obterHoverBloco();
  if (bloco && bloco.id > 0) {
    const x = bloco.x + 0.5;
    const y = bloco.y + 0.5;
    return { alvo: null, x, y, z: pisoEm(x, y, bloco.z) };
  }

  const ndcX = (ptr.x / canvas.width) * 2 - 1;
  const ndcY = -((ptr.y / canvas.height) * 2 - 1);
  const raio = raioDoPonteiro(cen.camera3d, ndcX, ndcY);
  const base = mon.elevacao ?? mon.z ?? 0;
  const chao = pontoNoChao(raio, base);
  return { alvo: null, x: chao.x, y: chao.y, z: pisoEm(chao.x, chao.y, base) };
}

/**
 * Grava a ordem no mon deployado. Um objeto só, reescrito no lugar.
 * Cancela a ordem de prop pra não brigarem.
 */
export function ordenarGolpe(indice) {
  const mon = pokemonDeployado();
  if (!mon || mon.simbioseAtivo || mon._simbioseFreeze) return false;
  const slot = mon.golpes?.[indice | 0];
  if (!slot?.def) return false;
  const destino = resolverDestino(mon);
  if (!destino) return false;

  mon.ordemCampo = null;
  const ordem = ordemDe(mon);
  ordem.ativa = true;
  ordem.slot = indice | 0;
  ordem.alvo = destino.alvo;
  ordem.x = destino.x;
  ordem.y = destino.y;
  ordem.z = destino.z;
  if (destino.alvo) {
    mon.ordemAlvo = destino.alvo;
    mon.alvo = destino.alvo;
    mon.modo = "agro";
  }
  return true;
}

function alcanceDaOrdem(def) {
  if (!def) return 2.5;
  if (def.debuff?.target === "self" && !def.ailment) return 0;
  if (def.forma === "projectile" || def.forma === "arc") return alcanceTiro(def);
  if (def.forma === "radius") return Math.max(2.2, def.alcance || 2.2);
  if (def.forma === "contact") return alcanceCorpo(def);
  const lista = Number(def.alcance);
  return Number.isFinite(lista) && lista > 0 ? lista : 8;
}

function encarar(mon, x, y) {
  const dx = x - mon.x;
  const dy = y - mon.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return;
  mon.dirX = dx / len;
  mon.dirY = dy / len;
}

function parar(mon) {
  mon.vx = 0;
  mon.vy = 0;
  mon.andando = false;
  mon.correndo = false;
}

function miraViva(ordem) {
  const alvo = ordem.alvo;
  if (!alvo) {
    ponto.x = ordem.x;
    ponto.y = ordem.y;
    ponto.z = ordem.z;
    ponto.elevacao = ordem.z;
    ponto.hp = 1;
    ponto.morto = false;
    return ponto;
  }
  ordem.x = alvo.x;
  ordem.y = alvo.y;
  ordem.z = alvo.elevacao ?? alvo.z ?? ordem.z;
  return alvo;
}

/**
 * Aproxima, solta o slot uma vez e encerra.
 * @returns {boolean} true enquanto a ordem ainda manda no mon
 */
export function tickOrdemGolpe(mon, dt) {
  const ordem = mon?.ordemGolpe;
  if (!ordem?.ativa) return false;
  if (!mon || mon.morto || mon.capturado || !(mon.hp > 0)) {
    encerrar(ordem);
    return false;
  }

  const slot = mon.golpes?.[ordem.slot];
  if (!slot?.def) {
    encerrar(ordem);
    return false;
  }
  if (ordem.alvo && (ordem.alvo.morto || ordem.alvo.capturado || !(ordem.alvo.hp > 0))) {
    if (mon.alvo === ordem.alvo) mon.alvo = null;
    encerrar(ordem);
    return false;
  }
  if (!podeGastarPp(mon, slot.def)) {
    encerrar(ordem);
    return false;
  }

  const mira = miraViva(ordem);
  const ocupado =
    emConjuracao(mon) ||
    (mon.golpeRecRestante || 0) > 0 ||
    (mon.jatoDur || 0) > 0 ||
    isCombatMotionLocked(mon);

  const alcance = alcanceDaOrdem(slot.def);
  const parada = alcance <= 0 ? 0 : Math.max(0.45, alcance * 0.85);
  const dist = Math.hypot(mira.x - mon.x, mira.y - mon.y);

  if (!ocupado && alcance > 0 && dist > parada + 0.12) {
    mon.correndo = true;
    irPara(mon, mira.x, mira.y, ordem.z, velocidadeDe(mon, true), dt, parada);
    return true;
  }

  parar(mon);
  encarar(mon, mira.x, mira.y);
  if (ocupado || (slot.cd || 0) > 0) return true;

  const ok = dispararSlotOrdenado(mon, ordem.slot, mira, relogioPokemon(), efeitosPokemon());
  if (!ok) return true;
  encerrar(ordem);
  if (mon.alvo?._pontoOrdem) mon.alvo = null;
  return false;
}
