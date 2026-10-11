import * as THREE from "three";
import { CAMERA3D_MOUSE_SENS } from "../config.js";
import { teclaBaixa } from "../entrada/teclado.js";
import { estaEmCena } from "./modoCena.js";
import { caixaDaSelecao, selecionarNoNdc } from "./selecaoCena.js";
import { verCamadaAuxiliar } from "./registroCena.js";

const SENS = CAMERA3D_MOUSE_SENS;
const VELOCIDADE_MIN = 0.5;
const VELOCIDADE_MAX = 80;
const PHI_MIN = 0.08;
const PHI_MAX = Math.PI - 0.08;

const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
verCamadaAuxiliar(cam);

const pivo = new THREE.Vector3();
const frente = new THREE.Vector3();
const direita = new THREE.Vector3();
const cima = new THREE.Vector3(0, 1, 0);
const desloc = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");
const offset = new THREE.Vector3();
const centro = new THREE.Vector3();
const caixa = new THREE.Box3();

let velocidade = 10;
let distPivo = 8;
let olhando = false;
let orbitando = false;
let arrastando = false;
let arrastePx = 0;
let arrastePy = 0;
let ultimoX = 0;
let ultimoY = 0;
let canvas = null;
let ligado = false;

const ndc = new THREE.Vector2();

function tecladoLivre() {
  const tag = document.activeElement?.tagName;
  return tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA";
}

function olharParaFrente() {
  cam.getWorldDirection(frente);
  const horiz = Math.hypot(frente.x, frente.z) || 1;
  distPivo = Math.max(1.5, Math.min(distPivo, 80));
  pivo.set(
    cam.position.x + (frente.x / horiz) * distPivo * horiz,
    cam.position.y + frente.y * distPivo,
    cam.position.z + (frente.z / horiz) * distPivo * horiz,
  );
}

function aplicarOlhar(dx, dy) {
  euler.setFromQuaternion(cam.quaternion, "YXZ");
  euler.y -= dx * SENS;
  euler.x = Math.min(Math.PI / 2 - 0.02, Math.max(-Math.PI / 2 + 0.02, euler.x - dy * SENS));
  cam.quaternion.setFromEuler(euler);
  olharParaFrente();
}

function aplicarOrbita(dx, dy) {
  offset.copy(cam.position).sub(pivo);
  const raio = Math.max(0.4, offset.length());
  let theta = Math.atan2(offset.x, offset.z);
  let phi = Math.acos(THREE.MathUtils.clamp(offset.y / raio, -1, 1));
  theta -= dx * SENS;
  phi = THREE.MathUtils.clamp(phi - dy * SENS, PHI_MIN, PHI_MAX);
  const sinP = Math.sin(phi);
  cam.position.set(
    pivo.x + raio * sinP * Math.sin(theta),
    pivo.y + raio * Math.cos(phi),
    pivo.z + raio * sinP * Math.cos(theta),
  );
  cam.up.copy(cima);
  cam.lookAt(pivo);
  distPivo = raio;
}

function aplicarPan(dx, dy) {
  cam.updateMatrixWorld();
  frente.set(1, 0, 0).applyQuaternion(cam.quaternion);
  const escala = Math.max(0.002, distPivo * 0.0016);
  desloc.copy(frente).multiplyScalar(-dx * escala);
  frente.set(0, 1, 0).applyQuaternion(cam.quaternion);
  desloc.addScaledVector(frente, dy * escala);
  cam.position.add(desloc);
  pivo.add(desloc);
}

