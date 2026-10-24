import * as THREE from "three";
import { CLIMA_CFG } from "../../../clima/config.js";

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
uniform vec3 uOffset;
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
varying float vDistCam;
varying float vBorda;

void main() {
  float marcha = 0.72 + aFase * 0.55;
  vec3 mov = uOffset * marcha;
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
  // Mira (persp): mistura um pouco de px pra gota não sumir; top-down usa mais px.
  float pesoComp = mix(0.35, 1.0, uOrto);
  vec2 offComp = mix(offCompMundo, offCompPx, pesoComp);
  vec2 offLarg = mix(offLargMundo, offLargPx, uPesoLarguraPx);
  clip.xy += (offComp * aCanto.y + offLarg * aCanto.x) * clip.w;
  gl_Position = clip;

  vCanto = aCanto;
  // Fade pela distância da câmera (não pelo Z mundo — na mira o Z mundo vira faixa).
  vDistCam = paraLen;
  vBorda = max(abs(caixa.x) / meia.x, max(abs(caixa.y) / meia.y, abs(caixa.z) / meia.z));
}
`;

const FRAG = /* glsl */ `
varying vec2 vCanto;
varying float vDistCam;
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
  float perto = smoothstep(0.35, 1.6, vDistCam);
  float longe = 1.0 - smoothstep(26.0, 40.0, vDistCam);
  float borda = 1.0 - smoothstep(0.92, 1.0, vBorda);
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
 * Volume de wrap em eixos do mundo (não da câmera) — a chuva não “anda” com a tela.
 * Densidade sobe/desce via instanceCount (poucos pingos → chuva cheia).
 */
