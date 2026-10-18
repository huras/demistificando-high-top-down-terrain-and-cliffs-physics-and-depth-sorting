/**
 * Lâmina e cachoeira 3D: tile CENTER das folhas do Pokémon AI.
 * Quadros lado a lado. O include do mapa é trocado antes de o Three
 * expandir os chunks — senão o fract não entra e o tile estica.
 * No lago a crista é fina e ondula no mundo. Na queda, um fio desliza.
 */
import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";

const CEL = 16;
const LAGO_URL = "assets/terrain/lake-autotile.png";
const LAGO_COLS = 5;
const LAGO_LINHAS = 3;
const LAGO_CENTER = 6;
const LAGO_FRAME_S = 0.48;

const WF_URL = "assets/terrain/waterfall-strip.png";
const WF_COLS = 3;
const WF_LINHA_MIOLO = 2;
const WF_COL_MIOLO = 1;
const WF_FRAME_S = 0.11;

const LINHA_VEL = 0.72;
const CRISTA_ESPACO = 2.6;

const MAPA_AGUA = `
#ifdef USE_MAP
	vec2 uvAgua = fract(vMapUv);
	float nQ = max(uQuadros, 1.0);
	float q = mod(floor(uQuadro), nQ);
	vec4 sampledDiffuseColor = texture2D(map, vec2((q + uvAgua.x) / nQ, uvAgua.y));
	float faixa = 0.0;
	if (uEixoLinha < 0.5) {
		float aoLongo = vMundoAgua.x;
		float atraves = vMundoAgua.y;
		float s1 = sin(fract(aoLongo * 0.3421846 + uFase1) * 6.2831853) * 0.2;
		float s2 = sin(fract(aoLongo * 0.747868 + uFase2) * 6.2831853) * 0.06;
		float campo = atraves - s1 - s2 - uScroll;
		for (int i = 0; i < 8; i++) {
			float amp = uCorpos[i].z;
			if (amp <= 0.0) continue;
			vec2 d = vMundoAgua - uCorpos[i].xy;
			float r2 = dot(d, d);
			if (r2 >= 4.0) continue;
			campo -= exp(-r2 * 1.2) * amp;
		}
		float f = fract(campo / 2.6);
		float dist = min(f, 1.0 - f) * 2.6;
		faixa = 1.0 - smoothstep(0.012, 0.055, dist);
	} else {
		float eixo = vMapUv.y;
		float d = min(fract(eixo + uLinha), 1.0 - fract(eixo + uLinha));
		faixa = 1.0 - smoothstep(0.012, 0.04, d);
	}
	sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.93, 0.98, 1.0), faixa * 0.62);
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif
`;

function texturaPixel(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function canvasChato(cor) {
  const c = document.createElement("canvas");
  c.width = CEL;
  c.height = CEL;
  const g = c.getContext("2d");
  g.fillStyle = cor;
  g.fillRect(0, 0, CEL, CEL);
  return c;
}

function materialFolha(textura, quadros, opacidade, eixoLinha, cacheKey, corpos) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textura,
    vertexColors: true,
    transparent: true,
    opacity: opacidade,
    roughness: 0.32,
    metalness: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  mat.userData.quadros = quadros;
  mat.userData.eixoLinha = eixoLinha;
  mat.userData.corpos = corpos;
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uQuadro = { value: 0 };
    shader.uniforms.uQuadros = { value: mat.userData.quadros };
    shader.uniforms.uLinha = { value: 0 };
    shader.uniforms.uEixoLinha = { value: mat.userData.eixoLinha };
    shader.uniforms.uScroll = { value: 0 };
    shader.uniforms.uFase1 = { value: 0 };
    shader.uniforms.uFase2 = { value: 0 };
    shader.uniforms.uCorpos = { value: mat.userData.corpos };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vMundoAgua;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvMundoAgua = vec2(position.x, position.z);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vMundoAgua;\nuniform highp float uQuadro;\nuniform highp float uQuadros;\nuniform highp float uLinha;\nuniform highp float uEixoLinha;\nuniform highp float uScroll;\nuniform highp float uFase1;\nuniform highp float uFase2;\nuniform vec4 uCorpos[8];",
      )
      .replace("#include <map_fragment>", MAPA_AGUA);
    mat.userData.shader = shader;
  };
  return mat;
}

function aplicarFita(tex, mat, canvas) {
  tex.image = canvas;
  tex.needsUpdate = true;
  mat.userData.quadros = Math.max(1, Math.round(canvas.width / CEL));
  const shader = mat.userData.shader;
  if (shader) shader.uniforms.uQuadros.value = mat.userData.quadros;
}

