import * as THREE from "three";

/** @type {Map<string, THREE.Texture>} */
const texturas = new Map();
/** @type {Map<string, HTMLImageElement>} */
const imagens = new Map();

export function imagemPele(url, aoCarregar) {
  if (!url) return null;
  let img = imagens.get(url);
  if (img) return img;
  img = new Image();
  img.onload = () => {
    if (aoCarregar) aoCarregar();
  };
  img.src = url;
  imagens.set(url, img);
  return img;
}

function texturaPele(url) {
  let tex = texturas.get(url);
  if (tex) return tex;
  const img = new Image();
  tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  img.onload = () => {
    tex.needsUpdate = true;
  };
  img.src = url;
  texturas.set(url, tex);
  return tex;
}

/** Segunda textura no topo. O atributo `splat` (0..1) é o peso da mancha. */
export function aplicarPeleSplat(material, url) {
  if (!material || !url) return material;
  const tex = texturaPele(url);
  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    shader.uniforms.uPele = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float splat;\nvarying float vSplat;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSplat = splat;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uPele;\nvarying float vSplat;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
#ifdef USE_MAP
{
  vec4 corPele = texture2D(uPele, vMapUv);
  diffuseColor.rgb = mix(diffuseColor.rgb, corPele.rgb, vSplat * corPele.a);
}
#endif`,
      );
  };
  material.customProgramCacheKey = function chavePele() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "pele";
    return `${base}|${url}`;
  };
  return material;
}
