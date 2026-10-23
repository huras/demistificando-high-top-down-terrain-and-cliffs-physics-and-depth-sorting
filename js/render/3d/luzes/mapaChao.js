import * as THREE from "three";
import { obterPesoNoite } from "./pool.js";

const LADO = 128;
const METROS = 160;
const PASSO = 8;
const TEXEL = METROS / LADO;
const LIMITE = 2.2;

const PERFIL_POSTE = { raio: 16, ganho: 0.12, cor: 0xffc56a, curva: 4 };
const PERFIL_CASA = { raio: 8, ganho: 0.12, cor: 0xffffff, curva: 4 };
/** Base branca: a cor do elemento multiplica limpa no oferecerLuzChao. */
const PERFIL_SANTUARIO = { raio: 18, ganho: 0.15, cor: 0xffffff, curva: 3 };

const dados = new Float32Array(LADO * LADO * 4);
const pesos = new Float32Array(LADO * LADO);
const half = new Uint16Array(LADO * LADO * 4);
const fontes = [];
const _perfil = new THREE.Color();
const _catalogo = new THREE.Color();

let nFontes = 0;
let origemX = Number.NaN;
let origemZ = Number.NaN;
let assinatura = 0;

const textura = new THREE.DataTexture(half, LADO, LADO, THREE.RGBAFormat, THREE.HalfFloatType);
textura.wrapS = THREE.ClampToEdgeWrapping;
textura.wrapT = THREE.ClampToEdgeWrapping;
textura.magFilter = THREE.LinearFilter;
textura.minFilter = THREE.LinearFilter;
textura.generateMipmaps = false;
textura.flipY = false;
textura.colorSpace = THREE.NoColorSpace;
textura.needsUpdate = true;

export const uniformsLuzCidade = {
  uMapaLuzCidade: { value: textura },
  uOrigemLuzCidade: { value: new THREE.Vector2() },
  uTexelLuzCidade: { value: 1 / METROS },
  uPesoLuzCidade: { value: 0 },
};

export const GLSL_LUZ_CIDADE = `
uniform sampler2D uMapaLuzCidade;
uniform vec2 uOrigemLuzCidade;
uniform float uTexelLuzCidade;
uniform float uPesoLuzCidade;

vec3 luzCidade(vec3 mundo) {
  vec2 uv = (mundo.xz - uOrigemLuzCidade) * uTexelLuzCidade;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return vec3(0.0);
  vec4 luz = texture2D(uMapaLuzCidade, uv);
  float queda = 1.0 - smoothstep(6.0, 18.0, abs(mundo.y - luz.a));
  return luz.rgb * queda * uPesoLuzCidade;
}

/** Mesmo ganho do chão (sombraNuvem): o mapa cru é fraco demais nas casas. */
vec3 clarearLampadaCidade(vec3 mundo) {
  vec3 lampada = luzCidade(mundo);
  float pico = max(lampada.r, max(lampada.g, lampada.b));
  float ganho = min(2.2, pico * 12.0);
  vec3 tinta = lampada / max(pico, 1e-4);
  return ganho * (vec3(0.82) + tinta * 0.18);
}
`;

const VERT_VAR = "varying vec3 vMundoLuz;";
const VERT_CORPO = `
#include <worldpos_vertex>
vec4 mundoLuzV = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mundoLuzV = instanceMatrix * mundoLuzV;
#endif
#ifdef USE_BATCHING
  mundoLuzV = batchingMatrix * mundoLuzV;
#endif
vMundoLuz = (modelMatrix * mundoLuzV).xyz;
`;
const FRAG_SOMA_LOCAL = "vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + clarearLampadaCidade(vMundoLuz) * diffuseColor.rgb;";
const FRAG_LAMBERT = "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + clarearLampadaCidade(vMundoLuz) * diffuseColor.rgb + totalEmissiveRadiance;";
const FRAG_PHONG = "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + clarearLampadaCidade(vMundoLuz) * diffuseColor.rgb + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;";
let avisouSoma = false;

