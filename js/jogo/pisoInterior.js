/**
 * Piso autorado dos bolsos 3D (casa / hub / lab / santuário).
 * Outdoor: sempre válido. Indoor: só miolo caminhável, nunca o pátio preto.
 */
import { estado } from "./estado.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { medidasSala, PROF_PORTA_SALA } from "../mundo/cidade/sala3d.js";
import { plantaCentro } from "../mundo/cidade/centro.js";
import { plantaLoja } from "../mundo/cidade/loja.js";
import { plantaLaboratorio, ORIGEM_LAB_X, ORIGEM_LAB_Y, COLS_LAB, ROWS_LAB } from "../mundo/cidade/laboratorio.js";
import {
  ORIGEM_SANTUARIO_X,
  ORIGEM_SANTUARIO_Y,
  SHRINE_INTERIOR_COLS,
  SHRINE_INTERIOR_ROWS,
  santuarioAtivo,
} from "../santuario/interior.js";

const RAIO_BUSCA = 8;

function celulaHub(planta, x, y) {
  if (!planta) return false;
  const col = Math.floor(x - planta.origemX);
  const row = Math.floor(y - planta.origemY);
  // Vestíbulo da porta (saída / approach da transição).
  if (
    row >= planta.rows &&
    row < planta.rows + 2 &&
    col >= planta.doorX0 &&
    col < planta.doorX1
  ) {
    return true;
  }
  if (col < 0 || row < 0 || col >= planta.cols || row >= planta.rows) return false;
  return planta.muro[row * planta.cols + col] !== 1;
}

function celulaCasa(x, y) {
  const m = medidasSala();
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  // Vestíbulo da porta (saída).
  if (iy >= m.portaY && iy < m.portaY + PROF_PORTA_SALA) {
    return ix >= m.portaX0 && ix < m.portaX1;
  }
  return ix >= m.chaoX0 && ix < m.chaoX1 && iy >= m.chaoY0 && iy < m.chaoY1;
}

function celulaLab(x, y) {
  const planta = plantaLaboratorio();
  const col = Math.floor(x - ORIGEM_LAB_X);
  const row = Math.floor(y - ORIGEM_LAB_Y);
  if (
    planta &&
    row >= ROWS_LAB &&
    row < ROWS_LAB + 2 &&
    col >= planta.doorX0 &&
    col < planta.doorX1
  ) {
    return true;
  }
  if (col < 0 || row < 0 || col >= COLS_LAB || row >= ROWS_LAB) return false;
  return !planta || planta.muro[row * COLS_LAB + col] !== 1;
}

function celulaSantuario(x, y) {
  const hub = santuarioAtivo();
  if (!hub) return false;
  const mask = hub.walkMask || hub.floorMask;
  if (!mask) return false;
  const tx = Math.floor(x - ORIGEM_SANTUARIO_X);
  const ty = Math.floor(y - ORIGEM_SANTUARIO_Y);
  if (tx < 0 || ty < 0 || tx >= SHRINE_INTERIOR_COLS || ty >= SHRINE_INTERIOR_ROWS) return false;
  const cols = (hub.cols | 0) || SHRINE_INTERIOR_COLS;
  return mask[ty * cols + tx] === 1;
}

/** True se o jogador está num bolso 3D. */
export function ehInteriorSala3d() {
  return !!estado.interior?.sala3d;
}

/** True se (x,y) é chão autorado do interior ativo, ou outdoor. */
export function pisoInteriorValido(x, y) {
  const papel = estado.interior?.papel;
  if (!papel) return true;
  if (papel === "casa") return celulaCasa(x, y);
  if (papel === "centro") return celulaHub(plantaCentro(), x, y);
  if (papel === "loja") return celulaHub(plantaLoja(), x, y);
  if (papel === "lab") return celulaLab(x, y);
  if (papel === "santuario") return celulaSantuario(x, y);
  return true;
}

/**
 * Se o ponto for inválido indoor, busca em espiral o tile válido mais perto de (refX, refY).
 * Outdoor: devolve o ponto original. Indoor sem tile: null.
 * @returns {{ x: number, y: number } | null}
 */
export function resolverPisoInterior(x, y, refX = x, refY = y) {
  if (!estado.interior?.sala3d) return { x, y };
  if (pisoInteriorValido(x, y)) return { x, y };

  const cx = Math.floor(refX);
  const cy = Math.floor(refY);
  let melhor = null;
  let melhorD = Infinity;
  for (let ring = 0; ring <= RAIO_BUSCA; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const tx = cx + dx + 0.5;
        const ty = cy + dy + 0.5;
        if (!pisoInteriorValido(tx, ty)) continue;
        const d = (tx - refX) * (tx - refX) + (ty - refY) * (ty - refY);
        if (d < melhorD) {
          melhorD = d;
          melhor = { x: tx, y: ty };
        }
      }
    }
    if (melhor) return melhor;
  }
  return null;
}

/**
 * Se o ator saiu do piso indoor, empurra de volta e zera velocidade.
 * @returns {boolean} true se conteve
 */
export function conterNoInterior(ator) {
  if (!ator || !estado.interior?.sala3d) return false;
  if (pisoInteriorValido(ator.x, ator.y)) return false;
  const ok = resolverPisoInterior(ator.x, ator.y, ator.x, ator.y);
  if (!ok) return false;
  ator.x = ok.x;
  ator.y = ok.y;
  ator.vx = 0;
  ator.vy = 0;
  ator.vz = 0;
  const z = ator.elevacao ?? ator.z ?? 0;
  if (!(z > 0)) {
    ator.z = ALTURA_PRACA;
    ator.elevacao = ALTURA_PRACA;
    ator.noChao = true;
  }
  return true;
}
