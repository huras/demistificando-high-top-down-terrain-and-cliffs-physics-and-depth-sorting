/** Canteiros outdoor: terra arada procedural + estágios GBA da berry. */

import * as THREE from "three";
import { ALTURA_BLOCO, BILLBOARD_INCLINACAO } from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { aplicarPivoCartao, poseAtorCartao } from "../render/3d/billboard/atorCartao.js";
import { materialCartao } from "../render/3d/billboard/material.js";
import { aplicarSombraNuvem } from "../render/3d/ceu/sombraNuvem.js";
import {
  ESCALA_ARBUSTO,
  estagioEhTileBaixo,
  garantirFolhaBerry,
  imagemArbusto,
  quadroArbusto,
} from "../render/3d/folhaBerry.js";
import { ESTAGIO, estaUmido } from "../wild/estagios.js";
import { estado } from "./estado.js";

/** Escalas alinhadas ao Pokémon AI (tile 16 → mundo). */
const ESCALA = {
  [ESTAGIO.SEMENTE]: 0.55,
  [ESTAGIO.BROTO]: 0.85,
  [ESTAGIO.ARBUSTO]: 1.05,
  [ESTAGIO.FLOR]: 1.1,
  [ESTAGIO.MADURA]: ESCALA_ARBUSTO,
};

const LIFT_SOLO = 0.04;

let grupo = null;
/** @type {Map<string, { solo: THREE.Mesh, planta: THREE.Mesh | null, visual: string }>} */
const atores = new Map();
/** @type {THREE.BufferGeometry | null} */
let geoSolo = null;
let texSoloSeco = null;
let texSoloUmido = null;
/** @type {Map<string, THREE.CanvasTexture>} */
const texPlanta = new Map();
let folhaPedida = false;

function geoSoloChao() {
  if (geoSolo) return geoSolo;
  geoSolo = new THREE.PlaneGeometry(0.92, 0.92);
  geoSolo.rotateX(-Math.PI / 2);
  return geoSolo;
}

