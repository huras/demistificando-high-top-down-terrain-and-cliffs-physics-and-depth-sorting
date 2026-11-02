/**
 * Debug do alcance de grab (Força): ponto do player usado no score,
 * anéis enter/exit, cone de facing e alvos elegíveis.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { marcarAuxiliar } from "../../cena/registroCena.js";
import { visitarVegetacaoNaArea } from "../../mundo/bioma/propsBioma.js";
import {
  PORTAO_CORPO,
  PORTAO_PEDRA,
  facingDe,
} from "../../forca/alcance.js";
import {
  acharAlvoForca,
  ehPropLevantavel,
  listarEntidadesPresentes,
  scoreCorpo,
  scorePedra,
} from "../../forca/alvos.js";
import { alcanceGatePsiquico, temTipoPsiquico } from "../../forca/psiquico.js";

const SEG_ANEL = 48;
const SEG_CONE = 24;
const CAP_ALVO = 48;
const Y_FOLGA = 0.06;

const COR_ENTER = 0x38bdf8;
const COR_EXIT = 0x64748b;
const COR_CLOSE = 0xfbbf24;
const COR_CONE = 0x22d3ee;
const COR_PONTO = 0xf472b6;
const COR_FACING = 0xf472b6;
const COR_ALVO = 0x4ade80;
const COR_STICKY = 0xfacc15;

const COS = new Float32Array(SEG_ANEL);
const SIN = new Float32Array(SEG_ANEL);
for (let s = 0; s < SEG_ANEL; s++) {
  const a = (s / SEG_ANEL) * Math.PI * 2;
  COS[s] = Math.cos(a);
  SIN[s] = Math.sin(a);
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

let grupo = null;
let anelEnter = null;
let anelExit = null;
let anelClose = null;
let posEnter = null;
let posExit = null;
let posClose = null;
let cone = null;
let posCone = null;
let facingLine = null;
let posFacing = null;
let ponto = null;
let alvosDisco = null;
let stickyDisco = null;
let pedido = false;
let ultimo = -1;
/** @type {((n: number) => void) | null} */
let ouvinte = null;

function semRaycast() {}

