import {
  CAMERA3D_DIST_MAX,
  CAMERA3D_DIST_MIN,
  CAMERA3D_DIST_PADRAO,
  CAMERA3D_OLHAR_Y,
  CAMERA3D_PITCH_MAX,
  CAMERA3D_PITCH_MIN,
  CAMERA3D_PITCH_ORBITA,
  CAMERA3D_PIVO_MAX,
  CAMERA3D_PIVO_MIN,
} from "../config.js";
import {
  definirAlturaPivo,
  definirDistancia,
  definirMecanismo,
  definirMostrarRig,
  definirPitchOrbita,
} from "../render/3d/camera3d.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";

let arrastando = false;

export function ligarPainelCamera() {
  const pivo = document.getElementById("cam-pivo");
  const dist = document.getElementById("cam-dist");
  const pitch = document.getElementById("cam-pitch");
  const mecanismo = document.getElementById("cam-mecanismo");
  const rig = document.getElementById("cam-rig");
  if (!pivo || !dist || !pitch || !mecanismo || !rig) return;

  const marcarArraste = () => {
    arrastando = true;
  };
  pivo.addEventListener("pointerdown", marcarArraste);
  dist.addEventListener("pointerdown", marcarArraste);
  pitch.addEventListener("pointerdown", marcarArraste);
  window.addEventListener("pointerup", () => {
    arrastando = false;
  });

  pivo.addEventListener("input", () => {
    aplicar((cam) => definirAlturaPivo(cam, Number(pivo.value)));
    escreverValor("cam-pivo-valor", Number(pivo.value).toFixed(2));
  });
  dist.addEventListener("input", () => {
    aplicar((cam) => definirDistancia(cam, Number(dist.value)));
    escreverValor("cam-dist-valor", Number(dist.value).toFixed(1));
  });
  pitch.addEventListener("input", () => {
    aplicar((cam) => definirPitchOrbita(cam, (Number(pitch.value) * Math.PI) / 180));
    escreverValor("cam-pitch-valor", `${Math.round(Number(pitch.value))}°`);
  });
  mecanismo.addEventListener("change", () => {
    aplicar((cam) => definirMecanismo(cam, mecanismo.value));
  });
  rig.addEventListener("change", () => {
    aplicar((cam) => definirMostrarRig(cam, rig.checked));
  });

  sincronizarPainelCamera();
}

export function sincronizarPainelCamera() {
  const cam = obterCenario3d()?.camera3d;
  const pivo = document.getElementById("cam-pivo");
  const dist = document.getElementById("cam-dist");
  const pitch = document.getElementById("cam-pitch");
  const mecanismo = document.getElementById("cam-mecanismo");
  const rig = document.getElementById("cam-rig");
  if (!pivo || !dist || !pitch) return;

  const altura = cam?.alturaPivo ?? CAMERA3D_OLHAR_Y;
  const distancia = clamp(cam?.distancia ?? CAMERA3D_DIST_PADRAO, CAMERA3D_DIST_MIN, CAMERA3D_DIST_MAX);
  const graus = Math.round(
    ((cam?.pitchOrbita ?? CAMERA3D_PITCH_ORBITA) * 180) / Math.PI,
  );

  if (!arrastando && document.activeElement !== pivo) {
    pivo.min = String(CAMERA3D_PIVO_MIN);
    pivo.max = String(CAMERA3D_PIVO_MAX);
    pivo.value = altura.toFixed(2);
    escreverValor("cam-pivo-valor", altura.toFixed(2));
  }
  if (!arrastando && document.activeElement !== dist) {
    dist.min = String(CAMERA3D_DIST_MIN);
    dist.max = String(CAMERA3D_DIST_MAX);
    dist.value = distancia.toFixed(1);
    escreverValor("cam-dist-valor", distancia.toFixed(1));
  }
  if (!arrastando && document.activeElement !== pitch) {
    pitch.min = String(Math.round((CAMERA3D_PITCH_MIN * 180) / Math.PI));
    pitch.max = String(Math.round((CAMERA3D_PITCH_MAX * 180) / Math.PI));
    pitch.value = String(graus);
    escreverValor("cam-pitch-valor", `${graus}°`);
  }
  if (mecanismo && cam && document.activeElement !== mecanismo) {
    mecanismo.value = cam.mecanismo === "costas" ? "costas" : "livre";
  }
  if (rig && cam) rig.checked = !!cam.mostrarRig;
}

function aplicar(fn) {
  const cam = obterCenario3d()?.camera3d;
  if (cam) fn(cam);
}

function escreverValor(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
