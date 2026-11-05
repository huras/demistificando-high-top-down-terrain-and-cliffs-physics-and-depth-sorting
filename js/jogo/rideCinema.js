/**
 * Cinema de montaria: aproximar → pular no assento; desmontar → pular ao lado.
 * Porta enxuta do Pokémon AI (rideMountFx), adaptada ao corpo 3D.
 */

import { alturaSobPes } from "../fisica/colisao.js";
import { atualizarMovimentoDirecionado } from "../fisica/movimento.js";
import { pontoAssentoMundo } from "./rideAssentos.js";

const STAND_GAP = 0.22;
const ARRIVE_DIST = 0.28;
const JUMP_SEC = 0.38;
const HOP_LIFT = 0.55;
const APPROACH_SPRINT_DIST = 3.5;
const RAIO_JOGADOR = 0.28;
const RAIO_MON_PADRAO = 0.4;

/** @type {null | {
 *   dir: "on"|"off",
 *   phase: "approach"|"jumpOn"|"jumpOff"|"done",
 *   age: number,
 *   ator: object,
 *   modo: string,
 *   standX: number,
 *   standY: number,
 *   landX?: number,
 *   landY?: number,
 *   jumpSec: number,
 *   fromX?: number,
 *   fromY?: number,
 *   fromElev?: number,
 *   toX?: number,
 *   toY?: number,
 *   toElev?: number,
 *   onConcluir?: (dir: string) => void,
 * }} */
