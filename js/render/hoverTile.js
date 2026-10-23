/**
 * Highlight do tile sob o cursor — 2D outline + marcador 3D reutilizado.
 */
import { ALTURA_BLOCO, ESCALA, FACE_H, TILE } from "../config.js";
import { hoverEmAlcanceEdicao, obterHoverBloco } from "../entrada/hoverBloco.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";

const COR = Object.freeze({
  ok: {
    fill: "rgba(94, 234, 212, 0.45)",
    stroke: "#ecfeff",
    face: "rgba(45, 212, 191, 0.22)",
    faceStroke: "rgba(236, 254, 255, 0.9)",
    telaFill: "rgba(45, 212, 191, 0.55)",
    telaDot: "#ecfeff",
    mat: 0xffffff,
  },
  longe: {
    fill: "rgba(251, 146, 60, 0.42)",
    stroke: "#ffedd5",
    face: "rgba(249, 115, 22, 0.2)",
    faceStroke: "rgba(254, 215, 170, 0.9)",
    telaFill: "rgba(249, 115, 22, 0.5)",
    telaDot: "#ffedd5",
    mat: 0xfb923c,
  },
});

function coresHover() {
  return hoverEmAlcanceEdicao() ? COR.ok : COR.longe;
}

/**
 * Desenha outline do topo do bloco (espaço mundo, câmera já aplicada).
 */
export function desenharHoverTile2d(ctx) {
  const h = obterHoverBloco();
  if (!h || !ctx) return;

  const cor = coresHover();
  const zTopo = h.z + 1;
  const px = mundoParaTelaX(h.x);
  const py = mundoParaTelaY(h.y, zTopo);
  const s = TILE * ESCALA;
  const faceH = FACE_H * ESCALA;

  ctx.save();
  ctx.fillStyle = cor.fill;
  ctx.fillRect(px, py, s, s);
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(6, 18, 22, 0.9)";
  ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = cor.stroke;
  ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);

  const fy = py + s - 1;
  ctx.fillStyle = cor.face;
  ctx.fillRect(px, fy, s, faceH);
  ctx.strokeStyle = cor.faceStroke;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(px + 0.5, fy);
  ctx.lineTo(px + 0.5, fy + faceH);
  ctx.lineTo(px + s - 0.5, fy + faceH);
  ctx.lineTo(px + s - 0.5, fy);
  ctx.stroke();
  ctx.restore();
}

function tracarTile(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function tracarCantos(ctx, pts) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 3) % 4];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const lab = Math.hypot(abx, aby) || 1;
    const lac = Math.hypot(acx, acy) || 1;
    const ub = Math.min(lab * 0.55, 12);
    const uc = Math.min(lac * 0.55, 12);
    const ox = abx / lab + acx / lac;
    const oy = aby / lab + acy / lac;
    const ol = Math.hypot(ox, oy) || 1;
    ctx.moveTo(a.x + (abx / lab) * ub, a.y + (aby / lab) * ub);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(a.x + (acx / lac) * uc, a.y + (acy / lac) * uc);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x - (ox / ol) * 7, a.y - (oy / ol) * 7);
  }
}

/**
 * Quadrado do tile em espaço de tela (por cima do WebGL).
 * `projetarChao(x, y, z)` devolve {x, y} ou null.
 */
export function desenharMarcadorTileTela(ctx, projetarChao) {
  const h = obterHoverBloco();
  if (!h || !projetarChao || !ctx) return;
  const cor = coresHover();
  const z = h.z + 1;
  const pts = [
    projetarChao(h.x, h.y, z),
    projetarChao(h.x + 1, h.y, z),
    projetarChao(h.x + 1, h.y + 1, z),
    projetarChao(h.x, h.y + 1, z),
  ];
  for (let i = 0; i < 4; i++) if (!pts[i]) return;

  const cx = (pts[0].x + pts[2].x) * 0.5;
  const cy = (pts[0].y + pts[2].y) * 0.5;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  tracarTile(ctx, pts);
  ctx.fillStyle = cor.telaFill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(6, 18, 22, 0.92)";
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = cor.telaDot;
  ctx.stroke();
  tracarCantos(ctx, pts);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(6, 18, 22, 0.92)";
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = cor.telaDot;
  ctx.stroke();
  ctx.fillStyle = cor.telaDot;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Mira central (pointer lock). Coords do hover vão no dock do minimapa.
 * @param {boolean} [mira3d] desenha cruz no centro.
 */
export function desenharLabelHoverHud(ctx, canvasW, canvasH, mira3d = false) {
  if (!ctx || !mira3d) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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
  ctx.restore();
}

/**
 * Cria marcador 3D (EdgesGeometry) — 1 mesh, só move quando a célula muda.
 * @param {typeof import("three")} THREE
 */
function texturaCursorTile(THREE) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = "rgba(45, 212, 191, 0.72)";
  g.fillRect(14, 14, 100, 100);
  g.strokeStyle = "rgba(6, 18, 22, 0.95)";
  g.lineWidth = 18;
  g.strokeRect(8, 8, 112, 112);
  g.strokeStyle = "#ecfeff";
  g.lineWidth = 7;
  g.strokeRect(14, 14, 100, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function criarMarcadorHover3d(THREE) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: texturaCursorTile(THREE),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: false,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.visible = false;
  malha.renderOrder = 8;
  malha.frustumCulled = false;

  let lastKey = "";
  let lastAlcance = true;

  return {
    mesh: malha,
    atualizar() {
      const h = obterHoverBloco();
      if (!h) {
        if (lastKey !== "") {
          malha.visible = false;
          lastKey = "";
        }
        return;
      }
      const ok = hoverEmAlcanceEdicao();
      const k = h.x + "," + h.y + "," + h.z;
      if (k !== lastKey) {
        malha.position.set(h.x + 0.5, (h.z + 1) * ALTURA_BLOCO + 0.12, h.y + 0.5);
        lastKey = k;
      }
      if (ok !== lastAlcance) {
        mat.color.setHex(ok ? COR.ok.mat : COR.longe.mat);
        lastAlcance = ok;
      }
      malha.visible = true;
      const pulso = 0.94 + 0.06 * Math.sin(performance.now() * 0.008);
      malha.scale.set(pulso, pulso, 1);
    },
  };
}
