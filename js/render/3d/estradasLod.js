/**
 * Faixas de estrada nos LODs suave / horizonte.
 * Geometria authored (retas), deck plano; pontes sobre rotas de água.
 */
import * as THREE from "three";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { amostraKanto } from "../../mundo/regiao/amostraKanto.js";
import { BIOMA_KANTO } from "../../mundo/regiao/biomasKanto.js";
import {
  MEIA_LARGURA_FAIXA,
  segmentosEstradaMundo,
} from "../../mundo/regiao/linhasEstrada.js";
import { registrarObjetoCena } from "../../cena/registroCena.js";

const COR_ESTRADA = new THREE.Color(BIOMA_KANTO.caminho.cor);
const ORCAMENTO_MS = 0.45;
const BUILDS_POR_TICK = 3;
const EPS_Y = 0.06;

/**
 * @param {{
 *   id: string,
 *   rotulo?: string,
 *   renderOrder: number,
 *   passoAmostra: number,
 *   prepararMaterial: (mat: THREE.Material) => THREE.Material,
 *   obterAnel: () => { interno: number, externo: number },
 * }} opts
 */
export function criarEstradasLod(opts) {
  const {
    id,
    rotulo = id,
    renderOrder,
    passoAmostra,
    prepararMaterial,
    obterAnel,
  } = opts;

  const grupo = new THREE.Group();
  grupo.name = id;

  const matSolido = prepararMaterial(
    aplicarSombraNuvem(
      new THREE.MeshStandardMaterial({
        color: COR_ESTRADA,
        roughness: 0.9,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    ),
  );

  /** @type {THREE.MeshStandardMaterial} */
  let matAtual = matSolido;
  /** @type {THREE.Texture | null} */
  let mapaDirt = null;

  /** @type {Map<string, THREE.Mesh>} */
  const vivos = new Map();
  /** @type {string[]} */
  let fila = [];
  /** @type {Set<string>} */
  let desejados = new Set();

  let ancoraIx = 1e9;
  let ancoraIy = 1e9;
  let ancoraInterno = -1;
  let ancoraExterno = -1;

  registrarObjetoCena(grupo, {
    id,
    pasta: "Terreno",
    rotulo,
    tipo: "relevo",
  });

  function liberarMesh(mesh) {
    if (!mesh) return;
    mesh.geometry?.dispose();
    grupo.remove(mesh);
  }

  function limparTudo() {
    for (const mesh of vivos.values()) liberarMesh(mesh);
    vivos.clear();
    fila = [];
    desejados = new Set();
    ancoraIx = 1e9;
    ancoraIy = 1e9;
    ancoraInterno = -1;
    ancoraExterno = -1;
  }

  function instalar(seg, geo) {
    if (!geo) {
      const velho = vivos.get(seg.id);
      if (velho) {
        liberarMesh(velho);
        vivos.delete(seg.id);
      }
      return;
    }
    let mesh = vivos.get(seg.id);
    if (!mesh) {
      mesh = new THREE.Mesh(geo, matAtual);
      mesh.name = `estrada-${seg.id}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.renderOrder = renderOrder;
      grupo.add(mesh);
      vivos.set(seg.id, mesh);
      return;
    }
    const antiga = mesh.geometry;
    mesh.geometry = geo;
    mesh.material = matAtual;
    if (antiga && antiga !== geo) antiga.dispose();
  }

  function planejar(px, py, interno, externo) {
    const segs = segmentosEstradaMundo();
    const novo = new Set();
    const novaFila = [];

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const d = Math.hypot(s.mx - px, s.my - py);
      const perto = Math.max(0, d - s.alcance);
      const longe = d + s.alcance;
      if (longe <= interno || perto >= externo) continue;
      novo.add(s.id);
      if (!vivos.has(s.id)) novaFila.push(s.id);
    }

    for (const k of vivos.keys()) {
      if (!novo.has(k)) {
        liberarMesh(vivos.get(k));
        vivos.delete(k);
      }
    }

    desejados = novo;
    const porId = new Map(segs.map((s) => [s.id, s]));
    novaFila.sort((a, b) => {
      const sa = porId.get(a);
      const sb = porId.get(b);
      const da = (sa.mx - px) ** 2 + (sa.my - py) ** 2;
      const db = (sb.mx - px) ** 2 + (sb.my - py) ** 2;
      return da - db;
    });
    fila = novaFila;
  }

  function tick(px, py) {
    const anel = obterAnel();
    const interno = Math.max(0, anel.interno);
    const externo = Math.max(interno, anel.externo);
    if (externo <= 0 || externo <= interno) {
      if (vivos.size || fila.length) limparTudo();
      return;
    }

    const ix = Math.round(px / 16);
    const iy = Math.round(py / 16);
    if (
      ix !== ancoraIx ||
      iy !== ancoraIy ||
      interno !== ancoraInterno ||
      externo !== ancoraExterno
    ) {
      ancoraIx = ix;
      ancoraIy = iy;
      ancoraInterno = interno;
      ancoraExterno = externo;
      planejar(px, py, interno, externo);
    }

    const segs = segmentosEstradaMundo();
    const porId = new Map(segs.map((s) => [s.id, s]));
    const t0 = performance.now();
    let feitos = 0;
    while (fila.length && feitos < BUILDS_POR_TICK && performance.now() - t0 < ORCAMENTO_MS) {
      const k = fila.shift();
      if (!desejados.has(k)) continue;
      const seg = porId.get(k);
      if (!seg) continue;
      instalar(seg, criarGeometriaFaixa(seg, passoAmostra));
      feitos += 1;
    }
  }

  function aplicarTexturas(tex) {
    const nova = tex?.doKit?.("brown-earth") || tex?.terra || null;
    if (nova === mapaDirt) return;
    mapaDirt = nova;
    if (matAtual !== matSolido) matAtual.dispose();
    if (mapaDirt) {
      // Mesmo wrapping do topo dos cubos (não clonar — textura compartilhada).
      mapaDirt.wrapS = THREE.RepeatWrapping;
      mapaDirt.wrapT = THREE.RepeatWrapping;
      matAtual = prepararMaterial(
        aplicarSombraNuvem(
          new THREE.MeshStandardMaterial({
            map: mapaDirt,
            color: 0xffffff,
            roughness: 0.88,
            metalness: 0.02,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          }),
        ),
      );
    } else {
      matAtual = matSolido;
    }
    for (const mesh of vivos.values()) mesh.material = matAtual;
  }

  return {
    mesh: grupo,
    tick,
    aplicarTexturas,
    liberar() {
      limparTudo();
      if (matAtual !== matSolido) matAtual.dispose();
      matSolido.dispose();
    },
  };
}

function alturaDeck(seg, cx, cy) {
  if (seg.ponte) return seg.deck;
  const a = amostraKanto(cx, cy);
  if (a && Number.isFinite(a.h)) return a.h;
  return alturaDoRelevo(cx, cy);
}

function criarGeometriaFaixa(seg, passo) {
  const dx = seg.x1 - seg.x0;
  const dy = seg.y1 - seg.y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return null;

  const tx = dx / len;
  const ty = dy / len;
  const nx = -ty;
  const ny = tx;
  const w = MEIA_LARGURA_FAIXA;
  const nSeg = Math.max(1, Math.ceil(len / Math.max(2, passo)));
  const nVert = (nSeg + 1) * 2;

  const pos = new Float32Array(nVert * 3);
  const nor = new Float32Array(nVert * 3);
  const uv = new Float32Array(nVert * 2);
  const idx = new Uint32Array(nSeg * 6);

  for (let i = 0; i <= nSeg; i++) {
    const t = i / nSeg;
    const cx = seg.x0 + dx * t;
    const cy = seg.y0 + dy * t;
    // Deck plano na largura — evita “V” afundando nas beiradas.
    const h = alturaDeck(seg, cx, cy) + EPS_Y;
    const i0 = i * 2;
    const i1 = i0 + 1;
    const xL = cx + nx * w;
    const yL = cy + ny * w;
    const xR = cx - nx * w;
    const yR = cy - ny * w;
    pos[i0 * 3] = xL;
    pos[i0 * 3 + 1] = h;
    pos[i0 * 3 + 2] = yL;
    pos[i1 * 3] = xR;
    pos[i1 * 3 + 1] = h;
    pos[i1 * 3 + 2] = yR;
    nor[i0 * 3 + 1] = 1;
    nor[i1 * 3 + 1] = 1;
    // Mesmo espaço do suave/blocos: 1 tile por unidade de mundo.
    uv[i0 * 2] = xL;
    uv[i0 * 2 + 1] = -yL;
    uv[i1 * 2] = xR;
    uv[i1 * 2 + 1] = -yR;
  }

  for (let i = 0; i < nSeg; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    const o = i * 6;
    idx[o] = a;
    idx[o + 1] = c;
    idx[o + 2] = b;
    idx[o + 3] = b;
    idx[o + 4] = c;
    idx[o + 5] = d;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
