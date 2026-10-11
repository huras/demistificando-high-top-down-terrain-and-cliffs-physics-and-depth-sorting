import * as THREE from "three";

const N = 8000;
const MEIA_X = 22;
const MEIA_Y = 16;
const MEIA_Z = 22;
const CANTOS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];

const VERT = /* glsl */ `
attribute vec3 aOrigem;
attribute vec2 aCanto;
attribute float aFase;
uniform float uTempo;
uniform vec3 uVolume;
uniform vec3 uAncora;
uniform vec3 uVel;
uniform float uLargura;
uniform float uLarguraPx;
uniform float uComprimento;
uniform float uBamboleio;
uniform vec2 uResolucao;
varying vec2 vCanto;
varying float vDist;

void main() {
  vec3 meia = uVolume;
  float marcha = 0.72 + aFase * 0.55;
  vec3 p = aOrigem + uVel * (uTempo * marcha);
  float w = sin(uTempo * 1.5 + aFase * 6.28318) * uBamboleio;
  p.x += w;
  p.z += cos(uTempo * 1.2 + aFase * 6.28318) * uBamboleio;
  vec3 tamanho = meia * 2.0;
  p = mod(p - uAncora + meia, tamanho) - meia;
  vec3 mundo = cameraPosition + p;
  vec3 vel = uVel;
  float rapidez = length(vel);
  vec3 eixo = rapidez > 0.001 ? vel / rapidez : vec3(0.0, -1.0, 0.0);
  vec3 paraCam = cameraPosition - mundo;
  vec3 vista = length(paraCam) > 0.001 ? paraCam / length(paraCam) : vec3(0.0, 0.0, 1.0);
  vec3 lado = cross(eixo, vista);
  float ladoLen = length(lado);
  lado = ladoLen > 0.0001 ? lado / ladoLen : vec3(1.0, 0.0, 0.0);
  float comp = uComprimento * (0.75 + aFase * 0.5);
  vec3 ponta = mundo + eixo * aCanto.y * comp;
  if (uLarguraPx > 0.0) {
    vec4 clip = projectionMatrix * viewMatrix * vec4(ponta, 1.0);
    vec4 clipLado = projectionMatrix * viewMatrix * vec4(ponta + lado, 1.0);
    float wClip = max(abs(clip.w), 0.0001);
    float wLado = max(abs(clipLado.w), 0.0001);
    vec2 dirTela = (clipLado.xy / wLado) - (clip.xy / wClip);
    float lenTela = length(dirTela);
    vec2 dirN = lenTela > 1e-5 ? dirTela / lenTela : vec2(1.0, 0.0);
    float ndc = uLarguraPx * 2.0 / max(uResolucao.y, 1.0);
    clip.xy += dirN * aCanto.x * ndc * clip.w;
    gl_Position = clip;
  } else {
    ponta += lado * aCanto.x * uLargura;
    gl_Position = projectionMatrix * viewMatrix * vec4(ponta, 1.0);
  }
  vCanto = aCanto;
  vDist = length(paraCam);
}
`;

const FRAG = /* glsl */ `
varying vec2 vCanto;
varying float vDist;
uniform vec3 uCor;
uniform float uAlpha;
uniform float uTipo;
uniform float uFadePerto;
uniform float uFadeLonge;

void main() {
  float ax = 1.0 - abs(vCanto.x);
  float ay = 1.0 - abs(vCanto.y);
  float fio = exp(-vCanto.x * vCanto.x * 14.0) * smoothstep(1.0, 0.42, abs(vCanto.y));
  float grao = smoothstep(0.0, 0.35, ax) * smoothstep(0.0, 0.28, ay);
  float floco = smoothstep(0.05, 0.85, 1.0 - length(vCanto));
  float forma = uTipo < 0.5 ? fio : mix(grao, floco, clamp(uTipo - 1.0, 0.0, 1.0));
  float perto = smoothstep(0.45, uFadePerto, vDist);
  float longe = 1.0 - smoothstep(uFadeLonge * 0.55, uFadeLonge, vDist);
  float alpha = forma * uAlpha * perto * longe;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(uCor, alpha);
  #include <colorspace_fragment>
}
`;

function criarGeometria() {
  const origem = new Float32Array(N * 6 * 3);
  const canto = new Float32Array(N * 6 * 2);
  const fase = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const ox = (Math.random() * 2 - 1) * MEIA_X;
    const oy = (Math.random() * 2 - 1) * MEIA_Y;
    const oz = (Math.random() * 2 - 1) * MEIA_Z;
    const f = Math.random();
    for (let k = 0; k < 6; k++) {
      const vi = i * 6 + k;
      origem[vi * 3] = ox;
      origem[vi * 3 + 1] = oy;
      origem[vi * 3 + 2] = oz;
      canto[vi * 2] = CANTOS[k][0];
      canto[vi * 2 + 1] = CANTOS[k][1];
      fase[vi] = f;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(origem, 3));
  geo.setAttribute("aOrigem", new THREE.BufferAttribute(origem, 3));
  geo.setAttribute("aCanto", new THREE.BufferAttribute(canto, 2));
  geo.setAttribute("aFase", new THREE.BufferAttribute(fase, 1));
  return geo;
}

