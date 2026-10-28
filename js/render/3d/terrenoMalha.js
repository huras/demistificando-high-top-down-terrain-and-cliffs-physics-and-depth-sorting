import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import { marcarSombraSuja } from "./ceu/sombraEstavel.js";
import { aplicarFadeParedeInterior } from "./fadeParedeInterior3d.js";
import {
  CHUNK_XZ,
  CHUNK_Y,
  MESH_CHUNKS_POR_FRAME,
  TRONCO_INSET,
  VISUAL_REAL_PADRAO,
} from "../../config.js";
import {
  anexarGeoAoLote,
  criarLoteTipado,
  garantirCapLote,
  pushLedge,
  pushQuadAgua,
  pushQuadEspuma,
  pushQuadQueda,
  pushTriEspuma,
  pushTriTipado,
  q6Tipado,
} from "./malha/loteTipado.js";
import { geoDoLoteTipado } from "./malha/loteTipadoGeo.js";
import { cancelarMalhaWorker } from "./malha/ponteMalha.js";
import { aabbDoChunk, atualizarFrustumChunks } from "./malha/frustumChunks.js";
import { escalaYGrupoRelevo } from "./escalaVertical.js";
import { FLUIDO } from "../../mundo/agua/fluidos.js";
import { colunaAgua, garantirFluxoChunk } from "../../mundo/agua/fluxo.js";
import { PROPS } from "../../mundo/mapaDemo.js";
import { alturaEm, colunaTemArInterno, espessuraTopo } from "../../mundo/altura.js";
import { chunkDentroDoMundo } from "../../mundo/bounds.js";
import {
  baseTopoEm,
  chunkCarregadoEm,
  limparSujo,
  listarChunksSujos,
  obterChunk,
  obterBloco,
  onDirty,
  paraCadaChunk,
} from "../../mundo/voxel/storeMundo.js";
import {
  devePreemptar,
  obterContextoPrioridade,
  scoreChunk,
} from "../../mundo/voxel/prioridadeChunk.js";
import { BLOCO, ehSolido } from "../../mundo/voxel/tiposBloco.js";
import { registrarObjetoCena, removerObjetoCena } from "../../cena/registroCena.js";
import { hexBioma } from "../../mundo/bioma/tinta.js";
import { kitDoRelevo } from "../../mundo/bioma/catalogo.js";
import { urlPele } from "../../mundo/bioma/detalhe.js";
import { aplicarPeleSplat } from "./peleSplat.js";
import { pecasNoMundo, pesoSplat } from "./peleAutotile.js";
import { LABIO, PASSOS } from "./pecas/catalogo.js";
import { carimbarBorda, carimbarPlano, planaNo } from "./pecas/carimbar.js";
import { fundirChao } from "./pecas/fundir.js";
import { marcarLodFino } from "./stencilLod.js";
import { alturaLocal, gradeDoChunk, mascaraLocal } from "./pecas/mascara.js";
import { amostraKanto } from "../../mundo/regiao/amostraKanto.js";
import { obterKit } from "../../mundo/bioma/kits.js";
import {
  acumular,
  cronometroFatia,
  medir,
  sessaoAtiva,
} from "../../diagnostico/perfChunk.js";
import {
  avancarMateriaisAgua,
  liberarMateriaisAgua,
  obterMaterialEspuma,
  obterMaterialLago,
  obterMaterialLagoFamilia,
  obterMaterialQueda,
  obterMaterialQuedaFamilia,
} from "./texturasAgua3d.js";
import { canvasParaTextura, criarTexturasTerreno3d } from "./texturasTerreno3d.js";

/** Kit sintético: topo do slab BLOCO.PONTE (bridge.png). */
const KIT_PONTE = "_ponte";
const URL_PONTE = "assets/terrain/bridge.png";

const LEDGE_H = 0.12;
/** Aresta da face vertical ligeiramente abaixo do topo — evita z-fight. */
const INSET_TOPO = 0.002;

const DIRS = [
  { dx: 0, dy: 1, dz: 0, nome: "s" },
  { dx: 0, dy: -1, dz: 0, nome: "n" },
  { dx: 1, dy: 0, dz: 0, nome: "e" },
  { dx: -1, dy: 0, dz: 0, nome: "w" },
  { dx: 0, dy: 0, dz: 1, nome: "u" },
  { dx: 0, dy: 0, dz: -1, nome: "d" },
];

function hexParaRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function pintarVertices(geo, corTopo, corFace) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const cores = new Float32Array(pos.count * 3);
  const ct = hexParaRgb(corTopo);
  const cf = hexParaRgb(corFace);
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i);
    const top = ny > 0.45;
    const c = top ? ct : cf;
    const mul = ny < -0.45 ? 0.55 : top ? 1 : 0.88;
    cores[i * 3] = c.r * mul;
    cores[i * 3 + 1] = c.g * mul;
    cores[i * 3 + 2] = c.b * mul;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
}

