/** Um acerto no prop, seja do Pokémon ou da hotbar. */

import { cortarArvore, queimarArvore } from "./cicloArvore.js";
import { ACAO } from "./capacidades.js";
import { acenderGramaEm } from "./grama.js";
import { minerarProp } from "./mineracao.js";
import { sfx } from "../jogo/audio.js";

export function executarNoProp(acao, prop) {
  if (!prop) return "nao";
  if (acao === ACAO.CORTAR) return cortarArvore(prop);
  if (acao === ACAO.QUEIMAR) {
    if (prop.tipo === "grama") {
      const n = acenderGramaEm(prop.x, prop.y, Date.now(), prop);
      if (n <= 0) return "nao";
      sfx("cavar");
      return "grama";
    }
    return queimarArvore(prop);
  }
  if (acao === ACAO.MINERAR) return minerarProp(prop, 1);
  if (acao === ACAO.QUEBRAR) {
    if (prop.tipo !== "pedra") return "nao";
    return minerarProp(prop, 1.35);
  }
  return "nao";
}

export function textoDoAcerto(resultado, prop) {
  if (resultado === "queda") return "A árvore está caindo.";
  if (resultado === "espera") return "Espera um instante.";
  if (resultado === "madeira") return "Madeira obtida.";
  if (resultado === "carvao") return "Carvão obtido.";
  if (resultado === "pedra") return "Pedra obtida.";
  if (resultado === "cristal") return "Cristal obtido.";
  if (resultado === "fogo" || resultado === "grama") return "Pegou fogo.";
  if (resultado === "nao") {
    if (prop?.tipo === "arvore") return "Não dá para fazer isso nessa árvore.";
    if (prop?.tipo === "pedra" || prop?.tipo === "cristal") return "Não dá para minerar isso.";
    return "Nada para usar aqui.";
  }
  return "";
}
