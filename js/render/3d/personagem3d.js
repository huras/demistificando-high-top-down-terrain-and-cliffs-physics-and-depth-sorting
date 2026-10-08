import * as THREE from "three";
import { JOGADOR_FRAME } from "../../config.js";
import { colunaAgua } from "../../mundo/agua/fluxo.js";
import { criarAsaDelta3d } from "./asaDelta3d.js";
import { linhaFacingDoCorpo } from "./facingCamera3d.js";
import { criarSombraContato3d } from "./sombraContato3d.js";

const ALTURA_SPRITE = 1.25;

/**
 * Billboard HD-2D + sombra de contato + asa-delta.
 * opts: { nome, sprite, tint }
 */
export function criarPersonagem3d(opts = {}) {
  const grupo = new THREE.Group();
  grupo.name = opts.nome || "personagem";

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = JOGADOR_FRAME;
  frameCanvas.height = JOGADOR_FRAME;
  const frameCtx = frameCanvas.getContext("2d");
  frameCtx.imageSmoothingEnabled = false;

  const tex = new THREE.CanvasTexture(frameCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;

  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0.12,
    sizeAttenuation: true,
  });
  if (opts.tint != null) spriteMat.color.setHex(opts.tint);

  const planoAgua = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const sprite = new THREE.Sprite(spriteMat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(ALTURA_SPRITE, ALTURA_SPRITE, 1);
  sprite.renderOrder = 3;
  sprite.castShadow = false;
  sprite.receiveShadow = false;
  grupo.add(sprite);

  const sombra = criarSombraContato3d();
  grupo.add(sombra.grupo);

  const asa = criarAsaDelta3d();
  grupo.add(asa.grupo);

  let sheet = opts.sprite || null;
  let ultimoFrameKey = "";

  function pintarFrame(corpoEstado, yawCam) {
    if (!sheet || !frameCtx) return;
    const linha = linhaFacingDoCorpo(corpoEstado, yawCam ?? 0);
    const ciclo = [0, 1, 0, 3];
    const col = corpoEstado.andando
      ? ciclo[Math.floor(corpoEstado.animT * 8) % 4]
      : 0;
    const key = `${linha}:${col}`;
    if (key === ultimoFrameKey) return;
    ultimoFrameKey = key;
    frameCtx.clearRect(0, 0, JOGADOR_FRAME, JOGADOR_FRAME);
    frameCtx.drawImage(
      sheet,
      col * JOGADOR_FRAME,
      linha * JOGADOR_FRAME,
      JOGADOR_FRAME,
      JOGADOR_FRAME,
      0,
      0,
      JOGADOR_FRAME,
      JOGADOR_FRAME,
    );
    tex.needsUpdate = true;
  }

  function definirSprite(img) {
    sheet = img || null;
    ultimoFrameKey = "";
    sprite.visible = !!sheet;
  }

  definirSprite(sheet);

  return {
    grupo,
    definirSprite,
    /**
     * @param {object} corpoEstado
     * @param {THREE.Camera|null} camera
     * @param {number} [yawCam]
     */
    atualizar(corpoEstado, camera = null, yawCam = 0) {
      const elev =
        corpoEstado.elevacao ?? corpoEstado.z + (corpoEstado.hopLift || 0);
      grupo.position.set(corpoEstado.x, elev, corpoEstado.y);

      const agua = colunaAgua(corpoEstado.x, corpoEstado.y);
      if (agua.superficie > 0 && elev < agua.superficie - 0.05) {
        planoAgua.constant = -agua.superficie;
        spriteMat.clippingPlanes = [planoAgua];
      } else if (spriteMat.clippingPlanes && spriteMat.clippingPlanes.length) {
        spriteMat.clippingPlanes = [];
      }

      const yaw =
        yawCam != null && Number.isFinite(yawCam)
          ? yawCam
          : camera
            ? Math.atan2(
                camera.position.x - corpoEstado.x,
                camera.position.z - corpoEstado.y,
              )
            : 0;

      pintarFrame(corpoEstado, yaw);

      const naParede = !!(corpoEstado.escalando && corpoEstado.escalada);
      if (naParede) {
        const e = corpoEstado.escalada;
        const nx = e.normalX || 0;
        const ny = e.normalY || 0;
        grupo.rotation.x = -0.08;
        if (Math.abs(nx) > Math.abs(ny)) {
          grupo.rotation.z = nx > 0 ? 0.12 : -0.12;
        } else {
          grupo.rotation.x = ny > 0 ? 0.15 : -0.2;
        }
      } else {
        grupo.rotation.x = 0;
        grupo.rotation.z = 0;
      }

      sombra.atualizar(corpoEstado, elev);
      asa.atualizar(corpoEstado);
    },
    liberar() {
      tex.dispose();
      spriteMat.dispose();
      sombra.liberar();
      asa.liberar();
    },
  };
}
