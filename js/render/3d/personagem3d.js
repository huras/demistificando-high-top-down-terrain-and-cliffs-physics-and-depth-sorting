import * as THREE from "three";
import { ALTURA_BLOCO, ALTURA_SPRITE_JOGADOR, JOGADOR_FRAME } from "../../config.js";
import { oscilacaoNado } from "../../fx/fxAgua.js";
import { pivoDoFrame } from "../pivoPe.js";
import { carregarPivoJogador, pivoDoJogador } from "../pivoJogador.js";
import { colunaAgua } from "../../mundo/agua/fluxo.js";
import { criarAsaDelta3d } from "./asaDelta3d.js";
import { linhaFacingDoCorpo } from "./facingCamera3d.js";
import { criarSombraContato3d } from "./sombraContato3d.js";
import { aplicarCorSprite } from "./ceu/luzBillboard.js";
import { fatorSombraMundo } from "./ceu/mapaNuvem.js";
import { amostrarLuzCidade } from "./luzes/mapaChao.js";
import { marcarReflexo } from "./ceu/reflexoPoca.js";
import { COR_SILHUETA_JOGADOR, criarMalhaSilhueta } from "./silhuetaSprite.js";
import { aplicarPivoCartao, criarAtorCartao, poseAtorCartao } from "./billboard/atorCartao.js";

const _luzCidade = new THREE.Color();

