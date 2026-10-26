/**
 * Overlay 3D: objeto carregado na cabeça + arremessos em voo + arco de mira.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../config.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { amostrarArcoArremesso, resolverMiraArremesso } from "./arremessar.js";
import {
  cargaArremesso,
  estaCarregandoForca,
  mirandoArremesso,
  obterCarry,
  obterGrabAction,
  obterThrown,
} from "./sistemaForca.js";

/** @type {THREE.Group | null} */
let grupo = null;
/** @type {THREE.Sprite | null} */
let spriteCarry = null;
/** @type {THREE.Sprite | null} */
let spriteThrow = null;
/** @type {THREE.Line | null} */
let linhaArco = null;
const _pts = [];

function garantir() {
  const cen = obterCenario3d();
  if (!cen?.cena) return null;
  if (grupo && grupo.parent === cen.cena) return grupo;
  grupo = new THREE.Group();
  grupo.name = "forca-overlay";
  cen.cena.add(grupo);

  const mat = new THREE.SpriteMaterial({
    color: 0xc4a574,
    depthTest: true,
    transparent: true,
    opacity: 0.95,
  });
  spriteCarry = new THREE.Sprite(mat.clone());
  spriteCarry.scale.set(0.9, 0.9, 1);
  spriteCarry.visible = false;
  grupo.add(spriteCarry);

  spriteThrow = new THREE.Sprite(mat.clone());
  spriteThrow.scale.set(0.85, 0.85, 1);
  spriteThrow.visible = false;
  grupo.add(spriteThrow);

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(48 * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, 0);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  linhaArco = new THREE.Line(geo, lineMat);
  linhaArco.visible = false;
  grupo.add(linhaArco);

  return grupo;
}

function liftDoCarrier(carrier, carry) {
  const half = carry?.halfH ?? 0.45;
  return 0.95 + half * 0.35;
}

/**
 * @param {object | null} corpo
 * @param {{ x?: number, y?: number } | null} [pointer]
 */
export function atualizarVisualForca(corpo, pointer = null) {
  if (!garantir() || !corpo) {
    if (spriteCarry) spriteCarry.visible = false;
    if (spriteThrow) spriteThrow.visible = false;
    if (linhaArco) linhaArco.visible = false;
    return;
  }

  const grab = obterGrabAction();
  const carry = obterCarry();
  const thrown = obterThrown();

  // Pedra/Pokémon reais já são sincronizados no mundo — placeholder só se não houver entidade.
  const temEntidade =
    !!(carry?.prop || carry?.enemy || grab?.prop || grab?.enemy || thrown[0]?.carry?.prop || thrown[0]?.carry?.enemy);
  if (temEntidade || grab?.failed) {
    spriteCarry.visible = false;
  } else if (carry || (grab && !grab.failed && !grab.struggle)) {
    const progress = grab
      ? Math.min(1, grab.elapsedSec / Math.max(0.01, grab.durationSec))
      : 1;
    const ox = grab?.originX ?? carry?.originX ?? corpo.x;
    const oy = grab?.originY ?? carry?.originY ?? corpo.y;
    const lift = liftDoCarrier(corpo, carry || grab);
    const t = carry ? 1 : progress;
    const x = ox + (corpo.x - ox) * t;
    const y = oy + (corpo.y - oy) * t;
    const zBase = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
    const z = zBase + lift * t * ALTURA_BLOCO;
    spriteCarry.visible = true;
    spriteCarry.position.set(x, z + 0.2, y);
    const w = (carry?.halfW ?? 0.45) * 1.6;
    spriteCarry.scale.set(w, w, 1);
  } else {
    spriteCarry.visible = false;
  }

  // Thrown: entidade real acompanha o voo; sem placeholder.
  spriteThrow.visible = false;

  // Arco de mira
  if (estaCarregandoForca() && mirandoArremesso() && carry) {
    const mira = resolverMiraArremesso(corpo, {
      chargeProgress: cargaArremesso(),
      pointer,
    });
    const arco = amostrarArcoArremesso(corpo, carry, mira.x, mira.y);
    if (arco?.points?.length && linhaArco) {
      const pos = linhaArco.geometry.attributes.position;
      const n = Math.min(arco.points.length, pos.count);
      for (let i = 0; i < n; i++) {
        const p = arco.points[i];
        pos.setXYZ(i, p.x, p.z * ALTURA_BLOCO + 0.2, p.y);
      }
      pos.needsUpdate = true;
      linhaArco.geometry.setDrawRange(0, n);
      linhaArco.visible = true;
    } else if (linhaArco) {
      linhaArco.visible = false;
    }
  } else if (linhaArco) {
    linhaArco.visible = false;
  }

  void _pts;
}
