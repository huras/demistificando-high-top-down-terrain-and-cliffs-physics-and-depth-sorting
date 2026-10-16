/**
 * Clique no Pokémon selvagem desenhado sob o cursor.
 */
import { obterModo } from "../modoJogo.js";
import { projetar2d, projetar3d } from "./hud.js";
import { ordenarAtaque } from "./party.js";
import { atoresVisiveis } from "./sistema.js";

const RAIO_PX = 72;
const RAIO_HOVER = 72;

function dist2AoSegmento(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 1e-4 ? (apx * abx + apy * aby) / ab2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return dx * dx + dy * dy;
}

/**
 * Pokémon sob o cursor. `projetar` aponta o corpo; `projetarPes` o chão.
 * Os dois juntos cobrem o sprite na vertical.
 */
export function atorSobPonteiro(px, py, projetar, projetarPes) {
  if (!projetar || px == null || py == null) return null;
  const lista = atoresVisiveis();
  let melhor = null;
  let melhorD = RAIO_HOVER * RAIO_HOVER;
  for (let i = 0; i < lista.length; i++) {
    const ator = lista[i];
    if (ator.capturado) continue;
    const z = ator.elevacao ?? ator.z ?? 0;
    const hop = ator.hopLift || 0;
    const corpo = projetar(ator.x, ator.y, z, hop);
    if (!corpo) continue;
    const pes = projetarPes ? projetarPes(ator.x, ator.y, z, hop) : null;
    const d = pes
      ? dist2AoSegmento(px, py, pes.x, pes.y, corpo.x, corpo.y)
      : (corpo.x - px) * (corpo.x - px) + (corpo.y - py) * (corpo.y - py);
    if (d < melhorD) {
      melhorD = d;
      melhor = ator;
    }
  }
  return melhor;
}

function ndcDoEvento(ev) {
  const canvas = ev.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const u = (ev.clientX - rect.left) / rect.width;
  const v = (ev.clientY - rect.top) / rect.height;
  return {
    canvas,
    x: u * canvas.width,
    y: v * canvas.height,
    ndcX: u * 2 - 1,
    ndcY: -(v * 2 - 1),
  };
}

export function pokemonSobClique(ev, camera2d, cenario) {
  const tela = ndcDoEvento(ev);
  const modo = obterModo();
  let projetar = null;
  if (modo === "3d") {
    const cam = cenario?.camera3d?.cam;
    if (!cam) return null;
    projetar = projetar3d(cam, tela.canvas.width, tela.canvas.height);
  } else if (camera2d) {
    projetar = projetar2d(camera2d);
  }
  if (!projetar) return null;

  const lista = atoresVisiveis();
  let melhor = null;
  let melhorD = RAIO_PX * RAIO_PX;
  for (let i = 0; i < lista.length; i++) {
    const ator = lista[i];
    if (ator.faccao === "party" || ator.morto || ator.capturado) continue;
    const p = projetar(ator.x, ator.y, ator.elevacao ?? ator.z ?? 0, ator.hopLift || 0);
    if (!p) continue;
    const dx = p.x - tela.x;
    const dy = p.y - tela.y;
    const d = dx * dx + dy * dy;
    if (d < melhorD) {
      melhorD = d;
      melhor = ator;
    }
  }
  return melhor;
}

/** True se o clique mandou o Pokémon em campo atacar. */
export function tentarAtaqueNoClique(ev, camera2d, cenario) {
  const alvo = pokemonSobClique(ev, camera2d, cenario);
  if (!alvo) return false;
  return ordenarAtaque(alvo);
}
