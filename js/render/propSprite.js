import { ESCALA, VEG_ARVORE_ESCALA, VEG_MATA_ESCALA } from "../config.js";

/** Imagem do prop: sprite do kit, ou árvore/mata do mapa autoral. */
export function imagemDoProp(prop, atlas) {
  if (!prop || prop.tipo === "placa") return null;
  if (prop.sprite && atlas?.sprites?.[prop.sprite]) return atlas.sprites[prop.sprite];
  if (prop.tipo === "arvore") return atlas?.arvore || null;
  if (prop.tipo === "mata" || prop.tipo === "grama") return atlas?.mata || null;
  return null;
}

/** Escala e afundamento do pé, em pixels de arte. */
export function desenhoDoProp(prop) {
  if (prop?.tipo === "arvore") return { escala: VEG_ARVORE_ESCALA, pe: 2 };
  if (prop?.tipo === "pedra" || prop?.tipo === "cristal") return { escala: 1, pe: 1 };
  return { escala: VEG_MATA_ESCALA, pe: 1 };
}

export function caixaDoProp(prop, px, py, atlas) {
  const img = imagemDoProp(prop, atlas);
  if (!img) return null;
  const { escala, pe } = desenhoDoProp(prop);
  const dw = img.width * ESCALA * escala;
  const dh = img.height * ESCALA * escala;
  return {
    x0: px - dw * 0.5,
    y0: py - dh + pe * ESCALA,
    x1: px + dw * 0.5,
    y1: py + pe * ESCALA,
  };
}
