import * as THREE from "three";

const N = 4200;
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
uniform vec3 uVel;
uniform float uLargura;
uniform float uComprimento;
uniform float uBamboleio;
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
  p = mod(p + meia, tamanho) - meia;
  vec3 mundo = cameraPosition + p;
  vec3 vel = uVel;
  float rapidez = length(vel);
  vec3 eixo = rapidez > 0.001 ? vel / rapidez : vec3(0.0, -1.0, 0.0);
  vec3 paraCam = cameraPosition - mundo;
  vec3 vista = length(paraCam) > 0.001 ? paraCam / length(paraCam) : vec3(0.0, 0.0, 1.0);
  vec3 lado = cross(eixo, vista);
  float ladoLen = length(lado);
  lado = ladoLen > 0.0001 ? lado / ladoLen : vec3(1.0, 0.0, 0.0);
  mundo += lado * aCanto.x * uLargura + eixo * aCanto.y * uComprimento;
  gl_Position = projectionMatrix * viewMatrix * vec4(mundo, 1.0);
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
  float gota = smoothstep(0.0, 0.22, ax) * smoothstep(0.0, 0.06, ay);
  float grao = smoothstep(0.0, 0.35, ax) * smoothstep(0.0, 0.28, ay);
  float floco = smoothstep(0.05, 0.85, 1.0 - length(vCanto));
  float forma = mix(gota, grao, clamp(uTipo, 0.0, 1.0));
  forma = mix(forma, floco, clamp(uTipo - 1.0, 0.0, 1.0));
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
    const ox = (Math.random() * 2 - 1) * 22;
    const oy = (Math.random() * 2 - 1) * 16;
    const oz = (Math.random() * 2 - 1) * 22;
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

/**
 * Volume preso na câmera. A posição enrola no shader — zero custo de CPU por gota.
 * Um draw cobre chuva, areia e neve; o uniforme escolhe forma e cor.
 */
export function criarPrecipitacao() {
  const uniforms = {
    uTempo: { value: 0 },
    uVolume: { value: new THREE.Vector3(22, 16, 22) },
    uVel: { value: new THREE.Vector3(0, -14, 0) },
    uLargura: { value: 0.03 },
    uComprimento: { value: 1.35 },
    uBamboleio: { value: 0 },
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

  const corChuva = new THREE.Color(0xc5d0dc).convertSRGBToLinear();
  const corAreia = new THREE.Color(0xd7a15a).convertSRGBToLinear();
  const corNeve = new THREE.Color(0xf4f7fb).convertSRGBToLinear();
  let tempo = 0;

  function atualizar(clima, ventoDir, dt) {
    tempo += dt;
    const peso = clima.chuva + clima.areia + clima.neve;
    mesh.visible = peso > 0.025;
    if (!mesh.visible) return;

    let tipo = 0;
    if (clima.areia >= clima.chuva && clima.areia >= clima.neve) tipo = 1;
    else if (clima.neve >= clima.chuva && clima.neve >= clima.areia) tipo = 2;

    const vx = ventoDir.x * clima.vento;
    const vz = ventoDir.y * clima.vento;
    if (tipo === 1) {
      uniforms.uVel.value.set(vx * 1.15, -2.4, vz * 1.15);
      uniforms.uLargura.value = 0.09;
      uniforms.uComprimento.value = 0.42;
      uniforms.uBamboleio.value = 0.15;
      uniforms.uAlpha.value = 0.28 * Math.min(1, clima.areia * 1.3);
      uniforms.uFadeLonge.value = 18;
      uniforms.uCor.value.copy(corAreia);
    } else if (tipo === 2) {
      uniforms.uVel.value.set(vx * 0.45, -3.1, vz * 0.45);
      uniforms.uLargura.value = 0.07;
      uniforms.uComprimento.value = 0.1;
      uniforms.uBamboleio.value = 0.55;
      uniforms.uAlpha.value = 0.72 * Math.min(1, clima.neve * 1.3);
      uniforms.uFadeLonge.value = 16;
      uniforms.uCor.value.copy(corNeve);
    } else {
      uniforms.uVel.value.set(vx * 0.35, -17, vz * 0.35);
      uniforms.uLargura.value = 0.028;
      uniforms.uComprimento.value = 1.55;
      uniforms.uBamboleio.value = 0;
      uniforms.uAlpha.value = 0.42 * Math.min(1, clima.chuva * 1.25);
      uniforms.uFadeLonge.value = 26;
      uniforms.uCor.value.copy(corChuva);
    }
    uniforms.uTipo.value = tipo;
    uniforms.uTempo.value = tempo;
  }

  return { mesh, atualizar };
}
