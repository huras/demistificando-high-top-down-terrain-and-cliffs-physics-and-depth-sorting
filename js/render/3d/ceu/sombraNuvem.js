import { FRAG_POCA, FRAG_POCA_REFLEXO, FRAG_POCA_SAIDA, ligarUniformsPoca } from "./pocaChao.js";
import { uniformsNuvem } from "./parametros.js";
import { GLSL_LUZ_CIDADE, ligarUniformsLuzCidade } from "../luzes/mapaChao.js";

const MARCA = "sombraNuvem";
let avisou = false;
let avisouPoca = false;

const VERT_COMUM = `
varying vec3 vMundoCeu;
`;

const FRAG_COMUM = `
varying vec3 vMundoCeu;
uniform sampler2D uMapaNuvem;
uniform vec2 uVentoNuvem;
uniform vec2 uCisalha;
uniform float uEscalaNuvem;
uniform float uAlturaNuvem;
uniform float uLimiarNuvem;
uniform float uForcaSombra;
uniform float uUmidade;

float sombraNuvem() {
  vec2 uv = (vMundoCeu.xz + uVentoNuvem) * uEscalaNuvem;
  uv += uCisalha * (uAlturaNuvem - vMundoCeu.y);
  float d = texture2D(uMapaNuvem, uv).r;
  float d2 = texture2D(uMapaNuvem, uv + vec2(0.004, -0.003)).r;
  float cobertura = smoothstep(uLimiarNuvem, uLimiarNuvem + 0.2, d);
  float cobertura2 = smoothstep(uLimiarNuvem, uLimiarNuvem + 0.2, d2);
  float sombra = mix(cobertura, cobertura2, 0.45);
  return mix(1.0, 1.0 - uForcaSombra, sombra);
}
${GLSL_LUZ_CIDADE}
`;

const VERT_MUNDO = `
#include <worldpos_vertex>
vec4 mundoCeuV = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mundoCeuV = instanceMatrix * mundoCeuV;
#endif
#ifdef USE_BATCHING
  mundoCeuV = batchingMatrix * mundoCeuV;
#endif
vMundoCeu = (modelMatrix * mundoCeuV).xyz;
`;

const FRAG_LUZ = `
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.82, 0.88), uUmidade);
roughnessFactor = mix(roughnessFactor, min(roughnessFactor, 0.34), uUmidade);
`;

const FRAG_SOMA = `
float sombraN = sombraNuvem();
reflectedLight.directDiffuse *= sombraN;
reflectedLight.indirectDiffuse *= mix(1.0, sombraN, 0.42);
vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + clarearLampadaCidade(vMundoCeu) * diffuseColor.rgb;
`;

function ligarUniforms(shader) {
  shader.uniforms.uMapaNuvem = uniformsNuvem.uMapaNuvem;
  shader.uniforms.uVentoNuvem = uniformsNuvem.uVentoNuvem;
  shader.uniforms.uCisalha = uniformsNuvem.uCisalha;
  shader.uniforms.uEscalaNuvem = uniformsNuvem.uEscalaNuvem;
  shader.uniforms.uAlturaNuvem = uniformsNuvem.uAlturaNuvem;
  shader.uniforms.uLimiarNuvem = uniformsNuvem.uLimiarNuvem;
  shader.uniforms.uForcaSombra = uniformsNuvem.uForcaSombra;
  shader.uniforms.uUmidade = uniformsNuvem.uUmidade;
  ligarUniformsLuzCidade(shader);
}

/**
 * Projeta o mesmo mapa do céu no difuso.
 * A cisalha é a direção do sol vezes a altura da nuvem — a sombra não fica
 * embaixo da nuvem quando o sol está baixo (o truque do BOTW).
 */
const MARCA_HOOK = Symbol(MARCA);

export function aplicarSombraNuvem(material) {
  if (!material || material[MARCA_HOOK]) return material;
  material[MARCA_HOOK] = true;
  if (!material.userData) material.userData = {};
  material.userData[MARCA] = true;

  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    ligarUniforms(shader);
    ligarUniformsPoca(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_COMUM}`)
      .replace("#include <worldpos_vertex>", VERT_MUNDO);

    let frag = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${FRAG_COMUM}\n${FRAG_POCA}`,
    );
    if (frag.includes("#include <roughnessmap_fragment>")) {
      frag = frag.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${FRAG_LUZ}`);
    }
    const soma = "vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;";
    if (frag.includes(soma)) frag = frag.replace(soma, FRAG_SOMA);
    else if (!avisou) {
      avisou = true;
      console.warn("ceu: shader sem totalDiffuse, sombra de nuvem não entrou");
    }
    if (!material.transparent && frag.includes("#include <opaque_fragment>")) {
      frag = frag.replace("#include <opaque_fragment>", `${FRAG_POCA_SAIDA}\n#include <opaque_fragment>`);
    } else if (!material.transparent && !avisouPoca) {
      avisouPoca = true;
      console.warn("ceu: shader sem opaque_fragment, poça não entrou");
    }
    if (frag.includes("#include <colorspace_fragment>")) {
      frag = frag.replace(
        "#include <colorspace_fragment>",
        `${FRAG_POCA_REFLEXO}\n#include <colorspace_fragment>`,
      );
    }
    shader.fragmentShader = frag;
  };
  material.customProgramCacheKey = function chaveSombra() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|sombra-nuvem|poca|reflexo-sem-ceu|mascara-agua|luz-cidade|clareia-branco`;
  };
  return material;
}
