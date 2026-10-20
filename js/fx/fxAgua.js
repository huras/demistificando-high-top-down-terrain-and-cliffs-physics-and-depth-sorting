/**
 * Ondulação, gota e pegada molhada.
 * Piscinas fixas, sem alocação no quadro. O balanço do nado é só visual.
 */
import {
  AGUA_GOTA_GRAV,
  AGUA_GOTA_PINGA,
  AGUA_GOTA_RAJADA,
  AGUA_GOTA_VIDA,
  AGUA_IMERSAO_MIN,
  AGUA_MOLHA_SEG,
  AGUA_NADO_BOB_A,
  AGUA_NADO_BOB_B,
  AGUA_NADO_BOB_PARADO,
  AGUA_ONDA_ATRAS,
  AGUA_ONDA_CRESCE,
  AGUA_ONDA_INTERVALO,
  AGUA_ONDA_INTERVALO_PARADO,
  AGUA_ONDA_PASSO,
  AGUA_ONDA_RX,
  AGUA_ONDA_RY,
  AGUA_OFFSET_LAMINA,
  AGUA_ONDA_VIDA,
  AGUA_PEGADA_CARGA,
  AGUA_PEGADA_CHEIO,
  AGUA_PEGADA_DIST,
  AGUA_PEGADA_INTERVALO,
  AGUA_PEGADA_LATERAL,
  AGUA_PEGADA_TAM,
  AGUA_PEGADA_VEL,
  AGUA_PEGADA_VIDA,
} from "../config.js";
import { estado } from "../jogo/estado.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";
import { atoresVisiveis } from "../pokemon/sistema.js";

const CAP_ONDA = 96;
const CAP_GOTA = 64;
const CAP_PEGADA = 80;
const PERTO2 = 18 * 18;
const VEL_CORRIDA = 3.05;
const VEL_TELEPORTE = 30;

const ondas = Array.from({ length: CAP_ONDA }, (_, i) => ({
  idx: i,
  viva: false,
  x: 0,
  y: 0,
  z: 0,
  idade: 0,
  dur: 1,
  trilha: null,
}));

const gotas = Array.from({ length: CAP_GOTA }, () => ({
  viva: false,
  x: 0,
  y: 0,
  z: 0,
  chao: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  idade: 0,
  dur: 1,
  tam: 0.06,
}));

const pegadas = Array.from({ length: CAP_PEGADA }, () => ({
  viva: false,
  x: 0,
  y: 0,
  z: 0,
  ang: 0,
  sx: 0.3,
  sy: 0.15,
  idade: 0,
  dur: 1,
  alfa0: 0.5,
}));

let tempo = 0;

const amoOnda = { rx: 0, ry: 0, alfa: 0 };
const amoGota = { alfa: 0, tam: 0 };

const rastros = new WeakMap();
const fila = [];

function criarTrilha() {
  return {
    x: 0,
    y: 0,
    cdOnda: 0,
    cdPasso: 0,
    acum: 0,
    carga: 0,
    esq: 0,
    molha: 0,
    pinga: 0,
    imerso: false,
    nOnda: 0,
    oi: [-1, -1, -1],
  };
}

export function ondasAgua() {
  return ondas;
}

export function gotasAgua() {
  return gotas;
}

export function pegadasAgua() {
  return pegadas;
}

/** Offset em blocos. Zero fora do nado na superfície. */
export function oscilacaoNado(corpo) {
  if (!corpo || corpo.acao !== "nadando") return 0;
  const t = tempo * (corpo.andando ? 1 : AGUA_NADO_BOB_PARADO);
  const x = corpo.x || 0;
  return (
    Math.sin(x * 1.4 + t * 4.2) * AGUA_NADO_BOB_A +
    Math.cos(x * 0.8 - t * 2.8) * AGUA_NADO_BOB_B
  );
}

export function amostraOnda(o) {
  const t = o.dur > 0 ? o.idade / o.dur : 1;
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const fade = (1 - u) * (1 - u);
  const cresce = 1 + u * (AGUA_ONDA_CRESCE - 1);
  amoOnda.rx = AGUA_ONDA_RX * cresce;
  amoOnda.ry = amoOnda.rx * AGUA_ONDA_RY;
  amoOnda.alfa = fade * 0.42;
  return amoOnda;
}

export function amostraPegada(p) {
  const t = p.dur > 0 ? p.idade / p.dur : 1;
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  let k = 1;
  if (u > AGUA_PEGADA_CHEIO) {
    const w = (u - AGUA_PEGADA_CHEIO) / (1 - AGUA_PEGADA_CHEIO);
    const ease = 1 - (1 - w) * (1 - w) * (1 - w);
    k = 1 - ease;
  }
  return p.alfa0 * (k > 0 ? k : 0);
}

export function amostraGota(g) {
  const t = g.dur > 0 ? g.idade / g.dur : 1;
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const fade = (1 - u) * (1 - u);
  amoGota.alfa = 0.72 * fade;
  amoGota.tam = g.tam;
  return amoGota;
}

