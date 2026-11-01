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
import {
  geoSoloArado,
  LIFT_SOLO_ARADO,
  mapaSoloArado,
  materialSoloArado,
} from "../render/3d/soloArado.js";
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

let grupo = null;
/** @type {Map<string, { solo: THREE.Mesh, planta: THREE.Mesh | null, visual: string }>} */
const atores = new Map();
/** @type {Map<string, THREE.CanvasTexture>} */
const texPlanta = new Map();
let folhaPedida = false;

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
  const mesh = new THREE.Mesh(geoSoloArado(), materialSoloArado(umido));
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
      ator.solo.material.map = mapaSoloArado(umido);
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
    ator.solo.position.set(plot.x + 0.5, base + LIFT_SOLO_ARADO, plot.y + 0.5);
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
