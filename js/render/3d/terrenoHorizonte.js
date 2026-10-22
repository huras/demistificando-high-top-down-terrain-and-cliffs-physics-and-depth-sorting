/**
 * LOD2: anel terraced longe (silhueta BOTW) + mar.
 * Terra: center sprites do bioma (igual suave). Mar: material lago longe.
 *
 * Tiles 128² estáveis + cache RAM + prebake offline (assets) + IDB fallback.
 * O anel só escolhe quais tiles entram; stencil (blocos/suave) tapa o miolo.
 */
import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  CHUNK_HORIZONTE,
  CHUNK_XZ,
  PASSO_HORIZONTE,
  RAIO_HORIZONTE,
  RAIO_HORIZONTE_MAX,
  RAIO_HORIZONTE_MIN,
} from "../../config.js";
import { urlPele } from "../../mundo/bioma/detalhe.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { obterRaioSuave } from "./terrenoSuave.js";
import { obterMaterialLagoHorizonte } from "./texturasAgua3d.js";
import { imagemPele } from "./peleSplat.js";
import { atrasDoLodMedio } from "./stencilLod.js";
import { criarEstradasLod } from "./estradasLod.js";
import {
  chaveSchemaHorizonte,
  gravarTileHorizonteIdb,
  hidratarGeometria,
  lerTileHorizonteIdb,
} from "./cacheHorizonteIdb.js";
import {
  amostrarTileHorizonte,
  geometriasDoTileHorizonte,
  idsKitsHorizonte,
} from "./amostraTileHorizonte.js";
import {
  iniciarPrebakeHorizonte,
  lerPrebakeHorizonteSync,
  pedirPrebakeHorizonte,
  prebakeHorizonteEmVoo,
  prebakeHorizonteMiss,
  prebakeHorizontePronto,
} from "./prebakeHorizonte.js";
import { idSaveAtual } from "../../jogo/estado.js";
import { registrarObjetoCena } from "../../cena/registroCena.js";

/** Depois do suave (2/3): terra e mar do horizonte. */
const ORDEM_TERRA = 2.5;
const ORDEM_ESTRADA = 2.6;
const ORDEM_MAR = 3.5;

const ORCAMENTO_MS = 0.7;
const BUILDS_POR_TICK = 2;
/** Tiles prontos em RAM (LRU). ~anel raio 80 ≈ 200–300 tiles. */
const CACHE_MAX = 512;
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