/** Soft soil com sulcos — fica sob a planta em todos os estágios. */
function texturaSoloProcedural(umido) {
  const tela = document.createElement("canvas");
  tela.width = 32;
  tela.height = 32;
  const ctx = tela.getContext("2d");
  const base = umido ? "#3d2818" : "#6b4426";
  const sulco = umido ? "#2a1a10" : "#4a2e18";
  const borda = umido ? "#241408" : "#3a2414";
  const claro = umido ? "#5a3c24" : "#8a5a32";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = borda;
  ctx.fillRect(0, 0, 32, 2);
  ctx.fillRect(0, 30, 32, 2);
  ctx.fillRect(0, 0, 2, 32);
  ctx.fillRect(30, 0, 2, 32);
  ctx.strokeStyle = sulco;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 6 + i * 5;
    ctx.beginPath();
    ctx.moveTo(3, y);
    ctx.lineTo(29, y + ((i & 1) === 0 ? 1 : -1));
    ctx.stroke();
  }
  ctx.fillStyle = claro;
  for (let n = 0; n < 18; n++) {
    const x = 4 + ((n * 7) % 24);
    const y = 4 + ((n * 11) % 24);
    ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(tela);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mapaSolo(umido) {
  if (umido) {
    if (!texSoloUmido) texSoloUmido = texturaSoloProcedural(true);
    return texSoloUmido;
  }
  if (!texSoloSeco) texSoloSeco = texturaSoloProcedural(false);
  return texSoloSeco;
}

function texturaDaFolha(chave, estagio, quadro) {
  const img = imagemArbusto(chave, estagio, quadro);
  if (!img) return null;
  const id = `${chave || "_"}:${estagio}:${quadro}:${img.width}x${img.height}`;
  let tex = texPlanta.get(id);
  if (tex) return tex;
  tex = new THREE.CanvasTexture(img);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  texPlanta.set(id, tex);
  return tex;
}

function criarPatchSolo(umido) {
  // Standard + sombraNuvem: recebe sol/céu do ciclo (Basic ficava “aceso” de noite).
  const mat = aplicarSombraNuvem(
    new THREE.MeshStandardMaterial({
      map: mapaSolo(umido),
      roughness: 1,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const mesh = new THREE.Mesh(geoSoloChao(), mat);
  mesh.name = "canteiro-solo";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.raycast = () => {};
  return mesh;
}

function criarPlanta(mapa) {
  const mat = aplicarSombraNuvem(
    materialCartao(mapa, {
      transparent: true,
      depthWrite: false,
      alphaTest: 0.12,
    }),
  );
  const mesh = new THREE.Mesh(
    // geo trocada em aplicarPivoCartao / poseAtorCartao
    new THREE.PlaneGeometry(1, 1),
    mat,
  );
  mesh.name = "berry-cartao";
  mesh.rotation.order = "YXZ";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 3;
  mesh.userData.pivotKey = "";
  aplicarPivoCartao(mesh, 0.5, 1);
  return mesh;
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
  const cam3d = cenario?.camera3d;
  const blend = Math.max(cam3d?.blend ?? 0, cam3d?.folgaTeleporte ?? 0);
  const inclinacao = BILLBOARD_INCLINACAO * (1 - blend);
  return { yaw, inclinacao };
}

function liberarPlanta(ator, pai) {
  if (!ator.planta) return;
  pai.remove(ator.planta);
  ator.planta.geometry?.dispose();
  ator.planta.material.dispose();
  ator.planta = null;
}

function liberarAtor(id, pai) {
  const ator = atores.get(id);
  if (!ator) return;
  liberarPlanta(ator, pai);
  pai.remove(ator.solo);
  ator.solo.material.dispose();
  atores.delete(id);
}

export function atualizarBillboardsBerry() {
  const pai = garantirGrupo();
  if (!pai) return;
  if (!folhaPedida) {
    folhaPedida = true;
    garantirFolhaBerry();
  }
  const { yaw, inclinacao } = yawInclinacao();
  const agora = Date.now();
  const quadro = quadroArbusto(performance.now());
  const vistos = new Set();

  for (let i = 0; i < estado.plots.length; i++) {
    const plot = estado.plots[i];
    vistos.add(plot.id);
    const umido = estaUmido(plot, agora);
    const chaveVisual =
      plot.stage === ESTAGIO.SOLO
        ? `solo:${umido ? 1 : 0}`
        : `${plot.stage}:${plot.berryKey || ""}:${quadro}:${umido ? 1 : 0}`;
    let ator = atores.get(plot.id);

    if (!ator) {
      const solo = criarPatchSolo(umido);
      ator = { solo, planta: null, visual: "" };
      atores.set(plot.id, ator);
      pai.add(solo);
    }

    if (ator.visual !== chaveVisual) {
      ator.solo.material.map = mapaSolo(umido);
      ator.solo.material.needsUpdate = true;

      if (plot.stage === ESTAGIO.SOLO) {
        liberarPlanta(ator, pai);
      } else {
        const mapa = texturaDaFolha(plot.berryKey, plot.stage, quadro);
        if (!mapa) {
          liberarPlanta(ator, pai);
          ator.visual = "";
          continue;
        }
        if (!ator.planta) {
          ator.planta = criarPlanta(mapa);
          pai.add(ator.planta);
        } else if (ator.planta.material.map !== mapa) {
          ator.planta.material.map = mapa;
          ator.planta.material.needsUpdate = true;
        }
      }
      ator.visual = chaveVisual;
    }

    const base = alturaEm(plot.x, plot.y) * ALTURA_BLOCO;
    ator.solo.position.set(plot.x + 0.5, base + LIFT_SOLO, plot.y + 0.5);
    ator.solo.visible = true;

    if (ator.planta) {
      const escala = ESCALA[plot.stage] || ESCALA_ARBUSTO;
      const baixo = estagioEhTileBaixo(plot.stage);
      poseAtorCartao(ator.planta, {
        x: plot.x + 0.5,
        y: base,
        z: plot.y + 0.5,
        largura: escala,
        altura: baixo ? escala : escala * 2,
        yaw,
        inclinacao,
        pivotX: 0.5,
        pivotY: 1,
      });
    }
  }

  for (const id of atores.keys()) {
    if (!vistos.has(id)) liberarAtor(id, pai);
  }
}
