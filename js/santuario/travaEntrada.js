/**
 * Puzzle 4×4 e unlock de entrada de santuário.
 */

export const PUZZLE_SIZE = 4;
export const PUZZLE_PIECE_COUNT = PUZZLE_SIZE * PUZZLE_SIZE;

function hashStr(value) {
  const s = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function puzzlePieceSliceStyle(pieceIndex, imageUrl) {
  const n = PUZZLE_SIZE;
  const row = Math.floor(pieceIndex / n);
  const col = pieceIndex % n;
  const denom = Math.max(1, n - 1);
  const xPct = (col / denom) * 100;
  const yPct = (row / denom) * 100;
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundSize: `${n * 100}% ${n * 100}%`,
    backgroundPosition: `${xPct}% ${yPct}%`,
    backgroundRepeat: "no-repeat",
  };
}

export function shuffledPuzzleOrder(seedKey) {
  const order = Array.from({ length: PUZZLE_PIECE_COUNT }, (_, i) => i);
  const rng = mulberry32(hashStr(seedKey) ^ 0x50555a4c);
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    if (!isPuzzleSolved(order)) return order;
  }
  order[0] = 1;
  order[1] = 0;
  return order;
}

export function isPuzzleSolved(order) {
  if (!order?.length || order.length !== PUZZLE_PIECE_COUNT) return false;
  for (let i = 0; i < order.length; i++) {
    if (order[i] !== i) return false;
  }
  return true;
}
