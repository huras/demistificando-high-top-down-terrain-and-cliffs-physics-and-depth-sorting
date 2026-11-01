/**
 * Solo arado procedural (sulcos) — canteiro de berry e plantação de fazenda.
 */
import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";

export const LIFT_SOLO_ARADO = 0.04;
/** Berry plot (folga). Fazenda usa escala ~1.05 no instancing pra fechar a grade. */
export const LADO_SOLO_ARADO = 0.92;

/** @type {THREE.BufferGeometry | null} */
let geoSolo = null;
/** @type {THREE.CanvasTexture | null} */
let texSoloSeco = null;

export function geoSoloArado() {
  if (geoSolo) return geoSolo;
  geoSolo = new THREE.PlaneGeometry(LADO_SOLO_ARADO, LADO_SOLO_ARADO);
  geoSolo.rotateX(-Math.PI / 2);
  return geoSolo;
}

function texturaSoloProcedural(umido) {
  const tela = document.createElement("canvas");
  tela.width = 32;
  tela.height = 32;
  const ctx = tela.getContext("2d");
  const base = umido ? "#3d2818" : "#6b4426";
  const sulco = umido ? "#2a1a10" : "#4a2e18";
  const borda = umido ? "#241408" : "#3a2414";
  const claro = umido ? "#5a3c24" : "#8a5a32";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = borda;
  ctx.fillRect(0, 0, 32, 2);
  ctx.fillRect(0, 30, 32, 2);
  ctx.fillRect(0, 0, 2, 32);
  ctx.fillRect(30, 0, 2, 32);
  ctx.strokeStyle = sulco;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 6 + i * 5;
    ctx.beginPath();
    ctx.moveTo(3, y);
    ctx.lineTo(29, y + ((i & 1) === 0 ? 1 : -1));
    ctx.stroke();
  }
  ctx.fillStyle = claro;
  for (let n = 0; n < 18; n++) {
    const x = 4 + ((n * 7) % 24);
    const y = 4 + ((n * 11) % 24);
    ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(tela);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mapaSoloArado(umido = false) {
  if (umido) return texturaSoloProcedural(true);
  if (!texSoloSeco) texSoloSeco = texturaSoloProcedural(false);
  return texSoloSeco;
}

export function materialSoloArado(umido = false) {
  return aplicarSombraNuvem(
    new THREE.MeshStandardMaterial({
      map: mapaSoloArado(umido),
      roughness: 1,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
}
