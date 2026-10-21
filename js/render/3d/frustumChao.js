/**
 * AABB do chão visível pela câmera (4 cantos NDC → plano z≈elevação).
 */
import { CHUNK_XZ, ESCALA, TILE } from "../../config.js";
import { raioDoPonteiro } from "./camera3d.js";

const MARGEM = CHUNK_XZ * 0.5;
const aabb = { x0: 0, y0: 0, x1: -1, y1: -1 };
const cantosNdc = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function intersecaoChao(raio, elev) {
  const dz = raio.dz;
  if (Math.abs(dz) < 1e-6) {
    return { x: raio.ox + raio.dx * 40, y: raio.oy + raio.dy * 40 };
  }
  const t = (elev - raio.oz) / dz;
  if (t < 0) {
    // Plano atrás: projeta um pouco à frente da câmera.
    const tf = 8;
    return { x: raio.ox + raio.dx * tf, y: raio.oy + raio.dy * tf };
  }
  return { x: raio.ox + raio.dx * t, y: raio.oy + raio.dy * t };
}

/**
 * Retorna AABB mundo {x0,y0,x1,y1} ou null se câmera inválida.
 */
export function aabbVisivelChao(camera3d, elev = 0) {
  if (!camera3d?.cam && !camera3d?.isPerspectiveCamera && !camera3d?.isOrthographicCamera) {
    return null;
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let ok = 0;
  for (let i = 0; i < 4; i++) {
    const ndc = cantosNdc[i];
    const raio = raioDoPonteiro(camera3d, ndc[0], ndc[1]);
    if (!raio) continue;
    const p = intersecaoChao(raio, elev);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
    ok++;
  }
  if (ok < 2 || x1 < x0 || y1 < y0) return null;
  // Limita AABB absurdo (câmera olhando o céu / horizonte).
  const maxSpan = CHUNK_XZ * 16;
  let cx = (x0 + x1) * 0.5;
  let cy = (y0 + y1) * 0.5;
  let hw = (x1 - x0) * 0.5;
  let hh = (y1 - y0) * 0.5;
  if (hw > maxSpan * 0.5) hw = maxSpan * 0.5;
  if (hh > maxSpan * 0.5) hh = maxSpan * 0.5;
  aabb.x0 = cx - hw - MARGEM;
  aabb.y0 = cy - hh - MARGEM;
  aabb.x1 = cx + hw + MARGEM;
  aabb.y1 = cy + hh + MARGEM;
  return aabb;
}

/** Fallback top-down 2D a partir da câmera ortográfica do jogo. */
export function aabbCamera2d(camera) {
  if (!camera || !Number.isFinite(camera.largura)) return null;
  const viewW = camera.largura / (camera.zoom || 1);
  const viewH = camera.altura / (camera.zoom || 1);
  const escala = TILE * ESCALA;
  // camera.x/y estão em espaço de tela; centro aproximado pelo alvo.
  const cx = (camera.x + viewW * 0.5) / escala;
  const cy = (camera.y + viewH * 0.5) / escala;
  const hw = (viewW / escala) * 0.55;
  const hh = (viewH / escala) * 0.55;
  aabb.x0 = cx - hw - MARGEM;
  aabb.y0 = cy - hh - MARGEM;
  aabb.x1 = cx + hw + MARGEM;
  aabb.y1 = cy + hh + MARGEM;
  return aabb;
}

export function chunkNaTela(cx, cy, caixa) {
  if (!caixa || caixa.x1 < caixa.x0) return false;
  const x0 = cx * CHUNK_XZ;
  const y0 = cy * CHUNK_XZ;
  const x1 = x0 + CHUNK_XZ;
  const y1 = y0 + CHUNK_XZ;
  return !(x1 < caixa.x0 || x0 > caixa.x1 || y1 < caixa.y0 || y0 > caixa.y1);
}