function enrolar(valor, tamanho) {
  if (!(tamanho > 0)) return 0;
  const m = valor % tamanho;
  return m < 0 ? m + tamanho : m;
}

/**
 * Um draw cobre chuva, areia e neve.
 * A âncora enrola a câmera na caixa, então a gota continua no mundo
 * e só reentra quando sai do volume.
 */
export function criarPrecipitacao() {
  const uniforms = {
    uTempo: { value: 0 },
    uVolume: { value: new THREE.Vector3(MEIA_X, MEIA_Y, MEIA_Z) },
    uAncora: { value: new THREE.Vector3() },
    uVel: { value: new THREE.Vector3(0, -14, 0) },
    uLargura: { value: 0.03 },
    uLarguraPx: { value: 0 },
    uComprimento: { value: 1.35 },
    uBamboleio: { value: 0 },
    uResolucao: { value: new THREE.Vector2(1280, 720) },
    uCor: { value: new THREE.Color() },
    uAlpha: { value: 0 },
    uTipo: { value: 0 },
    uFadePerto: { value: 2.4 },
    uFadeLonge: { value: 28 },
  };

  const material = new THREE.ShaderMaterial({
    name: "ceu-precipitacao",
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(criarGeometria(), material);
  mesh.name = "ceu-precipitacao";
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;

  const corChuva = new THREE.Color(0xbad2eb).convertSRGBToLinear();
  const corAreia = new THREE.Color(0xd7a15a).convertSRGBToLinear();
  const corNeve = new THREE.Color(0xf4f7fb).convertSRGBToLinear();
  const tela = new THREE.Vector2();
  const mundoCam = new THREE.Vector3();
  let tempo = 0;

  function atualizar(clima, ventoDir, dt, camera, renderer) {
    tempo += dt;
    const peso = clima.chuva + clima.areia + clima.neve;
    mesh.visible = peso > 0.025;
    if (!mesh.visible) return;

    if (camera) {
      camera.updateMatrixWorld(true);
      const e = camera.matrixWorld.elements;
      mundoCam.set(e[12], e[13], e[14]);
      const vol = uniforms.uVolume.value;
      uniforms.uAncora.value.set(
        enrolar(mundoCam.x, vol.x * 2),
        enrolar(mundoCam.y, vol.y * 2),
        enrolar(mundoCam.z, vol.z * 2),
      );
    }
    if (renderer) {
      renderer.getDrawingBufferSize(tela);
      if (tela.y > 0) uniforms.uResolucao.value.copy(tela);
    }

    let tipo = 0;
    if (clima.areia >= clima.chuva && clima.areia >= clima.neve) tipo = 1;
    else if (clima.neve >= clima.chuva && clima.neve >= clima.areia) tipo = 2;

    const vx = ventoDir.x * clima.vento;
    const vz = ventoDir.y * clima.vento;
    if (tipo === 1) {
      uniforms.uVel.value.set(vx * 1.15, -2.4, vz * 1.15);
      uniforms.uLargura.value = 0.09;
      uniforms.uLarguraPx.value = 0;
      uniforms.uComprimento.value = 0.42;
      uniforms.uBamboleio.value = 0.15;
      uniforms.uAlpha.value = 0.28 * Math.min(1, clima.areia * 1.3);
      uniforms.uFadePerto.value = 2.4;
      uniforms.uFadeLonge.value = 18;
      uniforms.uCor.value.copy(corAreia);
    } else if (tipo === 2) {
      uniforms.uVel.value.set(vx * 0.45, -3.1, vz * 0.45);
      uniforms.uLargura.value = 0.07;
      uniforms.uLarguraPx.value = 0;
      uniforms.uComprimento.value = 0.1;
      uniforms.uBamboleio.value = 0.55;
      uniforms.uAlpha.value = 0.72 * Math.min(1, clima.neve * 1.3);
      uniforms.uFadePerto.value = 2.4;
      uniforms.uFadeLonge.value = 16;
      uniforms.uCor.value.copy(corNeve);
    } else {
      uniforms.uVel.value.set(vx * 0.35, -17, vz * 0.35);
      uniforms.uLargura.value = 0;
      uniforms.uLarguraPx.value = 0.9;
      uniforms.uComprimento.value = 1.45;
      uniforms.uBamboleio.value = 0;
      const intensidade = Math.min(1, clima.chuva * 1.15);
      uniforms.uAlpha.value = 0.28 + 0.42 * intensidade;
      uniforms.uFadePerto.value = 1.15;
      uniforms.uFadeLonge.value = 26;
      uniforms.uCor.value.copy(corChuva);
    }
    uniforms.uTipo.value = tipo;
    uniforms.uTempo.value = tempo;
  }

  return { mesh, atualizar };
}
