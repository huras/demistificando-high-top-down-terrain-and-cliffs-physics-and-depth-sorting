import * as THREE from "three";
import {
  ALTURA_BLOCO,
  CAMERA3D_ALTURA,
  CAMERA3D_COSTAS_SUAVIDADE,
  CAMERA3D_DIST_MAX,
  CAMERA3D_DIST_MIN,
  CAMERA3D_DIST_PADRAO,
  CAMERA3D_MIRA_DIST,
  CAMERA3D_MIRA_OMBRO,
  CAMERA3D_MIRA_PITCH_MAX,
  CAMERA3D_MIRA_PITCH_MIN,
  CAMERA3D_MIRA_SUAVIDADE,
  CAMERA3D_MOUSE_SENS,
  CAMERA3D_OLHAR_Y,
  CAMERA3D_PITCH_MAX,
  CAMERA3D_PITCH_MIN,
  CAMERA3D_PITCH_ORBITA,
  CAMERA3D_PIVO_MAX,
  CAMERA3D_PIVO_MIN,
  CAMERA3D_PROJECAO_SUAVIDADE,
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
  const orto = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 200);
  cam.userData.vista = {
    meiaLargura: aspect,
    meiaAltura: 1,
    projBlend: 0,
    distOlhar: CAMERA3D_DIST_PADRAO,
  };
  return {
    cam,
    _orto: orto,
    _projPersp: new THREE.Matrix4(),
    projecao: "perspectiva",
    projBlend: 0,
    meiaLargura: aspect,
    meiaAltura: 1,
    distOlhar: CAMERA3D_DIST_PADRAO,
    modo: "orbita",
    mecanismo: "livre",
    mostrarRig: false,
    distancia: CAMERA3D_DIST_PADRAO,
    alturaPivo: CAMERA3D_OLHAR_Y,
    yaw: 0,
    pitchOrbita: CAMERA3D_PITCH_ORBITA,
    pitchMira: 0,
    blend: 0,
    pronta: false,
    pivo: new THREE.Vector3(),
    direcaoTiro: new THREE.Vector3(0, 0, -1),
    _pos: new THREE.Vector3(),
    _alvo: new THREE.Vector3(),
    _look: new THREE.Vector3(),
    _lookY: null,
    _distClip: CAMERA3D_DIST_PADRAO,
    _orbitaCam: new THREE.Vector3(),
    _orbitaLook: new THREE.Vector3(),
    _miraCam: new THREE.Vector3(),
    _miraLook: new THREE.Vector3(),
  };
}

export function ajustarDistancia(camera3d, fator) {
  camera3d.distancia = clamp(
    camera3d.distancia / fator,
    CAMERA3D_DIST_MIN,
    CAMERA3D_DIST_MAX,
  );
}

export function definirDistancia(camera3d, valor) {
  camera3d.distancia = clamp(valor, CAMERA3D_DIST_MIN, CAMERA3D_DIST_MAX);
}

export function definirAlturaPivo(camera3d, valor) {
  camera3d.alturaPivo = clamp(valor, CAMERA3D_PIVO_MIN, CAMERA3D_PIVO_MAX);
}

export function definirPitchOrbita(camera3d, rad) {
  camera3d.pitchOrbita = clamp(rad, CAMERA3D_PITCH_MIN, CAMERA3D_PITCH_MAX);
}

export function definirMecanismo(camera3d, mecanismo) {
  camera3d.mecanismo = mecanismo === "costas" ? "costas" : "livre";
}

export function definirMostrarRig(camera3d, ativo) {
  camera3d.mostrarRig = !!ativo;
}

export function definirProjecao(camera3d, projecao) {
  camera3d.projecao = projecao === "orto" ? "orto" : "perspectiva";
}

