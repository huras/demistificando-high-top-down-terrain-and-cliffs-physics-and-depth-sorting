/**
 * Tint seletivo do correio HGSS.
 * Albedo fica neutro só nas regiões vermelhas; instanceColor multiplica via máscara.
 */
import * as THREE from "three";

/** Pixels top-left no PNG 32×32 (board_a / board_b). */
export const REGIOES_TINT_CORREIO = Object.freeze([
  Object.freeze({ x: 16, y: 0, w: 16, h: 16 }),
  Object.freeze({ x: 18, y: 16, w: 4, h: 16 }),
]);

const MARCA = Symbol("tintCorreio");
/** uuid da textura fonte → { albedo, mascara } */
const cache = new Map();

function copiarAmostragem(fonte, dest) {
  dest.colorSpace = fonte.colorSpace;
  dest.magFilter = fonte.magFilter;
  dest.minFilter = fonte.minFilter;
  dest.generateMipmaps = fonte.generateMipmaps;
  dest.wrapS = fonte.wrapS;
  dest.wrapT = fonte.wrapT;
  dest.flipY = fonte.flipY;
  dest.needsUpdate = true;
}

function prepararPar(texFonte) {
  const img = texFonte?.image;
  if (!img?.width) return null;
  const hit = cache.get(texFonte.uuid);
  if (hit) return hit;

  const w = img.width | 0;
  const h = img.height | 0;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const albedoData = ctx.getImageData(0, 0, w, h);
  const maskData = ctx.createImageData(w, h);
  const px = albedoData.data;
  const mk = maskData.data;

  for (let i = 0; i < mk.length; i += 4) {
    mk[i] = 0;
    mk[i + 1] = 0;
    mk[i + 2] = 0;
    mk[i + 3] = 255;
  }

  for (let r = 0; r < REGIOES_TINT_CORREIO.length; r++) {
    const reg = REGIOES_TINT_CORREIO[r];
    const x1 = Math.min(w, reg.x + reg.w);
    const y1 = Math.min(h, reg.y + reg.h);
    for (let y = Math.max(0, reg.y); y < y1; y++) {
      for (let x = Math.max(0, reg.x); x < x1; x++) {
        const i = (y * w + x) * 4;
        const v = Math.max(px[i], px[i + 1], px[i + 2]);
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
        mk[i] = 255;
        mk[i + 1] = 255;
        mk[i + 2] = 255;
      }
    }
  }

  ctx.putImageData(albedoData, 0, 0);
  const albedo = new THREE.CanvasTexture(canvas);
  copiarAmostragem(texFonte, albedo);
  albedo.colorSpace = THREE.SRGBColorSpace;

  const canvasMask = document.createElement("canvas");
  canvasMask.width = w;
  canvasMask.height = h;
  canvasMask.getContext("2d").putImageData(maskData, 0, 0);
  const mascara = new THREE.CanvasTexture(canvasMask);
  mascara.magFilter = THREE.NearestFilter;
  mascara.minFilter = THREE.NearestFilter;
  mascara.generateMipmaps = false;
  mascara.wrapS = texFonte.wrapS;
  mascara.wrapT = texFonte.wrapT;
  mascara.flipY = texFonte.flipY;
  mascara.colorSpace = THREE.NoColorSpace;
  mascara.needsUpdate = true;

  const par = { albedo, mascara };
  cache.set(texFonte.uuid, par);
  return par;
}

/**
 * Troca o map por albedo neutro nas regiões tintáveis e aplica instanceColor só na máscara.
 * Encadear depois de aplicarLuzCidade / profundidade.
 */
export function aplicarTintCorreio(material) {
  if (!material || material[MARCA]) return material;
  const fonte = material.map;
  if (!fonte) return material;
  const par = prepararPar(fonte);
  if (!par) return material;

  material[MARCA] = true;
  material.map = par.albedo;
  material.userData.mascaraTintCorreio = par.mascara;

  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    shader.uniforms.uMascaraTint = { value: par.mascara };
    if (!shader.fragmentShader.includes("uniform sampler2D uMascaraTint")) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uMascaraTint;",
      );
    }
    const bloco = `#include <color_fragment>`;
    if (!shader.fragmentShader.includes(bloco)) return;
    shader.fragmentShader = shader.fragmentShader.replace(
      bloco,
      `
#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	{
		float mTint = texture2D( uMascaraTint, vMapUv ).r;
		diffuseColor.rgb *= mix( vec3( 1.0 ), vColor, mTint );
	}
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif
`,
    );
  };
  material.customProgramCacheKey = function chaveTintCorreio() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|tint-correio-mascara`;
  };
  material.needsUpdate = true;
  return material;
}