function somarLuzNoFragmento(frag) {
  if (frag.includes(FRAG_SOMA_LOCAL) || frag.includes(FRAG_LAMBERT) || frag.includes(FRAG_PHONG)) return frag;
  const padrao = "vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;";
  if (frag.includes(padrao)) return frag.replace(padrao, FRAG_SOMA_LOCAL);
  const lambert = "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;";
  if (frag.includes(lambert)) return frag.replace(lambert, FRAG_LAMBERT);
  const phong = "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;";
  if (frag.includes(phong)) return frag.replace(phong, FRAG_PHONG);
  if (!avisouSoma) {
    avisouSoma = true;
    console.warn("luz cidade: shader sem soma de difuso");
  }
  return frag;
}

export function ligarUniformsLuzCidade(shader) {
  shader.uniforms.uMapaLuzCidade = uniformsLuzCidade.uMapaLuzCidade;
  shader.uniforms.uOrigemLuzCidade = uniformsLuzCidade.uOrigemLuzCidade;
  shader.uniforms.uTexelLuzCidade = uniformsLuzCidade.uTexelLuzCidade;
  shader.uniforms.uPesoLuzCidade = uniformsLuzCidade.uPesoLuzCidade;
}

/** Symbol não sobrevive ao clone() (só userData via JSON) — reaplicamos o hook. */
const MARCA_LUZ_CIDADE = Symbol("luzCidade");

