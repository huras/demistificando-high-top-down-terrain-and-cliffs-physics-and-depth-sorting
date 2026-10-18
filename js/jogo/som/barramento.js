/**
 * One-shots em Web Audio, no mesmo AudioContext da trilha.
 * O quadro que pede o som não decodifica: a fila aquece no máximo dois de cada vez.
 * Gritos em SFX/cries/ ficam num LRU. Vozes 3D saem de uma piscina fixa.
 */

const REF = "/ref/music/";
const GANHO_MESTRE = 0.72;
const DECODES = 2;
const CAP_GRITO = 48;
const CAP_VOZ = 12;
const TTL_FRIO = 2.5;
const TTL_IMPORTANTE = 1.5;

const SONS = {
  passo: "SFX/steps/foot-floor.wav",
  grama: "SFX/world/passing-through-grass.wav",
  pulo: "SFX/world/jump.wav",
  puloAguaSai: "SFX/world/emerald_00D7-jumping-out-of-water.wav",
  puloAguaEntra: "SFX/world/emerald_00D8-jumping-in-water.wav",
};

const GANHO = {
  passo: 1.7,
  grama: 1.15,
  pulo: 1.05,
  puloAguaSai: 1.05,
  puloAguaEntra: 1.05,
};

/** @type {AudioContext | null} */
let ctx = null;
/** @type {GainNode | null} */
let mestre = null;
let aberto = false;
let mudo = false;

/** @type {Map<string, AudioBuffer>} */
const buffers = new Map();
/** @type {Map<string, Promise<AudioBuffer | null>>} */
const carregando = new Map();
/** @type {Set<string>} */
const falhou = new Set();
/** @type {Map<string, true>} */
const lruGrito = new Map();
/** @type {string[]} */
const fila = [];
/** @type {Set<string>} */
const naFila = new Set();
let emVoo = 0;

/**
 * No máximo um pedido adiado por caminho.
 * @type {Map<string, { em: boolean, opts: object, expira: number }>}
 */
const adiados = new Map();

/** @type {{ panner: PannerNode, ganho: GainNode, ocupado: boolean }[]} */
const vozes = [];

let ouvinteX = 0;
let ouvinteY = 0;

function urlDe(rel) {
  return REF + String(rel).split("/").map(encodeURIComponent).join("/");
}

function ehGrito(rel) {
  return String(rel).includes("/cries/");
}

