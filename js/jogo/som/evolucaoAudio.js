/**
 * Jingle de evolução (RGBY): suspende BGM/BGS, toca ME, retoma.
 */

const REF = "/ref/music/";
const ARQUIVO =
  "BGM/cinematic/Pokemon Red Green Blue Yellow - Evolution.mp3";

function limitar01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function urlRef(rel) {
  return REF + String(rel).split("/").map(encodeURIComponent).join("/");
}

/**
 * @param {object} [cfg]
 * @param {{
 *   bgm?: { suspend?: Function, resume?: Function },
 *   suspendBgs?: Function,
 *   resumeBgs?: Function,
 * }} [deps]
 */
export function criarEvolucaoAudio(cfg = {}, deps = {}) {
  const enabled = cfg.enabled !== false;
  const masterVol = limitar01(cfg.volume ?? 0.85);
  const fadeInSec = Math.max(0.05, Number(cfg.fadeInSec) || 0.25);
  const fadeOutSec = Math.max(0.05, Number(cfg.fadeOutSec) || 0.55);
  const cancelFadeOutSec = Math.max(0.04, Number(cfg.cancelFadeOutSec) || 0.12);
  const worldFadeOutSec = Math.max(0.05, Number(cfg.worldFadeOutSec) || 0.35);
  const worldFadeInSec = Math.max(0.1, Number(cfg.worldFadeInSec) || 0.9);

  /** @type {HTMLAudioElement | null} */
  let el = null;
  let active = false;
  let ending = false;
  let vol = 0;
  let volTarget = 0;
  let volSpeed = 1 / fadeInSec;
  let raf = 0;
  let lastTs = 0;
  /** @type {(() => void) | null} */
  let onFullyStopped = null;

  function applyVolume() {
    if (!el) return;
    el.volume = limitar01(vol * masterVol);
  }

  function stopElement() {
    if (!el) return;
    try {
      el.pause();
      el.removeAttribute("src");
      el.load();
    } catch {
      /* ignore */
    }
    el = null;
  }

  function haltRaf() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    lastTs = 0;
  }

  function tick(ts) {
    raf = 0;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;

    if (vol !== volTarget) {
      const step = dt * volSpeed;
      if (vol < volTarget) vol = Math.min(volTarget, vol + step);
      else vol = Math.max(volTarget, vol - step);
      if (Math.abs(vol - volTarget) < 0.01) vol = volTarget;
      applyVolume();
    }

    if (ending && vol <= 0.001) {
      stopElement();
      ending = false;
      active = false;
      const done = onFullyStopped;
      onFullyStopped = null;
      done?.();
      return;
    }

    if (active || ending || vol !== volTarget) {
      raf = requestAnimationFrame(tick);
    }
  }

  function ensureTick() {
    if (!raf) {
      lastTs = 0;
      raf = requestAnimationFrame(tick);
    }
  }

  function suspendWorld() {
    deps.bgm?.suspend?.({ fadeOutSec: worldFadeOutSec });
    deps.suspendBgs?.({ fadeOutSec: worldFadeOutSec });
  }

  function resumeWorld() {
    deps.bgm?.resume?.({ fadeInSec: worldFadeInSec });
    deps.resumeBgs?.({ fadeInSec: worldFadeInSec });
  }

  function begin() {
    if (!enabled) return;
    if (active && el && !ending) {
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      vol = 0;
      volTarget = 1;
      volSpeed = 1 / fadeInSec;
      applyVolume();
      el.play().catch(() => {});
      ensureTick();
      return;
    }
    ending = false;
    onFullyStopped = null;
    suspendWorld();
    stopElement();
    el = new Audio(urlRef(ARQUIVO));
    el.preload = "auto";
    el.loop = true;
    el.volume = 0;
    vol = 0;
    volTarget = 1;
    volSpeed = 1 / fadeInSec;
    active = true;
    applyVolume();
    el.play().catch(() => {});
    ensureTick();
  }

  /**
   * @param {{ cancelled?: boolean, instant?: boolean }} [opts]
   */
  function end(opts = {}) {
    if (!active && !el) {
      resumeWorld();
      return;
    }
    const cancelled = !!opts.cancelled;
    const instant = !!opts.instant;
    ending = true;
    volTarget = 0;
    volSpeed = instant
      ? 20
      : 1 / (cancelled ? cancelFadeOutSec : fadeOutSec);
    onFullyStopped = () => resumeWorld();
    if (instant) {
      vol = 0;
      applyVolume();
    }
    ensureTick();
  }

  function dispose() {
    haltRaf();
    stopElement();
    active = false;
    ending = false;
    onFullyStopped = null;
  }

  return {
    begin,
    end,
    dispose,
    get active() {
      return active;
    },
  };
}
