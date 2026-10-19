import { ESCALA, VEG_ARVORE_ESCALA, VEG_MATA_ESCALA } from "../config.js";
import { pivoDaImagem } from "./pivoPe.js";
import { ESCALA_ARBUSTO, imagemArbusto } from "./3d/folhaBerry.js";

/** Imagem do prop: sprite do kit, ou árvore/mata do mapa autoral. */
export function imagemDoProp(prop, atlas) {
  if (!prop || prop.tipo === "placa") return null;
  if (prop.tipo === "berry") return imagemArbusto(prop.berryKey, prop.estagio || "maduro");
  if (prop.sprite && atlas?.sprites?.[prop.sprite]) return atlas.sprites[prop.sprite];
  if (prop.tipo === "arvore") return atlas?.arvore || null;
  if (prop.tipo === "mata" || prop.tipo === "grama") return atlas?.mata || null;
  return null;
}

/** Escala do tipo e fração Y do pé opaco (1 = base da imagem). */
export function desenhoDoProp(prop, img) {
  let escala = VEG_MATA_ESCALA;
  if (prop?.tipo === "berry") escala = ESCALA_ARBUSTO;
  else if (prop?.tipo === "arvore") escala = VEG_ARVORE_ESCALA;
  else if (prop?.tipo === "pedra" || prop?.tipo === "cristal") escala = 1;
  return {
    escala,
    pivotY: img ? pivoDaImagem(img).y : 1,
  };
}

export function caixaDoProp(prop, px, py, atlas) {
  const img = imagemDoProp(prop, atlas);
  if (!img) return null;
  const { escala, pivotY } = desenhoDoProp(prop, img);
  const dw = img.width * ESCALA * escala;
  const dh = img.height * ESCALA * escala;
  return {
    x0: px - dw * 0.5,
    y0: py - dh * pivotY,
    x1: px + dw * 0.5,
    y1: py + dh * (1 - pivotY),
  };
}
