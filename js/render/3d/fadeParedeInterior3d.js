/**
 * Paredes entre a câmera e o jogador/party ficam “transparentes” via
 * screen-door dither (descarta fragmentos). Barato, estável, sem sort
 * de transparent no batch de penhasco — padrão BOTW/AAA de oclusão local.
 *
 * Ativo em: bolso de santuário elemental + overhang/caverna (ar interno).
 */
import * as THREE from "three";
import {
  ALTURA_BLOCO,
  FADE_PAREDE_INTERIOR_ALPHA,
  FADE_PAREDE_INTERIOR_ATIVO,
  FADE_PAREDE_INTERIOR_DELTA_Y,
  FADE_PAREDE_INTERIOR_FOCOS,
  FADE_PAREDE_INTERIOR_RAIO,
} from "../../config.js";
import { estado as estadoJogo } from "../../jogo/estado.js";
import { colunaTemArInterno } from "../../mundo/altura.js";
import { pokemonDeployado } from "../../pokemon/party.js";

const MAX_FOCOS = FADE_PAREDE_INTERIOR_FOCOS | 4;
const MARCA = Symbol("fadeParedeInterior");

const _dir = new THREE.Vector3();
const _focosScratch = [];

const uniformsFade = {
  uFadeParedeAtivo: { value: 0 },
  uFadeParedeAlpha: { value: FADE_PAREDE_INTERIOR_ALPHA },
  uFadeParedeRaio: { value: FADE_PAREDE_INTERIOR_RAIO },
  uFadeParedeDeltaY: { value: FADE_PAREDE_INTERIOR_DELTA_Y },
  uFadeParedeCam: { value: new THREE.Vector3() },
  uFadeParedeDir: { value: new THREE.Vector3(0, 0, -1) },
  uFadeParedeN: { value: 0 },
  uFadeParedeFocos: {
    value: Array.from({ length: MAX_FOCOS }, () => new THREE.Vector3()),
  },
};

const VERT_VAR = `varying vec3 vFadeMundo;`;

const VERT_CORPO = `
#include <worldpos_vertex>
{
  vec4 fadeP = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  fadeP = instanceMatrix * fadeP;
#endif
#ifdef USE_BATCHING
  fadeP = batchingMatrix * fadeP;
#endif
  vFadeMundo = (modelMatrix * fadeP).xyz;
}
`;

const FRAG_VAR = `
varying vec3 vFadeMundo;
uniform float uFadeParedeAtivo;
uniform float uFadeParedeAlpha;
uniform float uFadeParedeRaio;
uniform float uFadeParedeDeltaY;
uniform vec3 uFadeParedeCam;
uniform vec3 uFadeParedeDir;
uniform int uFadeParedeN;
uniform vec3 uFadeParedeFocos[${MAX_FOCOS}];

float fadeBayer4(vec2 p) {
  float x = mod(floor(p.x), 4.0);
  float y = mod(floor(p.y), 4.0);
  float i = x + y * 4.0;
  // Matriz Bayer 4×4 normalizada.
  float v =
    i ==  0.0 ?  0.0 : i ==  1.0 ?  8.0 : i ==  2.0 ?  2.0 : i ==  3.0 ? 10.0 :
    i ==  4.0 ? 12.0 : i ==  5.0 ?  4.0 : i ==  6.0 ? 14.0 : i ==  7.0 ?  6.0 :
    i ==  8.0 ?  3.0 : i ==  9.0 ? 11.0 : i == 10.0 ?  1.0 : i == 11.0 ?  9.0 :
    i == 12.0 ? 15.0 : i == 13.0 ?  7.0 : i == 14.0 ? 13.0 : 5.0;
  return (v + 0.5) / 16.0;
}

bool fadeCobreFoco(vec3 foco) {
  // Chão / degrau baixo sob o foco permanece opaco.
  if (vFadeMundo.y < foco.y + uFadeParedeDeltaY) return false;
  float dx = vFadeMundo.x - foco.x;
  float dz = vFadeMundo.z - foco.z;
  float r = uFadeParedeRaio;
  if (dx * dx + dz * dz > r * r) return false;
  float distFoco = dot(foco - uFadeParedeCam, uFadeParedeDir);
  float distFrag = dot(vFadeMundo - uFadeParedeCam, uFadeParedeDir);
  return distFrag < distFoco - 0.08;
}

void aplicarFadeParedeInterior() {
  if (uFadeParedeAtivo < 0.5 || uFadeParedeN <= 0) return;
  bool cobre = false;
  for (int i = 0; i < ${MAX_FOCOS}; i++) {
    if (i >= uFadeParedeN) break;
    if (fadeCobreFoco(uFadeParedeFocos[i])) {
      cobre = true;
      break;
    }
  }
  if (!cobre) return;
  float limiar = fadeBayer4(gl_FragCoord.xy);
  // Soft edge: perto do raio descarta menos.
  float a = clamp(uFadeParedeAlpha, 0.05, 0.95);
  if (a < limiar) discard;
}
`;

const FRAG_CHAMADA = `
aplicarFadeParedeInterior();
`;

