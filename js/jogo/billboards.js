/** Billboards de berry no outdoor. Não passam pelo atlas da vegetação. */

import * as THREE from "three";
import { ALTURA_BLOCO, BILLBOARD_INCLINACAO } from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { criarAtorCartao, poseAtorCartao } from "../render/3d/billboard/atorCartao.js";
import { BERRIES } from "../wild/catalogo.js";
import { ESTAGIO } from "../wild/estagios.js";
import { estado } from "./estado.js";

const ESCALA = {
  [ESTAGIO.SOLO]: 0.35,
  [ESTAGIO.SEMENTE]: 0.45,
  [ESTAGIO.BROTO]: 0.7,
  [ESTAGIO.ARBUSTO]: 1.05,
  [ESTAGIO.FLOR]: 1.25,
  [ESTAGIO.MADURA]: 1.45,
};

let grupo = null;
const sprites = new Map();

function corDe(plot) {
  if (plot.stage === ESTAGIO.SOLO) return "#8a5a32";
  return BERRIES[plot.berryKey]?.cor || "#3f6212";
}

function textura(cor, estagio) {
  const tela = document.createElement("canvas");
  tela.width = 32;
  tela.height = 48;
  const ctx = tela.getContext("2d");
  ctx.clearRect(0, 0, 32, 48);
  ctx.fillStyle = "#6b4f2a";
  ctx.fillRect(14, 28, 4, 16);
  ctx.fillStyle = cor;
  const h = estagio === ESTAGIO.SOLO ? 8 : 22;
  ctx.beginPath();
  ctx.ellipse(16, 30 - h * 0.4, 10, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(tela);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function garantirGrupo() {
  if (grupo) return grupo;
  const cena = obterCenario3d();
  if (!cena?.scene) return null;
  grupo = new THREE.Group();
  grupo.name = "berries-billboard";
  cena.scene.add(grupo);
  return grupo;
}

function yawInclinacao() {
  const cenario = obterCenario3d();
  const cam = cenario?.camera3d?.cam;
  const pe = cenario?.personagem?.grupo?.position;
  let yaw = 0;
  if (cam && pe) {
    yaw = Math.atan2(cam.position.x - pe.x, cam.position.z - pe.z);
  }
  const blend = cenario?.camera3d?.blend ?? 0;
  const inclinacao = BILLBOARD_INCLINACAO * (1 - blend);
  return { yaw, inclinacao };
}

export function atualizarBillboardsBerry() {
  const pai = garantirGrupo();
  if (!pai) return;
  const { yaw, inclinacao } = yawInclinacao();
  const vistos = new Set();
  for (let i = 0; i < estado.plots.length; i++) {
    const plot = estado.plots[i];
    vistos.add(plot.id);
    let mesh = sprites.get(plot.id);
    const chaveVisual = `${plot.stage}:${plot.berryKey || ""}`;
    if (!mesh || mesh.userData.visual !== chaveVisual) {
      if (mesh) {
        pai.remove(mesh);
        mesh.material.map?.dispose();
        mesh.geometry?.dispose();
        mesh.material.dispose();
      }
      mesh = criarAtorCartao(textura(corDe(plot), plot.stage), {
        nome: "berry-cartao",
        transparent: true,
        depthWrite: false,
        alphaTest: 0.12,
      });
      mesh.userData.visual = chaveVisual;
      sprites.set(plot.id, mesh);
      pai.add(mesh);
    }
    const escala = ESCALA[plot.stage] || 1;
    const base = alturaEm(plot.x, plot.y) * ALTURA_BLOCO;
    poseAtorCartao(mesh, {
      x: plot.x + 0.5,
      y: base,
      z: plot.y + 0.5,
      largura: escala,
      altura: escala * 1.4,
      yaw,
      inclinacao,
      pivotX: 0.5,
      pivotY: 1,
    });
  }
  for (const [id, mesh] of sprites) {
    if (vistos.has(id)) continue;
    pai.remove(mesh);
    mesh.material.map?.dispose();
    mesh.geometry?.dispose();
    mesh.material.dispose();
    sprites.delete(id);
  }
}
