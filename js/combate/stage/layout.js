/**
 * Formação de batalha — âncoras relativas (arena) ou no mundo (OW).
 */
import { alturaSobPes } from "../../fisica/colisao.js";

export const STAGE_SLOT_CAP = 5;

/** Separação aliado↔foe no eixo de enfrentamento (unidades de mundo). */
const SEP_FRENTE = 2.85;
/** Espaçamento lateral entre mates. */
const SEP_LADO = 1.45;

/**
 * @param {"aliado"|"foe"} lado
 * @param {number} index 0-based
 * @param {number} total
 */
export function poseSlot(lado, index, total) {
  const n = Math.max(1, Math.min(STAGE_SLOT_CAP, total | 0));
  const i = Math.max(0, Math.min(n - 1, index | 0));
  const baseX = lado === "aliado" ? -SEP_FRENTE : SEP_FRENTE;
  const dirX = lado === "aliado" ? 1 : -1;
  const spread = n <= 1 ? 0 : Math.min(1.55, (SEP_LADO * 2) / Math.max(1, n - 1));
  const mid = (n - 1) * 0.5;
  return {
    x: baseX,
    y: (i - mid) * spread,
    dirX,
    dirY: 0,
  };
}

/**
 * Formação em coords de arena (origem 0,0) — sandbox.
 * @param {object[]} aliados
 * @param {object[]} foes
 */
export function aplicarFormacao(aliados, foes) {
  aplicarFormacaoMundo(aliados, foes, 0, 0, 1, 0, { amostrarChao: false });
}

/**
 * Formação ancorada no overworld.
 * face aponta do aliado → foe (default +X).
 *
 * @param {object[]} aliados
 * @param {object[]} foes
 * @param {number} ox centro X
 * @param {number} oy centro Y
 * @param {number} [faceX]
 * @param {number} [faceY]
 * @param {{ amostrarChao?: boolean }} [opts]
 */
export function aplicarFormacaoMundo(aliados, foes, ox, oy, faceX = 1, faceY = 0, opts = {}) {
  const a = Array.isArray(aliados) ? aliados : [];
  const f = Array.isArray(foes) ? foes : [];
  let fx = Number.isFinite(faceX) ? faceX : 1;
  let fy = Number.isFinite(faceY) ? faceY : 0;
  let fl = Math.hypot(fx, fy);
  if (fl < 1e-4) {
    fx = 1;
    fy = 0;
    fl = 1;
  } else {
    fx /= fl;
    fy /= fl;
  }
  // Lateral (esquerda do face).
  const lx = -fy;
  const ly = fx;
  const amostrar = opts.amostrarChao !== false;

  function pousar(ator, wx, wy, dirX, dirY) {
    if (!ator) return;
    ator.x = wx;
    ator.y = wy;
    if (amostrar) {
      const ref = ator.elevacao ?? ator.z ?? 0;
      const z = alturaSobPes(wx, wy, ref, ref);
      if (Number.isFinite(z)) {
        ator.z = z;
        ator.elevacao = z;
      }
    }
    ator.casaX = wx;
    ator.casaY = wy;
    ator.casaZ = ator.z ?? 0;
    ator.casaChronoX = wx;
    ator.casaChronoY = wy;
    ator.dirX = dirX;
    ator.dirY = dirY;
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
  }

  const na = Math.max(1, a.length);
  const nf = Math.max(1, f.length);
  for (let i = 0; i < a.length; i++) {
    const mid = (na - 1) * 0.5;
    const side = (i - mid) * SEP_LADO;
    const wx = ox - fx * SEP_FRENTE + lx * side;
    const wy = oy - fy * SEP_FRENTE + ly * side;
    pousar(a[i], wx, wy, fx, fy);
  }
  for (let i = 0; i < f.length; i++) {
    const mid = (nf - 1) * 0.5;
    const side = (i - mid) * SEP_LADO;
    const wx = ox + fx * SEP_FRENTE + lx * side;
    const wy = oy + fy * SEP_FRENTE + ly * side;
    pousar(f[i], wx, wy, -fx, -fy);
  }
}

/** Lista plana aliados + foes para o renderer. */
export function listaAtoresStage(aliados, foes) {
  const out = [];
  const a = Array.isArray(aliados) ? aliados : [];
  const f = Array.isArray(foes) ? foes : [];
  for (let i = 0; i < a.length; i++) if (a[i]) out.push(a[i]);
  for (let i = 0; i < f.length; i++) if (f[i]) out.push(f[i]);
  return out;
}
