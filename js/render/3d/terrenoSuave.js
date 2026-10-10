import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  CHUNK_XZ,
  PASSO_MALHA_SUAVE,
  RAIO_SUAVE,
  RAIO_SUAVE_MAX,
  RAIO_SUAVE_MIN,
} from "../../config.js";
import { alturaDoRelevo, superficieDoRelevo } from "../../mundo/bioma/catalogo.js";
import { rgbBioma } from "../../mundo/bioma/tinta.js";
import { BLOCO } from "../../mundo/voxel/tiposBloco.js";

let raioAtivo = RAIO_SUAVE;

export function obterRaioSuave() {
  return raioAtivo;
}

export function definirRaioSuave(raio) {
  raioAtivo = Math.max(RAIO_SUAVE_MIN, Math.min(RAIO_SUAVE_MAX, raio | 0));
  return raioAtivo;
}

/** Mesma mistura dos topos de bloco: tile + tinta do bioma. */
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

function materialComTile() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.04,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  misturarTinta(mat, 0.62);
  return atrasDoBloco(mat);
}

/**
 * Relevo espaçado até o raio suave.
 * Some só no miolo dos chunks já desenhados. O anel de fora deles fica por baixo,
 * para o encontro com os blocos não precisar fechar.
 */
export function criarTerrenoSuave() {
  const mats = {
    grama: { cubos: materialSolido(), real: materialComTile() },
    terra: { cubos: materialSolido(), real: materialComTile() },
  };
  const grupo = new THREE.Group();
  grupo.name = "terreno-suave";
  const meshGrama = criarMesh("terreno-suave-grama", mats.grama.cubos);
  const meshTerra = criarMesh("terreno-suave-terra", mats.terra.cubos);
  grupo.add(meshGrama, meshTerra);

  let ancoraX = 1e9;
  let ancoraY = 1e9;
  let ancoraCx = 1e9;
  let ancoraCy = 1e9;
  let raioSuave = -1;
  /** @type {Generator<void, object | null> | null} */
  let trabalho = null;
  /** @type {{grama: object, terra: object} | null} */
  let dados = null;
  let assinatura = null;
  /** Chunks que já estavam na cena no frame anterior. */
  let vistosAntes = new Set();
  let modoReal = false;
  let texturasProntas = false;

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
    dados = novos?.grama?.quads?.length || novos?.terra?.quads?.length ? novos : null;
    assinatura = null;
    trocar(meshGrama, dados?.grama?.quads?.length ? criarGeometria(dados.grama) : null);
    trocar(meshTerra, dados?.terra?.quads?.length ? criarGeometria(dados.terra) : null);
  }

  function aplicarExibidos(estaveis) {
    if (!dados) return;
    const sig = chaveExibidos(estaveis);
    if (sig === assinatura) return;
    assinatura = sig;
    recortar(meshGrama, dados.grama, estaveis);
    recortar(meshTerra, dados.terra, estaveis);
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

  function aplicarTexturas(tex) {
    texturasProntas = !!(tex?.grama);
    mats.grama.real.map = tex?.grama ?? null;
    mats.terra.real.map = tex?.terra || tex?.grama || null;
    mats.grama.real.needsUpdate = true;
    mats.terra.real.needsUpdate = true;
    if (modoReal) aplicarVisual(true);
  }

  function aplicarVisual(usarTilesFlag) {
    const real = !!(usarTilesFlag && texturasProntas);
    if (real === modoReal && meshGrama.material === (real ? mats.grama.real : mats.grama.cubos)) return;
    modoReal = real;
    meshGrama.material = real ? mats.grama.real : mats.grama.cubos;
    meshTerra.material = real ? mats.terra.real : mats.terra.cubos;
  }

  return {
    mesh: grupo,
    tick,
    aplicarTexturas,
    aplicarVisual,
    liberar() {
      trabalho = null;
      dados = null;
      meshGrama.geometry?.dispose();
      meshTerra.geometry?.dispose();
      mats.grama.cubos.dispose();
      mats.grama.real.dispose();
      mats.terra.cubos.dispose();
      mats.terra.real.dispose();
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

/** Mesma escolha do topo do bloco: terra/pedra, ou coluna com 2 ou mais de altura. */
function usaTerraTopo(wx, wy, altura) {
  const id = superficieDoRelevo(wx, wy);
  return id === BLOCO.TERRA || id === BLOCO.PEDRA || altura >= 2;
}

function criarGeometria(parte) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(parte.pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(parte.cor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(parte.uv, 2));
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
  const grama = balde();
  const terra = balde();

  function amostra(wx, wy) {
    const k = `${wx},${wy}`;
    let a = cache.get(k);
    if (a) return a;
    const h = alturaDoRelevo(wx, wy);
    a = { h, cor: rgbBioma(wx, wy, false) };
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
    destino.uv.push(wx, -wy);
    destino.cor.push(a.cor[0], a.cor[1], a.cor[2]);
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
      const media = (hs[0] + hs[1] + hs[2] + hs[3]) * 0.25;
      const destino = usaTerraTopo(x + passo * 0.5, y + passo * 0.5, media) ? terra : grama;
      const i0 = por(destino, x, y);
      const i1 = por(destino, x + passo, y);
      const i2 = por(destino, x, y + passo);
      const i3 = por(destino, x + passo, y + passo);
      destino.quads.push({ i0, i1, i2, i3, chunks: chunksDoQuad(x, y, passo) });
      if ((++feitos & 47) === 0) yield;
    }
  }

  if (!grama.quads.length && !terra.quads.length) return null;
  return { grama, terra };
}

function balde() {
  return { pos: [], cor: [], uv: [], quads: [], mapa: new Map() };
}
