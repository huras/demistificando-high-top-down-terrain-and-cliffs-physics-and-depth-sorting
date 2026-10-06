import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CHUNK_XZ, CHUNK_Y, MESH_CHUNKS_POR_FRAME } from "../../config.js";
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
function construirGeosChunk(chunk) {
  const topsGrama = [];
  const topsTerra = [];
  const faces = [];
  const ledges = [];
  const aos = [];
  const cubos = [];

  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;

  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      for (let lz = 0; lz < CHUNK_Y; lz++) {
        const id = obterBloco(wx, wy, lz);
        if (!ehSolido(id)) continue;

        for (const d of DIRS) {
          if (!vizinhoAr(wx, wy, lz, d.dx, d.dy, d.dz)) continue;
          const q = quadFace(wx, wy, lz, d.nome);

          if (d.nome === "u") {
            if (id === BLOCO.TERRA || id === BLOCO.PEDRA || lz + 1 >= 2) {
              topsTerra.push(q);
            } else {
              topsGrama.push(q);
            }
            for (const lat of ["s", "n", "e", "w"]) {
              const ld = DIRS.find((x) => x.nome === lat);
              if (vizinhoAr(wx, wy, lz, ld.dx, ld.dy, 0)) {
                ledges.push(caixaLedge(wx, wy, lz + 1, lat));
              }
            }
          } else if (d.nome === "d") {
            // Fundo de overhang — sem isto a câmera 3ª pessoa vê “cavernas”
            faces.push(q);
          } else {
            faces.push(q);
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
    }
  }

  const out = {
    geoGrama: mesclarLista(topsGrama),
    geoTerra: mesclarLista(topsTerra),
    geoFaces: mesclarLista(faces),
    geoLedges: mesclarLista(ledges),
    geoAo: mesclarLista(aos),
    geoCubos: mesclarLista(cubos),
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
