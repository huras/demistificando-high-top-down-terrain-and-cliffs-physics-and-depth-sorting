import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  CHUNK_XZ,
  PASSO_MALHA_SUAVE,
  RAIO_SUAVE,
  RAIO_SUAVE_MAX,
  RAIO_SUAVE_MIN,
} from "../../config.js";
import { alturaDoRelevo, amostrarRegiao, nivelMarBlocos } from "../../mundo/bioma/catalogo.js";
import { amostraKanto, dentroDoKanto } from "../../mundo/regiao/amostraKanto.js";
import { cruSplat, urlPele } from "../../mundo/bioma/detalhe.js";
import { obterKits } from "../../mundo/bioma/kits.js";
import { imagemPele } from "./peleSplat.js";
import { rgbBioma } from "../../mundo/bioma/tinta.js";
import { obterMaterialLagoLonge } from "./texturasAgua3d.js";
import { registrarObjetoCena } from "../../cena/registroCena.js";

let raioAtivo = RAIO_SUAVE;

export function obterRaioSuave() {
  return raioAtivo;
}

export function definirRaioSuave(raio) {
  raioAtivo = Math.max(RAIO_SUAVE_MIN, Math.min(RAIO_SUAVE_MAX, raio | 0));
  return raioAtivo;
}

/** Desenha só onde o bloco não marcou o stencil. O mesh vem depois dos chunks. */
function atrasDoBloco(material) {
  material.depthTest = true;
  material.depthWrite = true;
  material.stencilWrite = true;
  material.stencilRef = 1;
  material.stencilFunc = THREE.NotEqualStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
  return material;
}

function materialSolido() {
  return atrasDoBloco(aplicarSombraNuvem(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.04,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  })));
}

const TILE_BIOMA = 16;

/** Camadas na mesma ordem de celulaDe. A textura de cada kit entra numa fatia. */
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

/**
 * Par canônico do ponto. Os dois lados da borda guardam as mesmas camadas;
 * o peso é o do kit que vem primeiro no nome, para interpolar sem cruzar índice.
 */