function pintarPlano(geo, rgb) {
  if (!geo || !rgb) return geo;
  const n = geo.attributes.position.count;
  const cores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cores[i * 3] = rgb[0];
    cores[i * 3 + 1] = rgb[1];
    cores[i * 3 + 2] = rgb[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  return geo;
}

/**
 * O bloco marca o stencil e testa profundidade de verdade.
 * Suave / horizonte recusam esse pixel (ver stencilLod.js).
 */
function naFrenteDoSuave(material) {
  if (!material || material.transparent) return material;
  material.depthTest = true;
  material.depthWrite = true;
  material.depthFunc = THREE.LessEqualDepth;
  return marcarLodFino(material);
}

/** O topo horizontal não entra no mapa do sol. A face de cima em grade virava quadrado escuro. */
function profundidadeSemTopo() {
  const mat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vNormalSombra;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vNormalSombra = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vNormalSombra;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
if (vNormalSombra.y > 0.65) discard;`,
      );
  };
  mat.customProgramCacheKey = () => "sombra-sem-topo";
  return mat;
}

function misturarTinta(material, forca) {
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `diffuseColor.rgb = mix(diffuseColor.rgb, vColor, ${forca.toFixed(2)});`,
    );
  };
  material.customProgramCacheKey = () => `tinta-bioma-${forca}`;
  aplicarSombraNuvem(material);
  naFrenteDoSuave(material);
}

/** Compat: lista de geos → anexa num lote tipado e fecha. */
function mesclarLista(geos) {
  if (!geos.length) return null;
  const lote = criarLoteTipado(true, false);
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i];
    if (!g) continue;
    const ni = g.index ? g.toNonIndexed() : g;
    if (!ni.attributes.normal) ni.computeVertexNormals();
    anexarGeoAoLote(lote, ni);
    if (ni !== g) ni.dispose();
    g.dispose();
  }
  return geoDoLoteTipado(lote);
}

/** Quad 1×1 com UV; face vertical tem V = 1 (tile único). */
function quadFace(wx, wy, wz, dir) {
  const geo = new THREE.PlaneGeometry(1, 1);
  if (dir === "u") {
    geo.rotateX(-Math.PI / 2);
    geo.translate(wx + 0.5, wz + 1 - INSET_TOPO * 0, wy + 0.5);
    // topo exatamente em z+1; walls inset abaixo
    geo.translate(0, 0, 0);
  } else if (dir === "d") {
    geo.rotateX(Math.PI / 2);
    geo.translate(wx + 0.5, wz, wy + 0.5);
  } else if (dir === "s") {
    // PlaneGeometry default normal +Z (= sul / +worldY)
    geo.translate(0, -INSET_TOPO * 0.5, 0);
    geo.scale(1, 1 - INSET_TOPO, 1);
    geo.translate(wx + 0.5, wz + 0.5, wy + 1);
  } else if (dir === "n") {
    geo.rotateY(Math.PI);
    geo.translate(0, -INSET_TOPO * 0.5, 0);
    geo.scale(1, 1 - INSET_TOPO, 1);
    geo.translate(wx + 0.5, wz + 0.5, wy);
  } else if (dir === "e") {
    // +X outward (antes estava -π/2 → normal -X)
    geo.rotateY(Math.PI / 2);
    geo.translate(0, -INSET_TOPO * 0.5, 0);
    geo.scale(1, 1 - INSET_TOPO, 1);
    geo.translate(wx + 1, wz + 0.5, wy + 0.5);
  } else {
    // w: -X outward
    geo.rotateY(-Math.PI / 2);
    geo.translate(0, -INSET_TOPO * 0.5, 0);
    geo.scale(1, 1 - INSET_TOPO, 1);
    geo.translate(wx, wz + 0.5, wy + 0.5);
  }
  return geo;
}

/**
 * Quad livre (4 vértices CCW vistos de fora) → BufferGeometry com UV.
 * a,b,c,d = {x,y,z} em coords Three (y = elevação).
 */
function quadLivre(a, b, c, d) {
  const pos = new Float32Array([
    a.x, a.y, a.z,
    b.x, b.y, b.z,
    c.x, c.y, c.z,
    a.x, a.y, a.z,
    c.x, c.y, c.z,
    d.x, d.y, d.z,
  ]);
  const uv = new Float32Array([
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Triângulo (CCW de fora). */
function triLivre(a, b, c) {
  const pos = new Float32Array([
    a.x, a.y, a.z,
    b.x, b.y, b.z,
    c.x, c.y, c.z,
  ]);
  const uv = new Float32Array([0, 0, 1, 0, 0.5, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function solidoNivel(wx, wy, lz) {
  if (lz < 0 || lz >= CHUNK_Y) return false;
  return ehSolido(obterBloco(wx, wy, lz));
}

/**
 * Cantos convexos em L: ar na diagonal, sólidos ortogonais com bevel de 1 lado.
 * O bloco A (este) precisa ter o topo cortado + triângulo de mitra.
 */
function cortesConvexosL(wx, wy, lz) {
  const i = Math.max(0, Math.min(0.45, TRONCO_INSET));
  if (i <= 0) return [];
  /** @type {{ dir: string, i: number }[]} */
  const out = [];

  // SE: A canto côncavo; B=leste (bevel S); C=sul (bevel E); ar em (wx+1,wy+1)
  if (
    !solidoNivel(wx + 1, wy + 1, lz) &&
    solidoNivel(wx + 1, wy, lz) &&
    solidoNivel(wx, wy + 1, lz) &&
    vizinhoAr(wx + 1, wy, lz, 0, 1, 0) &&
    vizinhoAr(wx, wy + 1, lz, 1, 0, 0)
  ) {
    out.push({ dir: "se", i });
  }
  // SW
  if (
    !solidoNivel(wx - 1, wy + 1, lz) &&
    solidoNivel(wx - 1, wy, lz) &&
    solidoNivel(wx, wy + 1, lz) &&
    vizinhoAr(wx - 1, wy, lz, 0, 1, 0) &&
    vizinhoAr(wx, wy + 1, lz, -1, 0, 0)
  ) {
    out.push({ dir: "sw", i });
  }
  // NE
  if (
    !solidoNivel(wx + 1, wy - 1, lz) &&
    solidoNivel(wx + 1, wy, lz) &&
    solidoNivel(wx, wy - 1, lz) &&
    vizinhoAr(wx + 1, wy, lz, 0, -1, 0) &&
    vizinhoAr(wx, wy - 1, lz, 1, 0, 0)
  ) {
    out.push({ dir: "ne", i });
  }
  // NW
  if (
    !solidoNivel(wx - 1, wy - 1, lz) &&
    solidoNivel(wx - 1, wy, lz) &&
    solidoNivel(wx, wy - 1, lz) &&
    vizinhoAr(wx - 1, wy, lz, 0, -1, 0) &&
    vizinhoAr(wx, wy - 1, lz, -1, 0, 0)
  ) {
    out.push({ dir: "nw", i });
  }
  return out;
}

/**
 * Topo de A com cantos L cortados (pentágono / hex…).
 * verts em CCW vistos de cima.
 */
function topoComCortesConvexos(wx, wy, y1, cortes) {
  let iSE = 0;
  let iSW = 0;
  let iNE = 0;
  let iNW = 0;
  for (const c of cortes) {
    if (c.dir === "se") iSE = c.i;
    else if (c.dir === "sw") iSW = c.i;
    else if (c.dir === "ne") iNE = c.i;
    else if (c.dir === "nw") iNW = c.i;
  }

  /** @type {{x:number,y:number,z:number}[]} */
  const verts = [];
  // NW → SW → SE → NE (CCW de cima)
  if (iNW > 0) {
    verts.push({ x: wx + iNW, y: y1, z: wy });
    verts.push({ x: wx, y: y1, z: wy + iNW });
  } else {
    verts.push({ x: wx, y: y1, z: wy });
  }

  if (iSW > 0) {
    verts.push({ x: wx, y: y1, z: wy + 1 - iSW });
    verts.push({ x: wx + iSW, y: y1, z: wy + 1 });
  } else {
    verts.push({ x: wx, y: y1, z: wy + 1 });
  }

  if (iSE > 0) {
    verts.push({ x: wx + 1 - iSE, y: y1, z: wy + 1 });
    verts.push({ x: wx + 1, y: y1, z: wy + 1 - iSE });
  } else {
    verts.push({ x: wx + 1, y: y1, z: wy + 1 });
  }

  if (iNE > 0) {
    verts.push({ x: wx + 1, y: y1, z: wy + iNE });
    verts.push({ x: wx + 1 - iNE, y: y1, z: wy });
  } else {
    verts.push({ x: wx + 1, y: y1, z: wy });
  }

  /** @type {THREE.BufferGeometry[]} */
  const tris = [];
  for (let k = 1; k < verts.length - 1; k++) {
    tris.push(triLivre(verts[0], verts[k], verts[k + 1]));
  }
  return tris;
}

/**
 * Bevel (tronco parcial) só em voxel de borda de cliff.
 * Inset apenas nos lados com ar — lados colados a sólido ficam flush.
 */
function geoBevelBorda(wx, wy, wz, lateraisExpostas) {
  const i = Math.max(0, Math.min(0.45, TRONCO_INSET));
  const y0 = wz;
  const y1 = wz + 1 - INSET_TOPO;
  const exp = new Set(lateraisExpostas);
  const iS = exp.has("s") ? i : 0;
  const iN = exp.has("n") ? i : 0;
  const iE = exp.has("e") ? i : 0;
  const iW = exp.has("w") ? i : 0;

  // NW → SW → SE → NE (CCW de cima → normal +Y)
  const nw = { x: wx + iW, y: y1, z: wy + iN };
  const sw = { x: wx + iW, y: y1, z: wy + 1 - iS };
  const se = { x: wx + 1 - iE, y: y1, z: wy + 1 - iS };
  const ne = { x: wx + 1 - iE, y: y1, z: wy + iN };
  const top = quadLivre(nw, sw, se, ne);

  /** @type {THREE.BufferGeometry[]} */
  const laterais = [];
  if (exp.has("s")) {
    laterais.push(
      quadLivre(
        { x: wx, y: y0, z: wy + 1 },
        { x: wx + 1, y: y0, z: wy + 1 },
        { x: wx + 1 - iE, y: y1, z: wy + 1 - iS },
        { x: wx + iW, y: y1, z: wy + 1 - iS },
      ),
    );
  }
  if (exp.has("n")) {
    laterais.push(
      quadLivre(
        { x: wx + 1, y: y0, z: wy },
        { x: wx, y: y0, z: wy },
        { x: wx + iW, y: y1, z: wy + iN },
        { x: wx + 1 - iE, y: y1, z: wy + iN },
      ),
    );
  }
  if (exp.has("e")) {
    laterais.push(
      quadLivre(
        { x: wx + 1, y: y0, z: wy + 1 },
        { x: wx + 1, y: y0, z: wy },
        { x: wx + 1 - iE, y: y1, z: wy + iN },
        { x: wx + 1 - iE, y: y1, z: wy + 1 - iS },
      ),
    );
  }
  if (exp.has("w")) {
    laterais.push(
      quadLivre(
        { x: wx, y: y0, z: wy },
        { x: wx, y: y0, z: wy + 1 },
        { x: wx + iW, y: y1, z: wy + 1 - iS },
        { x: wx + iW, y: y1, z: wy + iN },
      ),
    );
  }

  return { top, laterais };
}

function caixaLedge(wx, wy, wzTopo, dir, corTopo, corFace) {
  let geo;
  const y = wzTopo - LEDGE_H; // totalmente abaixo do plano do topo
  if (dir === "s") {
    geo = new THREE.BoxGeometry(1, LEDGE_H, 0.18);
    geo.translate(wx + 0.5, y + LEDGE_H * 0.5, wy + 1 - 0.09);
  } else if (dir === "n") {
    geo = new THREE.BoxGeometry(1, LEDGE_H, 0.18);
    geo.translate(wx + 0.5, y + LEDGE_H * 0.5, wy + 0.09);
  } else if (dir === "e") {
    geo = new THREE.BoxGeometry(0.18, LEDGE_H, 1);
    geo.translate(wx + 1 - 0.09, y + LEDGE_H * 0.5, wy + 0.5);
  } else {
    geo = new THREE.BoxGeometry(0.18, LEDGE_H, 1);
    geo.translate(wx + 0.09, y + LEDGE_H * 0.5, wy + 0.5);
  }
  pintarVertices(geo, corTopo, corFace);
  return geo;
}

const LADOS_COL = [
  { nome: "s", dx: 0, dy: 1 },
  { nome: "n", dx: 0, dy: -1 },
  { nome: "e", dx: 1, dy: 0 },
  { nome: "w", dx: -1, dy: 0 },
];

function criarLote(comCor, comSplat) {
  return criarLoteTipado(comCor, comSplat);
}

function comSplat(geo, peso) {
  if (!geo?.attributes?.position) return geo;
  const n = geo.attributes.position.count;
  const valores = new Float32Array(n);
  if (peso) valores.fill(peso);
  geo.setAttribute("splat", new THREE.Float32BufferAttribute(valores, 1));
  if (!geo.getAttribute("peleUv")) {
    geo.setAttribute("peleUv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return geo;
}

function q6(lote, coords, uvs, peleUvs) {
  q6Tipado(lote, coords, uvs, peleUvs);
}

function geoDoLote(lote) {
  return geoDoLoteTipado(lote);
}

function insetTronco() {
  return Math.max(0, Math.min(0.45, TRONCO_INSET));
}

function pushTri(lote, a, b, c) {
  pushTriTipado(lote, a, b, c);
}

function pushTriParaFora(lote, a, b, c, nx, ny, nz) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  if (cx * nx + cy * ny + cz * nz < 0) pushTri(lote, a, c, b);
  else pushTri(lote, a, b, c);
}

function valoresUnicos(valores) {
  valores.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < valores.length; i++) {
    if (!out.length || Math.abs(valores[i] - out[out.length - 1]) > 1e-4) out.push(valores[i]);
  }
  return out;
}

/**
 * O vizinho encostado nessa aresta chanfra um lado perpendicular e o topo
 * dele cai exatamente na altura da aresta. O vértice do chanfro tem que
 * existir na aresta, senão a cunha fica aberta.
 */
function cortesNoVizinho(wx, wy, yAresta, dx, dy) {
  const i = insetTronco();
  if (i <= 0) return [];
  const nx = wx + dx;
  const ny = wy + dy;
  const h = alturaEm(nx, ny);
  if (Math.abs(h - yAresta) > 0.02) return [];
  const cortes = [];
  if (dx === 0) {
    if (alturaEm(nx - 1, ny) < h) cortes.push(wx + i);
    if (alturaEm(nx + 1, ny) < h) cortes.push(wx + 1 - i);
    return cortes;
  }
  if (alturaEm(nx, ny - 1) < h) cortes.push(wy + i);
  if (alturaEm(nx, ny + 1) < h) cortes.push(wy + 1 - i);
  return cortes;
}

function faixaComCortes(inicio, fim, cortes) {
  const lo = Math.min(inicio, fim);
  const hi = Math.max(inicio, fim);
  const dentro = [];
  for (let i = 0; i < cortes.length; i++) {
    if (cortes[i] > lo + 1e-4 && cortes[i] < hi - 1e-4) dentro.push(cortes[i]);
  }
  const eixo = valoresUnicos([lo, ...dentro, hi]);
  if (inicio > fim) eixo.reverse();
  return eixo;
}

function comPasso(pontos) {
  const out = new Array(pontos.length);
  for (let i = 0; i < pontos.length; i++) out[i] = { x: pontos[i].x, y: pontos[i].y, z: pontos[i].z, t: i };
  return out;
}

/** Costura duas polilinhas no mesmo sentido. O primeiro triângulo segue base[0] → base[1] → topo[0]. */
function costurar(lote, base, topo) {
  if (base.length < 2 || topo.length < 2) return;
  const baixo = comPasso(base);
  const cima = comPasso(topo);
  let ib = 0;
  let it = 0;
  while (ib < baixo.length - 1 || it < cima.length - 1) {
    const acabaBase = ib >= baixo.length - 1;
    const acabaTopo = it >= cima.length - 1;
    const tBase = acabaBase ? Infinity : baixo[ib + 1].t;
    const tTopo = acabaTopo ? Infinity : cima[it + 1].t;
    if (!acabaBase && (acabaTopo || tBase <= tTopo)) {
      pushTri(lote, baixo[ib], baixo[ib + 1], cima[it]);
      ib++;
    } else if (!acabaTopo) {
      pushTri(lote, baixo[ib], cima[it + 1], cima[it]);
      it++;
    } else break;
  }
}

function maisAlto(wx, wy, superficie, dx, dy) {
  return alturaEm(wx + dx, wy + dy) > superficie + 0.01;
}

function pushLivre(lote, a, b, c, d) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  lote._n = [nx / len, ny / len, nz / len];
  q6(
    lote,
    [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z],
    [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
  );
}

function garantirCorBranca(geo) {
  if (!geo?.attributes?.position || geo.getAttribute("color")) return;
  const n = geo.attributes.position.count;
  const cores = new Float32Array(n * 3);
  cores.fill(1);
  geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
}

function finalizarLote(lote, extras) {
  // Extras (bevel/mitra) → anexados no lote tipado; sem mergeGeometries.
  for (let i = 0; i < extras.length; i++) {
    const g = extras[i];
    if (!g) continue;
    if (lote.cor) garantirCorBranca(g);
    if (lote.splat && !g.getAttribute("splat")) comSplat(g, 0);
    const ni = g.index ? g.toNonIndexed() : g;
    if (!ni.attributes.normal) ni.computeVertexNormals();
    anexarGeoAoLote(lote, ni);
    if (ni !== g) ni.dispose();
    g.dispose();
  }
  extras.length = 0;
  return geoDoLote(lote);
}

function uvsRet(u0, v0, u1, v1) {
  return [u0, v1, u0, v0, u1, v1, u0, v0, u1, v0, u1, v1];
}

function clipPeca(peca, x0, z0, x1, z1) {
  const ix0 = Math.max(peca.x0, x0);
  const iz0 = Math.max(peca.z0, z0);
  const ix1 = Math.min(peca.x1, x1);
  const iz1 = Math.min(peca.z1, z1);
  if (ix1 - ix0 < 1e-4 || iz1 - iz0 < 1e-4) return null;
  const tx0 = (ix0 - peca.x0) / (peca.x1 - peca.x0);
  const tx1 = (ix1 - peca.x0) / (peca.x1 - peca.x0);
  const tz0 = (iz0 - peca.z0) / (peca.z1 - peca.z0);
  const tz1 = (iz1 - peca.z0) / (peca.z1 - peca.z0);
  const mistura = (a, b, t) => a + (b - a) * t;
  return {
    x0: ix0,
    z0: iz0,
    x1: ix1,
    z1: iz1,
    bu0: mistura(peca.bu0, peca.bu1, tx0),
    bu1: mistura(peca.bu0, peca.bu1, tx1),
    bv1: mistura(peca.bv1, peca.bv0, tz0),
    bv0: mistura(peca.bv1, peca.bv0, tz1),
    pu0: mistura(peca.pu0, peca.pu1, tx0),
    pu1: mistura(peca.pu0, peca.pu1, tx1),
    pv1: mistura(peca.pv1, peca.pv0, tz0),
    pv0: mistura(peca.pv1, peca.pv0, tz1),
  };
}

function pushTriChao(lote, y, pts, uvs, splat) {
  lote._splat = splat;
  lote._n = [0, 1, 0];
  garantirCapLote(lote, 3);
  const base = lote.nVerts;
  const r = lote._rgb ? lote._rgb[0] : 1;
  const g = lote._rgb ? lote._rgb[1] : 1;
  const b = lote._rgb ? lote._rgb[2] : 1;
  const sp = splat || 0;
  for (let i = 0; i < 3; i++) {
    const ip = (base + i) * 3;
    const iu = (base + i) * 2;
    lote.pos[ip] = pts[i][0];
    lote.pos[ip + 1] = y;
    lote.pos[ip + 2] = pts[i][1];
    lote.uv[iu] = uvs[i].bu;
    lote.uv[iu + 1] = uvs[i].bv;
    lote.nor[ip] = 0;
    lote.nor[ip + 1] = 1;
    lote.nor[ip + 2] = 0;
    if (lote.cor) {
      lote.cor[ip] = r;
      lote.cor[ip + 1] = g;
      lote.cor[ip + 2] = b;
    }
    if (lote.splat) lote.splat[base + i] = sp;
    if (lote.pele) {
      lote.pele[iu] = uvs[i].pu;
      lote.pele[iu + 1] = uvs[i].pv;
    }
  }
  lote.nVerts = base + 3;
}

function uvNaFaixa(x, z, x0, z0, x1, z1, peca) {
  const tx = (x - x0) / ((x1 - x0) || 1);
  const tz = (z - z0) / ((z1 - z0) || 1);
  const mistura = (a, b, t) => a + (b - a) * t;
  return {
    bu: peca ? mistura(peca.bu0, peca.bu1, tx) : x,
    bv: peca ? mistura(peca.bv1, peca.bv0, tz) : 1 - z,
    pu: peca ? mistura(peca.pu0, peca.pu1, tx) : 0,
    pv: peca ? mistura(peca.pv1, peca.pv0, tz) : 0,
  };
}

function cantoExterno(xa, za, xb, zb) {
  const l = LABIO;
  const e = 1e-4;
  if (Math.abs(xb - 1) < e && Math.abs(zb - 1) < e && Math.abs(xa - (1 - l)) < e && Math.abs(za - (1 - l)) < e) return "se";
  if (Math.abs(xa) < e && Math.abs(zb - 1) < e && Math.abs(xb - l) < e && Math.abs(za - (1 - l)) < e) return "sw";
  if (Math.abs(xb - 1) < e && Math.abs(za) < e && Math.abs(xa - (1 - l)) < e && Math.abs(zb - l) < e) return "ne";
  if (Math.abs(xa) < e && Math.abs(za) < e && Math.abs(xb - l) < e && Math.abs(zb - l) < e) return "nw";
  return "";
}

function triSoloChanfro(canto, xa, za, xb, zb) {
  if (canto === "se") return [[xa, za], [xa, zb], [xb, za]];
  if (canto === "sw") return [[xb, za], [xa, za], [xb, zb]];
  if (canto === "ne") return [[xa, zb], [xb, zb], [xa, za]];
  return [[xb, zb], [xb, za], [xa, zb]];
}

function pushQuadChao(lote, x0, y, z0, x1, z1, peca, splat) {
  lote._splat = splat;
  lote._n = [0, 1, 0];
  q6(
    lote,
    [x0, y, z0, x0, y, z1, x1, y, z0, x0, y, z1, x1, y, z1, x1, y, z0],
    uvsRet(peca.bu0, peca.bv0, peca.bu1, peca.bv1),
    splat ? uvsRet(peca.pu0, peca.pv0, peca.pu1, peca.pv1) : null,
  );
}

function noPasso(t) {
  const frac = t - Math.floor(t + 1e-4);
  for (let k = 0; k < PASSOS.length; k++) {
    if (Math.abs(frac - PASSOS[k]) < 1e-4) return true;
  }
  return Math.abs(frac) < 1e-4;
}

function amostrasGrade(a, b) {
  if (!noPasso(a) || !noPasso(b)) return [a, b];
  const pts = [a, b];
  const i0 = Math.floor(a);
  const i1 = Math.ceil(b);
  for (let base = i0; base <= i1; base++) {
    for (let k = 0; k < PASSOS.length; k++) {
      const t = base + PASSOS[k];
      if (t > a + 1e-4 && t < b - 1e-4) pts.push(t);
    }
  }
  pts.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (!out.length || pts[i] - out[out.length - 1] > 1e-4) out.push(pts[i]);
  }
  return out;
}

function subdividirChao(lote, wx, wy, y, x0, z0, x1, z1, peca, chanfros) {
  const xs = amostrasGrade(x0, x1);
  const zs = amostrasGrade(z0, z1);
  const largura = x1 - x0 || 1;
  const altura = z1 - z0 || 1;
  const mistura = (a, b, t) => a + (b - a) * t;
  for (let iz = 0; iz < zs.length - 1; iz++) {
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const xa = xs[ix];
      const xb = xs[ix + 1];
      const za = zs[iz];
      const zb = zs[iz + 1];
      const canto = cantoExterno(xa, za, xb, zb);
      if (canto && chanfros?.[canto]) {
        const local = triSoloChanfro(canto, xa, za, xb, zb);
        const uvs = local.map(([x, z]) => uvNaFaixa(x, z, x0, z0, x1, z1, peca));
        pushTriChao(
          lote,
          y,
          local.map(([x, z]) => [wx + x, wy + z]),
          uvs,
          peca ? 1 : 0,
        );
        continue;
      }
      const tx0 = (xa - x0) / largura;
      const tx1 = (xb - x0) / largura;
      const tz0 = (za - z0) / altura;
      const tz1 = (zb - z0) / altura;
      const bu0 = peca ? mistura(peca.bu0, peca.bu1, tx0) : xa;
      const bu1 = peca ? mistura(peca.bu0, peca.bu1, tx1) : xb;
      const bv0 = peca ? mistura(peca.bv1, peca.bv0, tz1) : 1 - zb;
      const bv1 = peca ? mistura(peca.bv1, peca.bv0, tz0) : 1 - za;
      pushQuadChao(
        lote,
        wx + xa,
        y,
        wy + za,
        wx + xb,
        wy + zb,
        {
          bu0,
          bv0,
          bu1,
          bv1,
          pu0: peca ? mistura(peca.pu0, peca.pu1, tx0) : 0,
          pu1: peca ? mistura(peca.pu0, peca.pu1, tx1) : 0,
          pv0: peca ? mistura(peca.pv1, peca.pv0, tz1) : 0,
          pv1: peca ? mistura(peca.pv1, peca.pv0, tz0) : 0,
        },
        peca ? 1 : 0,
      );
    }
  }
}

function emitirTopo(lote, wx, wy, y, x0, z0, x1, z1, chanfros) {
  const pecas = pecasNoMundo(wx, wy);
  if (!pecas) {
    subdividirChao(lote, wx, wy, y, x0, z0, x1, z1, null, chanfros);
    return;
  }
  for (let i = 0; i < pecas.length; i++) {
    const recorte = clipPeca(pecas[i], x0, z0, x1, z1);
    if (!recorte) continue;
    subdividirChao(lote, wx, wy, y, recorte.x0, recorte.z0, recorte.x1, recorte.z1, recorte, chanfros);
  }
}

/** Topo 1×1 em y, UV igual ao PlaneGeometry rotacionado. */
function pushTopoLote(lote, wx, wy, y) {
  emitirTopo(lote, wx, wy, y, 0, 0, 1, 1);
}

function pushFaceSul(lote, wx, wy, wz) {
  lote._n = [0, 0, 1];
  const y0 = wz;
  const y1 = wz + 1 - INSET_TOPO;
  const z = wy + 1;
  q6(
    lote,
    [wx, y1, z, wx, y0, z, wx + 1, y1, z, wx, y0, z, wx + 1, y0, z, wx + 1, y1, z],
    [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1],
  );
}

function pushFaceNorte(lote, wx, wy, wz) {
  lote._n = [0, 0, -1];
  const y0 = wz;
  const y1 = wz + 1 - INSET_TOPO;
  const z = wy;
  q6(
    lote,
    [wx + 1, y1, z, wx + 1, y0, z, wx, y1, z, wx + 1, y0, z, wx, y0, z, wx, y1, z],
    [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1],
  );
}

function pushFaceLeste(lote, wx, wy, wz) {
  lote._n = [1, 0, 0];
  const y0 = wz;
  const y1 = wz + 1 - INSET_TOPO;
  const x = wx + 1;
  q6(
    lote,
    [x, y0, wy, x, y1, wy, x, y1, wy + 1, x, y0, wy, x, y1, wy + 1, x, y0, wy + 1],
    [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
  );
}

function pushFaceOeste(lote, wx, wy, wz) {
  lote._n = [-1, 0, 0];
  const y0 = wz;
  const y1 = wz + 1 - INSET_TOPO;
  const x = wx;
  q6(
    lote,
    [x, y0, wy + 1, x, y1, wy + 1, x, y1, wy, x, y0, wy + 1, x, y1, wy, x, y0, wy],
    [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
  );
}

const PUSH_FACE = {
  s: pushFaceSul,
  n: pushFaceNorte,
  e: pushFaceLeste,
  w: pushFaceOeste,
};

const UV_FACE = [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1];

function pushCuboLote(lote, wx, wy, y0, y1, corTopo, corFace) {
  const x0 = wx;
  const x1 = wx + 1;
  const z0 = wy;
  const z1 = wy + 1;
  const ct = hexParaRgb(corTopo);
  const cf = hexParaRgb(corFace);
  lote._rgb = [ct.r, ct.g, ct.b];
  lote._n = [0, 1, 0];
  q6(
    lote,
    [x0, y1, z0, x0, y1, z1, x1, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0],
    UV_FACE,
  );
  lote._rgb = [cf.r * 0.88, cf.g * 0.88, cf.b * 0.88];
  lote._n = [0, 0, 1];
  q6(
    lote,
    [x0, y1, z1, x0, y0, z1, x1, y1, z1, x0, y0, z1, x1, y0, z1, x1, y1, z1],
    UV_FACE,
  );
  lote._n = [0, 0, -1];
  q6(
    lote,
    [x1, y1, z0, x1, y0, z0, x0, y1, z0, x1, y0, z0, x0, y0, z0, x0, y1, z0],
    UV_FACE,
  );
  lote._n = [1, 0, 0];
  q6(
    lote,
    [x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z0, x1, y1, z1, x1, y0, z1],
    UV_FACE,
  );
  lote._n = [-1, 0, 0];
  q6(
    lote,
    [x0, y0, z1, x0, y1, z1, x0, y1, z0, x0, y0, z1, x0, y1, z0, x0, y0, z0],
    UV_FACE,
  );
  lote._rgb = [cf.r * 0.55, cf.g * 0.55, cf.b * 0.55];
  lote._n = [0, -1, 0];
  q6(
    lote,
    [x0, y0, z1, x0, y0, z0, x1, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1],
    UV_FACE,
  );
  lote._rgb = null;
}

function vizinhoAr(wx, wy, wz, dx, dy, dz) {
  const nx = wx + dx;
  const ny = wy + dy;
  const nz = wz + dz;
  if (nz < 0) return false;
  if (nz >= CHUNK_Y) return true;
  return !ehSolido(obterBloco(nx, ny, nz));
}

/**
 * Só o modo ativo entra na malha (real OU cubos). Trocar visual (T) suja
 * os chunks e remalha — evita 2× CPU no stream quando se joga só no real.
 *
 * Diagnóstico (faces/bench) força os dois via opts.
 */
/** @type {{ cubos: boolean, real: boolean }} */
let opcoesMalha = {
  cubos: !VISUAL_REAL_PADRAO,
  real: !!VISUAL_REAL_PADRAO,
};

/** @param {{ cubos?: boolean, real?: boolean }} opts */
export function definirOpcoesMalha(opts = {}) {
  if (opts.cubos != null) opcoesMalha.cubos = !!opts.cubos;
  if (opts.real != null) opcoesMalha.real = !!opts.real;
  // Sempre pelo menos um modo — senão o stream fica sem geometria.
  if (!opcoesMalha.cubos && !opcoesMalha.real) opcoesMalha.real = true;
}

export function obterOpcoesMalha() {
  return { ...opcoesMalha };
}

/** Multiplica o sprite: raso quase branco, fundo um pouco mais escuro. */
function tintaLago(prof) {
  const t = Math.max(0, Math.min(1, ((prof || 1) - 1) / 3));
  const v = Math.round(255 - t * 55);
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(v)}${h(v)}${h(255)}`;
}

function orientarUvFluxo(geo, fx, fy) {
  const uv = geo.attributes.uv;
  if (!uv) return;
  if (Math.abs(fy) > Math.abs(fx)) {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  }
  if (fx < 0 || (fx === 0 && fy < 0)) {
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  }
  uv.needsUpdate = true;
}

function geoSuperficieAgua(wx, wy, y, fx, fy, cor) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(wx + 0.5, y, wy + 0.5);
  orientarUvFluxo(geo, fx, fy);
  pintarVertices(geo, cor, cor);
  return geo;
}

