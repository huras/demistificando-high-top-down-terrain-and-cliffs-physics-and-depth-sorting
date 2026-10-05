import * as THREE from "three";
import {
  CAMERA3D_ALTURA,
  CAMERA3D_DIST_MAX,
  CAMERA3D_DIST_MIN,
  CAMERA3D_DIST_PADRAO,
  CAMERA3D_LOOKAHEAD,
  CAMERA3D_OLHAR_Y,
  CAMERA3D_ROT_VEL,
  CAMERA3D_SUAVIDADE,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../../config.js";

export function criarCamera3d(aspect) {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
  return {
    cam,
    distancia: CAMERA3D_DIST_PADRAO,
    yaw: 0,
    pitch: 0.38,
    pronta: false,
    _pos: new THREE.Vector3(),
    _alvo: new THREE.Vector3(),
    _look: new THREE.Vector3(),
  };
}

export function ajustarDistancia(camera3d, fator) {
  camera3d.distancia = clamp(
    camera3d.distancia / fator,
    CAMERA3D_DIST_MIN,
    CAMERA3D_DIST_MAX,
  );
}

/** Normaliza distância para exibir como “zoom” no painel (1 ≈ padrão). */
export function distanciaNormalizada(camera3d) {
  const t =
    (CAMERA3D_DIST_PADRAO - camera3d.distancia) /
    (CAMERA3D_DIST_MAX - CAMERA3D_DIST_MIN);
  const z = 1 + t * (ZOOM_MAX - ZOOM_MIN) * 0.35;
  return clamp(z, ZOOM_MIN, ZOOM_MAX);
}

/**
 * Q = −1 (gira anti-horário / esquerda), E = +1 (direita).
 */
export function girarYaw(camera3d, sentido, dt) {
  if (!sentido) return;
  camera3d.yaw += sentido * CAMERA3D_ROT_VEL * dt;
}

/**
 * Terceira pessoa: segue o jogador; yaw só muda via Q/E (não segue facing).
 */
export function seguirAlvo3d(camera3d, corpo, dt) {
  if (!camera3d.pronta) {
    const facingYaw = Math.atan2(corpo.dirX || 0, corpo.dirY || 1);
    camera3d.yaw = facingYaw + Math.PI;
  }

  const elev = corpo.elevacao ?? corpo.z + (corpo.hopLift || 0);
  const la = CAMERA3D_LOOKAHEAD;
  const tx = corpo.x + (corpo.vx || 0) * la;
  const tz = corpo.y + (corpo.vy || 0) * la;
  const ty = elev + CAMERA3D_OLHAR_Y;

  const dist = camera3d.distancia;
  const cosP = Math.cos(camera3d.pitch);
  const sinP = Math.sin(camera3d.pitch);
  const sinY = Math.sin(camera3d.yaw);
  const cosY = Math.cos(camera3d.yaw);

  const desejadoX = tx + sinY * dist * cosP;
  const desejadoY = ty + CAMERA3D_ALTURA * 0.35 + sinP * dist;
  const desejadoZ = tz + cosY * dist * cosP;

  if (!camera3d.pronta) {
    camera3d._pos.set(desejadoX, desejadoY, desejadoZ);
    camera3d.pronta = true;
  } else {
    const t = 1 - Math.exp(-CAMERA3D_SUAVIDADE * dt);
    camera3d._pos.x += (desejadoX - camera3d._pos.x) * t;
    camera3d._pos.y += (desejadoY - camera3d._pos.y) * t;
    camera3d._pos.z += (desejadoZ - camera3d._pos.z) * t;
  }

  camera3d._look.set(tx, ty, tz);
  camera3d.cam.position.copy(camera3d._pos);
  camera3d.cam.lookAt(camera3d._look);
}

/** Yaw horizontal da câmera (rad) para strafe WASD. */
export function yawCamera(camera3d) {
  return camera3d.yaw;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