let cinema = null;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t) {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

function congelarMon(ator) {
  if (!ator) return;
  ator.vx = 0;
  ator.vy = 0;
  ator.vz = 0;
  ator.andando = false;
  ator.correndo = false;
  ator._rideFreeze = true;
}

function liberarMon(ator) {
  if (!ator) return;
  delete ator._rideFreeze;
}

export function cinemaRideAtivo() {
  return !!(cinema && cinema.phase && cinema.phase !== "done");
}

export function atorCinemaRide() {
  return cinema?.ator || null;
}

export function limparCinemaRide() {
  if (cinema?.ator) liberarMon(cinema.ator);
  cinema = null;
}

export function assentoDe(ator, modo) {
  const p = pontoAssentoMundo(ator, modo || "ride");
  return { x: p.x, y: p.y, elev: p.elev };
}

function pontoDeAprox(corpo, ator) {
  const dx = ator.x - corpo.x;
  const dy = ator.y - corpo.y;
  const dist = Math.hypot(dx, dy) || 1;
  const raioMon = Number(ator.raioCorpo) > 0 ? ator.raioCorpo : RAIO_MON_PADRAO;
  const stand = raioMon + RAIO_JOGADOR + STAND_GAP;
  if (dist <= stand + 0.05) {
    return { x: corpo.x, y: corpo.y, dist };
  }
  const t = 1 - stand / dist;
  return {
    x: corpo.x + dx * t,
    y: corpo.y + dy * t,
    dist,
  };
}

function pontoDePouso(corpo, ator) {
  const facing = Number.isFinite(ator?.facing)
    ? ator.facing
    : Number.isFinite(corpo?.facing)
      ? corpo.facing
      : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const side = Math.random() < 0.5 ? 1 : -1;
  const px = -fy * side;
  const py = fx * side;
  const raioMon = Number(ator.raioCorpo) > 0 ? ator.raioCorpo : RAIO_MON_PADRAO;
  const gap = raioMon + RAIO_JOGADOR + 0.35;
  let x = ator.x + px * gap;
  let y = ator.y + py * gap;
  const pr = RAIO_JOGADOR + raioMon + 0.12;
  const dx = x - ator.x;
  const dy = y - ator.y;
  const len = Math.hypot(dx, dy) || 1;
  if (len < pr) {
    x = ator.x + (dx / len) * pr;
    y = ator.y + (dy / len) * pr;
  }
  const chao = alturaSobPes(x, y, corpo?.elevacao ?? corpo?.z ?? ator?.z);
  const elev =
    chao > 0
      ? chao
      : Number.isFinite(ator?.z)
        ? ator.z
        : Number.isFinite(corpo?.z)
          ? corpo.z
          : corpo?.elevacao ?? 0;
  return { x, y, elev };
}

function iniciarPulo(corpo, from, to, dur) {
  if (!cinema) return;
  cinema.fromX = from.x;
  cinema.fromY = from.y;
  cinema.fromElev = from.elev;
  cinema.toX = to.x;
  cinema.toY = to.y;
  cinema.toElev = to.elev;
  cinema.jumpSec = dur;
  cinema.age = 0;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.x = from.x;
  corpo.y = from.y;
  corpo.elevacao = from.elev;
  corpo.z = Math.floor(from.elev);
  corpo.hopLift = from.elev - corpo.z;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.andando = false;
}

function tickPulo(corpo, dt) {
  if (!cinema) return true;
  cinema.age += dt;
  const dur = Math.max(0.01, cinema.jumpSec || JUMP_SEC);
  const t = clamp01(cinema.age / dur);
  const ease = easeOutCubic(t);
  corpo.x = cinema.fromX + (cinema.toX - cinema.fromX) * ease;
  corpo.y = cinema.fromY + (cinema.toY - cinema.fromY) * ease;
  const elevBase =
    (cinema.fromElev ?? 0) + ((cinema.toElev ?? 0) - (cinema.fromElev ?? 0)) * ease;
  const hop = Math.sin(Math.PI * t) * HOP_LIFT;
  const elev = elevBase + hop;
  corpo.elevacao = elev;
  corpo.z = Math.floor(elevBase);
  corpo.hopLift = elev - corpo.z;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.noChao = false;
  corpo.pulando = true;
  if (t >= 1) {
    corpo.x = cinema.toX;
    corpo.y = cinema.toY;
    corpo.elevacao = cinema.toElev;
    corpo.z = Math.floor(cinema.toElev);
    corpo.hopLift = Math.max(0, cinema.toElev - corpo.z);
    return true;
  }
  return false;
}

/**
 * @param {object} corpo
 * @param {object} ator
 * @param {{ modo?: string, onConcluir?: (dir: string) => void }} [opts]
 */
export function iniciarMontariaCinema(corpo, ator, opts = {}) {
  if (!corpo || !ator || cinemaRideAtivo()) return false;
  congelarMon(ator);
  const modo = opts.modo || "ride";
  const stand = pontoDeAprox(corpo, ator);
  cinema = {
    dir: "on",
    phase: stand.dist <= ARRIVE_DIST + 0.35 ? "jumpOn" : "approach",
    age: 0,
    ator,
    modo,
    standX: stand.x,
    standY: stand.y,
    jumpSec: JUMP_SEC,
    onConcluir: typeof opts.onConcluir === "function" ? opts.onConcluir : null,
  };
  if (cinema.phase === "jumpOn") {
    const seat = assentoDe(ator, modo);
    const fromElev = corpo.elevacao ?? corpo.z ?? 0;
    iniciarPulo(
      corpo,
      { x: corpo.x, y: corpo.y, elev: fromElev },
      seat,
      JUMP_SEC,
    );
  }
  return true;
}

/**
 * @param {object} corpo
 * @param {object} ator
 * @param {{ modo?: string, onConcluir?: (dir: string) => void }} [opts]
 */
export function iniciarDesmontariaCinema(corpo, ator, opts = {}) {
  if (!corpo || !ator || cinemaRideAtivo()) return false;
  congelarMon(ator);
  const modo = opts.modo || "ride";
  const land = pontoDePouso(corpo, ator);
  const seat = assentoDe(ator, modo);
  cinema = {
    dir: "off",
    phase: "jumpOff",
    age: 0,
    ator,
    modo,
    standX: seat.x,
    standY: seat.y,
    landX: land.x,
    landY: land.y,
    jumpSec: JUMP_SEC,
    onConcluir: typeof opts.onConcluir === "function" ? opts.onConcluir : null,
  };
  corpo.x = seat.x;
  corpo.y = seat.y;
  corpo.elevacao = seat.elev;
  corpo.z = Math.floor(seat.elev);
  corpo.hopLift = seat.elev - corpo.z;
  iniciarPulo(corpo, seat, { x: land.x, y: land.y, elev: land.elev }, JUMP_SEC);
  return true;
}

function concluir(dir) {
  const cb = cinema?.onConcluir;
  const ator = cinema?.ator;
  if (ator && dir === "off") liberarMon(ator);
  // mount: ride.js mantém freeze até snap contínuo / limpa _rideFreeze e seta rideAtivo
  if (ator && dir === "on") liberarMon(ator);
  cinema = null;
  if (cb) cb(dir);
}

/**
 * @returns {boolean} true se consumiu o frame (sem input livre)
 */
export function tickRideCinema(dt, corpo) {
  if (!cinema || cinema.phase === "done" || !corpo) return false;
  const ator = cinema.ator;
  if (!ator || ator.morto || (ator.hp != null && ator.hp <= 0)) {
    limparCinemaRide();
    return false;
  }
  congelarMon(ator);

  if (cinema.phase === "approach") {
    const stand = pontoDeAprox(corpo, ator);
    cinema.standX = stand.x;
    cinema.standY = stand.y;
    const dx = cinema.standX - corpo.x;
    const dy = cinema.standY - corpo.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= ARRIVE_DIST) {
      corpo.x = cinema.standX;
      corpo.y = cinema.standY;
      corpo.vx = 0;
      corpo.vy = 0;
      cinema.phase = "jumpOn";
      cinema.age = 0;
      const seat = assentoDe(ator, cinema.modo);
      const fromElev = corpo.elevacao ?? corpo.z ?? 0;
      iniciarPulo(
        corpo,
        { x: corpo.x, y: corpo.y, elev: fromElev },
        seat,
        cinema.jumpSec,
      );
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      atualizarMovimentoDirecionado(corpo, nx, ny, dt, {
        correndo: dist > APPROACH_SPRINT_DIST,
        apertouPulo: false,
        querEscalar: false,
        podeSoltarEscala: false,
        sobeVoo: false,
        desceAsa: false,
      });
    }
    return true;
  }

  if (cinema.phase === "jumpOn") {
    const seat = assentoDe(ator, cinema.modo);
    cinema.toX = seat.x;
    cinema.toY = seat.y;
    cinema.toElev = seat.elev;
    const done = tickPulo(corpo, dt);
    if (done) concluir("on");
    return true;
  }

  if (cinema.phase === "jumpOff") {
    const done = tickPulo(corpo, dt);
    if (done) {
      corpo.x = cinema.landX;
      corpo.y = cinema.landY;
      const elevChao =
        Number.isFinite(cinema.toElev) ? cinema.toElev : corpo.elevacao ?? 0;
      corpo.elevacao = elevChao;
      corpo.z = Math.floor(elevChao);
      corpo.hopLift = Math.max(0, elevChao - corpo.z);
      corpo.vx = 0;
      corpo.vy = 0;
      corpo.vz = 0;
      corpo.noChao = true;
      corpo.pulando = false;
      corpo.voando = false;
      corpo.acao = "parado";
      concluir("off");
    }
    return true;
  }

  return true;
}