function voar(dt) {
  if (!tecladoLivre()) return;
  cam.getWorldDirection(frente);
  direita.crossVectors(frente, cima);
  if (direita.lengthSq() < 1e-6) direita.set(1, 0, 0);
  else direita.normalize();

  let x = 0;
  let y = 0;
  let z = 0;
  if (teclaBaixa("KeyW") || teclaBaixa("ArrowUp")) z += 1;
  if (teclaBaixa("KeyS") || teclaBaixa("ArrowDown")) z -= 1;
  if (teclaBaixa("KeyD") || teclaBaixa("ArrowRight")) x += 1;
  if (teclaBaixa("KeyA") || teclaBaixa("ArrowLeft")) x -= 1;
  if (teclaBaixa("KeyE")) y += 1;
  if (teclaBaixa("KeyQ")) y -= 1;
  if (x === 0 && y === 0 && z === 0) return;

  const inv = 1 / Math.hypot(x, y, z);
  const rapido = teclaBaixa("ShiftLeft") || teclaBaixa("ShiftRight");
  const passo = velocidade * (rapido ? 3.2 : 1) * dt * inv;
  desloc.copy(frente).multiplyScalar(z * passo);
  desloc.addScaledVector(direita, x * passo);
  desloc.addScaledVector(cima, y * passo);
  cam.position.add(desloc);
  pivo.add(desloc);
}

function dolly(deltaY) {
  cam.getWorldDirection(frente);
  const passo = Math.sign(deltaY) * Math.max(0.35, distPivo * 0.09);
  cam.position.addScaledVector(frente, -passo);
  distPivo = Math.max(0.4, cam.position.distanceTo(pivo));
}

function ajustarVelocidade(deltaY) {
  const fator = deltaY > 0 ? 0.88 : 1.14;
  velocidade = THREE.MathUtils.clamp(velocidade * fator, VELOCIDADE_MIN, VELOCIDADE_MAX);
}

function ndcDoEvento(ev) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 1;
  const h = rect.height || 1;
  ndc.set(((ev.clientX - rect.left) / w) * 2 - 1, -((ev.clientY - rect.top) / h) * 2 + 1);
  return ndc;
}

function aoMover(ev) {
  if (!estaEmCena()) return;
  let dx = ev.movementX || 0;
  let dy = ev.movementY || 0;
  if (!olhando && !dx && !dy) {
    dx = ev.clientX - ultimoX;
    dy = ev.clientY - ultimoY;
  }
  ultimoX = ev.clientX;
  ultimoY = ev.clientY;
  if (!dx && !dy) return;
  if (olhando) aplicarOlhar(dx, dy);
  else if (orbitando) aplicarOrbita(dx, dy);
  else if (arrastando) aplicarPan(dx, dy);
  if (orbitando || arrastando || olhando) {
    arrastePx += Math.abs(dx);
    arrastePy += Math.abs(dy);
  }
}

function aoBotaoBaixo(ev) {
  if (!estaEmCena() || !canvas) return;
  if (ev.button === 1 || ev.button === 2) ev.preventDefault();
  ultimoX = ev.clientX;
  ultimoY = ev.clientY;
  if (ev.button === 2) {
    olhando = true;
    arrastePx = 0;
    arrastePy = 0;
    canvas.requestPointerLock?.();
    return;
  }
  if (ev.button === 1) {
    arrastando = true;
    arrastePx = 0;
    arrastePy = 0;
    canvas.setPointerCapture?.(ev.pointerId);
    return;
  }
  if (ev.button !== 0) return;
  arrastePx = 0;
  arrastePy = 0;
  canvas.setPointerCapture?.(ev.pointerId);
  if (ev.altKey) {
    orbitando = true;
    if (ev.detail >= 2) enquadrarSelecaoCena();
  }
}

function aoBotaoCima(ev) {
  if (ev.button === 2) {
    olhando = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    return;
  }
  if (ev.button === 1) {
    arrastando = false;
    return;
  }
  if (ev.button !== 0) return;
  const eraOrbita = orbitando;
  orbitando = false;
  if (!estaEmCena() || !canvas || eraOrbita) return;
  if (arrastePx + arrastePy > 5) return;
  if (ev.detail >= 2) {
    selecionarNoNdc(ndcDoEvento(ev), cam);
    enquadrarSelecaoCena();
    return;
  }
  selecionarNoNdc(ndcDoEvento(ev), cam);
}

function aoTravaMudou() {
  if (document.pointerLockElement !== canvas) olhando = false;
}

