/**
 * Enquadramento Chrono na câmera 3D do mundo (sem arena/definirOmbro).
 */
import { ALTURA_BLOCO } from "../../config.js";
import { aplicarProjecao, yawDeCameraThree } from "../../render/3d/camera3d.js";
import { primeiroTiro } from "../../pokemon/combate/projeteis.js";
import { CAM_TURNO } from "../cameraTurno.js";
import { observarTiro, poseDisparo, poseImpacto } from "../impacto.js";
import { enquadramentoTurno } from "../turnos.js";

let ang = 0;
let ativo = false;
const look = { x: 0, y: 0, z: 0 };
const cam = { x: 0, y: 0, z: 0 };

export function limparCameraChrono() {
  ativo = false;
  ang = 0;
}

function elevDe(ator) {
  return ((ator.elevacao ?? ator.z ?? 0) + (ator.hopLift || 0)) * ALTURA_BLOCO;
}

function poseDoQuadro() {
  const impacto = poseImpacto();
  if (impacto) return impacto;
  const tiro = primeiroTiro();
  if (tiro) {
    observarTiro(tiro);
    const disparo = poseDisparo();
    if (disparo) return disparo;
  }
  return enquadramentoTurno();
}

function destinoTeatro(a, b, dt) {
  const cfg = CAM_TURNO.teatro;
  const lx = (a.x + b.x) * 0.5;
  const lz = (a.y + b.y) * 0.5;
  const ly = (elevDe(a) + elevDe(b)) * 0.5 + 1.05;
  ang += dt * (cfg.giro || 0.5);
  const raio = cfg.raio;
  cam.x = lx + Math.sin(ang) * raio;
  cam.y = ly + cfg.altura - 1.05;
  cam.z = lz + Math.cos(ang) * raio;
  look.x = lx;
  look.y = ly;
  look.z = lz;
}

function destinoVolta(quem, pose, dt) {
  const raio = pose.raio || CAM_TURNO.volta.raio;
  const altura = pose.altura || CAM_TURNO.volta.altura;
  const giro = pose.giro ?? CAM_TURNO.volta.giro;
  ang += dt * giro;
  const lx = quem.x;
  const lz = quem.y;
  const ly = elevDe(quem) + 1.05;
  cam.x = lx + Math.sin(ang) * raio;
  cam.y = ly + altura - 1.05;
  cam.z = lz + Math.cos(ang) * raio;
  look.x = lx;
  look.y = ly;
  look.z = lz;
}

function destinoPar(de, para, perto) {
  const cfg = perto ? CAM_TURNO.ombroPerto : CAM_TURNO.ombro;
  const lx = (de.x + para.x) * 0.5;
  const lz = (de.y + para.y) * 0.5;
  const ly = (elevDe(de) + elevDe(para)) * 0.5 + 1.05;
  let dx = para.x - de.x;
  let dz = para.y - de.y;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const sx = -dz;
  const sz = dx;
  cam.x = lx - dx * cfg.dist + sx * cfg.lado;
  cam.y = ly + cfg.altura - 1.05;
  cam.z = lz - dz * cfg.dist + sz * cfg.lado;
  look.x = lx;
  look.y = ly;
  look.z = lz;
}

function destinoTiro(p) {
  const cfg = CAM_TURNO.tiro;
  let dx = p.dirX || 0;
  let dz = p.dirY || 0;
  const destino = p.garantirAlvo;
  if (dx * dx + dz * dz < 1e-6 && destino) {
    dx = destino.x - p.x;
    dz = destino.y - p.y;
  }
  let len = Math.hypot(dx, dz);
  if (len < 1e-4) {
    dx = 1;
    dz = 0;
    len = 1;
  } else {
    dx /= len;
    dz /= len;
  }
  const lx = -dz;
  const lz = dx;
  const py = elevDe(p) + cfg.altura;
  cam.x = p.x - dx * cfg.atras + lx * cfg.lado;
  cam.y = py;
  cam.z = p.y - dz * cfg.atras + lz * cfg.lado;
  look.x = p.x + dx * cfg.olhar;
  look.y = Math.max(1.05, elevDe(p) * 0.35 + 0.95);
  look.z = p.y + dz * cfg.olhar;
}

function resolverDestino(pose, dt) {
  if (!pose) return false;
  if (pose.tipo === "teatro" && pose.a && pose.b) {
    destinoTeatro(pose.a, pose.b, dt);
    return true;
  }
  if (pose.tipo === "volta" && pose.alvo) {
    destinoVolta(pose.alvo, pose, dt);
    return true;
  }
  if (pose.tipo === "tiro" && pose.alvo) {
    destinoTiro(pose.alvo);
    return true;
  }
  if (pose.tipo === "impacto" && pose.alvo) {
    destinoVolta(pose.alvo, pose, dt);
    return true;
  }
  if (pose.de && pose.para) {
    destinoPar(pose.de, pose.para, !!pose.perto);
    return true;
  }
  return false;
}

/**
 * Se houver pose de turno Chrono, sobrescreve a câmera do mundo.
 * @returns {boolean} true se aplicou (pular seguirAlvo3d).
 */
export function aplicarCameraChrono(camera3d, dt) {
  const pose = poseDoQuadro();
  const passo = Math.min(0.05, dt || 0.016);
  if (!resolverDestino(pose, passo)) {
    ativo = false;
    return false;
  }
  ativo = true;
  if (!camera3d?._pos || !camera3d.cam) return true;

  const t = 1 - Math.exp(-10 * passo);
  if (!camera3d.pronta) {
    camera3d._pos.set(cam.x, cam.y, cam.z);
    camera3d._look.set(look.x, look.y, look.z);
    camera3d.pronta = true;
  } else {
    camera3d._pos.x += (cam.x - camera3d._pos.x) * t;
    camera3d._pos.y += (cam.y - camera3d._pos.y) * t;
    camera3d._pos.z += (cam.z - camera3d._pos.z) * t;
    if (!camera3d._look) {
      camera3d.cam.lookAt(look.x, look.y, look.z);
    } else {
      camera3d._look.x += (look.x - camera3d._look.x) * t;
      camera3d._look.y += (look.y - camera3d._look.y) * t;
      camera3d._look.z += (look.z - camera3d._look.z) * t;
    }
  }
  camera3d.cam.position.copy(camera3d._pos);
  if (camera3d._look) camera3d.cam.lookAt(camera3d._look);
  else camera3d.cam.lookAt(look.x, look.y, look.z);
  camera3d.cam.updateMatrixWorld(true);
  camera3d.pivo?.set(look.x, look.y, look.z);
  // Mantém yawCamera() alinhado ao enquadramento de batalha (billboards / strafe).
  camera3d.yaw = yawDeCameraThree(camera3d.cam);
  aplicarProjecao(camera3d, passo);
  return true;
}

export function cameraChronoAtiva() {
  return ativo;
}