const ESPUMA_LARGO = 0.46;

function terraSeca(wx, wy) {
  // Chunk ainda não gerado devolve ar. Isso não é margem.
  if (!chunkCarregadoEm(wx, wy)) return false;
  return colunaAgua(wx, wy).superficie <= 0;
}

/** Sem normal o MeshStandard fica preto. As duas faces olham para cima. */
function orientarEspuma(geo) {
  const pos = geo.attributes.position;
  const idx = geo.getIndex();
  const arr = idx.array;
  for (let i = 0; i < arr.length; i += 3) {
    const ia = arr[i];
    const ib = arr[i + 1];
    const ic = arr[i + 2];
    const ax = pos.getX(ib) - pos.getX(ia);
    const az = pos.getZ(ib) - pos.getZ(ia);
    const bx = pos.getX(ic) - pos.getX(ia);
    const bz = pos.getZ(ic) - pos.getZ(ia);
    if (az * bx - ax * bz < 0) {
      arr[i + 1] = ic;
      arr[i + 2] = ib;
    }
  }
  const nor = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) nor[i * 3 + 1] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return geo;
}

/** Retângulo no XZ. v é a costa: 1 na terra, 0 na água. */
function quadEspuma(x0, z0, x1, z1, y, v00, v10, v11, v01) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([
      x0, y, z0,
      x1, y, z0,
      x1, y, z1,
      x0, y, z1,
    ]), 3),
  );
  geo.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([
      0, v00,
      0, v10,
      0, v11,
      0, v01,
    ]), 2),
  );
  geo.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array([
      v00, v00, v00,
      v10, v10, v10,
      v11, v11, v11,
      v01, v01, v01,
    ]), 3),
  );
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  return orientarEspuma(geo);
}

