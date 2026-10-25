/**
 * Barramento BGM: pool embaralhado, crossfade HTMLAudio streaming, rotação com silêncio.
 * Port enxuto de Pokemon AI biomeBgm.js — paths sob /ref/music.
 */

import { poolTrilhaBgm, temTrilhaBgm } from "./trilhasBgm.js";

const REF = "/ref/music/";

function limitar01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function misturar(a, b, t) {
  return a + (b - a) * t;
}

function normalizarPool(entry) {
  if (entry == null) return [];
  if (Array.isArray(entry)) return entry.map(String).filter(Boolean);
  return [String(entry)];
}

function embaralhar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function embaralharEvitandoInicio(pool, evitar) {
  embaralhar(pool);
  if (evitar && pool.length > 1 && pool[0] === evitar) {
    const j = 1 + Math.floor(Math.random() * (pool.length - 1));
    const tmp = pool[0];
    pool[0] = pool[j];
    pool[j] = tmp;
  }
  return pool;
}

function urlRef(rel) {
  return REF + String(rel).split("/").map(encodeURIComponent).join("/");
}

/**
 * @param {object} [cfg]
 */
export function criarBgm(cfg = {}) {
  /** @type {Record<string, string[]>} */
  const tracks = { ...(cfg.tracks ?? {}) };
  let masterVol = limitar01(cfg.masterVolume ?? 0.34);
  let fadeInSpeed = Math.max(0.4, cfg.fadeSpeed ?? 0.8);
  let fadeOutSpeed = Math.max(fadeInSpeed, cfg.fadeOutSpeed ?? 3.6);
  let fadeOutOverride = 0;
  let enabled = cfg.enabled !== false;
  let muted = false;
  let unlocked = false;
  let disposed = false;
  let duckMul = 1;

  const silMinRaw = Number(cfg.rotationSilenceMinSec);
  const silMaxRaw = Number(cfg.rotationSilenceMaxSec);
  const silMin = Number.isFinite(silMinRaw) ? Math.max(0, silMinRaw) : 4;
  const silMax = Number.isFinite(silMaxRaw) ? Math.max(silMin, silMaxRaw) : 8;
  const fadeLeadRaw = Number(cfg.rotationFadeLeadSec);
  const fadeLeadRotacao = Number.isFinite(fadeLeadRaw)
    ? Math.max(0.4, fadeLeadRaw)
    : 2.4;

  let desiredKey = null;
  let silencioRestante = 0;
  /** @type {string | null} */
  let chaveSilencio = null;

  /** @type {Map<string, number>} */
  const cursorPorChave = new Map();
  /** @type {Map<string, string[]>} */
  const poolsEmbaralhados = new Map();

  for (const key of Object.keys(tracks)) {
    poolsEmbaralhados.set(key, embaralhar(normalizarPool(tracks[key]).slice()));
  }

  /**
   * @typedef {{
   *   key: string,
   *   file: string,
   *   el: HTMLAudioElement,
   *   level: number,
   *   target: number,
   *   rotacao: boolean,
   *   onEnded: (() => void) | null,
   *   onError: (() => void) | null,
   * }} Voice
   */

  /** @type {Voice[]} */
  const voices = [];

  function poolDaChave(key) {
    if (!poolsEmbaralhados.has(key) && temTrilhaBgm(key)) {
      poolsEmbaralhados.set(
        key,
        embaralhar(normalizarPool(poolTrilhaBgm(key)).slice())
      );
    }
    return poolsEmbaralhados.get(key) ?? [];
  }

  function temPool(key) {
    if (!key) return false;
    if (poolsEmbaralhados.has(key)) return poolsEmbaralhados.get(key).length > 0;
    return temTrilhaBgm(key);
  }

  function pegarProximoArquivo(key) {
    let pool = poolDaChave(key);
    if (!pool.length) return null;
    const prev = cursorPorChave.has(key) ? cursorPorChave.get(key) : -1;

    if (prev === pool.length - 1 && pool.length > 1) {
      const ultima = pool[prev];
      pool = embaralharEvitandoInicio(pool.slice(), ultima);
      poolsEmbaralhados.set(key, pool);
      cursorPorChave.set(key, 0);
      return pool[0];
    }

    const i = (prev + 1) % pool.length;
    cursorPorChave.set(key, i);
    return pool[i];
  }

  function restanteFaixa(el) {
    const d = el.duration;
    const t = el.currentTime;
    if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(t)) return null;
    return Math.max(0, d - t);
  }

  function cancelarSilencioRotacao() {
    silencioRestante = 0;
    chaveSilencio = null;
  }

  /** Hubs/santuario: sem gap longo entre faixas do pool. */
  function usaSilencioRotacao(key) {
    if (!key) return false;
    if (key.startsWith("hub.")) return false;
    if (key.startsWith("shrine.")) return false;
    if (key.startsWith("battle.") || key.startsWith("meet.") || key.startsWith("rest.")) {
      return false;
    }
    return true;
  }

  function iniciarSilencioRotacao(key) {
    if (!key || disposed || !enabled) return;
    if (desiredKey !== key) return;
    if (!usaSilencioRotacao(key)) return;
    if (silencioRestante > 0 && chaveSilencio === key) return;
    if (voices.some((v) => v.target > 0 && v.key === key)) return;
    chaveSilencio = key;
    silencioRestante = silMin + Math.random() * (silMax - silMin);
  }

  function aplicarVolumeVoz(voice) {
    const base = muted || !enabled ? 0 : masterVol * duckMul;
    voice.el.volume = limitar01(voice.level * base);
  }

  function tentarTocar(voice) {
    if (!unlocked || muted || !enabled) return;
    const p = voice.el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  function pararVoz(voice) {
    if (voice.onEnded) {
      try {
        voice.el.removeEventListener("ended", voice.onEnded);
      } catch {
        /* ignore */
      }
      voice.onEnded = null;
    }
    if (voice.onError) {
      try {
        voice.el.removeEventListener("error", voice.onError);
      } catch {
        /* ignore */
      }
      voice.onError = null;
    }
    try {
      voice.el.pause();
      voice.el.removeAttribute("src");
      voice.el.load();
    } catch {
      /* ignore */
    }
  }

  function encerrarVozes(predicado, imediato = false) {
    for (let i = voices.length - 1; i >= 0; i--) {
      const v = voices[i];
      if (!predicado(v)) continue;
      if (imediato) {
        pararVoz(v);
        voices.splice(i, 1);
      } else {
        v.target = 0;
      }
    }
  }

  function limitarVozes() {
    const ativas = voices.filter((v) => v.target > 0);
    for (let i = 0; i < ativas.length - 1; i++) ativas[i].target = 0;
    const saindo = voices.filter((v) => v.target === 0);
    for (let i = 0; i < saindo.length - 1; i++) {
      const v = saindo[i];
      pararVoz(v);
      const idx = voices.indexOf(v);
      if (idx >= 0) voices.splice(idx, 1);
    }
  }

  function avancarSeAindaNestaChave(key, endedVoice) {
    if (disposed || !enabled) return;
    if (desiredKey !== key) return;
    if (endedVoice && endedVoice.target === 0 && !endedVoice.rotacao) return;
    if (endedVoice && voices.includes(endedVoice)) {
      pararVoz(endedVoice);
      const idx = voices.indexOf(endedVoice);
      if (idx >= 0) voices.splice(idx, 1);
    }
    if (usaSilencioRotacao(key)) iniciarSilencioRotacao(key);
    else iniciarVoz(key);
  }

  function iniciarVoz(key, tentativas = 0) {
    const poolLen = poolDaChave(key).length;
    if (!poolLen) return;
    if (tentativas >= poolLen) return;

    const file = pegarProximoArquivo(key);
    if (!file) return;
    const el = new Audio(urlRef(file));
    el.loop = poolLen <= 1;
    el.preload = "auto";
    el.volume = 0;
    /** @type {Voice} */
    const voice = {
      key,
      file,
      el,
      level: 0,
      target: 1,
      rotacao: false,
      onEnded: null,
      onError: null,
    };

    const falhou = () => {
      if (disposed || desiredKey !== key) return;
      if (voice.target === 0) return;
      if (!voices.includes(voice)) return;
      pararVoz(voice);
      const idx = voices.indexOf(voice);
      if (idx >= 0) voices.splice(idx, 1);
      iniciarVoz(key, tentativas + 1);
    };

    voice.onError = falhou;
    el.addEventListener("error", falhou);

    if (poolLen > 1) {
      voice.onEnded = () => avancarSeAindaNestaChave(key, voice);
      el.addEventListener("ended", voice.onEnded);
    }
    voices.push(voice);
    limitarVozes();
    tentarTocar(voice);
  }

  function setTrack(key, opts = {}) {
    const next = key && temPool(key) ? key : null;
    const fadeSec = Number(opts.fadeOutSec);
    if (!next && Number.isFinite(fadeSec) && fadeSec > 0) {
      fadeOutOverride = Math.max(0.35, -Math.log(0.02) / fadeSec);
    } else if (next) {
      fadeOutOverride = 0;
    }
    if (next === desiredKey) return;
    desiredKey = next;
    cancelarSilencioRotacao();
    for (const v of voices) v.rotacao = false;
    encerrarVozes(() => true, false);
    limitarVozes();
    if (!next) return;
    iniciarVoz(next);
  }

  function unlock() {
    if (disposed) return;
    unlocked = true;
    for (const v of voices) if (v.target > 0) tentarTocar(v);
  }

  function setMuted(on) {
    muted = !!on;
    for (const v of voices) {
      aplicarVolumeVoz(v);
      if (muted) {
        try {
          v.el.pause();
        } catch {
          /* ignore */
        }
      } else if (v.target > 0) {
        tentarTocar(v);
      }
    }
  }

  function setMasterVolume(v) {
    masterVol = limitar01(v);
    for (const voice of voices) aplicarVolumeVoz(voice);
  }

  /** Abaixa a trilha (cura / sting). 1 = normal. */
  function setDuck(mul) {
    duckMul = limitar01(mul);
    for (const v of voices) aplicarVolumeVoz(v);
  }

  function update(dt) {
    if (disposed) return;
    const dtClamped = Math.max(0, dt ?? 0);

    if (silencioRestante > 0) {
      silencioRestante -= dtClamped;
      if (silencioRestante <= 0) {
        silencioRestante = 0;
        const key = chaveSilencio;
        chaveSilencio = null;
        if (key && desiredKey === key && enabled) iniciarVoz(key);
      }
    }

    for (const v of voices) {
      if (v.target <= 0 || v.el.loop || !usaSilencioRotacao(v.key)) continue;
      const rest = restanteFaixa(v.el);
      if (rest != null && rest <= fadeLeadRotacao) {
        v.target = 0;
        v.rotacao = true;
      }
    }

    for (let i = voices.length - 1; i >= 0; i--) {
      const v = voices[i];
      const outSpeed = fadeOutOverride > 0 ? fadeOutOverride : fadeOutSpeed;
      const speed =
        v.target > 0 ? fadeInSpeed : v.rotacao ? fadeInSpeed : outSpeed;
      const t = limitar01(dtClamped * speed);
      v.level = misturar(v.level, v.target, t);
      if (Math.abs(v.level - v.target) < 0.004) v.level = v.target;
      aplicarVolumeVoz(v);
      if (v.target === 0 && v.level <= 0.005) {
        const eraRotacao = v.rotacao;
        const key = v.key;
        pararVoz(v);
        voices.splice(i, 1);
        if (!voices.some((other) => other.target <= 0)) fadeOutOverride = 0;
        if (eraRotacao) iniciarSilencioRotacao(key);
      }
    }
  }

  function dispose() {
    disposed = true;
    cancelarSilencioRotacao();
    for (const v of voices) pararVoz(v);
    voices.length = 0;
  }

  return {
    unlock,
    setTrack,
    hasTrack: temPool,
    setMuted,
    setMasterVolume,
    setDuck,
    update,
    dispose,
    get unlocked() {
      return unlocked;
    },
    get masterVolume() {
      return masterVol;
    },
    get currentKey() {
      return desiredKey;
    },
  };
}
