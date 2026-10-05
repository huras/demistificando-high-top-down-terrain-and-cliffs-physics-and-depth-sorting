import { ESCALA, FACE_H, TILE } from "../config.js";
import { COLUNAS, LINHAS } from "../mundo/mapaDemo.js";

export function criarCamera(larguraCss, alturaCss) {
  return {
    x: 0,
    y: 0,
    largura: larguraCss,
    altura: alturaCss,
  };
}

export function seguirAlvo(camera, alvoX, alvoY, alvoZ) {
  const mundoW = COLUNAS * TILE * ESCALA;
  const mundoH = (LINHAS * TILE + 4 * FACE_H) * ESCALA;
  const sx = mundoParaTelaX(alvoX);
  const sy = mundoParaTelaY(alvoY, alvoZ);
  camera.x = sx - camera.largura * 0.5;
  camera.y = sy - camera.altura * 0.5;
  camera.x = clamp(camera.x, -40, Math.max(-40, mundoW - camera.largura + 40));
  camera.y = clamp(camera.y, -80, Math.max(-80, mundoH - camera.altura + 80));
}

export function mundoParaTelaX(x) {
  return x * TILE * ESCALA;
}

/** Fórmula-chave: Y da tela = profundidade − elevação. */
export function mundoParaTelaY(y, z, hopLift = 0) {
  return (y * TILE - z * FACE_H - hopLift * TILE) * ESCALA;
}

export function aplicarCamera(ctx, camera) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(-camera.x, -camera.y);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
