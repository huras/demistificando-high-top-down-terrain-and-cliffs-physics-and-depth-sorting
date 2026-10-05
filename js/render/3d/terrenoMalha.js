import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { coresDoTopo } from "../paleta.js";
import { alturaEm } from "../../mundo/altura.js";
import { ALTURAS, COLUNAS, LINHAS, PROPS } from "../../mundo/mapaDemo.js";
import { criarTexturasTerreno3d } from "./texturasTerreno3d.js";

const LEDGE_H = 0.14;
const LEDGE_W = 0.2;
const AO_OPACITY = 0.32;
const AO_QUEDA_MIN = 2;

const DIRS = [
  { dx: 0, dy: 1, nome: "s" },
  { dx: 0, dy: -1, nome: "n" },
  { dx: 1, dy: 0, nome: "e" },
  { dx: -1, dy: 0, nome: "w" },
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

/** Plano horizontal XZ com UV 0–1. */
function planoTopo(cx, cy, z) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx + 0.5, z, cy + 0.5);
  return geo;
}

/**
 * Quad vertical entre yBaixo e yAlto.
 * Face sul (+Z), norte (−Z), leste (+X), oeste (−X).
 */
function planoFace(cx, cy, yBaixo, yAlto, dir) {
  const h = Math.max(0.05, yAlto - yBaixo);
  const midY = (yBaixo + yAlto) * 0.5;
  const geo = new THREE.PlaneGeometry(1, h);
  // UV: u 0–1, v 0–h (repeat por unidade de altura)
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, u, v * h);
  }
  uv.needsUpdate = true;

  if (dir === "s") {
    geo.translate(cx + 0.5, midY, cy + 1);
  } else if (dir === "n") {
    geo.rotateY(Math.PI);
    geo.translate(cx + 0.5, midY, cy);
  } else if (dir === "e") {
    geo.rotateY(-Math.PI / 2);
    geo.translate(cx + 1, midY, cy + 0.5);
  } else {
    geo.rotateY(Math.PI / 2);
    geo.translate(cx, midY, cy + 0.5);
  }
  return geo;
}

function caixaLedge(cx, cy, z, dir) {
  let geo;
  if (dir === "s") {
    geo = new THREE.BoxGeometry(1, LEDGE_H, LEDGE_W);
    geo.translate(cx + 0.5, z - LEDGE_H * 0.5, cy + 1 - LEDGE_W * 0.5);
  } else if (dir === "n") {
    geo = new THREE.BoxGeometry(1, LEDGE_H, LEDGE_W);
    geo.translate(cx + 0.5, z - LEDGE_H * 0.5, cy + LEDGE_W * 0.5);
  } else if (dir === "e") {
    geo = new THREE.BoxGeometry(LEDGE_W, LEDGE_H, 1);
    geo.translate(cx + 1 - LEDGE_W * 0.5, z - LEDGE_H * 0.5, cy + 0.5);
  } else {
    geo = new THREE.BoxGeometry(LEDGE_W, LEDGE_H, 1);
    geo.translate(cx + LEDGE_W * 0.5, z - LEDGE_H * 0.5, cy + 0.5);
  }
  pintarVertices(geo, "#c4a574", "#8a6a40");
  return geo;
}

function planoAo(cx, cy, yChao, dir, queda) {
  const profundidade = Math.min(0.55, 0.22 + queda * 0.06);
  const geo = new THREE.PlaneGeometry(0.92, profundidade);
  geo.rotateX(-Math.PI / 2);
  const y = yChao + 0.015;
  if (dir === "s") geo.translate(cx + 0.5, y, cy + 1 + profundidade * 0.5);
  else if (dir === "n") geo.translate(cx + 0.5, y, cy - profundidade * 0.5);
  else if (dir === "e") {
    geo.rotateY(Math.PI / 2);
    geo.translate(cx + 1 + profundidade * 0.5, y, cy + 0.5);
  } else {
    geo.rotateY(Math.PI / 2);
    geo.translate(cx - profundidade * 0.5, y, cy + 0.5);
  }
  return geo;
}

function construirCubos() {
  const geos = [];

  for (let cy = 0; cy < LINHAS; cy++) {
    for (let cx = 0; cx < COLUNAS; cx++) {
      const z = ALTURAS[cy][cx] | 0;
      if (z <= 0) continue;
      const h = Math.max(0.08, z);
      const box = new THREE.BoxGeometry(1, h, 1);
      box.translate(cx + 0.5, h * 0.5, cy + 0.5);
      pintarVertices(box, coresDoTopo(z).a, corFacePorZ(z));
      geos.push(box);
    }
  }

  for (const p of PROPS) {
    const geo = geoProp(p);
    if (geo) geos.push(...geo);
  }

  const merged = mesclarLista(geos);
  if (!merged) throw new Error("Falha ao mesclar geometria do terreno 3D (cubos)");
  return merged;
}

