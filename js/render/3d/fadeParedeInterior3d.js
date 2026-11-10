/**
 * Paredes entre a câmera e o jogador/party ficam “transparentes” via
 * screen-door dither (descarta fragmentos). Barato, estável, sem sort
 * de transparent no batch de penhasco — padrão BOTW/AAA de oclusão local.
 *
 * Ativo em: bolso de santuário elemental + overhang/caverna (ar interno).
 * Chrono: cunha câmera → linha party↔foe (inclui palmeiras/billboards na frente).
 */
import * as THREE from "three";
import {
  ALTURA_BLOCO,
  CHRONO,
  FADE_PAREDE_INTERIOR_ALPHA,
  FADE_PAREDE_INTERIOR_ATIVO,
  FADE_PAREDE_INTERIOR_DELTA_Y,
  FADE_PAREDE_INTERIOR_FOCOS,
  FADE_PAREDE_INTERIOR_RAIO,
} from "../../config.js";
import { obterSessaoChrono } from "../../combate/chrono/sessao.js";
import { estado as estadoJogo } from "../../jogo/estado.js";
import { colunaTemArInterno } from "../../mundo/altura.js";
import { pokemonDeployado } from "../../pokemon/party.js";

const MAX_FOCOS = FADE_PAREDE_INTERIOR_FOCOS | 4;
const MARCA = Symbol("fadeParedeInterior");
/** Bump quando o GLSL do fade muda — re-hook em materiais já patchados. */
const VERSAO_FADE = 3;

const _dir = new THREE.Vector3();
const _focosScratch = [];
const _linhaA = new THREE.Vector3();
const _linhaB = new THREE.Vector3();

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
  /** 0 = discos por foco (interior); 1 = corredor Chrono. */
  uFadeChronoModo: { value: 0 },
  uFadeLinhaA: { value: new THREE.Vector3() },
  uFadeLinhaB: { value: new THREE.Vector3() },
  uFadeMeiaLargura: { value: 3.4 },
  uFadeFolgaLinha: { value: 1.4 },
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
uniform float uFadeChronoModo;
uniform vec3 uFadeLinhaA;
uniform vec3 uFadeLinhaB;
uniform float uFadeMeiaLargura;
uniform float uFadeFolgaLinha;

float fadeBayer4(vec2 p) {
  float x = mod(floor(p.x), 4.0);
  float y = mod(floor(p.y), 4.0);
  float i = x + y * 4.0;
  float v =
    i ==  0.0 ?  0.0 : i ==  1.0 ?  8.0 : i ==  2.0 ?  2.0 : i ==  3.0 ? 10.0 :
    i ==  4.0 ? 12.0 : i ==  5.0 ?  4.0 : i ==  6.0 ? 14.0 : i ==  7.0 ?  6.0 :
    i ==  8.0 ?  3.0 : i ==  9.0 ? 11.0 : i == 10.0 ?  1.0 : i == 11.0 ?  9.0 :
    i == 12.0 ? 15.0 : i == 13.0 ?  7.0 : i == 14.0 ? 13.0 : 5.0;
  return (v + 0.5) / 16.0;
}

bool fadeCobreFoco(vec3 foco) {
  if (vFadeMundo.y < foco.y + uFadeParedeDeltaY) return false;
  float dx = vFadeMundo.x - foco.x;
  float dz = vFadeMundo.z - foco.z;
  float r = uFadeParedeRaio;
  if (dx * dx + dz * dz > r * r) return false;
  float distFoco = dot(foco - uFadeParedeCam, uFadeParedeDir);
  float distFrag = dot(vFadeMundo - uFadeParedeCam, uFadeParedeDir);
  return distFrag < distFoco - 0.08;
}

// fade-chrono-v3 — cunha câmera → linha party↔foe (palmas na frente somem).
bool fadeCobreCorredorChrono() {
  vec3 A = uFadeLinhaA;
  vec3 B = uFadeLinhaB;
  float yMin = min(A.y, B.y);
  if (vFadeMundo.y < yMin + uFadeParedeDeltaY) return false;

  vec2 ab = B.xz - A.xz;
  float abLen2 = dot(ab, ab);
  if (abLen2 < 1e-6) {
    return fadeCobreFoco(A);
  }

  float t = dot(vFadeMundo.xz - A.xz, ab) / abLen2;
  float abLen = sqrt(abLen2);
  float folga = uFadeFolgaLinha / max(abLen, 1.0);
  if (t < -folga || t > 1.0 + folga) return false;
  t = clamp(t, 0.0, 1.0);
  vec2 P = A.xz + ab * t;

  vec2 toCam = uFadeParedeCam.xz - P;
  float distCam = length(toCam);
  if (distCam < 0.35) return false;
  vec2 toCamN = toCam / distCam;
  vec2 toFrag = vFadeMundo.xz - P;
  float along = dot(toFrag, toCamN);
  // Entre a linha e a câmera (não atrás do mon, não atrás da lente).
  if (along < 0.2 || along > distCam - 0.25) return false;

  float lat = length(toFrag - toCamN * along);
  // Mais largo perto da câmera — cartão de palmeira é largo.
  float u = clamp(along / distCam, 0.0, 1.0);
  float meia = uFadeMeiaLargura * mix(1.0, 2.15, u);
  return lat <= meia;
}

