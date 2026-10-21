/**
 * LOD2: anel terraced longe (silhueta BOTW) + mar.
 * Terra: center sprites do bioma (igual suave). Mar: material lago longe.
 *
 * Handoff: desenha depois do suave, só onde o stencil ainda está limpo
 * (blocos + suave marcam ref=1). Anel interno entra um passo no disco suave
 * para a junta ser por stencil, sem fresta nem z-fight.
 */
import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  CHUNK_HORIZONTE,
  CHUNK_XZ,
  PASSO_HORIZONTE,
  QUANT_ALTURA_HORIZONTE,
  RAIO_HORIZONTE,
  RAIO_HORIZONTE_MAX,
  RAIO_HORIZONTE_MIN,
  UV_ESCALA_HORIZONTE,
  UV_ESCALA_MAR_HORIZONTE,
} from "../../config.js";
import { alturaDoRelevo, amostrarRegiao, nivelMarBlocos } from "../../mundo/bioma/catalogo.js";
import { cruSplat, urlPele } from "../../mundo/bioma/detalhe.js";
import { obterKits } from "../../mundo/bioma/kits.js";
import { rgbBioma } from "../../mundo/bioma/tinta.js";
import { amostraKanto, dentroDoKanto } from "../../mundo/regiao/amostraKanto.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { obterRaioSuave } from "./terrenoSuave.js";
import { criarGeometriaMarPlano, criarGeometriaTerraced } from "./geometriaTerraced.js";
import { obterMaterialLagoHorizonte } from "./texturasAgua3d.js";
import { imagemPele } from "./peleSplat.js";
import { atrasDoLodMedio } from "./stencilLod.js";
import { registrarObjetoCena } from "../../cena/registroCena.js";

/** Depois do suave (2/3): terra e mar do horizonte. */
const ORDEM_TERRA = 2.5;
const ORDEM_MAR = 3.5;

const ORCAMENTO_MS = 0.7;
const BUILDS_POR_TICK = 2;
const TILE_BIOMA = 16;

let raioAtivo = RAIO_HORIZONTE;
let revisaoHorizonte = 0;

export function obterRaioHorizonte() {
  return raioAtivo;
}

export function discoHorizonteAtivo() {
  return raioAtivo > 0;
}

export function revisaoDiscoHorizonte() {
  return revisaoHorizonte;
}

export function definirRaioHorizonte(raio) {
  const anterior = raioAtivo;
  raioAtivo = Math.max(RAIO_HORIZONTE_MIN, Math.min(RAIO_HORIZONTE_MAX, raio | 0));
  if ((anterior > 0) !== (raioAtivo > 0) || anterior !== raioAtivo) revisaoHorizonte += 1;
  return raioAtivo;
}

export function alcanceHorizonteBlocos() {
  return raioAtivo * CHUNK_XZ;
}

function materialSolido() {
  return atrasDoLodMedio(
    aplicarSombraNuvem(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.02,
        vertexColors: true,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 3,
        polygonOffsetUnits: 3,
      }),
    ),
  );
}

let gradeBioma = { chave: "", ids: [] };

function garantirGrade() {
  const ids = Object.keys(obterKits()?.kits || {}).sort();
  const chave = ids.join("|");
  if (gradeBioma.chave === chave) return gradeBioma;
  gradeBioma = { chave, ids };
  return gradeBioma;
}

function celulaDe(kit) {
  const { ids } = garantirGrade();
  const i = ids.indexOf(kit);
  return i < 0 ? 0 : i;
}

function parNoPonto(wx, wy) {
  if (dentroDoKanto(wx, wy)) {
    const amostra = amostraKanto(wx, wy);
    let a = amostra?.bioma?.kit || "_";
    let b = amostra?.biomaB?.kit || a;
    let peso = amostra ? amostra.dominio : 1;
    if (a === b) return { a, b, peso: 1 };
    if (a > b) {
      const t = a;
      a = b;
      b = t;
      peso = 1 - peso;
    }
    return { a, b, peso };
  }
  const reg = amostrarRegiao(wx, wy);
  let a = reg?.a?.kit || "_";
  let b = reg?.b?.kit || a;
  let peso = reg ? reg.dominio : 1;
  if (a === b) return { a, b, peso: 1 };
  if (a > b) {
    const t = a;
    a = b;
    b = t;
    peso = 1 - peso;
  }
  return { a, b, peso };
}

