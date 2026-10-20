import * as THREE from "three";
import { GLSL_MASCARA_AGUA, ligarUniformsMascaraAgua } from "./mascaraAguaPoca.js";

const texVazia = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
texVazia.needsUpdate = true;
texVazia.name = "reflexo-poca-vazio";

/** Mesmos objetos entram em todo material de terreno. Atualizar aqui basta. */
export const uniformsPoca = {
  uPoca: { value: 0 },
  uTempoPoca: { value: 0 },
  uReflexoPoca: { value: texVazia },
  uMatReflexo: { value: new THREE.Matrix4() },
  uPlanoPoca: { value: 0 },
  uTemReflexo: { value: 0 },
};

let nivel = 0;
let tempo = 0;

/**
 * Enche ~0,04/s na chuva cheia e seca ~0,02/s no tempo limpo.
 * Sem céu analítico: só escurece e, com o passe, puxa árvore e estrutura.
 */
export function atualizarPoca(dt, chuva) {
  const c = Math.max(0, Math.min(1, chuva || 0));
  nivel += dt * (0.04 * c - 0.02 * (1 - c));
  if (nivel < 0) nivel = 0;
  else if (nivel > 1) nivel = 1;
  tempo += dt;
  uniformsPoca.uPoca.value = nivel;
  uniformsPoca.uTempoPoca.value = tempo;
}

export const FRAG_POCA = `
uniform float uPoca;
uniform float uTempoPoca;
uniform sampler2D uReflexoPoca;
uniform mat4 uMatReflexo;
uniform float uPlanoPoca;
uniform float uTemReflexo;
${GLSL_MASCARA_AGUA}
float pesoReflexoPoca = 0.0;
float usoReflexoPoca = 0.0;
vec2 uvReflexoPoca = vec2(0.0);

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
`;

export const FRAG_POCA_SAIDA = `
{
  vec3 nPoca = cross(dFdx(vMundoCeu), dFdy(vMundoCeu));
  vec3 paraCamPoca = cameraPosition - vMundoCeu;
  vec3 nrPoca;
  vec3 vistaPoca;
  float nLen = length(nPoca);
  float distPoca = length(paraCamPoca);
  float chaoPoca;
  float campoPoca;
  float limiarPoca;
  float manchaPoca;
  float pesoPoca;
  float ondaPoca;
  float ondaZp;
  float ndvPoca;
  float fresnelPoca;
  float dentroUv;
  float longePlano;
  vec3 pEsp;
  vec4 clipR;
  nPoca = nLen > 1e-5 ? nPoca / nLen : vec3(0.0, 1.0, 0.0);
  if (dot(nPoca, paraCamPoca) < 0.0) nPoca = -nPoca;
  chaoPoca = smoothstep(0.72, 0.9, nPoca.y);
  campoPoca = fbmPoca(vMundoCeu.xz * 0.275);
  limiarPoca = mix(0.62, 0.36, uPoca);
  manchaPoca = smoothstep(limiarPoca, limiarPoca + 0.1, campoPoca) * chaoPoca * secoPoca(vMundoCeu);
  pesoPoca = manchaPoca * uPoca;
  nrPoca = nPoca;
  ondaPoca = sin(vMundoCeu.x * 1.9 + uTempoPoca * 2.6) * sin(vMundoCeu.z * 1.5 - uTempoPoca * 2.1);
  nrPoca.x += ondaPoca * 0.15 * manchaPoca;
  nrPoca.z += sin(vMundoCeu.z * 2.3 + uTempoPoca * 1.8) * 0.1 * manchaPoca;
  nrPoca = normalize(nrPoca);
  vistaPoca = distPoca > 1e-4 ? paraCamPoca / distPoca : vec3(0.0, 1.0, 0.0);
  ndvPoca = max(dot(nrPoca, vistaPoca), 0.0);
  fresnelPoca = mix(0.55, 0.94, pow(1.0 - ndvPoca, 3.0));
  outgoingLight = outgoingLight * mix(vec3(1.0), vec3(0.32, 0.38, 0.44), pesoPoca);
  pesoReflexoPoca = 0.0;
  usoReflexoPoca = 0.0;
  if (uTemReflexo > 0.5 && pesoPoca > 0.001) {
    ondaZp = sin(vMundoCeu.z * 2.3 + uTempoPoca * 1.8);
    pEsp = vMundoCeu;
    pEsp.x += ondaPoca * 0.15 * manchaPoca;
    pEsp.z += ondaZp * 0.1 * manchaPoca;
    pEsp.y = uPlanoPoca * 2.0 - pEsp.y;
    clipR = uMatReflexo * vec4(pEsp, 1.0);
    uvReflexoPoca = clipR.xy / max(clipR.w, 1e-4) * 0.5 + 0.5;
    dentroUv = step(0.0, uvReflexoPoca.x) * step(uvReflexoPoca.x, 1.0);
    dentroUv *= step(0.0, uvReflexoPoca.y) * step(uvReflexoPoca.y, 1.0);
    dentroUv *= step(0.0, clipR.w);
    longePlano = 1.0 - smoothstep(0.45, 2.0, abs(vMundoCeu.y - uPlanoPoca));
    usoReflexoPoca = dentroUv * longePlano;
    pesoReflexoPoca = clamp(pesoPoca * fresnelPoca, 0.0, 0.88);
  }
}
`;

/** O alvo do passe fica linear. O Three só codifica sRGB no canvas. */
export const FRAG_POCA_REFLEXO = `
if (uTemReflexo > 0.5 && pesoReflexoPoca > 0.001 && usoReflexoPoca > 0.001) {
  vec4 texPoca = texture2D(uReflexoPoca, uvReflexoPoca);
  float alfaPoca = texPoca.a * usoReflexoPoca;
  if (alfaPoca > 0.001) {
    gl_FragColor.rgb = mix(gl_FragColor.rgb, texPoca.rgb, pesoReflexoPoca * alfaPoca);
  }
}
`;

export function ligarUniformsPoca(shader) {
  shader.uniforms.uPoca = uniformsPoca.uPoca;
  shader.uniforms.uTempoPoca = uniformsPoca.uTempoPoca;
  shader.uniforms.uReflexoPoca = uniformsPoca.uReflexoPoca;
  shader.uniforms.uMatReflexo = uniformsPoca.uMatReflexo;
  shader.uniforms.uPlanoPoca = uniformsPoca.uPlanoPoca;
  shader.uniforms.uTemReflexo = uniformsPoca.uTemReflexo;
  ligarUniformsMascaraAgua(shader);
}