function ligarUniforms(shader) {
  shader.uniforms.uFadeParedeAtivo = uniformsFade.uFadeParedeAtivo;
  shader.uniforms.uFadeParedeAlpha = uniformsFade.uFadeParedeAlpha;
  shader.uniforms.uFadeParedeRaio = uniformsFade.uFadeParedeRaio;
  shader.uniforms.uFadeParedeDeltaY = uniformsFade.uFadeParedeDeltaY;
  shader.uniforms.uFadeParedeCam = uniformsFade.uFadeParedeCam;
  shader.uniforms.uFadeParedeDir = uniformsFade.uFadeParedeDir;
  shader.uniforms.uFadeParedeN = uniformsFade.uFadeParedeN;
  shader.uniforms.uFadeParedeFocos = uniformsFade.uFadeParedeFocos;
}

/**
 * Hook no material de penhasco / paredes voxel (uma vez).
 * @param {THREE.Material} material
 */
export function aplicarFadeParedeInterior(material) {
  if (!material || material[MARCA]) return material;
  material[MARCA] = true;
  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    if (shader.fragmentShader.includes("aplicarFadeParedeInterior")) return;
    ligarUniforms(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_VAR}`)
      .replace("#include <worldpos_vertex>", VERT_CORPO);
    let frag = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${FRAG_VAR}`,
    );
    if (frag.includes("#include <map_fragment>")) {
      frag = frag.replace(
        "#include <map_fragment>",
        `#include <map_fragment>\n${FRAG_CHAMADA}`,
      );
    } else if (frag.includes("#include <opaque_fragment>")) {
      frag = frag.replace(
        "#include <opaque_fragment>",
        `${FRAG_CHAMADA}\n#include <opaque_fragment>`,
      );
    }
    shader.fragmentShader = frag;
  };
  material.customProgramCacheKey = function chaveFadeParede() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|fade-parede-interior|bayer4`;
  };
  // Força recompile se o material já estava em uso (topo cacheado).
  material.needsUpdate = true;
  return material;
}

function sobOverhang(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (colunaTemArInterno(ix, iy)) return true;
  // Vizinhos: entrada de caverna / borda do deck.
  return (
    colunaTemArInterno(ix + 1, iy) ||
    colunaTemArInterno(ix - 1, iy) ||
    colunaTemArInterno(ix, iy + 1) ||
    colunaTemArInterno(ix, iy - 1)
  );
}

/** Santuário elemental ou debaixo de overhang/caverna. */
export function fadeParedeInteriorDeveAtivar(corpo) {
  if (!FADE_PAREDE_INTERIOR_ATIVO || !corpo) return false;
  if (estadoJogo.interior?.papel === "santuario") return true;
  return sobOverhang(corpo.x, corpo.y);
}

function empurrarFoco(lista, ator) {
  if (!ator || ator.morto || ator.capturado) return;
  if (!Number.isFinite(ator.x) || !Number.isFinite(ator.y)) return;
  const elev = (ator.elevacao ?? ator.z ?? 0) + (ator.hopLift || 0);
  lista.push({
    x: ator.x,
    y: elev * ALTURA_BLOCO,
    z: ator.y,
  });
}

/**
 * Atualiza uniforms do fade. Chamar 1×/frame no loop 3D.
 * @param {object} corpo jogador
 * @param {THREE.Camera} camera
 */
export function tickFadeParedeInterior(corpo, camera) {
  if (!FADE_PAREDE_INTERIOR_ATIVO || !camera || !fadeParedeInteriorDeveAtivar(corpo)) {
    uniformsFade.uFadeParedeAtivo.value = 0;
    uniformsFade.uFadeParedeN.value = 0;
    return;
  }

  uniformsFade.uFadeParedeAtivo.value = 1;
  uniformsFade.uFadeParedeAlpha.value = FADE_PAREDE_INTERIOR_ALPHA;
  uniformsFade.uFadeParedeRaio.value = FADE_PAREDE_INTERIOR_RAIO;
  uniformsFade.uFadeParedeDeltaY.value = FADE_PAREDE_INTERIOR_DELTA_Y * ALTURA_BLOCO;

  const cam = camera.position;
  uniformsFade.uFadeParedeCam.value.copy(cam);
  camera.getWorldDirection(_dir);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, -0.7, -0.7).normalize();
  uniformsFade.uFadeParedeDir.value.copy(_dir);

  _focosScratch.length = 0;
  empurrarFoco(_focosScratch, {
    x: corpo.x,
    y: corpo.y,
    elevacao: corpo.elevacao ?? corpo.z,
    hopLift: corpo.hopLift,
    morto: false,
    capturado: false,
  });
  empurrarFoco(_focosScratch, pokemonDeployado());

  const n = Math.min(MAX_FOCOS, _focosScratch.length);
  uniformsFade.uFadeParedeN.value = n;
  const arr = uniformsFade.uFadeParedeFocos.value;
  for (let i = 0; i < n; i++) {
    const f = _focosScratch[i];
    arr[i].set(f.x, f.y, f.z);
  }
}

export function limparFadeParedeInterior() {
  uniformsFade.uFadeParedeAtivo.value = 0;
  uniformsFade.uFadeParedeN.value = 0;
}
