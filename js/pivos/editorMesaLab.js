import * as THREE from "three";
import {
  carregarSlotsMesaLab,
  definirSlotsMesaLab,
  slotsMesaLabAtuais,
  slotsMesaLabPadrao,
} from "../jogo/slotsMesaLabConfig.js";
import {
  aplicarPoseBolasCura,
  carregarMoldeProp,
  criarBolasIniciaisNaMesa,
} from "../render/3d/propsObj3d.js";

const statusEl = document.getElementById("status");
const suporteCampos = document.getElementById("suporte-campos");
const slotsCampos = document.getElementById("slots-campos");
const canvas3d = document.getElementById("vista3d");
const btnSalvar = document.getElementById("salvar");
const btnResetar = document.getElementById("resetar");

/** @type {ReturnType<typeof slotsMesaLabAtuais>} */
let cfg = slotsMesaLabPadrao();
let syncingHud = false;

let renderer = null;
let cena = null;
let camera = null;
let mesa = null;
let suporte = null;
/** @type {THREE.Object3D[]} */
let bolas = [];
/** @type {{ sx: number, sy: number, sz: number } | null} */
let tamMesa = null;
let az = 0.55;
let pol = 0.45;
let dist = 3.2;

const SLIDER_MIN = -8;
const SLIDER_MAX = 8;
const SLIDER_STEP = 0.02;

function dizer(texto) {
  statusEl.textContent = texto;
}

function celula(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 1000) / 1000;
}

function expandirRange(rangeEl, valor) {
  let min = Number(rangeEl.min);
  let max = Number(rangeEl.max);
  const v = Number(valor);
  if (!Number.isFinite(v)) return;
  while (v < min) min -= Math.max(2, Math.abs(min) * 0.5 || 2);
  while (v > max) max += Math.max(2, Math.abs(max) * 0.5 || 2);
  rangeEl.min = String(celula(min));
  rangeEl.max = String(celula(max));
}

/**
 * @param {string} rotulo
 * @param {{ x: number, y: number, z: number }} ponto
 * @param {() => void} onChange
 */
function campoXyz(rotulo, ponto, onChange) {
  const bloco = document.createElement("div");
  if (rotulo) {
    const h = document.createElement("h3");
    h.textContent = rotulo;
    bloco.appendChild(h);
    bloco.className = "slot-bloco";
  }
  for (const eixo of ["x", "y", "z"]) {
    const label = document.createElement("label");
    label.className = "campo campo--xyz";
    const nome = document.createElement("span");
    nome.textContent = eixo;
    const range = document.createElement("input");
    range.type = "range";
    range.min = String(SLIDER_MIN);
    range.max = String(SLIDER_MAX);
    range.step = String(SLIDER_STEP);
    expandirRange(range, ponto[eixo]);
    range.value = String(ponto[eixo]);
    const num = document.createElement("input");
    num.type = "number";
    num.step = String(SLIDER_STEP);
    num.value = String(ponto[eixo]);
    const aplicar = (v, deRange) => {
      if (syncingHud) return;
      const n = celula(v);
      ponto[eixo] = n;
      if (!deRange) expandirRange(range, n);
      range.value = String(n);
      num.value = String(n);
      onChange();
    };
    range.addEventListener("input", () => aplicar(range.value, true));
    num.addEventListener("input", () => aplicar(num.value, false));
    num.addEventListener("change", () => aplicar(num.value, false));
    label.append(nome, range, num);
    bloco.appendChild(label);
  }
  return bloco;
}

function montarCampos() {
  suporteCampos.replaceChildren();
  slotsCampos.replaceChildren();
  suporteCampos.appendChild(
    campoXyz("", cfg.suporte, () => {
      aplicarLayout();
      dizer("Suporte ajustado (não salvo)");
    }),
  );
  for (let i = 0; i < cfg.slots.length; i++) {
    const idx = i;
    slotsCampos.appendChild(
      campoXyz(`Slot ${i + 1}`, cfg.slots[i], () => {
        aplicarLayout();
        dizer(`Slot ${idx + 1} ajustado (não salvo)`);
      }),
    );
  }
}

function aplicarLayout() {
  definirSlotsMesaLab(cfg);
  aplicarPoseBolasCura(suporte, cfg, bolas);
}

function poseCamera() {
  const cy = tamMesa ? tamMesa.sy * 0.55 : 0.9;
  camera.position.set(
    Math.cos(az) * Math.cos(pol) * dist,
    cy + Math.sin(pol) * dist,
    Math.sin(az) * Math.cos(pol) * dist,
  );
  camera.lookAt(0, cy, 0);
}

