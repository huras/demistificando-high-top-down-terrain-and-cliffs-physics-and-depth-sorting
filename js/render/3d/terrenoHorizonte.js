/**
 * LOD2: anel terraced longe do player (silhueta BOTW).
 * Chunks grossos, orçamento por frame, stencil atrás dos voxels.
 */
import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  CHUNK_HORIZONTE,
  CHUNK_XZ,
  PASSO_HORIZONTE,
  QUANT_ALTURA_HORIZONTE,
  RAIO_HORIZONTE,
  RAIO_HORIZONTE_MAX,
  RAIO_HORIZONTE_MIN,
} from "../../config.js";
import { alturaDoRelevo, nivelMarBlocos } from "../../mundo/bioma/catalogo.js";
import { rgbBioma } from "../../mundo/bioma/tinta.js";
import { amostraKanto, dentroDoKanto } from "../../mundo/regiao/amostraKanto.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { obterRaioSuave } from "./terrenoSuave.js";
import { criarGeometriaTerraced } from "./geometriaTerraced.js";
import { registrarObjetoCena } from "../../cena/registroCena.js";

const ORCAMENTO_MS = 0.7;
const BUILDS_POR_TICK = 2;

let raioAtivo = RAIO_HORIZONTE;
let revisaoHorizonte = 0;

export function obterRaioHorizonte() {
  return raioAtivo;
}

export function discoHorizonteAtivo() {
  return raioAtivo > 0;
}

export function revisaoDiscoHorizonte() {
  return revisaoHorizonte;
}

export function definirRaioHorizonte(raio) {
  const anterior = raioAtivo;
  raioAtivo = Math.max(RAIO_HORIZONTE_MIN, Math.min(RAIO_HORIZONTE_MAX, raio | 0));
  if ((anterior > 0) !== (raioAtivo > 0) || anterior !== raioAtivo) revisaoHorizonte += 1;
  return raioAtivo;
}

/** Alcance externo em blocos (raio em unidades de CHUNK_XZ). */
export function alcanceHorizonteBlocos() {
  return raioAtivo * CHUNK_XZ;
}

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

function materialHorizonte() {
  return atrasDoBloco(
    aplicarSombraNuvem(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.02,
        vertexColors: true,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 3,
        polygonOffsetUnits: 3,
      }),
    ),
  );
}

function quantizar(h) {
  const q = QUANT_ALTURA_HORIZONTE;
  if (q <= 0) return h;
  return Math.round(h / q) * q;
}

function amostraAltura(wx, wy) {
  if (dentroDoKanto(wx, wy)) {
    const a = amostraKanto(wx, wy);
    if (a && Number.isFinite(a.h)) return quantizar(a.h);
  }
  return quantizar(alturaDoRelevo(wx, wy));
}

function amostraCor(wx, wy, h, nivel) {
  const rgb = rgbBioma(wx, wy, false);
  if (h < nivel) {
    const t = Math.min(1, (nivel - h) / 6);
    return [
      rgb[0] * (1 - t) + 0.12 * t,
      rgb[1] * (1 - t) + 0.28 * t,
      rgb[2] * (1 - t) + 0.48 * t,
    ];
  }
  return rgb;
}

function chaveChunk(hx, hy) {
  return `${hx},${hy}`;
}

