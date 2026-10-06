import { alturaEm, quedaSul } from "../mundo/altura.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import {
  chaveEntidade,
  chaveFaceLateral,
  chaveFaceSul,
  chaveTopo,
} from "./ordenacaoProfundidade.js";

/**
 * Lista tiles (topo/face) que competem no Y-sort com o player.
 */
export function listarPivosProximos(corpo, raio = 4) {
  const sortPlayer = chaveEntidade(corpo.y, corpo.z);
  const itens = [];
  const x0 = Math.floor(corpo.x) - raio;
  const x1 = Math.floor(corpo.x) + raio;
  const y0 = Math.floor(corpo.y) - raio;
  const y1 = Math.floor(corpo.y) + raio + 2;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const z = alturaEm(cx, cy);
      if (z <= 0) continue;

      const yTopo = cy + 0.97;
      const skTopo = chaveTopo(cy, z);
      itens.push({
        tipo: "topo",
        cx,
        cy,
        z,
        yPivo: yTopo,
        sortKey: skTopo,
        rel: skTopo < sortPlayer ? "atras" : "frente",
      });

      const q = quedaSul(cx, cy);
      if (q > 0) {
        const yFace = cy + 0.99;
        const skFace = chaveFaceSul(cy, q, z);
        itens.push({
          tipo: "face",
          cx,
          cy,
          z,
          q,
          yPivo: yFace,
          sortKey: skFace,
          rel: skFace < sortPlayer ? "atras" : "frente",
        });
      }

      const dzW = z - alturaEm(cx - 1, cy);
      const dzE = z - alturaEm(cx + 1, cy);
      if (dzW > 0) {
        const skL = chaveFaceLateral(cy, z);
        itens.push({
          tipo: "face",
          cx,
          cy,
          z,
          yPivo: cy + 0.99,
          sortKey: skL,
          rel: skL < sortPlayer ? "atras" : "frente",
        });
      }
      if (dzE > 0) {
        const skL = chaveFaceLateral(cy, z);
        itens.push({
          tipo: "face",
          cx,
          cy,
          z,
          yPivo: cy + 0.99,
          sortKey: skL,
          rel: skL < sortPlayer ? "atras" : "frente",
        });
      }
    }
  }

  itens.sort(
    (a, b) => Math.abs(a.sortKey - sortPlayer) - Math.abs(b.sortKey - sortPlayer),
  );
  return {
    sortPlayer,
    player: { x: corpo.x, y: corpo.y, z: corpo.z },
    itens: itens.slice(0, 24),
  };
}

export function desenharPivosSort(ctx, corpo) {
  const dados = listarPivosProximos(corpo);
  const pxP = mundoParaTelaX(dados.player.x);
  const pyP = mundoParaTelaY(dados.player.y, dados.player.z);

  for (const item of dados.itens) {
    const px = mundoParaTelaX(item.cx + 0.5);
    const py = mundoParaTelaY(item.yPivo, item.z);
    const cor =
      item.tipo === "face"
        ? item.rel === "frente"
          ? "#ff6b6b"
          : "#ffb4b4"
        : item.rel === "frente"
          ? "#4ecdc4"
          : "#a8e6e0";

    desenharCruz(ctx, px, py, cor, item.tipo === "face" ? 7 : 5);
    ctx.fillStyle = cor;
    ctx.font = "9px monospace";
    const tag = item.tipo === "face" ? "F" : "T";
    ctx.fillText(
      `${tag}${item.cy} ${item.sortKey.toFixed(2)}`,
      px + 6,
      py - 4,
    );

    ctx.strokeStyle = item.rel === "frente" ? "rgba(255,100,100,0.35)" : "rgba(80,200,200,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pxP, pyP);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  desenharCruz(ctx, pxP, pyP, "#ffe66d", 9);
  ctx.fillStyle = "#ffe66d";
  ctx.font = "10px monospace";
  ctx.fillText(`P ${dados.player.x.toFixed(1)}`, pxP + 8, pyP - 22);
  ctx.fillText(`${dados.player.y.toFixed(1)}`, pxP + 8, pyP - 12);
  ctx.fillText(`${dados.player.z} sk${dados.sortPlayer.toFixed(2)}`, pxP + 8, pyP - 2);
  ctx.fillStyle = "rgba(255,230,100,0.9)";
  ctx.beginPath();
  ctx.arc(pxP, pyP, 3, 0, Math.PI * 2);
  ctx.fill();
}

function desenharCruz(ctx, x, y, cor, r) {
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 2, y - 2, 4, 4);
}
