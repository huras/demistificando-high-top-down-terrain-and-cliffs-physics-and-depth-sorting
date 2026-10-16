import * as THREE from "three";

const N = 8000;
const SEMENTE = 4096;
const ESPESSURA = 24;
const PERTO_MIN = 1.5;
const MARGEM = 1.08;
const CANTOS = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];

const VERT = /* glsl */ `
attribute vec2 aCanto;
attribute vec3 aOrigem;
attribute float aFase;
uniform float uTempo;
uniform vec3 uVolume;
uniform vec3 uCentro;
uniform vec3 uDireita;
uniform vec3 uCima;
uniform vec3 uFrente;
uniform vec3 uVel;
uniform float uLargura;
uniform float uLarguraPx;
uniform float uComprimento;
uniform float uComprimentoPx;
uniform float uBamboleio;
uniform float uOrto;
uniform float uPesoLarguraPx;
uniform vec2 uResolucao;
varying vec2 vCanto;
varying float vZ;
varying float vBorda;

void main() {
  float marcha = 0.72 + aFase * 0.55;
  vec3 mov = uVel * (uTempo * marcha);
  float fase = uTempo * 1.4 + aFase * 6.28318;
  mov.x += sin(fase) * uBamboleio;
  mov.z += cos(fase * 0.8) * uBamboleio;

  vec3 rel = aOrigem + mov - uCentro;
  vec3 meia = max(uVolume, vec3(0.001));
  vec3 tamanho = meia * 2.0;
  vec3 caixa = vec3(dot(rel, uDireita), dot(rel, uCima), dot(rel, uFrente));
  caixa = mod(caixa + meia, tamanho) - meia;
  vec3 mundo = uCentro + uDireita * caixa.x + uCima * caixa.y + uFrente * caixa.z;

  vec3 vel = uVel;
  float rapidez = length(vel);
  vec3 eixo = rapidez > 0.001 ? vel / rapidez : vec3(0.0, -1.0, 0.0);
  vec3 paraCam = cameraPosition - mundo;
  float paraLen = length(paraCam);
  vec3 vista = paraLen > 0.001 ? paraCam / paraLen : vec3(0.0, 0.0, 1.0);
  vec3 lado = cross(eixo, vista);
  float ladoLen = length(lado);
  lado = ladoLen > 0.0001 ? lado / ladoLen : vec3(1.0, 0.0, 0.0);

  float compVar = 0.75 + aFase * 0.5;
  vec4 clip = projectionMatrix * viewMatrix * vec4(mundo, 1.0);
  vec4 clipEixo = projectionMatrix * viewMatrix * vec4(mundo + eixo, 1.0);
  vec4 clipLado = projectionMatrix * viewMatrix * vec4(mundo + lado, 1.0);
  float w0 = max(abs(clip.w), 0.0001);
  float wE = max(abs(clipEixo.w), 0.0001);
  float wL = max(abs(clipLado.w), 0.0001);
  vec2 base = clip.xy / w0;
  vec2 dirE = (clipEixo.xy / wE) - base;
  vec2 dirL = (clipLado.xy / wL) - base;
  float lenE = length(dirE);
  float lenL = length(dirL);
  vec2 nE = lenE > 1e-5 ? dirE / lenE : vec2(0.0, 1.0);
  vec2 nL = lenL > 1e-5 ? dirL / lenL : vec2(1.0, 0.0);
  float ndcY = 2.0 / max(uResolucao.y, 1.0);

  vec2 offCompMundo = dirE * (uComprimento * compVar);
  vec2 offLargMundo = dirL * uLargura;
  vec2 offCompPx = nE * (uComprimentoPx * compVar) * ndcY;
  vec2 offLargPx = nL * uLarguraPx * ndcY;
  vec2 offComp = mix(offCompMundo, offCompPx, uOrto);
  vec2 offLarg = mix(offLargMundo, offLargPx, uPesoLarguraPx);
  clip.xy += (offComp * aCanto.y + offLarg * aCanto.x) * clip.w;
  gl_Position = clip;

  vCanto = aCanto;
  vZ = clamp((caixa.z + meia.z) / tamanho.z, 0.0, 1.0);
  vBorda = max(abs(caixa.x) / meia.x, abs(caixa.y) / meia.y);
}
`;

