/**
 * Highlight do tile sob o cursor — 2D outline + marcador 3D reutilizado.
 */
import { ESCALA, FACE_H, TILE } from "../config.js";
import { obterHoverBloco, textoHoverBloco } from "../entrada/hoverBloco.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";

/**
 * Desenha outline do topo do bloco (espaço mundo, câmera já aplicada).
 */
export function desenharHoverTile2d(ctx) {
  const h = obterHoverBloco();
  if (!h || !ctx) return;

  const zTopo = h.z + 1;
  const px = mundoParaTelaX(h.x);
  const py = mundoParaTelaY(h.y, zTopo);
  const s = TILE * ESCALA;
  const faceH = FACE_H * ESCALA;

  ctx.save();
  // Fill suave no topo
  ctx.fillStyle = "rgba(125, 206, 106, 0.18)";
  ctx.fillRect(px, py, s, s);

  // Contorno topo
  ctx.strokeStyle = "rgba(232, 255, 224, 0.95)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 0.75, py + 0.75, s - 1.5, s - 1.5);

  // Aresta sul (profundidade high top-down)
  const fy = py + s - 1;
  ctx.fillStyle = "rgba(125, 206, 106, 0.12)";
  ctx.fillRect(px, fy, s, faceH);
  ctx.strokeStyle = "rgba(125, 206, 106, 0.75)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 0.5, fy);
  ctx.lineTo(px + 0.5, fy + faceH);
  ctx.lineTo(px + s - 0.5, fy + faceH);
  ctx.lineTo(px + s - 0.5, fy);
  ctx.stroke();

  ctx.restore();
}

/**
 * Label HUD (screen space) com coords do hover.
 * @param {boolean} [mira3d] desenha cruz no centro (pointer lock).
 */
export function desenharLabelHoverHud(ctx, canvasW, canvasH, mira3d = false) {
  if (!ctx) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (mira3d) {
    const cx = canvasW * 0.5;
    const cy = canvasH * 0.5;
    const r = 6;
    ctx.strokeStyle = "rgba(232, 255, 224, 0.85)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
  }

  const texto = textoHoverBloco();
  if (texto) {
    ctx.font = "12px Cascadia Mono, Consolas, monospace";
    const padX = 10;
    const tw = ctx.measureText(texto).width;
    const w = tw + padX * 2;
    const h = 22;
    const x = 18;
    const y = canvasH - 56;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#d8f0d0";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, x + padX, y + h * 0.5);
  }

  ctx.restore();
}

/**
 * Cria marcador 3D (EdgesGeometry) — 1 mesh, só move quando a célula muda.
 * @param {typeof import("three")} THREE
 */
export function criarMarcadorHover3d(THREE) {
  const geo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();

  const mat = new THREE.LineBasicMaterial({
    color: 0xb8f0a0,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
  });
  const lines = new THREE.LineSegments(edges, mat);
  lines.visible = false;
  lines.renderOrder = 3;
  lines.frustumCulled = true;

  // Fill sutil
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x7dce6a,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const fill = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), fillMat);
  fill.renderOrder = 2;
  lines.add(fill);

  let lastKey = "";

  return {
    mesh: lines,
    atualizar() {
      const h = obterHoverBloco();
      if (!h) {
        if (lastKey !== "") {
          lines.visible = false;
          lastKey = "";
        }
        return;
      }
      const k = h.x + "," + h.y + "," + h.z;
      if (k !== lastKey) {
        // Three: (x, altura, y_mundo)
        lines.position.set(h.x + 0.5, h.z + 0.5, h.y + 0.5);
        lastKey = k;
      }
      lines.visible = true;
      const pulso = 0.88 + 0.12 * Math.sin(performance.now() * 0.008);
      mat.opacity = pulso;
    },
  };
}
