/**
 * Reserva PISO_NINHOS lares por espécie não-lendária, em tile que ela pode habitar.
 * O sorteio normal continua nos outros slots.
 */
import { CHUNK_XZ, POKEMON } from "../config.js";
import { LADO_MUNDO, ORIGEM_KANTO_X, ORIGEM_KANTO_Y, EXTENSAO_KANTO } from "../mundo/bounds.js";
import { listarEspecies } from "./dados.js";
import { TILES_POR_NIVEL } from "./distribuicao/forca.js";
import { ehLendario } from "./lendarios.js";
import { registrarForcaLar, slotAceitaEspecie } from "./laresMapa.js";

const CENTRO_X = ORIGEM_KANTO_X + EXTENSAO_KANTO * 0.5;
const CENTRO_Y = ORIGEM_KANTO_Y + EXTENSAO_KANTO * 0.5;
const LADO = Math.ceil(LADO_MUNDO / CHUNK_XZ);
const TENTATIVAS = 160;

let pronto = null;

function hash(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function chunkDe(dex, t, dist) {
  const ang = ((hash(dex, t, 3) % 360) * Math.PI) / 180;
  const folga = 1 + (hash(dex, t, 4) % 5) * 0.18;
  let x = CENTRO_X + Math.cos(ang) * dist * folga;
  let y = CENTRO_Y + Math.sin(ang) * dist * folga;
  if (x < 1) x = 1;
  if (y < 1) y = 1;
  if (x >= LADO_MUNDO - 1) x = LADO_MUNDO - 2;
  if (y >= LADO_MUNDO - 1) y = LADO_MUNDO - 2;
  return {
    cx: Math.floor(x / CHUNK_XZ),
    cy: Math.floor(y / CHUNK_XZ),
  };
}

function reservarEspecie(esp, piso) {
  const distBase = Math.max(80, ((esp.nivelMin | 0 || 1) - 1) * TILES_POR_NIVEL);
  let achados = 0;
  for (let t = 0; t < TENTATIVAS && achados < piso; t++) {
    let cx;
    let cy;
    if (t % 2 === 0) {
      const dist = distBase + (t % 12) * TILES_POR_NIVEL * 2;
      const chunk = chunkDe(esp.dex | 0, t, dist);
      cx = chunk.cx;
      cy = chunk.cy;
    } else {
      cx = hash(esp.dex | 0, t, 11) % LADO;
      cy = hash(esp.dex | 0, t, 12) % LADO;
    }
    if (cx < 0 || cy < 0 || cx >= LADO || cy >= LADO) continue;
    if (!slotAceitaEspecie(cx, cy, 0, esp)) continue;
    registrarForcaLar(`${cx},${cy},0`, esp.key);
    achados++;
  }
  return achados;
}

function construir(aoProgresso) {
  const piso = Math.max(1, POKEMON.PISO_NINHOS | 0);
  const fila = [];
  const todas = listarEspecies();
  for (let i = 0; i < todas.length; i++) {
    const esp = todas[i];
    if (!esp?.key || !(esp.dex | 0) || ehLendario(esp.dex)) continue;
    fila.push(esp);
  }
  fila.sort((a, b) => (a.dex | 0) - (b.dex | 0));

  let i = 0;
  let reservados = 0;
  const passo = () => {
    const t0 = performance.now();
    while (i < fila.length && performance.now() - t0 < 8) {
      reservados += reservarEspecie(fila[i], piso);
      i++;
    }
    aoProgresso?.({ feitos: i, total: fila.length, reservados, pronto: i >= fila.length });
    if (i < fila.length) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/** Termina antes dos lares serem resolvidos. Idempotente. */
export function garantirPisoNinhos(aoProgresso) {
  if (!pronto) {
    pronto = new Promise((resolve) => {
      construir((p) => {
        aoProgresso?.(p);
        if (p.pronto) resolve(p);
      });
    });
  }
  return pronto;
}
