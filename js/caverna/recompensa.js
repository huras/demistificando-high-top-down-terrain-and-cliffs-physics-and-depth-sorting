/**
 * Itens da sala premiada. O id fica nas chaves do save: não volta.
 */
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { ORIGEM_CAVERNA_X, ORIGEM_CAVERNA_Y } from "../mundo/bounds.js";
import { darChave, temChave } from "../jogo/estado.js";
import { colocarDropPersistente, removerDropsPersistentes } from "../pokemon/drops.js";
import { layoutAtivo } from "./interior/sessao.js";

const ITENS = Object.freeze(["oran", "sitrus", "leppa", "stone", "blueCrystal"]);

function chaveItem(caveId, salaId, i) {
  return `caverna-item:${caveId}:reward:${salaId}:${i}`;
}

export function limparRecompensaCaverna() {
  removerDropsPersistentes("caverna:");
}

export function soltarRecompensa(sala) {
  const lay = layoutAtivo();
  if (!lay || !sala?.premio || !sala.aberta) return;
  const premio = sala.premio;
  const cx = ORIGEM_CAVERNA_X + (premio.x0 + premio.x1) * 0.5;
  const cy = ORIGEM_CAVERNA_Y + (premio.y0 + premio.y1) * 0.5;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const persistId = `${lay.id}:reward:${sala.id}:${i}`;
    const chaveSave = chaveItem(lay.id, sala.id, i);
    if (temChave(chaveSave)) continue;
    const ang = (i / n) * Math.PI * 2;
    colocarDropPersistente({
      persistId: `caverna:${persistId}`,
      chave: ITENS[i % ITENS.length],
      x: cx + Math.cos(ang) * 1.3,
      y: cy + Math.sin(ang) * 1.1,
      z: ALTURA_PRACA,
      aoPegar: () => darChave(chaveSave),
    });
  }
}

export function soltarRecompensasAbertas() {
  const lay = layoutAtivo();
  if (!lay) return;
  const salas = lay.puzzles || [];
  for (let i = 0; i < salas.length; i++) {
    if (salas[i].aberta) soltarRecompensa(salas[i]);
  }
}
