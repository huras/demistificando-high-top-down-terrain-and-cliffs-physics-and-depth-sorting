/**
 * Pernas do combate OW: pathfinding 3D (atualizarAgente).
 * Política/targeting vive em js/pokemon/campo/. Arena usa integrarComando + pensar.
 */
import { AGENTE_DIST_PARAR, POKEMON } from "../../config.js";
import { alturaSobPes } from "../../fisica/colisao.js";
import { atualizarAgente, garantirCorpoLocomocao } from "../../fisica/agente.js";
import { sincronizarFacingParede } from "../../fisica/escalada.js";
import { emAvanco, emEsquiva, emRecuo, presoNoGolpe, velocidadeDe } from "../ator.js";
import { perfilDoHabitat } from "../habitat/index.js";
import { FOLGA_PARADA } from "./constantes.js";
import { regua, sentidoParada } from "./espaco.js";
import { quadroDe } from "./observacao.js";

/** Fora disto a luta só fecha caminho (sem strafe / rede de postura). */
const LOD_AGRO = 1.25;
/** Mínimo pro pensarSeguir da navegação ligar (gate distSeguir >= 1). */
const DIST_REDE = 1;
/** Passo curto do strafe no anel (células). */
const STRAFE_PASSO = 1.75;

const metaScratch = { x: 0, y: 0, z: 0, parada: 1.2, forma: "contact", d: 0 };

function pararCorpo(ator) {
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
}

function perfilCampo(ator) {
  if (ator.perfil && (ator.faccao === "party" || ator._santuario)) return ator.perfil;
  // Habitat kind → perfil (HIGH voa; água nada; resto campo).
  return perfilDoHabitat(ator.habitatKind, ator);
}

/** Quem não voa persegue o chão embaixo de quem está no ar. */
export function zDePerseguicao(ator, alvo) {
  const z = alvo?.z ?? alvo?.elevacao ?? 0;
  if (ator.perfil?.podeVoar) return z;
  if (!alvo?.voando && !alvo?.planando) return z;
  const chao = alturaSobPes(alvo.x, alvo.y, z);
  return chao > 0 ? chao : z;
}

/** Path + locomoção 3D. distParar >= 1 reativa a rede de seguir. */
export function irPara(ator, gx, gy, gz, vel, dt, distParar = 0) {
  if ((ator.conjuroRestante || 0) > 0 || (ator.golpeRecRestante || 0) > 0) {
    pararCorpo(ator);
    return false;
  }
  const perfil = perfilCampo(ator);
  if (ator.perfil !== perfil) ator.perfil = perfil;
  garantirCorpoLocomocao(ator, ator.perfil);
  const zBase = ator.elevacao ?? ator.z ?? 0;
  const zAlvo = gz != null && gz > 0 ? gz : alturaSobPes(gx, gy, zBase + 12);
  atualizarAgente(
    ator,
    { x: gx, y: gy, z: zAlvo > 0 ? zAlvo : zBase, elevacao: zAlvo > 0 ? zAlvo : zBase },
    dt,
    vel,
    distParar,
  );
  return !!(ator.andando || ator.pulando || ator.escalando || ator.voando || ator.planando || ator.mantle);
}

/**
 * Ponto no anel de engajamento (não o pé do alvo).
 * hab "fugir" empurra para trás.
 */
export function metaEngajamento(ator, alvo, hab) {
  const skill = hab || ator.hab || "perseguir";
  const faixa = regua(ator, skill);
  const parada = Math.max(AGENTE_DIST_PARAR, faixa.parada || AGENTE_DIST_PARAR);
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const fx = dx / d;
  const fy = dy / d;
  if (skill === "fugir") {
    metaScratch.x = ator.x - fx * Math.max(2.4, parada);
    metaScratch.y = ator.y - fy * Math.max(2.4, parada);
  } else {
    metaScratch.x = alvo.x - fx * parada;
    metaScratch.y = alvo.y - fy * parada;
  }
  metaScratch.z = zDePerseguicao(ator, alvo);
  metaScratch.parada = parada;
  metaScratch.forma = faixa.forma || "contact";
  metaScratch.d = d;
  return metaScratch;
}

export function lutaBarata(ator, alvo) {
  if (!ator || !alvo) return true;
  const lim = POKEMON.RAIO_AGRO * LOD_AGRO;
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  return dx * dx + dy * dy > lim * lim;
}