export function criarPrecipitacao() {
  const cfg = CLIMA_CFG;
  const uniforms = {
    uTempo: { value: 0 },
    uOffset: { value: new THREE.Vector3() },
    uVolume: { value: new THREE.Vector3(16, 12, 12) },
    uCentro: { value: new THREE.Vector3() },
    uDireita: { value: new THREE.Vector3(1, 0, 0) },
    uCima: { value: new THREE.Vector3(0, 1, 0) },
    uFrente: { value: new THREE.Vector3(0, 0, 1) },
    uVel: { value: new THREE.Vector3(0, -30, 0) },
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

  const geo = criarGeometria();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "ceu-precipitacao";
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;

  const corChuva = new THREE.Color(0xbad2eb).convertSRGBToLinear();
  const corAreia = new THREE.Color(0xd7a15a).convertSRGBToLinear();
  const corNeve = new THREE.Color(0xf4f7fb).convertSRGBToLinear();
  const tela = new THREE.Vector2();
  const centroAlvo = new THREE.Vector3();
  const velMundo = new THREE.Vector3();
  const offset = uniforms.uOffset.value;
  const volumeSuave = new THREE.Vector3(16, 14, 16);
  let tempo = 0;
  let temVolume = false;
  let blendSuave = -1;

  function ventoHoriz(ventoXZ, mul) {
    const vx = (ventoXZ?.x || 0) * mul;
    const vz = (ventoXZ?.y || 0) * mul;
    return { vx, vz };
  }

  /** Poucos pingos no início/fim; curva suave até N. */
  function contarInstancias(pesoTipo) {
    const t = Math.max(0, Math.min(1, pesoTipo));
    if (t < 0.02) return 0;
    const pow = cfg.chuvaDensidadePow ?? 1.85;
    const minF = cfg.chuvaDensidadeMin ?? 0.035;
    const eased = Math.pow(t, pow);
    const n = Math.floor(N * Math.max(minF, eased));
    return Math.min(N, Math.max(1, n));
  }

  function aplicarTipo(tipo, clima, ventoXZ) {
    if (tipo === 1) {
      const { vx, vz } = ventoHoriz(ventoXZ, cfg.areiaVentoMul ?? 34);
      velMundo.set(vx, -(cfg.areiaQueda ?? 2.4), vz);
      uniforms.uLargura.value = 0.09;
      uniforms.uLarguraPx.value = 2.4;
      uniforms.uComprimento.value = 0.42;
      uniforms.uComprimentoPx.value = 5;
      uniforms.uBamboleio.value = 0.15;
      uniforms.uAlpha.value = 0.28 * Math.min(1, 0.45 + clima.areia * 0.85);
      uniforms.uPesoLarguraPx.value = uniforms.uOrto.value;
      uniforms.uCor.value.copy(corAreia);
      geo.instanceCount = contarInstancias(clima.areia);
      return;
    }
    if (tipo === 2) {
      const { vx, vz } = ventoHoriz(ventoXZ, cfg.neveVentoMul ?? 12);
      velMundo.set(vx, -(cfg.neveQueda ?? 3.1), vz);
      uniforms.uLargura.value = 0.07;
      uniforms.uLarguraPx.value = 3.2;
      uniforms.uComprimento.value = 0.1;
      uniforms.uComprimentoPx.value = 3.2;
      uniforms.uBamboleio.value = 0.55;
      uniforms.uAlpha.value = 0.72 * Math.min(1, 0.45 + clima.neve * 0.85);
      uniforms.uPesoLarguraPx.value = uniforms.uOrto.value;
      uniforms.uCor.value.copy(corNeve);
      geo.instanceCount = contarInstancias(clima.neve);
      return;
    }
    const { vx, vz } = ventoHoriz(ventoXZ, cfg.chuvaVentoMul ?? 28);
    const queda = cfg.chuvaQueda ?? 30;
    velMundo.set(vx, -queda, vz);
    uniforms.uLargura.value = 0;
    uniforms.uLarguraPx.value = cfg.chuvaLarguraPx ?? 0.95;
    uniforms.uBamboleio.value = 0;
    const intensidade = Math.min(1, clima.chuva);
    const a0 = cfg.chuvaAlphaMin ?? 0.42;
    const a1 = cfg.chuvaAlphaSpan ?? 0.28;
    // Alpha por gota estável; a transição suave é o número de pingos.
    uniforms.uAlpha.value = a0 + a1 * Math.min(1, 0.55 + intensidade * 0.45);
    uniforms.uPesoLarguraPx.value = 1;
    uniforms.uCor.value.copy(corChuva);
    geo.instanceCount = contarInstancias(intensidade);
  }

  function aplicarStreak(tipo) {
    // Streak no eixo da chuva no mundo — não usa vel da câmera (zoom não alonga).
    const rapidez = velMundo.length();
    if (tipo === 1) {
      uniforms.uComprimento.value = 0.42 + rapidez * 0.02;
      uniforms.uComprimentoPx.value = 5 + rapidez * 0.12;
      return;
    }
    if (tipo === 2) {
      uniforms.uComprimento.value = 0.1 + rapidez * 0.008;
      uniforms.uComprimentoPx.value = 3.2 + rapidez * 0.08;
      return;
    }
    const baseM = cfg.chuvaStreakMundo ?? 0.9;
    const basePx = cfg.chuvaStreakPx ?? 10;
    const kM = cfg.chuvaStreakVelK ?? 0.055;
    const kPx = cfg.chuvaStreakPxVelK ?? 0.42;
    uniforms.uComprimento.value = baseM + rapidez * kM;
    uniforms.uComprimentoPx.value = basePx + rapidez * kPx;
  }

  /**
   * @param {*} clima mix do céu
   * @param {{x:number,y:number}} ventoXZ vx/vz do mundo (obterVentoMundo), não normalizado
   * @param {THREE.Vector3} [alvo] posição do jogador (mundo) — âncora do volume
   */
  function atualizar(clima, ventoXZ, dt, camera, renderer, alvo = null) {
    const seguro = Math.min(Math.max(dt || 0, 0), 0.05);
    tempo += seguro;
    const peso = clima.chuva + clima.areia + clima.neve;
    mesh.visible = peso > 0.02;
    if (!mesh.visible) {
      temVolume = false;
      blendSuave = -1;
      geo.instanceCount = 0;
      return;
    }

    // Eixos do mundo: giro da câmera não remapeia o wrap (chuva não gruda na tela).
    uniforms.uDireita.value.set(1, 0, 0);
    uniforms.uCima.value.set(0, 1, 0);
    uniforms.uFrente.value.set(0, 0, 1);

    if (camera) {
      camera.updateMatrixWorld(true);
      const medido = medirVolume(camera);
      // Caixa estável: mira não encolhe o volume (era isso que sumia / concentrava no retorno).
      const halfXZ = Math.min(24, Math.max(14, Math.max(medido.meiaX, medido.meiaY) * 0.55));
      const halfY = Math.max(12, halfXZ * 0.75);
      const kVol = 1 - Math.exp(-seguro / 0.28);
      const mudouModo = blendSuave >= 0 && Math.abs(medido.blend - blendSuave) > 0.2;
      blendSuave = medido.blend;
      if (!temVolume || mudouModo) {
        volumeSuave.set(halfXZ, halfY, halfXZ);
        temVolume = true;
      } else {
        volumeSuave.x += (halfXZ - volumeSuave.x) * kVol;
        volumeSuave.y += (halfY - volumeSuave.y) * kVol;
        volumeSuave.z += (halfXZ - volumeSuave.z) * kVol;
      }
      uniforms.uVolume.value.copy(volumeSuave);
      // Âncora no jogador (não na câmera): top-down e mira compartilham o mesmo wrap.
      if (alvo && Number.isFinite(alvo.x) && Number.isFinite(alvo.y) && Number.isFinite(alvo.z)) {
        centroAlvo.set(alvo.x, alvo.y + volumeSuave.y * 0.35, alvo.z);
      } else {
        const e = camera.matrixWorld.elements;
        centroAlvo.set(e[12], e[13] + volumeSuave.y * 0.2, e[14]);
      }
      uniforms.uCentro.value.copy(centroAlvo);
      uniforms.uOrto.value = medido.blend;
    } else {
      temVolume = false;
      blendSuave = -1;
    }
    if (renderer) {
      renderer.getDrawingBufferSize(tela);
      if (tela.y > 0) uniforms.uResolucao.value.copy(tela);
    }

    let tipo = 0;
    if (clima.areia >= clima.chuva && clima.areia >= clima.neve) tipo = 1;
    else if (clima.neve >= clima.chuva && clima.neve >= clima.areia) tipo = 2;

    aplicarTipo(tipo, clima, ventoXZ);
    offset.addScaledVector(velMundo, seguro);
    // Eixo/comprimento do fio = vel no mundo (ignora dólly do zoom).
    uniforms.uVel.value.copy(velMundo);
    aplicarStreak(tipo);
    uniforms.uTipo.value = tipo;
    uniforms.uTempo.value = tempo;
  }

  return { mesh, atualizar };
}
