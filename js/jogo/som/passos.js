/**
 * Passo por distância andada, não pelo quadro da poeira.
 * Um clipe de piso seco; grama alta soma uma camada por cima.
 */

import { estado } from "../estado.js";
import { vegetacaoNaArea } from "../../mundo/bioma/propsBioma.js";
import { atoresVisiveis } from "../../pokemon/sistema.js";
import { definirOuvinte, tocar, tocarEm } from "./barramento.js";

const PASSO = 0.58;
const INTERVALO = 0.15;
const INTERVALO_CORRIDA = 0.09;
const VEL_REF = 6.5;
const VEL_MIN = 0.35;
const RAIO2 = 18 * 18;
const GANHO_JOGADOR = 1.15;
const GANHO_OUTRO = 0.78;
const GANHO_GRAMA = 0.72;
const INTERVALO_GRAMA = 0.22;
const MAX_POR_QUADRO = 8;
const ALCANCE = 18;

/** @type {WeakMap<object, { x: number, y: number, acum: number, espera: number, esperaGrama: number, esquerda: boolean }>} */
const rastros = new WeakMap();
const fila = [];

function limitar(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function hash01(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function hashId(id, sal) {
  const s = String(id ?? "1");
  let h = sal | 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return hash01(h);
}

function rastroDe(e) {
  let r = rastros.get(e);
  if (!r) {
    r = {
      x: e.x,
      y: e.y,
      acum: 0,
      espera: 0,
      esperaGrama: 0,
      esquerda: false,
    };
    rastros.set(e, r);
  }
  return r;
}

function noChao(e) {
  if (!e || e.morto || e.capturado) return false;
  if (e.voando || e.planando || e.escalando || e.nadando || e.pulando || e.mantle) return false;
  if ((e.hopLift || 0) > 0.12) return false;
  if ((e.aguaProf || 0) > 0.18) return false;
  if ((e.vz || 0) > 0.35) return false;
  if (e.noChao === false) return false;
  return true;
}

function naGramaAlta(e) {
  if (e.pulando || e.planando || e.escalando || e.voando || e.nadando) return false;
  const cx = Math.floor(e.x);
  const cy = Math.floor(e.y);
  const props = vegetacaoNaArea(cx, cy, cx + 1, cy + 1);
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.tipo !== "grama") continue;
    if (Math.floor(p.x) === cx && Math.floor(p.y) === cy) return true;
  }
  return false;
}

function tomDe(e, esquerda, sprint) {
  const raio = Number(e.raioCorpo ?? e.radius);
  const tamanho = Number.isFinite(raio) ? limitar((raio - 0.32) / 1.15, 0, 1) : 0.35;
  const base = 1.1 - tamanho * 0.26;
  const sal = hashId(e.id, esquerda ? 3 : 9);
  const tom = base * (0.97 + sal * 0.07) * (1 + 0.08 * sprint);
  return limitar(tom, 0.82, 1.22);
}

function soltarGrama(e, jogador, sprint, esquerda) {
  const volume = GANHO_GRAMA * (jogador ? 1 : 0.72) * (0.9 + 0.15 * sprint);
  const rate = 0.96 + hash01((e.x + e.y) * 11.17 + (esquerda ? 1 : 2)) * 0.1;
  if (jogador) return tocar("grama", { volume, rate });
  return tocarEm("grama", {
    x: e.x,
    y: e.y,
    volume,
    rate,
    alcance: ALCANCE,
    refDistance: 8,
    rolloff: 0.65,
    espalha: 0.45,
    modelo: "linear",
  });
}

let ouvinteX = 0;
let ouvinteY = 0;

