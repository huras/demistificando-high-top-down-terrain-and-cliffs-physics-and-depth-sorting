/**
 * Overlay 3D: objeto carregado na cabeça + arremessos em voo + mira estilo pokébola.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../config.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { amostrarArcoArremesso, resolverMiraArremesso } from "./arremessar.js";
import { atualizarFxPsiquico } from "./fxPsiquico.js";
import {
  cargaArremesso,
  estaCarregandoForca,
  mirandoArremesso,
  obterCarry,
  obterGrabAction,
  obterThrown,
} from "./sistemaForca.js";

const COR_OK = new THREE.Color(0xffe08a);
const COR_IMPACTO = new THREE.Color(0xfde68a);
const AMOSTRAS = 48;
const ANEL_R_IN = 0.28;
const ANEL_R_OUT = 0.55;

/** @type {THREE.Group | null} */
let grupo = null;
/** @type {THREE.Sprite | null} */
let spriteCarry = null;
/** @type {THREE.Sprite | null} */
let spriteThrow = null;
/** @type {THREE.Line | null} */
let linhaArco = null;
/** @type {THREE.Mesh | null} */
let anelImpacto = null;
/** @type {THREE.Mesh | null} */
let discoImpacto = null;

function garantir() {
  const cen = obterCenario3d();
  const cena = cen?.scene;
  if (!cena) return null;
  if (grupo && grupo.parent === cena) return grupo;
  grupo = new THREE.Group();
  grupo.name = "forca-overlay";
  grupo.renderOrder = 5;
  cena.add(grupo);

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
  const positions = new Float32Array(AMOSTRAS * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, 0);
  const lineMat = new THREE.LineDashedMaterial({
    color: COR_OK,
    dashSize: 0.18,
    gapSize: 0.12,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
  });
  linhaArco = new THREE.Line(geo, lineMat);
  linhaArco.frustumCulled = false;
  linhaArco.renderOrder = 6;
  linhaArco.visible = false;
  grupo.add(linhaArco);

  const geoAnel = new THREE.RingGeometry(ANEL_R_IN, ANEL_R_OUT, 28);
  geoAnel.rotateX(-Math.PI / 2);
  const matAnel = new THREE.MeshBasicMaterial({
    color: COR_IMPACTO,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  anelImpacto = new THREE.Mesh(geoAnel, matAnel);
  anelImpacto.frustumCulled = false;
  anelImpacto.renderOrder = 6;
  anelImpacto.visible = false;
  grupo.add(anelImpacto);

  const geoDisco = new THREE.CircleGeometry(ANEL_R_IN * 0.92, 20);
  geoDisco.rotateX(-Math.PI / 2);
  const matDisco = new THREE.MeshBasicMaterial({
    color: COR_IMPACTO,
    transparent: true,
    opacity: 0.28,
    depthTest: false,
    depthWrite: false,
  });
  discoImpacto = new THREE.Mesh(geoDisco, matDisco);
  discoImpacto.position.y = 0.01;
  anelImpacto.add(discoImpacto);

  return grupo;
}

function liftDoCarrier(carrier, carry) {
  const half = carry?.halfH ?? 0.45;
  return 0.95 + half * 0.35;
}

function ocultarMira() {
  if (linhaArco) linhaArco.visible = false;
  if (anelImpacto) anelImpacto.visible = false;
}

/**
 * @param {object | null} corpo
 * @param {{ x?: number, y?: number } | null} [pointer]
 */
export function atualizarVisualForca(corpo, pointer = null) {
  if (!garantir() || !corpo) {
    if (spriteCarry) spriteCarry.visible = false;
    if (spriteThrow) spriteThrow.visible = false;
    ocultarMira();
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

  // Mira estilo pokébola: arco tracejado + anel no pouso.
  if (estaCarregandoForca() && mirandoArremesso() && carry && linhaArco && anelImpacto) {
    const mira = resolverMiraArremesso(corpo, {
      chargeProgress: cargaArremesso(),
      pointer,
    });
    const arco = amostrarArcoArremesso(corpo, carry, mira.x, mira.y);
    if (arco?.points?.length) {
      const pos = linhaArco.geometry.attributes.position;
      const n = Math.min(arco.points.length, pos.count);
      for (let i = 0; i < n; i++) {
        const p = arco.points[i];
        pos.setXYZ(i, p.x, p.z * ALTURA_BLOCO + 0.2, p.y);
      }
      pos.needsUpdate = true;
      linhaArco.geometry.setDrawRange(0, n);
      linhaArco.geometry.computeBoundingSphere();
      linhaArco.computeLineDistances();
      const carga = cargaArremesso();
      linhaArco.material.opacity = 0.55 + carga * 0.4;
      linhaArco.visible = true;

      const landX = Number.isFinite(arco.landX) ? arco.landX : mira.x;
      const landY = Number.isFinite(arco.landY) ? arco.landY : mira.y;
      const solo =
        alturaSobPes(landX, landY, (corpo.elevacao ?? corpo.z ?? 0) + 2) ||
        corpo.elevacao ||
        corpo.z ||
        0;
      const pulso = 1 + Math.sin(performance.now() * 0.008) * 0.06;
      anelImpacto.visible = true;
      anelImpacto.position.set(landX, solo * ALTURA_BLOCO + 0.03, landY);
      anelImpacto.scale.setScalar(pulso * (0.9 + carga * 0.25));
      anelImpacto.material.opacity = 0.55 + carga * 0.35;
    } else {
      ocultarMira();
    }
  } else {
    ocultarMira();
  }

  atualizarFxPsiquico(0, corpo);
}
