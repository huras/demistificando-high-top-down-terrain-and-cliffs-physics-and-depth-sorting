/**
 * Limpa FX / projéteis / ki de combate no campo ou na arena.
 * Um único caminho — morte, respawn e luta reusam.
 */

import { limparFlutuantes } from "../flutuantes.js";
import { cancelarConjuracao } from "./executor.js";
import { limparFx } from "./fx/index.js";
import { limparKi } from "./ki.js";
import { limparParticulas } from "./particulas.js";
import { limparProjeteis } from "./projeteis.js";

/** @param {unknown[] | null | undefined} atores — quem cancela conjuração (treinador, party, lutadores). */
export function limparCampoCombate(atores) {
  const lista = Array.isArray(atores) ? atores : [];
  for (let i = 0; i < lista.length; i++) {
    if (lista[i]) cancelarConjuracao(lista[i]);
  }
  limparProjeteis();
  limparParticulas();
  limparFx();
  limparFlutuantes();
  limparKi();
}
