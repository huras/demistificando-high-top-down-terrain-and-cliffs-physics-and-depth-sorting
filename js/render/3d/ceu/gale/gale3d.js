/**
 * Ribbons 3D das rajadas (pool de BufferGeometry).
 */
import * as THREE from "three";
import { ALTURA_PRACA } from "../../../../mundo/regiao/amostraKanto.js";
import { CLIMA_CFG } from "../../../../clima/config.js";
import { obterVentoMundo } from "../../../../clima/amostra.js";
import {
  atualizarCampoGale,
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

const MAX = 28;
const VERTS = (PASSOS_FAIXA + 1) * 2;

function criarFaixa() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(VERTS * 3);
  const idx = [];
  for (let i = 0; i < PASSOS_FAIXA; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe8f4ff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 4;
  return { mesh, pos, geo };
}

/**
 * @param {THREE.Scene|THREE.Group} cena
 */
export function criarGale3d(cena) {
  const estado = criarEstadoGale();
  const faixas = [];
  const grupo = new THREE.Group();
  grupo.name = "gale";
  cena.add(grupo);
  for (let i = 0; i < MAX; i++) {
    const f = criarFaixa();
    grupo.add(f.mesh);
    faixas.push(f);
  }
  const centro = { x: 0, y: 0 };
  const _p = { x: 0, y: 0 };
  const _t = { x: 0, y: 0 };

  function escreverFaixa(slot, r) {
    const v = VARIANTES_GALE[r.varIdx % VARIANTES_GALE.length];
    const ctrl = controleCurva(r.tx, r.ty, r.hx, r.hy, v, r.mx, r.my);
    if (!ctrl) {
      slot.mesh.visible = false;
      return;
    }
    const wMin = CLIMA_CFG.galeHalfWidth ?? 0.11;
    const wMax = CLIMA_CFG.galeHalfWidthMax ?? 0.2;
    const halfBase = Math.min(wMax, wMin + (r.halfLen || 8) * 0.0045);
    const baseZ = ALTURA_PRACA + (r.z || 1.2);
    const arr = slot.pos;
    for (let i = 0; i <= PASSOS_FAIXA; i++) {
      const t = i / PASSOS_FAIXA;
      pontoBezier(r.tx, r.ty, ctrl.cx, ctrl.cy, r.hx, r.hy, t, _p);
      tangenteBezier(r.tx, r.ty, ctrl.cx, ctrl.cy, r.hx, r.hy, t, _t);
      let tl = Math.hypot(_t.x, _t.y) || 1;
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
    const alpha = 0.1 + Math.min(0.22, (r.speed / 48) * 0.2);
    slot.mesh.material.opacity = alpha;
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
    let i = 0;
    for (; i < lista.length && i < faixas.length; i++) escreverFaixa(faixas[i], lista[i]);
    for (; i < faixas.length; i++) faixas[i].mesh.visible = false;
  }

  return { atualizar, grupo };
}
