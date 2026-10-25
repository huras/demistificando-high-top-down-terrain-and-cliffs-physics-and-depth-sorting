import * as THREE from "three";
import {
  carregarSlotsCura,
  definirSlotsCura,
  slotsCuraAtuais,
  slotsCuraPadrao,
} from "../jogo/slotsCuraConfig.js";
import { atualizarCuraMaquina, fotoCuraMaquina, iniciarCuraMaquina } from "../jogo/maquinaCura.js";
import {
  aplicarPoseBolasCura,
  carregarMoldeProp,
  criarBolasCuraNaMalha,
  garantirVisualBolaCura,
} from "../render/3d/propsObj3d.js";

const statusEl = document.getElementById("status");
const suporteCampos = document.getElementById("suporte-campos");
const slotsCampos = document.getElementById("slots-campos");
const canvas3d = document.getElementById("vista3d");
const btnSalvar = document.getElementById("salvar");
const btnResetar = document.getElementById("resetar");
const btnPrevia = document.getElementById("previa");

/** @type {ReturnType<typeof slotsCuraAtuais>} */
let cfg = slotsCuraPadrao();
let syncingHud = false;

let renderer = null;
let cena = null;
let camera = null;
let maquina = null;
let suporte = null;
/** @type {THREE.Object3D[]} */
let bolas = [];
/** @type {{ sx: number, sy: number, sz: number } | null} */
let tamMaquina = null;
let az = 0.55;
let pol = 0.45;
let dist = 3.2;
let ultimo = performance.now();

/** Range largo; o number não trava — o slider só acompanha. */
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
  definirSlotsCura(cfg);
  aplicarPoseBolasCura(suporte, cfg, bolas);
}

function poseCamera() {
  const cy = tamMaquina ? tamMaquina.sy * 0.55 : 1.1;
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

function sincronizarBolasVisiveis(dt) {
  atualizarCuraMaquina(dt);
  const foto = fotoCuraMaquina();
  for (let i = 0; i < bolas.length; i++) {
    const bola = bolas[i];
    const quadro = foto ? foto[i] : null;
    if (!quadro || !quadro.visivel) {
      if (!foto) {
        bola.visible = true;
        bola.scale.set(1, 1, 1);
        bola.position.y = bola.userData.baseY || 0;
        continue;
      }
      bola.visible = false;
      continue;
    }
    bola.visible = true;
    if (quadro.ballKey) garantirVisualBolaCura(bola, quadro.ballKey);
    const s = quadro.escala;
    bola.scale.set(s, s, s);
    bola.position.y = (bola.userData.baseY || 0) + (quadro.sobe || 0);
  }
}

function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;
  sincronizarBolasVisiveis(dt);
  renderer.render(cena, camera);
  requestAnimationFrame(loop);
}

async function montarMaquina() {
  const molde = await carregarMoldeProp("cura");
  if (!molde) throw new Error("não carregou prop cura");
  tamMaquina = {
    sx: Math.max(0.4, molde.sx || 1),
    sy: Math.max(0.4, molde.sy || 1.8),
    sz: Math.max(0.4, molde.sz || 1),
  };
  dist = Math.max(2.4, Math.max(tamMaquina.sx, tamMaquina.sy, tamMaquina.sz) * 1.7);
  poseCamera();
  if (maquina) cena.remove(maquina);
  maquina = molde.grupo.clone(true);
  maquina.position.set(0, 0, 0);
  cena.add(maquina);
  // Precisa estar na cena pra getWorldScale bater com o jogo.
  maquina.updateMatrixWorld(true);
  bolas = criarBolasCuraNaMalha(maquina);
  suporte = maquina.getObjectByName("bolas-cura");
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
  definirSlotsCura(cfg);
  dizer("Salvando…");
  try {
    const res = await fetch("/api/maquina-cura-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.erro || `HTTP ${res.status}`);
    dizer("Salvo em assets/models/cidade/props/cura/slots.json");
  } catch (err) {
    dizer(`Falha ao salvar: ${err.message || err}`);
  }
}

btnSalvar.addEventListener("click", () => salvar());
btnResetar.addEventListener("click", () => {
  cfg = slotsCuraPadrao();
  syncingHud = true;
  montarCampos();
  syncingHud = false;
  aplicarLayout();
  dizer("Padrão restaurado (não salvo)");
});
btnPrevia.addEventListener("click", () => {
  iniciarCuraMaquina(["pokeball", "greatball", "ultraball", "masterball", "premierball", "pokeball"]);
  dizer("Prévia da animação…");
});

window.addEventListener("resize", redimensionar);

(async () => {
  try {
    iniciarCena();
    ligarOrbita();
    cfg = await carregarSlotsCura();
    definirSlotsCura(cfg);
    await montarMaquina();
    dizer("Pronto — 1.0 no slider ≈ 1 unidade da máquina (sem trava)");
    requestAnimationFrame(loop);
  } catch (err) {
    dizer(`Erro: ${err.message || err}`);
    console.error(err);
  }
})();
