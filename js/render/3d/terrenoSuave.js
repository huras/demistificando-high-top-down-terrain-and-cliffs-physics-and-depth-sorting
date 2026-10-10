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

let raioAtivo = RAIO_SUAVE;

export function obterRaioSuave() {
  return raioAtivo;
}

export function definirRaioSuave(raio) {
  raioAtivo = Math.max(RAIO_SUAVE_MIN, Math.min(RAIO_SUAVE_MAX, raio | 0));
  return raioAtivo;
}

/**
 * Relevo espaçado até o raio suave.
 * O trecho em cima de um chunk de blocos só sai depois que esse mesh já foi desenhado.
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
  let raioSuave = -1;
  /** @type {Generator<void, {pos:number[], cor:number[], quads:object[]} | null> | null} */
  let trabalho = null;
  /** @type {{pos:number[], cor:number[], quads:object[]} | null} */
  let dados = null;
  let assinatura = null;
  /** Chunks que já estavam na cena no frame anterior. */
  let vistosAntes = new Set();

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

  function instalar(novos) {
    dados = novos?.quads?.length ? novos : null;
    assinatura = null;
    if (!dados) {
      trocar(null);
      return;
    }
    trocar(criarGeometria(dados));
  }

  function aplicarExibidos(estaveis) {
    if (!dados) return;
    const sig = chaveExibidos(estaveis);
    if (sig === assinatura) return;
    assinatura = sig;
    const idx = [];
    for (const q of dados.quads) {
      if (quadCoberto(q, estaveis)) continue;
      idx.push(q.i0, q.i2, q.i1, q.i1, q.i2, q.i3);
    }
    if (!idx.length) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.geometry.setIndex(idx);
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
      while (performance.now() - t0 < 3) {
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
  }

  return {
    mesh,
    tick,
    liberar() {
      trabalho = null;
      dados = null;
      mesh.geometry?.dispose();
      material.dispose();
    },
  };
}

function chaveExibidos(set) {
  if (!set.size) return "";
  return [...set].sort().join("|");
}

function quadCoberto(quad, estaveis) {
  if (!quad.chunks.length) return false;
  for (let i = 0; i < quad.chunks.length; i++) {
    if (!estaveis.has(quad.chunks[i])) return false;
  }
  return true;
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

function criarGeometria(dados) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(dados.pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(dados.cor, 3));
  const todos = [];
  for (const q of dados.quads) todos.push(q.i0, q.i2, q.i1, q.i1, q.i2, q.i3);
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

  const pos = [];
  const cor = [];
  const quads = [];
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
      const i0 = vertice(x, y);
      const i1 = vertice(x + passo, y);
      const i2 = vertice(x, y + passo);
      const i3 = vertice(x + passo, y + passo);
      quads.push({ i0, i1, i2, i3, chunks: chunksDoQuad(x, y, passo) });
      if ((++feitos & 47) === 0) yield;
    }
  }

  if (!quads.length) return null;
  return { pos, cor, quads };
}
