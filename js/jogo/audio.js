/** Trilha, chuva e trovão. Os arquivos ficam no Pokemon AI e saem por /ref/music. */

import {
  anexarContexto,
  definirMudoBarramento,
  destravarBarramento,
} from "./som/barramento.js";

const REF = "/ref/music/";
const VOL_BGM = 0.34;
const VOL_CAMADA = 0.28;

const TRILHAS = {
  campo: [
    "BGM/pool/Pokemon HeartGold and SoulSilver - Route 29.mp3",
    "BGM/pool/Pokemon Diamond and Pearl - Route 201 (Day).mp3",
    "BGM/pool/Green Plains Journey - Plains Day A.mp3",
  ],
  cidade: [
    "BGM/pool/Pokemon Diamond and Pearl - Canalave City (Day).mp3",
    "BGM/pool/Pokemon Diamond and Pearl - Twinleaf Town (Day).mp3",
    "BGM/1-06. Pallet Town.mp3",
  ],
  chuva: [
    "BGM/generated/Heavy Rain.mp3",
    "BGM/pool/Pokemon Omega Ruby and Alpha Sapphire - Heavy Rain.mp3",
  ],
  "hub.center": [
    "BGM/pool/Pokemon Red Green Blue Yellow - Pokémon Center.mp3",
    "BGM/pool/Pokemon HeartGold and SoulSilver - Pokémon Center.mp3",
    "BGM/pool/Pokemon Black and White - Pokemon Center.mp3",
  ],
  "hub.mart": [
    "BGM/pool/Pokemon HeartGold and SoulSilver - Poké Mart.mp3",
    "BGM/pool/Pokemon Omega Ruby and Alpha Sapphire - Poke Mart.mp3",
  ],
  "hub.house": ["BGM/1-06. Pallet Town.mp3"],
};

const CAMADAS = {
  drips: "BGS/drips.ogg",
  rain: "BGS/rain.ogg",
  storm: "BGS/storm.ogg",
};

const TROVAO = {
  perto: ["SFX/weather/nearby-lightning-a.mp3", "SFX/weather/nearby-lightning-b.mp3"],
  longe: ["SFX/weather/far-away-lightning.mp3"],
};

const SOM_ENVIO = "SFX/party/pkmn-out-of-pokeball.wav";
const SOM_RECOLHER = "SFX/party/recall.wav";
const SOM_SHINY = "SFX/party/shiny.wav";
const ESPERA_SHINY = 220;

const CHAVE_MUDO = "som-mudo";

function lerMudoSalvo() {
  try {
    return localStorage.getItem(CHAVE_MUDO) === "1";
  } catch {
    return false;
  }
}

function gravarMudo(valor) {
  try {
    localStorage.setItem(CHAVE_MUDO, valor ? "1" : "0");
  } catch {
    /* navegador sem armazenamento */
  }
}

let ctx = null;
let mudo = lerMudoSalvo();
let liberado = false;
let abaixaBgm = 0;
let ultimoShiny = 0;
const stings = new Map();
/** @type {Array<() => void>} */
const aoLiberar = [];

const PPQ_CURA = 120;
const TEMPO_CURA = 454545 / 1e6;
const NOTAS_CURA = Object.freeze([
  [0, 28, 76, 100],
  [0, 58, 83, 100],
  [60, 13, 88, 100],
  [60, 28, 68, 100],
  [60, 28, 83, 50],
  [60, 28, 76, 30],
  [90, 13, 88, 30],
  [120, 13, 88, 100],
  [120, 28, 68, 30],
  [120, 28, 76, 100],
  [120, 58, 83, 100],
  [150, 13, 88, 30],
  [180, 13, 76, 100],
  [180, 28, 68, 100],
  [180, 28, 83, 50],
  [180, 28, 76, 30],
  [210, 13, 76, 30],
  [240, 28, 68, 30],
  [240, 28, 76, 100],
  [240, 58, 83, 100],
  [300, 28, 68, 100],
  [300, 28, 76, 30],
  [300, 58, 80, 100],
  [360, 13, 88, 100],
  [360, 28, 64, 100],
  [360, 28, 83, 100],
  [360, 58, 88, 100],
  [390, 13, 88, 30],
  [420, 28, 64, 30],
  [420, 28, 88, 50],
  [420, 28, 83, 30],
  [480, 13, 88, 90],
  [510, 13, 88, 25],
]);
let chaveAtual = "";
/** @type {{ el: HTMLAudioElement, vol: number, alvo: number, chave: string } | null} */
let voz = null;
/** @type {{ el: HTMLAudioElement, vol: number, alvo: number } | null} */
let saindo = null;
/** @type {Map<string, { el: HTMLAudioElement, vol: number, alvo: number }>} */
const camadas = new Map();
/** @type {Map<string, number>} */
const cursor = new Map();