export function criarTerrenoHorizonte() {
  const grupo = new THREE.Group();
  grupo.name = "terreno-horizonte";
  const material = materialHorizonte();
  /** @type {Map<string, THREE.Mesh>} */
  const vivos = new Map();
  /** @type {string[]} */
  let fila = [];
  /** @type {Set<string>} */
  let desejados = new Set();

  let ancoraHx = 1e9;
  let ancoraHy = 1e9;
  let ancoraRaio = -1;
  let ancoraInterno = -1;
  let pxRef = 0;
  let pyRef = 0;

  registrarObjetoCena(grupo, {
    id: "terreno-horizonte",
    pasta: "Terreno",
    rotulo: "horizonte terraced",
    tipo: "relevo",
  });

  function raioInternoBlocos() {
    const stream = obterRaioStream() * CHUNK_XZ;
    const suave = obterRaioSuave() * CHUNK_XZ;
    return Math.max(stream, suave, PASSO_HORIZONTE);
  }

  function limparTudo() {
    for (const mesh of vivos.values()) {
      mesh.geometry?.dispose();
      grupo.remove(mesh);
    }
    vivos.clear();
    fila = [];
    desejados = new Set();
    ancoraHx = 1e9;
    ancoraHy = 1e9;
    ancoraRaio = -1;
  }

  function descartar(chave) {
    const mesh = vivos.get(chave);
    if (!mesh) return;
    mesh.geometry?.dispose();
    grupo.remove(mesh);
    vivos.delete(chave);
  }

  function montarChunk(hx, hy) {
    const passo = PASSO_HORIZONTE;
    const lado = CHUNK_HORIZONTE;
    const ox = hx * lado;
    const oy = hy * lado;
    // Passo deve dividir o lado — senão sobra faixa sem malha entre chunks.
    const nx = Math.max(1, Math.round(lado / passo));
    const ny = nx;
    const interno = raioInternoBlocos();
    const interno2 = interno * interno;
    const externo = alcanceHorizonteBlocos();
    const externo2 = externo * externo;
    const nivel = nivelMarBlocos();

    // Grade (nx+1)²: cantos das células + borda leste/sul (vizinho do próximo chunk).
    const alturas = new Float32Array((nx + 1) * (ny + 1));
    const cores = new Float32Array(nx * ny * 3);
    /** Célula no anel (não fura canto compartilhado — evita buraco na grade). */
    const viva = new Uint8Array(nx * ny);
    let celulas = 0;

    for (let cy = 0; cy <= ny; cy++) {
      for (let cx = 0; cx <= nx; cx++) {
        const wx = ox + cx * passo;
        const wy = oy + cy * passo;
        alturas[cy * (nx + 1) + cx] = amostraAltura(wx, wy);
      }
    }

    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        const wx = ox + cx * passo + passo * 0.5;
        const wy = oy + cy * passo + passo * 0.5;
        const dx = wx - pxRef;
        const dy = wy - pyRef;
        const d2 = dx * dx + dy * dy;
        const iCor = (cy * nx + cx) * 3;
        if (d2 < interno2 || d2 > externo2) {
          cores[iCor] = 0;
          cores[iCor + 1] = 0;
          cores[iCor + 2] = 0;
          continue;
        }
        const h = alturas[cy * (nx + 1) + cx];
        if (!Number.isFinite(h)) continue;
        viva[cy * nx + cx] = 1;
        const rgb = amostraCor(wx, wy, h, nivel);
        cores[iCor] = rgb[0];
        cores[iCor + 1] = rgb[1];
        cores[iCor + 2] = rgb[2];
        celulas += 1;
      }
    }

    if (!celulas) return null;

    // Marca mortas só na altura da própria célula (cópia), sem apagar canto do vizinho.
    const alturasGeo = alturas.slice();
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        if (!viva[cy * nx + cx]) alturasGeo[cy * (nx + 1) + cx] = NaN;
      }
    }

    return criarGeometriaTerraced(alturasGeo, cores, { ox, oy, passo, nx, ny });
  }

  function instalar(chave, geo) {
    if (!geo) {
      descartar(chave);
      return;
    }
    let mesh = vivos.get(chave);
    if (!mesh) {
      mesh = new THREE.Mesh(geo, material);
      mesh.name = `horizonte-${chave}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.renderOrder = 1;
      grupo.add(mesh);
      vivos.set(chave, mesh);
    } else {
      const antiga = mesh.geometry;
      mesh.geometry = geo;
      if (antiga && antiga !== geo) antiga.dispose();
    }
    mesh.visible = true;
  }

  function planejar(px, py) {
    const lado = CHUNK_HORIZONTE;
    const hx0 = Math.floor(px / lado);
    const hy0 = Math.floor(py / lado);
    const externo = alcanceHorizonteBlocos();
    const margem = Math.ceil(externo / lado) + 1;
    const interno = raioInternoBlocos();
    const novoDesejado = new Set();
    const novaFila = [];

    for (let hy = hy0 - margem; hy <= hy0 + margem; hy++) {
      for (let hx = hx0 - margem; hx <= hx0 + margem; hx++) {
        const cx = (hx + 0.5) * lado;
        const cy = (hy + 0.5) * lado;
        const dx = cx - px;
        const dy = cy - py;
        const d = Math.hypot(dx, dy);
        // Chunk inteiramente dentro do furo interno: pula.
        if (d + lado * 0.71 < interno) continue;
        // Chunk longe demais: pula.
        if (d - lado * 0.71 > externo) continue;
        const k = chaveChunk(hx, hy);
        novoDesejado.add(k);
        if (!vivos.has(k)) novaFila.push(k);
      }
    }

    for (const k of vivos.keys()) {
      if (!novoDesejado.has(k)) descartar(k);
    }

    // Rebuild de chunks já vivos quando a âncora mudou (furo se move).
    if (ancoraRaio >= 0) {
      for (const k of novoDesejado) {
        if (vivos.has(k) && !novaFila.includes(k)) novaFila.push(k);
      }
    }

    desejados = novoDesejado;
    novaFila.sort((a, b) => {
      const [ax, ay] = a.split(",").map(Number);
      const [bx, by] = b.split(",").map(Number);
      const dax = (ax + 0.5) * lado - px;
      const day = (ay + 0.5) * lado - py;
      const dbx = (bx + 0.5) * lado - px;
      const dby = (by + 0.5) * lado - py;
      return dax * dax + day * day - (dbx * dbx + dby * dby);
    });
    fila = novaFila;
  }

  function tick(px, py) {
    if (!discoHorizonteAtivo()) {
      if (vivos.size || fila.length) limparTudo();
      return;
    }

    pxRef = px;
    pyRef = py;
    const lado = CHUNK_HORIZONTE;
    const hx = Math.floor(px / lado);
    const hy = Math.floor(py / lado);
    const raio = obterRaioHorizonte();
    const interno = raioInternoBlocos();

    if (hx !== ancoraHx || hy !== ancoraHy || raio !== ancoraRaio || interno !== ancoraInterno) {
      ancoraHx = hx;
      ancoraHy = hy;
      ancoraRaio = raio;
      ancoraInterno = interno;
      planejar(px, py);
    }

    const t0 = performance.now();
    let feitos = 0;
    while (fila.length && feitos < BUILDS_POR_TICK && performance.now() - t0 < ORCAMENTO_MS) {
      const k = fila.shift();
      if (!desejados.has(k)) continue;
      const [chx, chy] = k.split(",").map(Number);
      const geo = montarChunk(chx, chy);
      instalar(k, geo);
      feitos += 1;
    }
  }

  return {
    mesh: grupo,
    tick,
    liberar() {
      limparTudo();
      material.dispose();
    },
  };
}
