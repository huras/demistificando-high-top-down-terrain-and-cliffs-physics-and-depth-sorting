import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { coresDoTopo } from "../paleta.js";
import { ALTURAS, COLUNAS, LINHAS, PROPS } from "../../mundo/mapaDemo.js";

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

/**
 * Heightmap → mesh mesclada estática (tops + cliffs via extrusão).
 */
export function criarTerrenoMalha() {
  const geos = [];

  for (let cy = 0; cy < LINHAS; cy++) {
    for (let cx = 0; cx < COLUNAS; cx++) {
      const z = ALTURAS[cy][cx] | 0;
      if (z <= 0) continue;

      const h = Math.max(0.08, z);
      const box = new THREE.BoxGeometry(1, h, 1);
      box.translate(cx + 0.5, h * 0.5, cy + 0.5);

      const topo = coresDoTopo(z).a;
      pintarVertices(box, topo, corFacePorZ(z));
      geos.push(box);
    }
  }

  // Props simples (marcadores de leitura no mapa)
  for (const p of PROPS) {
    const zx = Math.floor(p.x);
    const zy = Math.floor(p.y);
    const base =
      zy >= 0 && zy < LINHAS && zx >= 0 && zx < COLUNAS ? ALTURAS[zy][zx] : 1;
    if (p.tipo === "arvore") {
      const tronco = new THREE.CylinderGeometry(0.12, 0.18, 1.1, 6);
      tronco.translate(p.x, base + 0.55, p.y);
      pintarVertices(tronco, "#3d6b2e", "#5a3a22");
      geos.push(tronco);
      const copa = new THREE.ConeGeometry(0.55, 1.2, 7);
      copa.translate(p.x, base + 1.5, p.y);
      pintarVertices(copa, "#4f9e32", "#3d7a28");
      geos.push(copa);
    } else if (p.tipo === "mata") {
      const mata = new THREE.SphereGeometry(0.35, 6, 5);
      mata.translate(p.x, base + 0.3, p.y);
      pintarVertices(mata, "#5aad3a", "#3f7a28");
      geos.push(mata);
    } else if (p.tipo === "pedra") {
      const pedra = new THREE.DodecahedronGeometry(0.28, 0);
      pedra.translate(p.x, base + 0.22, p.y);
      pintarVertices(pedra, "#8a8680", "#5a564e");
      geos.push(pedra);
    } else if (p.tipo === "placa") {
      const poste = new THREE.BoxGeometry(0.08, 0.7, 0.08);
      poste.translate(p.x, base + 0.35, p.y);
      pintarVertices(poste, "#c4a060", "#8a6a30");
      geos.push(poste);
    }
  }

  // Dodecahedron etc. vêm sem index — unifica pra mergeGeometries não retornar null
  const normalizados = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(normalizados, false);
  for (const g of geos) g.dispose();
  for (const g of normalizados) {
    if (!geos.includes(g)) g.dispose();
  }

  if (!merged) {
    throw new Error("Falha ao mesclar geometria do terreno 3D");
  }

  const matCubos = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.04,
    flatShading: true,
  });

  const matReal = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.06,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(merged, matCubos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "terreno";

  return {
    mesh,
    matCubos,
    matReal,
    aplicarVisual(usarTiles) {
      mesh.material = usarTiles ? matReal : matCubos;
    },
    liberar() {
      merged.dispose();
      matCubos.dispose();
      matReal.dispose();
    },
  };
}
