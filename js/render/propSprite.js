import { ESCALA, VEG_ARVORE_ESCALA, VEG_MATA_ESCALA } from "../config.js";
import { fracaoBaseDoProp } from "./pivoProfundidade.js";

/** Imagem do prop: sprite do kit, ou árvore/mata do mapa autoral. */
export function imagemDoProp(prop, atlas) {
  if (!prop || prop.tipo === "placa") return null;
  if (prop.sprite && atlas?.sprites?.[prop.sprite]) return atlas.sprites[prop.sprite];
  if (prop.tipo === "arvore") return atlas?.arvore || null;
  if (prop.tipo === "mata" || prop.tipo === "grama") return atlas?.mata || null;
  return null;
}

/**
 * Escala do tipo e fração da base até a raiz (depth-sort).
 * A raiz fica no chão; o que está abaixo dela entra no terreno.
 */
export function desenhoDoProp(prop) {
  let escala = VEG_MATA_ESCALA;
  if (prop?.tipo === "arvore") escala = VEG_ARVORE_ESCALA;
  else if (prop?.tipo === "pedra" || prop?.tipo === "cristal") escala = 1;
  return {
    escala,
    fracaoBase: fracaoBaseDoProp(prop),
  };
}

export function caixaDoProp(prop, px, py, atlas) {
  const img = imagemDoProp(prop, atlas);
  if (!img) return null;
  const { escala, fracaoBase } = desenhoDoProp(prop);
  const dw = img.width * ESCALA * escala;
  const dh = img.height * ESCALA * escala;
  return {
    x0: px - dw * 0.5,
    y0: py - dh * (1 - fracaoBase),
    x1: px + dw * 0.5,
    y1: py + dh * fracaoBase,
  };
}
