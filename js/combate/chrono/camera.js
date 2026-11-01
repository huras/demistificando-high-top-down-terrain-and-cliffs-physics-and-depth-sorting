/**
 * Câmera Chrono no overworld: enquadramento estável (sem órbita da arena).
 * Ângulo trava no início da sessão; teatro/escolha/impacto só mudam distância/altura.
 */
import { ALTURA_BLOCO } from "../../config.js";
import { aplicarProjecao, yawDeCameraThree } from "../../render/3d/camera3d.js";
import { primeiroTiro } from "../../pokemon/combate/projeteis.js";
import { CAM_TURNO } from "../cameraTurno.js";
import { observarTiro, poseDisparo, poseImpacto } from "../impacto.js";
import { enquadramentoTurno } from "../turnos.js";

/** Ângulo horizontal fixo da sessão (rad). NaN = ainda não travou. */
let angFixo = NaN;
let ativo = false;
const look = { x: 0, y: 0, z: 0 };
const cam = { x: 0, y: 0, z: 0 };

/** Distâncias/alturas estáveis pro OW (mais baixas que o teatro da arena). */
const OW = Object.freeze({
  escolha: Object.freeze({ raio: 9.5, altura: 6.2 }),
  teatro: Object.freeze({ raio: 11.5, altura: 7.0 }),
  foco: Object.freeze({ raio: 7.2, altura: 4.8 }),
  impacto: Object.freeze({ raio: 8.0, altura: 5.2 }),
});

export function limparCameraChrono() {
  ativo = false;
  angFixo = NaN;
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

/**
 * Trava o ângulo uma vez — mesma convenção de `poseOrbita`
 * (cam em target + (sin(yaw)*r, cos(yaw)*r)), sem flip de 180°.
 */
function garantirAngulo(camera3d) {
  if (Number.isFinite(angFixo)) return;
  // Offset real olho→pivô: preserva a rotação que o jogador já tinha.
  if (camera3d?.cam) {
    const lx = camera3d._look?.x ?? camera3d.pivo?.x;
    const lz = camera3d._look?.z ?? camera3d.pivo?.z;
    if (Number.isFinite(lx) && Number.isFinite(lz)) {
      const dx = camera3d.cam.position.x - lx;
      const dz = camera3d.cam.position.z - lz;
      if (dx * dx + dz * dz > 0.04) {
        angFixo = Math.atan2(dx, dz);
        return;
      }
    }
  }
  if (camera3d && Number.isFinite(camera3d.yaw)) {
    angFixo = camera3d.yaw;
    return;
  }
  angFixo = 0;
}

function enquadrarFixo(lx, ly, lz, raio, altura) {
  const ang = Number.isFinite(angFixo) ? angFixo : 0;
  cam.x = lx + Math.sin(ang) * raio;
  cam.y = ly + altura;
  cam.z = lz + Math.cos(ang) * raio;
  look.x = lx;
  look.y = ly;
  look.z = lz;
}

function centroDe(a, b) {
  return {
    x: (a.x + b.x) * 0.5,
    y: (elevDe(a) + elevDe(b)) * 0.5 + 1.05,
    z: (a.y + b.y) * 0.5,
  };
}

function destinoTeatro(a, b) {
  const c = centroDe(a, b);
  enquadrarFixo(c.x, c.y, c.z, OW.teatro.raio, OW.teatro.altura - 1.05);
}

function destinoVolta(quem) {
  enquadrarFixo(
    quem.x,
    elevDe(quem) + 1.05,
    quem.y,
    OW.escolha.raio,
    OW.escolha.altura - 1.05,
  );
}

function destinoPar(de, para, perto) {
  const c = centroDe(de, para);
  const cfg = perto ? OW.foco : OW.teatro;
  enquadrarFixo(c.x, c.y, c.z, cfg.raio, cfg.altura - 1.05);
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
    dx = Math.sin(angFixo || 0);
    dz = Math.cos(angFixo || 0);
    len = 1;
  } else {
    dx /= len;
    dz /= len;
  }
  // Perfil lateral estável: lado fixo pelo angFixo, sem orbitar.
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

function destinoImpacto(quem) {
  enquadrarFixo(
    quem.x,
    elevDe(quem) + 1.05,
    quem.y,
    OW.impacto.raio,
    OW.impacto.altura - 1.05,
  );
}

function resolverDestino(pose, camera3d) {
  if (!pose) return false;
  garantirAngulo(camera3d);
  if (pose.tipo === "teatro" && pose.a && pose.b) {
    destinoTeatro(pose.a, pose.b);
    return true;
  }
  if (pose.tipo === "volta" && pose.alvo) {
    destinoVolta(pose.alvo);
    return true;
  }
  if (pose.tipo === "tiro" && pose.alvo) {
    destinoTiro(pose.alvo);
    return true;
  }
  if (pose.tipo === "impacto" && pose.alvo) {
    destinoImpacto(pose.alvo);
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
  if (!resolverDestino(pose, camera3d)) {
    ativo = false;
    return false;
  }
  ativo = true;
  if (!camera3d?._pos || !camera3d.cam) return true;

  const t = 1 - Math.exp(-8 * passo);
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
  camera3d.yaw = yawDeCameraThree(camera3d.cam);
  aplicarProjecao(camera3d, passo);
  return true;
}

export function cameraChronoAtiva() {
  return ativo;
}
