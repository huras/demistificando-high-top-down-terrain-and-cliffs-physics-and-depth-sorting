/**
 * Câmera Chrono no OW: lateral travada (party esquerda / foe direita).
 * Entrada/saída interpolam posição e olhar; o yaw do overworld é restaurado ao sair.
 */
import {
  ALTURA_BLOCO,
  CAMERA3D_ALTURA,
  CAMERA3D_PITCH_MAX,
  CAMERA3D_PITCH_MIN,
  CHRONO,
} from "../../config.js";
import { aplicarProjecao, yawDeCameraThree } from "../../render/3d/camera3d.js";
import { primeiroTiro } from "../../pokemon/combate/projeteis.js";
import { CAM_CHRONO } from "../cameraTurno.js";
import { observarTiro, poseDisparo, poseImpacto } from "../impacto.js";
import { enquadramentoTurno } from "../turnos.js";

/** @type {"off"|"luta"|"saida"} */
let modo = "off";
/** Eixo de enfrentamento travado no início (foe − party). */
let faceX = 1;
let faceY = 0;
let facePronta = false;
let zoomAtual = 1;
/** Yaw do overworld antes do Chrono (restaurado na saída). */
let yawAntes = NaN;
let saidaT = 0;
/** Tempo desde o engate — entrada usa lerp mais lento. */
let entradaT = 0;

const look = { x: 0, y: 0, z: 0 };
const cam = { x: 0, y: 0, z: 0 };

function resetTotal() {
  modo = "off";
  facePronta = false;
  faceX = 1;
  faceY = 0;
  zoomAtual = 1;
  yawAntes = NaN;
  saidaT = 0;
  entradaT = 0;
}

/**
 * Encerra a luta: inicia blend de volta ao yaw/órbita do overworld.
 * Sem sessão, `aplicarCameraChrono` ainda precisa rodar até a saída terminar.
 */
export function limparCameraChrono() {
  if (modo === "luta") {
    modo = "saida";
    saidaT = 0;
    facePronta = false;
    zoomAtual = 1;
    return;
  }
  resetTotal();
}

function elevDe(ator) {
  return ((ator?.elevacao ?? ator?.z ?? 0) + (ator?.hopLift || 0)) * ALTURA_BLOCO;
}

function vivoCampo(ator) {
  return !!(ator && !ator.morto && !ator.capturado && (ator.hp == null || ator.hp > 0));
}

