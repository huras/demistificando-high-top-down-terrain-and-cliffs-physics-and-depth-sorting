import * as THREE from "three";

/** Mesmos objetos entram em todo material de terreno. Atualizar aqui basta. */
export const uniformsPoca = {
  uPoca: { value: 0 },
  uTempoPoca: { value: 0 },
  uCorZenite: { value: new THREE.Color() },
  uCorHorizonte: { value: new THREE.Color() },
  uCorSol: { value: new THREE.Color() },
  uDirSol: { value: new THREE.Vector3(0, 1, 0) },
  uBrilhoSol: { value: 1 },
};

let nivel = 0;
let tempo = 0;

/**
 * Enche ~0,04/s na chuva cheia e seca ~0,02/s no tempo limpo.
 * As cores são as mesmas do domo, já em linear.
 */
export function atualizarPoca(dt, chuva, visual) {
  const c = Math.max(0, Math.min(1, chuva || 0));
  nivel += dt * (0.04 * c - 0.02 * (1 - c));
  if (nivel < 0) nivel = 0;
  else if (nivel > 1) nivel = 1;
  tempo += dt;
  uniformsPoca.uPoca.value = nivel;
  uniformsPoca.uTempoPoca.value = tempo;
  if (!visual) return;
  uniformsPoca.uCorZenite.value.copy(visual.zenite);
  uniformsPoca.uCorHorizonte.value.copy(visual.horizonte);
  uniformsPoca.uCorSol.value.copy(visual.sol);
  uniformsPoca.uDirSol.value.copy(visual.dirSol);
  uniformsPoca.uBrilhoSol.value = visual.brilhoSol;
}

export const FRAG_POCA = `
uniform float uPoca;
uniform float uTempoPoca;
uniform vec3 uCorZenite;
uniform vec3 uCorHorizonte;
uniform vec3 uCorSol;
uniform vec3 uDirSol;
uniform float uBrilhoSol;

float hashPoca(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valorPoca(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hashPoca(i);
  float b = hashPoca(i + vec2(1.0, 0.0));
  float c = hashPoca(i + vec2(0.0, 1.0));
  float d = hashPoca(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbmPoca(vec2 p) {
  return valorPoca(p) * 0.66 + valorPoca(p * 2.0 + vec2(19.2, 7.7)) * 0.34;
}

vec3 ceuPoca(vec3 rd) {
  float h = rd.y;
  float acima = clamp(h, 0.0, 1.0);
  vec3 ceu = mix(uCorZenite, uCorHorizonte, pow(1.0 - acima, 2.4));
  float sol = max(dot(rd, uDirSol), 0.0);
  ceu += uCorSol * pow(sol, 48.0) * 0.55 * uBrilhoSol;
  if (h < 0.0) ceu = mix(uCorHorizonte, ceu, smoothstep(-0.35, 0.0, h));
  return ceu;
}
`;

export const FRAG_POCA_SAIDA = `
{
  vec3 nPoca = cross(dFdx(vMundoCeu), dFdy(vMundoCeu));
  vec3 paraCamPoca = cameraPosition - vMundoCeu;
  vec3 nrPoca;
  vec3 vistaPoca;
  vec3 rdPoca;
  vec3 escuroPoca;
  vec3 ceuRef;
  float nLen = length(nPoca);
  float distPoca = length(paraCamPoca);
  float chaoPoca;
  float campoPoca;
  float limiarPoca;
  float manchaPoca;
  float pesoPoca;
  float ondaPoca;
  float ndvPoca;
  float fresnelPoca;
  nPoca = nLen > 1e-5 ? nPoca / nLen : vec3(0.0, 1.0, 0.0);
  if (dot(nPoca, paraCamPoca) < 0.0) nPoca = -nPoca;
  chaoPoca = smoothstep(0.72, 0.9, nPoca.y);
  campoPoca = fbmPoca(vMundoCeu.xz * 0.275);
  limiarPoca = mix(0.62, 0.36, uPoca);
  manchaPoca = smoothstep(limiarPoca, limiarPoca + 0.1, campoPoca) * chaoPoca;
  pesoPoca = manchaPoca * uPoca;
  nrPoca = nPoca;
  ondaPoca = sin(vMundoCeu.x * 1.9 + uTempoPoca * 2.6) * sin(vMundoCeu.z * 1.5 - uTempoPoca * 2.1);
  nrPoca.x += ondaPoca * 0.15 * manchaPoca;
  nrPoca.z += sin(vMundoCeu.z * 2.3 + uTempoPoca * 1.8) * 0.1 * manchaPoca;
  nrPoca = normalize(nrPoca);
  vistaPoca = distPoca > 1e-4 ? paraCamPoca / distPoca : vec3(0.0, 1.0, 0.0);
  rdPoca = reflect(-vistaPoca, nrPoca);
  ndvPoca = max(dot(nrPoca, vistaPoca), 0.0);
  fresnelPoca = mix(0.55, 0.94, pow(1.0 - ndvPoca, 3.0));
  escuroPoca = outgoingLight * mix(vec3(1.0), vec3(0.32, 0.38, 0.44), pesoPoca);
  ceuRef = max(ceuPoca(rdPoca), vec3(0.18, 0.24, 0.32));
  outgoingLight = mix(escuroPoca, ceuRef, clamp(pesoPoca * fresnelPoca, 0.0, 0.88));
}
`;

export function ligarUniformsPoca(shader) {
  shader.uniforms.uPoca = uniformsPoca.uPoca;
  shader.uniforms.uTempoPoca = uniformsPoca.uTempoPoca;
  shader.uniforms.uCorZenite = uniformsPoca.uCorZenite;
  shader.uniforms.uCorHorizonte = uniformsPoca.uCorHorizonte;
  shader.uniforms.uCorSol = uniformsPoca.uCorSol;
  shader.uniforms.uDirSol = uniformsPoca.uDirSol;
  shader.uniforms.uBrilhoSol = uniformsPoca.uBrilhoSol;
}