function texturaBranca() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function pintarCamada(data, layer, img, ctx, canvas, transparente) {
  const off = layer * TILE_BIOMA * TILE_BIOMA * 4;
  ctx.clearRect(0, 0, TILE_BIOMA, TILE_BIOMA);
  if (img && img.width && img.height) ctx.drawImage(img, 0, 0, TILE_BIOMA, TILE_BIOMA);
  else if (!transparente) {
    ctx.fillStyle = "#6d9a48";
    ctx.fillRect(0, 0, TILE_BIOMA, TILE_BIOMA);
  }
  const src = ctx.getImageData(0, 0, TILE_BIOMA, TILE_BIOMA).data;
  for (let y = 0; y < TILE_BIOMA; y++) {
    const srcRow = (TILE_BIOMA - 1 - y) * TILE_BIOMA * 4;
    data.set(src.subarray(srcRow, srcRow + TILE_BIOMA * 4), off + y * TILE_BIOMA * 4);
  }
}

function criarPilha(fonte) {
  const { ids } = garantirGrade();
  const n = Math.max(1, ids.length);
  const data = new Uint8Array(TILE_BIOMA * TILE_BIOMA * 4 * n);
  const canvas = document.createElement("canvas");
  canvas.width = TILE_BIOMA;
  canvas.height = TILE_BIOMA;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  for (let layer = 0; layer < n; layer++) {
    const tex = ids.length ? fonte?.doKit?.(ids[layer]) || fonte?.grama : fonte?.grama;
    pintarCamada(data, layer, tex?.image || null, ctx, canvas, false);
  }
  const pilha = new THREE.DataArrayTexture(data, TILE_BIOMA, TILE_BIOMA, n);
  pilha.colorSpace = THREE.SRGBColorSpace;
  pilha.magFilter = THREE.NearestFilter;
  pilha.minFilter = THREE.NearestFilter;
  pilha.wrapS = THREE.RepeatWrapping;
  pilha.wrapT = THREE.RepeatWrapping;
  pilha.generateMipmaps = false;
  pilha.needsUpdate = true;
  return pilha;
}

function criarPilhaPeles() {
  const { ids } = garantirGrade();
  const n = Math.max(1, ids.length);
  const data = new Uint8Array(TILE_BIOMA * TILE_BIOMA * 4 * n);
  const canvas = document.createElement("canvas");
  canvas.width = TILE_BIOMA;
  canvas.height = TILE_BIOMA;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  for (let layer = 0; layer < n; layer++) {
    const img = imagemPele(urlPele(ids[layer] || ""));
    pintarCamada(data, layer, img?.complete && img.naturalWidth ? img : null, ctx, canvas, true);
  }
  const pilha = new THREE.DataArrayTexture(data, TILE_BIOMA, TILE_BIOMA, n);
  pilha.colorSpace = THREE.SRGBColorSpace;
  pilha.magFilter = THREE.NearestFilter;
  pilha.minFilter = THREE.NearestFilter;
  pilha.wrapS = THREE.RepeatWrapping;
  pilha.wrapT = THREE.RepeatWrapping;
  pilha.generateMipmaps = false;
  pilha.needsUpdate = true;
  return pilha;
}

/** Center sprite do bioma (miolo do autotile) — mesmo shader do suave. */
function materialMistura(branco, uMapas, uPeles) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: branco,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: 3,
    polygonOffsetUnits: 3,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMapas = uMapas;
    shader.uniforms.uPeles = uPeles;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aBioma;
