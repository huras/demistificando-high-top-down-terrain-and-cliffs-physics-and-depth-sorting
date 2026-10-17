/**
 * Aba que mostra a mesma sala 3D do Centro, com a altura do jogador no meio.
 */
import * as THREE from "three";
import { ALTURA_BLOCO, ALTURA_SPRITE_JOGADOR, CAMERA3D_PITCH_ORBITA } from "../config.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { plantaCentro } from "../mundo/cidade/centro.js";
import { montarCentro3d } from "../render/3d/centro3d.js";
import { girarCartoes } from "../render/3d/cartaoPe.js";

const vista = document.querySelector('[data-painel="sala"]');
const tela = document.getElementById("vista-3d");
const botaoIso = document.getElementById("iso");
const abas = document.querySelectorAll(".aba");

let quadro = 0;
let vendo = false;
let pronta = false;
let yaw = 0.7;
let pitch = Math.PI / 4;
let dist = 28;
let isometrico = false;
let aspecto = 1;
let arrastando = false;
let ultimoX = 0;
let ultimoY = 0;

const planta = plantaCentro();
const alvo = new THREE.Vector3(
  planta.origemX + planta.cols * 0.5,
  (ALTURA_PRACA + 0.08) * ALTURA_BLOCO + 0.8,
  planta.origemY + planta.rows * 0.5,
);

const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x243038, 1);

const cena = new THREE.Scene();
const persp = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
const orto = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const terreno = new THREE.Group();
terreno.scale.set(1, ALTURA_BLOCO, 1);
cena.add(terreno);

const ceu = new THREE.HemisphereLight(0xc5d7e8, 0x6a6156, 0.9);
const sol = new THREE.DirectionalLight(0xfff4e0, 1.2);
sol.position.set(alvo.x + 14, alvo.y + 18, alvo.z + 8);
sol.target.position.copy(alvo);
cena.add(ceu, sol, sol.target);

const figura = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.28, ALTURA_SPRITE_JOGADOR - 0.56, 4, 10),
  new THREE.MeshLambertMaterial({ color: 0x6cb4e4 }),
);
figura.position.set(alvo.x, (ALTURA_PRACA + 0.08) * ALTURA_BLOCO + ALTURA_SPRITE_JOGADOR * 0.5, alvo.z);
cena.add(figura);

function cameraAtiva() {
  return isometrico ? orto : persp;
}

function enquadrar() {
  const cam = cameraAtiva();
  const cp = Math.cos(pitch);
  cam.position.set(
    alvo.x + Math.sin(yaw) * cp * dist,
    alvo.y + Math.sin(pitch) * dist,
    alvo.z + Math.cos(yaw) * cp * dist,
  );
  cam.lookAt(alvo);
  if (!isometrico) return;
  const meiaAltura = Math.tan((persp.fov * Math.PI) / 360) * dist;
  const meiaLargura = meiaAltura * aspecto;
  orto.left = -meiaLargura;
  orto.right = meiaLargura;
  orto.top = meiaAltura;
  orto.bottom = -meiaAltura;
  orto.updateProjectionMatrix();
}

function medir() {
  const caixa = vista.getBoundingClientRect();
  const w = Math.max(1, caixa.width);
  const h = Math.max(1, caixa.height);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  aspecto = w / h;
  persp.aspect = aspecto;
  persp.updateProjectionMatrix();
}

function desenhar() {
  if (!vendo) return;
  enquadrar();
  girarCartoes(yaw, -pitch);
  renderer.render(cena, cameraAtiva());
  quadro = requestAnimationFrame(desenhar);
}

function mostrar(id) {
  for (let i = 0; i < abas.length; i++) {
    abas[i].classList.toggle("is-ativa", abas[i].dataset.aba === id);
  }
  document.querySelector('[data-painel="marcar"]').hidden = id !== "marcar";
  vista.hidden = id !== "sala";
  vendo = id === "sala";
  if (quadro) cancelAnimationFrame(quadro);
  quadro = 0;
  if (!vendo) return;
  medir();
  if (!pronta) {
    pronta = true;
    montarCentro3d(terreno);
  }
  quadro = requestAnimationFrame(desenhar);
}

for (let i = 0; i < abas.length; i++) {
  abas[i].addEventListener("click", () => mostrar(abas[i].dataset.aba));
}

tela.addEventListener("pointerdown", (ev) => {
  arrastando = true;
  ultimoX = ev.clientX;
  ultimoY = ev.clientY;
  tela.setPointerCapture(ev.pointerId);
});

tela.addEventListener("pointermove", (ev) => {
  if (!arrastando) return;
  yaw -= (ev.clientX - ultimoX) * 0.005;
  if (!isometrico) {
    pitch = Math.min(1.2, Math.max(0.25, pitch + (ev.clientY - ultimoY) * 0.005));
  }
  ultimoX = ev.clientX;
  ultimoY = ev.clientY;
});

tela.addEventListener("pointerup", () => {
  arrastando = false;
});

tela.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    dist = Math.min(36, Math.max(6, dist * (ev.deltaY > 0 ? 1.08 : 0.92)));
  },
  { passive: false },
);

botaoIso.addEventListener("click", () => {
  isometrico = !isometrico;
  botaoIso.classList.toggle("is-ativa", isometrico);
  if (!isometrico) return;
  pitch = CAMERA3D_PITCH_ORBITA;
  yaw = Math.PI / 4;
});

window.addEventListener("resize", () => {
  if (!vista.hidden) medir();
});