/** Triângulo da quina. O vértice da terra fica com costa 1. */
function triEspuma(ax, az, bx, bz, cx, cz, y, va, vb, vc) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([
      ax, y, az,
      bx, y, bz,
      cx, y, cz,
    ]), 3),
  );
  geo.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0, va, 0, vb, 0, vc]), 2),
  );
  geo.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array([
      va, va, va,
      vb, vb, vb,
      vc, vc, vc,
    ]), 3),
  );
  geo.setIndex([0, 1, 2]);
  return orientarEspuma(geo);
}

/**
 * Faixa só onde a água encosta na terra. O canto fecha o vão
 * entre duas bordas secas. A face da queda não entra aqui.
 */
function empurrarEspumaLote(lote, wx, wy, y) {
  const norte = terraSeca(wx, wy - 1);
  const sul = terraSeca(wx, wy + 1);
  const oeste = terraSeca(wx - 1, wy);
  const leste = terraSeca(wx + 1, wy);
  const se = terraSeca(wx + 1, wy + 1);
  const sw = terraSeca(wx - 1, wy + 1);
  const ne = terraSeca(wx + 1, wy - 1);
  const nw = terraSeca(wx - 1, wy - 1);
  if (!norte && !sul && !oeste && !leste && !se && !sw && !ne && !nw) return;

  const x0 = wx;
  const x1 = wx + 1;
  const z0 = wy;
  const z1 = wy + 1;
  const xa = oeste ? x0 + ESPUMA_LARGO : x0;
  const xb = leste ? x1 - ESPUMA_LARGO : x1;
  const za = norte ? z0 + ESPUMA_LARGO : z0;
  const zb = sul ? z1 - ESPUMA_LARGO : z1;

  if (sul && xb - xa > 1e-3) {
    pushQuadEspuma(lote, xa, z1 - ESPUMA_LARGO, xb, z1, y, 0, 0, 1, 1);
  }
  if (norte && xb - xa > 1e-3) {
    pushQuadEspuma(lote, xa, z0, xb, z0 + ESPUMA_LARGO, y, 1, 1, 0, 0);
  }
  if (leste && zb - za > 1e-3) {
    pushQuadEspuma(lote, x1 - ESPUMA_LARGO, za, x1, zb, y, 0, 1, 1, 0);
  }
  if (oeste && zb - za > 1e-3) {
    pushQuadEspuma(lote, x0, za, x0 + ESPUMA_LARGO, zb, y, 1, 0, 0, 1);
  }
  if (sul && leste) {
    pushQuadEspuma(lote, x1 - ESPUMA_LARGO, z1 - ESPUMA_LARGO, x1, z1, y, 0, 1, 1, 1);
  }
  if (sul && oeste) {
    pushQuadEspuma(lote, x0, z1 - ESPUMA_LARGO, x0 + ESPUMA_LARGO, z1, y, 1, 0, 1, 1);
  }
  if (norte && leste) {
    pushQuadEspuma(lote, x1 - ESPUMA_LARGO, z0, x1, z0 + ESPUMA_LARGO, y, 1, 1, 1, 0);
  }
  if (norte && oeste) {
    pushQuadEspuma(lote, x0, z0, x0 + ESPUMA_LARGO, z0 + ESPUMA_LARGO, y, 1, 1, 0, 1);
  }

  const largo = ESPUMA_LARGO;
  if (!sul && !leste && se) {
    pushTriEspuma(lote, x1, z1, x1 - largo, z1, x1, z1 - largo, y, 1, 0, 0);
  }
  if (!sul && !oeste && sw) {
    pushTriEspuma(lote, x0, z1, x0, z1 - largo, x0 + largo, z1, y, 1, 0, 0);
  }
  if (!norte && !leste && ne) {
    pushTriEspuma(lote, x1, z0, x1, z0 + largo, x1 - largo, z0, y, 1, 0, 0);
  }
  if (!norte && !oeste && nw) {
    pushTriEspuma(lote, x0, z0, x0 + largo, z0, x0, z0 + largo, y, 1, 0, 0);
  }
}

function planoQueda(wx, wy, y0, y1, dir) {
  const h = Math.max(0.2, y1 - y0);
  const geo = new THREE.PlaneGeometry(1, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * h);
  const yc = (y0 + y1) * 0.5;
  if (dir === "s") geo.translate(wx + 0.5, yc, wy + 1);
  else if (dir === "n") {
    geo.rotateY(Math.PI);
    geo.translate(wx + 0.5, yc, wy);
  } else if (dir === "e") {
    geo.rotateY(Math.PI / 2);
    geo.translate(wx + 1, yc, wy + 0.5);
  } else {
    geo.rotateY(-Math.PI / 2);
    geo.translate(wx, yc, wy + 0.5);
  }
  pintarVertices(geo, "#ffffff", "#ffffff");
  return geo;
}

/** Metade do quadrado do canto que continua sendo topo. A outra metade é o chanfro. */
function triCantoTopo(lote, wx, wy, y, ax, az, bx, bz, cx, cz) {
  const pts = [
    { x: wx + ax, y, z: wy + az, u: ax, v: 1 - az },
    { x: wx + bx, y, z: wy + bz, u: bx, v: 1 - bz },
    { x: wx + cx, y, z: wy + cz, u: cx, v: 1 - cz },
  ];
  const ux = pts[1].x - pts[0].x;
  const uz = pts[1].z - pts[0].z;
  const vx = pts[2].x - pts[0].x;
  const vz = pts[2].z - pts[0].z;
  if (uz * vx - ux * vz < 0) {
    const tmp = pts[1];
    pts[1] = pts[2];
    pts[2] = tmp;
  }
  pushTriTipado(lote, pts[0], pts[1], pts[2]);
}

function emitirTopoMenosCantos(lote, wx, wy, y, iW, iN, iE, iS, cortes) {
  const x0 = iW;
  const z0 = iN;
  const x1 = 1 - iE;
  const z1 = 1 - iS;
  const c = { se: 0, sw: 0, ne: 0, nw: 0 };
  for (let k = 0; k < cortes.length; k++) c[cortes[k].dir] = cortes[k].i;
  const xa = x0 + Math.max(c.nw, c.sw);
  const xb = x1 - Math.max(c.ne, c.se);
  if (xb - xa > 1e-4 && z1 - z0 > 1e-4) emitirTopo(lote, wx, wy, y, xa, z0, xb, z1);
  if (xa - x0 > 1e-4) {
    const zn = z0 + c.nw;
    const zs = z1 - c.sw;
    if (zs - zn > 1e-4) emitirTopo(lote, wx, wy, y, x0, zn, xa, zs);
    if (c.nw > 0) triCantoTopo(lote, wx, wy, y, xa, zn, xa, z0, x0, zn);
    if (c.sw > 0) triCantoTopo(lote, wx, wy, y, xa, zs, x0, zs, xa, z1);
  }
  if (x1 - xb > 1e-4) {
    const zn = z0 + c.ne;
    const zs = z1 - c.se;
    if (zs - zn > 1e-4) emitirTopo(lote, wx, wy, y, xb, zn, x1, zs);
    if (c.ne > 0) triCantoTopo(lote, wx, wy, y, xb, zn, xb, z0, x1, zn);
    if (c.se > 0) triCantoTopo(lote, wx, wy, y, xb, zs, xb, z1, x1, zs);
  }
}

function empurrarMitras(lote, wx, wy, y0, y1, cortes) {
  for (let k = 0; k < cortes.length; k++) {
    const c = cortes[k];
    const i = c.i;
    if (c.dir === "se") {
      pushTriParaFora(
        lote,
        { x: wx + 1, y: y0, z: wy + 1 },
        { x: wx + 1, y: y1, z: wy + 1 - i },
        { x: wx + 1 - i, y: y1, z: wy + 1 },
        1, 0, 1,
      );
    } else if (c.dir === "sw") {
      pushTriParaFora(
        lote,
        { x: wx, y: y0, z: wy + 1 },
        { x: wx + i, y: y1, z: wy + 1 },
        { x: wx, y: y1, z: wy + 1 - i },
        -1, 0, 1,
      );
    } else if (c.dir === "ne") {
      pushTriParaFora(
        lote,
        { x: wx + 1, y: y0, z: wy },
        { x: wx + 1 - i, y: y1, z: wy },
        { x: wx + 1, y: y1, z: wy + i },
        1, 0, -1,
      );
    } else {
      pushTriParaFora(
        lote,
        { x: wx, y: y0, z: wy },
        { x: wx, y: y1, z: wy + i },
        { x: wx + i, y: y1, z: wy },
        -1, 0, -1,
      );
    }
  }
}