function fita(img, amostras) {
  const c = document.createElement("canvas");
  c.width = amostras.length * CEL;
  c.height = CEL;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  for (let i = 0; i < amostras.length; i++) {
    const a = amostras[i];
    g.drawImage(img, a.sx, a.sy, CEL, CEL, i * CEL, 0, CEL, CEL);
  }
  return c;
}

function carregar(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const CAP_CRISTA = 8;
const CRISTA_RAIO2 = 36;
const CRISTA_AMP = 0.62;

function slotsCrista() {
  const lista = new Array(CAP_CRISTA);
  for (let i = 0; i < CAP_CRISTA; i++) lista[i] = new THREE.Vector4();
  return lista;
}

const corposLago = slotsCrista();
const corposLonge = slotsCrista();
const corposQueda = slotsCrista();
const cristaX = new Float32Array(CAP_CRISTA);
const cristaY = new Float32Array(CAP_CRISTA);
const cristaA = new Float32Array(CAP_CRISTA);
const cristaD = new Float32Array(CAP_CRISTA);

const texLago = texturaPixel(canvasChato("#7ec8e3"));
const texQueda = texturaPixel(canvasChato("#9fd4ea"));
const matLago = aplicarSombraNuvem(materialFolha(texLago, 1, 0.78, 0, "agua-lago-centro", corposLago));
const matLagoLonge = aplicarSombraNuvem(materialFolha(texLago, 1, 0.78, 0, "agua-lago-longe", corposLonge));
const matQueda = aplicarSombraNuvem(materialFolha(texQueda, 1, 0.92, 1, "agua-queda-centro", corposQueda));

carregar(LAGO_URL).then((img) => {
  if (!img) return;
  const frames = Math.max(1, Math.floor(img.naturalHeight / (LAGO_LINHAS * CEL)));
  const col = LAGO_CENTER % LAGO_COLS;
  const linha = (LAGO_CENTER / LAGO_COLS) | 0;
  const amostras = [];
  for (let f = 0; f < frames; f++) {
    amostras.push({
      sx: col * CEL,
      sy: linha * CEL + f * LAGO_LINHAS * CEL,
    });
  }
  const folha = fita(img, amostras);
  aplicarFita(texLago, matLago, folha);
  aplicarFita(texLago, matLagoLonge, folha);
});

carregar(WF_URL).then((img) => {
  if (!img) return;
  const frames = Math.max(1, Math.floor(img.naturalWidth / (WF_COLS * CEL)));
  const amostras = [];
  for (let f = 0; f < frames; f++) {
    amostras.push({
      sx: (f * WF_COLS + WF_COL_MIOLO) * CEL,
      sy: WF_LINHA_MIOLO * CEL,
    });
  }
  aplicarFita(texQueda, matQueda, fita(img, amostras));
});

export function obterMaterialLago() {
  return matLago;
}

/** Mesma lâmina do lago, programa próprio para o anel distante. */
export function obterMaterialLagoLonge() {
  return matLagoLonge;
}

export function obterMaterialQueda() {
  return matQueda;
}

const ESPUMA_FUNCS = `
float hashEspuma(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float ruidoEspuma(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hashEspuma(i);
	float b = hashEspuma(i + vec2(1.0, 0.0));
	float c = hashEspuma(i + vec2(0.0, 1.0));
	float d = hashEspuma(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.y), f.y);
}
`;

const ESPUMA_FRAG = `
float costa = clamp(vEspumaCosta, 0.0, 1.0);
float shore = sqrt(costa);
vec2 uvN = fract(vMundoEspuma * 0.17 + vec2(uTempo * 0.04, uTempo * 0.03));
float n1 = ruidoEspuma(uvN * 8.0);
float n2 = ruidoEspuma(uvN.yx * 8.0 + 0.37);
float d1 = (n1 - 0.5) * (1.0 - shore) * 0.45;
float d2 = (n2 - 0.5) * (1.0 - shore) * 0.45;
float f1 = sin((shore + d1) * 6.2831853 - uTempo * 2.4);
float f2 = sin((shore + d2) * 6.2831853 + uTempo * 2.1 + 2.0);
f1 *= f1;
f2 *= f2 * 0.7;
float miolo = smoothstep(0.04, 0.42, costa);
float espuma = max(max(f1, f2) * shore, miolo);
diffuseColor = vec4(vec3(0.93, 0.98, 1.0), espuma);
`;

function materialEspuma() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  mat.customProgramCacheKey = () => "agua-espuma-margem";
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vEspumaCosta;\nvarying vec2 vMundoEspuma;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvMundoEspuma = vec2(position.x, position.z);",
      )
      .replace(
        "#include <color_vertex>",
        "#include <color_vertex>\nvEspumaCosta = vColor.r;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying float vEspumaCosta;\nvarying vec2 vMundoEspuma;\nuniform float uTempo;\n${ESPUMA_FUNCS}`,
      )
      .replace("#include <color_fragment>", `#include <color_fragment>\n${ESPUMA_FRAG}`);
    mat.userData.shader = shader;
  };
  return mat;
}

