import {
  CAMERA_SUAVIDADE,
  ESCALA,
  FACE_H,
  TILE,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../config.js";
export function criarCamera(larguraCss, alturaCss) {
  return {
    x: 0,
    y: 0,
    largura: larguraCss,
    altura: alturaCss,
    zoom: 1,
    pronta: false,
  };
}

export function ajustarZoom(camera, fator) {
  camera.zoom = clamp(camera.zoom * fator, ZOOM_MIN, ZOOM_MAX);
}

/**
 * Segue o alvo com lerp — inclui hopLift pra não teletransportar na troca de z.
 * Mundo infinito: sem clamp rígido de bounds.
 */
export function seguirAlvo(camera, alvoX, alvoY, alvoZ, hopLift = 0, dt = 1 / 60) {
  const viewW = camera.largura / camera.zoom;
  const viewH = camera.altura / camera.zoom;
  const sx = mundoParaTelaX(alvoX);
  const sy = mundoParaTelaY(alvoY, alvoZ, hopLift);
  const alvoCamX = sx - viewW * 0.5;
  const alvoCamY = sy - viewH * 0.5;

  if (!camera.pronta) {
    camera.x = alvoCamX;
    camera.y = alvoCamY;
    camera.pronta = true;
    return;
  }

  // exp lerp estável em dt variável
  const t = 1 - Math.exp(-CAMERA_SUAVIDADE * dt);
  camera.x += (alvoCamX - camera.x) * t;
  camera.y += (alvoCamY - camera.y) * t;
}

export function mundoParaTelaX(x) {
  return x * TILE * ESCALA;
}

/** Fórmula-chave: Y da tela = profundidade − elevação. */
export function mundoParaTelaY(y, z, hopLift = 0) {
  return (y * TILE - z * FACE_H - hopLift * TILE) * ESCALA;
}

export function aplicarCamera(ctx, camera) {
  const z = camera.zoom;
  ctx.setTransform(z, 0, 0, z, -camera.x * z, -camera.y * z);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
