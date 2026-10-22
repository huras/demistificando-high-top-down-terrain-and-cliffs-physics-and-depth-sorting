import * as THREE from "three";
import { CLIMA_CFG } from "../../../clima/config.js";
import { ALTURA_CIRRUS, ESCALA_NUVEM, uniformsNuvem } from "./parametros.js";

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec3 vDir;

uniform vec3 uDirSol;
uniform vec3 uDirLua;
uniform vec3 uCorZenite;
uniform vec3 uCorHorizonte;
uniform vec3 uCorChao;
uniform vec3 uCorNeblina;
uniform vec3 uCorSol;
uniform vec3 uCorLua;
uniform vec3 uCorNuvemLuz;
uniform vec3 uCorNuvemSombra;
uniform float uBrilhoSol;
uniform float uBrilhoLua;
uniform float uEstrelas;
uniform float uTempo;
uniform float uFlash;
uniform float uAlturaNuvem;
uniform float uAlturaCirrus;
uniform float uEscalaNuvem;
uniform float uLimiarNuvem;
uniform float uPesoCirrus;
uniform float uUmidade;
uniform float uMorph;
uniform float uEstica;
uniform float uBordaExtra;
uniform vec2 uVentoNuvem;
uniform sampler2D uMapaNuvem;

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

vec3 atmosfera(vec3 rd) {
  float h = rd.y;
  float acima = clamp(h, 0.0, 1.0);
  vec3 ceu = mix(uCorZenite, uCorHorizonte, pow(1.0 - acima, 2.65));
  float sol = max(dot(rd, uDirSol), 0.0);
  float baixo = pow(sol, 6.0) * pow(1.0 - acima, 3.0);
  ceu += uCorSol * baixo * 0.4 * uBrilhoSol;
  ceu += uCorSol * pow(sol, 8.0) * 0.16 * uBrilhoSol;
  ceu += uCorSol * pow(sol, 64.0) * 0.42 * uBrilhoSol;
  float disco = smoothstep(0.99945, 0.99972, sol);
  float membro = pow(max(sol, 0.0), 1800.0);
  ceu += uCorSol * (disco * 3.2 + membro * 0.9) * uBrilhoSol;

  float lua = max(dot(rd, uDirLua), 0.0);
  float discoLua = smoothstep(0.99962, 0.99984, lua);
  ceu += uCorLua * discoLua * uBrilhoLua * 2.1;
  ceu += uCorLua * pow(lua, 90.0) * 0.18 * uBrilhoLua;

  if (uEstrelas > 0.001 && h > -0.02) {
    vec3 g = floor(normalize(rd) * 270.0);
    float n = hash13(g);
    float s = smoothstep(0.986, 0.998, n);
    float tw = 0.62 + 0.38 * sin(uTempo * 1.7 + n * 48.0);
    float apaga = smoothstep(-0.05, 0.22, uBrilhoSol);
    ceu += vec3(0.85, 0.9, 1.0) * s * tw * uEstrelas * (1.0 - apaga);
  }

  if (h < 0.0) {
    ceu = mix(uCorHorizonte, uCorChao * 0.65, smoothstep(0.0, -0.5, h));
  }
  float banda = smoothstep(0.1, -0.02, h);
  ceu = mix(ceu, uCorNeblina, banda * 0.85);
  return ceu;
}

vec3 camada(vec3 rd, vec3 ro, vec3 ceu, float altura, vec2 vento, float escala, float limiar, float pesoMax, float canalCirrus) {
  float denom = rd.y;
  if (abs(denom) < 0.0015) return ceu;
  float t = (altura - ro.y) / denom;
  if (t < 0.0) return ceu;
  vec3 hit = ro + rd * t;

  float umid = clamp(uUmidade * uMorph, 0.0, 1.0);
  // Stratus: alonga no eixo do vento (mundo XZ).
  vec2 eixoV = length(vento) > 1e-4 ? normalize(vento) : vec2(1.0, 0.0);
  vec2 eixoP = vec2(-eixoV.y, eixoV.x);
  vec2 local = hit.xz + vento;
  float along = 1.0 + umid * uEstica;
  vec2 esticado = eixoV * dot(local, eixoV) / along + eixoP * dot(local, eixoP) * (1.0 + umid * uEstica * 0.35);
  vec2 uv = esticado * escala;

  vec4 mapa = texture2D(uMapaNuvem, uv);
  float puff = canalCirrus > 0.5 ? mapa.g : mapa.r;
  float macro = mapa.b;
  // Umidade: manto (macro) no lugar de bolhas Worley.
  float sheet = smoothstep(0.22, 0.78, macro) * (0.55 + 0.45 * mapa.g);
  float d = mix(puff, sheet, umid * (canalCirrus > 0.5 ? 0.35 : 1.0));

  vec2 uvSol = uv - uDirSol.xz * escala * (canalCirrus > 0.5 ? 14.0 : 22.0);
  vec4 mapaSol = texture2D(uMapaNuvem, uvSol);
  float dSolPuff = canalCirrus > 0.5 ? mapaSol.g : mapaSol.r;
  float dSolSheet = smoothstep(0.22, 0.78, mapaSol.b) * (0.55 + 0.45 * mapaSol.g);
  float dSol = mix(dSolPuff, dSolSheet, umid * (canalCirrus > 0.5 ? 0.35 : 1.0));

  float borda = 0.2 + umid * uBordaExtra;
  float corpo = smoothstep(limiar, limiar + borda, d);
  float ladoSol = clamp(dot(rd, uDirSol) * 0.5 + 0.5, 0.0, 1.0);
  float luz = mix(0.16, 1.0, ladoSol);
  luz *= 0.55 + 0.45 * max(uDirSol.y, 0.0);
  // Tempestade: iluminação mais plana, menos relief.
  float relevo = (dSol - d) * mix(1.6, 0.35, umid);
  luz += relevo;
  luz = clamp(luz, mix(0.08, 0.18, umid), mix(1.0, 0.72, umid));
  float prata = pow(clamp(1.0 - corpo, 0.0, 1.0), 2.0) * pow(max(dot(rd, uDirSol), 0.0), 4.0);
  prata *= 1.0 - umid * 0.92;
  vec3 cor = mix(uCorNuvemSombra, uCorNuvemLuz, luz);
  cor += uCorSol * prata * uBrilhoSol * 0.28;
  cor = mix(cor, uCorLua, uBrilhoLua * 0.35);
  float longe = exp(-t * 0.00125);
  float peso = corpo * longe * smoothstep(0.012, 0.14, abs(denom)) * pesoMax;
  // Cobertura um pouco mais fechada sob chuva (camada baixa).
  float teto = canalCirrus > 0.5 ? 0.42 : mix(0.93, 0.97, umid);
  peso = min(peso, teto);
  return mix(ceu, cor, peso);
}

