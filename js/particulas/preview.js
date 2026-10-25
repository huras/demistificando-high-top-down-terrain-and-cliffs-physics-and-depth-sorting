/**
 * Palco Three.js isolado para pré-visualizar presets do catálogo.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { emitirFagulha, emitirLascas, criarFxCampo } from "../campo/fx.js";
import { efeitoDe, folhaDoEfeito } from "../efeitos/catalogo.js";
import {
  emitirGotaPreview,
  emitirOndaPreview,
  emitirPegadaPreview,
  tickFxAguaPreview,
} from "../fx/fxAgua.js";
import { soltarFxEnvio, soltarFxRecolher, tickFxBola } from "../fx/fxBola.js";
import { emitirPoeiraEm, puffsPasso } from "../fx/poeiraPasso.js";
import { carregarFolhasGolpe } from "../pokemon/combate/folhasGolpe.js";
import {
  desligarFxCena,
  dispararGolpeFx,
  limparFx,
  ligarFxCena,
  sincronizarFx,
  tickFx,
} from "../pokemon/combate/fx/index.js";
import { emitirImpacto } from "../pokemon/combate/fx/impacto.js";
import {
  CAP_FX,
  contarPoolFx,
  limparPoolFx,
  sincronizarPoolGpu,
  tickPoolFx,
} from "../pokemon/combate/fx/poolParticulas3d.js";
import { emitirRastro } from "../pokemon/combate/fx/rastro.js";
import { atualizarProjeteis, limparProjeteis, soltarProjetil } from "../pokemon/combate/projeteis.js";
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

  carregarFolhasGolpe();
  ligarFxCena(cena);
  const fxCampo = criarFxCampo();
  cena.add(fxCampo.grupo);
  const poeira = criarPoeiraPasso3d();
  cena.add(poeira.grupo);
  const agua = criarFxAgua3d();
  cena.add(agua.grupo);
  const bola = criarFxBola3d();
  cena.add(bola.grupo);

  const origemFx = { x: -2.2, y: 0, z: 0, elevacao: 0, dirX: 1, dirY: 0 };
  const alvoFx = { x: 2.8, y: 0, z: 0, elevacao: 0 };

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
      return;
    }
    if (categoria === "efeitos") {
      dispararEfeito(id);
    }
  }

  function dispararEfeito(id) {
    const ef = efeitoDe(id);
    if (!ef) return;
    limparProjeteis();
    limparFx();
    const def = {
      key: id,
      tipo: ef.elemento || "normal",
      poder: 40,
      forma: "projectile",
      nome: ef.nome || id,
    };
    dispararGolpeFx(origemFx, alvoFx, def);
    if (ef.kind === "feixe" || ef.kind === "raio" || ef.kind === "status" || ef.kind === "melee" || ef.kind === "overlay") {
      return;
    }
    const folha = folhaDoEfeito(id);
    const disp = ef.disparo || { tipo: "unico" };
    const n = disp.tipo === "leque" ? disp.n || 3 : disp.tipo === "jato" ? 5 : 1;
    const graus = ((disp.graus || 0) * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const ang = -graus / 2 + graus * t;
      const vel = disp.vel || 12;
      soltarProjetil({
        x: origemFx.x,
        y: origemFx.y,
        z: 0.25,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        dono: origemFx,
        faccao: "player",
        poder: 10,
        tipo: ef.elemento || "normal",
        categoria: "special",
        acerto: 100,
        folha: id,
        escala: folha?.escalaVoo || ef.orbe?.escala || 0.3,
        giro: disp.giro || 0,
        amp: disp.amp || 0,
        freq: disp.freq || 0,
        cresce: disp.cresce || 0,
        distCresce: disp.distCresce || 7,
      });
    }
  }

  function limpar() {
    limparPoolFx();
    limparFx();
    limparProjeteis();
    const puffs = puffsPasso();
    for (let i = 0; i < puffs.length; i++) puffs[i].viva = false;
  }

  function pintarHud() {
    if (!hudEl) return;
    const sel = selecao ? `${selecao.categoria}/${selecao.id}` : "—";
    hudEl.innerHTML =
      `<div>FPS <b>${fps}</b></div>` +
      `<div>Combate <b>${contarPoolFx()}</b> / ${CAP_FX}</div>` +
      `<div>Poeira <b>${contarPuffs()}</b></div>` +
      `<div>Sel <b>${sel}</b></div>` +
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

    if (selecao?.categoria === "efeitos") {
      tickFx(dt);
      atualizarProjeteis(dt, [], () => {});
      sincronizarFx(0, null, camera);
    } else {
      tickPoolFx(dt);
      sincronizarPoolGpu(0, null);
    }
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
      desligarFxCena();
      fxCampo.liberar?.();
      renderer.dispose();
    },
  };
}
