import * as THREE from "three";

/** Flash analítico. Não entra no mapa 128 do poste — aquele só regrava quando a assinatura muda. */
const SLOTS_FLASH = 2;
const SLOTS_MARCA = 8;
const RAIO_FLASH = 14;
const GANHO_FLASH = 0.35;
const QUEDA_FLASH = 7.2;
const VIDA_MARCA = 40;
const COR_R = 0.72;
const COR_G = 0.84;
const COR_B = 1;

const flashes = Array.from({ length: SLOTS_FLASH }, () => ({ x: 0, y: 0, z: 0, i: 0 }));
const marcas = Array.from({ length: SLOTS_MARCA }, () => ({ x: 0, z: 0, r: 0, idade: 1 }));
let cursorMarca = 0;

export const uniformsRaio = {
  uFlashRaio: { value: Array.from({ length: SLOTS_FLASH }, () => new THREE.Vector4()) },
  uMarcaRaio: { value: Array.from({ length: SLOTS_MARCA }, () => new THREE.Vector4()) },
};

export const GLSL_FLASH_RAIO = `
uniform vec4 uFlashRaio[2];

vec3 luzRelampago(vec3 mundo) {
  vec3 cor = vec3(0.72, 0.84, 1.0);
  vec3 soma = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec4 f = uFlashRaio[i];
    float vivo = step(0.02, f.w);
    vec3 d = mundo - f.xyz;
    float dist = length(d);
    float t = clamp(1.0 - dist / 14.0, 0.0, 1.0);
    t = t * t;
    t = t * t;
    float queda = 1.0 - smoothstep(6.0, 18.0, abs(d.y));
    soma += cor * (f.w * 0.35 * t * queda * vivo);
  }
  return soma;
}
`;

export const GLSL_MARCA_RAIO_UNIFORM = `
uniform vec4 uMarcaRaio[8];
`;

export const GLSL_MARCA_RAIO = `
{
  vec3 nMarca = cross(dFdx(vMundoCeu), dFdy(vMundoCeu));
  vec3 paraCamMarca = cameraPosition - vMundoCeu;
  float nLenMarca = length(nMarca);
  nMarca = nLenMarca > 1e-5 ? nMarca / nLenMarca : vec3(0.0, 1.0, 0.0);
  if (dot(nMarca, paraCamMarca) < 0.0) nMarca = -nMarca;
  float chaoMarca = smoothstep(0.72, 0.9, nMarca.y);
  float queima = 0.0;
  float rachadura = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 m = uMarcaRaio[i];
    float ativo = step(0.05, m.z) * (1.0 - step(1.0, m.w));
    vec2 d = vMundoCeu.xz - m.xy;
    float dist = length(d);
    float irregular = hashPoca(vMundoCeu.xz * 2.7 + m.xy);
    float alcance = m.z * mix(0.82, 1.08, irregular);
    float disco = 1.0 - smoothstep(alcance * 0.28, alcance, dist);
    float peso = disco * (1.0 - m.w) * ativo * chaoMarca;
    queima = max(queima, peso);
    if (dist < alcance && ativo > 0.5) {
      float ang = atan(d.y, d.x);
      float semente = hashPoca(m.xy);
      for (int k = 0; k < 5; k++) {
        float alvo = (hashPoca(m.xy + vec2(float(k) + 1.0, semente)) * 2.0 - 1.0) * 3.14159;
        float j = hashPoca(vec2(floor(dist * 5.0), float(k) + semente)) - 0.5;
        float dif = abs(atan(sin(ang - alvo - j * 0.4), cos(ang - alvo - j * 0.4)));
        float largura = mix(0.11, 0.018, clamp(dist / alcance, 0.0, 1.0));
        float linha = 1.0 - smoothstep(0.0, largura, dif);
        float corpo = smoothstep(0.04, alcance * 0.2, dist) * (1.0 - smoothstep(alcance * 0.72, alcance, dist));
        rachadura = max(rachadura, linha * corpo * (1.0 - m.w) * chaoMarca);
      }
    }
  }
  outgoingLight *= mix(vec3(1.0), vec3(0.08, 0.07, 0.06), queima * 0.85);
  outgoingLight *= mix(1.0, 0.04, rachadura);
}
`;

function suave(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

function escreverFlash() {
  const arr = uniformsRaio.uFlashRaio.value;
  for (let i = 0; i < SLOTS_FLASH; i++) {
    const f = flashes[i];
    arr[i].set(f.x, f.y, f.z, f.i);
  }
}

function escreverMarcas() {
  const arr = uniformsRaio.uMarcaRaio.value;
  for (let i = 0; i < SLOTS_MARCA; i++) {
    const m = marcas[i];
    arr[i].set(m.x, m.z, m.r, m.idade);
  }
}

export function registrarFlashRaio(x, y, z) {
  let slot = 0;
  for (let i = 0; i < SLOTS_FLASH; i++) {
    if (flashes[i].i <= 0.02) {
      slot = i;
      break;
    }
    if (flashes[i].i < flashes[slot].i) slot = i;
  }
  const f = flashes[slot];
  f.x = x;
  f.y = y;
  f.z = z;
  f.i = 1;
  escreverFlash();
}

export function registrarMarcaRaio(x, z) {
  const m = marcas[cursorMarca];
  cursorMarca = (cursorMarca + 1) % SLOTS_MARCA;
  m.x = x;
  m.z = z;
  m.r = 1.9 + Math.random() * 0.6;
  m.idade = 0;
  escreverMarcas();
}

export function tickMarcaRaio(dt) {
  const seguro = Math.min(Math.max(dt || 0, 0), 0.05);
  if (seguro <= 0) return;
  const queda = Math.exp(-seguro * QUEDA_FLASH);
  let flashMudou = false;
  for (let i = 0; i < SLOTS_FLASH; i++) {
    if (flashes[i].i <= 0) continue;
    flashes[i].i *= queda;
    if (flashes[i].i < 0.02) flashes[i].i = 0;
    flashMudou = true;
  }
  const passo = seguro / VIDA_MARCA;
  let marcaMudou = false;
  for (let i = 0; i < SLOTS_MARCA; i++) {
    const m = marcas[i];
    if (m.r <= 0 || m.idade >= 1) continue;
    m.idade += passo;
    if (m.idade >= 1) {
      m.idade = 1;
      m.r = 0;
    }
    marcaMudou = true;
  }
  if (flashMudou) escreverFlash();
  if (marcaMudou) escreverMarcas();
}

/** Mesmo termo cru do shader, antes do clarear do poste. Sprites não passam no material. */
export function somarFlashRaio(x, y, z, destino) {
  for (let i = 0; i < SLOTS_FLASH; i++) {
    const f = flashes[i];
    if (f.i <= 0.02) continue;
    const dx = x - f.x;
    const dy = y - f.y;
    const dz = z - f.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist >= RAIO_FLASH) continue;
    let t = 1 - dist / RAIO_FLASH;
    t = t * t;
    t = t * t;
    const quedaY = 1 - suave(6, 18, Math.abs(dy));
    const w = f.i * GANHO_FLASH * t * quedaY;
    destino.r += COR_R * w;
    destino.g += COR_G * w;
    destino.b += COR_B * w;
  }
  return destino;
}