function soltarIndice(trilha, idx) {
  if (!trilha) return;
  for (let i = 0; i < 3; i++) {
    if (trilha.oi[i] !== idx) continue;
    trilha.oi[i] = -1;
    trilha.nOnda = trilha.nOnda > 0 ? trilha.nOnda - 1 : 0;
    return;
  }
}

function matarOndas(trilha) {
  for (let i = 0; i < 3; i++) {
    const j = trilha.oi[i];
    if (j < 0) continue;
    const o = ondas[j];
    o.viva = false;
    o.trilha = null;
    trilha.oi[i] = -1;
  }
  trilha.nOnda = 0;
}

function pegarVaga(pool, cursor) {
  const n = pool.length;
  let c = cursor.i;
  for (let k = 0; k < n; k++) {
    const i = (c + k) % n;
    if (!pool[i].viva) {
      cursor.i = (i + 1) % n;
      return pool[i];
    }
  }
  let velha = pool[0];
  for (let i = 1; i < n; i++) {
    if (pool[i].idade > velha.idade) velha = pool[i];
  }
  cursor.i = (c + 1) % n;
  return velha;
}

const cursorOnda = { i: 0 };
const cursorGota = { i: 0 };
const cursorPegada = { i: 0 };

function pegarOnda() {
  const o = pegarVaga(ondas, cursorOnda);
  if (o.trilha) soltarIndice(o.trilha, o.idx);
  o.trilha = null;
  o.viva = false;
  return o;
}

