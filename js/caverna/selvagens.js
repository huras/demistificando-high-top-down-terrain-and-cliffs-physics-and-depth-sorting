/**
 * Alcateia da caverna. Espécie e tile vêm do binário assado.
 */
import { criarAtor } from "../pokemon/ator.js";
import { especie } from "../pokemon/dados.js";
import { postosDaCaverna } from "../pokemon/ninhosAssados.js";
import { PERFIL_A_PE } from "../navegacao/perfilMovimento.js";
import { conterNoInterior } from "../jogo/pisoInterior.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { ORIGEM_CAVERNA_X, ORIGEM_CAVERNA_Y } from "../mundo/bounds.js";
import { layoutAtivo } from "./interior/sessao.js";

/** @type {object[]} */
const alcateia = [];

export function limparSelvagensCaverna() {
  alcateia.length = 0;
}

export function selvagensCaverna() {
  return alcateia;
}

export function spawnSelvagensCaverna(_outdoorX, _outdoorY) {
  limparSelvagensCaverna();
  const lay = layoutAtivo();
  if (!lay) return;
  const posts = postosDaCaverna(lay.id);
  for (let i = 0; i < posts.length; i++) {
    const posto = posts[i];
    const esp = especie(posto.speciesKey) || especie("zubat") || especie("pidgey");
    if (!esp) continue;
    const hostil = !!posto.hostil;
    const x = ORIGEM_CAVERNA_X + (posto.tx | 0) + 0.5;
    const y = ORIGEM_CAVERNA_Y + (posto.ty | 0) + 0.5;
    const ator = criarAtor({
      id: `cave-${lay.id}-${posto.posto | 0}`,
      especie: esp,
      nivel: Math.max(1, posto.nivel | 0),
      faccao: "selvagem",
      x,
      y,
      z: ALTURA_PRACA,
      casaX: x,
      casaY: y,
      casaZ: ALTURA_PRACA,
      hostil,
      efemero: true,
      agroPersistente: hostil,
      prefereParty: true,
      dormindo: 0,
      raioTerritorio: 10,
      shiny: !!posto.shiny,
    });
    ator.modo = hostil ? "agro" : "roam";
    ator.raioAgro = hostil ? 12 : 7;
    ator._caverna = true;
    ator.perfil = PERFIL_A_PE;
    alcateia.push(ator);
  }
}

export function tickSelvagensCaverna() {
  for (let i = alcateia.length - 1; i >= 0; i--) {
    const a = alcateia[i];
    if (a.capturado || (a.morto && a.mortoAte && performance.now() >= a.mortoAte)) {
      alcateia.splice(i, 1);
      continue;
    }
    conterNoInterior(a);
  }
}
