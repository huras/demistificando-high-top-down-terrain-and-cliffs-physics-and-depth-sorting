import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  CHUNK_XZ,
  CHUNK_Y,
  MESH_CHUNKS_POR_FRAME,
  TRONCO_INSET,
} from "../../config.js";
import { rgbAgua } from "../../mundo/agua/amostra.js";
import { colunaAgua, garantirFluxoChunk } from "../../mundo/agua/fluxo.js";
import { PROPS } from "../../mundo/mapaDemo.js";
import { alturaEm, colunaTemArInterno, espessuraTopo } from "../../mundo/altura.js";
import {
  baseTopoEm,
  limparSujo,
  listarChunksSujos,
  obterBloco,
  onDirty,
  paraCadaChunk,
} from "../../mundo/voxel/storeMundo.js";
import { BLOCO, ehSolido } from "../../mundo/voxel/tiposBloco.js";
import { coresDoTopo } from "../paleta.js";
import { criarTexturasTerreno3d } from "./texturasTerreno3d.js";

const LEDGE_H = 0.12;
const AO_OPACITY = 0.32;
const AO_QUEDA_MIN = 2;
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

function corFacePorZ(z) {
  if (z <= 1) return "#6e4a2e";
  if (z <= 3) return "#8b6340";
  if (z <= 8) return "#a67c52";
  return "#9a9088";
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

function caixaLedge(wx, wy, wzTopo, dir) {
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
  pintarVertices(geo, "#c4a574", "#8a6a40");
  return geo;
}

function planoAo(wx, wy, yChao, dir, queda) {
  const profundidade = Math.min(0.55, 0.22 + queda * 0.06);
  const geo = new THREE.PlaneGeometry(0.92, profundidade);
  geo.rotateX(-Math.PI / 2);
  const y = yChao + 0.015;
  if (dir === "s") geo.translate(wx + 0.5, y, wy + 1 + profundidade * 0.5);
  else if (dir === "n") geo.translate(wx + 0.5, y, wy - profundidade * 0.5);
  else if (dir === "e") {
    geo.rotateY(Math.PI / 2);
    geo.translate(wx + 1 + profundidade * 0.5, y, wy + 0.5);
  } else {
    geo.rotateY(Math.PI / 2);
    geo.translate(wx - profundidade * 0.5, y, wy + 0.5);
  }
  return geo;
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
function texturaCorrenteAgua() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#d7f4ff";
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 8, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexDeRgb(r, g, b) {
  const h = (n) => (n | 0).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
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

function planoQueda(wx, wy, y0, y1, dir, cor) {
  const h = Math.max(0.2, y1 - y0);
  const geo = new THREE.PlaneGeometry(1, h);
  orientarUvFluxo(geo, 0, 1);
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
  pintarVertices(geo, cor, cor);
  return geo;
}

function construirGeosChunk(chunk) {
  const topsGrama = [];
  const topsTerra = [];
  const faces = [];
  const ledges = [];
  const aos = [];
  const cubos = [];
  const aguas = [];
  garantirFluxoChunk(chunk);

  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;

  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      for (let lz = 0; lz < CHUNK_Y; lz++) {
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
            const pushTop = (geo) => {
              if (id === BLOCO.TERRA || id === BLOCO.PEDRA || lz + 1 >= 2) {
                topsTerra.push(geo);
              } else {
                topsGrama.push(geo);
              }
            };

            if (ehBordaCliff) {
              const bevel = geoBevelBorda(wx, wy, lz, lateraisAr);
              pushTop(bevel.top);
              for (const latGeo of bevel.laterais) faces.push(latGeo);
            } else if (cortesL.length > 0) {
              // Canto L: corta o topo de A + triângulo de mitra
              for (const t of topoComCortesConvexos(wx, wy, yTopo, cortesL)) {
                pushTop(t);
              }
              for (const c of cortesL) {
                faces.push(triMitraConvexo(wx, wy, lz, c.dir, c.i));
              }
            } else {
              pushTop(quadFace(wx, wy, lz, "u"));
              for (const lat of lateraisAr) {
                ledges.push(caixaLedge(wx, wy, lz + 1, lat));
              }
            }
          } else if (d.nome === "d") {
            faces.push(quadFace(wx, wy, lz, "d"));
          } else {
            // Lateral da borda já veio no bevel inclinado
            if (ehBordaCliff && lateraisAr.includes(d.nome)) {
              const vizSurf = alturaEm(wx + d.dx, wy + d.dy);
              const queda = lz + 1 - vizSurf;
              if (queda >= AO_QUEDA_MIN && vizSurf > 0) {
                aos.push(planoAo(wx, wy, vizSurf, d.nome, queda));
              }
              continue;
            }
            faces.push(quadFace(wx, wy, lz, d.nome));
            const vizSurf = alturaEm(wx + d.dx, wy + d.dy);
            const queda = lz + 1 - vizSurf;
            if (queda >= AO_QUEDA_MIN && vizSurf > 0) {
              aos.push(planoAo(wx, wy, vizSurf, d.nome, queda));
            }
          }
        }
      }

      const zSurf = alturaEm(wx, wy);
      if (zSurf > 0) {
        // Overhang: laje fina na altura do deck; coluna sólida: pilar 0→surf.
        let h;
        let yCentro;
        if (colunaTemArInterno(wx, wy)) {
          h = Math.max(0.08, espessuraTopo(wx, wy));
          const base = baseTopoEm(wx, wy);
          yCentro = (base < 0 ? zSurf - h : base) + h * 0.5;
        } else {
          h = Math.max(0.08, zSurf);
          yCentro = h * 0.5;
        }
        const box = new THREE.BoxGeometry(1, h, 1);
        box.translate(wx + 0.5, yCentro, wy + 0.5);
        pintarVertices(box, coresDoTopo(zSurf).a, corFacePorZ(zSurf));
        cubos.push(box);
      }

      const ia = ly * CHUNK_XZ + lx;
      const supAgua = chunk.aguaSuperficie[ia] | 0;
      if (supAgua > 0) {
        const caindo = chunk.aguaCaindo[ia] === 1;
        const prof = caindo
          ? Math.max(1, supAgua - (chunk.aguaPiso[ia] | 0))
          : chunk.aguaProf[ia] | 0;
        const rgb = rgbAgua(prof || 1);
        const cor = hexDeRgb(rgb.r, rgb.g, rgb.b);
        aguas.push(
          geoSuperficieAgua(
            wx,
            wy,
            supAgua - 0.04,
            chunk.fluxoX[ia] | 0,
            chunk.fluxoY[ia] | 0,
            cor,
          ),
        );
        if (caindo) {
          const y0 = chunk.aguaPiso[ia] | 0;
          for (const d of DIRS) {
            if (d.dz !== 0) continue;
            const viz = colunaAgua(wx + d.dx, wy + d.dy);
            if (viz.caindo) continue;
            aguas.push(planoQueda(wx, wy, y0, supAgua, d.nome, cor));
          }
        }
      }
    }
  }

  const out = {
    geoGrama: mesclarLista(topsGrama),
    geoTerra: mesclarLista(topsTerra),
    geoFaces: mesclarLista(faces),
    geoLedges: mesclarLista(ledges),
    geoAo: mesclarLista(aos),
    geoCubos: mesclarLista(cubos),
    geoAgua: mesclarLista(aguas),
  };
  return out;
}

