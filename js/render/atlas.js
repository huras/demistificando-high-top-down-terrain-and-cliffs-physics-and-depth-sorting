import { CAMINHOS } from "../config.js";

export async function carregarImagem(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

/** Só o sprite do jogador — terreno é fallback de cubos (sem tiling). */
export async function montarAtlas(caminhos = CAMINHOS) {
  const jogador = await carregarImagem(caminhos.jogador);
  return { jogador };
}
