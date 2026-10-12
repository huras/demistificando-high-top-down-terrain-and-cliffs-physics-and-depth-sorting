import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  ALTURA_BLOCO,
  CHUNK_XZ,
  CHUNK_Y,
  MESH_CHUNKS_POR_FRAME,
  TRONCO_INSET,
} from "../../config.js";
import { colunaAgua, garantirFluxoChunk } from "../../mundo/agua/fluxo.js";
import { PROPS } from "../../mundo/mapaDemo.js";
import { alturaEm, colunaTemArInterno, espessuraTopo } from "../../mundo/altura.js";
import {
  baseTopoEm,
  limparSujo,
  listarChunksSujos,
  obterChunk,
  obterBloco,
  onDirty,
  paraCadaChunk,
} from "../../mundo/voxel/storeMundo.js";
import { BLOCO, ehSolido } from "../../mundo/voxel/tiposBloco.js";
import { registrarObjetoCena, removerObjetoCena } from "../../cena/registroCena.js";
import { hexBioma } from "../../mundo/bioma/tinta.js";
import { kitDoRelevo } from "../../mundo/bioma/catalogo.js";
import { urlPele } from "../../mundo/bioma/detalhe.js";
import { aplicarPeleSplat } from "./peleSplat.js";
import { pecasNoMundo, pesoSplat } from "./peleAutotile.js";
import { PASSOS } from "./pecas/catalogo.js";
import { carimbarBorda, carimbarPlano, planaNo } from "./pecas/carimbar.js";
import { fundirChao } from "./pecas/fundir.js";
import { alturaLocal, gradeDoChunk, mascaraLocal } from "./pecas/mascara.js";
import { obterKit } from "../../mundo/bioma/kits.js";
import {
  avancarMateriaisAgua,
  liberarMateriaisAgua,
  obterMaterialLago,
  obterMaterialQueda,
} from "./texturasAgua3d.js";
import { canvasParaTextura, criarTexturasTerreno3d } from "./texturasTerreno3d.js";

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
 * O terreno suave vem depois e recusa esse pixel, então o bloco fica na frente
 * mesmo quando o suave está mais perto da câmera. Personagem, água e árvore
 * continuam no teste de profundidade normal.
 */
