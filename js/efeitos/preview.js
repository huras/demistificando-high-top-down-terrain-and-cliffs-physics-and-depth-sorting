import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { carregarFolhasGolpe } from "../pokemon/combate/folhasGolpe.js";
import { limparFx, ligarFxCena, sincronizarFx, tickFx, dispararGolpeFx } from "../pokemon/combate/fx/index.js";
import { atualizarProjeteis, limparProjeteis, soltarProjetil } from "../pokemon/combate/projeteis.js";
import { efeitoDe, folhaDoEfeito } from "./catalogo.js";

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} [hud]
 */
export function criarPreviewEfeitos(canvas, hud) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x0b1020, 1);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(6, 7, 10);
  camera.lookAt(0, 1, 0);

  const luz = new THREE.DirectionalLight(0xffffff, 1.1);
  luz.position.set(4, 10, 6);
  cena.add(luz);
  cena.add(new THREE.AmbientLight(0x6688aa, 0.55));

  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a2336, roughness: 0.95 }),
  );
  chao.rotation.x = -Math.PI / 2;
  cena.add(chao);
  const grade = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  grade.position.y = 0.01;
  cena.add(grade);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;

  carregarFolhasGolpe();
  ligarFxCena(cena);

  let loop = false;
  let acum = 0;
  let ultimo = performance.now();
  let efeitoId = "ember";

  const origem = { x: -2.5, y: 0, z: 0, elevacao: 0, dirX: 1, dirY: 0 };
  const alvo = { x: 3.5, y: 0, z: 0, elevacao: 0 };

  function resize() {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 480;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function limpar() {
    limparFx();
    limparProjeteis();
  }

  function disparar(id) {
    efeitoId = id || efeitoId;
    const ef = efeitoDe(efeitoId);
    if (!ef) return;
    const def = { key: efeitoId, tipo: ef.elemento || "normal", poder: 40, forma: "projectile", nome: ef.nome };
    limparProjeteis();

    dispararGolpeFx(origem, alvo, def);

    if (ef.kind === "feixe" || ef.kind === "raio" || ef.kind === "status" || ef.kind === "melee" || ef.kind === "overlay") {
      return;
    }

    const folha = folhaDoEfeito(efeitoId);
    const disp = ef.disparo || { tipo: "unico" };
    const n = disp.tipo === "leque" ? disp.n || 3 : disp.tipo === "jato" ? 5 : 1;
    const graus = ((disp.graus || 0) * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const ang = -graus / 2 + graus * t;
      const vel = disp.vel || 12;
      soltarProjetil({
        x: origem.x,
        y: origem.y,
        z: 0.2,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        dono: origem,
        faccao: "player",
        poder: 10,
        tipo: ef.elemento || "normal",
        categoria: "special",
        acerto: 100,
        folha: efeitoId,
        escala: folha?.escalaVoo || ef.orbe?.escala || 0.3,
        giro: disp.giro || 0,
        amp: disp.amp || 0,
        freq: disp.freq || 0,
        cresce: disp.cresce || 0,
        distCresce: disp.distCresce || 7,
      });
    }
  }

  function frame(agora) {
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    controls.update();
    tickFx(dt);
    atualizarProjeteis(dt, [], () => {});
    sincronizarFx(0, null, camera);
    renderer.render(cena, camera);
    if (hud) hud.textContent = loop ? `loop · ${efeitoId}` : efeitoId;
    if (loop) {
      acum += dt;
      if (acum > 1.1) {
        acum = 0;
        disparar(efeitoId);
      }
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);

  return {
    disparar,
    limpar,
    setLoop(v) {
      loop = !!v;
      acum = 0;
    },
    getLoop: () => loop,
    setEfeito(id) {
      efeitoId = id;
    },
  };
}
