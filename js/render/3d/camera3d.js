import * as THREE from "three";
import {
  CAMERA3D_ALTURA,
  CAMERA3D_DIST_MAX,
  CAMERA3D_DIST_MIN,
  CAMERA3D_DIST_PADRAO,
  CAMERA3D_MOUSE_SENS,
  CAMERA3D_OLHAR_Y,
  CAMERA3D_PITCH_MAX,
  CAMERA3D_PITCH_MIN,
  CAMERA3D_ROT_VEL,
  CAMERA3D_SUAVIDADE_Y,
  CHUNK_Y,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../../config.js";
import { obterBloco } from "../../mundo/voxel/storeMundo.js";
import { ehSolido } from "../../mundo/voxel/tiposBloco.js";

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
    _lookY: null,
    _distClip: CAMERA3D_DIST_PADRAO,
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
 * Q = −1 (gira anti-horário / esquerda), E = +1 (direita) — legado.
 */
export function girarYaw(camera3d, sentido, dt) {
  if (!sentido) return;
  camera3d.yaw += sentido * CAMERA3D_ROT_VEL * dt;
}

/** Mouse-look: dx/dy em pixels (movementX/Y). */
export function aplicarOlharMouse(camera3d, dx, dy) {
  if (!dx && !dy) return;
  camera3d.yaw -= dx * CAMERA3D_MOUSE_SENS;
  camera3d.pitch = clamp(
    camera3d.pitch + dy * CAMERA3D_MOUSE_SENS,
    CAMERA3D_PITCH_MIN,
    CAMERA3D_PITCH_MAX,
  );
}

/**
 * Terceira pessoa: XZ instantâneo no corpo; só o follow de altura (Y) é smooth.
 * Clip suave contra sólidos (caverna / teto).
 */
export function seguirAlvo3d(camera3d, corpo, dt) {
  if (!camera3d.pronta) {
    const facingYaw = Math.atan2(corpo.dirX || 0, corpo.dirY || 1);
    camera3d.yaw = facingYaw + Math.PI;
  }

  const elev = corpo.elevacao ?? corpo.z + (corpo.hopLift || 0);
  const tx = corpo.x;
  const tz = corpo.y;
  const tyAlvo = elev + CAMERA3D_OLHAR_Y;

  const distDesejada = camera3d.distancia;
  const cosP = Math.cos(camera3d.pitch);
  const sinP = Math.sin(camera3d.pitch);
  const sinY = Math.sin(camera3d.yaw);
  const cosY = Math.cos(camera3d.yaw);

  // Direção olho → câmera (Three: X=mundoX, Y=elev, Z=mundoY)
  const dirX = sinY * cosP;
  const dirY = CAMERA3D_ALTURA * 0.35 / Math.max(0.01, distDesejada) + sinP;
  const dirZ = cosY * cosP;
  const lenDir = Math.hypot(dirX, dirY, dirZ) || 1;
  const nx = dirX / lenDir;
  const ny = dirY / lenDir;
  const nz = dirZ / lenDir;

  const distClip = distanciaAteSolido(
    tx,
    tyAlvo,
    tz,
    nx,
    ny,
    nz,
    distDesejada,
  );
  const alvoClip = Math.max(CAMERA3D_DIST_MIN * 0.55, distClip - 0.35);
  if (camera3d._distClip == null) camera3d._distClip = distDesejada;
  const tClip = 1 - Math.exp(-10 * dt);
  camera3d._distClip += (alvoClip - camera3d._distClip) * tClip;
  // Solta de volta à distância pedida quando há espaço
  if (alvoClip >= distDesejada - 0.05) {
    camera3d._distClip += (distDesejada - camera3d._distClip) * tClip;
  }
  const dist = Math.min(distDesejada, camera3d._distClip);

  const desejadoX = tx + sinY * dist * cosP;
  const desejadoZ = tz + cosY * dist * cosP;

  if (!camera3d.pronta) {
    camera3d._lookY = tyAlvo;
    const desejadoY =
      camera3d._lookY + CAMERA3D_ALTURA * 0.35 + sinP * dist;
    camera3d._pos.set(desejadoX, desejadoY, desejadoZ);
    camera3d.pronta = true;
  } else {
    const tY = 1 - Math.exp(-CAMERA3D_SUAVIDADE_Y * dt);
    camera3d._lookY += (tyAlvo - camera3d._lookY) * tY;
    const desejadoY =
      camera3d._lookY + CAMERA3D_ALTURA * 0.35 + sinP * dist;
    camera3d._pos.x = desejadoX;
    camera3d._pos.z = desejadoZ;
    camera3d._pos.y += (desejadoY - camera3d._pos.y) * tY;
  }

  camera3d._look.set(tx, camera3d._lookY, tz);
  camera3d.cam.position.copy(camera3d._pos);
  camera3d.cam.lookAt(camera3d._look);
}

/**
 * Raymarch voxel: distância máxima livre ao longo do raio (mundo → Three).
 * ox,oy,oz = olhar (mundo x, elev, mundo y); n* = direção unitária Three.
 */
function distanciaAteSolido(ox, oy, oz, nx, ny, nz, distMax) {
  const steps = Math.max(8, Math.ceil(distMax * 6));
  const step = distMax / steps;
  let livre = distMax;
  for (let i = 1; i <= steps; i++) {
    const t = i * step;
    const wx = ox + nx * t;
    const we = oy + ny * t;
    const wy = oz + nz * t;
    const cx = Math.floor(wx);
    const cy = Math.floor(wy);
    const cz = Math.floor(we);
    if (cz < 0 || cz >= CHUNK_Y) continue;
    if (ehSolido(obterBloco(cx, cy, cz))) {
      livre = Math.max(0.4, t - step);
      break;
    }
  }
  return livre;
}

/** Yaw horizontal da câmera (rad) para strafe WASD. */
export function yawCamera(camera3d) {
  return camera3d.yaw;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