export function definirModoCamera(camera3d, modo) {
  camera3d.modo = modo === "mira" ? "mira" : "orbita";
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

const _ndcPerto = new THREE.Vector3();
const _ndcLonge = new THREE.Vector3();

/** Raio do cursor em coords de voxel: x/y no chão, z em blocos. */
export function raioDoPonteiro(camera3d, ndcX, ndcY) {
  const cam = camera3d.cam ?? camera3d;
  _ndcPerto.set(ndcX, ndcY, -1).unproject(cam);
  _ndcLonge.set(ndcX, ndcY, 1).unproject(cam);
  _ndcLonge.sub(_ndcPerto);
  const len = _ndcLonge.length() || 1;
  return {
    ox: _ndcPerto.x,
    oy: _ndcPerto.z,
    oz: _ndcPerto.y / ALTURA_BLOCO,
    dx: _ndcLonge.x / len,
    dy: _ndcLonge.z / len,
    dz: _ndcLonge.y / len / ALTURA_BLOCO,
  };
}

/**
 * Órbita: só o yaw (ao redor do personagem).
 * Mira: yaw e pitch.
 */
export function aplicarOlharMouse(camera3d, dx, dy) {
  if (!dx && !dy) return;
  camera3d.yaw -= dx * CAMERA3D_MOUSE_SENS;
  if (camera3d.modo !== "mira") return;
  camera3d.pitchMira = clamp(
    camera3d.pitchMira + dy * CAMERA3D_MOUSE_SENS,
    CAMERA3D_MIRA_PITCH_MIN,
    CAMERA3D_MIRA_PITCH_MAX,
  );
}

/**
 * Terceira pessoa na órbita; mira no ombro quando modo === "mira".
 * O blend interpola distância, altura e offset lateral.
 */
export function seguirAlvo3d(camera3d, corpo, dt) {
  if (!camera3d.pronta) {
    camera3d.yaw = Math.atan2(corpo.dirX || 0, corpo.dirY || 1);
  }

  alinharCostas(camera3d, corpo, dt);

  const elev = corpo.elevacao ?? corpo.z + (corpo.hopLift || 0);
  const tx = corpo.x;
  const tz = corpo.y;
  const tyAlvo = elev * ALTURA_BLOCO + camera3d.alturaPivo;

  if (!camera3d.pronta || camera3d._lookY == null) {
    camera3d._lookY = tyAlvo;
  } else {
    const tY = 1 - Math.exp(-CAMERA3D_SUAVIDADE_Y * dt);
    camera3d._lookY += (tyAlvo - camera3d._lookY) * tY;
  }
  const tyBase = camera3d._lookY;
  camera3d.pivo.set(tx, tyBase, tz);

  poseOrbita(camera3d, tx, tyBase, tz);
  poseMira(camera3d, tx, tyBase, tz);

  const querMira = camera3d.modo === "mira" ? 1 : 0;
  const tBlend = 1 - Math.exp(-CAMERA3D_MIRA_SUAVIDADE * dt);
  camera3d.blend += (querMira - camera3d.blend) * tBlend;
  const b = camera3d.blend;

  const desejadoX = lerp(camera3d._orbitaCam.x, camera3d._miraCam.x, b);
  const desejadoY = lerp(camera3d._orbitaCam.y, camera3d._miraCam.y, b);
  const desejadoZ = lerp(camera3d._orbitaCam.z, camera3d._miraCam.z, b);
  const lookX = lerp(camera3d._orbitaLook.x, camera3d._miraLook.x, b);
  const lookY = lerp(camera3d._orbitaLook.y, camera3d._miraLook.y, b);
  const lookZ = lerp(camera3d._orbitaLook.z, camera3d._miraLook.z, b);

  const offX = desejadoX - tx;
  const offY = desejadoY - tyBase;
  const offZ = desejadoZ - tz;
  const distOff = Math.hypot(offX, offY, offZ) || 1;

  const distOlho = distanciaComOlhoLivre(
    tx,
    tyBase,
    tz,
    offX / distOff,
    offY / distOff,
    offZ / distOff,
    distOff,
  );
  if (camera3d._distClip == null) camera3d._distClip = distOff;
  const entrando = distOlho < camera3d._distClip - 0.02;
  if (entrando && camera3d._distClip - distOlho > 1.25) {
    camera3d._distClip = distOlho;
  } else {
    const tClip = 1 - Math.exp(-(entrando ? 24 : 7) * dt);
    camera3d._distClip += (distOlho - camera3d._distClip) * tClip;
  }
  const dist = Math.min(distOff, Math.max(DIST_OLHO_MIN, camera3d._distClip));
  const escala = dist / distOff;

  const camX = tx + offX * escala;
  const camY = tyBase + offY * escala;
  const camZ = tz + offZ * escala;

  if (!camera3d.pronta) {
    camera3d._pos.set(camX, camY, camZ);
    camera3d.pronta = true;
  } else {
    camera3d._pos.set(camX, camY, camZ);
  }

  camera3d._look.set(lookX, lookY, lookZ);
  camera3d.cam.position.copy(camera3d._pos);
  camera3d.cam.lookAt(camera3d._look);
  camera3d.cam.updateMatrixWorld(true);
  aplicarProjecao(camera3d, dt);

  const e = camera3d.cam.matrixWorld.elements;
  camera3d.direcaoTiro.set(-e[8], -e[9], -e[10]).normalize();
}

/**
 * Ortográfica enquadra a mesma altura no ponto de mira.
 * A mistura deixa o achatamento aparecer em vez de pular.
 */
export function aplicarProjecao(camera3d, dt) {
  const persp = camera3d.cam;
  const orto = camera3d._orto;
  const dist = Math.max(0.5, persp.position.distanceTo(camera3d._look));
  const meiaAltura = Math.tan((persp.fov * Math.PI) / 360) * dist;
  const meiaLargura = meiaAltura * persp.aspect;

  orto.position.copy(persp.position);
  orto.quaternion.copy(persp.quaternion);
  orto.up.copy(persp.up);
  orto.left = -meiaLargura;
  orto.right = meiaLargura;
  orto.top = meiaAltura;
  orto.bottom = -meiaAltura;
  orto.near = persp.near;
  orto.far = persp.far;
  orto.zoom = 1;

  persp.updateProjectionMatrix();
  orto.updateProjectionMatrix();
  camera3d._projPersp.copy(persp.projectionMatrix);

  // Mira sempre em perspectiva; o blend do ombro puxa a projeção junto.
  const prefOrto = camera3d.projecao === "orto" ? 1 : 0;
  const alvo = prefOrto * (1 - (camera3d.blend || 0));
  const t = 1 - Math.exp(-CAMERA3D_PROJECAO_SUAVIDADE * dt);
  camera3d.projBlend += (alvo - camera3d.projBlend) * t;
  if (camera3d.projBlend < 0.001) camera3d.projBlend = 0;
  else if (camera3d.projBlend > 0.999) camera3d.projBlend = 1;

  camera3d.meiaLargura = meiaLargura;
  camera3d.meiaAltura = meiaAltura;
  camera3d.distOlhar = dist;
  const vista = persp.userData.vista || (persp.userData.vista = {});
  vista.meiaLargura = meiaLargura;
  vista.meiaAltura = meiaAltura;
  vista.projBlend = camera3d.projBlend;
  vista.distOlhar = dist;
  if (camera3d.projBlend === 0) return;

  const origem = camera3d._projPersp.elements;
  const destino = orto.projectionMatrix.elements;
  const saida = persp.projectionMatrix.elements;
  const u = camera3d.projBlend;
  for (let i = 0; i < 16; i++) saida[i] = origem[i] + (destino[i] - origem[i]) * u;
  persp.projectionMatrixInverse.copy(persp.projectionMatrix).invert();
}

/** Yaw horizontal da câmera (rad) para strafe WASD. */
export function yawCamera(camera3d) {
  return camera3d.yaw;
}

const _frenteYaw = new THREE.Vector3();

/** Yaw horizontal a partir de uma PerspectiveCamera Three (ex.: câmera virtual do reflexo). */
export function yawDeCameraThree(cam) {
  if (!cam) return 0;
  cam.getWorldDirection(_frenteYaw);
  return Math.atan2(-_frenteYaw.x, -_frenteYaw.z);
}

/** Facing do sprite acompanha a mira, mesmo em strafe. */
export function aplicarFacingMira(corpo, camera3d) {
  if (!corpo) return;
  // Escalando: peito na parede — mira não gira o sprite.
  if (corpo.escalando && corpo.escalada) {
    corpo.mirando = false;
    return;
  }
  if (camera3d.modo !== "mira" && camera3d.blend < 0.35) {
    corpo.mirando = false;
    return;
  }
  const sin = Math.sin(camera3d.yaw);
  const cos = Math.cos(camera3d.yaw);
  corpo.mirando = true;
  corpo.dirX = -sin;
  corpo.dirY = -cos;
}

function alinharCostas(camera3d, corpo, dt) {
  if (camera3d.mecanismo !== "costas") return;
  if (camera3d.modo === "mira") return;
  const vx = corpo.vx || 0;
  const vy = corpo.vy || 0;
  if (Math.hypot(vx, vy) < 0.45) return;
  const alvo = Math.atan2(-vx, -vy);
  let diff = alvo - camera3d.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const t = 1 - Math.exp(-CAMERA3D_COSTAS_SUAVIDADE * dt);
  camera3d.yaw += diff * t;
}

function poseOrbita(camera3d, tx, tyBase, tz) {
  const t = camera3d.folgaTeleporte || 0;
  let distDesejada = camera3d.distancia;
  let pitch = camera3d.pitchOrbita;
  if (t > 0) {
    const distBase =
      Number.isFinite(camera3d.teleporteDistBase) ? camera3d.teleporteDistBase : camera3d.distancia;
    const distAlvo =
      Number.isFinite(camera3d.teleporteDistAlvo) ? camera3d.teleporteDistAlvo : distBase;
    const pitchIni =
      Number.isFinite(camera3d.teleportePitchIni) ? camera3d.teleportePitchIni : camera3d.pitchOrbita;
    const pitchFim =
      Number.isFinite(camera3d.teleportePitchFim) ? camera3d.teleportePitchFim : camera3d.pitchOrbita;
    distDesejada = distBase + (distAlvo - distBase) * t;
    pitch = pitchIni + (pitchFim - pitchIni) * t;
  }
  pitch = clamp(pitch, CAMERA3D_PITCH_MIN, CAMERA3D_PITCH_MAX);
  distDesejada = clamp(distDesejada, CAMERA3D_DIST_MIN, CAMERA3D_DIST_MAX);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const sinY = Math.sin(camera3d.yaw);
  const cosY = Math.cos(camera3d.yaw);

  const alturaOmbro = CAMERA3D_ALTURA * 0.35;
  const olharCima = sinP < 0 ? -sinP * distDesejada : 0;
  const olharBaixo = sinP > 0 ? sinP * distDesejada : 0;
  const distH = distDesejada * Math.max(0.15, cosP);

  camera3d._orbitaCam.set(
    tx + sinY * distH,
    tyBase + alturaOmbro + olharBaixo,
    tz + cosY * distH,
  );
  camera3d._orbitaLook.set(tx, tyBase + olharCima, tz);
}

function poseMira(camera3d, tx, tyBase, tz) {
  const pitch = camera3d.pitchMira;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const sinY = Math.sin(camera3d.yaw);
  const cosY = Math.cos(camera3d.yaw);
  const aimX = -sinY * cosP;
  const aimY = -sinP;
  const aimZ = -cosY * cosP;
  const rightX = cosY;
  const rightZ = -sinY;
  const dist = CAMERA3D_MIRA_DIST;

  const camX = tx + sinY * dist * cosP + rightX * CAMERA3D_MIRA_OMBRO;
  const camY = tyBase + 0.35 + dist * Math.max(0, sinP) * 0.45;
  const camZ = tz + cosY * dist * cosP + rightZ * CAMERA3D_MIRA_OMBRO;

  camera3d._miraCam.set(camX, camY, camZ);
  camera3d._miraLook.set(camX + aimX * 14, camY + aimY * 14, camZ + aimZ * 14);
}

const RAIO_OLHO = 0.18;
const PASSO_OLHO = 0.25;
const FOLGA_OLHO = 0.4;
const DIST_OLHO_MIN = 0.45;
const AMOSTRAS_OLHO = [
  [0, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * O braço da câmera fica no comprimento pedido.
 * Só recua se o olho entrou num sólido — senão a vista nasce dentro do volume.
 * Sólido no meio do raio não puxa a câmera: o personagem entra em silhueta.
 * ox,oy,oz = pivô (mundo x, elev Three, mundo z); n* = direção unitária Three.
 */
function distanciaComOlhoLivre(ox, oy, oz, nx, ny, nz, distMax) {
  if (!olhoOcupado(ox, oy, oz, nx, ny, nz, distMax)) return distMax;
  for (let t = distMax - PASSO_OLHO; t > DIST_OLHO_MIN; t -= PASSO_OLHO) {
    if (!olhoOcupado(ox, oy, oz, nx, ny, nz, t)) {
      return Math.max(DIST_OLHO_MIN, t - FOLGA_OLHO);
    }
  }
  return DIST_OLHO_MIN;
}

function olhoOcupado(ox, oy, oz, nx, ny, nz, t) {
  const px = ox + nx * t;
  const py = oy + ny * t;
  const pz = oz + nz * t;
  for (let i = 0; i < AMOSTRAS_OLHO.length; i++) {
    const o = AMOSTRAS_OLHO[i];
    if (pontoOcupado(px + o[0] * RAIO_OLHO, py + o[1] * RAIO_OLHO, pz + o[2] * RAIO_OLHO)) {
      return true;
    }
  }
  return false;
}

function pontoOcupado(wx, wyThree, wz) {
  const cz = Math.floor(wyThree / ALTURA_BLOCO);
  if (cz < 0 || cz >= CHUNK_Y) return false;
  return ehSolido(obterBloco(Math.floor(wx), Math.floor(wz), cz));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