function audio() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

function urlRef(rel) {
  return REF + rel.split("/").map(encodeURIComponent).join("/");
}

function limitar01(n) {
  return Math.max(0, Math.min(1, n || 0));
}

function aproximar(atual, alvo, dt, vel) {
  const d = vel * dt;
  if (Math.abs(alvo - atual) <= d) return alvo;
  return atual + Math.sign(alvo - atual) * d;
}

function criarEl(rel, loop) {
  const el = new Audio(urlRef(rel));
  el.preload = "auto";
  el.loop = loop;
  el.volume = 0;
  return el;
}

function escolher(chave) {
  const pool = TRILHAS[chave];
  if (!pool?.length) return null;
  const i = cursor.has(chave) ? cursor.get(chave) : -1;
  const n = (i + 1) % pool.length;
  cursor.set(chave, n);
  return pool[n];
}

function garantirToco(el) {
  if (!liberado || mudo || !el.paused) return;
  el.play().catch(() => {});
}

function aplicarVolume(slot, dt, entra) {
  const vel = slot.alvo > slot.vol ? entra : 1.8;
  slot.vol = aproximar(slot.vol, mudo ? 0 : slot.alvo, dt, vel);
  slot.el.volume = Math.max(0, Math.min(1, slot.vol));
  if (slot.vol > 0.012) garantirToco(slot.el);
  else if (slot.alvo <= 0 && !slot.el.paused) slot.el.pause();
}

function alvosChuva(chuva, dentro) {
  if (dentro) return { drips: 0, rain: 0, storm: 0 };
  const c = limitar01(chuva);
  const drips = limitar01(c / 0.32) * (1 - limitar01((c - 0.28) / 0.42));
  const chuvaCheia = limitar01((c - 0.18) / 0.45);
  const tempestade = limitar01((c - 0.52) / 0.48);
  return {
    drips: drips * 0.75 * VOL_CAMADA,
    rain: chuvaCheia * 0.9 * (1 - tempestade * 0.35) * VOL_CAMADA,
    storm: tempestade * 0.95 * VOL_CAMADA,
  };
}

function cama(id) {
  let slot = camadas.get(id);
  if (slot) return slot;
  slot = { el: criarEl(CAMADAS[id], true), vol: 0, alvo: 0 };
  camadas.set(id, slot);
  return slot;
}

function elementoDe(mapa, rel) {
  let el = mapa.get(rel);
  if (el) return el;
  el = new Audio(urlRef(rel));
  el.preload = "auto";
  mapa.set(rel, el);
  return el;
}

function tocarCurto(el, volume) {
  if (!el || !liberado || mudo) return;
  el.volume = volume;
  try {
    el.currentTime = 0;
  } catch {
    /* ainda não tem duração */
  }
  el.play().catch(() => {});
}

function calarCurtos() {
  for (const el of stings.values()) el.pause();
}

function avisarLiberou() {
  for (let i = 0; i < aoLiberar.length; i++) aoLiberar[i]();
}

/** O contexto único. O barramento de one-shots pendura o ganho mestre aqui. */
export function contextoAudio() {
  return audio();
}

export function somLiberado() {
  return liberado;
}

/** Roda no desbloqueio e na hora, se o áudio já estiver liberado. */
export function aoLiberarSom(fn) {
  aoLiberar.push(fn);
  if (liberado) fn();
}

export function destravarAudio() {
  liberado = true;
  const ac = audio();
  if (ac && ac.state === "suspended") ac.resume();
  anexarContexto(ac);
  definirMudoBarramento(mudo);
  destravarBarramento();
  if (voz) garantirToco(voz.el);
  for (const slot of camadas.values()) {
    if (slot.alvo > 0.012) garantirToco(slot.el);
  }
  elementoDe(stings, SOM_ENVIO);
  elementoDe(stings, SOM_RECOLHER);
  elementoDe(stings, SOM_SHINY);
  avisarLiberou();
}

export function tocarEnvioBola() {
  tocarCurto(elementoDe(stings, SOM_ENVIO), 0.92);
}

export function tocarRecolherBola() {
  tocarCurto(elementoDe(stings, SOM_RECOLHER), 0.92);
}

export function tocarShiny() {
  const agora = performance.now();
  if (agora - ultimoShiny < ESPERA_SHINY) return;
  ultimoShiny = agora;
  tocarCurto(elementoDe(stings, SOM_SHINY), 0.95);
}

export function definirBgm(chave) {
  const proxima = TRILHAS[chave] ? chave : "campo";
  if (proxima === chaveAtual && voz) return;
  chaveAtual = proxima;
  if (saindo && saindo !== voz) {
    saindo.el.pause();
    saindo.el.src = "";
  }
  if (voz) {
    voz.alvo = 0;
    saindo = voz;
  }
  const arquivo = escolher(proxima);
  if (!arquivo) {
    voz = null;
    return;
  }
  const el = criarEl(arquivo, true);
  voz = { el, vol: 0, alvo: VOL_BGM, chave: proxima };
  if (liberado) garantirToco(el);
}