function empurrarBevel(loteTop, loteFaces, wx, wy, wz, lateraisExpostas) {
  const i = insetTronco();
  const y0 = wz;
  const y1 = wz + 1 - INSET_TOPO;
  const superficie = wz + 1;
  const exp = new Set(lateraisExpostas);
  const iS = exp.has("s") ? i : 0;
  const iN = exp.has("n") ? i : 0;
  const iE = exp.has("e") ? i : 0;
  const iW = exp.has("w") ? i : 0;
  const cortesL = cortesConvexosL(wx, wy, wz);
  emitirTopoMenosCantos(loteTop, wx, wy, y1, iW, iN, iE, iS, cortesL);
  empurrarMitras(loteFaces, wx, wy, y0, y1, cortesL);
  if (exp.has("s")) {
    const xs = faixaComCortes(wx, wx + 1, cortesNoVizinho(wx, wy, y0, 0, 1));
    const zTopo = wy + 1 - iS;
    costurar(
      loteFaces,
      xs.map((x) => ({ x, y: y0, z: wy + 1 })),
      [
        { x: wx + iW, y: y1, z: zTopo },
        { x: wx + 1 - iE, y: y1, z: zTopo },
      ],
    );
    // Cunha no plano do vizinho mais alto: o chanfro puxa o topo e a quina cheia fica aberta.
    if (iW === 0 && iS > 0 && maisAlto(wx, wy, superficie, -1, 0)) {
      pushTriParaFora(
        loteFaces,
        { x: wx, y: y0, z: wy + 1 },
        { x: wx, y: y1, z: wy + 1 },
        { x: wx, y: y1, z: wy + 1 - iS },
        1, 0, 0,
      );
    }
    if (iE === 0 && iS > 0 && maisAlto(wx, wy, superficie, 1, 0)) {
      pushTriParaFora(
        loteFaces,
        { x: wx + 1, y: y0, z: wy + 1 },
        { x: wx + 1, y: y1, z: wy + 1 - iS },
        { x: wx + 1, y: y1, z: wy + 1 },
        -1, 0, 0,
      );
    }
  }
  if (exp.has("n")) {
    const xs = faixaComCortes(wx + 1, wx, cortesNoVizinho(wx, wy, y0, 0, -1));
    const zTopo = wy + iN;
    costurar(
      loteFaces,
      xs.map((x) => ({ x, y: y0, z: wy })),
      [
        { x: wx + 1 - iE, y: y1, z: zTopo },
        { x: wx + iW, y: y1, z: zTopo },
      ],
    );
    if (iE === 0 && iN > 0 && maisAlto(wx, wy, superficie, 1, 0)) {
      pushTriParaFora(
        loteFaces,
        { x: wx + 1, y: y0, z: wy },
        { x: wx + 1, y: y1, z: wy },
        { x: wx + 1, y: y1, z: wy + iN },
        -1, 0, 0,
      );
    }
    if (iW === 0 && iN > 0 && maisAlto(wx, wy, superficie, -1, 0)) {
      pushTriParaFora(
        loteFaces,
        { x: wx, y: y0, z: wy },
        { x: wx, y: y1, z: wy + iN },
        { x: wx, y: y1, z: wy },
        1, 0, 0,
      );
    }
  }
  if (exp.has("e")) {
    const zs = faixaComCortes(wy + 1, wy, cortesNoVizinho(wx, wy, y0, 1, 0));
    const xTopo = wx + 1 - iE;
    costurar(
      loteFaces,
      zs.map((z) => ({ x: wx + 1, y: y0, z })),
      [
        { x: xTopo, y: y1, z: wy + 1 - iS },
        { x: xTopo, y: y1, z: wy + iN },
      ],
    );
    if (iS === 0 && iE > 0 && maisAlto(wx, wy, superficie, 0, 1)) {
      pushTriParaFora(
        loteFaces,
        { x: wx + 1, y: y0, z: wy + 1 },
        { x: wx + 1 - iE, y: y1, z: wy + 1 },
        { x: wx + 1, y: y1, z: wy + 1 },
        0, 0, -1,
      );
    }
    if (iN === 0 && iE > 0 && maisAlto(wx, wy, superficie, 0, -1)) {
      pushTriParaFora(
        loteFaces,
        { x: wx + 1, y: y0, z: wy },
        { x: wx + 1, y: y1, z: wy },
        { x: wx + 1 - iE, y: y1, z: wy },
        0, 0, 1,
      );
    }
  }
  if (exp.has("w")) {
    const zs = faixaComCortes(wy, wy + 1, cortesNoVizinho(wx, wy, y0, -1, 0));
    const xTopo = wx + iW;
    costurar(
      loteFaces,
      zs.map((z) => ({ x: wx, y: y0, z })),
      [
        { x: xTopo, y: y1, z: wy + iN },
        { x: xTopo, y: y1, z: wy + 1 - iS },
      ],
    );
    if (iN === 0 && iW > 0 && maisAlto(wx, wy, superficie, 0, -1)) {
      pushTriParaFora(
        loteFaces,
        { x: wx, y: y0, z: wy },
        { x: wx + iW, y: y1, z: wy },
        { x: wx, y: y1, z: wy },
        0, 0, 1,
      );
    }
    if (iS === 0 && iW > 0 && maisAlto(wx, wy, superficie, 0, 1)) {
      pushTriParaFora(
        loteFaces,
        { x: wx, y: y0, z: wy + 1 },
        { x: wx, y: y1, z: wy + 1 },
        { x: wx + iW, y: y1, z: wy + 1 },
        0, 0, -1,
      );
    }
  }
}

function emitirRetangulo(lote, nome, wx, wy, ya, yb) {
  if (yb - ya <= 1e-4) return;
  if (nome === "s") {
    const xsBaixo = faixaComCortes(wx, wx + 1, cortesNoVizinho(wx, wy, ya, 0, 1));
    const xsCima = faixaComCortes(wx, wx + 1, cortesNoVizinho(wx, wy, yb, 0, 1));
    costurar(
      lote,
      xsBaixo.map((x) => ({ x, y: ya, z: wy + 1 })),
      xsCima.map((x) => ({ x, y: yb, z: wy + 1 })),
    );
  } else if (nome === "n") {
    const xsBaixo = faixaComCortes(wx + 1, wx, cortesNoVizinho(wx, wy, ya, 0, -1));
    const xsCima = faixaComCortes(wx + 1, wx, cortesNoVizinho(wx, wy, yb, 0, -1));
    costurar(
      lote,
      xsBaixo.map((x) => ({ x, y: ya, z: wy })),
      xsCima.map((x) => ({ x, y: yb, z: wy })),
    );
  } else if (nome === "e") {
    const zsBaixo = faixaComCortes(wy + 1, wy, cortesNoVizinho(wx, wy, ya, 1, 0));
    const zsCima = faixaComCortes(wy + 1, wy, cortesNoVizinho(wx, wy, yb, 1, 0));
    costurar(
      lote,
      zsBaixo.map((z) => ({ x: wx + 1, y: ya, z })),
      zsCima.map((z) => ({ x: wx + 1, y: yb, z })),
    );
  } else {
    const zsBaixo = faixaComCortes(wy, wy + 1, cortesNoVizinho(wx, wy, ya, -1, 0));
    const zsCima = faixaComCortes(wy, wy + 1, cortesNoVizinho(wx, wy, yb, -1, 0));
    costurar(
      lote,
      zsBaixo.map((z) => ({ x: wx, y: ya, z })),
      zsCima.map((z) => ({ x: wx, y: yb, z })),
    );
  }
}

function pushParede(lote, nome, wx, wy, y0, y1) {
  if (y1 - y0 <= 1e-4) return;
  const marcas = [y0];
  for (let y = Math.floor(y0) + 1; y < y1 - 1e-4; y++) marcas.push(y);
  marcas.push(y1);
  for (let i = 0; i < marcas.length - 1; i++) {
    emitirRetangulo(lote, nome, wx, wy, marcas[i], marcas[i + 1]);
  }
}

/**
 * Modelo/quintal: colisão de casca sobe a coluna, mas a malha fica no chão
 * (senão vira “terra/cliff” atrás/na frente do prédio).
 */
function rebaixarModelo(grade, cx, cy) {
  const n = CHUNK_XZ + 2;
  const x0 = cx * CHUNK_XZ - 1;
  const y0 = cy * CHUNK_XZ - 1;
  for (let y = 0; y < n; y++) {
    const wy = y0 + y;
    const linha = y * n;
    for (let x = 0; x < n; x++) {
      const amostra = amostraKanto(x0 + x, wy);
      if (amostra?.modelo || amostra?.entradaLab) grade[linha + x] = amostra.h;
    }
  }
}

/**
 * @param {object} chunk
 * @param {{ cubos?: boolean, real?: boolean } | null} [opts]
 */
