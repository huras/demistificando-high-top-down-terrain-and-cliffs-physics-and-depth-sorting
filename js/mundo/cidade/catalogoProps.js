/**
 * Props 3D de interior (Diamond/Pearl). Pasta relativa a assets/models/cidade/props/.
 * alturaAlvo é em espaço do grupo da cidade (mesmo das paredes/balcão).
 */
export const BASE_PROPS = "assets/models/cidade/props/";

export const CATALOGO_PROPS = Object.freeze({
  cura: Object.freeze({ pasta: "cura", alturaAlvo: 1.8 }),
  pc: Object.freeze({ pasta: "pc", alturaAlvo: 1.7 }),
  tela: Object.freeze({ pasta: "tela", alturaAlvo: 1.35, parede: true }),
  "maquina-1": Object.freeze({ pasta: "maquina-1", alturaAlvo: 2.1 }),
  "maquina-2": Object.freeze({ pasta: "maquina-2", alturaAlvo: 1.9 }),
  "maquina-3": Object.freeze({ pasta: "maquina-3", alturaAlvo: 1.9 }),
  "maquina-4": Object.freeze({ pasta: "maquina-4", alturaAlvo: 2.6 }),
  "vaso-1": Object.freeze({ pasta: "vaso-1", alturaAlvo: 1.7 }),
  "vaso-2": Object.freeze({ pasta: "vaso-2", alturaAlvo: 1.55 }),
  bonsai: Object.freeze({ pasta: "bonsai", alturaAlvo: 1.2 }),
  "flores-1": Object.freeze({ pasta: "flores-1", alturaAlvo: 1.15 }),
  "flores-2": Object.freeze({ pasta: "flores-2", alturaAlvo: 1.35 }),
  "flores-3": Object.freeze({ pasta: "flores-3", alturaAlvo: 1.5 }),
  "flores-4": Object.freeze({ pasta: "flores-4", alturaAlvo: 1.45 }),
  "flores-5": Object.freeze({ pasta: "flores-5", alturaAlvo: 1.25 }),
  arvore: Object.freeze({ pasta: "arvore", alturaAlvo: 2.0 }),
});

/** Só a máquina de cura vira OBJ no centro/lab; PC e vasos ficam billboard. */
export const PROP_POR_SPRITE = Object.freeze({
  cura: "cura",
});

export function defDoProp(id) {
  return CATALOGO_PROPS[id] || null;
}

export function propDoSprite(idSprite) {
  return PROP_POR_SPRITE[idSprite] || null;
}
