/**
 * Clique no Pokémon selvagem desenhado sob o cursor.
 */
import { obterModo } from "../modoJogo.js";
import { projetar2d, projetar3d } from "./hud.js";
import { ordenarAtaque } from "./party.js";
import { atoresVisiveis } from "./sistema.js";

const RAIO_PX = 72;

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
