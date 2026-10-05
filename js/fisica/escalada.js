import { ESCALADA_DURACAO } from "../config.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";
import { celulaAFrente } from "./colisao.js";

/**
 * Escala exatamente +1 degrau na célula à frente.
 */
export function tentarEscalar(corpo) {
  if (corpo.pulando || corpo.escalando) return null;

  const frente = celulaAFrente(corpo.x, corpo.y, corpo.dirX, corpo.dirY);
  if (!dentroDoMapa(frente.cx, frente.cy)) {
    return { ok: false, motivo: "fora" };
  }

  const dz = frente.z - corpo.z;
  if (dz !== 1) {
    return { ok: false, motivo: dz > 1 ? "alto-demais" : dz <= 0 ? "sem-degrau" : "invalido" };
  }

  return {
    ok: true,
    escalada: {
      deX: corpo.x,
      deY: corpo.y,
      deZ: corpo.z,
      paraX: frente.cx + 0.5,
      paraY: frente.cy + 0.5,
      paraZ: frente.z,
      t: 0,
      duracao: ESCALADA_DURACAO,
    },
  };
}

/** Lift visual durante escalada (células). */
export function atualizarEscalada(corpo, dt) {
  const e = corpo.escalada;
  if (!e) return 0;

  e.t += dt;
  const u = Math.min(1, e.t / e.duracao);
  const suave = u * u * (3 - 2 * u);

  corpo.x = e.deX + (e.paraX - e.deX) * suave;
  corpo.y = e.deY + (e.paraY - e.deY) * suave;
  corpo.z = u < 0.55 ? e.deZ : e.paraZ;

  const lift = Math.sin(Math.PI * u) * Math.abs(e.paraZ - e.deZ) * 0.45;

  if (u >= 1) {
    corpo.x = e.paraX;
    corpo.y = e.paraY;
    corpo.z = e.paraZ;
    corpo.elevacao = e.paraZ;
    corpo.noChao = true;
    corpo.vz = 0;
    corpo.hopLift = 0;
    corpo.escalada = null;
    corpo.escalando = false;
    corpo.acao = `escalou → z=${e.paraZ}`;
    return 0;
  }

  corpo.escalando = true;
  corpo.acao = "escalando";
  return lift;
}

void alturaEm;
