import * as THREE from "three";
import { ALTURA_BLOCO } from "../../../config.js";
import { nivelMarBlocos } from "../../../mundo/bioma/catalogo.js";
import { colunaAgua } from "../../../mundo/agua/fluxo.js";

/** Grade leve em volta da câmera: 1 = água parada, 0 = seco. */
const LADO = 64;
const METROS = 96;
const PASSO = 4;

const dados = new Uint8Array(LADO * LADO);
const textura = new THREE.DataTexture(dados, LADO, LADO, THREE.RedFormat, THREE.UnsignedByteType);
textura.wrapS = THREE.ClampToEdgeWrapping;
textura.wrapT = THREE.ClampToEdgeWrapping;
textura.magFilter = THREE.LinearFilter;
textura.minFilter = THREE.LinearFilter;
textura.generateMipmaps = false;
textura.flipY = false;
textura.colorSpace = THREE.NoColorSpace;
textura.needsUpdate = true;
textura.name = "mascara-agua-poca";

let origemX = Number.NaN;
let origemZ = Number.NaN;

export const uniformsMascaraAgua = {
  uMapaAguaPoca: { value: textura },
  uOrigemAguaPoca: { value: new THREE.Vector2() },
  uTexelAguaPoca: { value: 1 / METROS },
  /** Cota mundial do oceano. Abaixo disso = leito — nunca poça. */
  uNivelMar: { value: 12 },
};

/**
 * 1 = pode encharcar; 0 = água / fundo submerso.
 * Fora do atlas local a máscara não cobre o LOD horizonte: a cota do mar
 * é a guarda global (oceano infinito sem poça no leito).
 */
export const GLSL_MASCARA_AGUA = `
uniform sampler2D uMapaAguaPoca;
uniform vec2 uOrigemAguaPoca;
uniform float uTexelAguaPoca;
uniform float uNivelMar;

float secoPoca(vec3 mundo) {
  if (mundo.y < uNivelMar) return 0.0;
  vec2 uv = (mundo.xz - uOrigemAguaPoca) * uTexelAguaPoca;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 1.0;
  return 1.0 - texture2D(uMapaAguaPoca, uv).r;
}
`;

export function ligarUniformsMascaraAgua(shader) {
  shader.uniforms.uMapaAguaPoca = uniformsMascaraAgua.uMapaAguaPoca;
  shader.uniforms.uOrigemAguaPoca = uniformsMascaraAgua.uOrigemAguaPoca;
  shader.uniforms.uTexelAguaPoca = uniformsMascaraAgua.uTexelAguaPoca;
  shader.uniforms.uNivelMar = uniformsMascaraAgua.uNivelMar;
}

/** Mantém a cota do oceano alinhada ao catálogo (barato, idempotente). */
export function sincronizarNivelMarPoca() {
  uniformsMascaraAgua.uNivelMar.value = nivelMarBlocos() * ALTURA_BLOCO;
}

/**
 * Reestampa só quando a câmera muda de célula.
 * Coluna com superfície e sem queda = lago, rio ou mar.
 */
export function resolverMascaraAguaPoca(camX, camZ) {
  sincronizarNivelMarPoca();
  const ox = Math.floor(camX / PASSO) * PASSO - METROS * 0.5;
  const oz = Math.floor(camZ / PASSO) * PASSO - METROS * 0.5;
  if (ox === origemX && oz === origemZ) return;
  origemX = ox;
  origemZ = oz;
  uniformsMascaraAgua.uOrigemAguaPoca.value.set(ox, oz);
  const passo = METROS / LADO;
  for (let j = 0; j < LADO; j++) {
    const wz = oz + (j + 0.5) * passo;
    const base = j * LADO;
    for (let i = 0; i < LADO; i++) {
      const agua = colunaAgua(ox + (i + 0.5) * passo, wz);
      dados[base + i] = agua.superficie > 0 && !agua.caindo ? 255 : 0;
    }
  }
  textura.needsUpdate = true;
}