function criarAnelBuffer(cor, opacity) {
  const pos = new Float32Array(SEG_ANEL * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({
    color: cor,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const linhas = new THREE.LineSegments(geo, mat);
  linhas.frustumCulled = false;
  linhas.renderOrder = 8;
  linhas.raycast = semRaycast;
  return { linhas, pos };
}

function escreverAnel(pos, x, y, z, raio) {
  for (let s = 0; s < SEG_ANEL; s++) {
    const n = (s + 1) % SEG_ANEL;
    const o = s * 6;
    pos[o] = x + COS[s] * raio;
    pos[o + 1] = y;
    pos[o + 2] = z + SIN[s] * raio;
    pos[o + 3] = x + COS[n] * raio;
    pos[o + 4] = y;
    pos[o + 5] = z + SIN[n] * raio;
  }
}

function criarCone() {
  // Fan: centro → arco (SEG_CONE+1 pontos no arco → SEG_CONE triângulos * 3 verts)
  posCone = new Float32Array((SEG_CONE + 2) * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posCone, 3));
  geo.setDrawRange(0, 0);
  const idx = [];
  for (let i = 0; i < SEG_CONE; i++) {
    idx.push(0, 1 + i, 2 + i);
  }
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    color: COR_CONE,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "debug-forca-cone";
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  mesh.raycast = semRaycast;
  return mesh;
}

function escreverCone(x, y, z, fx, fy, reach, towardMin) {
  const angHalf = Math.acos(Math.max(-1, Math.min(1, towardMin)));
  const base = Math.atan2(fx, fy);
  posCone[0] = x;
  posCone[1] = y;
  posCone[2] = z;
  for (let i = 0; i <= SEG_CONE; i++) {
    const t = i / SEG_CONE;
    const a = base - angHalf + t * angHalf * 2;
    // atan2(fx,fy) → mundo: +Y sul = cos, +X leste = sin (mesmo que facing unit)
    const dx = Math.sin(a) * reach;
    const dy = Math.cos(a) * reach;
    const o = (1 + i) * 3;
    posCone[o] = x + dx;
    posCone[o + 1] = y;
    posCone[o + 2] = z + dy;
  }
  cone.geometry.setDrawRange(0, SEG_CONE * 3);
  cone.geometry.attributes.position.needsUpdate = true;
  cone.geometry.computeBoundingSphere();
}

function criarFacing() {
  posFacing = new Float32Array(6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posFacing, 3));
  geo.setDrawRange(0, 2);
  const mat = new THREE.LineBasicMaterial({
    color: COR_FACING,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const line = new THREE.LineSegments(geo, mat);
  line.name = "debug-forca-facing";
  line.frustumCulled = false;
  line.renderOrder = 9;
  line.raycast = semRaycast;
  return line;
}

function criarPonto() {
  const geo = new THREE.SphereGeometry(0.12, 10, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: COR_PONTO,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "debug-forca-ponto";
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.raycast = semRaycast;
  return mesh;
}

function criarDiscoAlvos(cor, name) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: cor,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, CAP_ALVO);
  mesh.name = name;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 8;
  mesh.raycast = semRaycast;
  return mesh;
}

function publicarContagem(n) {
  if (n === ultimo) return;
  ultimo = n;
  ouvinte?.(n);
}

function gatePedra(body) {
  return temTipoPsiquico(body) ? alcanceGatePsiquico(PORTAO_PEDRA) : PORTAO_PEDRA;
}

function gateCorpo(body) {
  return temTipoPsiquico(body) ? alcanceGatePsiquico(PORTAO_CORPO) : PORTAO_CORPO;
}

export function criarDebugForca() {
  grupo = new THREE.Group();
  grupo.name = "debug-forca";
  grupo.visible = pedido;

  const e = criarAnelBuffer(COR_ENTER, 0.95);
  anelEnter = e.linhas;
  anelEnter.name = "debug-forca-enter";
  posEnter = e.pos;
  const x = criarAnelBuffer(COR_EXIT, 0.55);
  anelExit = x.linhas;
  anelExit.name = "debug-forca-exit";
  posExit = x.pos;
  const c = criarAnelBuffer(COR_CLOSE, 0.85);
  anelClose = c.linhas;
  anelClose.name = "debug-forca-close";
  posClose = c.pos;

  cone = criarCone();
  facingLine = criarFacing();
  ponto = criarPonto();
  alvosDisco = criarDiscoAlvos(COR_ALVO, "debug-forca-alvos");
  stickyDisco = criarDiscoAlvos(COR_STICKY, "debug-forca-sticky");

  grupo.add(anelEnter, anelExit, anelClose, cone, facingLine, ponto, alvosDisco, stickyDisco);
  marcarAuxiliar(grupo);
  return grupo;
}

export function definirDebugForca(ativo, aoContar) {
  pedido = !!ativo;
  ouvinte = pedido ? aoContar || null : null;
  if (!pedido) {
    ultimo = -1;
    if (grupo) grupo.visible = false;
    if (alvosDisco) alvosDisco.count = 0;
    if (stickyDisco) stickyDisco.count = 0;
    return;
  }
  if (grupo) grupo.visible = true;
}

/**
 * @param {object | null | undefined} corpo
 */
export function atualizarDebugForca(corpo) {
  if (!grupo || !pedido || !corpo) {
    if (grupo) grupo.visible = false;
    return;
  }
  grupo.visible = true;

  const px = corpo.x;
  const pz = corpo.y;
  const elev = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
  const y = elev + Y_FOLGA;

  const gate = gatePedra(corpo);
  const gateB = gateCorpo(corpo);
  const enterR = Math.max(gate.enterReach, gateB.enterReach);
  const exitR = Math.max(gate.exitReach, gateB.exitReach);
  const closeR = Math.max(gate.enterClose, gateB.enterClose);
  const towardMin = Math.min(gate.enterToward, gateB.enterToward);
  const f = facingDe(corpo, corpo);

  escreverAnel(posEnter, px, y, pz, enterR);
  anelEnter.geometry.setDrawRange(0, SEG_ANEL * 2);
  anelEnter.geometry.attributes.position.needsUpdate = true;

  escreverAnel(posExit, px, y + 0.01, pz, exitR);
  anelExit.geometry.setDrawRange(0, SEG_ANEL * 2);
  anelExit.geometry.attributes.position.needsUpdate = true;

  escreverAnel(posClose, px, y + 0.02, pz, closeR);
  anelClose.geometry.setDrawRange(0, SEG_ANEL * 2);
  anelClose.geometry.attributes.position.needsUpdate = true;

  escreverCone(px, y + 0.015, pz, f.x, f.y, enterR, towardMin);

  const flecha = enterR * 1.05;
  posFacing[0] = px;
  posFacing[1] = y + 0.04;
  posFacing[2] = pz;
  posFacing[3] = px + f.x * flecha;
  posFacing[4] = y + 0.04;
  posFacing[5] = pz + f.y * flecha;
  facingLine.geometry.attributes.position.needsUpdate = true;

  // Ponto de referência do score (= corpo.x/y, pés do player).
  ponto.position.set(px, y + 0.14, pz);
  ponto.visible = true;

  const sticky = acharAlvoForca(corpo, corpo, {});
  let nAlvo = 0;
  let nSticky = 0;
  const pad = exitR + 1.5;

  visitarVegetacaoNaArea(px - pad, pz - pad, px + pad, pz + pad, (p) => {
    if (nAlvo >= CAP_ALVO - 1) return;
    if (!ehPropLevantavel(p)) return;
    const hit = scorePedra(corpo, corpo, p, "enter");
    if (!hit) return;
    const elevP = (p.z ?? 0) * ALTURA_BLOCO;
    const yy = elevP + Y_FOLGA + 0.05;
    const r = Math.max(0.25, p.r > 0 ? p.r : 0.4);
    const ehSticky = sticky?.kind === "rock" && sticky.prop === p;
    _p.set(p.x, yy, p.y);
    _s.set(r, 0.06, r);
    if (ehSticky && nSticky < CAP_ALVO) {
      stickyDisco.setMatrixAt(nSticky, _m.compose(_p, _q, _s));
      nSticky += 1;
    } else {
      alvosDisco.setMatrixAt(nAlvo, _m.compose(_p, _q, _s));
      nAlvo += 1;
    }
  });

  const ents = listarEntidadesPresentes();
  for (let i = 0; i < ents.length; i++) {
    if (nAlvo >= CAP_ALVO - 1) break;
    const e = ents[i];
    const hit = scoreCorpo(corpo, corpo, e, "enter");
    if (!hit) continue;
    const elevE = (e.elevacao ?? e.z ?? 0) * ALTURA_BLOCO;
    const yy = elevE + Y_FOLGA + 0.05;
    const r = Math.max(0.3, e.r || 0.4);
    const ehSticky = sticky?.kind === "faintedWild" && sticky.enemy === e;
    _p.set(e.x, yy, e.y);
    _s.set(r, 0.06, r);
    if (ehSticky && nSticky < CAP_ALVO) {
      stickyDisco.setMatrixAt(nSticky, _m.compose(_p, _q, _s));
      nSticky += 1;
    } else {
      alvosDisco.setMatrixAt(nAlvo, _m.compose(_p, _q, _s));
      nAlvo += 1;
    }
  }

  alvosDisco.count = nAlvo;
  alvosDisco.instanceMatrix.needsUpdate = nAlvo > 0;
  alvosDisco.visible = nAlvo > 0;
  stickyDisco.count = nSticky;
  stickyDisco.instanceMatrix.needsUpdate = nSticky > 0;
  stickyDisco.visible = nSticky > 0;

  publicarContagem(nAlvo + nSticky);
}
