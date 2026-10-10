import * as THREE from "three";
import {
  CHUNK_XZ,
  PASSO_MALHA_SUAVE,
  RAIO_SUAVE,
  RAIO_SUAVE_MAX,
  RAIO_SUAVE_MIN,
} from "../../config.js";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { rgbBioma } from "../../mundo/bioma/tinta.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";

let raioAtivo = RAIO_SUAVE;

export function obterRaioSuave() {
  return raioAtivo;
}

export function definirRaioSuave(raio) {
  raioAtivo = Math.max(RAIO_SUAVE_MIN, Math.min(RAIO_SUAVE_MAX, raio | 0));
  return raioAtivo;
}

/**
 * Anel de relevo em volta dos chunks. Um vértice a cada PASSO blocos.
 * A malha nova entra aos poucos para não travar o frame.
 */
export function criarTerrenoSuave() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.name = "terreno-suave";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.visible = false;

  let ancoraX = 1e9;
  let ancoraY = 1e9;
  let ancoraCx = 1e9;
  let ancoraCy = 1e9;
  let raioBlocos = -1;
  let raioSuave = -1;
  /** @type {Generator<void, THREE.BufferGeometry | null> | null} */
  let trabalho = null;

  function trocar(geo) {
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

  function tick(px, py) {
    const ax = Math.round(px / PASSO_MALHA_SUAVE) * PASSO_MALHA_SUAVE;
    const ay = Math.round(py / PASSO_MALHA_SUAVE) * PASSO_MALHA_SUAVE;
    const cx = Math.floor(px / CHUNK_XZ);
    const cy = Math.floor(py / CHUNK_XZ);
    const blocos = obterRaioStream();
    const suave = obterRaioSuave();
    if (
      ax !== ancoraX ||
      ay !== ancoraY ||
      cx !== ancoraCx ||
      cy !== ancoraCy ||
      blocos !== raioBlocos ||
      suave !== raioSuave
    ) {
      ancoraX = ax;
      ancoraY = ay;
      ancoraCx = cx;
      ancoraCy = cy;
      raioBlocos = blocos;
      raioSuave = suave;
      trabalho = suave > blocos ? gerarMalha(px, py, blocos, suave) : null;
      if (!trabalho) trocar(null);
    }
    if (!trabalho) return;
    const t0 = performance.now();
    let passo;
    while (performance.now() - t0 < 3) {
      passo = trabalho.next();
      if (passo.done) break;
    }
    if (passo?.done) {
      trocar(passo.value ?? null);
      trabalho = null;
    }
  }

  return {
    mesh,
    tick,
    liberar() {
      trabalho = null;
      mesh.geometry?.dispose();
      material.dispose();
    },
  };
}

function chunkNoDisco(wx, wy, pcx, pcy, raio2) {
  const dx = Math.floor(wx / CHUNK_XZ) - pcx;
  const dy = Math.floor(wy / CHUNK_XZ) - pcy;
  return dx * dx + dy * dy <= raio2;
}

function* gerarMalha(px, py, raioBlocos, raioSuave) {
  const passo = PASSO_MALHA_SUAVE;
  const alcance = raioSuave * CHUNK_XZ;
  const alcance2 = alcance * alcance;
  const pcx = Math.floor(px / CHUNK_XZ);
  const pcy = Math.floor(py / CHUNK_XZ);
  const raio2 = raioBlocos * raioBlocos + 1;
  const x0 = Math.floor((px - alcance) / passo) * passo;
  const y0 = Math.floor((py - alcance) / passo) * passo;
  const x1 = Math.ceil((px + alcance) / passo) * passo;
  const y1 = Math.ceil((py + alcance) / passo) * passo;

  const pos = [];
  const cor = [];
  const idx = [];
  const mapa = new Map();

  function vertice(wx, wy) {
    const k = `${wx},${wy}`;
    let i = mapa.get(k);
    if (i !== undefined) return i;
    i = pos.length / 3;
    mapa.set(k, i);
    const h = alturaDoRelevo(wx, wy);
    const [r, g, b] = rgbBioma(wx, wy, false);
    pos.push(wx, h - 0.05, wy);
    cor.push(r, g, b);
    return i;
  }

  let feitos = 0;
  for (let y = y0; y < y1; y += passo) {
    for (let x = x0; x < x1; x += passo) {
      const mx = x + passo * 0.5 - px;
      const my = y + passo * 0.5 - py;
      if (mx * mx + my * my > alcance2) continue;
      if (chunkNoDisco(x + passo * 0.5, y + passo * 0.5, pcx, pcy, raio2)) continue;
      const i0 = vertice(x, y);
      const i1 = vertice(x + passo, y);
      const i2 = vertice(x, y + passo);
      const i3 = vertice(x + passo, y + passo);
      idx.push(i0, i2, i1, i1, i2, i3);
      if ((++feitos & 47) === 0) yield;
    }
  }

  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cor, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