function limitar(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function aplicarMestre() {
  if (!mestre || !ctx) return;
  const v = mudo || !aberto ? 0 : GANHO_MESTRE;
  mestre.gain.setValueAtTime(v, ctx.currentTime);
}

function tocarLru(rel) {
  if (!ehGrito(rel) || !buffers.has(rel)) return;
  lruGrito.delete(rel);
  lruGrito.set(rel, true);
}

function guardar(rel, buf) {
  buffers.set(rel, buf);
  if (!ehGrito(rel)) return;
  lruGrito.delete(rel);
  lruGrito.set(rel, true);
  while (lruGrito.size > CAP_GRITO) {
    const velho = lruGrito.keys().next().value;
    if (velho == null) break;
    lruGrito.delete(velho);
    buffers.delete(velho);
  }
}

function ceder() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function carregar(rel) {
  if (buffers.has(rel)) {
    tocarLru(rel);
    return buffers.get(rel);
  }
  if (falhou.has(rel)) return null;
  if (carregando.has(rel)) return carregando.get(rel);
  const ac = ctx;
  if (!ac) return null;

  const pedido = (async () => {
    try {
      const res = await fetch(urlDe(rel));
      if (!res.ok) throw new Error("sem arquivo");
      const cru = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(cru.slice(0));
      guardar(rel, buf);
      await ceder();
      return buf;
    } catch {
      falhou.add(rel);
      return null;
    } finally {
      carregando.delete(rel);
    }
  })();
  carregando.set(rel, pedido);
  return pedido;
}

function soltarAdiado(rel) {
  const row = adiados.get(rel);
  if (!row) return;
  adiados.delete(rel);
  if (performance.now() > row.expira) return;
  if (!buffers.has(rel)) return;
  if (row.em) tocarRelEm(rel, row.opts);
  else tocarRel(rel, row.opts);
}

function bombear() {
  if (!aberto || !ctx) return;
  while (emVoo < DECODES && fila.length) {
    const rel = fila.shift();
    naFila.delete(rel);
    if (!rel || buffers.has(rel) || falhou.has(rel)) {
      soltarAdiado(rel);
      continue;
    }
    emVoo++;
    const pronto = carregando.has(rel) ? carregando.get(rel) : carregar(rel);
    pronto.finally(() => {
      emVoo--;
      soltarAdiado(rel);
      bombear();
    });
  }
}

function aquecerRel(rel) {
  if (!rel || falhou.has(rel)) return false;
  if (buffers.has(rel)) {
    tocarLru(rel);
    return true;
  }
  if (carregando.has(rel) || naFila.has(rel)) return true;
  naFila.add(rel);
  fila.push(rel);
  if (aberto) bombear();
  return true;
}

function adiar(rel, em, opts) {
  const ttl = opts.importante ? TTL_IMPORTANTE : TTL_FRIO;
  const pedido = Number(opts.espera);
  const seg = Number.isFinite(pedido) && pedido > 0 ? pedido : ttl;
  adiados.set(rel, {
    em,
    opts: { ...opts, exigirQuente: true, adiarFrio: false },
    expira: performance.now() + seg * 1000,
  });
  aquecerRel(rel);
}

function garantirVozes() {
  const ac = ctx;
  if (!ac || !mestre) return;
  while (vozes.length < CAP_VOZ) {
    const panner = ac.createPanner();
    panner.panningModel = "equalpower";
    panner.distanceModel = "inverse";
    panner.refDistance = 1.8;
    panner.maxDistance = 20;
    panner.rolloffFactor = 1.2;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    const ganho = ac.createGain();
    panner.connect(ganho);
    ganho.connect(mestre);
    vozes.push({ panner, ganho, ocupado: false });
  }
}

function pegarVoz() {
  for (let i = 0; i < vozes.length; i++) {
    if (!vozes[i].ocupado) {
      vozes[i].ocupado = true;
      return vozes[i];
    }
  }
  return null;
}

function porPanner(panner, x, y) {
  const ac = ctx;
  if (!ac) return;
  const t = ac.currentTime;
  if (panner.positionX) {
    panner.positionX.setValueAtTime(x, t);
    panner.positionY.setValueAtTime(0, t);
    panner.positionZ.setValueAtTime(y, t);
  } else if (panner.setPosition) {
    panner.setPosition(x, 0, y);
  }
}

function taxaDe(opts) {
  const rate = Number(opts.rate);
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return limitar(rate, 0.25, 4);
}

function volumeDe(opts) {
  return limitar(opts.volume ?? 1, 0, 2.5);
}

function podeTocar() {
  if (!aberto || mudo || !ctx || !mestre) return false;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return true;
}

function comecarEstereo(rel, buf, opts) {
  const ac = ctx;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const rate = taxaDe(opts);
  src.playbackRate.value = rate;
  const ganho = ac.createGain();
  ganho.gain.value = volumeDe(opts);
  src.connect(ganho);
  let cauda = ganho;
  const pan = Number(opts.pan);
  if (Number.isFinite(pan) && pan !== 0 && typeof ac.createStereoPanner === "function") {
    const est = ac.createStereoPanner();
    est.pan.value = limitar(pan, -1, 1);
    ganho.connect(est);
    cauda = est;
  }
  cauda.connect(mestre);
  tocarLru(rel);
  try {
    src.start(0);
  } catch {
    return;
  }
  src.onended = () => {
    try {
      src.disconnect();
      ganho.disconnect();
      if (cauda !== ganho) cauda.disconnect();
    } catch {
      /* fonte já solta */
    }
  };
}

function comecarEspacial(rel, buf, voz, opts) {
  const ac = ctx;
  const dx = opts.x - ouvinteX;
  const dy = opts.y - ouvinteY;
  const dist = Math.hypot(dx, dy);
  const alcance = Number(opts.alcance);
  const range = Number.isFinite(alcance) && alcance > 0 ? alcance : 20;
  const { panner, ganho } = voz;
  panner.panningModel = opts.hrtf ? "HRTF" : "equalpower";
  const linear = opts.modelo === "linear";
  const refD = Number(opts.refDistance);
  const roll = Number(opts.rolloff);
  const ref = Number.isFinite(refD) && refD > 0 ? refD : 1.8;
  const rollK = Number.isFinite(roll) && roll >= 0 ? roll : 1.2;
  const espalha = Number(opts.espalha);
  const panK = Number.isFinite(espalha) && espalha >= 0 ? Math.min(1, espalha) : 1;
  porPanner(panner, ouvinteX + dx * panK, ouvinteY + dy * panK);

  let distGain = 1;
  if (linear) {
    panner.distanceModel = "linear";
    panner.refDistance = 1;
    panner.maxDistance = 1e5;
    panner.rolloffFactor = 0;
    if (dist > ref) {
      distGain = Math.max(0, 1 - rollK * ((dist - ref) / Math.max(1e-4, range - ref)));
    }
  } else {
    panner.distanceModel = "inverse";
    panner.refDistance = ref;
    panner.maxDistance = range;
    panner.rolloffFactor = rollK;
  }

  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = taxaDe(opts);
  ganho.gain.setValueAtTime(volumeDe({ volume: (opts.volume ?? 1) * distGain }), ac.currentTime);
  src.connect(panner);
  tocarLru(rel);
  try {
    src.start(0);
  } catch {
    voz.ocupado = false;
    try {
      src.disconnect();
    } catch {
      /* ignore */
    }
    return;
  }
  src.onended = () => {
    try {
      src.disconnect();
    } catch {
      /* ignore */
    }
    voz.ocupado = false;
  };
}

function resolverFrio(rel, em, opts) {
  if (opts.exigirQuente) {
    if (opts.adiarFrio || opts.importante) adiar(rel, em, opts);
    else aquecerRel(rel);
    return false;
  }
  adiar(rel, em, opts);
  return false;
}

export function anexarContexto(ac) {
  if (!ac || ctx === ac) return;
  ctx = ac;
  mestre = ac.createGain();
  mestre.connect(ac.destination);
  aplicarMestre();
}

export function destravarBarramento() {
  aberto = true;
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  const ids = Object.keys(SONS);
  for (let i = 0; i < ids.length; i++) aquecerRel(SONS[ids[i]]);
  aplicarMestre();
  bombear();
}

export function definirMudoBarramento(ligado) {
  mudo = !!ligado;
  aplicarMestre();
}

export function definirOuvinte(x, y, fx = 0, fy = 1) {
  if (Number.isFinite(x)) ouvinteX = x;
  if (Number.isFinite(y)) ouvinteY = y;
  const ac = ctx;
  if (!ac) return;
  const len = Math.hypot(fx, fy) || 1;
  const ox = fx / len;
  const oz = fy / len;
  const listener = ac.listener;
  const t = ac.currentTime;
  if (listener.positionX) {
    listener.positionX.setValueAtTime(ouvinteX, t);
    listener.positionY.setValueAtTime(0, t);
    listener.positionZ.setValueAtTime(ouvinteY, t);
    listener.forwardX.setValueAtTime(ox, t);
    listener.forwardY.setValueAtTime(0, t);
    listener.forwardZ.setValueAtTime(oz, t);
    listener.upX.setValueAtTime(0, t);
    listener.upY.setValueAtTime(1, t);
    listener.upZ.setValueAtTime(0, t);
  } else if (listener.setPosition) {
    listener.setPosition(ouvinteX, 0, ouvinteY);
    listener.setOrientation(ox, 0, oz, 0, 1, 0);
  }
}

export function aquecerCaminho(rel) {
  return aquecerRel(rel);
}

export function estaQuente(rel) {
  return !!rel && buffers.has(rel);
}

export function tocarRel(rel, opts = {}) {
  if (!podeTocar() || !rel || falhou.has(rel)) return false;
  const buf = buffers.get(rel);
  if (buf) {
    comecarEstereo(rel, buf, opts);
    return true;
  }
  return resolverFrio(rel, false, opts);
}

export function tocarRelEm(rel, opts = {}) {
  if (!Number.isFinite(opts.x) || !Number.isFinite(opts.y)) return tocarRel(rel, opts);
  if (!podeTocar() || !rel || falhou.has(rel)) return false;
  const alcance = Number(opts.alcance);
  const range = Number.isFinite(alcance) && alcance > 0 ? alcance : 20;
  const dist = Math.hypot(opts.x - ouvinteX, opts.y - ouvinteY);
  if (dist > range) return false;
  const buf = buffers.get(rel);
  if (!buf) return resolverFrio(rel, true, opts);
  garantirVozes();
  const voz = pegarVoz();
  if (!voz) return false;
  comecarEspacial(rel, buf, voz, opts);
  return true;
}

export function tocar(id, opts = {}) {
  const rel = SONS[id];
  if (!rel) return false;
  const ganho = GANHO[id] ?? 1;
  return tocarRel(rel, { ...opts, volume: (opts.volume ?? 1) * ganho });
}

export function tocarEm(id, opts = {}) {
  const rel = SONS[id];
  if (!rel) return false;
  const ganho = GANHO[id] ?? 1;
  return tocarRelEm(rel, { ...opts, volume: (opts.volume ?? 1) * ganho });
}
