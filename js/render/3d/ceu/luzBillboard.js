import * as THREE from "three";

/**
 * Cor do billboard como se o cartão olhasse para a luz (sol ou lua),
 * sem depender do yaw da câmera. O cartão que projeta sombra usa o mesmo
 * yaw — não o da câmera.
 */

const PI = Math.PI;
const normalSol = new THREE.Vector3(0, 1, 0);
const uNormalSol = { value: normalSol };
const direta = new THREE.Color(0.55, 0.5, 0.45);
const indireta = new THREE.Color(0.35, 0.32, 0.3);
const _dir = new THREE.Vector3();
const _cor = new THREE.Color();
const _out = new THREE.Color();
const _ind = new THREE.Color();

function direcaoDaLuz(luz, destino) {
  destino.copy(luz.position).sub(luz.target.position);
  if (destino.lengthSq() < 1e-8) destino.set(0, 1, 0);
  else destino.normalize();
  return destino;
}

function somarDireta(luz, ndot) {
  if (!luz || ndot <= 0) return;
  direta.add(_cor.copy(luz.color).multiplyScalar(luz.intensity * ndot));
}

/** Chamado depois que o céu posiciona sol, fill e rim. */
export function atualizarLuzBillboard({ sol, ambient, hemi, fill, rim }) {
  if (sol) direcaoDaLuz(sol, normalSol);

  indireta.set(0, 0, 0);
  if (ambient) {
    indireta.add(_cor.copy(ambient.color).multiplyScalar(ambient.intensity));
  }
  if (hemi) {
    const t = normalSol.y * 0.5 + 0.5;
    _cor.copy(hemi.groundColor).lerp(hemi.color, t).multiplyScalar(hemi.intensity);
    indireta.add(_cor);
  }

  direta.set(0, 0, 0);
  somarDireta(sol, 1);
  if (fill) somarDireta(fill, Math.max(0, normalSol.dot(direcaoDaLuz(fill, _dir))));
  if (rim) somarDireta(rim, Math.max(0, normalSol.dot(direcaoDaLuz(rim, _dir))));

  direta.multiplyScalar(1 / PI);
  indireta.multiplyScalar(1 / PI);
}

/** Yaw do cartão de sombra: plano de frente para o sol, igual a olhar pra ele. */
export function yawCartaoSol() {
  return Math.atan2(normalSol.x, normalSol.z);
}

/**
 * Sprite sem luz de cena (personagem): mesma cor que o cartão virado pro sol,
 * com a sombra de nuvem no mesmo peso do terreno.
 */
export function aplicarCorSprite(material, corBase, sombraNuvem, luzExtra) {
  const s = Math.max(0, Math.min(1, sombraNuvem ?? 1));
  const pesoIndireta = 1 - (1 - s) * 0.42;
  _out.copy(direta).multiplyScalar(s);
  _ind.copy(indireta).multiplyScalar(pesoIndireta);
  _out.add(_ind).multiply(corBase);
  if (luzExtra) {
    const pico = Math.max(luzExtra.r, luzExtra.g, luzExtra.b);
    if (pico > 0.001) {
      const clarear = Math.min(1.05, pico * 6.5);
      const inv = 1 / pico;
      _out.r += clarear * (0.72 + 0.28 * luzExtra.r * inv);
      _out.g += clarear * (0.72 + 0.28 * luzExtra.g * inv);
      _out.b += clarear * (0.72 + 0.28 * luzExtra.b * inv);
      _out.r = Math.min(_out.r, 1.35);
      _out.g = Math.min(_out.g, 1.35);
      _out.b = Math.min(_out.b, 1.35);
    }
  }
  material.color.copy(_out);
}

/**
 * Bias mínimo em view-Z pra vencer o piso sem furar cliff/prédio.
 * Folga grande (ex. 1.5) faz o cartão desenhar por cima do sólido.
 */
export const FOLGA_CHAO = 0.08;
/**
 * Empate no mesmo pé: o personagem ganha por um fio.
 */
export const FOLGA_ATOR = 0.08;
/** Decal horizontal no chão ainda pode pedir folga alta (moldeChao). */
export const FOLGA_CHAO_DECAL = 1.5;

const VERT_COLUNA = `
varying float vProfundidadeColuna;
`;

/** XZ do pivô (pé) + Y do fragmento — sort high-top-down com oclusão por altura. */
function calcColuna(folgaTxt) {
  return `
{
  vec4 localPivo = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 localFrag = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    localPivo = batchingMatrix * localPivo;
    localFrag = batchingMatrix * localFrag;
  #endif
  #ifdef USE_INSTANCING
    localPivo = instanceMatrix * localPivo;
    localFrag = instanceMatrix * localFrag;
  #endif
  vec4 pivoWorld = modelMatrix * localPivo;
  vec4 fragWorld = modelMatrix * localFrag;
  vec3 colunaWorld = vec3(pivoWorld.x, fragWorld.y, pivoWorld.z);
  vec4 colunaVista = viewMatrix * vec4(colunaWorld, 1.0);
  colunaVista.z += ${folgaTxt};
  vec4 colunaClip = projectionMatrix * colunaVista;
  vProfundidadeColuna = colunaClip.z / colunaClip.w * 0.5 + 0.5;
}
`;
}