function geoProp(p) {
  const zx = Math.floor(p.x);
  const zy = Math.floor(p.y);
  const base =
    zy >= 0 && zy < LINHAS && zx >= 0 && zx < COLUNAS ? ALTURAS[zy][zx] : 1;
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

function construirTexturizado() {
  const topsGrama = [];
  const topsTerra = [];
  const faces = [];
  const ledges = [];
  const aos = [];
  const props = [];

  for (let cy = 0; cy < LINHAS; cy++) {
    for (let cx = 0; cx < COLUNAS; cx++) {
      const z = ALTURAS[cy][cx] | 0;
      if (z <= 0) continue;

      const topo = planoTopo(cx, cy, z);
      if (z >= 2) topsTerra.push(topo);
      else topsGrama.push(topo);

      for (const { dx, dy, nome } of DIRS) {
        const zn = alturaEm(cx + dx, cy + dy);
        const queda = z - zn;
        if (queda <= 0) continue;
        faces.push(planoFace(cx, cy, zn, z, nome));
        ledges.push(caixaLedge(cx, cy, z, nome));
        if (queda >= AO_QUEDA_MIN && zn > 0) {
          aos.push(planoAo(cx, cy, zn, nome, queda));
        }
      }
    }
  }

  for (const p of PROPS) {
    const geo = geoProp(p);
    if (geo) props.push(...geo);
  }

  return {
    geoGrama: mesclarLista(topsGrama),
    geoTerra: mesclarLista(topsTerra),
    geoFaces: mesclarLista(faces),
    geoLedges: mesclarLista(ledges),
    geoAo: mesclarLista(aos),
    geoProps: mesclarLista(props),
  };
}

/**
 * Heightmap → grupo com modo cubos (didático) e modo texturizado (HD-2D).
 * @param {object} [atlas]
 */
export function criarTerrenoMalha(atlas = null) {
  const grupo = new THREE.Group();
  grupo.name = "terreno";

  const geoCubos = construirCubos();
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

  const meshCubos = new THREE.Mesh(geoCubos, matCubos);
  meshCubos.castShadow = true;
  meshCubos.receiveShadow = true;
  meshCubos.name = "terreno-cubos";
  grupo.add(meshCubos);

  const grupoReal = new THREE.Group();
  grupoReal.name = "terreno-real";
  grupoReal.visible = false;
  grupo.add(grupoReal);

  const geosReal = construirTexturizado();
  const materiais = {
    grama: null,
    terra: null,
    cliff: null,
    ledge: new THREE.MeshStandardMaterial({
      color: 0xa67c52,
      roughness: 0.85,
      metalness: 0.05,
      vertexColors: true,
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

  const meshesReal = [];

  function addMesh(geo, mat, nome, { shadow = true, order = 0 } = {}) {
    if (!geo || !mat) return null;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = nome;
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    mesh.renderOrder = order;
    grupoReal.add(mesh);
    meshesReal.push(mesh);
    return mesh;
  }

  let texturas = null;
  let atlasAplicado = false;

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
      side: THREE.DoubleSide,
    });
  }

  function limparMeshesReal() {
    for (const m of meshesReal) {
      grupoReal.remove(m);
    }
    meshesReal.length = 0;
  }

  function reconstruirComTexturas(tex) {
    limparMeshesReal();
    if (materiais.grama) materiais.grama.dispose();
    if (materiais.terra) materiais.terra.dispose();
    if (materiais.cliff) materiais.cliff.dispose();
    montarMateriaisTextura(tex);

    addMesh(geosReal.geoGrama, materiais.grama, "tops-grama");
    addMesh(geosReal.geoTerra, materiais.terra, "tops-terra");
    addMesh(geosReal.geoFaces, materiais.cliff, "faces-cliff");
    addMesh(geosReal.geoLedges, materiais.ledge, "ledges");
    addMesh(geosReal.geoAo, materiais.ao, "ao", { shadow: false, order: 1 });
    addMesh(geosReal.geoProps, materiais.props, "props");
  }

  function aplicarAtlas(novoAtlas) {
    if (!novoAtlas?.terrenoPronto) return false;
    if (texturas) texturas.liberar();
    texturas = criarTexturasTerreno3d(novoAtlas);
    if (!texturas.pronto) return false;
    reconstruirComTexturas(texturas);
    atlasAplicado = true;
    return true;
  }

  if (atlas) aplicarAtlas(atlas);

  return {
    grupo,
    mesh: meshCubos,
    aplicarAtlas,
    aplicarVisual(usarTilesFlag) {
      const real = !!(usarTilesFlag && atlasAplicado);
      grupoReal.visible = real;
      meshCubos.visible = !real;
      if (!real) {
        meshCubos.material = usarTilesFlag ? matCubosSmooth : matCubos;
      }
    },
    liberar() {
      geoCubos.dispose();
      matCubos.dispose();
      matCubosSmooth.dispose();
      for (const g of Object.values(geosReal)) g?.dispose();
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