function garantirGrade() {
  return { ids: idsKitsHorizonte() };
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

function chaveChunk(hx, hy) {
  return `${hx},${hy}`;
}

export function criarTerrenoHorizonte() {
  iniciarPrebakeHorizonte();
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

  const estradas = criarEstradasLod({
    id: "estradas-horizonte",
    rotulo: "estradas LOD horizonte",
    renderOrder: ORDEM_ESTRADA,
    passoAmostra: Math.max(8, PASSO_HORIZONTE / 2),
    prepararMaterial: atrasDoLodMedio,
    obterAnel: () => {
      const stream = obterRaioStream() * CHUNK_XZ;
      const rSuave = obterRaioSuave();
      const suave =
        rSuave > 0 ? Math.max(0, rSuave * CHUNK_XZ - PASSO_HORIZONTE) : 0;
      return {
        interno: Math.max(stream, suave, PASSO_HORIZONTE),
        externo: alcanceHorizonteBlocos(),
      };
    },
  });
  grupo.add(estradas.mesh);

  /** Meshes na cena. Geometria vem do cache (não dispose ao sair do anel). */
  /** @type {Map<string, { terra: THREE.Mesh, agua: THREE.Mesh | null }>} */
  const vivos = new Map();
  /** Geometrias estáveis por tile — reuso ao revisitar. */
  /** @type {Map<string, { terra: THREE.BufferGeometry | null, agua: THREE.BufferGeometry | null }>} */
  const cache = new Map();
  /** Tile resolvido sem geometria (evita refila infinita). */
  const vazios = new Set();
  /** IDB em voo / miss confirmado (não bloquear o tick). */
  const aguardandoIdb = new Set();
  const missIdb = new Set();
  /** @type {string[]} */
  let fila = [];
  /** @type {Set<string>} */
  let desejados = new Set();

  const saveId = idSaveAtual();
  const schemaIdb = chaveSchemaHorizonte();

  let ancoraHx = 1e9;
  let ancoraHy = 1e9;
  let ancoraRaio = -1;
  let ancoraInterno = -1;

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

  /** Disco interno onde blocos/suave já cobrem — tiles inteiros ficam de fora. */
  function raioInternoBlocos() {
    const stream = obterRaioStream() * CHUNK_XZ;
    const rSuave = obterRaioSuave();
    const suave =
      rSuave > 0 ? Math.max(0, rSuave * CHUNK_XZ - PASSO_HORIZONTE) : 0;
    return Math.max(stream, suave, PASSO_HORIZONTE);
  }

  function liberarGeosCache(entry) {
    if (!entry) return;
    entry.terra?.dispose();
    entry.agua?.dispose();
  }

  function podarCache() {
    while (cache.size > CACHE_MAX) {
      let vitima = null;
      for (const k of cache.keys()) {
        if (!vivos.has(k) && !desejados.has(k)) {
          vitima = k;
          break;
        }
      }
      if (!vitima) {
        vitima = cache.keys().next().value;
      }
      if (vitima == null) break;
      if (vivos.has(vitima)) break;
      liberarGeosCache(cache.get(vitima));
      cache.delete(vitima);
    }
  }

  /** Remove mesh da cena; geometria permanece no cache. */
  function ocultar(chave) {
    const par = vivos.get(chave);
    if (!par) return;
    grupo.remove(par.terra);
    if (par.agua) grupo.remove(par.agua);
    vivos.delete(chave);
  }

  function limparCena() {
    for (const k of [...vivos.keys()]) ocultar(k);
    fila = [];
    desejados = new Set();
    vazios.clear();
    aguardandoIdb.clear();
    missIdb.clear();
    ancoraHx = 1e9;
    ancoraHy = 1e9;
    ancoraRaio = -1;
    ancoraInterno = -1;
  }

  function limparCache() {
    for (const entry of cache.values()) liberarGeosCache(entry);
    cache.clear();
    vazios.clear();
    aguardandoIdb.clear();
    missIdb.clear();
  }

  /** Tile completo 128² — independente do player (cacheável). */
  function montarTile(hx, hy) {
    return geometriasDoTileHorizonte(amostrarTileHorizonte(hx, hy));
  }

  function tocarCache(chave, entry) {
    cache.delete(chave);
    cache.set(chave, entry);
    podarCache();
  }

  function gravarIdbFundo(hx, hy, entry) {
    void gravarTileHorizonteIdb(saveId, schemaIdb, hx, hy, entry);
  }

  function pedirIdb(chave, hx, hy) {
    if (aguardandoIdb.has(chave) || missIdb.has(chave) || cache.has(chave)) return;
    aguardandoIdb.add(chave);
    lerTileHorizonteIdb(saveId, schemaIdb, hx, hy)
      .then((blob) => {
        aguardandoIdb.delete(chave);
        if (!blob) {
          missIdb.add(chave);
          return;
        }
        const entry = {
          terra: hidratarGeometria(blob.terra),
          agua: hidratarGeometria(blob.agua),
        };
        tocarCache(chave, entry);
        if (desejados.has(chave) && !vivos.has(chave) && !vazios.has(chave)) {
          instalar(chave, entry);
        }
      })
      .catch(() => {
        aguardandoIdb.delete(chave);
        missIdb.add(chave);
      });
  }

  /** Gera tile na CPU, RAM + IDB. */
  function construirECachear(chave, hx, hy) {
    const entry = montarTile(hx, hy);
    tocarCache(chave, entry);
    missIdb.add(chave);
    gravarIdbFundo(hx, hy, entry);
    return entry;
  }

  function instalar(chave, geos) {
    if (!geos?.terra && !geos?.agua) {
      ocultar(chave);
      vazios.add(chave);
      return;
    }
    vazios.delete(chave);

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
    par.terra.geometry = geos.terra || par.terra.geometry;
    par.terra.visible = !!geos.terra;
    if (!grupo.children.includes(par.terra)) grupo.add(par.terra);

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
        par.agua.geometry = geos.agua;
        par.agua.visible = true;
        if (!grupo.children.includes(par.agua)) grupo.add(par.agua);
      }
    } else if (par.agua) {
      grupo.remove(par.agua);
      par.agua = null;
    }
  }

  /** Só decide quais tiles do anel; nunca reconstrói geometria. */
  function planejar(px, py) {
    const lado = CHUNK_HORIZONTE;
    const hx0 = Math.floor(px / lado);
    const hy0 = Math.floor(py / lado);
    const externo = alcanceHorizonteBlocos();
    const margem = Math.ceil(externo / lado) + 1;
    const interno = raioInternoBlocos();
    const half = lado * 0.71;
    const novoDesejado = new Set();
    const novaFila = [];

    for (let hy = hy0 - margem; hy <= hy0 + margem; hy++) {
      for (let hx = hx0 - margem; hx <= hx0 + margem; hx++) {
        const cx = (hx + 0.5) * lado;
        const cy = (hy + 0.5) * lado;
        const d = Math.hypot(cx - px, cy - py);
        if (d + half < interno) continue;
        if (d - half > externo) continue;
        const k = chaveChunk(hx, hy);
        novoDesejado.add(k);
        if (!vivos.has(k) && !vazios.has(k)) novaFila.push(k);
      }
    }

    for (const k of vivos.keys()) {
      if (!novoDesejado.has(k)) ocultar(k);
    }
    for (const k of [...vazios]) {
      if (!novoDesejado.has(k)) vazios.delete(k);
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
      if (vivos.size || fila.length) limparCena();
      estradas.tick(px, py);
      return;
    }

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

    // Prefetch prebake / IDB dos próximos da fila (não bloqueia).
    for (let i = 0; i < Math.min(8, fila.length); i++) {
      const k = fila[i];
      if (!k || vivos.has(k) || cache.has(k)) continue;
      const [chx, chy] = k.split(",").map(Number);
      if (prebakeHorizontePronto() && !prebakeHorizonteMiss(chx, chy) && !prebakeHorizonteEmVoo(chx, chy)) {
        if (lerPrebakeHorizonteSync(chx, chy) === undefined) {
          void pedirPrebakeHorizonte(chx, chy).then((entry) => {
            if (!entry) return;
            tocarCache(k, entry);
            if (desejados.has(k) && !vivos.has(k) && !vazios.has(k)) instalar(k, entry);
          });
        }
      } else {
        pedirIdb(k, chx, chy);
      }
    }

    const t0 = performance.now();
    let builds = 0;
    let adiados = 0;
    const maxAdiados = fila.length;
    while (fila.length && performance.now() - t0 < ORCAMENTO_MS && adiados < maxAdiados) {
      const k = fila.shift();
      if (!desejados.has(k) || vivos.has(k) || vazios.has(k)) continue;

      if (cache.has(k)) {
        const entry = cache.get(k);
        tocarCache(k, entry);
        instalar(k, entry);
        continue;
      }

      const [chx, chy] = k.split(",").map(Number);

      // 1) Prebake offline (assets) — mesmo papel do minimapa assado.
      if (prebakeHorizontePronto() && !prebakeHorizonteMiss(chx, chy)) {
        const sync = lerPrebakeHorizonteSync(chx, chy);
        if (sync) {
          tocarCache(k, sync);
          instalar(k, sync);
          continue;
        }
        if (sync === undefined || prebakeHorizonteEmVoo(chx, chy)) {
          if (sync === undefined && !prebakeHorizonteEmVoo(chx, chy)) {
            void pedirPrebakeHorizonte(chx, chy).then((entry) => {
              if (!entry) return;
              tocarCache(k, entry);
              if (desejados.has(k) && !vivos.has(k) && !vazios.has(k)) instalar(k, entry);
            });
          }
          fila.push(k);
          adiados += 1;
          continue;
        }
      }

      // 2) IndexedDB (sessão / save).
      if (aguardandoIdb.has(k)) {
        fila.push(k);
        adiados += 1;
        continue;
      }

      if (!missIdb.has(k)) {
        pedirIdb(k, chx, chy);
        fila.push(k);
        adiados += 1;
        continue;
      }

      // 3) Gera na CPU (e grava IDB).
      if (builds >= BUILDS_POR_TICK) {
        fila.unshift(k);
        break;
      }
      instalar(k, construirECachear(k, chx, chy));
      builds += 1;
    }
    estradas.tick(px, py);
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
    estradas.aplicarTexturas(tex);
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
      limparCena();
      limparCache();
      estradas.liberar();
      matSolido.dispose();
      matReal?.dispose();
      pilha?.dispose();
      pilhaPeles?.dispose();
      branco.dispose();
      // matAgua é compartilhado (lago longe).
    },
  };
}
