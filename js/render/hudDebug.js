import { razaoStamina } from "../fisica/stamina.js";
import { consultarOclusao } from "./oclusao.js";
import { formulasPersonagem } from "./personagem.js";

export function atualizarPainel(corpo, zoom = 1, modoVisual = "cubos") {
  const f = formulasPersonagem(corpo);
  const ocl = consultarOclusao(corpo);

  const formulaTela = document.getElementById("formula-tela");
  const formulaSort = document.getElementById("formula-sort");
  if (formulaTela) formulaTela.textContent = f.textoTela;
  if (formulaSort) formulaSort.textContent = f.textoSort;

  const estado = document.getElementById("estado");
  if (!estado) return ocl;
  const dds = estado.querySelectorAll("dd");
  if (dds.length < 7) return ocl;
  const elev = corpo.elevacao ?? corpo.z;
  dds[0].textContent = `${corpo.x.toFixed(2)}, ${corpo.y.toFixed(2)}, z${corpo.z}`;
  dds[1].textContent = f.screenY.toFixed(2);
  dds[2].textContent = f.sortKey.toFixed(4);
  dds[3].textContent = `${corpo.hopLift.toFixed(2)} (e${elev.toFixed(2)})`;
  dds[4].textContent = corpo.acao;
  dds[5].textContent = ocl.status;
  dds[5].dataset.status = ocl.status;
  dds[6].textContent = `${Math.round(razaoStamina(corpo) * 100)}%`;

  const zoomEl = document.getElementById("zoom-status");
  if (zoomEl) zoomEl.textContent = `${zoom.toFixed(2)}×`;

  const visualEl = document.getElementById("visual-status");
  if (visualEl) visualEl.textContent = modoVisual;

  return ocl;
}

export function desenharOverlayAjuda(ctx, camera, debug, ocl, modoVisual = "cubos") {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const h = debug ? 96 : 72;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(10, 10, 380, h);
  ctx.fillStyle = "#d8f0d0";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText("High Top-Down Demo", 18, 28);
  ctx.fillStyle = "#a8c4a8";
  ctx.fillText(
    debug
      ? "DEBUG — pivôs: P amarelo · topo · face"
      : "` debug · E = gruda · T = visual real/cubos",
    18,
    46,
  );
  if (ocl) {
    const cor =
      ocl.status === "ATRÁS"
        ? "#e0c36a"
        : ocl.status === "NA FRENTE"
          ? "#7dce6a"
          : "#a8c4a8";
    ctx.fillStyle = cor;
    ctx.fillText(`vs face: ${ocl.status}`, 18, 64);
  }
  ctx.fillStyle = "#a8c4a8";
  ctx.fillText(`zoom ${camera.zoom.toFixed(2)}× · visual ${modoVisual}`, 160, 64);
  if (debug) {
    ctx.fillStyle = "#ffe66d";
    ctx.fillText("cruz = pivô de sortKey (Y)", 18, 84);
    ctx.fillStyle = "#4ecdc4";
    ctx.fillText("topo", 200, 84);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText("F  (frente=mais saturado)", 240, 84);
  }
  ctx.restore();
}