function geoProp(p) {
  const base = alturaEm(Math.floor(p.x), Math.floor(p.y));
  const out = [];
  if (p.tipo === "arvore") {
    const tronco = new THREE.CylinderGeometry(0.12, 0.18, 1.1, 6);
    tronco.translate(p.x, base + 0.55, p.y);
    pintarVertices(tronco, "#3d6b2e", "#5a3a22");
    out.push(tronco);
    const copa = new THREE.ConeGeometry(0.55, 1.2, 7);
    copa.translate(p.x, base + 1.5, p.y);
    pintarVertices(copa, "#4f9e32", "#3d7a28");
    out.push(copa);
  } else if (p.tipo === "mata") {
    const mata = new THREE.SphereGeometry(0.35, 6, 5);
    mata.translate(p.x, base + 0.3, p.y);
    pintarVertices(mata, "#5aad3a", "#3f7a28");
    out.push(mata);
  } else if (p.tipo === "pedra") {
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

  const texCorrente = texturaCorrenteAgua();
  const matAgua = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texCorrente,
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    roughness: 0.18,
    metalness: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const matCubos = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.04,
    flatShading: true,
  });
  const matCubosSmooth = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.06,
    flatShading: false,
  });

  const materiais = {
    grama: null,
    terra: null,
    cliff: null,
    ledge: new THREE.MeshStandardMaterial({
      color: 0xa67c52,
      roughness: 0.85,
      metalness: 0.05,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    ao: new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: AO_OPACITY,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    props: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.04,
      flatShading: true,
    }),
  };

  /** @type {Map<string, {cubos:THREE.Mesh, real:THREE.Group}>} */
  const meshesPorChunk = new Map();
  let meshProps = null;
  let meshPropsCubos = null;
  let texturas = null;
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
  }

  function liberarGrupoChunk(entry) {
    if (!entry) return;
    if (entry.agua) {
      grupoAgua.remove(entry.agua);
      entry.agua.geometry?.dispose();
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

  function reconstruirChunk(chunk) {
    const key = `${chunk.cx},${chunk.cy}`;
    liberarGrupoChunk(meshesPorChunk.get(key));
    meshesPorChunk.delete(key);

    const geos = construirGeosChunk(chunk);
    const entry = { cubos: null, real: new THREE.Group() };
    entry.real.name = `chunk-real-${key}`;

    if (geos.geoCubos) {
      const mesh = new THREE.Mesh(geos.geoCubos, matCubos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `cubos-${key}`;
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

    function add(geo, mat, nome, opts = {}) {
      if (!geo || !mat) {
        geo?.dispose();
        return;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = nome;
      mesh.castShadow = opts.shadow !== false;
      mesh.receiveShadow = opts.shadow !== false;
      mesh.renderOrder = opts.order || 0;
      entry.real.add(mesh);
    }

    if (atlasAplicado) {
      add(geos.geoGrama, materiais.grama, "tops-grama");
      add(geos.geoTerra, materiais.terra, "tops-terra");
      add(geos.geoFaces, materiais.cliff, "faces-cliff");
      add(geos.geoLedges, materiais.ledge, "ledges");
      add(geos.geoAo, materiais.ao, "ao", { shadow: false, order: 1 });
    } else {
      geos.geoGrama?.dispose();
      geos.geoTerra?.dispose();
      geos.geoFaces?.dispose();
      geos.geoLedges?.dispose();
      geos.geoAo?.dispose();
    }

    grupoReal.add(entry.real);
    meshesPorChunk.set(key, entry);
    limparSujo(chunk);
  }

  function reconstruirProps() {
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
    grupoReal.add(meshProps);

    const geo2 = geo.clone();
    meshPropsCubos = new THREE.Mesh(geo2, materiais.props);
    meshPropsCubos.name = "props-cubos";
    meshPropsCubos.castShadow = true;
    meshPropsCubos.receiveShadow = true;
    grupoCubos.add(meshPropsCubos);
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

  /**
   * Rebuild orçado — 1 chunk/frame perto do jogador (stream não trava o frame).
   */
  function tickMalha(px = 0, py = 0, maxChunks = MESH_CHUNKS_POR_FRAME) {
    texCorrente.offset.x = (performance.now() * 0.00035) % 1;
    const sujos = listarChunksSujos();
    if (!sujos.length) return 0;
    const cx = Math.floor(px / CHUNK_XZ);
    const cy = Math.floor(py / CHUNK_XZ);
    sujos.sort((a, b) => {
      const da = (a.cx - cx) * (a.cx - cx) + (a.cy - cy) * (a.cy - cy);
      const db = (b.cx - cx) * (b.cx - cx) + (b.cy - cy) * (b.cy - cy);
      return da - db;
    });
    let n = 0;
    const lim = Math.max(1, maxChunks | 0);
    for (const chunk of sujos) {
      if (n >= lim) break;
      reconstruirChunk(chunk);
      n++;
    }
    return n;
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
    reconstruirSujados,
    reconstruirTudo,
    liberar() {
      for (const key of [...meshesPorChunk.keys()]) {
        liberarGrupoChunk(meshesPorChunk.get(key));
      }
      meshesPorChunk.clear();
      matCubos.dispose();
      matCubosSmooth.dispose();
      materiais.ledge.dispose();
      materiais.ao.dispose();
      materiais.props.dispose();
      materiais.grama?.dispose();
      materiais.terra?.dispose();
      materiais.cliff?.dispose();
      texturas?.liberar();
    },
  };
}
