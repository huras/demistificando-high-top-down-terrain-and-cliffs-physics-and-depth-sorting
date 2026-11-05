/**
 * Steering barato longe do player: 3 amostras (frente / ±45°) vs discos.
 */
import { encherDiscos } from "../fisica/obstaculos.js";

const discos = new Float32Array(192);
const ALCANCE = 2.4;
const PASSO = 1.15;

function cortaDisco(x, y, elev, fx, fy) {
  const n = encherDiscos(x, y, ALCANCE, elev, discos);
  if (!n) return false;
  const ax = x + fx * PASSO;
  const ay = y + fy * PASSO;
  const rCorpo = 0.35;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const dx = ax - discos[o];
    const dy = ay - discos[o + 1];
    const rr = rCorpo + discos[o + 3];
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}

/**
 * @param {object} corpo
 * @param {number} nx direção unitária X
 * @param {number} ny direção unitária Y
 * @returns {{ x: number, y: number }}
 */
export function desviarDisco(corpo, nx, ny) {
  if (!corpo) return { x: nx, y: ny };
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  if (!cortaDisco(corpo.x, corpo.y, elev, nx, ny)) {
    return { x: nx, y: ny };
  }
  const ang = Math.atan2(ny, nx);
  const candidatos = [ang + Math.PI * 0.25, ang - Math.PI * 0.25, ang + Math.PI * 0.5, ang - Math.PI * 0.5];
  for (let i = 0; i < candidatos.length; i++) {
    const a = candidatos[i];
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    if (!cortaDisco(corpo.x, corpo.y, elev, fx, fy)) {
      return { x: fx, y: fy };
    }
  }
  // Recua um pouco se tudo bloqueia.
  return { x: -nx, y: -ny };
}
