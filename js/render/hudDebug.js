import { textoHoverBloco } from "../entrada/hoverBloco.js";
import { amostraAgua } from "../mundo/agua/amostra.js";
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

function atualizarTexto(el, texto) {
  if (el && el.textContent !== texto) el.textContent = texto;
}

function atualizarReadoutsMinimap(zoom, modoVisual, modoJogo, ocl, fps) {
  const modoEl = document.querySelector("[data-minimap-modo]");
  atualizarTexto(modoEl, modoJogo === "3d" ? "3D" : "2D");

  const metaEl = document.querySelector("[data-minimap-meta]");
  let meta = `zoom ${zoom.toFixed(2)}× · ${modoVisual}`;
  let oclStatus = "";
  if (modoJogo === "2d" && ocl?.status) {
    meta = `${ocl.status} · ${meta}`;
    oclStatus = ocl.status;
  }
  atualizarTexto(metaEl, meta);
  const modeWrap = metaEl?.closest(".area-minimap__mode");
  if (modeWrap) modeWrap.dataset.ocl = oclStatus;

  const fpsHud = document.querySelector(".area-minimap__fps [data-fps]");
  if (fpsHud) {
    const texto = fps > 0 ? String(fps) : "—";
    atualizarTexto(fpsHud, texto);
    const wrap = fpsHud.closest(".area-minimap__fps");
    if (wrap) {
      wrap.dataset.band =
        fps >= 55 ? "ok" : fps >= 40 ? "mid" : fps > 0 ? "low" : "";
    }
  }

  const hoverWrap = document.getElementById("area-minimap-hover");
  const hoverEl = hoverWrap?.querySelector("[data-minimap-hover]");
  if (hoverWrap && hoverEl) {
    const t = textoHoverBloco();
    if (t) {
      atualizarTexto(hoverEl, t);
      if (hoverWrap.hidden) hoverWrap.hidden = false;
    } else if (!hoverWrap.hidden) {
      hoverWrap.hidden = true;
      atualizarTexto(hoverEl, "");
    }
  }
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
  if (estado) {
    const dds = estado.querySelectorAll("dd");
    if (dds.length >= 6) {
      const elev = corpo.elevacao ?? corpo.z;
      dds[0].textContent = `${corpo.x.toFixed(2)}, ${corpo.y.toFixed(2)}, z${corpo.z}`;
      dds[1].textContent = modoJogo === "3d" ? "—" : f.screenY.toFixed(2);
      dds[2].textContent = modoJogo === "3d" ? "—" : f.sortKey.toFixed(4);
      dds[3].textContent = `${corpo.hopLift.toFixed(2)} (e${elev.toFixed(2)})`;
      const agua = amostraAgua(corpo.x, corpo.y, elev);
      if (agua.superficie > 0) {
        const prof = agua.caindo
          ? Math.max(0, agua.superficie - agua.pisoQueda)
          : agua.profundidade;
        const modo = corpo.nadando ? " nado" : agua.caindo ? " queda" : "";
        dds[4].textContent = `${corpo.acao} · água ${prof.toFixed(1)}${modo}`;
      } else {
        dds[4].textContent = corpo.acao;
      }
      if (modoJogo === "3d") {
        dds[5].textContent = "3D";
        dds[5].dataset.status = "";
      } else {
        dds[5].textContent = ocl.status;
        dds[5].dataset.status = ocl.status;
      }
    }
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

  atualizarReadoutsMinimap(zoom, modoVisual, modoJogo, ocl, fps);

  return ocl;
}

/** Legenda de debug no canvas; modo/zoom/FPS ficam no dock do minimapa. */
export function desenharOverlayAjuda(
  ctx,
  camera,
  debug,
  ocl,
  modoVisual = "cubos",
  modoJogo = "2d",
) {
  if (!debug || modoJogo !== "2d") return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const boxX = 10;
  const boxY = 10;
  const boxW = 180;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(boxX, boxY, boxW, 28);

  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffe66d";
  ctx.fillText("pivô Y", 18, 28);
  ctx.fillStyle = "#4ecdc4";
  ctx.fillText("topo", 70, 28);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText("face", 110, 28);
  ctx.restore();
}
