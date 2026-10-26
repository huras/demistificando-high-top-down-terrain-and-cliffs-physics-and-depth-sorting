/**
 * Animação de people Platinum — paridade Pokemon AI (`peopleSprites.js`).
 *
 * DIR: 0 down, 1 left, 2 right, 3 up
 * Column9: side olha pra ESQUERDA; DIR_RIGHT espelha.
 * Walk: idle → walk1 → idle → walk2 (4 frames).
 */
import { linhaFacingCamera } from "../../render/3d/facingCamera3d.js";

export const DIR_DOWN = 0;
export const DIR_LEFT = 1;
export const DIR_RIGHT = 2;
export const DIR_UP = 3;

/** D/P/Pt column: rows no sheet. Right = left espelhado. */
export const COLUMN9_WALK_SRC = Object.freeze([
  Object.freeze([0, 5, 0, 6]), // down
  Object.freeze([2, 7, 2, 8]), // left
  Object.freeze([2, 7, 2, 8]), // right (flip)
  Object.freeze([1, 3, 1, 4]), // up
]);

export const COLUMN9_IDLE_SRC = Object.freeze([0, 2, 2, 1]);

export const WALK_FRAMES = 4;
export const WALK_DURATIONS_MS = Object.freeze([280, 140, 280, 140]);

const DIR_VERTICAL_FAVOR = 0.85;
const MAX_ANIM_STEPS = 48;

/** Vetor mundo → DIR sheet (sem câmera). +Y = sul/down. */
export function velocityToDir(dx, dy) {
  if (Math.abs(dx) < 1e-5 && Math.abs(dy) < 1e-5) return DIR_DOWN;
  if (Math.abs(dy) >= Math.abs(dx) * DIR_VERTICAL_FAVOR) {
    return dy < 0 ? DIR_UP : DIR_DOWN;
  }
  return dx < 0 ? DIR_LEFT : DIR_RIGHT;
}

/**
 * Facing relativo à câmera → DIR people.
 * Gold/Ragnarok (frente/oeste/leste/costas) = down/left/right/up.
 */
export function facingToDirPeople(facing, yawCam = 0) {
  const fx = facing?.x ?? 0;
  const fy = facing?.y ?? 1;
  if (fx === 0 && fy === 0) return DIR_DOWN;
  return linhaFacingCamera(fx, fy, yawCam) | 0;
}

export function precisaEspelharDir(dir) {
  return (dir | 0) === DIR_RIGHT;
}

export function srcRowColumn9(dir, frame, andando) {
  const d = ((dir | 0) % 4 + 4) % 4;
  if (!andando) return COLUMN9_IDLE_SRC[d] | 0;
  const f = ((frame | 0) % WALK_FRAMES + WALK_FRAMES) % WALK_FRAMES;
  return COLUMN9_WALK_SRC[d][f] | 0;
}

/** Avança frame Walk com durations do Pokemon AI (ms). */
export function avancarAnimPeople(npc, dt) {
  if (!npc) return;
  if (!npc.andando) {
    npc.frame = 0;
    npc.frameTime = 0;
    npc.animT = 0;
    return;
  }
  let frameTime = Number(npc.frameTime) || 0;
  frameTime += (Number.isFinite(dt) && dt > 0 ? dt : 0) * 1000;
  let frame = npc.frame | 0;
  let steps = 0;
  while (steps < MAX_ANIM_STEPS) {
    const dur = WALK_DURATIONS_MS[frame % WALK_FRAMES] || 140;
    if (!(frameTime >= dur) || !(dur > 0)) break;
    frameTime -= dur;
    frame = (frame + 1) % WALK_FRAMES;
    steps += 1;
  }
  if (steps >= MAX_ANIM_STEPS) {
    const dur = WALK_DURATIONS_MS[frame % WALK_FRAMES] || 140;
    if (dur > 0 && frameTime >= dur) frameTime %= dur;
  }
  npc.frame = frame;
  npc.frameTime = frameTime;
  npc.animT = (npc.animT || 0) + (dt || 0);
}