void aplicarFadeParedeInterior() {
  if (uFadeParedeAtivo < 0.5) return;
  bool cobre = false;
  if (uFadeChronoModo > 0.5) {
    cobre = fadeCobreCorredorChrono();
  } else {
    if (uFadeParedeN <= 0) return;
    for (int i = 0; i < ${MAX_FOCOS}; i++) {
      if (i >= uFadeParedeN) break;
      if (fadeCobreFoco(uFadeParedeFocos[i])) {
        cobre = true;
        break;
      }
    }
  }
  if (!cobre) return;
  float limiar = fadeBayer4(gl_FragCoord.xy);
  float a = clamp(uFadeParedeAlpha, 0.05, 0.95);
  if (a < limiar) discard;
}
`;

const FRAG_CHAMADA = `
aplicarFadeParedeInterior();
`;

/** Troca o bloco GLSL do fade (v1→corredor) contando chaves. */
function substituirBlocoFade(frag) {
  const start = frag.indexOf("varying vec3 vFadeMundo;");
  if (start < 0) return null;
  const fn = frag.indexOf("void aplicarFadeParedeInterior()", start);
  if (fn < 0) return null;
  let i = frag.indexOf("{", fn);
  if (i < 0) return null;
  let depth = 0;
  for (; i < frag.length; i++) {
    const c = frag.charCodeAt(i);
    if (c === 123) depth += 1;
    else if (c === 125) {
      depth -= 1;
      if (depth === 0) {
        return `${frag.slice(0, start)}${FRAG_VAR.trim()}${frag.slice(i + 1)}`;
      }
    }
  }
  return null;
}

function ligarUniforms(shader) {
  shader.uniforms.uFadeParedeAtivo = uniformsFade.uFadeParedeAtivo;
  shader.uniforms.uFadeParedeAlpha = uniformsFade.uFadeParedeAlpha;
  shader.uniforms.uFadeParedeRaio = uniformsFade.uFadeParedeRaio;
  shader.uniforms.uFadeParedeDeltaY = uniformsFade.uFadeParedeDeltaY;
  shader.uniforms.uFadeParedeCam = uniformsFade.uFadeParedeCam;
  shader.uniforms.uFadeParedeDir = uniformsFade.uFadeParedeDir;
  shader.uniforms.uFadeParedeN = uniformsFade.uFadeParedeN;
  shader.uniforms.uFadeParedeFocos = uniformsFade.uFadeParedeFocos;
  shader.uniforms.uFadeChronoModo = uniformsFade.uFadeChronoModo;
  shader.uniforms.uFadeLinhaA = uniformsFade.uFadeLinhaA;
  shader.uniforms.uFadeLinhaB = uniformsFade.uFadeLinhaB;
  shader.uniforms.uFadeMeiaLargura = uniformsFade.uFadeMeiaLargura;
  shader.uniforms.uFadeFolgaLinha = uniformsFade.uFadeFolgaLinha;
}

/**
 * Hook no material de penhasco / paredes voxel (uma vez por versão).
 * @param {THREE.Material} material
 */
export function aplicarFadeParedeInterior(material) {
  if (!material) return material;
  if (material[MARCA] === VERSAO_FADE) return material;
  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material[MARCA] = VERSAO_FADE;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    ligarUniforms(shader);
    // Já na versão atual do GLSL.
    if (shader.fragmentShader.includes("fade-chrono-v3")) return;
    if (!shader.vertexShader.includes("vFadeMundo")) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERT_VAR}`)
        .replace("#include <worldpos_vertex>", VERT_CORPO);
    }
    if (shader.fragmentShader.includes("void aplicarFadeParedeInterior()")) {
      const trocado = substituirBlocoFade(shader.fragmentShader);
      if (trocado) shader.fragmentShader = trocado;
    } else {
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
    }
  };
  material.customProgramCacheKey = function chaveFadeParede() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|fade-parede-interior|chrono-corredor-v${VERSAO_FADE}`;
  };
  material.needsUpdate = true;
  return material;
}

function sobOverhang(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (colunaTemArInterno(ix, iy)) return true;
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
  const papelFade = estadoJogo.interior?.papel;
  if (papelFade === "santuario" || papelFade === "caverna") return true;
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

function primeiroVivo(lista) {
  if (!lista) return null;
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a && !a.morto && !a.capturado && (a.hp == null || a.hp > 0)) return a;
  }
  return null;
}

function ultimoVivo(lista) {
  if (!lista) return null;
  for (let i = lista.length - 1; i >= 0; i--) {
    const a = lista[i];
    if (a && !a.morto && !a.capturado && (a.hp == null || a.hp > 0)) return a;
  }
  return null;
}

function mundoDoAtor(ator, out) {
  const elev = (ator.elevacao ?? ator.z ?? 0) + (ator.hopLift || 0);
  out.set(ator.x, elev * ALTURA_BLOCO, ator.y);
}

/**
 * Atualiza uniforms do fade. Chamar 1×/frame no loop 3D.
 * @param {object} corpo jogador
 * @param {THREE.Camera} camera
 */
export function tickFadeParedeInterior(corpo, camera) {
  const sessChrono = obterSessaoChrono();
  const emChrono = !!sessChrono;
  if (
    !FADE_PAREDE_INTERIOR_ATIVO ||
    !camera ||
    (!emChrono && !fadeParedeInteriorDeveAtivar(corpo))
  ) {
    uniformsFade.uFadeParedeAtivo.value = 0;
    uniformsFade.uFadeParedeN.value = 0;
    uniformsFade.uFadeChronoModo.value = 0;
    return;
  }

  uniformsFade.uFadeParedeAtivo.value = 1;
  const cam = camera.position;
  uniformsFade.uFadeParedeCam.value.copy(cam);
  camera.getWorldDirection(_dir);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, -0.7, -0.7).normalize();
  uniformsFade.uFadeParedeDir.value.copy(_dir);

  if (emChrono) {
    const party = primeiroVivo(sessChrono.aliados);
    const foe = primeiroVivo(sessChrono.foes) || ultimoVivo(sessChrono.foes);
    if (!party && !foe) {
      uniformsFade.uFadeParedeAtivo.value = 0;
      uniformsFade.uFadeChronoModo.value = 0;
      return;
    }
    const a = party || foe;
    const b = foe && foe !== a ? foe : ultimoVivo(sessChrono.aliados) || a;
    mundoDoAtor(a, _linhaA);
    mundoDoAtor(b, _linhaB);
    // Estende a ponta aliada até o treinador (senão a palma tapa o player fora da cunha).
    if (corpo && party && foe && foe !== party) {
      const abx = _linhaB.x - _linhaA.x;
      const abz = _linhaB.z - _linhaA.z;
      const len2 = abx * abx + abz * abz;
      if (len2 > 1e-4) {
        const tPlayer =
          ((corpo.x - _linhaA.x) * abx + (corpo.y - _linhaA.z) * abz) / len2;
        if (tPlayer < 0) {
          const elev = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
          _linhaA.set(corpo.x, elev, corpo.y);
        }
      }
    }
    // Se só um mon, estende um pouco no eixo lateral pra ter segmento.
    if (a === b) {
      const y = _linhaA.y;
      const lx = -_dir.z;
      const lz = _dir.x;
      const llen = Math.hypot(lx, lz) || 1;
      _linhaA.set(a.x - (lx / llen) * 1.2, y, a.y - (lz / llen) * 1.2);
      _linhaB.set(a.x + (lx / llen) * 1.2, y, a.y + (lz / llen) * 1.2);
    }

    uniformsFade.uFadeChronoModo.value = 1;
    uniformsFade.uFadeLinhaA.value.copy(_linhaA);
    uniformsFade.uFadeLinhaB.value.copy(_linhaB);
    uniformsFade.uFadeParedeAlpha.value = CHRONO.FADE_ALPHA ?? 0.22;
    uniformsFade.uFadeParedeDeltaY.value =
      (CHRONO.FADE_DELTA_Y ?? 0.55) * ALTURA_BLOCO;
    uniformsFade.uFadeMeiaLargura.value = CHRONO.FADE_MEIA_LARGURA ?? 3.4;
    uniformsFade.uFadeFolgaLinha.value = CHRONO.FADE_FOLGA_LINHA ?? 1.4;
    uniformsFade.uFadeParedeN.value = 0;
    return;
  }

  uniformsFade.uFadeChronoModo.value = 0;
  uniformsFade.uFadeParedeAlpha.value = FADE_PAREDE_INTERIOR_ALPHA;
  uniformsFade.uFadeParedeRaio.value = FADE_PAREDE_INTERIOR_RAIO;
  uniformsFade.uFadeParedeDeltaY.value = FADE_PAREDE_INTERIOR_DELTA_Y * ALTURA_BLOCO;

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
  uniformsFade.uFadeChronoModo.value = 0;
}

/** Reaplica fade vN em materiais já vivos na cena (Chrono / hot-reload). */
export function sincronizarFadeParedeNaCena(raiz) {
  if (!raiz?.traverse) return;
  raiz.traverse((obj) => {
    const mats = obj.material;
    if (!mats) return;
    if (Array.isArray(mats)) {
      for (let i = 0; i < mats.length; i++) aplicarFadeParedeInterior(mats[i]);
    } else {
      aplicarFadeParedeInterior(mats);
    }
  });
}
