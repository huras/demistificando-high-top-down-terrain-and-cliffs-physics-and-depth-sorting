/**
 * Lâmina e cachoeira 3D: tile CENTER das folhas do Pokémon AI.
 * Quadros lado a lado. O include do mapa é trocado antes de o Three
 * expandir os chunks — senão o fract não entra e o tile estica.
 * A faixa branca desliza por cima do sprite, como a corrente antiga.
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

const LINHA_VEL = 0.35;

const MAPA_AGUA = `
#ifdef USE_MAP
	vec2 uvAgua = fract(vMapUv);
	float nQ = max(uQuadros, 1.0);
	float q = mod(floor(uQuadro), nQ);
	vec4 sampledDiffuseColor = texture2D(map, vec2((q + uvAgua.x) / nQ, uvAgua.y));
	float eixo = mix(vMapUv.x, vMapUv.y, uEixoLinha);
	float faixa = step(fract(eixo + uLinha), 0.25);
	sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(1.0), faixa * 0.8);
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

function materialFolha(textura, quadros, opacidade, eixoLinha, cacheKey) {
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
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uQuadro = { value: 0 };
    shader.uniforms.uQuadros = { value: mat.userData.quadros };
    shader.uniforms.uLinha = { value: 0 };
    shader.uniforms.uEixoLinha = { value: mat.userData.eixoLinha };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform highp float uQuadro;\nuniform highp float uQuadros;\nuniform highp float uLinha;\nuniform highp float uEixoLinha;",
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

const texLago = texturaPixel(canvasChato("#7ec8e3"));
const texQueda = texturaPixel(canvasChato("#9fd4ea"));
const matLago = aplicarSombraNuvem(materialFolha(texLago, 1, 0.78, 0, "agua-lago-centro"));
const matQueda = aplicarSombraNuvem(materialFolha(texQueda, 1, 0.92, 1, "agua-queda-centro"));

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
  aplicarFita(texLago, matLago, fita(img, amostras));
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

export function obterMaterialQueda() {
  return matQueda;
}

/** Índice pequeno: mediump perde o quadro quando o valor passa de ~1000. */
function quadro(segundos, periodo, quadros) {
  const n = Math.max(1, quadros | 0);
  const t = segundos / periodo;
  return t - Math.floor(t / n) * n;
}

/** Um uniforme por material — vale para todo chunk já montado. */
export function avancarMateriaisAgua(segundos) {
  const linha = segundos * LINHA_VEL;
  const faixa = linha - Math.floor(linha);
  const lago = matLago.userData.shader;
  if (lago) {
    lago.uniforms.uQuadro.value = quadro(segundos, LAGO_FRAME_S, matLago.userData.quadros);
    lago.uniforms.uLinha.value = faixa;
  }
  const queda = matQueda.userData.shader;
  if (queda) {
    queda.uniforms.uQuadro.value = quadro(segundos, WF_FRAME_S, matQueda.userData.quadros);
    queda.uniforms.uLinha.value = faixa;
  }
}

export function liberarMateriaisAgua() {
  matLago.dispose();
  matQueda.dispose();
  texLago.dispose();
  texQueda.dispose();
}
