import { razaoStamina } from "../fisica/stamina.js";

/**
 * Anel de stamina ao lado do treinador. Some quando a barra está cheia e parado.
 */
export function desenharHudStamina(ctx, corpo, projetar) {
  if (!corpo || !projetar) return;
  const r = razaoStamina(corpo);
  const ativo =
    corpo.escalando ||
    corpo.correndo ||
    corpo.planando ||
    corpo.nadando ||
    corpo.voando ||
    !corpo.noChao ||
    r < 0.98;
  if (!ativo) return;
  const z = corpo.elevacao ?? corpo.z ?? 0;
  const p = projetar(corpo.x, corpo.y, z, 0);
  if (!p) return;

  const cx = p.x + 34;
  const cy = p.y - 18;
  const raio = 16;
  const inicio = -Math.PI / 2;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(15, 23, 42, 0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.stroke();

  const critica = r <= 0.22;
  ctx.strokeStyle = critica
    ? "rgba(248, 113, 113, 0.95)"
    : corpo.escalando
      ? "rgba(250, 204, 21, 0.95)"
      : corpo.planando || !corpo.noChao
        ? "rgba(45, 212, 191, 0.95)"
        : corpo.correndo
          ? "rgba(163, 230, 53, 0.95)"
          : "rgba(226, 232, 240, 0.92)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, inicio, inicio + Math.PI * 2 * r);
  ctx.stroke();
  ctx.restore();
}
