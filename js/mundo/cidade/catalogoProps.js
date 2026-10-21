/**
 * Props 3D de interior/cidade (Diamond/Pearl).
 * Pasta relativa a assets/models/cidade/props/.
 * alturaAlvo em espaço do grupo da cidade (mesmo das paredes/balcão).
 *
 * Mesas: bounds reais do OBJ (unidades DP). Escala XZ por alturaAlvo →
 * worldXZ ≈ modeloXZ * (alturaAlvo / modeloY); escalaY multiplica só a altura.
 */
export const BASE_PROPS = "assets/models/cidade/props/";

/** Bounds medidos do modelo.obj (X largura, Y altura, Z profundidade). */
const MESA_BOUNDS = Object.freeze({
  1: Object.freeze({ x: 16, y: 12.5, z: 16 }),
  2: Object.freeze({ x: 32, y: 12.5, z: 16 }),
  3: Object.freeze({ x: 48, y: 12.5, z: 16 }),
  4: Object.freeze({ x: 64, y: 12.5, z: 16 }),
  5: Object.freeze({ x: 16, y: 12.5, z: 32 }),
  6: Object.freeze({ x: 32, y: 12.5, z: 32 }),
  7: Object.freeze({ x: 48, y: 12.5, z: 32 }),
  8: Object.freeze({ x: 64, y: 12.5, z: 32 }),
  9: Object.freeze({ x: 16, y: 12.5, z: 48 }),
  10: Object.freeze({ x: 32, y: 12.5, z: 48 }),
  11: Object.freeze({ x: 48, y: 12.5, z: 48 }),
  12: Object.freeze({ x: 64, y: 12.5, z: 48 }),
  13: Object.freeze({ x: 36, y: 16.5, z: 28 }),
  14: Object.freeze({ x: 20, y: 16.5, z: 28 }),
  15: Object.freeze({ x: 33.05, y: 12.5, z: 31 }),
});

function classeMesa(b) {
  const area = b.x * b.z;
  if (area <= 400) return "pequena";
  if (area <= 1200) return "media";
  return "grande";
}

/** alturaAlvo pra worldXZ aproximar o alvo (tiles), ancorado na maior dimensão XZ. */
function alturaParaMesa(b, alvoMaiorEixo) {
  const maior = Math.max(b.x, b.z);
  return (alvoMaiorEixo * b.y) / maior;
}

function mesas() {
  const out = {};
  for (let i = 1; i <= 15; i++) {
    const b = MESA_BOUNDS[i];
    const classe = classeMesa(b);
    const alvo =
      classe === "pequena" ? 1.5 : classe === "media" ? 2.6 : 4.2;
    out[`mesa-${i}`] = Object.freeze({
      pasta: `mesa-${i}`,
      alturaAlvo: alturaParaMesa(b, alvo),
      escalaY: 2,
      classe,
      bounds: b,
    });
  }
  return out;
}

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
  correio: Object.freeze({ pasta: "correio", alturaAlvo: 1.35 }),
  cama: Object.freeze({ pasta: "cama", alturaAlvo: 1.15 }),
  ...mesas(),
});

/**
 * Casa: sprite ~1.5×1.5 → mesa-1 (16×16).
 * Lab/centro escolhem ids diretos alinhados ao footprint do sprite/disco.
 */
export const PROP_POR_SPRITE = Object.freeze({
  cura: "cura",
  mesa: "mesa-1",
  "cama-azul": "cama",
  "cama-vermelha": "cama",
  "cama-verde": "cama",
});

/** Lab: sprite ~3.06×1.44 → mesa-3 / mesa-2 (48×16 / 32×16). */
export const MESAS_LAB = Object.freeze(["mesa-3", "mesa-2"]);

/** Centro: disco r≈0.85, área de espera → mesa-6 (32×32). */
export const MESA_CENTRO = "mesa-6";

export const TINT_CAMA = Object.freeze({
  "cama-azul": "#6aa8e8",
  "cama-vermelha": "#e06a6a",
  "cama-verde": "#6cbc7a",
});

export function defDoProp(id) {
  return CATALOGO_PROPS[id] || null;
}

export function propDoSprite(idSprite) {
  return PROP_POR_SPRITE[idSprite] || null;
}

export function tintDaCama(idSprite) {
  return TINT_CAMA[idSprite] || null;
}
