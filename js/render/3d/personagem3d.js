import * as THREE from "three";
import { ALTURA_BLOCO, ALTURA_SPRITE_JOGADOR, JOGADOR_FRAME } from "../../config.js";
import { pivoDoFrame } from "../pivoPe.js";
import { carregarPivoJogador, pivoDoJogador } from "../pivoJogador.js";
import { colunaAgua } from "../../mundo/agua/fluxo.js";
import { criarAsaDelta3d } from "./asaDelta3d.js";
import { linhaFacingDoCorpo } from "./facingCamera3d.js";
import { criarSombraContato3d } from "./sombraContato3d.js";
import { aplicarCorSprite, aplicarProfundidadeSprite } from "./ceu/luzBillboard.js";
import { fatorSombraMundo } from "./ceu/mapaNuvem.js";
import { amostrarLuzCidade } from "./luzes/mapaChao.js";

const _luzCidade = new THREE.Color();
const COR_SILHUETA = 0xc5d6ee;

/**
 * O cartão visível some quando o pivô perde o depth.
 * Este passe usa o mesmo pivô com teste invertido, então só entra
 * o que o sólido já cobriu — casa, penhasco, o que escreveu depth.
 */
function aplicarMascaraSilhueta(material) {
  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    if (shader.fragmentShader.includes("silhuetaChata")) return;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
/* silhuetaChata */
diffuseColor.rgb = diffuse;`,
    );
  };
  material.customProgramCacheKey = function chaveSilhueta() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|silhueta-chata`;
  };
  return material;
}

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
  aplicarProfundidadeSprite(spriteMat);
  if (opts.tint != null) spriteMat.color.setHex(opts.tint);
  const corBase = spriteMat.color.clone();

  const sprite = new THREE.Sprite(spriteMat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(ALTURA_SPRITE_JOGADOR, ALTURA_SPRITE_JOGADOR, 1);
  sprite.renderOrder = 3;
  sprite.castShadow = false;
  sprite.receiveShadow = false;
  grupo.add(sprite);

  const silhuetaMat = new THREE.SpriteMaterial({
    map: tex,
    color: COR_SILHUETA,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    alphaTest: 0.12,
    sizeAttenuation: true,
    fog: false,
    toneMapped: false,
  });
  aplicarMascaraSilhueta(silhuetaMat);
  aplicarProfundidadeSprite(silhuetaMat);
  const silhueta = new THREE.Sprite(silhuetaMat);
  silhueta.name = "silhueta";
  silhueta.center.set(0.5, 0);
  silhueta.scale.copy(sprite.scale);
  silhueta.renderOrder = 5;
  silhueta.raycast = () => {};
  silhueta.visible = sprite.visible;
  grupo.add(silhueta);

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
  aplicarProfundidadeSprite(veuMat);
  const veu = new THREE.Sprite(veuMat);
  veu.center.set(0.5, 0);
  veu.scale.set(ALTURA_SPRITE_JOGADOR, ALTURA_SPRITE_JOGADOR, 1);
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
  carregarPivoJogador();

  function pintarFrame(corpoEstado, yawCam) {
    if (!sheet || !frameCtx) return;
    const linha = linhaFacingDoCorpo(corpoEstado, yawCam ?? 0);
    const ciclo = [0, 1, 0, 3];
    const col = corpoEstado.andando
      ? ciclo[Math.floor(corpoEstado.animT * 8) % 4]
      : 0;
    const key = `${linha}:${col}`;
    if (key !== ultimoFrameKey) {
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
    const pivo = pivoDoFrame(sheet, col, linha, JOGADOR_FRAME);
    const aj = pivoDoJogador();
    const centroX = pivo.x - aj.dx / JOGADOR_FRAME;
    const centroY = 1 - pivo.y + aj.dy / JOGADOR_FRAME;
    sprite.center.set(centroX, centroY);
    veu.center.set(centroX, centroY);
    silhueta.center.set(centroX, centroY);
  }

  function definirSprite(img) {
    sheet = img || null;
    ultimoFrameKey = "";
    sprite.visible = !!sheet;
    silhueta.visible = !!sheet;
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
      const folgaPe = -pivoDoJogador().offsetY;
      sprite.position.y = folgaPe;
      veu.position.y = folgaPe;
      silhueta.position.y = folgaPe;
      const sombraNuvem = fatorSombraMundo(corpoEstado.x, grupo.position.y, corpoEstado.y);
      amostrarLuzCidade(grupo.position.x, grupo.position.y + ALTURA_SPRITE_JOGADOR * 0.56, grupo.position.z, _luzCidade);
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
      silhuetaMat.dispose();
      veuMat.dispose();
      sombra.liberar();
      asa.liberar();
    },
  };
}
