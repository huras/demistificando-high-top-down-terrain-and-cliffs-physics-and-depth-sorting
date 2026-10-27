/**
 * VFX psíquico: Wind_01 billboard girando no centro da pedra/corpo + rastro curto no throw.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../config.js";
import {
  carregarCatalogoElemental,
  texturaElemental,
} from "../efeitos/elemental.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { temTipoPsiquico } from "./psiquico.js";
import {
  obterCarry,
  obterCarryOwner,
  obterGrabAction,
  obterGrabActor,
  obterThrown,
} from "./sistemaForca.js";

const COR = 0xec4899;
const WIND_ID = "Wind_01";
const GLOW_ID = "Glow_01";
const SPIN_RAD_S = 2.6;

/** @type {THREE.Group | null} */
let grupo = null;
/** @type {THREE.Sprite | null} */
let wind = null;
/** @type {THREE.Sprite | null} */
let glow = null;
/** @type {THREE.Sprite | null} */
let rastroA = null;
/** @type {THREE.Sprite | null} */
let rastroB = null;
/** @type {Map<string, THREE.Texture>} */
const texCache = new Map();
/** @type {Set<string>} */
const pedindo = new Set();
let angulo = 0;
let ultimoT = 0;

function pedirTex(id) {
  if (texCache.has(id)) return texCache.get(id);
  const meta = texturaElemental(id);
  if (!meta?.path || pedindo.has(id) || typeof Image === "undefined") return null;
  pedindo.add(id);
  const img = new Image();
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    texCache.set(id, tex);
    const lista = [wind, glow, rastroA, rastroB];
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i];
      if (s?.userData.texId === id && s.material.map !== tex) {
        s.material.map = tex;
        s.material.needsUpdate = true;
      }
    }
  };
  img.src = meta.path.startsWith("/") ? meta.path : `/${meta.path}`;
  return null;
}

function criarSprite(id, ordem) {
  const map = pedirTex(id) || null;
  const mat = new THREE.SpriteMaterial({
    map,
    color: COR,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    opacity: 0,
    toneMapped: false,
    rotation: 0,
  });
  const s = new THREE.Sprite(mat);
  s.userData.texId = id;
  s.visible = false;
  s.frustumCulled = false;
  s.renderOrder = ordem;
  s.center.set(0.5, 0.5);
  s.scale.set(1.2, 1.2, 1);
  return s;
}

function garantir() {
  const cen = obterCenario3d();
  if (!cen?.cena) return null;
  if (grupo && grupo.parent === cen.cena) return grupo;
  void carregarCatalogoElemental();
  grupo = new THREE.Group();
  grupo.name = "forca-psiquico-fx";
  cen.cena.add(grupo);
  wind = criarSprite(WIND_ID, 9);
  glow = criarSprite(GLOW_ID, 8);
  rastroA = criarSprite(WIND_ID, 7);
  rastroB = criarSprite(GLOW_ID, 7);
  grupo.add(wind, glow, rastroA, rastroB);
  pedirTex(WIND_ID);
  pedirTex(GLOW_ID);
  return grupo;
}

function posEntidade(ent) {
  if (!ent) return null;
  const z = Number(ent.z ?? ent.elevacao ?? 0) || 0;
  return { x: ent.x, y: ent.y, z };
}

function alvoAtual(grab, carry) {
  const prop = carry?.prop || grab?.prop;
  const enemy = carry?.enemy || grab?.enemy;
  return posEntidade(prop || enemy);
}

function halfDoAlvo(grab, carry) {
  const prop = carry?.prop || grab?.prop;
  const enemy = carry?.enemy || grab?.enemy;
  if (prop) return Math.max(0.35, Number(prop.r) || Number(carry?.halfW) || 0.45);
  if (enemy) return Math.max(0.35, Number(enemy.r) || Number(carry?.halfW) || 0.45);
  return Math.max(0.35, Number(carry?.halfW) || 0.45);
}

/**
 * @param {THREE.Sprite | null} s
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} escala
 * @param {number} opacidade
 * @param {number} [rot]
 */
function mostrar(s, x, y, z, escala, opacidade, rot = 0) {
  if (!s) return;
  s.visible = true;
  s.position.set(x, Math.max(0.05, z * ALTURA_BLOCO), y);
  s.scale.set(escala, escala, 1);
  s.material.opacity = opacidade;
  s.material.rotation = rot;
}

function ocultar(s) {
  if (!s) return;
  s.visible = false;
  s.material.opacity = 0;
}

/**
 * @param {number} dt
 * @param {object | null} [carrierHint]
 */
export function atualizarFxPsiquico(dt, carrierHint = null) {
  if (!garantir()) return;

  const agora = performance.now() * 0.001;
  const dtEf =
    Number.isFinite(dt) && dt > 0
      ? dt
      : ultimoT
        ? Math.min(0.05, Math.max(0.001, agora - ultimoT))
        : 1 / 60;
  ultimoT = agora;
  angulo += dtEf * SPIN_RAD_S;

  const grab = obterGrabAction();
  const carry = obterCarry();
  const thrown = obterThrown();
  const dono = obterCarryOwner() || obterGrabActor() || carrierHint;
  const psiquico =
    !!(dono && temTipoPsiquico(dono) && (carry || (grab && !grab.failed)));

  if (psiquico) {
    const alvo = alvoAtual(grab, carry);
    const progress = grab
      ? Math.min(1, grab.elapsedSec / Math.max(0.01, grab.durationSec))
      : 1;
    if (alvo) {
      const half = halfDoAlvo(grab, carry);
      const pulse = 0.92 + 0.08 * Math.sin(agora * 5.5);
      const escWind = (1.15 + half * 1.1) * (0.55 + 0.45 * progress) * pulse;
      const escGlow = escWind * 0.55;
      // Centro na pedra — Wind_01 girando (poder psíquico).
      mostrar(
        wind,
        alvo.x,
        alvo.y,
        alvo.z + half * 0.15,
        escWind,
        (0.4 + 0.45 * progress) * pulse,
        angulo,
      );
      mostrar(
        glow,
        alvo.x,
        alvo.y,
        alvo.z + half * 0.2,
        escGlow,
        (0.22 + 0.28 * progress) * pulse,
        -angulo * 0.65,
      );
    } else {
      ocultar(wind);
      ocultar(glow);
    }
  } else {
    ocultar(wind);
    ocultar(glow);
  }

  // Rastro curto no projétil psíquico
  let mostrouRastro = false;
  for (let i = 0; i < thrown.length; i++) {
    const voo = thrown[i];
    if (!voo || voo.phase !== "air") continue;
    const thrower = voo.thrower;
    if (!temTipoPsiquico(thrower) && !thrower?._forcaPsiquico) continue;
    const age = voo.age || 0;
    if (age > 0.55) continue;
    const fade = 1 - age / 0.55;
    mostrar(
      rastroA,
      voo.x,
      voo.y,
      (voo.z ?? 0) + 0.2,
      0.85 * fade + 0.25,
      0.5 * fade,
      angulo * 1.4,
    );
    mostrar(
      rastroB,
      voo.x - (voo.vx || 0) * 0.05,
      voo.y - (voo.vy || 0) * 0.05,
      (voo.z ?? 0) + 0.12,
      0.55 * fade,
      0.28 * fade,
      -angulo,
    );
    mostrouRastro = true;
    break;
  }
  if (!mostrouRastro) {
    ocultar(rastroA);
    ocultar(rastroB);
  }
}

export function limparFxPsiquico() {
  ocultar(wind);
  ocultar(glow);
  ocultar(rastroA);
  ocultar(rastroB);
}