function profundidadeColuna(shader, folgaTxt) {
  if (shader.vertexShader.includes("vProfundidadeColuna")) return;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERT_COLUNA}`)
    .replace("#include <project_vertex>", `#include <project_vertex>\n${calcColuna(folgaTxt)}`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${VERT_COLUNA}`)
    .replace(
      "#include <dithering_fragment>",
      "#include <dithering_fragment>\ngl_FragDepth = vProfundidadeColuna;",
    );
}

/**
 * Sprite THREE.Sprite: sem `transformed` de mesh — depth no pivô com folga baixa.
 * Preferir malha + aplicarLuzBillboard (coluna) quando possível.
 */
export function aplicarProfundidadeSprite(material) {
  if (!material || material.userData?.profundidadeSprite) return material;
  if (!material.userData) material.userData = {};
  material.userData.profundidadeSprite = true;

  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  const folga = (FOLGA_CHAO + FOLGA_ATOR).toFixed(2);
  const decl = "varying float vProfundidadeColuna;";
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    if (shader.vertexShader.includes("vProfundidadeColuna")) return;
    const ancora = "vec4 mvPosition = modelViewMatrix[ 3 ];";
    if (!shader.vertexShader.includes(ancora)) return;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${decl}`)
      .replace(
        ancora,
        `${ancora}
{
  vec4 pivoVista = mvPosition;
  pivoVista.z += ${folga};
  vec4 pivoClip = projectionMatrix * pivoVista;
  vProfundidadeColuna = pivoClip.z / pivoClip.w * 0.5 + 0.5;
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${decl}`)
      .replace(
        "#include <fog_fragment>",
        "#include <fog_fragment>\ngl_FragDepth = vProfundidadeColuna;",
      );
  };
  material.customProgramCacheKey = function chavePivoSprite() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|coluna-sprite|${folga}`;
  };
  return material;
}

/**
 * Volume 3D: cada fragmento usa o XZ dele no plano do chão do modelo.
 * Folga baixa pra não furar o personagem / paredes vizinhas.
 */
export function aplicarProfundidadeVolume(material, baseLocalY, folgaPivo = FOLGA_CHAO) {
  if (!material || material.userData?.profundidadeVolume) return material;
  if (!material.userData) material.userData = {};
  material.userData.profundidadeVolume = true;

  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  const y = Number(baseLocalY).toFixed(4);
  const folga = Number(folgaPivo).toFixed(2);
  const decl = "varying float vProfundidadeVolume;";
  const calc = `
{
  vec3 ancoraVolume = transformed;
  ancoraVolume.y = ${y};
  vec4 ancoraVista = modelViewMatrix * vec4(ancoraVolume, 1.0);
  ancoraVista.z += ${folga};
  vec4 ancoraClip = projectionMatrix * ancoraVista;
  vProfundidadeVolume = ancoraClip.z / ancoraClip.w * 0.5 + 0.5;
}
`;

  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    if (shader.vertexShader.includes("vProfundidadeVolume")) return;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${decl}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${calc}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${decl}`)
      .replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\ngl_FragDepth = vProfundidadeVolume;",
      );
  };
  material.customProgramCacheKey = function chaveVolume() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|volume-chao|${y}|${folga}`;
  };
  return material;
}

/**
 * Luz billboard + profundidade em coluna (XZ do pé, Y do fragmento).
 * Cliffs/prédios com depth real voltam a ocluir cabeça/torso.
 */
export function aplicarLuzBillboard(material, folgaPivo = FOLGA_CHAO) {
  if (!material || material.userData?.luzBillboard) return material;
  if (!material.userData) material.userData = {};
  material.userData.luzBillboard = true;

  const folgaTxt = Number(folgaPivo).toFixed(2);
  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    shader.uniforms.uNormalSol = uNormalSol;
    if (!shader.fragmentShader.includes("uniform vec3 uNormalSol")) {
      shader.fragmentShader = `uniform vec3 uNormalSol;\n${shader.fragmentShader}`;
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      "#include <normal_fragment_maps>\nnormal = normalize( mat3( viewMatrix ) * uNormalSol );",
    );
    profundidadeColuna(shader, folgaTxt);
  };
  material.customProgramCacheKey = function chaveLuzBillboard() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|luz-billboard|coluna|${folgaTxt}`;
  };
  return material;
}
