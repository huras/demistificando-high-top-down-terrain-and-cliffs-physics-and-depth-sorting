import * as THREE from "three";
import { JOGADOR_FRAME } from "../../config.js";

const ALTURA_SPRITE = 1.25;
const SOMBRA_RX = 0.38;
const SOMBRA_RY = 0.16;
const SOMBRA_ALPHA = 0.34;
const SHRINK_K = 0.55;
const HOP_REF = 2.4;

/**
 * Billboard HD-2D a partir do sheet gold (4×4, frame 64px) + sombra oval.
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

  const sprite = new THREE.Sprite(spriteMat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(ALTURA_SPRITE, ALTURA_SPRITE, 1);
  sprite.renderOrder = 3;
  sprite.castShadow = false;
  sprite.receiveShadow = false;
  grupo.add(sprite);

  // proxy invisível pra sombra direcional (Sprite não projeta bem)
  const proxy = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.35, 2, 6),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  proxy.position.y = 0.4;
  proxy.castShadow = true;
  proxy.receiveShadow = false;
  grupo.add(proxy);

  const asaMat = new THREE.MeshStandardMaterial({
    color: 0xc8e8ff,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const asa = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), asaMat);
  asa.position.set(0, 0.85, -0.05);
  asa.rotation.x = -0.35;
  asa.visible = false;
  grupo.add(asa);

  const sombra = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: SOMBRA_ALPHA,
      depthWrite: false,
    }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.02;
  sombra.scale.set(SOMBRA_RX, 1, SOMBRA_RY);
  sombra.renderOrder = 1;
  grupo.add(sombra);

  let sheet = opts.sprite || null;
  let ultimoFrameKey = "";

  function pintarFrame(corpoEstado) {
    if (!sheet || !frameCtx) return;
    const linha = corpoEstado.facing | 0;
    const ciclo = [0, 1, 0, 3];
    const col = corpoEstado.andando ? ciclo[Math.floor(corpoEstado.animT * 8) % 4] : 0;
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
    atualizar(corpoEstado, _camera = null) {
      const elev =
        corpoEstado.elevacao ?? corpoEstado.z + (corpoEstado.hopLift || 0);
      grupo.position.set(corpoEstado.x, elev, corpoEstado.y);

      pintarFrame(corpoEstado);

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

      const voando = !!corpoEstado.voando;
      asa.visible = !!corpoEstado.planando || voando;
      if (voando) {
        asa.material.opacity = 0.45;
        asa.material.color.setHex(0xffe080);
        asa.rotation.z = Math.sin(performance.now() * 0.008) * 0.12;
        asa.rotation.x = -0.55;
      } else if (corpoEstado.planando) {
        asa.material.opacity = 0.85;
        asa.material.color.setHex(0xc8e8ff);
        asa.rotation.z = Math.sin(performance.now() * 0.004) * 0.08;
        asa.rotation.x = -0.35;
      }

      proxy.castShadow = !naParede;

      const solo = naParede
        ? corpoEstado.escalada.zBase > 0
          ? corpoEstado.escalada.zBase
          : 0
        : (corpoEstado.z ?? 0);
      const lift = Math.max(0, elev - solo);
      const heightFrac = Math.max(0, Math.min(1, lift / HOP_REF));
      const shrink = 1 - heightFrac * SHRINK_K;
      const alpha =
        SOMBRA_ALPHA *
        (1 - heightFrac * SHRINK_K) *
        (corpoEstado.noChao && !naParede ? 1 : 0.85);

      sombra.visible = alpha > 0.04;
      sombra.material.opacity = Math.max(0.06, alpha);
      sombra.scale.set(SOMBRA_RX * shrink, 1, SOMBRA_RY * shrink);
      sombra.position.set(0, solo - elev + 0.03, 0);
    },
    liberar() {
      tex.dispose();
      spriteMat.dispose();
      asaMat.dispose();
      sombra.material.dispose();
      sombra.geometry.dispose();
      proxy.geometry.dispose();
      proxy.material.dispose();
      asa.geometry.dispose();
    },
  };
}
