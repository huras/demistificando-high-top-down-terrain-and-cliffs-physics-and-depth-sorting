import * as THREE from "three";

const texVazia = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
texVazia.needsUpdate = true;
texVazia.name = "reflexo-poca-vazio";

/** Mesmos objetos entram em todo material de terreno. Atualizar aqui basta. */
export const uniformsPoca = {
  uPoca: { value: 0 },
  uTempoPoca: { value: 0 },
  uCorZenite: { value: new THREE.Color() },
  uCorHorizonte: { value: new THREE.Color() },
  uCorSol: { value: new THREE.Color() },
  uDirSol: { value: new THREE.Vector3(0, 1, 0) },
  uBrilhoSol: { value: 1 },
  uReflexoPoca: { value: texVazia },
  uMatReflexo: { value: new THREE.Matrix4() },
  uPlanoPoca: { value: 0 },
  uTemReflexo: { value: 0 },
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
uniform sampler2D uReflexoPoca;
uniform mat4 uMatReflexo;
uniform float uPlanoPoca;
uniform float uTemReflexo;
float pesoReflexoPoca = 0.0;
float usoReflexoPoca = 0.0;
vec2 uvReflexoPoca = vec2(0.0);
vec3 ceuFallbackPoca = vec3(0.0);

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
  pesoReflexoPoca = 0.0;
  usoReflexoPoca = 0.0;
  if (uTemReflexo < 0.5) {
    outgoingLight = mix(escuroPoca, ceuRef, clamp(pesoPoca * fresnelPoca, 0.0, 0.88));
  } else {
    outgoingLight = escuroPoca;
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
    ceuFallbackPoca = ceuRef;
  }
}
`;

/** O alvo do passe fica linear. O Three só codifica sRGB no canvas. */
export const FRAG_POCA_REFLEXO = `
if (uTemReflexo > 0.5 && pesoReflexoPoca > 0.001) {
  vec3 amostraPoca = ceuFallbackPoca;
  #ifdef TONE_MAPPING
    amostraPoca = toneMapping(amostraPoca);
  #endif
  if (usoReflexoPoca > 0.001) {
    vec3 texPoca = texture2D(uReflexoPoca, uvReflexoPoca).rgb;
    amostraPoca = mix(amostraPoca, texPoca, usoReflexoPoca);
  }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, amostraPoca, pesoReflexoPoca);
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
  shader.uniforms.uReflexoPoca = uniformsPoca.uReflexoPoca;
  shader.uniforms.uMatReflexo = uniformsPoca.uMatReflexo;
  shader.uniforms.uPlanoPoca = uniformsPoca.uPlanoPoca;
  shader.uniforms.uTemReflexo = uniformsPoca.uTemReflexo;
}
