import * as THREE from "three";
import { TILE } from "../../config.js";
import {
  blitQuadro,
  direcao8Camera,
  garantirAtlas,
  quadroDe,
  tickVisual,
} from "../../pokemon/sprites.js";
import {
  aplicarPivoCartao,
  criarAtorCartao,
  poseAtorCartao,
} from "../../render/3d/billboard/atorCartao.js";
import { ARCEUS, DEX_ARCEUS } from "./config.js";

const PX_MUNDO = 1 / TILE;
const LADO = 256;
const PE_X = LADO * 0.5;
const PE_Y = LADO - 8;
const PIVO_X = PE_X / LADO;
const PIVO_Y = PE_Y / LADO;

/**
 * Billboard PMD do Arceus, centrado, Idle.
 * @param {THREE.Scene} scene
 */
export function criarArceus(scene) {
  const grupo = new THREE.Group();
  grupo.name = "arceus-abertura";
  grupo.position.set(ARCEUS.x, ARCEUS.y, ARCEUS.z);

  const tela = document.createElement("canvas");
  tela.width = LADO;
  tela.height = LADO;
  const ctx = tela.getContext("2d");
  const tex = new THREE.CanvasTexture(tela);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;

  const sprite = criarAtorCartao(tex, {
    nome: "arceus-cartao",
    transparent: true,
    depthWrite: true,
    alphaTest: 0.18,
    fog: false,
    renderOrder: 8,
  });
  aplicarPivoCartao(sprite, PIVO_X, PIVO_Y);
  grupo.add(sprite);
  scene.add(grupo);

  const ator = {
    id: "arceus-abertura",
    especie: {
      dex: DEX_ARCEUS,
      escala: ARCEUS.escala,
      offsetY: ARCEUS.offsetY,
      pivoDx: 0,
      pivoDy: 0,
      cor: "#f5e6a8",
    },
    shiny: false,
    dirX: 0,
    dirY: 1,
    vx: 0,
    vy: 0,
    visual: { anim: "Idle", dir: 0, frame: 0, t: 0 },
  };

  let chave = "";
  let pronto = false;
  const _dir = new THREE.Vector3();

  function yawDaCamera(camera) {
    if (!camera) return 0;
    camera.getWorldDirection(_dir);
    if (_dir.x * _dir.x + _dir.z * _dir.z < 1e-6) return 0;
    return Math.atan2(-_dir.x, -_dir.z);
  }

  function pintarFallback() {
    const k = "fallback";
    if (chave === k) return;
    chave = k;
    ctx.clearRect(0, 0, LADO, LADO);
    ctx.fillStyle = ator.especie.cor;
    ctx.beginPath();
    ctx.arc(PE_X, PE_Y - 28, 22, 0, Math.PI * 2);
    ctx.fill();
    tex.needsUpdate = true;
  }

  function pintar(pack, fr) {
    const k = `${pack.id}:${ator.visual.anim}:${ator.visual.dir}:${ator.visual.frame}`;
    if (chave === k) return;
    chave = k;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, LADO, LADO);
    blitQuadro(ctx, pack.img, pack.atlasW, pack.atlasH, fr, PE_X, PE_Y, ARCEUS.zoomBlit, {
      dx: 0,
      dy: 0,
    });
    tex.needsUpdate = true;
  }

  function esperarAtlas() {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tentar = () => {
        const pack = garantirAtlas(DEX_ARCEUS, false);
        if (pack.estado === "pronto") {
          pronto = true;
          resolve(pack);
          return;
        }
        if (pack.estado === "falhou" || performance.now() - t0 > 12000) {
          resolve(null);
          return;
        }
        requestAnimationFrame(tentar);
      };
      tentar();
    });
  }

  return {
    grupo,
    ator,
    centroY: ARCEUS.y + 1.05,
    async preparar() {
      await esperarAtlas();
    },
    /**
     * @param {number} dt
     * @param {THREE.Camera} camera
     * @param {number} agora
     */
    avancar(dt, camera, agora) {
      const yaw = yawDaCamera(camera);
      if (camera) {
        ator.dirX = camera.position.x - grupo.position.x;
        ator.dirY = camera.position.z - grupo.position.z;
      }
      const pack = tickVisual(ator, dt, agora);
      const rel = direcao8Camera(ator.dirX, ator.dirY, yaw);
      if (rel != null) ator.visual.dir = rel;

      const lado = LADO * PX_MUNDO * ARCEUS.escala;
      poseAtorCartao(sprite, {
        x: 0,
        y: -ARCEUS.offsetY,
        z: 0,
        largura: lado,
        altura: lado,
        yaw,
        inclinacao: 0,
        pivotX: PIVO_X,
        pivotY: PIVO_Y,
      });

      const fr = quadroDe(ator, pack);
      if (fr && pack.img && pack.estado === "pronto") pintar(pack, fr);
      else pintarFallback();
    },
    liberar() {
      scene.remove(grupo);
      sprite.geometry?.dispose?.();
      sprite.material?.dispose?.();
      tex.dispose();
    },
    estaPronto() {
      return pronto;
    },
  };
}
