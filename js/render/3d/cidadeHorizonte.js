/**
 * Impostores de cidade no anel do horizonte: cubos pelos volumes +
 * quadradinhos de janela emissivos à noite. Sem OBJ, sem luz real, sem suave.
 */
import * as THREE from "three";
import { CHUNK_XZ, ESCALA_Y_CASA_REF } from "../../config.js";
import { deLocalKanto } from "../../mundo/bounds.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { fatorYSobRelevo } from "./escalaVertical.js";
import { montarLayout } from "../../mundo/regiao/volumesCidade.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { obterRaioHorizonte, discoHorizonteAtivo } from "./terrenoHorizonte.js";
import { obterHora } from "./ceu/controleCeu.js";
import { obterPesoNoite } from "./luzes/pool.js";
import { intensidadeJanela } from "./luzes/janelasCasa.js";

const CENTRO_LOCAL = 64;
const COR_JANELA = new THREE.Color(0xb9d7ff);
const COR_APAGADA = new THREE.Color(0x000000);

const COR_PAPEL = Object.freeze({
  casa: 0xc4a882,
  centro: 0xc45c5c,
  loja: 0x6a8fbf,
  lab: 0x9aa3ad,
  ginasio: 0x8b6b4a,
  museu: 0xb8a078,
  torre: 0x6e5a72,
  porto: 0x7a8b9a,
  safari: 0x6f9a5a,
  ruina: 0x5a5a62,
  coliseu: 0xa09070,
  mansao: 0xd0c4a8,
});

const JANELA_W = 0.35;
const JANELA_H = 0.45;
const JANELA_Y = 0.55;
const JANELA_EPS = 0.04;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, "YXZ");
const _cor = new THREE.Color();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

function corDoPapel(papel) {
  return COR_PAPEL[papel] || COR_PAPEL.casa;
}

/** Face do volume que olha pra praça (centro 64,64). */
function facePraPraca(v) {
  const mx = (v.x0 + v.x1) * 0.5;
  const my = (v.y0 + v.y1) * 0.5;
  const dx = CENTRO_LOCAL - mx;
  const dy = CENTRO_LOCAL - my;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const leste = dx > 0;
    return {
      eixo: "x",
      x: leste ? v.x1 : v.x0,
      z0: v.y0,
      z1: v.y1,
      yaw: leste ? -Math.PI / 2 : Math.PI / 2,
    };
  }
  const sul = dy > 0;
  return {
    eixo: "z",
    z: sul ? v.y1 : v.y0,
    x0: v.x0,
    x1: v.x1,
    yaw: sul ? 0 : Math.PI,
  };
}

function escreverCaixa(lista, ox, oy, v, cor, cidadeKey, indice) {
  const sx = Math.max(0.2, v.x1 - v.x0);
  const sz = Math.max(0.2, v.y1 - v.y0);
  // v.altura já vem de alturaDoPapel (escala o REF); desfaz REF→mundo via fator do baseline.
  const sy = Math.max(0.5, v.altura || 5) * fatorYSobRelevo(ESCALA_Y_CASA_REF);
  const mx = (v.x0 + v.x1) * 0.5;
  const mz = (v.y0 + v.y1) * 0.5;
  _p.set(ox + mx, ALTURA_PRACA + sy * 0.5, oy + mz);
  _q.identity();
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  lista.push({
    cidadeKey,
    matriz: _m.clone(),
    cor,
    dono: `${cidadeKey}:${indice}`,
  });
}

function escreverJanelas(lista, ox, oy, v, cidadeKey, indice) {
  const sy = Math.max(0.5, v.altura || 5) * fatorYSobRelevo(ESCALA_Y_CASA_REF);
  const face = facePraPraca(v);
  const y = ALTURA_PRACA + sy * JANELA_Y;
  const span = face.eixo === "x" ? face.z1 - face.z0 : face.x1 - face.x0;
  const n = span >= 4 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0.5 : (k + 1) / (n + 1);
    let wx;
    let wz;
    if (face.eixo === "x") {
      wx = ox + face.x + (face.yaw < 0 ? JANELA_EPS : -JANELA_EPS);
      wz = oy + face.z0 + span * t;
    } else {
      wx = ox + face.x0 + span * t;
      wz = oy + face.z + (face.yaw === 0 ? JANELA_EPS : -JANELA_EPS);
    }
    _p.set(wx, y, wz);
    _e.set(0, face.yaw, 0);
    _q.setFromEuler(_e);
    _s.set(JANELA_W, JANELA_H, 1);
    _m.compose(_p, _q, _s);
    lista.push({
      cidadeKey,
      matriz: _m.clone(),
      dono: `${cidadeKey}:${indice}:j${k}`,
    });
  }
}

function assarCidades() {
  /** @type {{ key: string, cx: number, cy: number, iCorpo: number, nCorpo: number, iJan: number, nJan: number }[]} */
  const cidades = [];
  const corpos = [];
  const janelas = [];

  for (let i = 0; i < CIDADES_KANTO.length; i++) {
    const def = CIDADES_KANTO[i];
    const layout = montarLayout(def);
    const origem = deLocalKanto(def.ax * AREA_KANTO, def.ay * AREA_KANTO);
    const ox = origem.x;
    const oy = origem.y;
    const iCorpo = corpos.length;
    const iJan = janelas.length;
    const volumes = layout.volumes;
    for (let v = 0; v < volumes.length; v++) {
      const vol = volumes[v];
      escreverCaixa(corpos, ox, oy, vol, corDoPapel(vol.papel), def.key, v);
      escreverJanelas(janelas, ox, oy, vol, def.key, v);
    }
    cidades.push({
      key: def.key,
      cx: ox + CENTRO_LOCAL,
      cy: oy + CENTRO_LOCAL,
      iCorpo,
      nCorpo: corpos.length - iCorpo,
      iJan,
      nJan: janelas.length - iJan,
      /** null = ainda não aplicou matriz (boot deixa tudo montado). */
      visivel: null,
    });
  }
  return { cidades, corpos, janelas };
}

