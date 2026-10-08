import { textoHoverBloco } from "../entrada/hoverBloco.js";
import { razaoStamina } from "../fisica/stamina.js";
import { consultarOclusao } from "./oclusao.js";
import { formulasPersonagem } from "./personagem.js";

let _fpsMostrado = 0;
let _fpsFrames = 0;
let _fpsJanelaT0 = 0;

function tickFps() {
  const agora = performance.now();
  if (!_fpsJanelaT0) _fpsJanelaT0 = agora;
  _fpsFrames++;
  const dt = agora - _fpsJanelaT0;
  if (dt >= 500) {
    _fpsMostrado = Math.round((_fpsFrames * 1000) / dt);
    _fpsFrames = 0;
    _fpsJanelaT0 = agora;
  }
  return _fpsMostrado;
}

export function obterFps() {
  return _fpsMostrado;
}

export function atualizarPainel(corpo, zoom = 1, modoVisual = "cubos", modoJogo = "2d") {
  const f = formulasPersonagem(corpo);
  const ocl = modoJogo === "2d" ? consultarOclusao(corpo) : null;
  const fps = tickFps();

  const formulaTela = document.getElementById("formula-tela");
  const formulaSort = document.getElementById("formula-sort");
  if (modoJogo === "3d") {
    if (formulaTela) formulaTela.textContent = "Three.js · Y = elevação · Z = profundidade";
    if (formulaSort) formulaSort.textContent = "Z-buffer (sem sortKey 2D)";
  } else {
    if (formulaTela) formulaTela.textContent = f.textoTela;
    if (formulaSort) formulaSort.textContent = f.textoSort;
  }

  const estado = document.getElementById("estado");
  if (!estado) return ocl;
  const dds = estado.querySelectorAll("dd");
  if (dds.length < 6) return ocl;
  const elev = corpo.elevacao ?? corpo.z;
  dds[0].textContent = `${corpo.x.toFixed(2)}, ${corpo.y.toFixed(2)}, z${corpo.z}`;
  dds[1].textContent = modoJogo === "3d" ? "—" : f.screenY.toFixed(2);
  dds[2].textContent = modoJogo === "3d" ? "—" : f.sortKey.toFixed(4);
  dds[3].textContent = `${corpo.hopLift.toFixed(2)} (e${elev.toFixed(2)})`;
  dds[4].textContent = corpo.acao;
  if (modoJogo === "3d") {
    dds[5].textContent = "3D";
    dds[5].dataset.status = "";
  } else {
    dds[5].textContent = ocl.status;
    dds[5].dataset.status = ocl.status;
  }

  const staminaEl = document.getElementById("stamina-status");
  if (staminaEl) {
    staminaEl.textContent = `${Math.round(razaoStamina(corpo) * 100)}%`;
  }

  const fpsEl = document.getElementById("fps-status");
  if (fpsEl) fpsEl.textContent = fps > 0 ? String(fps) : "—";

  const hoverEl = document.getElementById("hover-status");
  if (hoverEl) {
    const t = textoHoverBloco();
    if (hoverEl.textContent !== (t || "—")) hoverEl.textContent = t || "—";
  }

  const zoomEl = document.getElementById("zoom-status");
  if (zoomEl) zoomEl.textContent = `${zoom.toFixed(2)}×`;

  const visualEl = document.getElementById("visual-status");
  if (visualEl) visualEl.textContent = modoVisual;

  const modoEl = document.getElementById("modo-status");
  if (modoEl) modoEl.textContent = modoJogo === "3d" ? "3D" : "2D";

  return ocl;
}

export function desenharOverlayAjuda(
  ctx,
  camera,
  debug,
  ocl,
  modoVisual = "cubos",
  modoJogo = "2d",
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const boxX = 10;
  const boxY = 10;
  const boxW = 280;
  const h = debug && modoJogo === "2d" ? 62 : 48;
  const padR = boxX + boxW - 12;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(boxX, boxY, boxW, h);

  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#d8f0d0";
  ctx.fillText(modoJogo === "3d" ? "3D" : "2D", 18, 26);

  const fps = obterFps();
  ctx.textAlign = "right";
  ctx.fillStyle = fps >= 55 ? "#7dce6a" : fps >= 40 ? "#e0c36a" : "#ff8a7a";
  ctx.fillText(`${fps || "—"} fps`, padR, 26);

  const zoom = camera?.zoom ?? 1;
  let statusEsq = `zoom ${zoom.toFixed(2)}× · ${modoVisual}`;
  let corEsq = "#a8c4a8";
  if (modoJogo === "2d" && ocl) {
    statusEsq = `${ocl.status} · ${statusEsq}`;
    corEsq =
      ocl.status === "ATRÁS"
        ? "#e0c36a"
        : ocl.status === "NA FRENTE"
          ? "#7dce6a"
          : "#a8c4a8";
  }

  ctx.textAlign = "left";
  ctx.fillStyle = corEsq;
  ctx.fillText(statusEsq, 18, 42);

  if (debug && modoJogo === "2d") {
    ctx.fillStyle = "#ffe66d";
    ctx.fillText("pivô Y", 18, 58);
    ctx.fillStyle = "#4ecdc4";
    ctx.fillText("topo", 70, 58);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText("face", 110, 58);
  }
  ctx.restore();
}