void main() {
  vec3 rd = normalize(vDir);
  vec3 ceu = atmosfera(rd);
  ceu = camada(rd, cameraPosition, ceu, uAlturaCirrus, uVentoNuvem * 1.7, uEscalaNuvem * 2.6, 0.74, uPesoCirrus, 1.0);
  ceu = camada(rd, cameraPosition, ceu, uAlturaNuvem, uVentoNuvem, uEscalaNuvem, uLimiarNuvem, 1.0, 0.0);
  ceu += vec3(0.75, 0.82, 1.0) * uFlash;
  float ruido = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  ceu += (ruido - 0.5) * 0.0035;
  gl_FragColor = vec4(max(ceu, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Domo analítico (espalhamento estilizado) + duas camadas de nuvem
 * no mesmo mapa que escurece o chão. uUmidade morpha puff → stratus.
 */
export function criarAtmosfera() {
  const uniforms = {
    uDirSol: { value: new THREE.Vector3(0, 1, 0) },
    uDirLua: { value: new THREE.Vector3(0, -1, 0) },
    uCorZenite: { value: new THREE.Color() },
    uCorHorizonte: { value: new THREE.Color() },
    uCorChao: { value: new THREE.Color() },
    uCorNeblina: { value: new THREE.Color() },
    uCorSol: { value: new THREE.Color() },
    uCorLua: { value: new THREE.Color() },
    uCorNuvemLuz: { value: new THREE.Color() },
    uCorNuvemSombra: { value: new THREE.Color() },
    uBrilhoSol: { value: 1 },
    uBrilhoLua: { value: 0 },
    uEstrelas: { value: 0 },
    uTempo: { value: 0 },
    uFlash: { value: 0 },
    uAlturaNuvem: uniformsNuvem.uAlturaNuvem,
    uAlturaCirrus: { value: ALTURA_CIRRUS },
    uEscalaNuvem: uniformsNuvem.uEscalaNuvem,
    uLimiarNuvem: uniformsNuvem.uLimiarNuvem,
    uPesoCirrus: { value: 0.45 },
    uUmidade: uniformsNuvem.uUmidade,
    uMorph: { value: CLIMA_CFG.chuvaNuvemMorph ?? 1 },
    uEstica: { value: CLIMA_CFG.chuvaNuvemEstica ?? 0.35 },
    uBordaExtra: { value: CLIMA_CFG.chuvaNuvemBorda ?? 0.28 },
    uVentoNuvem: uniformsNuvem.uVentoNuvem,
    uMapaNuvem: uniformsNuvem.uMapaNuvem,
  };

  const material = new THREE.ShaderMaterial({
    name: "ceu-atmosfera",
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: true,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.name = "ceu-domo";
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.matrixAutoUpdate = true;

  let tempo = 0;

  function atualizar(visual, camera, flash, pesoCirrus, dt) {
    tempo += dt;
    mesh.position.copy(camera.position);
    mesh.quaternion.identity();
    uniforms.uDirSol.value.copy(visual.dirSol);
    uniforms.uDirLua.value.copy(visual.dirLua);
    uniforms.uCorZenite.value.copy(visual.zenite);
    uniforms.uCorHorizonte.value.copy(visual.horizonte);
    uniforms.uCorChao.value.copy(visual.chao);
    uniforms.uCorNeblina.value.copy(visual.neblina);
    uniforms.uCorSol.value.copy(visual.sol);
    uniforms.uCorLua.value.copy(visual.lua);
    uniforms.uCorNuvemLuz.value.copy(visual.nuvemLuz);
    uniforms.uCorNuvemSombra.value.copy(visual.nuvemSombra);
    uniforms.uBrilhoSol.value = visual.brilhoSol;
    uniforms.uBrilhoLua.value = visual.brilhoLua;
    uniforms.uEstrelas.value = visual.estrelas;
    uniforms.uTempo.value = tempo;
    uniforms.uFlash.value = flash;
    uniforms.uPesoCirrus.value = pesoCirrus;
    uniforms.uEscalaNuvem.value = ESCALA_NUVEM;
    uniforms.uMorph.value = CLIMA_CFG.chuvaNuvemMorph ?? 1;
    uniforms.uEstica.value = CLIMA_CFG.chuvaNuvemEstica ?? 0.35;
    uniforms.uBordaExtra.value = CLIMA_CFG.chuvaNuvemBorda ?? 0.28;
  }

  return { mesh, atualizar };
}
