import * as THREE from "three";
import {
  ALTURA_BLOCO,
  FADE_COBERTURA_ALPHA,
  FADE_COBERTURA_RAIO,
  FADE_COBERTURA_RAIO_X,
  FADE_COBERTURA_RAIO_Y,
  FADE_COBERTURA_VEL,
} from "../../config.js";
import { PROPS } from "../../mundo/mapaDemo.js";
import { visitarVegetacaoNaArea } from "../../mundo/bioma/propsBioma.js";
import { alturaEm } from "../../mundo/altura.js";

/** @type {Map<string, { alpha: number, alvo: number }>} */
const fades = new Map();
const cobrindoAgora = new Set();

const EPS_OPACO = 0.004;
const _dirCam = new THREE.Vector3();
const _tmp = new THREE.Vector3();

const SEM_FADE = new Set(["grama", "mata", "placa"]);

function podeFade(prop) {
  if (!prop || prop.oculto) return false;
  if (SEM_FADE.has(prop.tipo)) return false;
  return (
    prop.tipo === "arvore" ||
    prop.tipo === "pedra" ||
    prop.tipo === "cristal" ||
    prop.tipo === "berry" ||
    !!prop.sprite
  );
}

function chaveDe(prop) {
  if (prop.id) return prop.id;
  return `xy:${prop.x},${prop.y}`;
}

function elevFoco(foco) {
  const base = Number.isFinite(foco.elevacao) ? foco.elevacao : foco.z || 0;
  return (base + (foco.hopLift || 0)) * ALTURA_BLOCO + 0.85;
}

function elevProp(prop) {
  const z = alturaEm(Math.floor(prop.x), Math.floor(prop.y));
  const extra = prop.tipo === "arvore" ? 1.6 : 0.7;
  return z * ALTURA_BLOCO + extra;
}

/**
 * Prop cobre o foco se está perto no chão e mais perto da câmera
 * ao longo do olhar.
 */
function cobreFoco(prop, foco, camera) {
  const dx = prop.x - foco.x;
  const dy = prop.y - foco.y;
  const r = FADE_COBERTURA_RAIO;
  if (dx * dx + dy * dy > r * r) return false;

  camera.getWorldDirection(_dirCam);
  const cam = camera.position;
  const yFoco = elevFoco(foco);
  const yProp = elevProp(prop);

  _tmp.set(foco.x - cam.x, yFoco - cam.y, foco.y - cam.z);
  const distFoco = _tmp.dot(_dirCam);
  _tmp.set(prop.x - cam.x, yProp - cam.y, prop.y - cam.z);
  const distProp = _tmp.dot(_dirCam);
  return distProp < distFoco - 0.08;
}

function marcar(foco, camera) {
  cobrindoAgora.clear();
  if (!foco || !camera) return;

  const peX = Math.floor(foco.x);
  const peY = Math.floor(foco.y);
  const x0 = peX - FADE_COBERTURA_RAIO_X;
  const x1 = peX + FADE_COBERTURA_RAIO_X;
  const y0 = peY - FADE_COBERTURA_RAIO_Y;
  const y1 = peY + FADE_COBERTURA_RAIO_Y;

  for (let i = 0; i < PROPS.length; i++) {
    const prop = PROPS[i];
    if (!podeFade(prop)) continue;
    const px = Math.floor(prop.x);
    const py = Math.floor(prop.y);
    if (px < x0 || px > x1 || py < y0 - 2 || py > y1 + 2) continue;
    if (cobreFoco(prop, foco, camera)) cobrindoAgora.add(chaveDe(prop));
  }

  visitarVegetacaoNaArea(x0, y0, x1, y1, (prop) => {
    if (!podeFade(prop)) return;
    if (cobreFoco(prop, foco, camera)) cobrindoAgora.add(chaveDe(prop));
  });
}

/**
 * Atualiza alvos de fade a partir do foco (pokémon ou treinador).
 * Chamar uma vez por frame 3D.
 */
export function tickFadeObstaculo(foco, dt, camera) {
  marcar(foco, camera);

  const t = 1 - Math.exp(-FADE_COBERTURA_VEL * Math.max(0, dt));
  const alphaAlvo = FADE_COBERTURA_ALPHA;

  for (const chave of cobrindoAgora) {
    let e = fades.get(chave);
    if (!e) {
      e = { alpha: 1, alvo: alphaAlvo };
      fades.set(chave, e);
    }
    e.alvo = alphaAlvo;
  }

  for (const [chave, e] of fades) {
    if (!cobrindoAgora.has(chave)) e.alvo = 1;
    e.alpha += (e.alvo - e.alpha) * t;
    if (e.alvo === 1 && e.alpha > 1 - EPS_OPACO) fades.delete(chave);
  }
}

/** Alpha atual do prop (1 = opaco). */
export function alphaDoProp(prop) {
  if (!prop) return 1;
  const e = fades.get(chaveDe(prop));
  return e ? e.alpha : 1;
}

export function limparFadeObstaculo() {
  fades.clear();
  cobrindoAgora.clear();
}