function soltarPasso(e, jogador, esquerda, sprint) {
  const rate = tomDe(e, esquerda, sprint);
  if (jogador) {
    return tocar("passo", {
      volume: GANHO_JOGADOR * (0.92 + 0.2 * sprint),
      rate,
      pan: esquerda ? -0.16 : 0.16,
    });
  }
  const fx = e.dirX || 0;
  const fy = e.dirY || 1;
  const len = Math.hypot(fx, fy) || 1;
  const lado = esquerda ? -0.16 : 0.16;
  const dist = Math.hypot(e.x - ouvinteX, e.y - ouvinteY);
  return tocarEm("passo", {
    x: e.x + (-fy / len) * lado,
    y: e.y + (fx / len) * lado,
    volume: GANHO_OUTRO * (0.85 + 0.2 * sprint),
    rate,
    alcance: ALCANCE,
    refDistance: 8,
    rolloff: 0.65,
    espalha: 0.45,
    modelo: "linear",
    hrtf: dist < 7,
  });
}

function considerar(e, lx, ly, jogador) {
  if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
  if (!jogador) {
    const dx = e.x - lx;
    const dy = e.y - ly;
    if (dx * dx + dy * dy > RAIO2) {
      const r = rastros.get(e);
      if (r) {
        r.x = e.x;
        r.y = e.y;
        r.acum = 0;
      }
      return;
    }
  }
  fila.push(e);
}

export function tickPassos(dt, corpo, agente) {
  if (!corpo) return;
  ouvinteX = corpo.x;
  ouvinteY = corpo.y;
  definirOuvinte(corpo.x, corpo.y, corpo.dirX || 0, corpo.dirY || 1);
  if (estado.interior) return;

  fila.length = 0;
  considerar(corpo, corpo.x, corpo.y, true);
  if (agente && agente !== corpo) considerar(agente, corpo.x, corpo.y, false);
  const atores = atoresVisiveis();
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    if (a === corpo || a === agente) continue;
    considerar(a, corpo.x, corpo.y, false);
  }

  const passoDt = dt > 0 && dt < 0.08 ? dt : 0.016;
  let disparos = 0;
  for (let i = 0; i < fila.length; i++) {
    const e = fila[i];
    const jogador = e === corpo;
    const r = rastroDe(e);
    const dx = e.x - r.x;
    const dy = e.y - r.y;
    r.x = e.x;
    r.y = e.y;
    r.espera = Math.max(0, r.espera - passoDt);
    r.esperaGrama = Math.max(0, r.esperaGrama - passoDt);

    if (!noChao(e)) {
      r.acum = 0;
      continue;
    }

    const dist = Math.hypot(dx, dy);
    const vel = Math.max(Math.hypot(e.vx || 0, e.vy || 0), dist / Math.max(passoDt, 1e-4));
    if (dist < 1e-5 && vel < VEL_MIN) {
      r.acum *= 0.35;
      continue;
    }
    if (dist > PASSO * 5) {
      r.acum = 0;
      continue;
    }

    r.acum += dist;
    const marcha = limitar(vel / VEL_REF, 0.2, 2.2);
    const precisa = PASSO * (0.88 + 0.12 * limitar(marcha, 0, 1.8));
    const espera =
      INTERVALO + (INTERVALO_CORRIDA - INTERVALO) * limitar((marcha - 0.85) / 0.7, 0, 1);
    const sprint = limitar((marcha - 0.9) / 0.7, 0, 1);
    let plantou = 0;
    while (r.acum >= precisa && r.espera <= 0 && disparos < MAX_POR_QUADRO && plantou < 2) {
      r.acum -= precisa;
      r.espera = espera;
      r.esquerda = !r.esquerda;
      const ok = soltarPasso(e, jogador, r.esquerda, sprint);
      if (ok && r.esperaGrama <= 0 && naGramaAlta(e)) {
        soltarGrama(e, jogador, sprint, r.esquerda);
        r.esperaGrama = INTERVALO_GRAMA;
      }
      if (ok !== false) {
        disparos++;
        plantou++;
      } else {
        break;
      }
    }
    if (r.acum > precisa * 2.5) r.acum = precisa;
  }
}
