/** Trilha, chuva e trovão. Os arquivos ficam no Pokemon AI e saem por /ref/music. */

import {
  anexarContexto,
  definirMudoBarramento,
  destravarBarramento,
  tocar as tocarBarramento,
} from "./som/barramento.js";
import { criarBgm } from "./som/bgm.js";
import { criarEvolucaoAudio } from "./som/evolucaoAudio.js";
import { resolverChaveBgm } from "./som/resolverBgm.js";
import { TRILHAS_BGM } from "./som/trilhasBgm.js";

const REF = "/ref/music/";
const VOL_BGM = 0.34;
const VOL_CAMADA = 0.28;
/** Sobreposição (s) entre duas vozes — clips de chuva não são seamless. */
const SOBREPOR_BGS = 2.4;

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

const bgm = criarBgm({
  tracks: TRILHAS_BGM,
  masterVolume: VOL_BGM,
});

/** @type {{ mul: number, alvo: number, vel: number }} */
const bgsSuspend = { mul: 1, alvo: 1, vel: 2.5 };

const evolucaoAudio = criarEvolucaoAudio(
  {},
  {
    bgm,
    suspendBgs({ fadeOutSec } = {}) {
      bgsSuspend.alvo = 0;
      bgsSuspend.vel =
        Number.isFinite(fadeOutSec) && fadeOutSec > 0 ? 1 / fadeOutSec : 3;
    },
    resumeBgs({ fadeInSec } = {}) {
      bgsSuspend.alvo = 1;
      bgsSuspend.vel =
        Number.isFinite(fadeInSec) && fadeInSec > 0 ? 1 / fadeInSec : 1.2;
    },
  }
);

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

/**
 * @typedef {{
 *   els: [HTMLAudioElement, HTMLAudioElement],
 *   pesos: [number, number],
 *   lead: 0 | 1,
 *   cruzando: boolean,
 *   vol: number,
 *   alvo: number,
 * }} SlotBgs
 */
/** @type {Map<string, SlotBgs>} */
const camadas = new Map();

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

function criarEl(rel) {
  const el = new Audio(urlRef(rel));
  el.preload = "auto";
  el.loop = false;
  el.volume = 0;
  return el;
}

function garantirToco(el) {
  if (!liberado || mudo || !el.paused) return;
  el.play().catch(() => {});
}

function restanteAudio(el) {
  const d = el.duration;
  if (!Number.isFinite(d) || d <= 0) return Infinity;
  return Math.max(0, d - (el.currentTime || 0));
}

function janelaSobrepor(el) {
  const d = el.duration;
  if (!Number.isFinite(d) || d <= 0) return SOBREPOR_BGS;
  return Math.min(SOBREPOR_BGS, Math.max(0.35, d * 0.4));
}

function reiniciarVoz(el) {
  if (!liberado || mudo) return;
  try {
    el.currentTime = 0;
  } catch {
    /* ainda sem duração */
  }
  el.play().catch(() => {});
}

function pausarVoz(el) {
  if (!el.paused) el.pause();
  try {
    el.currentTime = 0;
  } catch {
    /* ignore */
  }
}

function resetarCamada(slot) {
  slot.cruzando = false;
  slot.pesos[0] = 1;
  slot.pesos[1] = 0;
  slot.lead = 0;
  pausarVoz(slot.els[0]);
  pausarVoz(slot.els[1]);
}

function finalizarCruzamento(slot) {
  const lead = slot.lead;
  const outro = /** @type {0 | 1} */ (1 - lead);
  slot.pesos[lead] = 0;
  slot.pesos[outro] = 1;
  pausarVoz(slot.els[lead]);
  slot.lead = outro;
  slot.cruzando = false;
}