const FRAG = /* glsl */ `
varying vec2 vCanto;
varying float vZ;
varying float vBorda;
uniform vec3 uCor;
uniform float uAlpha;
uniform float uTipo;

void main() {
  float ax = 1.0 - abs(vCanto.x);
  float ay = 1.0 - abs(vCanto.y);
  float fio = exp(-vCanto.x * vCanto.x * 14.0) * smoothstep(1.0, 0.42, abs(vCanto.y));
  float grao = smoothstep(0.0, 0.35, ax) * smoothstep(0.0, 0.28, ay);
  float floco = smoothstep(0.05, 0.85, 1.0 - length(vCanto));
  float forma = uTipo < 0.5 ? fio : mix(grao, floco, clamp(uTipo - 1.0, 0.0, 1.0));
  float perto = smoothstep(0.0, 0.08, vZ);
  float longe = 1.0 - smoothstep(0.88, 1.0, vZ);
  float borda = 1.0 - smoothstep(0.94, 1.0, vBorda);
  float alpha = forma * uAlpha * perto * longe * borda;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(uCor, alpha);
  #include <colorspace_fragment>
}
`;

function criarGeometria() {
  const geo = new THREE.InstancedBufferGeometry();
  const pos = new Float32Array(18);
  for (let i = 0; i < 6; i++) {
    pos[i * 3] = CANTOS[i * 2];
    pos[i * 3 + 1] = CANTOS[i * 2 + 1];
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aCanto", new THREE.BufferAttribute(new Float32Array(CANTOS), 2));

  const origem = new Float32Array(N * 3);
  const fase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    origem[i * 3] = (Math.random() * 2 - 1) * SEMENTE;
    origem[i * 3 + 1] = (Math.random() * 2 - 1) * SEMENTE;
    origem[i * 3 + 2] = (Math.random() * 2 - 1) * SEMENTE;
    fase[i] = Math.random();
  }
  geo.setAttribute("aOrigem", new THREE.InstancedBufferAttribute(origem, 3));
  geo.setAttribute("aFase", new THREE.InstancedBufferAttribute(fase, 1));
  geo.instanceCount = N;
  return geo;
}

function faixaProfundidade(distOlhar) {
  const dist = Math.max(2, distOlhar || ESPESSURA);
  const perto = Math.max(PERTO_MIN, dist - ESPESSURA * 0.55);
  const longe = perto + ESPESSURA;
  return {
    longe,
    meiaZ: (longe - perto) * 0.5,
    avanco: (perto + longe) * 0.5,
  };
}

function medirVolume(camera) {
  const vista = camera?.userData?.vista;
  const fov = camera?.fov > 0 ? camera.fov : 50;
  const aspect = camera?.aspect > 0 ? camera.aspect : 1;
  let blend = 0;
  let meiaLOrto = 0;
  let meiaAOrto = 0;
  let distOlhar = ESPESSURA;

  if (camera?.isOrthographicCamera) {
    blend = 1;
    const zoom = camera.zoom > 0 ? camera.zoom : 1;
    meiaLOrto = Math.abs(camera.right - camera.left) * 0.5 / zoom;
    meiaAOrto = Math.abs(camera.top - camera.bottom) * 0.5 / zoom;
    distOlhar = meiaAOrto / Math.tan((fov * Math.PI) / 360);
  } else if (vista && vista.meiaAltura > 0) {
    blend = Math.min(1, Math.max(0, vista.projBlend || 0));
    meiaLOrto = vista.meiaLargura;
    meiaAOrto = vista.meiaAltura;
    distOlhar = vista.distOlhar;
  }

  const faixa = faixaProfundidade(distOlhar);
  const meiaAPersp = Math.tan((fov * Math.PI) / 360) * faixa.longe * MARGEM;
  const meiaLPersp = meiaAPersp * aspect;
  const u = blend;
  return {
    meiaX: Math.max(0.5, meiaLPersp + (meiaLOrto * MARGEM - meiaLPersp) * u),
    meiaY: Math.max(0.5, meiaAPersp + (meiaAOrto * MARGEM - meiaAPersp) * u),
    meiaZ: faixa.meiaZ,
    avanco: faixa.avanco,
    blend: u,
  };
}

