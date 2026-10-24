/**
 * Balanço de vento no vértice (GPU) para billboards de vegetação.
 * Pé no pivô fica parado; o topo cede na direção do vento do clima.
 * Uniforms compartilhados — um set por frame, todos os materiais.
 */
import * as THREE from "three";
import { VEG_VENTO_ARVORE, VEG_VENTO_CLUMP, VEG_VENTO_MATA } from "../../../config.js";
import { obterVentoMundo } from "../../../clima/amostra.js";

export const uniformsVentoVeg = {
  uVentoVeg: { value: new THREE.Vector2() },
  uTempoVeg: { value: 0 },
};

const MARCA = Symbol("ventoVeg");

const PERFIS = Object.freeze({
  arvore: VEG_VENTO_ARVORE,
  mata: VEG_VENTO_MATA,
  clump: VEG_VENTO_CLUMP,
});

const GLSL_UNIFORMS = `
uniform vec2 uVentoVeg;
uniform float uTempoVeg;
`;

function codigoVento(perfil) {
  const p = PERFIS[perfil] || PERFIS.arvore;
  const forca = Number(p.forca).toFixed(5);
  const freq = Number(p.freq).toFixed(4);
  const tipPow = Number(p.tipPow).toFixed(3);
  return `
{
  float alt = max(transformed.y, 0.0);
  float peso = pow(alt, ${tipPow});
  float inten = length(uVentoVeg);
  vec2 dir = inten > 1e-5 ? uVentoVeg / inten : vec2(1.0, 0.0);
#ifdef USE_INSTANCING
  vec3 pe = instanceMatrix[3].xyz;
#else
  vec3 pe = vec3(0.0);
#endif
  float fase = uTempoVeg * ${freq} * (0.85 + inten * 0.55) + pe.x * 0.19 + pe.z * 0.14;
  float onda = sin(fase) * 0.62 + sin(fase * 1.73 + 2.05) * 0.38;
  float amp = inten * ${forca} * peso;
  vec3 ventoMundo = vec3(dir.x, 0.0, dir.y) * (onda * amp);
#ifdef USE_INSTANCING
  // Colunas = eixos locais em espaço do pai (já com escala do cartão).
  vec3 ex = instanceMatrix[0].xyz;
  vec3 ey = instanceMatrix[1].xyz;
  vec3 ez = instanceMatrix[2].xyz;
  float inv2 = 1.0 / max(dot(ex, ex), 1e-6);
  float invY2 = 1.0 / max(dot(ey, ey), 1e-6);
  float invZ2 = 1.0 / max(dot(ez, ez), 1e-6);
  transformed.x += dot(ventoMundo, ex) * inv2;
  transformed.y += dot(ventoMundo, ey) * invY2;
  transformed.z += dot(ventoMundo, ez) * invZ2;
#else
  transformed += ventoMundo;
#endif
}
`;
}

/**
 * @param {THREE.Material} material
 * @param {"arvore"|"mata"|"clump"} [perfil]
 */
export function aplicarVentoVeg(material, perfil = "arvore") {
  if (!material || material[MARCA]) return material;
  material[MARCA] = true;
  if (!material.userData) material.userData = {};
  material.userData.ventoVeg = perfil;

  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  const chavePerfil = perfil || "arvore";
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    shader.uniforms.uVentoVeg = uniformsVentoVeg.uVentoVeg;
    shader.uniforms.uTempoVeg = uniformsVentoVeg.uTempoVeg;
    if (shader.vertexShader.includes("uVentoVeg")) return;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${GLSL_UNIFORMS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${codigoVento(chavePerfil)}`);
  };
  material.customProgramCacheKey = function chaveVento() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|vento-veg|${chavePerfil}`;
  };
  return material;
}

/** Atualiza vento + tempo. Barato: só 3 floats. */
export function atualizarVentoVeg(dt) {
  const vento = obterVentoMundo();
  const u = uniformsVentoVeg.uVentoVeg.value;
  u.x = vento?.vx ?? 0;
  u.y = vento?.vy ?? 0;
  uniformsVentoVeg.uTempoVeg.value += Math.max(0, dt || 0);
}
