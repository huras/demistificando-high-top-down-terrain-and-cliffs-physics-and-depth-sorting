/**
 * Ribbons 3D das rajadas (pool de BufferGeometry + material compartilhado).
 */
import * as THREE from "three";
import { ALTURA_PRACA } from "../../../../mundo/regiao/amostraKanto.js";
import { CLIMA_CFG } from "../../../../clima/config.js";
import { obterClimaJogo, obterVentoMundo } from "../../../../clima/amostra.js";
import { CLIMA_LOGICO } from "../../../../clima/kinds.js";
import { ventoHud01 } from "../../../../clima/vento.js";
import {
  atualizarCampoGale,
  capacidadePoolGale,
  criarEstadoGale,
  listarRajadas,
} from "./campoGale.js";
import {
  PASSOS_FAIXA,
  VARIANTES_GALE,
  controleCurva,
  perfilLargura,
  pontoBezier,
  tangenteBezier,
} from "./formaGouja.js";

const VERTS = (PASSOS_FAIXA + 1) * 2;

/** Índice compartilhado — mesma topologia para todas as faixas. */
const INDICES = (() => {
  const idx = new Uint16Array(PASSOS_FAIXA * 6);
  for (let i = 0; i < PASSOS_FAIXA; i++) {
    const a = i * 2;
    const o = i * 6;
    idx[o] = a;
    idx[o + 1] = a + 1;
    idx[o + 2] = a + 2;
    idx[o + 3] = a + 1;
    idx[o + 4] = a + 3;
    idx[o + 5] = a + 2;
  }
  return idx;
})();

const INDEX_ATTR = new THREE.BufferAttribute(INDICES, 1);

function criarMaterialBase() {
  return new THREE.MeshBasicMaterial({
    color: 0xe8f4ff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function criarFaixa(matBase) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(VERTS * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(INDEX_ATTR);
  const mesh = new THREE.Mesh(geo, matBase);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 4;
  mesh.matrixAutoUpdate = false;
  return { mesh, pos, geo };
}

/**
 * @param {THREE.Scene|THREE.Group} cena
 */
export function criarGale3d(cena) {
  const estado = criarEstadoGale(CLIMA_CFG);
  const faixas = [];
  const grupo = new THREE.Group();
  grupo.name = "gale";
  grupo.matrixAutoUpdate = false;
  cena.add(grupo);

  const matBase = criarMaterialBase();
  const pool = capacidadePoolGale(CLIMA_CFG);
  for (let i = 0; i < pool; i++) {
    const f = criarFaixa(matBase);
    grupo.add(f.mesh);
    faixas.push(f);
  }

  const centro = { x: 0, y: 0 };
  const _p = { x: 0, y: 0 };
  const _t = { x: 0, y: 0 };
  const wMin = CLIMA_CFG.galeHalfWidth ?? 0.11;
  const wMax = CLIMA_CFG.galeHalfWidthMax ?? 0.2;

  function escreverFaixa(slot, r) {
    const v = VARIANTES_GALE[r.varIdx % VARIANTES_GALE.length];
    const ctrl = controleCurva(r.tx, r.ty, r.hx, r.hy, v, r.mx, r.my);
    if (!ctrl) {
      slot.mesh.visible = false;
      return;
    }
    const halfBase = Math.min(wMax, wMin + (r.halfLen || 8) * 0.0045);
    const baseZ = ALTURA_PRACA + (r.z || 1.2);
    const arr = slot.pos;
    for (let i = 0; i <= PASSOS_FAIXA; i++) {
      const t = i / PASSOS_FAIXA;
      pontoBezier(r.tx, r.ty, ctrl.cx, ctrl.cy, r.hx, r.hy, t, _p);
      tangenteBezier(r.tx, r.ty, ctrl.cx, ctrl.cy, r.hx, r.hy, t, _t);
      const tl = Math.hypot(_t.x, _t.y) || 1;
      const nx = -_t.y / tl;
      const ny = _t.x / tl;
      const w = perfilLargura(t, halfBase);
      const o = i * 2 * 3;
      arr[o] = _p.x + nx * w;
      arr[o + 1] = baseZ;
      arr[o + 2] = _p.y + ny * w;
      arr[o + 3] = _p.x - nx * w;
      arr[o + 4] = baseZ;
      arr[o + 5] = _p.y - ny * w;
    }
    slot.geo.attributes.position.needsUpdate = true;
    slot.mesh.visible = true;
  }

  /**
   * @param {number} dt
   * @param {{ x: number, y: number }} alvo chão
   * @param {boolean} [ligado]
   * @param {number} [raio]
   */
  function atualizar(dt, alvo, ligado = true, raio = 22) {
    if (!ligado || document.hidden) {
      for (let i = 0; i < faixas.length; i++) faixas[i].mesh.visible = false;
      return;
    }
    centro.x = alvo.x;
    centro.y = alvo.y;
    const vento = obterVentoMundo();
    atualizarCampoGale(estado, dt, vento, centro, raio, CLIMA_CFG);
    const lista = listarRajadas(estado);
    const n = Math.min(lista.length, faixas.length);
    let i = 0;
    for (; i < n; i++) escreverFaixa(faixas[i], lista[i]);
    for (; i < faixas.length; i++) faixas[i].mesh.visible = false;

    // Opacidade única no material compartilhado (densidade 2× sem saturar).
    const fill = ventoHud01(vento, CLIMA_CFG);
    const vendaval = obterClimaJogo()?.logicalKind === CLIMA_LOGICO.VENDAVAL;
    matBase.opacity = (0.1 + fill * 0.12) * (vendaval ? 1.45 : 1);
  }

  return { atualizar, grupo };
}