function montarInstanced(geo, mat, itens, nome) {
  const n = Math.max(1, itens.length);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = nome;
  mesh.count = itens.length;
  mesh.frustumCulled = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  for (let i = 0; i < itens.length; i++) {
    mesh.setMatrixAt(i, itens[i].matriz);
    if (itens[i].cor != null) {
      _cor.setHex(itens[i].cor);
      mesh.setColorAt(i, _cor);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (itens.length) {
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius *= 1.05;
  }
  return mesh;
}

/**
 * @returns {{ grupo: THREE.Group, tick: (px: number, py: number) => void, dispose: () => void }}
 */
export function criarCidadeHorizonte() {
  const grupo = new THREE.Group();
  grupo.name = "cidade-horizonte";
  grupo.visible = false;

  const assado = assarCidades();
  const { cidades, corpos, janelas } = assado;

  const matCorpo = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const matJanela = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    fog: true,
  });

  const geoCorpo = new THREE.BoxGeometry(1, 1, 1);
  const geoJanela = new THREE.PlaneGeometry(1, 1);
  const meshCorpo = montarInstanced(geoCorpo, matCorpo, corpos, "cidade-hz-corpos");
  const meshJanela = montarInstanced(geoJanela, matJanela, janelas, "cidade-hz-janelas");
  meshJanela.renderOrder = 2;

  // Cores iniciais das janelas (apagadas até o 1º tick noturno).
  for (let i = 0; i < janelas.length; i++) {
    meshJanela.setColorAt(i, COR_APAGADA);
  }
  if (meshJanela.instanceColor) meshJanela.instanceColor.needsUpdate = true;

  if (corpos.length) grupo.add(meshCorpo);
  if (janelas.length) grupo.add(meshJanela);

  let faixaJanela = -1;
  let pesoAplicado = -1;

  function aplicarVisibilidadeCidade(c, visivel) {
    if (c.visivel === visivel) return false;
    c.visivel = visivel;
    const mat = visivel ? null : _zero;
    for (let i = 0; i < c.nCorpo; i++) {
      const idx = c.iCorpo + i;
      meshCorpo.setMatrixAt(idx, visivel ? corpos[idx].matriz : mat);
    }
    for (let i = 0; i < c.nJan; i++) {
      const idx = c.iJan + i;
      meshJanela.setMatrixAt(idx, visivel ? janelas[idx].matriz : mat);
    }
    return true;
  }

  function atualizarJanelas(peso) {
    matJanela.opacity = peso;
    if (peso <= 0.02) {
      meshJanela.visible = false;
      pesoAplicado = peso;
      return;
    }
    meshJanela.visible = janelas.length > 0;
    const hora = obterHora();
    const faixa = Math.floor(hora * 2);
    if (faixa === faixaJanela && pesoAplicado >= 0) {
      pesoAplicado = peso;
      return;
    }
    faixaJanela = faixa;
    pesoAplicado = peso;
    for (let i = 0; i < janelas.length; i++) {
      const alvo = intensidadeJanela(janelas[i].dono, hora).intensidade;
      if (alvo <= 0) meshJanela.setColorAt(i, COR_APAGADA);
      else meshJanela.setColorAt(i, _cor.copy(COR_JANELA).multiplyScalar(alvo));
    }
    if (meshJanela.instanceColor) meshJanela.instanceColor.needsUpdate = true;
  }

  function tick(px, py) {
    if (!discoHorizonteAtivo() || (!corpos.length && !janelas.length)) {
      grupo.visible = false;
      return;
    }
    const alcanceNear = (obterRaioStream() + 2) * CHUNK_XZ + 96;
    const alcanceHz = obterRaioHorizonte() * CHUNK_XZ;
    const limNear = alcanceNear * alcanceNear;
    const limHz = alcanceHz * alcanceHz;
    let qualquer = false;
    let sujouMatriz = false;
    for (let i = 0; i < cidades.length; i++) {
      const c = cidades[i];
      const dx = px - c.cx;
      const dy = py - c.cy;
      const d2 = dx * dx + dy * dy;
      const visivel = d2 > limNear && d2 <= limHz;
      if (visivel) qualquer = true;
      if (aplicarVisibilidadeCidade(c, visivel)) sujouMatriz = true;
    }
    grupo.visible = qualquer;
    if (sujouMatriz) {
      meshCorpo.instanceMatrix.needsUpdate = true;
      meshJanela.instanceMatrix.needsUpdate = true;
    }
    atualizarJanelas(obterPesoNoite());
  }

  function dispose() {
    grupo.remove(meshCorpo);
    grupo.remove(meshJanela);
    geoCorpo.dispose();
    geoJanela.dispose();
    matCorpo.dispose();
    matJanela.dispose();
  }

  return { grupo, tick, dispose };
}
