import * as THREE from "three";
import { ALTURA_BLOCO, JOGADOR_FRAME } from "../../config.js";
import { pivoDoFrame } from "../pivoPe.js";
import { colunaAgua } from "../../mundo/agua/fluxo.js";
import { criarAsaDelta3d } from "./asaDelta3d.js";
import { linhaFacingDoCorpo } from "./facingCamera3d.js";
import { criarSombraContato3d } from "./sombraContato3d.js";
import { aplicarCorSprite } from "./ceu/luzBillboard.js";
import { fatorSombraMundo } from "./ceu/mapaNuvem.js";
import { amostrarLuzCidade } from "./luzes/mapaChao.js";

const ALTURA_SPRITE = 1.25;
const _luzCidade = new THREE.Color();

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
  const corBase = spriteMat.color.clone();

  const sprite = new THREE.Sprite(spriteMat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(ALTURA_SPRITE, ALTURA_SPRITE, 1);
  sprite.renderOrder = 3;
  sprite.castShadow = false;
  sprite.receiveShadow = false;
  grupo.add(sprite);

  // Véu só abaixo da superfície (normal para baixo descarta o que está acima).
  const planoVeu = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const veuMat = new THREE.SpriteMaterial({
    map: tex,
    color: 0x1a6fbf,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0.12,
    sizeAttenuation: true,
    clippingPlanes: [planoVeu],
  });
  const veu = new THREE.Sprite(veuMat);
  veu.center.set(0.5, 0);
  veu.scale.set(ALTURA_SPRITE, ALTURA_SPRITE, 1);
  veu.renderOrder = 4;
  veu.castShadow = false;
  veu.receiveShadow = false;
  veu.visible = false;
  grupo.add(veu);

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
    const pivo = pivoDoFrame(sheet, col, linha, JOGADOR_FRAME);
    const centroY = 1 - pivo.y;
    sprite.center.set(pivo.x, centroY);
    veu.center.set(pivo.x, centroY);
  }

  function definirSprite(img) {
    sheet = img || null;
    ultimoFrameKey = "";
    sprite.visible = !!sheet;
    if (!sheet) veu.visible = false;
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
      grupo.position.set(corpoEstado.x, elev * ALTURA_BLOCO, corpoEstado.y);
      const sombraNuvem = fatorSombraMundo(corpoEstado.x, grupo.position.y, corpoEstado.y);
      amostrarLuzCidade(grupo.position.x, grupo.position.y + 0.7, grupo.position.z, _luzCidade);
      aplicarCorSprite(spriteMat, corBase, sombraNuvem, _luzCidade);

      const agua = colunaAgua(corpoEstado.x, corpoEstado.y);
      const imerso = agua.superficie > 0 && elev < agua.superficie - 0.05;
      veu.visible = imerso && sprite.visible;
      if (imerso) planoVeu.constant = agua.superficie * ALTURA_BLOCO;

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
      veuMat.dispose();
      sombra.liberar();
      asa.liberar();
    },
  };
}
