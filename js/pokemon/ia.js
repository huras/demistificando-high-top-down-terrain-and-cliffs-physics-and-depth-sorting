/**
 * Roam de selvagens (legado / base pra turno futuro).
 * Combate OW vive em js/pokemon/campo/.
 */
import { AGENTE_DIST_PARAR, POKEMON } from "../config.js";
import { ehCidade } from "../mundo/regiao/grafoKanto.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { soltarEscalada } from "../fisica/escalada.js";
import { cancelarPath } from "../navegacao/filaPath.js";
import { garantirNav } from "../navegacao/seguirCaminho.js";
import { definirEmocao, EMOCAO } from "./emocoes.js";
import { velocidadeDe } from "./ator.js";
import { irPara } from "./ia/locomocaoCampo.js";
import {
  cfgPack,
  ehMembroPack,
  liderPackVivo,
  pontoSlot,
  reempilharLideranca,
  vivoPack,
} from "./pack.js";

export { irPara, zDePerseguicao } from "./ia/locomocaoCampo.js";

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function noTerritorio(ator, x, y) {
  const dx = x - ator.casaX;
  const dy = y - ator.casaY;
  const r = ator.raioTerritorio;
  return dx * dx + dy * dy <= r * r;
}

function escolherMeta(ator) {
  const z = Math.round(ator.z ?? ator.elevacao ?? 1);
  let reserva = null;
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2;
    const raio = 2 + Math.random() * (ator.raioTerritorio - 2);
    const x = ator.casaX + Math.cos(ang) * raio;
    const y = ator.casaY + Math.sin(ang) * raio;
    if (!noTerritorio(ator, x, y) || ehCidade(x, y)) continue;
    const hz = alturaSobPes(x, y, z + 1.2);
    if (hz === z) {
      ator.metaX = x;
      ator.metaY = y;
      return;
    }
    if (reserva == null && (hz === z + 1 || hz === z - 1)) reserva = { x, y };
  }
  const meta = reserva || { x: ator.casaX, y: ator.casaY };
  ator.metaX = meta.x;
  ator.metaY = meta.y;
}

function marcarAncora(ator) {
  ator._ancoraT = 0;
  ator._ax = ator.x;
  ator._ay = ator.y;
  ator._az = ator.z ?? ator.elevacao ?? 0;
  ator._ae = ator.elevacao ?? ator.z ?? 0;
}

function pararCorpo(ator) {
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
}

function desistirMeta(ator) {
  if (ator.escalando) soltarEscalada(ator, { impulso: false, pousarBase: true });
  cancelarPath(ator.id);
  const nav = garantirNav(ator);
  nav.estado = "idle";
  nav.path = null;
  nav.climbAlvo = null;
  ator.roam = "waiting";
  ator.espera = 0.35;
  pararCorpo(ator);
  if (ator.noChao && !ator.pulando) ator.acao = "parado";
  marcarAncora(ator);
}

function vagar(ator, dt) {
  if (ator.roam === "waiting") {
    ator.espera -= dt;
    pararCorpo(ator);
    if (ator.espera <= 0) {
      escolherMeta(ator);
      ator.roam = "moving";
      marcarAncora(ator);
    }
    return;
  }
  const dx = ator.metaX - ator.x;
  const dy = ator.metaY - ator.y;
  if (!noTerritorio(ator, ator.metaX, ator.metaY)) escolherMeta(ator);
  if (
    dx * dx + dy * dy < AGENTE_DIST_PARAR * AGENTE_DIST_PARAR &&
    ator.noChao &&
    !ator.pulando &&
    !ator.escalando
  ) {
    ator.roam = "waiting";
    ator.espera = POKEMON.ESPERA_MIN + Math.random() * (POKEMON.ESPERA_MAX - POKEMON.ESPERA_MIN);
    pararCorpo(ator);
    ator.acao = "parado";
    return;
  }
  if (ator._ancoraT == null) marcarAncora(ator);
  irPara(ator, ator.metaX, ator.metaY, null, velocidadeDe(ator, false), dt);
  const elev = ator.elevacao ?? ator.z ?? 0;
  const progXY = Math.hypot(ator.x - ator._ax, ator.y - ator._ay);
  const progZ = Math.abs((ator.z ?? 0) - ator._az);
  const subindoParede = ator.escalando && elev - ator._ae > 0.3;
  if (progXY > 0.45 || progZ >= 0.9 || subindoParede) {
    marcarAncora(ator);
    return;
  }
  ator._ancoraT += dt;
  if (ator._ancoraT > 1.3) desistirMeta(ator);
}

function seguirLider(ator, selvagens, dt) {
  if (!vivoPack(ator) || !ehMembroPack(ator)) {
    vagar(ator, dt);
    return;
  }
  let lider = liderPackVivo(selvagens, ator.packId);
  if (!lider) {
    lider = reempilharLideranca(selvagens, ator.packId);
  }
  if (!lider || lider === ator || !ehMembroPack(ator)) {
    vagar(ator, dt);
    return;
  }
  const packCfg = cfgPack();
  const slot = pontoSlot(lider, ator.packSlot ?? 1, packCfg);
  const dx = slot.x - ator.x;
  const dy = slot.y - ator.y;
  const dist = Math.hypot(dx, dy);
  const arrive = packCfg.arriveRadius ?? 0.55;
  if (dist <= arrive) {
    pararCorpo(ator);
    ator.acao = "parado";
    ator.roam = "waiting";
    return;
  }
  const catchUp = dist > (packCfg.catchUpDistance ?? 2.4);
  irPara(ator, slot.x, slot.y, null, velocidadeDe(ator, catchUp), dt);
}

/** Aviso de proximidade; combate fica em campo/tickCampo. */
export function atualizarRoamSelvagens(selvagens, mon, jogador, dt) {
  for (let i = 0; i < selvagens.length; i++) {
    const ator = selvagens[i];
    if (!ator || ator.morto || ator.capturado || ator.preso) continue;
    if (ator.forcaCarregado || ator._forcaSendoLevantado) continue;
    if (ator.modo === "agro" && ator.alvo && !ator.alvo.morto) continue;

    const foco = mon && !mon.morto ? mon : jogador;
    if (!ator.efemero && !ator.avisou && foco) {
      const raioAviso = POKEMON.RAIO_AVISO * POKEMON.RAIO_AVISO;
      if (dist2(ator, foco) < raioAviso) {
        ator.avisou = true;
        definirEmocao(ator, EMOCAO.EXCLAMACAO);
        if (foco.faccao === "party") definirEmocao(foco, EMOCAO.EXCLAMACAO, { duracao: 1.2 });
      }
    }
    if (ehMembroPack(ator)) seguirLider(ator, selvagens, dt);
    else vagar(ator, dt);
  }
}
