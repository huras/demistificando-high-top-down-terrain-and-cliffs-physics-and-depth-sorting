import {
  CAMERA_SUAVIDADE,
  ESCALA,
  FACE_H,
  TILE,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../config.js";
import { COLUNAS, LINHAS } from "../mundo/mapaDemo.js";

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
 */
export function seguirAlvo(camera, alvoX, alvoY, alvoZ, hopLift = 0, dt = 1 / 60) {
  const mundoW = COLUNAS * TILE * ESCALA;
  const mundoH = (LINHAS * TILE + 4 * FACE_H) * ESCALA;
  const viewW = camera.largura / camera.zoom;
  const viewH = camera.altura / camera.zoom;
  const sx = mundoParaTelaX(alvoX);
  const sy = mundoParaTelaY(alvoY, alvoZ, hopLift);
  let alvoCamX = sx - viewW * 0.5;
  let alvoCamY = sy - viewH * 0.5;
  alvoCamX = clamp(alvoCamX, -80, Math.max(-80, mundoW - viewW + 80));
  alvoCamY = clamp(alvoCamY, -120, Math.max(-120, mundoH - viewH + 120));

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
