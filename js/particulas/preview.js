/**
 * Palco Three.js isolado para pré-visualizar presets do catálogo.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { emitirFagulha, emitirLascas, criarFxCampo } from "../campo/fx.js";
import {
  emitirGotaPreview,
  emitirOndaPreview,
  emitirPegadaPreview,
  tickFxAguaPreview,
} from "../fx/fxAgua.js";
import { soltarFxEnvio, soltarFxRecolher, tickFxBola } from "../fx/fxBola.js";
import { emitirPoeiraEm, puffsPasso } from "../fx/poeiraPasso.js";
import { emitirImpacto } from "../pokemon/combate/fx/impacto.js";
import {
  CAP_FX,
  contarPoolFx,
  desligarPoolGpu,
  limparPoolFx,
  ligarPoolGpu,
  sincronizarPoolGpu,
  tickPoolFx,
} from "../pokemon/combate/fx/poolParticulas3d.js";
import { emitirRastro } from "../pokemon/combate/fx/rastro.js";
import { elementoDe } from "./catalogo.js";
import { criarFxAgua3d } from "../render/3d/fxAgua3d.js";
import { criarFxBola3d } from "../render/3d/fxBola3d.js";
import { criarPoeiraPasso3d } from "../render/3d/poeiraPasso3d.js";

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} hudEl
 */
export function criarPreviewParticulas(canvas, hudEl) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x121814, 1);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
  const controles = new OrbitControls(camera, canvas);
  controles.enableDamping = true;
  controles.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controles.target.set(0, 0.8, 0);
  camera.position.set(4.2, 3.4, 5.6);
  controles.update();

  cena.add(new THREE.HemisphereLight(0xd7efe0, 0x2a211c, 1.2));
  const sol = new THREE.DirectionalLight(0xfff4e0, 1.3);
  sol.position.set(4, 10, 3);
  cena.add(sol);
  cena.add(new THREE.GridHelper(10, 10, 0x3d5248, 0x243028));

  const alvo = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x8fdc7a, roughnessness: 0.4 }),
  );
  alvo.position.set(0, 1.1, 0);
  cena.add(alvo);

  ligarPoolGpu(cena);
  const fxCampo = criarFxCampo();
  cena.add(fxCampo.grupo);
  const poeira = criarPoeiraPasso3d();
  cena.add(poeira.grupo);
  const agua = criarFxAgua3d();
  cena.add(agua.grupo);
  const bola = criarFxBola3d();
  cena.add(bola.grupo);

  let loopAtivo = false;
  let loopCd = 0;
  /** @type {{ categoria: string, id: string } | null} */
  let selecao = null;
  let ultimo = performance.now();
  let fpsAcc = 0;
  let fpsFrames = 0;
  let fps = 0;
  let rodando = true;

  function redimensionar() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function contarPuffs() {
    const puffs = puffsPasso();
    let n = 0;
    for (let i = 0; i < puffs.length; i++) if (puffs[i].viva) n++;
    return n;
  }

  function envelhecerPoeira(dt) {
    const puffs = puffsPasso();
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      if (!p.viva) continue;
      p.idade += dt;
      if (p.idade >= p.dur) p.viva = false;
    }
  }

  function atorDummy() {
    return {
      x: 0,
      y: 0,
      elevacao: 0,
      z: 0,
      especie: { cor: "#fbbf24" },
      brilhoBola: 0,
    };
  }

  function dispararAgora() {
    if (!selecao) return;
    const { categoria, id } = selecao;
    const x = 0;
    const y = 0;
    const z = 1.1;

    if (categoria === "combate") {
      const el = elementoDe(id);
      emitirImpacto(el, x, y, z, 1);
      emitirRastro(el, x, y, z, 2.5, 0, 0.08, 1);
      return;
    }
    if (categoria === "passo") {
      emitirPoeiraEm(x, y, 0, id === "correr" ? "correr" : "andar");
      return;
    }
    if (categoria === "campo") {
      if (id === "lasca") emitirLascas(x, y, 10);
      else if (id === "fagulhaForte") emitirFagulha(x, y, true, 16, true);
      else emitirFagulha(x, y, true, 12, false);
      return;
    }
    if (categoria === "agua") {
      if (id === "onda") {
        for (let i = 0; i < 3; i++) emitirOndaPreview(x + i * 0.15, y, 0.05);
      } else if (id === "gota") {
        for (let i = 0; i < 8; i++) emitirGotaPreview(x, y, 0.2, i < 4);
      } else if (id === "pegada") {
        for (let i = 0; i < 4; i++) emitirPegadaPreview(x + i * 0.35, y, 0);
      } else {
        for (let i = 0; i < 3; i++) emitirOndaPreview(x, y, 0.05);
      }
      return;
    }
    if (categoria === "bola") {
      const a = atorDummy();
      if (id === "recolher") soltarFxRecolher(a, { silencio: true });
      else soltarFxEnvio(a, { silencio: true });
    }
  }

  function limpar() {
    limparPoolFx();
    const puffs = puffsPasso();
    for (let i = 0; i < puffs.length; i++) puffs[i].viva = false;
  }

  function pintarHud() {
    if (!hudEl) return;
    hudEl.innerHTML =
      `<div>FPS <b>${fps}</b></div>` +
      `<div>Combate <b>${contarPoolFx()}</b> / ${CAP_FX}</div>` +
      `<div>Poeira <b>${contarPuffs()}</b></div>` +
      `<div>Loop <b>${loopAtivo ? "on" : "off"}</b></div>`;
  }

  function quadro(agora) {
    if (!rodando) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    fpsAcc += dt;
    fpsFrames += 1;
    if (fpsAcc >= 0.5) {
      fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0;
      fpsFrames = 0;
    }

    redimensionar();
    controles.update();

    if (loopAtivo) {
      loopCd -= dt;
      if (loopCd <= 0) {
        loopCd = 0.55;
        dispararAgora();
      }
    }

    tickPoolFx(dt);
    sincronizarPoolGpu(0, null);
    fxCampo.atualizar(0, 0, dt);
    envelhecerPoeira(dt);
    poeira.atualizar();
    tickFxAguaPreview(dt);
    agua.atualizar(camera);
    tickFxBola(dt);
    bola.atualizar(camera);

    renderer.render(cena, camera);
    pintarHud();
    requestAnimationFrame(quadro);
  }

  requestAnimationFrame(quadro);

  return {
    definirSelecao(categoria, id) {
      selecao = { categoria, id };
    },
    disparar() {
      dispararAgora();
    },
    alternarLoop() {
      loopAtivo = !loopAtivo;
      loopCd = 0;
      return loopAtivo;
    },
    loopLigado() {
      return loopAtivo;
    },
    limpar,
    destruir() {
      rodando = false;
      desligarPoolGpu();
      fxCampo.liberar?.();
      renderer.dispose();
    },
  };
}
