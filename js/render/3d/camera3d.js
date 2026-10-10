import * as THREE from "three";
import {
  ALTURA_BLOCO,
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
 * Terceira pessoa: XZ no corpo; altura do corpo suave; pitch imediato.
 * Mirar para cima sobe o alvo. Mirar para baixo sobe a câmera.
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
  const tyAlvo = elev * ALTURA_BLOCO + CAMERA3D_OLHAR_Y;

  if (!camera3d.pronta || camera3d._lookY == null) {
    camera3d._lookY = tyAlvo;
  } else {
    const tY = 1 - Math.exp(-CAMERA3D_SUAVIDADE_Y * dt);
    camera3d._lookY += (tyAlvo - camera3d._lookY) * tY;
  }
  const tyBase = camera3d._lookY;

  const distDesejada = camera3d.distancia;
  const cosP = Math.cos(camera3d.pitch);
  const sinP = Math.sin(camera3d.pitch);
  const sinY = Math.sin(camera3d.yaw);
  const cosY = Math.cos(camera3d.yaw);

  const alturaOmbro = CAMERA3D_ALTURA * 0.35;
  // Pitch > 0: órbita para cima, mira no corpo.
  // Pitch < 0: câmera fica no ombro e o ponto de mira sobe.
  // Descer a câmera no chão faz o clip de sólido anular a mira para cima.
  const olharCima = sinP < 0 ? -sinP * distDesejada : 0;
  const olharBaixo = sinP > 0 ? sinP * distDesejada : 0;
  const distH = distDesejada * Math.max(0.15, cosP);

  const camOffX = sinY * distH;
  const camOffY = alturaOmbro + olharBaixo;
  const camOffZ = cosY * distH;
  const distOff = Math.hypot(camOffX, camOffY, camOffZ) || 1;

  const distLivre = distanciaAteSolido(
    tx,
    tyBase,
    tz,
    camOffX / distOff,
    camOffY / distOff,
    camOffZ / distOff,
    distOff,
  );
  const alvoClip = Math.min(distOff, Math.max(0.55, distLivre - 0.35));
  if (camera3d._distClip == null) camera3d._distClip = distOff;
  const tClip = 1 - Math.exp(-10 * dt);
  camera3d._distClip += (alvoClip - camera3d._distClip) * tClip;
  if (alvoClip >= distOff - 0.05) {
    camera3d._distClip += (distOff - camera3d._distClip) * tClip;
  }
  const dist = Math.min(distOff, Math.max(0.45, camera3d._distClip));
  const escala = dist / distOff;

  const desejadoX = tx + camOffX * escala;
  const desejadoY = tyBase + camOffY * escala;
  const desejadoZ = tz + camOffZ * escala;

  if (!camera3d.pronta) {
    camera3d._pos.set(desejadoX, desejadoY, desejadoZ);
    camera3d.pronta = true;
  } else {
    camera3d._pos.x = desejadoX;
    camera3d._pos.z = desejadoZ;
    camera3d._pos.y = desejadoY;
  }

  camera3d._look.set(tx, tyBase + olharCima, tz);
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
    const cz = Math.floor(we / ALTURA_BLOCO);
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