function primeiroVivo(lista) {
  if (!lista) return null;
  for (let i = 0; i < lista.length; i++) {
    if (vivoCampo(lista[i])) return lista[i];
  }
  return null;
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

function normalizar(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return { x: 1, y: 0, len: 0 };
  return { x: dx / len, y: dy / len, len };
}

function travarFace(party, foe, sess) {
  if (facePronta) return;
  let dx = 0;
  let dy = 0;
  if (party && foe) {
    dx = foe.x - party.x;
    dy = foe.y - party.y;
  } else if (sess) {
    const ox = sess.origemX ?? 0;
    const oy = sess.origemY ?? 0;
    if (party) {
      dx = ox - party.x;
      dy = oy - party.y;
    } else if (foe) {
      dx = foe.x - ox;
      dy = foe.y - oy;
    }
  }
  const n = normalizar(dx, dy);
  faceX = n.x;
  faceY = n.y;
  facePronta = true;
}

function zoomAlvoDaPose(pose) {
  if (!pose) return 1;
  if (pose.tipo === "impacto") return CHRONO.CAM_ZOOM_IMPACTO ?? CAM_CHRONO.zoomImpacto;
  if (pose.tipo === "tiro") return CHRONO.CAM_ZOOM_TIRO ?? CAM_CHRONO.zoomTiro;
  if (pose.perto || pose.tipo === "foco") return CHRONO.CAM_ZOOM_FOCO ?? CAM_CHRONO.zoomFoco;
  return 1;
}

/**
 * Lateral estável: câmera no flanco direito do enfrentamento
 * → party à esquerda da tela, foe à direita.
 */
function destinoLateral(party, foe, pose, dt) {
  const cfgLado = CHRONO.CAM_LADO ?? CAM_CHRONO.lado;
  const cfgAlt = CHRONO.CAM_ALTURA ?? CAM_CHRONO.altura;
  const cfgOlhar = CHRONO.CAM_OLHAR_Y ?? CAM_CHRONO.olharY;
  const porSep = CHRONO.CAM_LADO_POR_SEP ?? CAM_CHRONO.ladoPorSep;

  const px = party?.x ?? foe?.x ?? 0;
  const py = party?.y ?? foe?.y ?? 0;
  const fx = foe?.x ?? px + faceX * 4;
  const fy = foe?.y ?? py + faceY * 4;

  const midX = (px + fx) * 0.5;
  const midZ = (py + fy) * 0.5;
  const midY = (elevDe(party) + elevDe(foe || party)) * 0.5 + cfgOlhar;

  const sep = Math.max(
    CAM_CHRONO.sepMin,
    Math.abs((fx - px) * faceX + (fy - py) * faceY),
  );

  const alvoZoom = zoomAlvoDaPose(pose);
  const kZoom = 1 - Math.exp(-(CAM_CHRONO.zoomLerp || 7.5) * Math.max(0, dt));
  zoomAtual += (alvoZoom - zoomAtual) * kZoom;

  const dist = (cfgLado + sep * porSep) * zoomAtual;

  // Lateral esquerda do face; câmera no +lateral (= flanco esquerdo)
  // → party ( −face ) fica à esquerda da tela, foe ( +face ) à direita.
  const lx = -faceY;
  const ly = faceX;

  cam.x = midX + lx * dist;
  cam.y = midY + cfgAlt - cfgOlhar;
  cam.z = midZ + ly * dist;
  look.x = midX;
  look.y = midY;
  look.z = midZ;
}

/** Destino de órbita OW com o yaw salvo (mesma convenção de poseOrbita). */
function destinoOrbitaOw(camera3d, corpo) {
  const elev = corpo?.elevacao ?? corpo?.z ?? 0;
  const tx = corpo?.x ?? look.x;
  const tz = corpo?.y ?? look.z;
  const tyBase = elev * ALTURA_BLOCO + (camera3d.alturaPivo || 1);
  const yaw = Number.isFinite(yawAntes) ? yawAntes : camera3d.yaw || 0;
  let pitch = Number.isFinite(camera3d.pitchOrbita) ? camera3d.pitchOrbita : 0;
  pitch = Math.max(CAMERA3D_PITCH_MIN, Math.min(CAMERA3D_PITCH_MAX, pitch));
  const dist = Math.max(0.5, camera3d.distancia || 12);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const alturaOmbro = CAMERA3D_ALTURA * 0.35;
  const olharCima = sinP < 0 ? -sinP * dist : 0;
  const olharBaixo = sinP > 0 ? sinP * dist : 0;
  const distH = dist * Math.max(0.15, cosP);

  cam.x = tx + sinY * distH;
  cam.y = tyBase + alturaOmbro + olharBaixo;
  cam.z = tz + cosY * distH;
  look.x = tx;
  look.y = tyBase + olharCima;
  look.z = tz;
}

function taxaLerp(passo, luta) {
  const entrada = CHRONO.CAM_ENTRADA_LERP ?? CAM_CHRONO.entradaLerp ?? 4.2;
  const saida = CHRONO.CAM_SAIDA_LERP ?? CAM_CHRONO.saidaLerp ?? 5.0;
  const normal = CAM_CHRONO.posLerp || 9;
  const janelaEntrada = CHRONO.CAM_ENTRADA_DUR ?? CAM_CHRONO.entradaDur ?? 0.55;
  let taxa = saida;
  if (luta) taxa = entradaT < janelaEntrada ? entrada : normal;
  return 1 - Math.exp(-taxa * Math.max(0, passo));
}

function aplicarPose(camera3d, passo, luta) {
  if (!camera3d?._pos || !camera3d.cam) return;
  const t = taxaLerp(passo, luta);
  if (!camera3d.pronta) {
    camera3d._pos.set(cam.x, cam.y, cam.z);
    if (camera3d._look) camera3d._look.set(look.x, look.y, look.z);
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
  aplicarProjecao(camera3d, passo);
}

/**
 * Sobrescreve a câmera do mundo com framing lateral Chrono (ou blend de saída).
 * @param {object} camera3d
 * @param {number} dt
 * @param {object|null} sess sessão Chrono ativa (`obterSessaoChrono()`)
 * @param {object|null} [corpo] treinador — necessário na saída pra órbita OW
 * @returns {boolean} true se aplicou (pular seguirAlvo3d).
 */
export function aplicarCameraChrono(camera3d, dt, sess, corpo = null) {
  const passo = Math.min(0.05, dt || 0.016);

  if (sess) {
    if (modo !== "luta") {
      if (Number.isFinite(camera3d?.yaw)) yawAntes = camera3d.yaw;
      facePronta = false;
      zoomAtual = 1;
      entradaT = 0;
      modo = "luta";
    }
    entradaT += passo;

    const pose = poseDoQuadro();
    const party =
      primeiroVivo(sess.aliados) ||
      (pose?.a && vivoCampo(pose.a) ? pose.a : null) ||
      (pose?.de && pose.de.faccao === "party" ? pose.de : null);
    const foe =
      primeiroVivo(sess.foes) ||
      (pose?.b && vivoCampo(pose.b) ? pose.b : null) ||
      (pose?.para && pose.para.faccao === "selvagem" ? pose.para : null);

    if (!party && !foe) {
      return modo === "saida";
    }

    travarFace(party, foe, sess);
    destinoLateral(party || foe, foe || party, pose, passo);
    aplicarPose(camera3d, passo, true);
    if (camera3d) camera3d.yaw = yawDeCameraThree(camera3d.cam);
    return true;
  }

  if (modo === "saida") {
    if (Number.isFinite(yawAntes) && camera3d) camera3d.yaw = yawAntes;
    destinoOrbitaOw(camera3d, corpo);
    aplicarPose(camera3d, passo, false);
    if (camera3d) {
      // Mantém yaw OW durante o blend (não herda o yaw lateral da luta).
      if (Number.isFinite(yawAntes)) camera3d.yaw = yawAntes;
      else camera3d.yaw = yawDeCameraThree(camera3d.cam);
    }

    saidaT += passo;
    const dur = CHRONO.CAM_SAIDA_DUR ?? CAM_CHRONO.saidaDur ?? 0.7;
    const dx = (camera3d?._pos?.x ?? cam.x) - cam.x;
    const dy = (camera3d?._pos?.y ?? cam.y) - cam.y;
    const dz = (camera3d?._pos?.z ?? cam.z) - cam.z;
    const perto = dx * dx + dy * dy + dz * dz < 0.04;
    if (saidaT >= dur || perto) {
      if (camera3d && Number.isFinite(yawAntes)) camera3d.yaw = yawAntes;
      resetTotal();
      return false;
    }
    return true;
  }

  return false;
}

export function cameraChronoAtiva() {
  return modo === "luta" || modo === "saida";
}

/** Face travada do enfrentamento (útil pro fade / debug). */
export function faceCameraChrono() {
  return facePronta && modo === "luta" ? { x: faceX, y: faceY } : null;
}
