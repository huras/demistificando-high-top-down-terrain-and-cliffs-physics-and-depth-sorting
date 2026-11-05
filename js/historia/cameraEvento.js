/** Câmera de evento: tween de pivô + distância (port do beginCamTween do Pokémon AI). */

import { CAMERA3D_DIST_PADRAO } from "../config.js";
import { definirDistancia, seguirAlvo3d } from "../render/3d/camera3d.js";

let cam = null;
let camera3dRef = null;

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function criarCam(corpo) {
  const px = corpo?.x ?? 0;
  const py = corpo?.y ?? 0;
  const dist = camera3dRef?.distancia ?? CAMERA3D_DIST_PADRAO;
  return {
    mode: "idle",
    t: 0,
    duration: 1,
    fromX: px,
    fromY: py,
    toX: px,
    toY: py,
    fromDist: dist,
    toDist: dist,
    holdX: px,
    holdY: py,
    holdDist: dist,
    restoreX: px,
    restoreY: py,
    restoreDist: dist,
  };
}

export function ligarCameraEvento(camera3d) {
  camera3dRef = camera3d || null;
}

export function cameraEventoAtiva() {
  return !!(cam && cam.mode !== "idle");
}

/**
 * @param {object} corpo
 * @param {number} x
 * @param {number} y
 * @param {number} dist
 * @param {number} duration
 * @param {"tween"|"hold"|"restore"} [mode]
 */
export function beginCamTween(corpo, x, y, dist, duration, mode = "tween") {
  if (!cam) cam = criarCam(corpo);
  const c = cam;
  const nowX = Number.isFinite(c.holdX) ? c.holdX : corpo?.x ?? 0;
  const nowY = Number.isFinite(c.holdY) ? c.holdY : corpo?.y ?? 0;
  const nowDist = Number.isFinite(c.holdDist)
    ? c.holdDist
    : camera3dRef?.distancia ?? CAMERA3D_DIST_PADRAO;
  if (mode === "restore") {
    c.fromX = nowX;
    c.fromY = nowY;
    c.fromDist = nowDist;
    c.toX = c.restoreX;
    c.toY = c.restoreY;
    c.toDist = c.restoreDist;
  } else {
    if (c.mode === "idle") {
      c.restoreX = corpo?.x ?? nowX;
      c.restoreY = corpo?.y ?? nowY;
      c.restoreDist = camera3dRef?.distancia ?? nowDist;
    }
    c.fromX = nowX;
    c.fromY = nowY;
    c.fromDist = nowDist;
    c.toX = x;
    c.toY = y;
    c.toDist = dist;
  }
  c.duration = Math.max(0.05, duration || 1);
  c.t = 0;
  c.mode = mode;
}

export function cancelarCameraEvento(corpo) {
  if (!cam) return;
  cam.mode = "idle";
  cam.t = 0;
  if (corpo && camera3dRef) {
    cam.holdX = corpo.x;
    cam.holdY = corpo.y;
    cam.holdDist = camera3dRef.distancia;
    definirDistancia(camera3dRef, cam.restoreDist ?? CAMERA3D_DIST_PADRAO);
  }
}

/**
 * Aplica override na camera3d (substitui seguirAlvo3d quando ativo).
 * @returns {boolean}
 */
export function aplicarCameraEvento(camera3d, corpo, dt) {
  if (!camera3d) return false;
  camera3dRef = camera3d;
  if (!cam) cam = criarCam(corpo);
  const c = cam;
  if (c.mode === "idle") return false;

  if (c.mode === "tween" || c.mode === "restore") {
    c.t += dt;
    const u = smoothstep(Math.min(1, c.t / c.duration));
    c.holdX = lerp(c.fromX, c.toX, u);
    c.holdY = lerp(c.fromY, c.toY, u);
    c.holdDist = lerp(c.fromDist, c.toDist, u);
    if (u >= 1) {
      c.mode = c.mode === "restore" ? "idle" : "hold";
      c.t = 0;
    }
  }

  const alvo = {
    x: c.holdX,
    y: c.holdY,
    elevacao: corpo?.elevacao ?? corpo?.z ?? 0,
    z: corpo?.z ?? 0,
    hopLift: 0,
  };
  definirDistancia(camera3d, c.holdDist);
  seguirAlvo3d(camera3d, alvo, dt);
  return true;
}