function* construirGeosChunk(chunk, opts = null) {
  const querCubos = opts?.cubos ?? opcoesMalha.cubos;
  const querReal = opts?.real ?? opcoesMalha.real;
  const loteLedges = querReal ? criarLote(true) : null;
  const loteAguas = criarLote(true);
  const loteAguasPantano = criarLote(true);
  const loteAguasLava = criarLote(true);
  const loteEspumas = criarLote(true);
  const loteQuedas = criarLote(true);
  const loteQuedasLava = criarLote(true);
  const sacosTopo = new Map();
  /** Uma única malha de parede (mesmo materialPenhasco) — corta draw calls. */
  const sacoParedeUnico = { lote: criarLote(true, false), extras: [] };
  function sacoDeTopo(kit) {
    let saco = sacosTopo.get(kit);
    if (!saco) {
      saco = { lote: criarLote(true, true), extras: [] };
      sacosTopo.set(kit, saco);
    }
    return saco;
  }
  const loteCubos = querCubos ? criarLote(true) : null;
  const grade = gradeDoChunk(chunk.cx, chunk.cy);
  rebaixarModelo(grade, chunk.cx, chunk.cy);
  const nCel = CHUNK_XZ * CHUNK_XZ;
  const alturaCel = new Int16Array(nCel);
  const mascaraCel = new Uint8Array(nCel);
  const simplesCel = new Uint8Array(nCel);
  const fundivel = new Uint8Array(nCel);
  const kitsCel = new Array(nCel);
  const perf = sessaoAtiva();
  medir("fluxoAgua", () => garantirFluxoChunk(chunk));
  yield;

  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const cronFaces = perf ? cronometroFatia("colunasFaces") : null;

  let _colunas = 0;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      if ((_colunas++ & 7) === 7) {
        cronFaces?.pausar();
        yield;
        cronFaces?.retomar();
      }
      const wx = baseX + lx;
      const wy = baseY + ly;
      const ia = ly * CHUNK_XZ + lx;
      const zSurf = alturaLocal(grade, lx, ly);
      alturaCel[ia] = zSurf;
      const modelo = !!amostraKanto(wx, wy)?.modelo;
      let colunaSimples = zSurf > 0 && (modelo || !colunaTemArInterno(wx, wy));
      if (colunaSimples && !modelo) {
        for (let i = 0; i < LADOS_COL.length; i++) {
          const d = LADOS_COL[i];
          if (amostraKanto(wx + d.dx, wy + d.dy)?.modelo) continue;
          if (colunaTemArInterno(wx + d.dx, wy + d.dy)) {
            colunaSimples = false;
            break;
          }
        }
      }
      simplesCel[ia] = colunaSimples ? 1 : 0;

      let loteGrama = null;
      let loteTerra = null;
      let loteFaces = null;
      let topsGrama = null;
      let topsTerra = null;
      if (querReal) {
        const kit = kitDoRelevo(wx, wy) || "_";
        const sacoTopo = sacoDeTopo(kit);
        const sacoParede = sacoParedeUnico;
        loteGrama = sacoTopo.lote;
        loteTerra = sacoTopo.lote;
        loteFaces = sacoParede.lote;
        topsGrama = sacoTopo.extras;
        topsTerra = sacoTopo.extras;
        mascaraCel[ia] = mascaraLocal(grade, lx, ly);
        kitsCel[ia] = kit;

        for (let lz = 0; lz < zSurf && !colunaSimples; lz++) {
          const id = obterBloco(wx, wy, lz);
          if (!ehSolido(id)) continue;

          const ehSuperficie = vizinhoAr(wx, wy, lz, 0, 0, 1);
          const lateraisAr = [];
          for (const lat of ["s", "n", "e", "w"]) {
            const ld = DIRS.find((x) => x.nome === lat);
            if (vizinhoAr(wx, wy, lz, ld.dx, ld.dy, 0)) lateraisAr.push(lat);
          }
          // Bevel só na borda do cliff (superfície + pelo menos 1 lado aberto)
          const ehBordaCliff =
            ehSuperficie && lateraisAr.length > 0 && TRONCO_INSET > 0;

          for (const d of DIRS) {
            if (!vizinhoAr(wx, wy, lz, d.dx, d.dy, d.dz)) continue;

            if (d.nome === "u") {
              const cortesL = ehSuperficie ? cortesConvexosL(wx, wy, lz) : [];
              const yTopo = lz + 1 - INSET_TOPO;
              let loteTop;
              let extrasTop;
              if (id === BLOCO.PONTE) {
                const sacoPonte = sacoDeTopo(KIT_PONTE);
                loteTop = sacoPonte.lote;
                extrasTop = sacoPonte.extras;
              } else if (id === BLOCO.TERRA || id === BLOCO.PEDRA || lz + 1 >= 2) {
                loteTop = loteTerra;
                extrasTop = topsTerra;
              } else {
                loteTop = loteGrama;
                extrasTop = topsGrama;
              }

              if (ehBordaCliff) {
                empurrarBevel(loteTop, loteFaces, wx, wy, lz, lateraisAr);
              } else if (cortesL.length > 0) {
                // Canto L: corta o topo de A + triângulo de mitra
                for (const t of topoComCortesConvexos(wx, wy, yTopo, cortesL)) {
                  extrasTop.push(comSplat(pintarPlano(t, loteTop._rgb), 0));
                }
                empurrarMitras(loteFaces, wx, wy, lz, yTopo, cortesL);
              } else {
                pushTopoLote(loteTop, wx, wy, lz + 1);
                for (const lat of lateraisAr) {
                  pushLedge(
                    loteLedges,
                    wx,
                    wy,
                    lz + 1,
                    lat,
                    hexBioma(wx, wy, false),
                    hexBioma(wx, wy, true),
                  );
                }
              }
            } else if (d.nome === "d") {
              loteFaces._n = [0, -1, 0];
              q6(
                loteFaces,
                [wx, lz, wy + 1, wx, lz, wy, wx + 1, lz, wy + 1, wx, lz, wy, wx + 1, lz, wy, wx + 1, lz, wy + 1],
                UV_FACE,
              );
            } else {
              if (ehBordaCliff && lateraisAr.includes(d.nome)) continue;
              PUSH_FACE[d.nome](loteFaces, wx, wy, lz);
            }
          }
        }
      }

      if (querCubos && zSurf > 0) {
        let y0 = 0;
        let y1 = Math.max(0.08, zSurf);
        if (!modelo && colunaTemArInterno(wx, wy)) {
          const h = Math.max(0.08, espessuraTopo(wx, wy));
          const base = baseTopoEm(wx, wy);
          y0 = base < 0 ? zSurf - h : base;
          y1 = y0 + h;
        }
        pushCuboLote(loteCubos, wx, wy, y0, y1, hexBioma(wx, wy, false), hexBioma(wx, wy, true));
      }

      const supAgua = chunk.aguaSuperficie[ia] | 0;
      if (supAgua > 0) {
        const caindo = chunk.aguaCaindo[ia] === 1;
        const fam = chunk.fluido[ia] | 0;
        // Lip de cachoeira também precisa da lâmina (bloco no topo);
        // só a cortina deixava o tile sem superfície.
        const prof = caindo
          ? Math.max(1, supAgua - (chunk.aguaPiso[ia] | 0))
          : chunk.aguaProf[ia] | 0;
        const loteAgua =
          fam === FLUIDO.LAVA ? loteAguasLava : fam === FLUIDO.PANTANO ? loteAguasPantano : loteAguas;
        const corAgua = fam === FLUIDO.LAVA || fam === FLUIDO.PANTANO ? "#ffffff" : tintaLago(prof || 1);
        const rgbAgua = hexParaRgb(corAgua);
        pushQuadAgua(
          loteAgua,
          wx,
          wy,
          supAgua - 0.04,
          chunk.fluxoX[ia] | 0,
          chunk.fluxoY[ia] | 0,
          rgbAgua.r,
          rgbAgua.g,
          rgbAgua.b,
        );
        empurrarEspumaLote(loteEspumas, wx, wy, supAgua + 0.16);
        // Cortina em qualquer fluido (água, pântano, lava) com vizinho
        // molhado/nível mais baixo — dois níveis diferentes adjacentes.
        {
          const loteQueda = fam === FLUIDO.LAVA ? loteQuedasLava : loteQuedas;
          if (caindo) {
            let yBase = chunk.aguaFundo[ia] | 0;
            let dir = "s";
            const fx = chunk.fluxoX[ia] | 0;
            const fy = chunk.fluxoY[ia] | 0;
            if (fx || fy) {
              const dest = colunaAgua(wx + fx, wy + fy);
              if (dest.superficie > 0 && !dest.caindo && dest.superficie < supAgua - 0.05) {
                yBase = dest.superficie;
              }
              if (fy > 0) dir = "s";
              else if (fy < 0) dir = "n";
              else if (fx > 0) dir = "e";
              else dir = "w";
            }
            if (supAgua - yBase > 0.15) {
              pushQuadQueda(loteQueda, wx, wy, yBase, supAgua, dir);
            }
          } else {
            const lados = [
              [0, 1, "s"],
              [0, -1, "n"],
              [1, 0, "e"],
              [-1, 0, "w"],
            ];
            for (let d = 0; d < lados.length; d++) {
              const nx = wx + lados[d][0];
              const ny = wy + lados[d][1];
              const dest = colunaAgua(nx, ny);
              // Só entre colunas molhadas em níveis diferentes.
              if (!(dest.superficie > 0)) continue;
              if (supAgua - dest.superficie < 1) continue;
              pushQuadQueda(loteQueda, wx, wy, dest.superficie, supAgua, lados[d][2]);
            }
          }
        }
      }
    }
  }

  if (querReal) {
    for (let i = 0; i < nCel; i++) {
      if (!simplesCel[i] || mascaraCel[i] !== 0) continue;
      const lx = i % CHUNK_XZ;
      const ly = (i / CHUNK_XZ) | 0;
      const wx = baseX + lx;
      const wy = baseY + ly;
      if (pesoSplat(wx, wy) === 1) continue;
      if (!planaNo(grade, lx, ly, wx, wy)) continue;
      fundivel[i] = 1;
    }
    const planos = fundirChao(CHUNK_XZ, fundivel, alturaCel, kitsCel);
    for (let i = 0; i < planos.length; i++) {
      const plano = planos[i];
      carimbarPlano(
        sacoDeTopo(plano.kit).lote,
        baseX + plano.lx,
        baseY + plano.ly,
        baseX + plano.lx + plano.w,
        baseY + plano.ly + plano.d,
        plano.h,
      );
    }
    for (let ly = 0; ly < CHUNK_XZ; ly++) {
      for (let lx = 0; lx < CHUNK_XZ; lx++) {
        const i = ly * CHUNK_XZ + lx;
        if (!simplesCel[i] || fundivel[i]) continue;
        const wx = baseX + lx;
        const wy = baseY + ly;
        const y = alturaCel[i];
        const kit = kitsCel[i];
        const sacoTopo = sacoDeTopo(kit);
        const sacoParede = sacoParedeUnico;
        const m = mascaraCel[i];
        const splat = pesoSplat(wx, wy) === 1;
        const plana = m === 0 && planaNo(grade, lx, ly, wx, wy);
        if (plana) {
          emitirTopo(sacoTopo.lote, wx, wy, y, 0, 0, 1, 1);
          continue;
        }
        const { cap, chanfros } = carimbarBorda(
          sacoTopo.lote,
          sacoParede.lote,
          grade,
          lx,
          ly,
          wx,
          wy,
          y,
          m,
          !splat,
        );
        if (splat && cap.x1 - cap.x0 > 1e-4 && cap.z1 - cap.z0 > 1e-4) {
          emitirTopo(sacoTopo.lote, wx, wy, y, cap.x0, cap.z0, cap.x1, cap.z1, chanfros);
        }
      }
    }
  }

  cronFaces?.fim();
  yield;

  const tFin = perf ? performance.now() : 0;
  let geoParedes = null;
  /** Um geo de topo por kit — materialKit + pele/splat (não atlas unificado). */
  const topos = [];
  const paredes = [];
  if (querReal) {
    for (const [kit, saco] of sacosTopo) {
      const geo = finalizarLote(saco.lote, saco.extras);
      if (geo) topos.push({ kit, geo });
    }
    geoParedes = finalizarLote(sacoParedeUnico.lote, sacoParedeUnico.extras);
    if (geoParedes) paredes.push({ kit: "_penhasco", geo: geoParedes });
  }
  const out = {
    topos,
    paredes,
    geoTops: null,
    geoParedes,
    geoLedges: querReal ? geoDoLote(loteLedges) : null,
    geoCubos: querCubos ? geoDoLote(loteCubos) : null,
    geoAgua: geoDoLote(loteAguas),
    geoAguaPantano: geoDoLote(loteAguasPantano),
    geoAguaLava: geoDoLote(loteAguasLava),
    geoEspuma: geoDoLote(loteEspumas),
    geoQueda: geoDoLote(loteQuedas),
    geoQuedaLava: geoDoLote(loteQuedasLava),
  };
  if (perf) acumular("finalizarGeos", performance.now() - tFin);
  return out;
}

function drenarGeosChunk(chunk, opts = null) {
  const gen = construirGeosChunk(chunk, opts);
  let passo = gen.next();
  while (!passo.done) passo = gen.next();
  return passo.value;
}

/** Malha completa (cubos+real) — página de faces / profiling. */
export function malharChunk(chunk) {
  return drenarGeosChunk(chunk, { cubos: true, real: true });
}

/** Iterator do mesher — a página de profiling drena com orçamento de frame. */
export function* iterarGeosChunk(chunk) {
  return yield* construirGeosChunk(chunk, { cubos: true, real: true });
}

function vertsDeGeo(geo) {
  return geo?.attributes?.position?.count | 0;
}

/** Conta vértices das geometrias geradas (debug / relatório). */
export function contarVertsGeos(geos) {
  if (!geos) return 0;
  let n = vertsDeGeo(geos.geoCubos) + vertsDeGeo(geos.geoLedges);
  n += vertsDeGeo(geos.geoAgua) + vertsDeGeo(geos.geoAguaPantano) + vertsDeGeo(geos.geoAguaLava);
  n += vertsDeGeo(geos.geoEspuma) + vertsDeGeo(geos.geoQueda) + vertsDeGeo(geos.geoQuedaLava);
  for (const item of geos.topos || []) n += vertsDeGeo(item.geo);
  for (const item of geos.paredes || []) n += vertsDeGeo(item.geo);
  return n;
}

/**
 * Cria meshes descartáveis a partir das geos (aproxima o custo de instalarMeshes).
 * Não entra na cena do jogo.
 */
