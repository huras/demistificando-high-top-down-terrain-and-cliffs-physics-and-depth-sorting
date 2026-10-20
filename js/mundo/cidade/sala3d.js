/**
 * Sala 3D fora do mapa. O chão tem 3× a base da casa (6×5 → 18×15).
 * A porta da cidade teleporta pra cá; sair pela porta devolve pra rua.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import { definirLocal, preencherColunaSolida } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";

export const ESCALA_SALA = 3;
export const BASE_CASA_X = 6;
export const BASE_CASA_Y = 5;
export const MIOL_X = BASE_CASA_X * ESCALA_SALA;
export const MIOL_Y = BASE_CASA_Y * ESCALA_SALA;
/** Longe do overworld 8192² — nunca colide com o mapa. */
export const ORIGEM_SALA_X = 100000;
export const ORIGEM_SALA_Y = 100000;

const MARGEM = 28;
const ALTURA_PAREDE = 4;

function caixa() {
  const x0 = ORIGEM_SALA_X;
  const y0 = ORIGEM_SALA_Y;
  const x1 = x0 + MIOL_X + 2;
  const y1 = y0 + MIOL_Y + 2;
  const portaX0 = x0 + 1 + (MIOL_X >> 1) - 1;
  return {
    x0,
    y0,
    x1,
    y1,
    portaX0,
    portaX1: portaX0 + 2,
    portaY: y1 - 1,
  };
}

/** Pátio plano em volta da sala, pra câmera não cair num penhasco. */
export function dentroDoTerrenoSala(wx, wy) {
  const c = caixa();
  return (
    wx >= c.x0 - MARGEM &&
    wx < c.x1 + MARGEM &&
    wy >= c.y0 - MARGEM &&
    wy < c.y1 + MARGEM
  );
}

function ehParede(wx, wy) {
  const c = caixa();
  if (wx < c.x0 || wy < c.y0 || wx >= c.x1 || wy >= c.y1) return false;
  const borda = wx === c.x0 || wx === c.x1 - 1 || wy === c.y0 || wy === c.y1 - 1;
  if (!borda) return false;
  if (wy === c.portaY && wx >= c.portaX0 && wx < c.portaX1) return false;
  return true;
}

/** Um passo pra dentro da porta sul. */
export function spawnSala() {
  const c = caixa();
  return {
    x: (c.portaX0 + c.portaX1) * 0.5,
    y: c.portaY - 3.2,
    z: ALTURA_PRACA,
  };
}

/** Canto noroeste do chão, pra assentar os móveis. */
export function origemDoChao() {
  const c = caixa();
  return { x: c.x0 + 1, y: c.y0 + 1 };
}

/** Caixa da sala em coordenadas de mundo. */
export function medidasSala() {
  const c = caixa();
  return {
    x0: c.x0,
    y0: c.y0,
    x1: c.x1,
    y1: c.y1,
    portaX0: c.portaX0,
    portaX1: c.portaX1,
    portaY: c.portaY,
    chaoX0: c.x0 + 1,
    chaoY0: c.y0 + 1,
    chaoX1: c.x1 - 1,
    chaoY1: c.y1 - 1,
    alturaParede: ALTURA_PAREDE,
  };
}

export function naSaidaSala(x, y) {
  const c = caixa();
  if (y < c.portaY + 0.15) return false;
  return x >= c.portaX0 - 0.35 && x < c.portaX1 + 0.35;
}

export function aplicarSalaNoChunk(chunk) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const zParede = Math.min(CHUNK_Y, ALTURA_PRACA + ALTURA_PAREDE);
  let mudou = false;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      if (!dentroDoTerrenoSala(wx, wy)) continue;
      preencherColunaSolida(chunk, lx, ly, ALTURA_PRACA, BLOCO.TERRA);
      if (ehParede(wx, wy)) {
        for (let z = ALTURA_PRACA; z < zParede; z++) definirLocal(chunk, lx, ly, z, BLOCO.PEDRA);
      }
      mudou = true;
    }
  }
  return mudou;
}