function naFrenteDoSuave(material) {
  if (!material || material.transparent) return material;
  material.depthTest = true;
  material.depthWrite = true;
  material.depthFunc = THREE.LessEqualDepth;
  material.stencilWrite = true;
  material.stencilRef = 1;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
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

function mesclarLista(geos) {
  if (!geos.length) return null;
  const normalizados = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(normalizados, false);
  for (const g of geos) g.dispose();
  for (const g of normalizados) {
    if (!geos.includes(g)) g.dispose();
  }
  return merged;
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

/** Triângulo vertical/inclinado que fecha a mitra do canto convexo. */
function triMitraConvexo(wx, wy, wz, dir, i) {
  const y0 = wz;
  const y1 = wz + 1 - INSET_TOPO;
  if (dir === "se") {
    // P0 canto baixo do ar; TB = topo oeste do bevel S de B; TC = topo norte do bevel E de C
    return triLivre(
      { x: wx + 1, y: y0, z: wy + 1 },
      { x: wx + 1, y: y1, z: wy + 1 - i },
      { x: wx + 1 - i, y: y1, z: wy + 1 },
    );
  }
  if (dir === "sw") {
    return triLivre(
      { x: wx, y: y0, z: wy + 1 },
      { x: wx + i, y: y1, z: wy + 1 },
      { x: wx, y: y1, z: wy + 1 - i },
    );
  }
  if (dir === "ne") {
    return triLivre(
      { x: wx + 1, y: y0, z: wy },
      { x: wx + 1 - i, y: y1, z: wy },
      { x: wx + 1, y: y1, z: wy + i },
    );
  }
  // nw
  return triLivre(
    { x: wx, y: y0, z: wy },
    { x: wx, y: y1, z: wy + i },
    { x: wx + i, y: y1, z: wy },
  );
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
  return {
    pos: [],
    uv: [],
    nor: [],
    cor: comCor ? [] : null,
    splat: comSplat ? [] : null,
    pele: comSplat ? [] : null,
    _splat: 0,
    _rgb: null,
    _n: [0, 1, 0],
  };
}

function empurrarSplat(lote, n) {
  if (!lote.splat) return;
  const v = lote._splat || 0;
  for (let i = 0; i < n; i++) lote.splat.push(v);
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
  lote.pos.push(
    coords[0], coords[1], coords[2],
    coords[3], coords[4], coords[5],
    coords[6], coords[7], coords[8],
    coords[9], coords[10], coords[11],
    coords[12], coords[13], coords[14],
    coords[15], coords[16], coords[17],
  );
  lote.uv.push(uvs[0], uvs[1], uvs[2], uvs[3], uvs[4], uvs[5], uvs[6], uvs[7], uvs[8], uvs[9], uvs[10], uvs[11]);
  const n = lote._n;
  for (let i = 0; i < 6; i++) lote.nor.push(n[0], n[1], n[2]);
  if (lote.cor) {
    const r = lote._rgb ? lote._rgb[0] : 1;
    const g = lote._rgb ? lote._rgb[1] : 1;
    const b = lote._rgb ? lote._rgb[2] : 1;
    for (let i = 0; i < 6; i++) lote.cor.push(r, g, b);
  }
  empurrarSplat(lote, 6);
  if (lote.pele) {
    if (peleUvs) lote.pele.push(...peleUvs);
    else for (let i = 0; i < 12; i++) lote.pele.push(0);
  }
}

function geoDoLote(lote) {
  if (!lote.pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lote.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(lote.uv, 2));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(lote.nor, 3));
  if (lote.cor) geo.setAttribute("color", new THREE.Float32BufferAttribute(lote.cor, 3));
  if (lote.splat && lote.splat.length === lote.pos.length / 3) {
    geo.setAttribute("splat", new THREE.Float32BufferAttribute(lote.splat, 1));
  }
  if (lote.pele && lote.pele.length === (lote.pos.length / 3) * 2) {
    geo.setAttribute("peleUv", new THREE.Float32BufferAttribute(lote.pele, 2));
  }
  return geo;
}

function insetTronco() {
  return Math.max(0, Math.min(0.45, TRONCO_INSET));
}

function pushTri(lote, a, b, c) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
  const ca = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);
  if (ab < 1e-6 || bc < 1e-6 || ca < 1e-6) return;
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
  lote.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  lote.uv.push(0, 0, 1, 0, 0.5, 1);
  const n = lote._n;
  for (let k = 0; k < 3; k++) lote.nor.push(n[0], n[1], n[2]);
  if (lote.cor) {
    const r = lote._rgb ? lote._rgb[0] : 1;
    const g = lote._rgb ? lote._rgb[1] : 1;
    const b = lote._rgb ? lote._rgb[2] : 1;
    for (let k = 0; k < 3; k++) lote.cor.push(r, g, b);
  }
  empurrarSplat(lote, 3);
  if (lote.pele) for (let k = 0; k < 6; k++) lote.pele.push(0);
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
  const geo = geoDoLote(lote);
  if (lote.cor) {
    if (geo) garantirCorBranca(geo);
    for (let i = 0; i < extras.length; i++) garantirCorBranca(extras[i]);
  }
  if (!extras.length) return geo;
  if (geo) extras.push(geo);
  if (lote.splat) {
    for (let i = 0; i < extras.length; i++) {
      const g = extras[i];
      if (g && !g.getAttribute("splat")) comSplat(g, 0);
    }
  }
  return mesclarLista(extras);
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

