import { razaoStamina } from "../fisica/stamina.js";

/**
 * Barra de stamina estilo BOTW (canto inferior do canvas).
 */
export function desenharHudStamina(ctx, corpo, canvasW, canvasH) {
  const r = razaoStamina(corpo);
  const w = 160;
  const h = 10;
  const x = 18;
  const y = canvasH - 28;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 4, y - 16, w + 8, h + 22);

  ctx.fillStyle = "#a8c4a8";
  ctx.font = "11px Segoe UI, sans-serif";
  ctx.fillText(
    corpo.escalando ? "STAMINA (escalando)" : "STAMINA",
    x,
    y - 4,
  );

  ctx.fillStyle = "#1a2820";
  ctx.fillRect(x, y, w, h);

  const cor =
    r > 0.35 ? "#7dce6a" : r > 0.15 ? "#e0c36a" : "#e07060";
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w * r, h);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.restore();
}