export function instalarGeosDescartavel(geos) {
  return medir("instalarMeshes", () => {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const meshes = [];
    const add = (geo) => {
      if (!geo) return;
      meshes.push(new THREE.Mesh(geo, mat));
    };
    add(geos.geoCubos);
    add(geos.geoLedges);
    add(geos.geoAgua);
    add(geos.geoAguaPantano);
    add(geos.geoAguaLava);
    add(geos.geoEspuma);
    add(geos.geoQueda);
    add(geos.geoQuedaLava);
    for (const item of geos.topos || []) add(item.geo);
    for (const item of geos.paredes || []) add(item.geo);
    const verts = contarVertsGeos(geos);
    for (const m of meshes) {
      m.geometry?.dispose();
    }
    mat.dispose();
    return { meshes: meshes.length, verts };
  });
}

function geoProp(p) {
  if (p.sprite || p.tipo === "arvore" || p.tipo === "mata" || p.tipo === "grama" || p.tipo === "cristal") {
    return [];
  }
  const base = alturaEm(Math.floor(p.x), Math.floor(p.y));
  const out = [];
  if (p.tipo === "pedra") {
    const pedra = new THREE.DodecahedronGeometry(0.28, 0);
    pedra.translate(p.x, base + 0.22, p.y);
    pintarVertices(pedra, "#8a8680", "#5a564e");
    out.push(pedra);
  } else if (p.tipo === "placa") {
    const poste = new THREE.BoxGeometry(0.08, 0.92, 0.08);
    poste.translate(p.x, base + 0.46, p.y);
    pintarVertices(poste, "#6b4a2a", "#4a3018");
    out.push(poste);
    const painel = new THREE.BoxGeometry(0.78, 0.4, 0.06);
    painel.translate(p.x, base + 1.02, p.y);
    pintarVertices(painel, "#f3e6bc", "#e4d29a");
    out.push(painel);
  }
  return out;
}

function construirProps() {
  const props = [];
  for (const p of PROPS) {
    const geo = geoProp(p);
    if (geo) props.push(...geo);
  }
  return mesclarLista(props);
}

/**
 * Terreno 3D por chunk — culled faces, rebuild dirty.
 */
