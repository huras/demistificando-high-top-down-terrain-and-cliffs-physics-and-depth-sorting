import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { consultarOclusao } from "./oclusao.js";
import { formulasPersonagem } from "./personagem.js";

export function atualizarPainel(corpo) {
  const f = formulasPersonagem(corpo);
  const ocl = consultarOclusao(corpo);

  const formulaTela = document.getElementById("formula-tela");
  const formulaSort = document.getElementById("formula-sort");
  if (formulaTela) formulaTela.textContent = f.textoTela;
  if (formulaSort) formulaSort.textContent = f.textoSort;

  const estado = document.getElementById("estado");
  if (!estado) return;
  const dds = estado.querySelectorAll("dd");
  if (dds.length < 6) return;
  dds[0].textContent = `${corpo.x.toFixed(2)}, ${corpo.y.toFixed(2)}, ${corpo.z}`;
  dds[1].textContent = f.screenY.toFixed(2);
  dds[2].textContent = f.sortKey.toFixed(4);
  dds[3].textContent = corpo.hopLift.toFixed(3);
  dds[4].textContent = corpo.acao;
  dds[5].textContent = ocl.status;
  dds[5].dataset.status = ocl.status;

  return ocl;
}

export function desenharOverlayAjuda(ctx, _camera, debug, corpo, ocl) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const h = debug ? 78 : 56;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(10, 10, 320, h);
  ctx.fillStyle = "#d8f0d0";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText("High Top-Down Demo", 18, 28);
  ctx.fillStyle = "#a8c4a8";
  ctx.fillText(debug ? "DEBUG ON (F1) — wireframe + sortKey" : "F1: wireframe / labels z", 18, 46);
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
  if (debug && ocl?.sortPlayer != null) {
    ctx.fillStyle = "#a8c4a8";
    ctx.fillText(`sk=${ocl.sortPlayer.toFixed(3)}`, 160, 64);
  }
  ctx.restore();

  if (debug && corpo && ocl) {
    const px = mundoParaTelaX(corpo.x);
    const py = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift);
    ctx.fillStyle = "rgba(255, 220, 80, 0.95)";
    ctx.font = "10px monospace";
    ctx.fillText(`sk ${ocl.sortPlayer.toFixed(2)}`, px + 8, py - 8);
  }
}