const matEspuma = materialEspuma();

export function obterMaterialEspuma() {
  return matEspuma;
}

/** Índice pequeno: mediump perde o quadro quando o valor passa de ~1000. */
function quadro(segundos, periodo, quadros) {
  const n = Math.max(1, quadros | 0);
  const t = segundos / periodo;
  return t - Math.floor(t / n) * n;
}

function faseDe(segundos, voltas) {
  const t = segundos * voltas;
  return t - Math.floor(t);
}

function imersoNaCrista(e) {
  if (!e || e.morto || e.capturado) return false;
  if (e.voando || e.planando || e.escalando) return false;
  if (e.nadando) return true;
  return (e.aguaProf || 0) >= 0.12;
}

function ampCrista(e) {
  const v = Math.hypot(e.vx || 0, e.vy || 0);
  return CRISTA_AMP + Math.min(0.28, v * 0.06);
}

function oferecerCrista(e, origem, n) {
  if (!imersoNaCrista(e) || !origem) return n;
  const dx = e.x - origem.x;
  const dy = e.y - origem.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > CRISTA_RAIO2) return n;
  const amp = ampCrista(e);
  if (n < CAP_CRISTA) {
    cristaX[n] = e.x;
    cristaY[n] = e.y;
    cristaA[n] = amp;
    cristaD[n] = d2;
    return n + 1;
  }
  let pior = 0;
  for (let i = 1; i < CAP_CRISTA; i++) {
    if (cristaD[i] > cristaD[pior]) pior = i;
  }
  if (d2 >= cristaD[pior]) return n;
  cristaX[pior] = e.x;
  cristaY[pior] = e.y;
  cristaA[pior] = amp;
  cristaD[pior] = d2;
  return n;
}

function publicarCrista(slots, n) {
  for (let i = 0; i < CAP_CRISTA; i++) {
    const v = slots[i];
    if (i < n) {
      v.x = cristaX[i];
      v.y = cristaY[i];
      v.z = cristaA[i];
    } else {
      v.z = 0;
    }
  }
}

/** Até 8 corpos na água, perto de quem joga. O shader só curva a crista. */
export function marcarCorposCrista(corpo, agente, atores) {
  const origem = corpo || agente;
  let n = 0;
  n = oferecerCrista(corpo, origem, n);
  if (agente !== corpo) n = oferecerCrista(agente, origem, n);
  if (atores) {
    for (let i = 0; i < atores.length; i++) {
      const a = atores[i];
      if (a === corpo || a === agente) continue;
      n = oferecerCrista(a, origem, n);
    }
  }
  publicarCrista(corposLago, n);
  publicarCrista(corposLonge, n);
}

/** Um uniforme por material — vale para todo chunk já montado. */
export function avancarMateriaisAgua(segundos) {
  const rolagem = segundos * LINHA_VEL;
  const scroll = rolagem - Math.floor(rolagem / CRISTA_ESPACO) * CRISTA_ESPACO;
  const f1 = faseDe(segundos, 1.35 / (Math.PI * 2));
  const f2 = faseDe(segundos, 0.62 / (Math.PI * 2));
  for (const mat of [matLago, matLagoLonge]) {
    const lago = mat.userData.shader;
    if (!lago) continue;
    lago.uniforms.uQuadro.value = quadro(segundos, LAGO_FRAME_S, mat.userData.quadros);
    lago.uniforms.uScroll.value = scroll;
    lago.uniforms.uFase1.value = f1;
    lago.uniforms.uFase2.value = f2;
  }
  const queda = matQueda.userData.shader;
  if (queda) {
    queda.uniforms.uQuadro.value = quadro(segundos, WF_FRAME_S, matQueda.userData.quadros);
    queda.uniforms.uLinha.value = scroll - Math.floor(scroll);
  }
  const espuma = matEspuma.userData.shader;
  if (espuma) {
    const t = segundos - Math.floor(segundos / 1000) * 1000;
    espuma.uniforms.uTempo.value = t;
  }
}

export function liberarMateriaisAgua() {
  matLago.dispose();
  matLagoLonge.dispose();
  matQueda.dispose();
  matEspuma.dispose();
  texLago.dispose();
  texQueda.dispose();
}