function aplicarVolume(slot, dt, entra) {
  const vel = slot.alvo > slot.vol ? entra : 1.8;
  slot.vol = aproximar(slot.vol, mudo ? 0 : slot.alvo, dt, vel);

  if (slot.alvo <= 0 && slot.vol <= 0.012) {
    if (slot.els[0].paused && slot.els[1].paused && !slot.cruzando) {
      /* já quieto */
    } else {
      resetarCamada(slot);
    }
    slot.els[0].volume = 0;
    slot.els[1].volume = 0;
    return;
  }

  const lead = slot.lead;
  const outro = /** @type {0 | 1} */ (1 - lead);
  const elLead = slot.els[lead];
  const elOutro = slot.els[outro];

  if (slot.vol > 0.012 && elLead.paused && !slot.cruzando) {
    slot.pesos[lead] = 1;
    slot.pesos[outro] = 0;
    reiniciarVoz(elLead);
  }

  if (slot.vol > 0.012 && !slot.cruzando && !elLead.paused) {
    const rem = restanteAudio(elLead);
    const janela = janelaSobrepor(elLead);
    if (rem <= janela) {
      slot.cruzando = true;
      slot.pesos[outro] = 0;
      reiniciarVoz(elOutro);
    }
  }

  if (slot.cruzando) {
    const rem = restanteAudio(elLead);
    const janela = janelaSobrepor(elLead);
    let t = 1;
    if (janela > 0.05 && Number.isFinite(rem) && rem < Infinity) {
      t = 1 - Math.max(0, Math.min(1, rem / janela));
    }
    if (elLead.paused || elLead.ended) t = 1;
    slot.pesos[lead] = 1 - t;
    slot.pesos[outro] = t;
    if (t >= 0.999) finalizarCruzamento(slot);
  }

  for (let i = 0; i < 2; i++) {
    const v = Math.max(0, Math.min(1, slot.vol * slot.pesos[i]));
    slot.els[i].volume = v;
    if (v > 0.012) garantirToco(slot.els[i]);
  }
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
  const rel = CAMADAS[id];
  const a = criarEl(rel);
  const b = criarEl(rel);
  slot = {
    els: [a, b],
    pesos: [1, 0],
    lead: 0,
    cruzando: false,
    vol: 0,
    alvo: 0,
  };
  const aoAcabar = (qual) => () => {
    if (slot.lead !== qual) return;
    if (slot.cruzando) {
      finalizarCruzamento(slot);
      return;
    }
    if (slot.vol <= 0.012 && slot.alvo <= 0) return;
    const outro = /** @type {0 | 1} */ (1 - qual);
    slot.pesos[qual] = 0;
    slot.pesos[outro] = 1;
    slot.lead = outro;
    reiniciarVoz(slot.els[outro]);
  };
  a.addEventListener("ended", aoAcabar(0));
  b.addEventListener("ended", aoAcabar(1));
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
  bgm.unlock();
  bgm.setMuted(mudo);
  for (const slot of camadas.values()) {
    if (slot.alvo <= 0.012) continue;
    const lead = slot.els[slot.lead];
    if (slot.pesos[slot.lead] > 0.012) garantirToco(lead);
    const outro = /** @type {0 | 1} */ (1 - slot.lead);
    if (slot.cruzando && slot.pesos[outro] > 0.012) garantirToco(slot.els[outro]);
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

/** null = silêncio (fade-out). */
export function definirBgm(chave) {
  bgm.setTrack(chave == null || chave === "" ? null : chave);
}

export function temTrilha(chave) {
  return bgm.hasTrack(chave);
}

/**
 * Resolve + aplica a trilha do frame.
 * @param {object} ctx
 */
export function sincronizarBgm(ctx) {
  const chave = resolverChaveBgm({ ...ctx, bgm });
  definirBgm(chave);
  return chave;
}

/** Segue a chuva já misturada no céu. Dentro de casa o leito some. */
export function atualizarAudio(dt, mix, dentro) {
  const passo = Math.min(Math.max(dt || 0, 0), 0.05);
  if (bgsSuspend.mul !== bgsSuspend.alvo) {
    const step = passo * bgsSuspend.vel;
    if (bgsSuspend.mul < bgsSuspend.alvo) {
      bgsSuspend.mul = Math.min(bgsSuspend.alvo, bgsSuspend.mul + step);
    } else {
      bgsSuspend.mul = Math.max(bgsSuspend.alvo, bgsSuspend.mul - step);
    }
  }
  const alvos = alvosChuva(mix?.chuva, dentro);
  for (const id of Object.keys(CAMADAS)) {
    const slot = cama(id);
    slot.alvo = (alvos[id] || 0) * bgsSuspend.mul;
    aplicarVolume(slot, passo, 0.9);
  }
  if (abaixaBgm > 0) abaixaBgm = Math.max(0, abaixaBgm - passo);
  bgm.setDuck(abaixaBgm > 0 ? 0.22 : 1);
  bgm.update(passo);
}

export function iniciarAudioEvolucao() {
  evolucaoAudio.begin();
}

/** @param {{ cancelled?: boolean }} [opts] */
export function encerrarAudioEvolucao(opts = {}) {
  evolucaoAudio.end(opts);
}

export function audioEvolucaoAtivo() {
  return !!evolucaoAudio.active;
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
    for (let i = 0; i < NOTAS_CURA.length; i++) {
      notaCura(ac, t0 + tickCura(NOTAS_CURA[i][0]), NOTAS_CURA[i]);
    }
    abaixaBgm = Math.max(abaixaBgm, tickCura(523) + 0.35);
  };
  if (ac.state === "suspended") ac.resume().then(soltar).catch(() => {});
  else soltar();
}

/** Samples do barramento; bip só como fallback. */
export function sfx(tipo) {
  if (tipo === "item" || tipo === "colher") {
    tocarBarramento(tipo);
    return;
  }
  if (tipo === "porta") {
    tocarBarramento("porta");
    return;
  }
  if (tipo === "cura") {
    tocarBarramento("cura");
    return;
  }
  if (tipo === "cavar") {
    tocarBarramento("chopHit");
    return;
  }
  const ac = audio();
  if (!ac || mudo) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g);
  g.connect(ac.destination);
  const agora = ac.currentTime;
  o.frequency.setValueAtTime(440, agora);
  g.gain.setValueAtTime(0.04, agora);
  g.gain.exponentialRampToValueAtTime(0.001, agora + 0.12);
  o.start(agora);
  o.stop(agora + 0.14);
}

/** Obteve item / berry (carta ou toast). */
export function tocarPegarItem() {
  sfx("item");
}

export function estaMudo() {
  return mudo;
}

export function alternarMudo() {
  mudo = !mudo;
  gravarMudo(mudo);
  definirMudoBarramento(mudo);
  bgm.setMuted(mudo);
  if (mudo) {
    for (const slot of camadas.values()) {
      for (const el of slot.els) el.pause();
    }
    calarCurtos();
  } else {
    destravarAudio();
  }
  return mudo;
}