function emitirOnda(trilha, x, y, z) {
  let o = null;
  if (trilha.nOnda >= 3) {
    let melhor = -1;
    let idade = -1;
    for (let i = 0; i < 3; i++) {
      const j = trilha.oi[i];
      if (j < 0) continue;
      if (ondas[j].idade >= idade) {
        idade = ondas[j].idade;
        melhor = i;
      }
    }
    if (melhor < 0) return;
    o = ondas[trilha.oi[melhor]];
  } else {
    o = pegarOnda();
    let slot = -1;
    for (let i = 0; i < 3; i++) {
      if (trilha.oi[i] < 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) slot = 0;
    if (trilha.oi[slot] >= 0) soltarIndice(trilha, trilha.oi[slot]);
    trilha.oi[slot] = o.idx;
    trilha.nOnda += 1;
  }
  o.viva = true;
  o.trilha = trilha;
  o.x = x;
  o.y = y;
  o.z = z;
  o.idade = 0;
  o.dur = AGUA_ONDA_VIDA;
}

function soltarGota(e, forte) {
  const g = pegarVaga(gotas, cursorGota);
  const elev = e.elevacao ?? e.z ?? 0;
  g.viva = true;
  g.x = e.x + (Math.random() - 0.5) * (forte ? 0.4 : 0.18);
  g.y = e.y + (Math.random() - 0.5) * (forte ? 0.4 : 0.18);
  g.chao = e.z ?? elev;
  g.z = elev + (forte ? 0.2 : 0.85);
  g.vx = (Math.random() - 0.5) * (forte ? 1.6 : 0.35);
  g.vy = (Math.random() - 0.5) * (forte ? 1.6 : 0.35);
  g.vz = (forte ? 2.4 : 1.15) * (0.85 + Math.random() * 0.3);
  g.idade = 0;
  g.dur = AGUA_GOTA_VIDA * (0.82 + Math.random() * 0.35);
  g.tam = forte ? 0.22 : 0.14;
}

function soltarRajada(e, vel) {
  const n = vel >= VEL_CORRIDA ? AGUA_GOTA_RAJADA + 2 : AGUA_GOTA_RAJADA;
  for (let i = 0; i < n; i++) soltarGota(e, true);
}

function soltarPegada(e, trilha, dx, dy, dist, vel) {
  const p = pegarVaga(pegadas, cursorPegada);
  const len = dist > 1e-5 ? dist : 1;
  const nx = -dy / len;
  const ny = dx / len;
  const lado = trilha.esq ? 1 : -1;
  const off = AGUA_PEGADA_LATERAL * lado;
  const corre = vel >= VEL_CORRIDA;
  const tam = AGUA_PEGADA_TAM * (corre ? 1.18 : 1);
  p.viva = true;
  p.x = e.x + nx * off;
  p.y = e.y + ny * off;
  p.z = e.z ?? e.elevacao ?? 0;
  p.ang = Math.atan2(dy, dx);
  p.sx = tam * 1.15;
  p.sy = tam * 0.55;
  p.idade = 0;
  p.dur = AGUA_PEGADA_VIDA;
  p.alfa0 = (corre ? 0.56 : 0.5);
}

function emitirOndaSe(trilha, e, dx, dy, dist, col, elev, dt) {
  trilha.cdOnda -= dt;
  const anda = dist >= AGUA_ONDA_PASSO;
  if (trilha.cdOnda > 0) return;
  trilha.cdOnda = anda ? AGUA_ONDA_INTERVALO : AGUA_ONDA_INTERVALO_PARADO;
  let x = e.x;
  let y = e.y;
  if (anda && dist > 1e-5) {
    x -= (dx / dist) * AGUA_ONDA_ATRAS;
    y -= (dy / dist) * AGUA_ONDA_ATRAS;
  }
  const z = col.caindo ? elev : col.superficie - AGUA_OFFSET_LAMINA;
  emitirOnda(trilha, x, y, z > 0 ? z : elev);
}

function tentarPegada(trilha, e, dx, dy, dist, vel, dt) {
  if (trilha.carga <= 0) return;
  if (e.pulando || e.nadando || e.noChao === false) return;
  trilha.cdPasso -= dt;
  if (vel < AGUA_PEGADA_VEL) return;
  trilha.acum += dist;
  if (trilha.acum < AGUA_PEGADA_DIST || trilha.cdPasso > 0) return;
  trilha.acum = 0;
  trilha.cdPasso = AGUA_PEGADA_INTERVALO;
  trilha.carga -= 1;
  trilha.esq = trilha.esq ? 0 : 1;
  soltarPegada(e, trilha, dx, dy, dist, vel);
}

function tentar(e, dt) {
  if (!e || e.morto || e.capturado) return;
  const elev = e.elevacao ?? e.z ?? 0;
  const col = colunaAgua(e.x, e.y);
  const imersao = col.superficie > 0 ? Math.max(0, col.superficie - elev) : 0;
  const fora = e.voando || e.planando || e.escalando;
  const naAgua = !fora && (!!e.nadando || imersao >= AGUA_IMERSAO_MIN);

  let trilha = rastros.get(e);
  if (!trilha) {
    trilha = criarTrilha();
    trilha.x = e.x;
    trilha.y = e.y;
    trilha.imerso = naAgua;
    trilha.carga = naAgua ? AGUA_PEGADA_CARGA : 0;
    rastros.set(e, trilha);
    return;
  }

  const dx = e.x - trilha.x;
  const dy = e.y - trilha.y;
  const dist = Math.hypot(dx, dy);
  const vel = dt > 0 ? dist / dt : 0;
  trilha.x = e.x;
  trilha.y = e.y;

  if (vel > VEL_TELEPORTE) {
    trilha.imerso = naAgua;
    trilha.acum = 0;
    return;
  }

  if (trilha.imerso && !naAgua) {
    matarOndas(trilha);
    soltarRajada(e, vel);
    trilha.molha = AGUA_MOLHA_SEG;
    trilha.pinga = AGUA_GOTA_PINGA * 0.5;
  }

  if (naAgua) {
    trilha.carga = AGUA_PEGADA_CARGA;
    trilha.molha = 0;
    trilha.acum = 0;
    emitirOndaSe(trilha, e, dx, dy, dist, col, elev, dt);
  } else {
    if (trilha.molha > 0) {
      trilha.molha -= dt;
      trilha.pinga -= dt;
      if (trilha.pinga <= 0 && trilha.molha > 0) {
        trilha.pinga = AGUA_GOTA_PINGA;
        soltarGota(e, false);
      }
    }
    tentarPegada(trilha, e, dx, dy, dist, vel, dt);
  }

  trilha.imerso = naAgua;
}

function envelhecer(dt) {
  for (let i = 0; i < CAP_ONDA; i++) {
    const o = ondas[i];
    if (!o.viva) continue;
    o.idade += dt;
    if (o.idade < o.dur) continue;
    o.viva = false;
    soltarIndice(o.trilha, o.idx);
    o.trilha = null;
  }
  for (let i = 0; i < CAP_GOTA; i++) {
    const g = gotas[i];
    if (!g.viva) continue;
    g.idade += dt;
    g.vz -= AGUA_GOTA_GRAV * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.z += g.vz * dt;
    if (g.idade >= g.dur || g.z <= g.chao) g.viva = false;
  }
  for (let i = 0; i < CAP_PEGADA; i++) {
    const p = pegadas[i];
    if (!p.viva) continue;
    p.idade += dt;
    if (p.idade >= p.dur) p.viva = false;
  }
}

export function tickFxAgua(dt, corpo, agente) {
  const passo = dt > 0 ? dt : 0;
  tempo += passo;
  envelhecer(passo);
  if (!(passo > 0) || estado.interior) return;

  fila.length = 0;
  if (corpo) fila.push(corpo);
  if (agente && agente !== corpo) fila.push(agente);
  const px = corpo?.x ?? 0;
  const py = corpo?.y ?? 0;
  const atores = atoresVisiveis();
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    if (a === corpo || a === agente) continue;
    const dx = a.x - px;
    const dy = a.y - py;
    if (dx * dx + dy * dy > PERTO2) continue;
    fila.push(a);
  }
  for (let i = 0; i < fila.length; i++) tentar(fila[i], passo);
}