export function aplicarLuzCidade(material) {
  if (!material || material[MARCA_LUZ_CIDADE]) return material;
  material[MARCA_LUZ_CIDADE] = true;
  if (!material.userData) material.userData = {};
  material.userData.luzCidade = true;
  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    ligarUniformsLuzCidade(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_VAR}`)
      .replace("#include <worldpos_vertex>", VERT_CORPO);
    let frag = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${VERT_VAR}\n${GLSL_LUZ_CIDADE}`,
    );
    shader.fragmentShader = somarLuzNoFragmento(frag);
  };
  material.customProgramCacheKey = function chaveLuzCidade() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|luz-cidade|clareia-branco`;
  };
  return material;
}

function perfilDe(id) {
  if (id === "poste") return PERFIL_POSTE;
  if (id === "santuario") return PERFIL_SANTUARIO;
  return PERFIL_CASA;
}

export function comecarMapaChao() {
  nFontes = 0;
}

export function oferecerLuzChao(id, x, y, z, cor, intensidade) {
  const perfil = perfilDe(id);
  _perfil.set(perfil.cor);
  _catalogo.set(cor || "#ffffff");
  _perfil.multiply(_catalogo);
  let fonte = fontes[nFontes];
  if (!fonte) {
    fonte = {};
    fontes.push(fonte);
  }
  fonte.x = x;
  fonte.y = y;
  fonte.z = z;
  fonte.r = _perfil.r;
  fonte.g = _perfil.g;
  fonte.b = _perfil.b;
  fonte.raio = perfil.raio;
  fonte.curva = perfil.curva;
  fonte.forca = perfil.ganho * (intensidade > 0 ? intensidade : 1);
  nFontes++;
}

function assinaturaDasFontes() {
  let h = nFontes;
  for (let i = 0; i < nFontes; i++) {
    const f = fontes[i];
    h = (Math.imul(h, 33) + Math.round(f.x * 10)) | 0;
    h = (Math.imul(h, 33) + Math.round(f.z * 10)) | 0;
    h = (Math.imul(h, 33) + Math.round(f.forca * 100)) | 0;
  }
  return h;
}

function estampar(ox, oz) {
  dados.fill(0);
  pesos.fill(0);
  for (let i = 0; i < nFontes; i++) {
    const f = fontes[i];
    const raio = f.raio;
    const i0 = Math.max(0, Math.floor((f.x - raio - ox) / TEXEL));
    const i1 = Math.min(LADO - 1, Math.floor((f.x + raio - ox) / TEXEL));
    const j0 = Math.max(0, Math.floor((f.z - raio - oz) / TEXEL));
    const j1 = Math.min(LADO - 1, Math.floor((f.z + raio - oz) / TEXEL));
    const raio2 = raio * raio;
    for (let j = j0; j <= j1; j++) {
      const wz = oz + (j + 0.5) * TEXEL;
      const dz = wz - f.z;
      for (let ix = i0; ix <= i1; ix++) {
        const wx = ox + (ix + 0.5) * TEXEL;
        const dx = wx - f.x;
        const d2 = dx * dx + dz * dz;
        if (d2 >= raio2) continue;
        const t = 1 - Math.sqrt(d2) / raio;
        let w = t;
        for (let c = 1; c < f.curva; c++) w *= t;
        const o = (j * LADO + ix) * 4;
        dados[o] += f.r * f.forca * w;
        dados[o + 1] += f.g * f.forca * w;
        dados[o + 2] += f.b * f.forca * w;
        dados[o + 3] += f.y * w;
        pesos[j * LADO + ix] += w;
      }
    }
  }
  for (let p = 0; p < pesos.length; p++) {
    const o = p * 4;
    const w = pesos[p];
    if (w > 1e-5) dados[o + 3] /= w;
    if (dados[o] > LIMITE) dados[o] = LIMITE;
    if (dados[o + 1] > LIMITE) dados[o + 1] = LIMITE;
    if (dados[o + 2] > LIMITE) dados[o + 2] = LIMITE;
    half[o] = THREE.DataUtils.toHalfFloat(dados[o]);
    half[o + 1] = THREE.DataUtils.toHalfFloat(dados[o + 1]);
    half[o + 2] = THREE.DataUtils.toHalfFloat(dados[o + 2]);
    half[o + 3] = THREE.DataUtils.toHalfFloat(dados[o + 3]);
  }
  textura.needsUpdate = true;
}

export function resolverMapaChao(camX, camZ) {
  uniformsLuzCidade.uPesoLuzCidade.value = obterPesoNoite();
  const ox = Math.floor(camX / PASSO) * PASSO - METROS * 0.5;
  const oz = Math.floor(camZ / PASSO) * PASSO - METROS * 0.5;
  const assinaturaNova = assinaturaDasFontes();
  if (ox === origemX && oz === origemZ && assinaturaNova === assinatura) return;
  origemX = ox;
  origemZ = oz;
  assinatura = assinaturaNova;
  uniformsLuzCidade.uOrigemLuzCidade.value.set(ox, oz);
  estampar(ox, oz);
}

function suave(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

const _amostra = new THREE.Color();

/** Luz da cidade no ponto, no mesmo espaço do chão. Sprites não recebem a cena. */
export function amostrarLuzCidade(x, y, z, destino = _amostra) {
  const peso = obterPesoNoite();
  if (peso <= 0.001 || !Number.isFinite(origemX)) {
    destino.setRGB(0, 0, 0);
    return destino;
  }
  const u = (x - origemX) / METROS;
  const v = (z - origemZ) / METROS;
  if (u <= 0 || v <= 0 || u >= 1 || v >= 1) {
    destino.setRGB(0, 0, 0);
    return destino;
  }
  const fx = u * LADO - 0.5;
  const fy = v * LADO - 0.5;
  const x0 = Math.max(0, Math.floor(fx));
  const y0 = Math.max(0, Math.floor(fy));
  const x1 = Math.min(LADO - 1, x0 + 1);
  const y1 = Math.min(LADO - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const i00 = (y0 * LADO + x0) * 4;
  const i10 = (y0 * LADO + x1) * 4;
  const i01 = (y1 * LADO + x0) * 4;
  const i11 = (y1 * LADO + x1) * 4;
  const lerpa = (canal) => {
    const a = dados[i00 + canal] + (dados[i10 + canal] - dados[i00 + canal]) * tx;
    const b = dados[i01 + canal] + (dados[i11 + canal] - dados[i01 + canal]) * tx;
    return a + (b - a) * ty;
  };
  const queda = 1 - suave(6, 18, Math.abs(y - lerpa(3)));
  const ganho = queda * peso;
  destino.setRGB(lerpa(0) * ganho, lerpa(1) * ganho, lerpa(2) * ganho);
  return destino;
}