/**
 * Um draw cobre chuva, areia e neve.
 * A lâmina acompanha a vista: no ortográfico ela tem o retângulo da tela,
 * e a gota só reentra quando sai desse volume.
 */
export function criarPrecipitacao() {
  const uniforms = {
    uTempo: { value: 0 },
    uVolume: { value: new THREE.Vector3(16, 12, 12) },
    uCentro: { value: new THREE.Vector3() },
    uDireita: { value: new THREE.Vector3(1, 0, 0) },
    uCima: { value: new THREE.Vector3(0, 1, 0) },
    uFrente: { value: new THREE.Vector3(0, 0, -1) },
    uVel: { value: new THREE.Vector3(0, -14, 0) },
    uLargura: { value: 0.03 },
    uLarguraPx: { value: 0 },
    uComprimento: { value: 1.35 },
    uComprimentoPx: { value: 14 },
    uBamboleio: { value: 0 },
    uOrto: { value: 1 },
    uPesoLarguraPx: { value: 1 },
    uResolucao: { value: new THREE.Vector2(1280, 720) },
    uCor: { value: new THREE.Color() },
    uAlpha: { value: 0 },
    uTipo: { value: 0 },
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
  const camPos = new THREE.Vector3();
  let tempo = 0;

  function aplicarTipo(tipo, clima, vx, vz) {
    if (tipo === 1) {
      uniforms.uVel.value.set(vx * 1.15, -2.4, vz * 1.15);
      uniforms.uLargura.value = 0.09;
      uniforms.uLarguraPx.value = 2.4;
      uniforms.uComprimento.value = 0.42;
      uniforms.uComprimentoPx.value = 5;
      uniforms.uBamboleio.value = 0.15;
      uniforms.uAlpha.value = 0.28 * Math.min(1, clima.areia * 1.3);
      uniforms.uPesoLarguraPx.value = uniforms.uOrto.value;
      uniforms.uCor.value.copy(corAreia);
      return;
    }
    if (tipo === 2) {
      uniforms.uVel.value.set(vx * 0.45, -3.1, vz * 0.45);
      uniforms.uLargura.value = 0.07;
      uniforms.uLarguraPx.value = 3.2;
      uniforms.uComprimento.value = 0.1;
      uniforms.uComprimentoPx.value = 3.2;
      uniforms.uBamboleio.value = 0.55;
      uniforms.uAlpha.value = 0.72 * Math.min(1, clima.neve * 1.3);
      uniforms.uPesoLarguraPx.value = uniforms.uOrto.value;
      uniforms.uCor.value.copy(corNeve);
      return;
    }
    uniforms.uVel.value.set(vx * 0.35, -17, vz * 0.35);
    uniforms.uLargura.value = 0;
    uniforms.uLarguraPx.value = 0.9;
    uniforms.uComprimento.value = 1.45;
    uniforms.uComprimentoPx.value = 14;
    uniforms.uBamboleio.value = 0;
    const intensidade = Math.min(1, clima.chuva * 1.15);
    uniforms.uAlpha.value = 0.28 + 0.42 * intensidade;
    uniforms.uPesoLarguraPx.value = 1;
    uniforms.uCor.value.copy(corChuva);
  }

  function atualizar(clima, ventoDir, dt, camera, renderer) {
    tempo += dt;
    const peso = clima.chuva + clima.areia + clima.neve;
    mesh.visible = peso > 0.025;
    if (!mesh.visible) return;

    if (camera) {
      camera.updateMatrixWorld(true);
      const e = camera.matrixWorld.elements;
      uniforms.uDireita.value.set(e[0], e[1], e[2]).normalize();
      uniforms.uCima.value.set(e[4], e[5], e[6]).normalize();
      const frente = uniforms.uFrente.value.set(-e[8], -e[9], -e[10]).normalize();
      camPos.set(e[12], e[13], e[14]);
      const medido = medirVolume(camera);
      uniforms.uVolume.value.set(medido.meiaX, medido.meiaY, medido.meiaZ);
      uniforms.uCentro.value.copy(camPos).addScaledVector(frente, medido.avanco);
      uniforms.uOrto.value = medido.blend;
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
    aplicarTipo(tipo, clima, vx, vz);
    uniforms.uTipo.value = tipo;
    uniforms.uTempo.value = tempo;
  }

  return { mesh, atualizar };
}
