import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  CHUNK_XZ,
  PASSO_MALHA_SUAVE,
  RAIO_SUAVE,
  RAIO_SUAVE_MAX,
  RAIO_SUAVE_MIN,
} from "../../config.js";
import { alturaDoRelevo, kitDoRelevo, nivelMarBlocos } from "../../mundo/bioma/catalogo.js";
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

/** Mesmo acabamento do topo do bloco: textura do kit, sem tinta por cima. */
function materialComTile(mapa) {
  return atrasDoBloco(aplicarSombraNuvem(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mapa || null,
    roughness: 0.88,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  })));
}

/**
 * Relevo espaçado até o raio suave.
 * Some só no miolo dos chunks já desenhados. O anel de fora deles fica por baixo,
 * para o encontro com os blocos não precisar fechar.
 */
export function criarTerrenoSuave() {
  const matCubos = materialSolido();
  /** @type {Map<string, THREE.Material>} */
  const reais = new Map();
  /** @type {Map<string, THREE.Mesh>} */
  const malhas = new Map();
  const grupo = new THREE.Group();
  grupo.name = "terreno-suave";
  const matAgua = atrasDoBloco(obterMaterialLagoLonge());
  const meshAgua = criarMesh("terreno-suave-agua", matAgua);
  meshAgua.renderOrder = 3;
  grupo.add(meshAgua);
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
  /** @type {{ kits: Map<string, object>, agua: object } | null} */
  let dados = null;
  /** @type {{ grama?: THREE.Texture, doKit?: (kit: string) => THREE.Texture | null } | null} */
  let fonte = null;
  let assinatura = null;
  /** Chunks que já estavam na cena no frame anterior. */
  let vistosAntes = new Set();
  let modoReal = false;
  let texturasProntas = false;

  function mapaDoKit(kit) {
    return fonte?.doKit?.(kit) || fonte?.grama || null;
  }

  function materialReal(kit) {
    let mat = reais.get(kit);
    if (mat) return mat;
    mat = materialComTile(mapaDoKit(kit));
    reais.set(kit, mat);
    return mat;
  }

  function malhaDoKit(kit) {
    let mesh = malhas.get(kit);
    if (mesh) return mesh;
    mesh = criarMesh(`terreno-suave-${kit}`, matCubos);
    malhas.set(kit, mesh);
    grupo.add(mesh);
    registrarObjetoCena(mesh, {
      id: mesh.name,
      pasta: "Terreno",
      rotulo: mesh.name,
      tipo: "relevo",
    });
    return mesh;
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
    const kits = novos?.kits;
    let temChao = false;
    if (kits) {
      for (const parte of kits.values()) {
        if (parte.quads.length) {
          temChao = true;
          break;
        }
      }
    }
    dados = temChao || novos?.agua?.quads?.length ? novos : null;
    assinatura = null;
    const usados = new Set();
    if (dados?.kits) {
      for (const [kit, parte] of dados.kits) {
        if (!parte.quads.length) continue;
        usados.add(kit);
        const mesh = malhaDoKit(kit);
        trocar(mesh, criarGeometria(parte));
        mesh.material = modoReal ? materialReal(kit) : matCubos;
      }
    }
    for (const [kit, mesh] of malhas) {
      if (!usados.has(kit)) trocar(mesh, null);
    }
    trocar(meshAgua, dados?.agua?.quads?.length ? criarGeometria(dados.agua) : null);
  }

  function aplicarExibidos(estaveis) {
    if (!dados) return;
    const sig = chaveExibidos(estaveis);
    if (sig === assinatura) return;
    assinatura = sig;
    if (dados.kits) {
      for (const [kit, parte] of dados.kits) {
        const mesh = malhas.get(kit);
        if (mesh) recortar(mesh, parte, estaveis);
      }
    }
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
    fonte = tex || null;
    texturasProntas = !!(tex?.doKit || tex?.grama);
    for (const [kit, mat] of reais) {
      mat.map = mapaDoKit(kit);
      mat.needsUpdate = true;
    }
    if (modoReal) aplicarVisual(true);
  }

  function aplicarVisual(usarTilesFlag) {
    const real = !!(usarTilesFlag && texturasProntas);
    if (real === modoReal) return;
    modoReal = real;
    for (const [kit, mesh] of malhas) {
      mesh.material = real ? materialReal(kit) : matCubos;
    }
  }

  return {
    mesh: grupo,
    tick,
    aplicarTexturas,
    aplicarVisual,
    liberar() {
      trabalho = null;
      dados = null;
      for (const mesh of malhas.values()) mesh.geometry?.dispose();
      malhas.clear();
      meshAgua.geometry?.dispose();
      matCubos.dispose();
      for (const mat of reais.values()) mat.dispose();
      reais.clear();
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
  /** @type {Map<string, object>} */
  const kits = new Map();
  const agua = balde();
  const nivel = nivelMarBlocos();

  function baldeKit(kit) {
    let b = kits.get(kit);
    if (!b) {
      b = balde();
      kits.set(kit, b);
    }
    return b;
  }

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
    // Um tile por bloco, igual ao UV 0–1 do topo do cubo.
    destino.uv.push(wx, -wy);
    destino.cor.push(a.cor[0], a.cor[1], a.cor[2]);
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
      const kit = kitDoRelevo(x + passo * 0.5, y + passo * 0.5) || "_";
      const destino = baldeKit(kit);
      const i0 = por(destino, x, y);
      const i1 = por(destino, x + passo, y);
      const i2 = por(destino, x, y + passo);
      const i3 = por(destino, x + passo, y + passo);
      destino.quads.push({ i0, i1, i2, i3, chunks: chunksDoQuad(x, y, passo) });
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

  let temChao = false;
  for (const parte of kits.values()) {
    if (parte.quads.length) {
      temChao = true;
      break;
    }
  }
  if (!temChao && !agua.quads.length) return null;
  return { kits, agua };
}

function balde() {
  return { pos: [], cor: [], uv: [], quads: [], mapa: new Map() };
}