function iniciarCena() {
  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x0e1411, 1);
  cena = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
  cena.add(new THREE.HemisphereLight(0xddeeff, 0x334422, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 0.85);
  sol.position.set(2.2, 4, 1.4);
  cena.add(sol);
  const chao = new THREE.Mesh(
    new THREE.CircleGeometry(3, 32),
    new THREE.MeshLambertMaterial({ color: 0x1a2820 }),
  );
  chao.rotation.x = -Math.PI / 2;
  cena.add(chao);
  poseCamera();
  redimensionar();
}

function redimensionar() {
  const w = canvas3d.clientWidth || 1;
  const h = canvas3d.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function ligarOrbita() {
  let arraste = null;
  canvas3d.addEventListener("pointerdown", (ev) => {
    arraste = { x: ev.clientX, y: ev.clientY, az, pol };
    canvas3d.setPointerCapture(ev.pointerId);
    canvas3d.classList.add("arrastando");
  });
  canvas3d.addEventListener("pointermove", (ev) => {
    if (!arraste) return;
    az = arraste.az - (ev.clientX - arraste.x) * 0.008;
    pol = Math.max(-1.2, Math.min(1.35, arraste.pol + (ev.clientY - arraste.y) * 0.008));
    poseCamera();
  });
  const soltar = (ev) => {
    if (!arraste) return;
    arraste = null;
    canvas3d.classList.remove("arrastando");
    try {
      canvas3d.releasePointerCapture(ev.pointerId);
    } catch (_) {
      /* ignore */
    }
  };
  canvas3d.addEventListener("pointerup", soltar);
  canvas3d.addEventListener("pointercancel", soltar);
  canvas3d.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      dist = Math.max(1.2, Math.min(20, dist * (ev.deltaY > 0 ? 1.08 : 0.92)));
      poseCamera();
    },
    { passive: false },
  );
}

function loop() {
  renderer.render(cena, camera);
  requestAnimationFrame(loop);
}

async function montarMesa() {
  const molde = await carregarMoldeProp("mesa-3");
  if (!molde) throw new Error("não carregou prop mesa-3");
  tamMesa = {
    sx: Math.max(0.4, molde.sx || 1),
    sy: Math.max(0.4, molde.sy || 1),
    sz: Math.max(0.4, molde.sz || 1),
  };
  dist = Math.max(2.4, Math.max(tamMesa.sx, tamMesa.sy, tamMesa.sz) * 1.7);
  poseCamera();
  if (mesa) cena.remove(mesa);
  mesa = molde.grupo.clone(true);
  mesa.position.set(0, 0, 0);
  cena.add(mesa);
  mesa.updateMatrixWorld(true);
  bolas = criarBolasIniciaisNaMesa(mesa, ["bulbasaur", "charmander", "squirtle"]);
  suporte = mesa.getObjectByName("bolas-lab");
  aplicarLayout();
  for (let i = 0; i < bolas.length; i++) {
    bolas[i].visible = true;
    bolas[i].scale.set(1, 1, 1);
  }
  syncingHud = true;
  montarCampos();
  syncingHud = false;
}

async function salvar() {
  definirSlotsMesaLab(cfg);
  dizer("Salvando…");
  try {
    const res = await fetch("/api/mesa-lab-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.erro || `HTTP ${res.status}`);
    dizer("Salvo em assets/models/cidade/props/mesa-3/slots.json");
  } catch (err) {
    dizer(`Falha ao salvar: ${err.message || err}`);
  }
}

btnSalvar.addEventListener("click", () => salvar());
btnResetar.addEventListener("click", () => {
  cfg = slotsMesaLabPadrao();
  syncingHud = true;
  montarCampos();
  syncingHud = false;
  aplicarLayout();
  dizer("Padrão restaurado (não salvo)");
});

window.addEventListener("resize", redimensionar);

(async () => {
  try {
    iniciarCena();
    ligarOrbita();
    cfg = await carregarSlotsMesaLab();
    definirSlotsMesaLab(cfg);
    await montarMesa();
    dizer("Pronto — 1.0 no slider ≈ 1 unidade da mesa (sem trava)");
    requestAnimationFrame(loop);
  } catch (err) {
    dizer(`Erro: ${err.message || err}`);
    console.error(err);
  }
})();
