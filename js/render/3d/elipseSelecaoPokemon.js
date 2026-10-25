/**
 * Elipse no chão no centro do colisor do Pokémon.
 * Metade de trás (renderOrder baixo) fica atrás do cartão; a da frente, na frente.
 */
import * as THREE from "three";
import { ALTURA_BLOCO, RAIO_POKEMON } from "../../config.js";
import { obterPonteiroCanvas } from "../../entrada/hoverBloco.js";
import { atorSobPonteiro } from "../../pokemon/clique.js";
import { projetar3d, projetarChao3d } from "../../pokemon/hud.js";
import { alvoDeOrdem } from "../../pokemon/party.js";

const LIFT = 0.05;
/** Cartão do mon usa renderOrder 3 — trás < 3 < frente. */
const ORDER_TRAS = 2;
const ORDER_FRENTE = 5;

const ESTILO = Object.freeze({
  hover: {
    anel: 0xecfeff,
    preench: 0x2dd4bf,
    opAnel: 0.95,
    opPreench: 0.38,
  },
  ordem: {
    anel: 0xfecaca,
    preench: 0xf87171,
    opAnel: 0.95,
    opPreench: 0.4,
  },
});

function matBasico(cor, op) {
  return new THREE.MeshBasicMaterial({
    color: cor,
    transparent: true,
    opacity: op,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * Ring/Circle no plano XZ. Após rotateX(-90°): θ=π/2 → −Z, θ=3π/2 → +Z.
 * Frente = meia voltada pra +Z local; trás = pra −Z. O yaw do grupo aponta +Z na câmera.
 */
function meiaNoChao(geo) {
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function criarPar(estilo) {
  const grupo = new THREE.Group();
  grupo.name = "elipse-selecao";
  grupo.visible = false;
  grupo.frustumCulled = false;

  const matAnelT = matBasico(estilo.anel, estilo.opAnel);
  const matAnelF = matBasico(estilo.anel, estilo.opAnel);
  const matFillT = matBasico(estilo.preench, estilo.opPreench);
  const matFillF = matBasico(estilo.preench, estilo.opPreench);

  // Escala unitária (raio 1); scale do grupo = raio mundo.
  const rIn = 1.12;
  const rOut = 1.55;
  const rFill = 1.08;

  const fillT = new THREE.Mesh(meiaNoChao(new THREE.CircleGeometry(rFill, 36, 0, Math.PI)), matFillT);
  const anelT = new THREE.Mesh(meiaNoChao(new THREE.RingGeometry(rIn, rOut, 36, 1, 0, Math.PI)), matAnelT);
  const fillF = new THREE.Mesh(meiaNoChao(new THREE.CircleGeometry(rFill, 36, Math.PI, Math.PI)), matFillF);
  const anelF = new THREE.Mesh(
    meiaNoChao(new THREE.RingGeometry(rIn, rOut, 36, 1, Math.PI, Math.PI)),
    matAnelF,
  );

  for (const m of [fillT, anelT]) {
    m.renderOrder = ORDER_TRAS;
    m.frustumCulled = false;
    m.raycast = () => {};
  }
  for (const m of [fillF, anelF]) {
    m.renderOrder = ORDER_FRENTE;
    m.frustumCulled = false;
    m.raycast = () => {};
  }
  grupo.add(fillT, anelT, fillF, anelF);

  return {
    grupo,
    atualizar(ator, camera) {
      if (!ator || !camera) {
        grupo.visible = false;
        return;
      }
      const raio = Math.max(0.18, ator.raioCorpo > 0 ? ator.raioCorpo : RAIO_POKEMON);
      const solo = ator.z ?? 0;
      const pulso = 0.97 + 0.03 * Math.sin(performance.now() * 0.007);
      const dx = camera.position.x - ator.x;
      const dz = camera.position.z - ator.y;
      // +Z local olha pra câmera → frente da elipse fica entre mon e lente.
      grupo.rotation.y = Math.atan2(dx, dz);
      grupo.position.set(ator.x, solo * ALTURA_BLOCO + LIFT, ator.y);
      grupo.scale.setScalar(raio * pulso);
      grupo.visible = true;
    },
    liberar() {
      for (const m of [fillT, anelT, fillF, anelF]) {
        m.geometry.dispose();
      }
      for (const m of [matAnelT, matAnelF, matFillT, matFillF]) m.dispose();
    },
  };
}

/**
 * Duas elipses: hover (teal) + alvo de ordem (vermelho).
 * @param {THREE.Scene} scene
 * @param {{ canvas?: HTMLCanvasElement }} [opts]
 */
export function criarElipsesSelecaoPokemon(scene, opts = {}) {
  const hover = criarPar(ESTILO.hover);
  const ordem = criarPar(ESTILO.ordem);
  hover.grupo.name = "elipse-hover-pokemon";
  ordem.grupo.name = "elipse-ordem-pokemon";
  scene.add(hover.grupo);
  scene.add(ordem.grupo);

  let canvas = opts.canvas || null;

  return {
    hover: hover.grupo,
    ordem: ordem.grupo,
    definirCanvas(el) {
      canvas = el;
    },
    atualizar(camera) {
      if (!camera) {
        hover.atualizar(null, null);
        ordem.atualizar(null, null);
        return;
      }
      const alvo = alvoDeOrdem();
      let sob = null;
      if (canvas) {
        const ponteiro = obterPonteiroCanvas(canvas);
        if (ponteiro) {
          const projetar = projetar3d(camera, canvas.width, canvas.height);
          const projetarPes = projetarChao3d(camera, canvas.width, canvas.height);
          sob = atorSobPonteiro(ponteiro.x, ponteiro.y, projetar, projetarPes);
        }
      }
      ordem.atualizar(alvo || null, camera);
      // Teal só se for outro mon (vermelho já marca o alvo de ordem).
      hover.atualizar(sob && sob !== alvo ? sob : null, camera);
    },
    liberar() {
      scene.remove(hover.grupo);
      scene.remove(ordem.grupo);
      hover.liberar();
      ordem.liberar();
    },
  };
}