attribute float splat;
flat varying vec2 vCelulas;
varying float vPeso;
varying float vSplat;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vCelulas = aBioma.xy;
vPeso = aBioma.z;
vSplat = splat;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2DArray uMapas;
uniform sampler2DArray uPeles;
flat varying vec2 vCelulas;
varying float vPeso;
varying float vSplat;`,
      )
      .replace(
        "#include <map_fragment>",
        `vec4 sampledDiffuseColor = mix(
  texture(uMapas, vec3(vMapUv, vCelulas.y)),
  texture(uMapas, vec3(vMapUv, vCelulas.x)),
  clamp(vPeso, 0.0, 1.0)
);
diffuseColor *= sampledDiffuseColor;
{
  vec2 bloco = fract(vMapUv);
  vec2 uvMiolo = mix(vec2(0.34375, 0.7578125), vec2(0.65625, 0.9921875), bloco);
  float peso = clamp(vPeso, 0.0, 1.0);
  vec4 corPele = mix(
    texture(uPeles, vec3(uvMiolo, vCelulas.y)),
    texture(uPeles, vec3(uvMiolo, vCelulas.x)),
    peso
  );
  diffuseColor.rgb = mix(diffuseColor.rgb, corPele.rgb, vSplat * corPele.a);
}`,
      );
  };
  mat.customProgramCacheKey = () => "horizonte-bioma-center";
  return atrasDoLodMedio(aplicarSombraNuvem(mat));
}

function quantizar(h) {
  const q = QUANT_ALTURA_HORIZONTE;
  if (q <= 0) return h;
  return Math.round(h / q) * q;
}

function amostraAltura(wx, wy) {
  if (dentroDoKanto(wx, wy)) {
    const a = amostraKanto(wx, wy);
    if (a && Number.isFinite(a.h)) return quantizar(a.h);
  }
  return quantizar(alturaDoRelevo(wx, wy));
}

function chaveChunk(hx, hy) {
  return `${hx},${hy}`;
}

export function criarTerrenoHorizonte() {
  const grupo = new THREE.Group();
  grupo.name = "terreno-horizonte";

  const matSolido = materialSolido();
  const branco = texturaBranca();
  const uMapas = { value: null };
  const uPeles = { value: null };
  /** @type {THREE.Material | null} */
  let matReal = null;
  /** @type {THREE.DataArrayTexture | null} */
  let pilha = null;
  let pilhaPeles = criarPilhaPeles();
  uPeles.value = pilhaPeles;
  let modoReal = false;
  let texturasProntas = false;

  // Mesma folha do lago, instância própria (clone quebrava o shader → mar preto).
  const matAgua = atrasDoLodMedio(obterMaterialLagoHorizonte());
  matAgua.depthWrite = false;

  /** @type {Map<string, { terra: THREE.Mesh, agua: THREE.Mesh | null }>} */
  const vivos = new Map();
  /** @type {string[]} */
  let fila = [];
  /** @type {Set<string>} */
  let desejados = new Set();

  let ancoraHx = 1e9;
  let ancoraHy = 1e9;
  let ancoraRaio = -1;
  let ancoraInterno = -1;
  let pxRef = 0;
  let pyRef = 0;

  registrarObjetoCena(grupo, {
    id: "terreno-horizonte",
    pasta: "Terreno",
    rotulo: "horizonte terraced",
    tipo: "relevo",
  });

  function materialTerraAtual() {
    return modoReal && matReal ? matReal : matSolido;
  }

  function materialRealPronto() {
    if (!matReal) matReal = materialMistura(branco, uMapas, uPeles);
    return matReal;
  }

  /**
   * Furo do anel: cobre stream e suave. Com suave ligado, entra um PASSO
   * no disco médio — overlap geométrico; o corte fino é o stencil do suave.
   */
  function raioInternoBlocos() {
    const stream = obterRaioStream() * CHUNK_XZ;
    const rSuave = obterRaioSuave();
    const suave =
      rSuave > 0 ? Math.max(0, rSuave * CHUNK_XZ - PASSO_HORIZONTE) : 0;
    return Math.max(stream, suave, PASSO_HORIZONTE);
  }

  function liberarPar(par) {
    if (!par) return;
    par.terra.geometry?.dispose();
    grupo.remove(par.terra);
    if (par.agua) {
      par.agua.geometry?.dispose();
      grupo.remove(par.agua);
    }
  }

  function limparTudo() {
    for (const par of vivos.values()) liberarPar(par);
    vivos.clear();
    fila = [];
    desejados = new Set();
    ancoraHx = 1e9;
    ancoraHy = 1e9;
    ancoraRaio = -1;
  }

  function descartar(chave) {
    const par = vivos.get(chave);
    if (!par) return;
    liberarPar(par);
    vivos.delete(chave);
  }

  function montarChunk(hx, hy) {
    const passo = PASSO_HORIZONTE;
    const lado = CHUNK_HORIZONTE;
    const ox = hx * lado;
    const oy = hy * lado;
    const nx = Math.max(1, Math.round(lado / passo));
    const ny = nx;
    const interno = raioInternoBlocos();
    const interno2 = interno * interno;
    const externo = alcanceHorizonteBlocos();
    const externo2 = externo * externo;
    const nivel = nivelMarBlocos();

    const alturas = new Float32Array((nx + 1) * (ny + 1));
    const cores = new Float32Array(nx * ny * 3);
    const bioma = new Float32Array(nx * ny * 3);
    const splat = new Float32Array(nx * ny);
    const viva = new Uint8Array(nx * ny);
    const mar = new Uint8Array(nx * ny);
    let celulas = 0;
    let celulasMar = 0;

    for (let cy = 0; cy <= ny; cy++) {
      for (let cx = 0; cx <= nx; cx++) {
        alturas[cy * (nx + 1) + cx] = amostraAltura(ox + cx * passo, oy + cy * passo);
      }
    }

    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        const wx = ox + cx * passo + passo * 0.5;
        const wy = oy + cy * passo + passo * 0.5;
        const d2 = (wx - pxRef) * (wx - pxRef) + (wy - pyRef) * (wy - pyRef);
        const iCor = (cy * nx + cx) * 3;
        if (d2 < interno2 || d2 > externo2) continue;
        const h = alturas[cy * (nx + 1) + cx];
        if (!Number.isFinite(h)) continue;
        viva[cy * nx + cx] = 1;
        const rgb = rgbBioma(wx, wy, false);
        cores[iCor] = rgb[0];
        cores[iCor + 1] = rgb[1];
        cores[iCor + 2] = rgb[2];
        const par = parNoPonto(wx, wy);
        bioma[iCor] = celulaDe(par.a);
        bioma[iCor + 1] = celulaDe(par.b);
        bioma[iCor + 2] = par.peso;
        splat[cy * nx + cx] = cruSplat(wx, wy, par.a) ? 1 : 0;
        celulas += 1;
        if (h < nivel) {
          mar[cy * nx + cx] = 1;
          celulasMar += 1;
        }
      }
    }

    if (!celulas) return null;

    const alturasGeo = alturas.slice();
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        if (!viva[cy * nx + cx]) alturasGeo[cy * (nx + 1) + cx] = NaN;
      }
    }

    const uvEscala = UV_ESCALA_HORIZONTE;
    const terra = criarGeometriaTerraced(alturasGeo, cores, {
      ox,
      oy,
      passo,
      nx,
      ny,
      uvEscala,
      bioma,
      splat,
    });
    const agua =
      celulasMar > 0
        ? criarGeometriaMarPlano(mar, {
            ox,
            oy,
            passo,
            nx,
            ny,
            nivel,
            uvEscala: UV_ESCALA_MAR_HORIZONTE,
          })
        : null;
    if (!terra && !agua) return null;
    return { terra, agua };
  }

  function instalar(chave, geos) {
    if (!geos?.terra && !geos?.agua) {
      descartar(chave);
      return;
    }

    const matT = materialTerraAtual();
    let par = vivos.get(chave);
    if (!par) {
      const terra = new THREE.Mesh(geos.terra || new THREE.BufferGeometry(), matT);
      terra.name = `horizonte-terra-${chave}`;
      terra.castShadow = false;
      terra.receiveShadow = false;
      terra.frustumCulled = true;
      terra.renderOrder = ORDEM_TERRA;
      terra.visible = !!geos.terra;
      grupo.add(terra);

      let agua = null;
      if (geos.agua) {
        agua = new THREE.Mesh(geos.agua, matAgua);
        agua.name = `horizonte-mar-${chave}`;
        agua.castShadow = false;
        agua.receiveShadow = false;
        agua.frustumCulled = true;
        agua.renderOrder = ORDEM_MAR;
        grupo.add(agua);
      }
      vivos.set(chave, { terra, agua });
      return;
    }

    par.terra.material = matT;
    const antigaTerra = par.terra.geometry;
    if (geos.terra) {
      par.terra.geometry = geos.terra;
      par.terra.visible = true;
    } else {
      par.terra.geometry = new THREE.BufferGeometry();
      par.terra.visible = false;
    }
    if (antigaTerra && antigaTerra !== par.terra.geometry) antigaTerra.dispose();

    if (geos.agua) {
      if (!par.agua) {
        par.agua = new THREE.Mesh(geos.agua, matAgua);
        par.agua.name = `horizonte-mar-${chave}`;
        par.agua.castShadow = false;
        par.agua.receiveShadow = false;
        par.agua.frustumCulled = true;
        par.agua.renderOrder = ORDEM_MAR;
        grupo.add(par.agua);
      } else {
        const antiga = par.agua.geometry;
        par.agua.geometry = geos.agua;
        if (antiga && antiga !== geos.agua) antiga.dispose();
        par.agua.visible = true;
      }
    } else if (par.agua) {
      par.agua.geometry?.dispose();
      grupo.remove(par.agua);
      par.agua = null;
    }
  }

  function planejar(px, py) {
    const lado = CHUNK_HORIZONTE;
    const hx0 = Math.floor(px / lado);
    const hy0 = Math.floor(py / lado);
    const externo = alcanceHorizonteBlocos();
    const margem = Math.ceil(externo / lado) + 1;
    const interno = raioInternoBlocos();
    const novoDesejado = new Set();
    const novaFila = [];

    for (let hy = hy0 - margem; hy <= hy0 + margem; hy++) {
      for (let hx = hx0 - margem; hx <= hx0 + margem; hx++) {
        const cx = (hx + 0.5) * lado;
        const cy = (hy + 0.5) * lado;
        const d = Math.hypot(cx - px, cy - py);
        if (d + lado * 0.71 < interno) continue;
        if (d - lado * 0.71 > externo) continue;
        const k = chaveChunk(hx, hy);
        novoDesejado.add(k);
        if (!vivos.has(k)) novaFila.push(k);
      }
    }

    for (const k of vivos.keys()) {
      if (!novoDesejado.has(k)) descartar(k);
    }

    if (ancoraRaio >= 0) {
      for (const k of novoDesejado) {
        if (vivos.has(k) && !novaFila.includes(k)) novaFila.push(k);
      }
    }

    desejados = novoDesejado;
    novaFila.sort((a, b) => {
      const [ax, ay] = a.split(",").map(Number);
      const [bx, by] = b.split(",").map(Number);
      const da = (ax + 0.5) * lado - px;
      const db = (ay + 0.5) * lado - py;
      const ea = (bx + 0.5) * lado - px;
      const eb = (by + 0.5) * lado - py;
      return da * da + db * db - (ea * ea + eb * eb);
    });
    fila = novaFila;
  }

  function tick(px, py) {
    if (!discoHorizonteAtivo()) {
      if (vivos.size || fila.length) limparTudo();
      return;
    }

    pxRef = px;
    pyRef = py;
    const lado = CHUNK_HORIZONTE;
    const hx = Math.floor(px / lado);
    const hy = Math.floor(py / lado);
    const raio = obterRaioHorizonte();
    const interno = raioInternoBlocos();

    if (hx !== ancoraHx || hy !== ancoraHy || raio !== ancoraRaio || interno !== ancoraInterno) {
      ancoraHx = hx;
      ancoraHy = hy;
      ancoraRaio = raio;
      ancoraInterno = interno;
      planejar(px, py);
    }

    const t0 = performance.now();
    let feitos = 0;
    while (fila.length && feitos < BUILDS_POR_TICK && performance.now() - t0 < ORCAMENTO_MS) {
      const k = fila.shift();
      if (!desejados.has(k)) continue;
      const [chx, chy] = k.split(",").map(Number);
      instalar(k, montarChunk(chx, chy));
      feitos += 1;
    }
  }

  function renovarPeles() {
    const anterior = pilhaPeles;
    pilhaPeles = criarPilhaPeles();
    uPeles.value = pilhaPeles;
    anterior?.dispose();
    const { ids } = garantirGrade();
    for (let i = 0; i < ids.length; i++) {
      const img = imagemPele(urlPele(ids[i] || ""));
      if (img?.complete && img.naturalWidth) img.dataset.naPilhaHz = "1";
    }
  }

  function aplicarTexturas(tex) {
    texturasProntas = !!(tex?.doKit || tex?.grama);
    const anterior = pilha;
    pilha = texturasProntas ? criarPilha(tex) : null;
    uMapas.value = pilha;
    anterior?.dispose();
    renovarPeles();
    if (modoReal) aplicarVisual(true);
  }

  function aplicarVisual(usarTilesFlag) {
    const real = !!(usarTilesFlag && texturasProntas && pilha);
    if (real === modoReal && (!real || matReal)) {
      if (real) {
        const mat = materialRealPronto();
        for (const par of vivos.values()) par.terra.material = mat;
      }
      return;
    }
    modoReal = real;
    const mat = materialTerraAtual();
    if (real) materialRealPronto();
    for (const par of vivos.values()) par.terra.material = mat;
  }

  return {
    mesh: grupo,
    tick,
    aplicarTexturas,
    aplicarVisual,
    liberar() {
      limparTudo();
      matSolido.dispose();
      matReal?.dispose();
      pilha?.dispose();
      pilhaPeles?.dispose();
      branco.dispose();
      // matAgua é compartilhado (lago longe).
    },
  };
}