function aoSair() {
  olhando = false;
  orbitando = false;
  arrastando = false;
}

export function ligarCameraCena(elemento) {
  if (!elemento || ligado) return;
  canvas = elemento;
  ligado = true;
  canvas.addEventListener("pointerdown", aoBotaoBaixo);
  canvas.addEventListener("pointerup", aoBotaoCima);
  canvas.addEventListener("pointercancel", aoSair);
  canvas.addEventListener("dblclick", (ev) => {
    if (!estaEmCena() || ev.button !== 0 || ev.altKey) return;
    enquadrarSelecaoCena();
  });
  document.addEventListener("mousemove", aoMover);
  document.addEventListener("pointerlockchange", aoTravaMudou);
  window.addEventListener("blur", aoSair);
}

export function obterCameraCena() {
  return cam;
}

export function obterPivoCena() {
  return pivo;
}

export function obterVelocidadeCena() {
  return velocidade;
}

export function sincronizarFarCena(far) {
  if (cam.far === far) return;
  cam.far = far;
  cam.updateProjectionMatrix();
}

export function redimensionarCameraCena(w, h) {
  cam.aspect = w / Math.max(1, h);
  cam.updateProjectionMatrix();
}

/** Copia a câmera do jogo para a vista começar onde o jogador está olhando. */
export function entrarCameraCena(cameraJogo, alvo) {
  cam.position.copy(cameraJogo.position);
  cam.quaternion.copy(cameraJogo.quaternion);
  cam.aspect = cameraJogo.aspect;
  cam.near = cameraJogo.near;
  cam.far = cameraJogo.far;
  cam.up.set(0, 1, 0);
  cam.updateProjectionMatrix();
  if (alvo) {
    pivo.copy(alvo);
    distPivo = Math.max(1.5, cam.position.distanceTo(pivo));
  } else {
    olharParaFrente();
  }
  olhando = false;
  orbitando = false;
  arrastando = false;
}

export function atualizarCameraCena(dt) {
  if (!estaEmCena()) return;
  voar(dt);
}

export function aplicarScrollCena(deltaY) {
  if (!estaEmCena() || !deltaY) return;
  if (olhando) ajustarVelocidade(deltaY);
  else dolly(deltaY);
}

export function yawDaCamera(camera = cam) {
  camera.getWorldDirection(frente);
  return Math.atan2(-frente.x, -frente.z);
}

const eixos = {
  px: new THREE.Vector3(1, 0, 0),
  nx: new THREE.Vector3(-1, 0, 0),
  py: new THREE.Vector3(0, 1, 0),
  ny: new THREE.Vector3(0, -1, 0),
  pz: new THREE.Vector3(0, 0, 1),
  nz: new THREE.Vector3(0, 0, -1),
};

export function alinharCameraCena(eixo) {
  const dir = eixos[eixo];
  if (!dir) return;
  const dist = Math.max(2, cam.position.distanceTo(pivo) || distPivo);
  cam.position.copy(pivo).addScaledVector(dir, dist);
  if (eixo === "py") cam.up.set(0, 0, -1);
  else if (eixo === "ny") cam.up.set(0, 0, 1);
  else cam.up.set(0, 1, 0);
  cam.lookAt(pivo);
  distPivo = dist;
}

export function enquadrarSelecaoCena() {
  if (!caixaDaSelecao(caixa)) return false;
  const raio = Math.max(0.6, caixa.getSize(offset).length() * 0.5);
  caixa.getCenter(centro);
  const fov = (cam.fov * Math.PI) / 180;
  const dist = THREE.MathUtils.clamp((raio / Math.sin(fov * 0.5)) * 1.2, 1.5, 160);
  cam.getWorldDirection(frente);
  if (frente.lengthSq() < 1e-6) frente.set(0, 0, -1);
  cam.position.copy(centro).addScaledVector(frente, -dist);
  pivo.copy(centro);
  cam.up.set(0, 1, 0);
  cam.lookAt(centro);
  distPivo = dist;
  return true;
}