function subdividirChao(lote, wx, wy, y, x0, z0, x1, z1, peca) {
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

function emitirTopo(lote, wx, wy, y, x0, z0, x1, z1) {
  const pecas = pecasNoMundo(wx, wy);
  if (!pecas) {
    subdividirChao(lote, wx, wy, y, x0, z0, x1, z1, null);
    return;
  }
  for (let i = 0; i < pecas.length; i++) {
    const recorte = clipPeca(pecas[i], x0, z0, x1, z1);
    if (!recorte) continue;
    subdividirChao(lote, wx, wy, y, recorte.x0, recorte.z0, recorte.x1, recorte.z1, recorte);
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
 * Gera geometrias culled-face de um chunk.
 * Sempre gera cubos + real (grupos separados; só um visível) —
 * pular um dos modos deixava faces/cliff faltando após trocar visual / stream.
 */
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
  emitirTopo(loteTop, wx, wy, y1, iW, iN, 1 - iE, 1 - iS);
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

function* construirGeosChunk(chunk) {
  const ledges = [];
  const aguas = [];
  const quedas = [];
  const sacosTopo = new Map();
  const sacosParede = new Map();
  function sacoDe(mapa, kit) {
    let saco = mapa.get(kit);
    if (!saco) {
      saco = { lote: criarLote(true, mapa === sacosTopo), extras: [] };
      mapa.set(kit, saco);
    }
    return saco;
  }
  const loteCubos = criarLote(true);
  const grade = gradeDoChunk(chunk.cx, chunk.cy);
  const nCel = CHUNK_XZ * CHUNK_XZ;
  const alturaCel = new Int16Array(nCel);
  const mascaraCel = new Uint8Array(nCel);
  const simplesCel = new Uint8Array(nCel);
  const fundivel = new Uint8Array(nCel);
  const kitsCel = new Array(nCel);
  garantirFluxoChunk(chunk);
  yield;

  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;

  let _colunas = 0;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      if ((_colunas++ & 7) === 7) yield;
      const wx = baseX + lx;
      const wy = baseY + ly;
      const ia = ly * CHUNK_XZ + lx;
      const kit = kitDoRelevo(wx, wy) || "_";
      const sacoTopo = sacoDe(sacosTopo, kit);
      const sacoParede = sacoDe(sacosParede, kit);
      const loteGrama = sacoTopo.lote;
      const loteTerra = sacoTopo.lote;
      const loteFaces = sacoParede.lote;
      const topsGrama = sacoTopo.extras;
      const topsTerra = sacoTopo.extras;
      const faces = sacoParede.extras;
      const zSurf = alturaLocal(grade, lx, ly);
      alturaCel[ia] = zSurf;
      mascaraCel[ia] = mascaraLocal(grade, lx, ly);
      kitsCel[ia] = kit;
      let colunaSimples = zSurf > 0 && !colunaTemArInterno(wx, wy);
      if (colunaSimples) {
        for (let i = 0; i < LADOS_COL.length; i++) {
          const d = LADOS_COL[i];
          if (colunaTemArInterno(wx + d.dx, wy + d.dy)) {
            colunaSimples = false;
            break;
          }
        }
      }
      simplesCel[ia] = colunaSimples ? 1 : 0;
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
            const loteTop =
              id === BLOCO.TERRA || id === BLOCO.PEDRA || lz + 1 >= 2 ? loteTerra : loteGrama;

            if (ehBordaCliff) {
              empurrarBevel(loteTop, loteFaces, wx, wy, lz, lateraisAr);
            } else if (cortesL.length > 0) {
              // Canto L: corta o topo de A + triângulo de mitra
              const extrasTop = loteTop === loteTerra ? topsTerra : topsGrama;
              for (const t of topoComCortesConvexos(wx, wy, yTopo, cortesL)) {
                extrasTop.push(comSplat(pintarPlano(t, loteTop._rgb), 0));
              }
              for (const c of cortesL) {
                faces.push(pintarPlano(triMitraConvexo(wx, wy, lz, c.dir, c.i), loteFaces._rgb));
              }
            } else {
              pushTopoLote(loteTop, wx, wy, lz + 1);
              for (const lat of lateraisAr) {
                ledges.push(caixaLedge(wx, wy, lz + 1, lat, hexBioma(wx, wy, false), hexBioma(wx, wy, true)));
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

      if (zSurf > 0) {
        let y0 = 0;
        let y1 = Math.max(0.08, zSurf);
        if (colunaTemArInterno(wx, wy)) {
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
        const prof = caindo
          ? Math.max(1, supAgua - (chunk.aguaPiso[ia] | 0))
          : chunk.aguaProf[ia] | 0;
        aguas.push(
          geoSuperficieAgua(
            wx,
            wy,
            supAgua - 0.04,
            chunk.fluxoX[ia] | 0,
            chunk.fluxoY[ia] | 0,
            tintaLago(prof || 1),
          ),
        );
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
          if (supAgua - yBase > 0.15) quedas.push(planoQueda(wx, wy, yBase, supAgua, dir));
        }
      }
    }
  }

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
      sacoDe(sacosTopo, plano.kit).lote,
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
      const sacoTopo = sacoDe(sacosTopo, kit);
      const sacoParede = sacoDe(sacosParede, kit);
      const m = mascaraCel[i];
      const splat = pesoSplat(wx, wy) === 1;
      const plana = m === 0 && planaNo(grade, lx, ly, wx, wy);
      if (plana) {
        emitirTopo(sacoTopo.lote, wx, wy, y, 0, 0, 1, 1);
        continue;
      }
      const { cap } = carimbarBorda(
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
        emitirTopo(sacoTopo.lote, wx, wy, y, cap.x0, cap.z0, cap.x1, cap.z1);
      }
    }
  }

  yield;
  const topos = [];
  for (const [kit, saco] of sacosTopo) {
    const geo = finalizarLote(saco.lote, saco.extras);
    if (geo) topos.push({ kit, geo });
  }
  const paredes = [];
  for (const [kit, saco] of sacosParede) {
    const geo = finalizarLote(saco.lote, saco.extras);
    if (geo) paredes.push({ kit, geo });
  }
  const out = {
    topos,
    paredes,
    geoLedges: mesclarLista(ledges),
    geoCubos: geoDoLote(loteCubos),
    geoAgua: mesclarLista(aguas),
    geoQueda: mesclarLista(quedas),
  };
  return out;
}

function drenarGeosChunk(chunk) {
  const gen = construirGeosChunk(chunk);
  let passo = gen.next();
  while (!passo.done) passo = gen.next();
  return passo.value;
}

/** Malha real de um chunk já instalado no store. A página de faces usa isso. */
export function malharChunk(chunk) {
  return drenarGeosChunk(chunk);
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
    const poste = new THREE.BoxGeometry(0.08, 0.7, 0.08);
    poste.translate(p.x, base + 0.35, p.y);
    pintarVertices(poste, "#c4a060", "#8a6a30");
    out.push(poste);
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
  grupo.scale.set(1, ALTURA_BLOCO, 1);

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
  /** Visual ativo: cubos (didático) vs real (tiles). */
  let modoCubos = true;

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
    if (pronto) return pronto.mat;
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
    return naFrenteDoSuave(mat);
  }

  function materialKit(kit, tipo) {
    if (tipo === "parede") return materialPenhasco();
    const chave = `${tipo}:${kit}`;
    const pronto = materiaisKit.get(chave);
    if (pronto) return pronto.mat;
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
    soltarRegistro(entry.queda);
    soltarRegistro(entry.cubos);
    soltarRegistro(entry.real);
    if (entry.agua) {
      grupoAgua.remove(entry.agua);
      entry.agua.geometry?.dispose();
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

    if (geos.geoAgua) {
      const mesh = new THREE.Mesh(geos.geoAgua, matAgua);
      mesh.name = `agua-${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 2;
      grupoAgua.add(mesh);
      entry.agua = mesh;
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

    function add(geo, mat, nome, opts = {}) {
      if (!geo || !mat) {
        geo?.dispose();
        return;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = nome;
      mesh.castShadow = opts.cast != null ? opts.cast : opts.shadow !== false;
      mesh.receiveShadow = opts.receive != null ? opts.receive : opts.shadow !== false;
      mesh.renderOrder = 1 + (opts.order || 0);
      entry.real.add(mesh);
    }

    if (atlasAplicado) {
      const topos = geos.topos || [];
      const paredes = geos.paredes || [];
      for (let i = 0; i < topos.length; i++) {
        add(topos[i].geo, materialKit(topos[i].kit, "topo"), `tops-${topos[i].kit}`, {
          cast: false,
          receive: true,
        });
      }
      for (let i = 0; i < paredes.length; i++) {
        add(paredes[i].geo, materialKit(paredes[i].kit, "parede"), `faces-${paredes[i].kit}`);
      }
      add(geos.geoLedges, materiais.ledge, "ledges", { cast: false, receive: true });
    } else {
      for (const item of geos.topos || []) item.geo?.dispose();
      for (const item of geos.paredes || []) item.geo?.dispose();
      geos.geoLedges?.dispose();
    }

    grupoReal.add(entry.real);
    meshesPorChunk.set(key, entry);
    publicarMalha(entry.cubos, "Terreno");
    publicarMalha(entry.real, "Terreno");
    publicarMalha(entry.agua, "Água");
    publicarMalha(entry.queda, "Água");
    limparSujo(chunk);
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
    meshProps = new THREE.Mesh(geo, materiais.props);
    meshProps.name = "props";
    meshProps.castShadow = true;
    meshProps.receiveShadow = true;
    meshProps.renderOrder = 1;
    grupoReal.add(meshProps);

    const geo2 = geo.clone();
    meshPropsCubos = new THREE.Mesh(geo2, materiais.props);
    meshPropsCubos.name = "props-cubos";
    meshPropsCubos.castShadow = true;
    meshPropsCubos.receiveShadow = true;
    meshPropsCubos.renderOrder = 1;
    grupoCubos.add(meshPropsCubos);
    publicarMalha(meshProps, "Terreno");
    publicarMalha(meshPropsCubos, "Terreno");
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
  const ORCAMENTO_MALHA_MS = 2;

  /**
   * Gasta no máximo ~2 ms por frame na malha. Um chunk leva vários frames.
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
    if (!trabalhoMalha) {
      const sujos = listarChunksSujos();
      if (!sujos.length) return 0;
      const cx = Math.floor(px / CHUNK_XZ);
      const cy = Math.floor(py / CHUNK_XZ);
      sujos.sort((a, b) => {
        const da = (a.cx - cx) * (a.cx - cx) + (a.cy - cy) * (a.cy - cy);
        const db = (b.cx - cx) * (b.cx - cx) + (b.cy - cy) * (b.cy - cy);
        return da - db;
      });
      const chunk = sujos[0];
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
    soltarMateriaisKit();
    visuais = novoAtlas;
    montarMateriaisTextura(texturas);
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
      modoCubos = !real;
      grupoReal.visible = real;
      grupoCubos.visible = !real;
      if (!real) {
        grupoCubos.traverse((o) => {
          if (o.isMesh && o.name.startsWith("cubos")) {
            o.material = usarTilesFlag ? matCubosSmooth : matCubos;
          }
        });
      }
    },
    tickMalha,
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
      texturas?.liberar();
      liberarMateriaisAgua();
    },
  };
}