export function emLutaCampo(ator) {
  if (!ator || ator.morto || ator.capturado || ator.preso) return false;
  const alvo = ator.alvo;
  if (!alvo || alvo.morto || alvo.capturado) return false;
  if (ator.faccao === "party") return !!(ator.ordemAlvo || ator.modo === "agro");
  return ator.modo === "agro";
}

/** Monta lista de lutadores uma vez por frame (sem N+1). */
export function coletarEmLuta(selvagens, mon, dest) {
  const out = dest || [];
  out.length = 0;
  if (selvagens) {
    for (let i = 0; i < selvagens.length; i++) {
      if (emLutaCampo(selvagens[i])) out.push(selvagens[i]);
    }
  }
  if (mon && emLutaCampo(mon)) out.push(mon);
  return out;
}

function distPararDe(parada) {
  return Math.max(DIST_REDE, parada || DIST_REDE);
}

/**
 * Fecha no anel, segura range de tiro e aplica strafe do cmd da rede.
 * @param {{ barato?: boolean }} [opts]
 */
export function integrarCombateCampo(ator, alvo, dt, opts = {}) {
  if (!ator || !alvo || alvo.morto || alvo.capturado) {
    if (ator) pararCorpo(ator);
    return;
  }
  if (emRecuo(ator) || emAvanco(ator) || emEsquiva(ator) || presoNoGolpe(ator)) {
    ator.andando = false;
    return;
  }
  if ((ator.conjuroRestante || 0) > 0 || (ator.golpeRecRestante || 0) > 0) {
    pararCorpo(ator);
    return;
  }

  const perfil = perfilCampo(ator);
  if (ator.perfil !== perfil) ator.perfil = perfil;

  const hab = ator.hab || "perseguir";
  const m = metaEngajamento(ator, alvo, hab);
  const vel = velocidadeDe(ator, true);
  const barato = opts.barato === true || lutaBarata(ator, alvo);
  const q = quadroDe(ator, alvo);

  // Na parede: sobe/desce pelo path e mantém o peito pra face (não pro alvo).
  if (ator.escalando || ator.mantle) {
    irPara(ator, alvo.x, alvo.y, m.z, vel, dt, distPararDe(m.parada));
    if (ator.escalando && ator.escalada) sincronizarFacingParede(ator, ator.escalada);
    return;
  }

  ator.dirX = q.fx;
  ator.dirY = q.fy;

  if (hab === "fugir" || barato) {
    irPara(ator, m.x, m.y, m.z, vel, dt, distPararDe(AGENTE_DIST_PARAR));
    return;
  }

  const sentido = sentidoParada(m.d, m.parada, m.forma);

  if (sentido !== 0) {
    // Perseguir/atirar: path até o alvo com stop = anel (não o pixel do peito).
    if (hab === "perseguir" || hab === "atirar") {
      irPara(ator, alvo.x, alvo.y, m.z, vel, dt, distPararDe(m.parada));
      return;
    }
    irPara(ator, m.x, m.y, m.z, vel, dt, distPararDe(AGENTE_DIST_PARAR));
    return;
  }

  // No anel: strafe pelo cmd da rede; sem cmd, segura e encara.
  const cx = ator.cmdX || 0;
  const cy = ator.cmdY || 0;
  const mag = Math.hypot(cx, cy);
  if (mag < 0.2) {
    pararCorpo(ator);
    return;
  }

  // Lateral puro no bolso; se o cmd puxa radial demais, corrige pro anel.
  const lat = cx * q.lx + cy * q.ly;
  const rad = cx * q.fx + cy * q.fy;
  let dirX = cx;
  let dirY = cy;
  if (Math.abs(lat) >= 0.2 && Math.abs(rad) < 0.55) {
    dirX = q.lx * Math.sign(lat);
    dirY = q.ly * Math.sign(lat);
  } else if (Math.abs(m.d - m.parada) > FOLGA_PARADA * 2) {
    irPara(ator, alvo.x, alvo.y, m.z, vel, dt, distPararDe(m.parada));
    return;
  }

  const inv = 1 / (Math.hypot(dirX, dirY) || 1);
  const gx = ator.x + dirX * inv * STRAFE_PASSO;
  const gy = ator.y + dirY * inv * STRAFE_PASSO;
  irPara(ator, gx, gy, m.z, vel, dt, distPararDe(AGENTE_DIST_PARAR));
}
