import * as THREE from "three";
import { uniformsNuvem } from "./parametros.js";

const RES = 256;
const CELULAS = 5;

let textura = null;
let dadosCpu = null;

function hash2(ix, iy) {
  let n = (ix * 374761393 + iy * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function suave(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

function envolto(i, periodo) {
  const p = periodo | 0;
  return ((i % p) + p) % p;
}

/** Value noise que fecha nas bordas. period precisa ser inteiro. */
function ruido(x, y, periodo) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const p = periodo | 0;
  const h = (ix, iy) => hash2(envolto(ix, p), envolto(iy, p));
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(u, v, oitavas, freq0) {
  let amp = 0.5;
  let soma = 0;
  let norma = 0;
  let freq = freq0;
  for (let i = 0; i < oitavas; i++) {
    soma += amp * ruido(u * freq, v * freq, freq);
    norma += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return soma / norma;
}

/** Worley F1 tileável. u,v em 0..1. */
function worley(u, v) {
  const x = u * CELULAS;
  const y = v * CELULAS;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let menor = 8;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox;
      const cy = iy + oy;
      const wx = envolto(cx, CELULAS);
      const wy = envolto(cy, CELULAS);
      const px = cx + hash2(wx, wy);
      const py = cy + hash2(wy + 17, wx + 3);
      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < menor) menor = d2;
    }
  }
  return Math.sqrt(menor);
}

function criarDados() {
  const dados = new Uint8Array(RES * RES * 4);
  for (let y = 0; y < RES; y++) {
    const v = y / RES;
    for (let x = 0; x < RES; x++) {
      const u = x / RES;
      const macro = fbm(u, v, 4, 2);
      const detalhe = fbm(u, v, 3, 8);
      const celula = worley(u, v);
      const puff = suave(0.05, 0.46, 1 - celula / 0.72);
      const grupo = suave(0.34, 0.78, macro);
      let densidade = puff * grupo;
      densidade = Math.pow(Math.max(0, densidade), 0.8);
      densidade *= 0.82 + 0.18 * detalhe;
      const i = (y * RES + x) * 4;
      dados[i] = Math.max(0, Math.min(255, densidade * 255));
      dados[i + 1] = Math.max(0, Math.min(255, detalhe * 255));
      dados[i + 2] = Math.max(0, Math.min(255, macro * 255));
      dados[i + 3] = 255;
    }
  }
  return dados;
}

function suaveAmostra(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

/** Mesma projeção do shader, pra escurecer sprite que não passa no material do terreno. */
export function fatorSombraMundo(x, y, z) {
  if (!dadosCpu) return 1;
  const escala = uniformsNuvem.uEscalaNuvem.value;
  const vento = uniformsNuvem.uVentoNuvem.value;
  const cisalha = uniformsNuvem.uCisalha.value;
  const altura = uniformsNuvem.uAlturaNuvem.value;
  const limiar = uniformsNuvem.uLimiarNuvem.value;
  const forca = uniformsNuvem.uForcaSombra.value;
  let u = (x + vento.x) * escala + cisalha.x * (altura - y);
  let v = (z + vento.y) * escala + cisalha.y * (altura - y);
  u -= Math.floor(u);
  v -= Math.floor(v);
  const px = Math.min(RES - 1, Math.max(0, (u * RES) | 0));
  const py = Math.min(RES - 1, Math.max(0, (v * RES) | 0));
  const d = dadosCpu[(py * RES + px) * 4] / 255;
  const cobertura = suaveAmostra(limiar, limiar + 0.2, d);
  return 1 - forca * cobertura;
}

/** R = cumulus que faz sombra. G = detalhe / cirrus. Gerado uma vez. */
export function obterMapaNuvem() {
  if (textura) return textura;
  dadosCpu = criarDados();
  textura = new THREE.DataTexture(dadosCpu, RES, RES);
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.generateMipmaps = true;
  textura.flipY = false;
  textura.colorSpace = THREE.NoColorSpace;
  textura.needsUpdate = true;
  return textura;
}
