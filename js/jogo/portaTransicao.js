/**
 * Transição de porta: dá um passo na porta → fade → teleporta → fade in.
 * Companheiro deployado anda junto no approach e pousa no teleporte.
 */
import { pokemonDeployado } from "../pokemon/party.js";
import { pousarCompanheiro } from "../pokemon/pousarCompanheiro.js";

const APPROACH = 0.2;
const FADE_OUT = 0.2;
const HOLD = 0.04;
const FADE_IN = 0.28;
const PASSO = 1.35;

/** @type {{
 *   fase: "approach" | "fadeOut" | "hold" | "fadeIn",
 *   t: number,
 *   kind: "enter" | "exit",
 *   corpo: object,
 *   onTeleport: () => void,
 *   dirX: number,
 *   dirY: number,
 *   facing: number,
 * } | null} */
let tr = null;
/** @type {HTMLElement | null} */
let overlay = null;

function garantirOverlay() {
  if (overlay) return overlay;
  overlay = document.getElementById("jogo-porta-fade");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "jogo-porta-fade";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:80;pointer-events:none;background:#000;opacity:0;transition:none;";
    const hud = document.getElementById("jogo-hud") || document.body;
    hud.appendChild(overlay);
  }
  return overlay;
}

function setFade(a) {
  const el = garantirOverlay();
  el.style.opacity = String(Math.max(0, Math.min(1, a)));
}

function monNaPorta() {
  const mon = pokemonDeployado();
  if (!mon || mon.capturado || mon.morto) return null;
  return mon;
}

function alinharMon(mon, trRef) {
  if (!mon) return;
  mon.dirX = trRef.dirX;
  mon.dirY = trRef.dirY;
  mon.facing = trRef.facing;
  mon.vx = 0;
  mon.vy = 0;
}

export function portaOcupada() {
  return !!tr;
}

/**
 * @param {object} corpo
 * @param {"enter" | "exit"} kind
 * @param {() => void} onTeleport
 */
export function iniciarPortaTransicao(corpo, kind, onTeleport) {
  if (tr || !corpo) return false;
  // Entrar = andar pro norte (pra dentro); sair = andar pro sul (pra rua).
  const enter = kind === "enter";
  tr = {
    fase: "approach",
    t: 0,
    kind,
    corpo,
    onTeleport,
    dirX: 0,
    dirY: enter ? -1 : 1,
    facing: enter ? 3 : 0,
  };
  corpo.dirX = tr.dirX;
  corpo.dirY = tr.dirY;
  corpo.facing = tr.facing;
  corpo.vx = 0;
  corpo.vy = 0;
  alinharMon(monNaPorta(), tr);
  garantirOverlay();
  setFade(0);
  return true;
}

export function tickPortaTransicao(dt) {
  if (!tr) return;
  const d = Math.min(0.05, Math.max(0, dt || 0));
  tr.t += d;
  const corpo = tr.corpo;
  const mon = monNaPorta();

  if (tr.fase === "approach") {
    const u = Math.min(1, tr.t / APPROACH);
    corpo.dirX = tr.dirX;
    corpo.dirY = tr.dirY;
    corpo.facing = tr.facing;
    corpo.vx = 0;
    corpo.vy = 0;
    const passo = PASSO * d;
    corpo.x += tr.dirX * passo;
    corpo.y += tr.dirY * passo;
    if (mon) {
      alinharMon(mon, tr);
      mon.x += tr.dirX * passo;
      mon.y += tr.dirY * passo;
    }
    setFade(u * 0.45);
    if (tr.t < APPROACH) return;
    tr.fase = "fadeOut";
    tr.t = 0;
    return;
  }

  if (tr.fase === "fadeOut") {
    setFade(0.45 + 0.55 * Math.min(1, tr.t / FADE_OUT));
    if (tr.t < FADE_OUT) return;
    try {
      tr.onTeleport();
    } catch (e) {
      console.error("porta teleporte", e);
    }
    // Facing pós-teleporte (entrar olhando pro fundo; sair olhando pra rua).
    corpo.dirX = tr.dirX;
    corpo.dirY = tr.dirY;
    corpo.facing = tr.facing;
    corpo.vx = 0;
    corpo.vy = 0;
    pousarCompanheiro(corpo, {
      z: corpo.elevacao ?? corpo.z,
      dirX: tr.dirX,
      dirY: tr.dirY,
      facing: tr.facing,
    });
    setFade(1);
    tr.fase = "hold";
    tr.t = 0;
    return;
  }

  if (tr.fase === "hold") {
    setFade(1);
    if (tr.t < HOLD) return;
    tr.fase = "fadeIn";
    tr.t = 0;
    return;
  }

  if (tr.fase === "fadeIn") {
    setFade(1 - Math.min(1, tr.t / FADE_IN));
    if (tr.t < FADE_IN) return;
    setFade(0);
    tr = null;
  }
}