function parNoPonto(wx, wy) {
  if (dentroDoKanto(wx, wy)) {
    const amostra = amostraKanto(wx, wy);
    let a = amostra?.bioma?.kit || "_";
    let b = amostra?.biomaB?.kit || a;
    let peso = amostra ? amostra.dominio : 1;
    if (a === b) return { a, b, peso: 1 };
    if (a > b) {
      const troca = a;
      a = b;
      b = troca;
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
    const troca = a;
    a = b;
    b = troca;
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

/** Pilha de tiles 16×16. Repeat no plano, igual ao topo do bloco. */
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
    const tex = ids.length ? (fonte?.doKit?.(ids[layer]) || fonte?.grama) : fonte?.grama;
    pintarCamada(data, layer, tex?.image || null, ctx, canvas);
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
  return canvas;
}

/**
 * Mistura as duas texturas do par com o peso da borda do bioma.
 * O mapa branco só liga o UV do Three; a amostra sai da pilha.
 */
function materialMistura(branco, uMapas, uPeles) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: branco,
    roughness: 0.88,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
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
  mat.customProgramCacheKey = () => "bioma-mistura-pele";
  return atrasDoBloco(aplicarSombraNuvem(mat));
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

/**
 * Relevo espaçado até o raio suave.
 * Some só no miolo dos chunks já desenhados. O anel de fora deles fica por baixo,
 * para o encontro com os blocos não precisar fechar.
 */
export function criarTerrenoSuave() {
  const matCubos = materialSolido();
  const branco = texturaBranca();
  const uMapas = { value: null };
  /** @type {THREE.Material | null} */
  let matReal = null;
  /** @type {THREE.DataArrayTexture | null} */
  let pilha = null;
  let pilhaPeles = criarPilhaPeles();
  const uPeles = { value: pilhaPeles };
  const grupo = new THREE.Group();
  grupo.name = "terreno-suave";
  const meshChao = criarMesh("terreno-suave-chao", matCubos);
  const matAgua = atrasDoBloco(obterMaterialLagoLonge());
  const meshAgua = criarMesh("terreno-suave-agua", matAgua);
  meshAgua.renderOrder = 3;
  grupo.add(meshChao, meshAgua);
  registrarObjetoCena(meshChao, {
    id: meshChao.name,
    pasta: "Terreno",
    rotulo: meshChao.name,
    tipo: "relevo",
  });
  registrarObjetoCena(meshAgua, {
    id: meshAgua.name,
    pasta: "Terreno",
    rotulo: meshAgua.name,
    tipo: "agua",
  });

  let ancoraX = 1e9;
  let ancoraY = 1e9;
  let ancoraCx = 1e9;
  let ancoraCy = 1e9;
  let raioSuave = -1;
  /** @type {Generator<void, object | null> | null} */
  let trabalho = null;
  /** @type {{ chao: object, agua: object } | null} */
  let dados = null;
  let assinatura = null;
  /** Chunks que já estavam na cena no frame anterior. */
  let vistosAntes = new Set();
  let modoReal = false;
  let texturasProntas = false;

  function materialRealPronto() {
    if (!matReal) matReal = materialMistura(branco, uMapas, uPeles);
    return matReal;
  }

  function renovarPeles() {
    const anterior = pilhaPeles;
    pilhaPeles = criarPilhaPeles();
    uPeles.value = pilhaPeles;
    anterior?.dispose();
    const { ids } = garantirGrade();
    for (let i = 0; i < ids.length; i++) {
      const img = imagemPele(urlPele(ids[i] || ""));
      if (img?.complete && img.naturalWidth) img.dataset.naPilha = "1";
    }
  }

  function trocar(mesh, geo) {
    const antiga = mesh.geometry;
    if (geo) {
      mesh.geometry = geo;
      mesh.visible = true;
    } else {
      mesh.geometry = new THREE.BufferGeometry();
      mesh.visible = false;
    }
    if (antiga && antiga !== mesh.geometry) antiga.dispose();
  }

  function instalar(novos) {
    dados = novos?.chao?.quads?.length || novos?.agua?.quads?.length ? novos : null;
    assinatura = null;
    trocar(meshChao, dados?.chao?.quads?.length ? criarGeometria(dados.chao) : null);
    meshChao.material = modoReal ? materialRealPronto() : matCubos;
    trocar(meshAgua, dados?.agua?.quads?.length ? criarGeometria(dados.agua) : null);
  }

  function aplicarExibidos(estaveis) {
    if (!dados) return;
    const sig = chaveExibidos(estaveis);
    if (sig === assinatura) return;
    assinatura = sig;
    recortar(meshChao, dados.chao, estaveis);
    recortar(meshAgua, dados.agua, estaveis);
  }

  function tick(px, py, exibidos) {
    const ax = Math.round(px / PASSO_MALHA_SUAVE) * PASSO_MALHA_SUAVE;
    const ay = Math.round(py / PASSO_MALHA_SUAVE) * PASSO_MALHA_SUAVE;
    const cx = Math.floor(px / CHUNK_XZ);
    const cy = Math.floor(py / CHUNK_XZ);
    const suave = obterRaioSuave();
    if (ax !== ancoraX || ay !== ancoraY || cx !== ancoraCx || cy !== ancoraCy || suave !== raioSuave) {
      ancoraX = ax;
      ancoraY = ay;
      ancoraCx = cx;
      ancoraCy = cy;
      raioSuave = suave;
      trabalho = suave > 0 ? gerarMalha(px, py, suave) : null;
      if (suave <= 0) instalar(null);
    }
    if (trabalho) {
      const t0 = performance.now();
      let passo;
      while (performance.now() - t0 < 0.6) {
        passo = trabalho.next();
        if (passo.done) break;
      }
      if (passo?.done) {
        instalar(passo.value ?? null);
        trabalho = null;
      }
    }

    const estaveis = new Set();
    if (exibidos) {
      for (const k of exibidos) {
        if (vistosAntes.has(k)) estaveis.add(k);
      }
      vistosAntes = exibidos;
    }
    aplicarExibidos(estaveis);
    if (pelesPendentes()) renovarPeles();
  }

  function pelesPendentes() {
    const { ids } = garantirGrade();
    for (let i = 0; i < ids.length; i++) {
      const img = imagemPele(urlPele(ids[i] || ""));
      if (img && img.complete && img.naturalWidth && img.dataset.naPilha !== "1") return true;
    }
    return false;
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
    if (real === modoReal && meshChao.material === (real ? matReal : matCubos)) return;
    modoReal = real;
    meshChao.material = real ? materialRealPronto() : matCubos;
  }

  return {
    mesh: grupo,
    tick,
    aplicarTexturas,
    aplicarVisual,
    liberar() {
      trabalho = null;
      dados = null;
      meshChao.geometry?.dispose();
      meshAgua.geometry?.dispose();
      matCubos.dispose();
      matReal?.dispose();
      pilha?.dispose();
      pilhaPeles?.dispose();
      branco.dispose();
    },
  };
}

function criarMesh(nome, material) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.name = nome;
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.visible = false;
  return mesh;
}

function chaveExibidos(set) {
  if (!set.size) return "";
  return [...set].sort().join("|");
}

/** Miolo: o chunk e os oito vizinhos já estão na tela. A anel de fora não entra aqui. */
function chunkMiolo(key, estaveis) {
  const i = key.indexOf(",");
  const cx = Number(key.slice(0, i));
  const cy = Number(key.slice(i + 1));
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!estaveis.has(`${cx + dx},${cy + dy}`)) return false;
    }
  }
  return true;
}

function quadCoberto(quad, estaveis) {
  if (!quad.chunks.length) return false;
  for (let i = 0; i < quad.chunks.length; i++) {
    if (!chunkMiolo(quad.chunks[i], estaveis)) return false;
  }
  return true;
}

function recortar(mesh, parte, estaveis) {
  if (!parte?.quads?.length || !mesh.geometry?.getAttribute("position")) {
    mesh.visible = false;
    return;
  }
  const idx = [];
  for (const q of parte.quads) {
    if (quadCoberto(q, estaveis)) continue;
    idx.push(q.i0, q.i2, q.i1, q.i1, q.i2, q.i3);
  }
  mesh.visible = idx.length > 0;
  if (idx.length) mesh.geometry.setIndex(idx);
}