export function chaveBgm(zona, clima, interiorKind) {
  if (interiorKind === "heal") return "hub.center";
  if (interiorKind === "mart") return "hub.mart";
  if (interiorKind === "house") return "hub.house";
  if (clima && clima !== "limpo") return "chuva";
  if (zona?.tipo === "cidade") return "cidade";
  return "campo";
}

/** Segue a chuva já misturada no céu. Dentro de casa o leito some. */
export function atualizarAudio(dt, mix, dentro) {
  const passo = Math.min(Math.max(dt || 0, 0), 0.05);
  const alvos = alvosChuva(mix?.chuva, dentro);
  for (const id of Object.keys(CAMADAS)) {
    const slot = cama(id);
    slot.alvo = alvos[id] || 0;
    aplicarVolume(slot, passo, 0.9);
  }
  if (abaixaBgm > 0) abaixaBgm = Math.max(0, abaixaBgm - passo);
  if (voz) {
    voz.alvo = mudo ? 0 : VOL_BGM * (abaixaBgm > 0 ? 0.22 : 1);
    aplicarVolume(voz, passo, 0.7);
  }
  if (saindo) {
    saindo.alvo = 0;
    aplicarVolume(saindo, passo, 1.6);
    if (saindo.vol <= 0.012) {
      saindo.el.pause();
      saindo.el.src = "";
      if (saindo !== voz) saindo = null;
    }
  }
}

/** perto = raio no chão. longe = o eco. */
export function tocarTrovao(qual) {
  if (!liberado || mudo) return;
  const lista = qual === "longe" ? TROVAO.longe : TROVAO.perto;
  const arquivo = lista[(Math.random() * lista.length) | 0];
  const el = new Audio(urlRef(arquivo));
  el.volume = qual === "longe" ? 0.55 : 0.86;
  el.play().catch(() => {});
}

function tickCura(tick) {
  return (tick * TEMPO_CURA) / PPQ_CURA;
}

function notaCura(ac, quando, nota) {
  const freq = 440 * 2 ** ((nota[2] - 69) / 12);
  const dur = Math.max(0.018, tickCura(nota[1]));
  const pico = 0.72 * Math.max(0, Math.min(1, nota[3] / 127)) * 0.22;
  const osc = ac.createOscillator();
  const ganho = ac.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, quando);
  const t1 = quando + Math.min(0.012, dur * 0.2);
  const t2 = quando + dur * 0.55;
  const t3 = quando + dur;
  ganho.gain.setValueAtTime(0.0001, quando);
  ganho.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t1);
  ganho.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico * 0.45), t2);
  ganho.gain.exponentialRampToValueAtTime(0.0001, t3);
  osc.connect(ganho);
  ganho.connect(ac.destination);
  osc.start(quando);
  osc.stop(t3 + 0.02);
}

/** Jingle da máquina do Centro. Abaixa a trilha enquanto toca. */
export function tocarCuraCentro() {
  const ac = audio();
  if (!ac || mudo) return;
  const soltar = () => {
    const t0 = ac.currentTime + 0.02;
    for (let i = 0; i < NOTAS_CURA.length; i++) notaCura(ac, t0 + tickCura(NOTAS_CURA[i][0]), NOTAS_CURA[i]);
    abaixaBgm = Math.max(abaixaBgm, tickCura(523) + 0.35);
  };
  if (ac.state === "suspended") ac.resume().then(soltar).catch(() => {});
  else soltar();
}

export function sfx(tipo) {
  const ac = audio();
  if (!ac || mudo) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g);
  g.connect(ac.destination);
  const agora = ac.currentTime;
  if (tipo === "porta") o.frequency.setValueAtTime(520, agora);
  else if (tipo === "cura") o.frequency.setValueAtTime(660, agora);
  else if (tipo === "cavar") o.frequency.setValueAtTime(140, agora);
  else if (tipo === "colher") o.frequency.setValueAtTime(780, agora);
  else o.frequency.setValueAtTime(440, agora);
  g.gain.setValueAtTime(0.04, agora);
  g.gain.exponentialRampToValueAtTime(0.001, agora + 0.12);
  o.start(agora);
  o.stop(agora + 0.14);
}

export function estaMudo() {
  return mudo;
}

export function alternarMudo() {
  mudo = !mudo;
  gravarMudo(mudo);
  definirMudoBarramento(mudo);
  if (mudo) {
    voz?.el.pause();
    saindo?.el.pause();
    for (const slot of camadas.values()) slot.el.pause();
    calarCurtos();
  } else {
    destravarAudio();
  }
  return mudo;
}