export function criarTerrenoMalha(atlas = null) {
  const grupo = new THREE.Group();
  grupo.name = "terreno";
  grupo.scale.set(1, escalaYGrupoRelevo(), 1);

  const grupoCubos = new THREE.Group();
  grupoCubos.name = "terreno-cubos";
  grupo.add(grupoCubos);

  const grupoReal = new THREE.Group();
  grupoReal.name = "terreno-real";
  grupoReal.visible = false;
  grupo.add(grupoReal);

  const grupoAgua = new THREE.Group();
  grupoAgua.name = "terreno-agua";
  grupo.add(grupoAgua);

  const matAgua = obterMaterialLago();
  const matEspuma = obterMaterialEspuma();
  const matQueda = obterMaterialQueda();
  const depthCubos = profundidadeSemTopo();

  const matCubos = naFrenteDoSuave(aplicarSombraNuvem(new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.04,
    flatShading: true,
  })));
  const matCubosSmooth = naFrenteDoSuave(aplicarSombraNuvem(new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.06,
    flatShading: false,
  })));

  const materiais = {
    grama: null,
    terra: null,
    cliff: null,
    topoAtlas: null,
    ledge: naFrenteDoSuave(aplicarSombraNuvem(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.05,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }))),
    props: naFrenteDoSuave(aplicarSombraNuvem(new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.04,
      flatShading: true,
    }))),
  };

  /** @type {Map<string, {cubos:THREE.Mesh, real:THREE.Group}>} */
  const meshesPorChunk = new Map();
  let meshProps = null;
  let meshPropsCubos = null;
  let texturas = null;
  let visuais = null;
  /** @type {Map<string, { mat: THREE.Material, tex: THREE.Texture | null }>} */
  const materiaisKit = new Map();
  let atlasAplicado = false;
  /** Visual ativo: cubos (didático) vs real (tiles). Alinha com opcoesMalha. */
  let modoCubos = !VISUAL_REAL_PADRAO;
  /** @type {THREE.Texture | null} */
  let texPonte = null;

  function aquecerTexPonte() {
    if (texPonte) return;
    new THREE.TextureLoader().load(
      URL_PONTE,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        texPonte = tex;
        const item = materiaisKit.get(`topo:${KIT_PONTE}`);
        if (item?.mat) {
          item.mat.map = tex;
          item.mat.color.set(0xffffff);
          item.mat.needsUpdate = true;
        }
      },
      undefined,
      () => {},
    );
  }
  aquecerTexPonte();

  function montarMateriaisTextura(tex) {
    materiais.grama = new THREE.MeshStandardMaterial({
      map: tex.grama,
      roughness: 0.88,
      metalness: 0.04,
    });
    materiais.terra = new THREE.MeshStandardMaterial({
      map: tex.terra || tex.grama,
      roughness: 0.9,
      metalness: 0.04,
    });
    materiais.cliff = new THREE.MeshStandardMaterial({
      map: tex.cliff,
      roughness: 0.88,
      metalness: 0.04,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    misturarTinta(materiais.grama, 0.62);
    misturarTinta(materiais.terra, 0.62);
    misturarTinta(materiais.cliff, 0.8);
  }

  function soltarMateriaisKit() {
    for (const item of materiaisKit.values()) {
      item.mat.dispose();
      item.tex?.dispose();
    }
    materiaisKit.clear();
  }

  function texturaTopoDoKit(kit) {
    const chave = `topo:${kit}`;
    if (!materiaisKit.has(chave)) materialKit(kit, "topo");
    const item = materiaisKit.get(chave);
    return item?.tex || item?.mat?.map || texturas?.grama || null;
  }

  function materialPenhasco() {
    const chave = "parede:*";
    const pronto = materiaisKit.get(chave);
    if (pronto) {
      aplicarFadeParedeInterior(pronto.mat);
      return pronto.mat;
    }
    const mat = new THREE.MeshStandardMaterial({
      map: texturas?.penhasco || texturas?.cliff || null,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.02,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    materiaisKit.set(chave, { mat, tex: null });
    aplicarSombraNuvem(mat);
    aplicarFadeParedeInterior(mat);
    return naFrenteDoSuave(mat);
  }

  function materialPonte() {
    const chave = `topo:${KIT_PONTE}`;
    const pronto = materiaisKit.get(chave);
    if (pronto) return pronto.mat;
    aquecerTexPonte();
    const mat = new THREE.MeshStandardMaterial({
      map: texPonte,
      color: texPonte ? 0xffffff : 0xb45309,
      roughness: 0.86,
      metalness: 0.02,
      vertexColors: true,
    });
    materiaisKit.set(chave, { mat, tex: null });
    aplicarSombraNuvem(mat);
    return naFrenteDoSuave(mat);
  }

  function materialKit(kit, tipo) {
    if (tipo === "parede") return materialPenhasco();
    if (kit === KIT_PONTE) return materialPonte();
    const chave = `${tipo}:${kit}`;
    const pronto = materiaisKit.get(chave);
    if (pronto) {
      // Topo de muro/coluna (santuario/caverna) também precisa do fade.
      if (tipo === "topo") aplicarFadeParedeInterior(pronto.mat);
      return pronto.mat;
    }
    const meta = obterKit(kit);
    let tex = null;
    const img = meta?.chao ? visuais?.centros?.[meta.chao] : null;
    if (img) tex = canvasParaTextura(img, { repeat: true });
    const mat = new THREE.MeshStandardMaterial({
      map: tex || texturas?.grama,
      roughness: 0.88,
      metalness: 0.04,
      vertexColors: true,
    });
    materiaisKit.set(chave, { mat, tex });
    aplicarPeleSplat(mat, urlPele(kit));
    aplicarSombraNuvem(mat);
    if (tipo === "topo") aplicarFadeParedeInterior(mat);
    return naFrenteDoSuave(mat);
  }

  function soltarRegistro(objeto) {
    const id = objeto?.userData?.cenaId;
    if (id) removerObjetoCena(id);
  }

  function publicarMalha(mesh, pasta) {
    if (!mesh?.name) return;
    registrarObjetoCena(mesh, {
      id: mesh.name,
      pasta,
      rotulo: mesh.name,
      tipo: "malha",
    });
  }

  function liberarGrupoChunk(entry) {
    if (!entry) return;
    soltarRegistro(entry.agua);
    soltarRegistro(entry.espuma);
    soltarRegistro(entry.queda);
    soltarRegistro(entry.cubos);
    soltarRegistro(entry.real);
    if (entry.agua) {
      grupoAgua.remove(entry.agua);
      entry.agua.geometry?.dispose();
    }
    if (entry.folhas) {
      for (let i = 0; i < entry.folhas.length; i++) {
        const folha = entry.folhas[i];
        soltarRegistro(folha);
        grupoAgua.remove(folha);
        folha.geometry?.dispose();
      }
    }
    if (entry.espuma) {
      grupoAgua.remove(entry.espuma);
      entry.espuma.geometry?.dispose();
    }
    if (entry.queda) {
      grupoAgua.remove(entry.queda);
      entry.queda.geometry?.dispose();
    }
    if (entry.cubos) {
      grupoCubos.remove(entry.cubos);
      entry.cubos.geometry?.dispose();
    }
    if (entry.real) {
      grupoReal.remove(entry.real);
      entry.real.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
  }

  function reconstruirChunk(chunk, geosProntos = null) {
    const key = `${chunk.cx},${chunk.cy}`;
    liberarGrupoChunk(meshesPorChunk.get(key));
    meshesPorChunk.delete(key);

    const geos = geosProntos || drenarGeosChunk(chunk);
    const entry = { cubos: null, real: new THREE.Group() };
    entry.real.name = `chunk-real-${key}`;

    if (geos.geoCubos) {
      const mesh = new THREE.Mesh(geos.geoCubos, matCubos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depthCubos;
      mesh.name = `cubos-${key}`;
      mesh.renderOrder = 1;
      grupoCubos.add(mesh);
      entry.cubos = mesh;
    }

    entry.folhas = [];
    function porAgua(geo, mat, nome) {
      if (!geo) return;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = nome;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 2;
      grupoAgua.add(mesh);
      publicarMalha(mesh, "agua");
      entry.folhas.push(mesh);
    }
    if (geos.geoAgua) {
      const mesh = new THREE.Mesh(geos.geoAgua, matAgua);
      mesh.name = `agua-${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 2;
      grupoAgua.add(mesh);
      entry.agua = mesh;
    }
    porAgua(geos.geoAguaPantano, obterMaterialLagoFamilia(FLUIDO.PANTANO), `pantano-${key}`);
    porAgua(geos.geoAguaLava, obterMaterialLagoFamilia(FLUIDO.LAVA), `lava-${key}`);
    if (geos.geoEspuma) {
      const mesh = new THREE.Mesh(geos.geoEspuma, matEspuma);
      mesh.name = `espuma-${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // Depois da água (2) e antes do sprite (3). O véu das pernas continua em 4.
      mesh.renderOrder = 2.5;
      grupoAgua.add(mesh);
      entry.espuma = mesh;
    }
    if (geos.geoQueda) {
      const mesh = new THREE.Mesh(geos.geoQueda, matQueda);
      mesh.name = `queda-${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 3;
      grupoAgua.add(mesh);
      entry.queda = mesh;
    }
    if (geos.geoQuedaLava) {
      const mesh = new THREE.Mesh(geos.geoQuedaLava, obterMaterialQuedaFamilia(FLUIDO.LAVA));
      mesh.name = `queda-lava-${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 3;
      grupoAgua.add(mesh);
      publicarMalha(mesh, "agua");
      entry.folhas.push(mesh);
    }

    function add(geo, mat, nome, opts = {}) {
      if (!geo || !mat) {
        geo?.dispose();
        return;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = nome;
      mesh.castShadow = opts.cast != null ? opts.cast : opts.shadow !== false;
      mesh.receiveShadow = opts.receive != null ? opts.receive : opts.shadow !== false;
      mesh.userData._castShadowOrig = !!mesh.castShadow;
      mesh.renderOrder = 1 + (opts.order || 0);
      entry.real.add(mesh);
    }

    if (atlasAplicado) {
      for (const item of geos.topos || []) {
        add(item.geo, materialKit(item.kit, "topo"), `topo-${item.kit}`, {
          cast: false,
          receive: true,
        });
      }
      add(geos.geoParedes || geos.paredes?.[0]?.geo, materialPenhasco(), "faces", {
        cast: true,
        receive: true,
      });
      add(geos.geoLedges, materiais.ledge, "ledges", { cast: false, receive: true });
      geos.geoTops?.dispose();
    } else {
      geos.geoTops?.dispose();
      geos.geoParedes?.dispose();
      for (const item of geos.topos || []) item.geo?.dispose();
      for (const item of geos.paredes || []) item.geo?.dispose();
      geos.geoLedges?.dispose();
    }

    grupoReal.add(entry.real);
    entry.aabb = aabbDoChunk(chunk.cx, chunk.cy, 64);
    entry.alturaMax = 64;
    entry._frustumVisivel = undefined;
    meshesPorChunk.set(key, entry);
    publicarMalha(entry.cubos, "Terreno");
    publicarMalha(entry.real, "Terreno");
    publicarMalha(entry.agua, "Água");
    publicarMalha(entry.espuma, "Água");
    publicarMalha(entry.queda, "Água");
    limparSujo(chunk);
    marcarSombraSuja();
  }

  function reconstruirProps() {
    soltarRegistro(meshProps);
    soltarRegistro(meshPropsCubos);
    if (meshProps) {
      grupoReal.remove(meshProps);
      meshProps.geometry?.dispose();
      meshProps = null;
    }
    if (meshPropsCubos) {
      grupoCubos.remove(meshPropsCubos);
      meshPropsCubos.geometry?.dispose();
      meshPropsCubos = null;
    }
    const geo = construirProps();
    if (!geo) return;
    if (opcoesMalha.real) {
      meshProps = new THREE.Mesh(geo, materiais.props);
      meshProps.name = "props";
      meshProps.castShadow = true;
      meshProps.receiveShadow = true;
      meshProps.renderOrder = 1;
      grupoReal.add(meshProps);
      publicarMalha(meshProps, "Terreno");
    }
    if (opcoesMalha.cubos) {
      const geoCubos = meshProps ? geo.clone() : geo;
      meshPropsCubos = new THREE.Mesh(geoCubos, materiais.props);
      meshPropsCubos.name = "props-cubos";
      meshPropsCubos.castShadow = true;
      meshPropsCubos.receiveShadow = true;
      meshPropsCubos.renderOrder = 1;
      grupoCubos.add(meshPropsCubos);
      publicarMalha(meshPropsCubos, "Terreno");
    } else if (!meshProps) {
      geo.dispose();
    }
    marcarSombraSuja();
  }

  function reconstruirTudo() {
    for (const key of [...meshesPorChunk.keys()]) {
      liberarGrupoChunk(meshesPorChunk.get(key));
      meshesPorChunk.delete(key);
    }
    paraCadaChunk((chunk) => {
      chunk.sujo = true;
      reconstruirChunk(chunk);
    });
    reconstruirProps();
  }

  function reconstruirSujados() {
    const sujos = listarChunksSujos();
    if (!sujos.length) return;
    for (const chunk of sujos) reconstruirChunk(chunk);
  }

  /** Chunk em construção, fatiado entre frames. */
  let trabalhoMalha = null;
  const ORCAMENTO_MALHA_MS = 1;

  /**
   * Gasta no máximo ~1 ms por frame na malha. Um chunk leva vários frames.
   * Prioridade: tela + direção prevista (mesmo score do stream).
   */
  function tickMalha(px = 0, py = 0, _maxChunks = MESH_CHUNKS_POR_FRAME) {
    avancarMateriaisAgua(performance.now() / 1000);
    const t0 = performance.now();
    if (
      trabalhoMalha &&
      (obterChunk(trabalhoMalha.chunk.cx, trabalhoMalha.chunk.cy) !== trabalhoMalha.chunk ||
        (trabalhoMalha.chunk.rev | 0) !== trabalhoMalha.rev)
    ) {
      trabalhoMalha = null;
    }

    const ctxPri =
      obterContextoPrioridade() || {
        px,
        py,
        pcx: Math.floor(px / CHUNK_XZ),
        pcy: Math.floor(py / CHUNK_XZ),
        predX: 0,
        predY: 1,
        predLen: 0,
        aabbTela: null,
      };

    function melhorSujo() {
      const sujos = listarChunksSujos();
      if (!sujos.length) return null;
      let melhor = sujos[0];
      let melhorScore = scoreChunk(melhor.cx, melhor.cy, ctxPri);
      for (let i = 1; i < sujos.length; i++) {
        const s = scoreChunk(sujos[i].cx, sujos[i].cy, ctxPri);
        if (s < melhorScore) {
          melhorScore = s;
          melhor = sujos[i];
        }
      }
      return { chunk: melhor, score: melhorScore };
    }

    // Worker heightfield fica desligado: não tem carimbar/bevel/splat.
    // Mantém generator sync (lote tipado + 1 parede + topos por kit).

    if (trabalhoMalha) {
      const atualScore = scoreChunk(trabalhoMalha.chunk.cx, trabalhoMalha.chunk.cy, ctxPri);
      const cand = melhorSujo();
      if (
        cand &&
        cand.chunk !== trabalhoMalha.chunk &&
        devePreemptar(atualScore, cand.score)
      ) {
        trabalhoMalha = null;
      }
    }

    if (!trabalhoMalha) {
      const cand = melhorSujo();
      if (!cand) return 0;
      const chunk = cand.chunk;
      trabalhoMalha = {
        chunk,
        rev: chunk.rev | 0,
        gen: construirGeosChunk(chunk),
      };
    }
    let passo;
    while (performance.now() - t0 < ORCAMENTO_MALHA_MS) {
      passo = trabalhoMalha.gen.next();
      if (passo.done) break;
    }
    let fechou = 0;
    if (passo && passo.done) {
      const chunk = trabalhoMalha.chunk;
      if (
        obterChunk(chunk.cx, chunk.cy) === chunk &&
        (chunk.rev | 0) === trabalhoMalha.rev
      ) {
        reconstruirChunk(chunk, passo.value);
        fechou = 1;
      }
      trabalhoMalha = null;
    }
    return fechou;
  }

  /**
   * Miolo ao redor de (px,py) já tem chunk e malha limpa — usado no gate do teleporte.
   */
  function mioloMalhaPronto(px = 0, py = 0, raioChunks = 2) {
    const pcx = Math.floor(px / CHUNK_XZ);
    const pcy = Math.floor(py / CHUNK_XZ);
    const lim = raioChunks * raioChunks + 1;
    if (
      trabalhoMalha &&
      (trabalhoMalha.chunk.cx - pcx) * (trabalhoMalha.chunk.cx - pcx) +
        (trabalhoMalha.chunk.cy - pcy) * (trabalhoMalha.chunk.cy - pcy) <=
        lim
    ) {
      return false;
    }
    for (let dy = -raioChunks; dy <= raioChunks; dy++) {
      for (let dx = -raioChunks; dx <= raioChunks; dx++) {
        if (dx * dx + dy * dy > lim) continue;
        const cx = pcx + dx;
        const cy = pcy + dy;
        // Mesmo filtro do stream: chunks fora do overworld nunca carregam.
        if (!chunkDentroDoMundo(cx, cy, CHUNK_XZ)) continue;
        const chunk = obterChunk(cx, cy);
        if (!chunk || chunk.sujo) return false;
        if (!meshesPorChunk.has(`${cx},${cy}`)) return false;
      }
    }
    return true;
  }

  // Só libera unload sync; mesh sujo fica pro tickMalha (evita 11×mesh no stream).
  onDirty((aabb) => {
    if (aabb?.unload) {
      const cx0 = Math.floor(aabb.x0 / CHUNK_XZ);
      const cy0 = Math.floor(aabb.y0 / CHUNK_XZ);
      const key = `${cx0},${cy0}`;
      liberarGrupoChunk(meshesPorChunk.get(key));
      meshesPorChunk.delete(key);
    }
  });

  function aplicarAtlas(novoAtlas) {
    if (!novoAtlas?.terrenoPronto) return false;
    if (texturas) texturas.liberar();
    texturas = criarTexturasTerreno3d(novoAtlas);
    if (!texturas.pronto) return false;
    if (materiais.grama) materiais.grama.dispose();
    if (materiais.terra) materiais.terra.dispose();
    if (materiais.cliff) materiais.cliff.dispose();
    if (materiais.topoAtlas) {
      materiais.topoAtlas.dispose();
      materiais.topoAtlas = null;
    }
    soltarMateriaisKit();
    if (materiais.topoAtlas) {
      materiais.topoAtlas.dispose();
      materiais.topoAtlas = null;
    }
    visuais = novoAtlas;
    montarMateriaisTextura(texturas);
    // Topos: materialKit por kit + pele/splat (sprites). Parede única continua.
    atlasAplicado = true;
    reconstruirTudo();
    return true;
  }

  // build inicial dos chunks já carregados
  reconstruirTudo();
  if (atlas) aplicarAtlas(atlas);

  return {
    grupo,
    mesh: grupoCubos,
    aplicarAtlas,
    aplicarVisual(usarTilesFlag) {
      const real = !!(usarTilesFlag && atlasAplicado);
      const querCubos = !real;
      const mudou =
        modoCubos !== querCubos ||
        opcoesMalha.cubos !== querCubos ||
        opcoesMalha.real !== real;
      modoCubos = querCubos;
      definirOpcoesMalha({ cubos: querCubos, real });
      grupoReal.visible = real;
      grupoCubos.visible = !real;
      if (!real) {
        grupoCubos.traverse((o) => {
          if (o.isMesh && o.name.startsWith("cubos")) {
            o.material = usarTilesFlag ? matCubosSmooth : matCubos;
          }
        });
      }
      // Modo novo sem geometria: suja e remalha no orçamento (não hitch sync).
      if (mudou) {
        paraCadaChunk((chunk) => {
          chunk.sujo = true;
        });
        trabalhoMalha = null;
        reconstruirProps();
      }
    },
    tickMalha,
    atualizarFrustum(cam, foco) {
      atualizarFrustumChunks(cam, meshesPorChunk, foco || { x: 0, y: 0 });
    },
    mioloMalhaPronto,
    /** Texturas de topo já usadas nos blocos. Não descartar daqui. */
    obterTexturasTopo() {
      if (!texturas?.pronto) return null;
      return {
        grama: texturas.grama,
        terra: texturas.terra || texturas.grama,
        doKit: texturaTopoDoKit,
      };
    },
    /** Chunks cujo mesh de blocos já está no grupo visível. */
    chunksExibidos() {
      const set = new Set();
      const cubos = modoCubos && grupoCubos.visible;
      const real = !modoCubos && grupoReal.visible;
      if (!cubos && !real) return set;
      for (const [key, entry] of meshesPorChunk) {
        if (cubos) {
          if (entry.cubos) set.add(key);
        } else if (entry.real.children.length > 0) {
          set.add(key);
        }
      }
      return set;
    },
    reconstruirSujados,
    reconstruirTudo,
    liberar() {
      cancelarMalhaWorker();
      for (const key of [...meshesPorChunk.keys()]) {
        liberarGrupoChunk(meshesPorChunk.get(key));
      }
      meshesPorChunk.clear();
      matCubos.dispose();
      matCubosSmooth.dispose();
      depthCubos.dispose();
      materiais.ledge.dispose();
      materiais.props.dispose();
      materiais.grama?.dispose();
      materiais.terra?.dispose();
      materiais.cliff?.dispose();
      soltarMateriaisKit();
      if (materiais.topoAtlas) {
        materiais.topoAtlas.dispose();
        materiais.topoAtlas = null;
      }
      texturas?.liberar();
      liberarMateriaisAgua();
    },
  };
}
