/**
 * Topologia dos arcos elétricos do glifo (pura — sem draw).
 * Paridade Pokemon AI letterPuzzleArcTopology.
 */

/**
 * Arestas Chebyshev ≤ 1 entre células `#` (pares i < j).
 * @param {readonly { x: number, y: number }[]} cells
 * @returns {Uint16Array}
 */
export function arestasArcoLetra(cells) {
  const n = cells?.length | 0;
  if (n < 2) return new Uint16Array(0);
  /** @type {number[]} */
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const a = cells[i];
    for (let j = i + 1; j < n; j++) {
      const b = cells[j];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx <= 1 && dy <= 1 && (dx | dy) !== 0) {
        pairs.push(i, j);
      }
    }
  }
  return Uint16Array.from(pairs);
}

/**
 * Centros world das células `#` (ordem = cells).
 * @param {number} originX
 * @param {number} originY
 * @param {readonly { x: number, y: number }[]} cells
 * @returns {{ xs: Float32Array, ys: Float32Array }}
 */
export function centrosArcoLetra(originX, originY, cells) {
  const n = cells?.length | 0;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    xs[i] = originX + c.x + 0.5;
    ys[i] = originY + c.y + 0.5;
  }
  return { xs, ys };
}
