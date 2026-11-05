/**
 * Projeta metas XY pra fora de discos no mesmo piso.
 * Evita goals dentro de ninho/poste/árvore (viajante, escort, chase).
 */
import { RAIO_CORPO } from "../config.js";
import { invadeDisco } from "../fisica/obstaculos.js";

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [raioCorpo]
 * @returns {{ x: number, y: number, z: number }}
 */
export function projetarMetaLivre(x, y, z, raioCorpo = RAIO_CORPO) {
  const elev = Number.isFinite(z) ? z : 0;
  const r = (raioCorpo > 0 ? raioCorpo : RAIO_CORPO) + 0.04;
  if (!invadeDisco(x, y, elev, r)) return { x, y, z: elev };

  for (let ring = 1; ring <= 12; ring++) {
    const dist = ring * 0.45;
    const passos = 8 + ring * 2;
    for (let k = 0; k < passos; k++) {
      const ang = (k / passos) * Math.PI * 2 + ring * 0.17;
      const nx = x + Math.cos(ang) * dist;
      const ny = y + Math.sin(ang) * dist;
      if (invadeDisco(nx, ny, elev, r)) continue;
      return { x: nx, y: ny, z: elev };
    }
  }
  return { x, y, z: elev };
}