function chunksDoQuad(x, y, passo) {
  const cx0 = Math.floor(x / CHUNK_XZ);
  const cy0 = Math.floor(y / CHUNK_XZ);
  const cx1 = Math.floor((x + passo - 0.001) / CHUNK_XZ);
  const cy1 = Math.floor((y + passo - 0.001) / CHUNK_XZ);
  const lista = [];
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) lista.push(`${cx},${cy}`);
  }
  return lista;
}

function criarGeometria(parte) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(parte.pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(parte.cor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(parte.uv, 2));
  if (parte.bioma?.length) {
    geo.setAttribute("aBioma", new THREE.Float32BufferAttribute(parte.bioma, 3));
  }
  if (parte.splat && parte.splat.length === parte.pos.length / 3) {
    geo.setAttribute("splat", new THREE.Float32BufferAttribute(parte.splat, 1));
  }
  const todos = [];
  for (const q of parte.quads) todos.push(q.i0, q.i2, q.i1, q.i1, q.i2, q.i3);
  geo.setIndex(todos);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function* gerarMalha(px, py, raioSuave) {
  const passo = PASSO_MALHA_SUAVE;
  const alcance = raioSuave * CHUNK_XZ;
  const alcance2 = alcance * alcance;
  const x0 = Math.floor((px - alcance) / passo) * passo;
  const y0 = Math.floor((py - alcance) / passo) * passo;
  const x1 = Math.ceil((px + alcance) / passo) * passo;
  const y1 = Math.ceil((py + alcance) / passo) * passo;

  const cache = new Map();
  const chao = balde(true);
  const agua = balde(false);
  const nivel = nivelMarBlocos();

  function amostra(wx, wy) {
    const k = `${wx},${wy}`;
    let a = cache.get(k);
    if (a) return a;
    const par = parNoPonto(wx, wy);
    a = { h: alturaDoRelevo(wx, wy), cor: rgbBioma(wx, wy, false), par };
    cache.set(k, a);
    return a;
  }

  function por(destino, wx, wy) {
    const k = `${wx},${wy}`;
    let i = destino.mapa.get(k);
    if (i !== undefined) return i;
    const a = amostra(wx, wy);
    i = destino.pos.length / 3;
    destino.mapa.set(k, i);
    destino.pos.push(wx, a.h - 0.05, wy);
    // Um tile por bloco, igual ao UV 0–1 do topo do cubo.
    destino.uv.push(wx, -wy);
    destino.cor.push(a.cor[0], a.cor[1], a.cor[2]);
    destino.bioma.push(celulaDe(a.par.a), celulaDe(a.par.b), a.par.peso);
    destino.splat.push(cruSplat(wx, wy, a.par.a) ? 1 : 0);
    return i;
  }

  function porAgua(wx, wy) {
    const k = `${wx},${wy}`;
    let i = agua.mapa.get(k);
    if (i !== undefined) return i;
    const a = amostra(wx, wy);
    i = agua.pos.length / 3;
    agua.mapa.set(k, i);
    const prof = Math.max(0, nivel - a.h);
    const esc = 1 - Math.min(1, prof / 8) * 0.4;
    agua.pos.push(wx, nivel - 0.04, wy);
    agua.uv.push(wx, -wy);
    agua.cor.push(esc, esc, 1);
    return i;
  }

  let feitos = 0;
  for (let y = y0; y < y1; y += passo) {
    for (let x = x0; x < x1; x += passo) {
      const mx = x + passo * 0.5 - px;
      const my = y + passo * 0.5 - py;
      if (mx * mx + my * my > alcance2) continue;
      const hs = [
        amostra(x, y).h,
        amostra(x + passo, y).h,
        amostra(x, y + passo).h,
        amostra(x + passo, y + passo).h,
      ];
      const i0 = por(chao, x, y);
      const i1 = por(chao, x + passo, y);
      const i2 = por(chao, x, y + passo);
      const i3 = por(chao, x + passo, y + passo);
      chao.quads.push({ i0, i1, i2, i3, chunks: chunksDoQuad(x, y, passo) });
      if (Math.min(hs[0], hs[1], hs[2], hs[3]) < nivel) {
        const a0 = porAgua(x, y);
        const a1 = porAgua(x + passo, y);
        const a2 = porAgua(x, y + passo);
        const a3 = porAgua(x + passo, y + passo);
        agua.quads.push({ i0: a0, i1: a1, i2: a2, i3: a3, chunks: chunksDoQuad(x, y, passo) });
      }
      if ((++feitos & 47) === 0) yield;
    }
  }

  if (!chao.quads.length && !agua.quads.length) return null;
  return { chao, agua };
}

function balde(comBioma) {
  return {
    pos: [],
    cor: [],
    uv: [],
    splat: comBioma ? [] : null,
    quads: [],
    mapa: new Map(),
    bioma: comBioma ? [] : null,
  };
}