/**
 * Billboard HD-2D (Mesh no pe) + sombra de contato + asa-delta.
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

  const cartao = criarAtorCartao(tex, {
    nome: "personagem-cartao",
    transparent: true,
    depthWrite: false,
    alphaTest: 0.12,
    renderOrder: 3,
  });
  if (opts.tint != null) cartao.material.color.setHex(opts.tint);
  const corBase = cartao.material.color.clone();
  cartao.scale.set(ALTURA_SPRITE_JOGADOR, ALTURA_SPRITE_JOGADOR, 1);
  marcarReflexo(cartao);
  grupo.add(cartao);

  const silhueta = criarMalhaSilhueta(tex, COR_SILHUETA_JOGADOR);
  silhueta.scale.copy(cartao.scale);
  silhueta.visible = cartao.visible;
  grupo.add(silhueta);

  const planoVeu = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const veu = criarAtorCartao(tex, {
    nome: "personagem-veu",
    color: 0x1a6fbf,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    alphaTest: 0.12,
    renderOrder: 4,
    clippingPlanes: [planoVeu],
  });
  veu.scale.copy(cartao.scale);
  veu.visible = false;
  grupo.add(veu);

  const sombra = criarSombraContato3d();
  grupo.add(sombra.grupo);

  const asa = criarAsaDelta3d();
  grupo.add(asa.grupo);

  let sheet = opts.sprite || null;
  let ultimoFrameKey = "";
  let pivotX = 0.5;
  let pivotY = 1;
  carregarPivoJogador();

  function sincronizarPivo(mesh) {
    aplicarPivoCartao(mesh, pivotX, pivotY);
  }

  function sincronizarPivoCom(px, py) {
    aplicarPivoCartao(cartao, px, py);
    aplicarPivoCartao(veu, px, py);
    aplicarPivoCartao(silhueta, px, py);
  }

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
    pivotX = pivo.x - aj.dx / JOGADOR_FRAME;
    pivotY = pivo.y - aj.dy / JOGADOR_FRAME;
    sincronizarPivo(cartao);
    sincronizarPivo(veu);
    sincronizarPivo(silhueta);
  }

  function definirSprite(img) {
    sheet = img || null;
    ultimoFrameKey = "";
    cartao.visible = !!sheet;
    silhueta.visible = !!sheet;
    if (!sheet) veu.visible = false;
  }

  definirSprite(sheet);

  return {
    grupo,
    definirSprite,
    definirSumico(alfa) {
      const a = alfa == null ? 1 : Math.max(0, Math.min(1, alfa));
      cartao.material.opacity = a;
      silhueta.material.opacity = a;
      silhueta.material.transparent = true;
      if (a >= 0.999) {
        cartao.visible = !!sheet;
        silhueta.visible = !!sheet;
        veu.material.opacity = 0.55;
        sombra.grupo.visible = true;
        return;
      }
      veu.material.opacity = 0.55 * a;
      const mostra = a > 0.03 && !!sheet;
      cartao.visible = mostra;
      silhueta.visible = mostra;
      sombra.grupo.visible = mostra;
      if (!mostra) {
        veu.visible = false;
        asa.grupo.visible = false;
      }
    },
    /**
     * @param {object} corpoEstado
     * @param {THREE.Camera|null} camera
     * @param {number} [yawCam]
     * @param {number} [inclinacao]
     */
    atualizar(corpoEstado, camera = null, yawCam = 0, inclinacao = 0) {
      const elevFisica =
        corpoEstado.elevacao ?? corpoEstado.z + (corpoEstado.hopLift || 0);
      const elev = elevFisica + oscilacaoNado(corpoEstado);
      grupo.position.set(corpoEstado.x, elev * ALTURA_BLOCO, corpoEstado.y);
      const folgaPe = -pivoDoJogador().offsetY;
      const sombraNuvem = fatorSombraMundo(corpoEstado.x, grupo.position.y, corpoEstado.y);
      amostrarLuzCidade(grupo.position.x, grupo.position.y + ALTURA_SPRITE_JOGADOR * 0.56, grupo.position.z, _luzCidade);
      aplicarCorSprite(cartao.material, corBase, sombraNuvem, _luzCidade);

      const agua = colunaAgua(corpoEstado.x, corpoEstado.y);
      const imerso = agua.superficie > 0 && elevFisica < agua.superficie - 0.05;
      veu.visible = imerso && cartao.visible;
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

      const tilt = Number.isFinite(inclinacao) ? inclinacao : 0;
      // Queda: billboard em pé + roll 90°.
      // Pivô vai do pé → centro (corpo fica sobre a sombra).
      // Lift = raio do CORPO opaco (não a meia-folha do PNG) * cos(tilt),
      // senão o padding transparente “assenta” e o personagem voa.
      let roll = 0;
      let px = pivotX;
      let py = pivotY;
      let yCartao = folgaPe;
      if (corpoEstado.morteDesde != null) {
        const DUR = 0.62;
        const u = Math.min(1, (performance.now() - corpoEstado.morteDesde) / 1000 / DUR);
        const e = 1 - (1 - u) * (1 - u) * (1 - u);
        const sinal = corpoEstado.morteRollSinal === -1 ? -1 : 1;
        roll = sinal * (Math.PI * 0.5) * e;
        const t = Math.abs(Math.sin(roll));
        px = pivotX + (0.5 - pivotX) * t;
        py = pivotY + (0.5 - pivotY) * t;
        // ~24px de ~64: meia-largura do corpo no sheet
        const raioCorpo = ALTURA_SPRITE_JOGADOR * 0.19;
        yCartao = folgaPe + t * raioCorpo * Math.cos(Math.abs(tilt));
        sincronizarPivoCom(px, py);
      }
      const lado = ALTURA_SPRITE_JOGADOR;
      const poseOpts = {
        x: 0,
        y: yCartao,
        z: 0,
        largura: lado,
        altura: lado,
        yaw,
        inclinacao: tilt,
        roll,
        pivotX: px,
        pivotY: py,
      };
      poseAtorCartao(cartao, poseOpts);
      poseAtorCartao(silhueta, poseOpts);
      poseAtorCartao(veu, poseOpts);

      const naParede = !!(corpoEstado.escalando && corpoEstado.escalada) && corpoEstado.morteDesde == null;
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
      cartao.geometry.dispose();
      cartao.material.dispose();
      silhueta.geometry.dispose();
      silhueta.material.dispose();
      veu.geometry.dispose();
      veu.material.dispose();
      sombra.liberar();
      asa.liberar();
    },
  };
}
