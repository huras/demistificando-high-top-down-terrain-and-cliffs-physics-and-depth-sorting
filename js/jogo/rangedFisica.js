/**
 * Física compartilhada do ranged (arco / pokébola).
 * Espaço Three: XZ horizontal, Y altura. Captura usa (x,y) horizontal e z em blocos.
 */
import {
  ALTURA_BLOCO,
  BOLA_ARCO_AMOSTRAS,
  BOLA_GRAVIDADE,
  BOLA_PICKUP_RAIO,
  BOLA_RAIO_BLOCO,
  BOLA_VEL_MAX,
  BOLA_VEL_MIN,
} from "../config.js";
import { alturaSobPes } from "../fisica/colisao.js";

const _dir = { x: 0, y: 0, z: 0 };

/** Buffer reutilizável do arco (xyz intercalados, Three). */
const _arcoPos = new Float32Array(BOLA_ARCO_AMOSTRAS * 3);
const _impacto = { x: 0, y: 0, z: 0, voo: 0, ux: 0, uy: 0 };

function facingComLoft(corpo, loft = 0.18) {
  const fx = corpo?.dirX || 0;
  const fy = corpo?.dirY || 1;
  const fl = Math.hypot(fx, fy) || 1;
  let x = fx / fl;
  let y = loft;
  let z = fy / fl;
  const len = Math.hypot(x, y, z) || 1;
  _dir.x = x / len;
  _dir.y = y / len;
  _dir.z = z / len;
  return _dir;
}

/**
 * Direção de disparo 3D (mesma regra da flecha).
 * @param {{ direcaoTiro?: { x: number, y: number, z: number }, modo?: string } | null} camera3d
 * @param {{ dirX?: number, dirY?: number } | null} corpo
 */
export function direcaoDisparoRanged(camera3d, corpo) {
  const d = camera3d?.direcaoTiro;
  if (!d) return facingComLoft(corpo);

  let x = d.x;
  let y = d.y;
  let z = d.z;
  let len = Math.hypot(x, y, z);
  if (len < 1e-6) return facingComLoft(corpo);
  x /= len;
  y /= len;
  z /= len;

  if (camera3d.modo !== "mira" && Math.abs(y) > 0.85) {
    return facingComLoft(corpo, 0.18);
  }
  _dir.x = x;
  _dir.y = y;
  _dir.z = z;
  return _dir;
}

/**
 * Origem na mão/ombro (coords Three).
 * @param {{ x: number, y: number, elevacao?: number, z?: number }} corpo
 * @param {{ yaw?: number, alturaPivo?: number } | null} camera3d
 */
export function origemMaoRanged(corpo, camera3d) {
  const elev = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
  const yaw = camera3d?.yaw ?? 0;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const altura = elev + (camera3d?.alturaPivo ?? 1.15) * 0.72;
  return {
    x: corpo.x + cosY * 0.22 + -sinY * 0.28,
    y: altura,
    z: corpo.y + -sinY * 0.22 + -cosY * 0.28,
  };
}

/** Velocidade Three (u/s) a partir da carga 0..1. */
export function velocidadeBolaPorCarga(carga) {
  const t = Math.min(1, Math.max(0, Number(carga) || 0));
  return BOLA_VEL_MIN + (BOLA_VEL_MAX - BOLA_VEL_MIN) * t;
}

/**
 * Simula a trajetória balística (grenade-aim).
 * Escreve em buffer interno; retorno é view-only do frame.
 * @returns {{
 *   posicoes: Float32Array,
 *   count: number,
 *   impacto: { x: number, y: number, z: number, voo: number, ux: number, uy: number },
 * }}
 */
export function simularTrajetoriaBola(corpo, camera3d, carga) {
  const origem = origemMaoRanged(corpo, camera3d);
  const dir = direcaoDisparoRanged(camera3d, corpo);
  const vel = velocidadeBolaPorCarga(carga);
  let px = origem.x;
  let py = origem.y;
  let pz = origem.z;
  let vx = dir.x * vel;
  let vy = dir.y * vel;
  let vz = dir.z * vel;

  const dt = 1 / 40;
  const maxPassos = 120;
  let count = 0;
  let bateu = false;

  _arcoPos[0] = px;
  _arcoPos[1] = py;
  _arcoPos[2] = pz;
  count = 1;

  for (let i = 0; i < maxPassos && count < BOLA_ARCO_AMOSTRAS; i++) {
    vy -= BOLA_GRAVIDADE * dt;
    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;

    // Solo real sob o ponto (células → Three Y).
    const soloBloco = alturaSobPes(px, pz, py / ALTURA_BLOCO + 1) || 0;
    const soloY = soloBloco * ALTURA_BLOCO + BOLA_RAIO_BLOCO * ALTURA_BLOCO;

    const i3 = count * 3;
    _arcoPos[i3] = px;
    _arcoPos[i3 + 1] = py;
    _arcoPos[i3 + 2] = pz;
    count += 1;

    if (py <= soloY) {
      _arcoPos[i3 + 1] = soloY;
      const dx = px - corpo.x;
      const dy = pz - corpo.y;
      const voo = Math.hypot(dx, dy) || BOLA_PICKUP_RAIO * 1.1;
      const inv = voo > 1e-4 ? 1 / voo : 1;
      _impacto.x = px;
      _impacto.y = pz;
      _impacto.z = soloBloco;
      _impacto.voo = voo;
      _impacto.ux = dx * inv;
      _impacto.uy = dy * inv;
      bateu = true;
      break;
    }
  }

  if (!bateu) {
    const dx = dir.x;
    const dy = dir.z;
    const len = Math.hypot(dx, dy) || 1;
    const voo = BOLA_PICKUP_RAIO * 1.1 + (Number(carga) || 0) * 8;
    _impacto.x = corpo.x + (dx / len) * voo;
    _impacto.y = corpo.y + (dy / len) * voo;
    _impacto.z = corpo.elevacao ?? corpo.z ?? 0;
    _impacto.voo = voo;
    _impacto.ux = dx / len;
    _impacto.uy = dy / len;
  }

  return { posicoes: _arcoPos, count, impacto: _impacto };
}

/**
 * Estima ponto de queda (compat HUD 2D).
 * @returns {{ x: number, y: number, z: number, voo: number, ux: number, uy: number } | null}
 */
export function estimarQuedaBola(corpo, camera3d, carga) {
  if (!corpo) return null;
  const { impacto } = simularTrajetoriaBola(corpo, camera3d, carga);
  return {
    x: impacto.x,
    y: impacto.y,
    z: impacto.z,
    voo: impacto.voo,
    ux: impacto.ux,
    uy: impacto.uy,
  };
}
