import {
  PULO_ALCANCE,
  PULO_ARCO_CELULAS,
  PULO_DURACAO_BASE,
  PULO_DURACAO_POR_DEGRAU,
} from "../config.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";
import { podeEntrar } from "./colisao.js";

/**
 * Inicia pulo/queda na direção do olhar.
 * Permite Δz <= -2 (ex.: 3→1) e Δz = -1; bloqueia subida.
 */
export function tentarPulo(corpo, dirX, dirY) {
  if (corpo.pulando || corpo.escalando) return null;

  let dx = Math.sign(dirX);
  let dy = Math.sign(dirY);
  if (dx === 0 && dy === 0) {
    dx = Math.sign(corpo.dirX);
    dy = Math.sign(corpo.dirY);
  }
  if (dx !== 0 && dy !== 0) {
    if (Math.abs(dirX) >= Math.abs(dirY)) dy = 0;
    else dx = 0;
  }
  if (dx === 0 && dy === 0) dy = 1;

  const ox = Math.floor(corpo.x);
  const oy = Math.floor(corpo.y);
  const z0 = corpo.z;

  // procura pouso a 1 célula; se Δz=0, tenta 2ª célula (salto longo de borda)
  let tx = ox + dx;
  let ty = oy + dy;
  if (!dentroDoMapa(tx, ty)) return { ok: false, motivo: "fora-do-mapa" };

  let z1 = alturaEm(tx, ty);
  if (z1 <= 0) return { ok: false, motivo: "void" };
  if (z1 === z0) {
    const tx2 = ox + dx * 2;
    const ty2 = oy + dy * 2;
    if (dentroDoMapa(tx2, ty2)) {
      const z2 = alturaEm(tx2, ty2);
      if (z2 > 0 && z2 < z0) {
        tx = tx2;
        ty = ty2;
        z1 = z2;
      }
    }
  }

  const dz = z1 - z0;
  if (dz > 0) return { ok: false, motivo: "nao-sobe-com-pulo" };
  if (!podeEntrar(tx, ty, z0, "pular") && dz !== 0) {
    return { ok: false, motivo: "bloqueado" };
  }
  if (dz === 0 && !podeEntrar(tx, ty, z0, "pular")) {
    return { ok: false, motivo: "bloqueado" };
  }

  const queda = z0 - z1;
  if (queda < 0) return { ok: false, motivo: "subida" };

  const duracao = PULO_DURACAO_BASE + PULO_DURACAO_POR_DEGRAU * Math.max(1, queda);
  const destinoX = tx + 0.5;
  const destinoY = ty + 0.5;

  return {
    ok: true,
    pulo: {
      deX: corpo.x,
      deY: corpo.y,
      deZ: z0,
      paraX: destinoX,
      paraY: destinoY,
      paraZ: z1,
      t: 0,
      duracao,
      queda,
    },
  };
}

/** Atualiza tween do pulo. Retorna hopLift em células. */
export function atualizarPulo(corpo, dt) {
  const p = corpo.pulo;
  if (!p) return 0;

  p.t += dt;
  const u = Math.min(1, p.t / p.duracao);
  const suave = u * u * (3 - 2 * u); // smoothstep

  corpo.x = p.deX + (p.paraX - p.deX) * suave;
  corpo.y = p.deY + (p.paraY - p.deY) * suave;
  // z só aplica no pouso; no ar mantém z de origem para colisão visual
  corpo.z = u < 1 ? p.deZ : p.paraZ;

  const arco = Math.sin(Math.PI * u) * (PULO_ARCO_CELULAS + p.queda * 0.15);

  if (u >= 1) {
    corpo.x = p.paraX;
    corpo.y = p.paraY;
    corpo.z = p.paraZ;
    corpo.pulo = null;
    corpo.pulando = false;
    corpo.acao = p.queda >= 2 ? `caiu ${p.deZ}→${p.paraZ}` : "pousou";
    return 0;
  }

  corpo.pulando = true;
  corpo.acao = p.queda >= 2 ? `pulando ${p.deZ}→${p.paraZ}` : "pulando";
  return arco;
}

void PULO_ALCANCE;
