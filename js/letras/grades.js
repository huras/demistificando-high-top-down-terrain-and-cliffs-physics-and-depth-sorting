/**
 * Letras A–Z na menor grade reconhecível como pedras no chão.
 * Fonte 3×5 (Tom Thumb); M/W abrem para 5 colunas; G/N/Q para 4.
 * `#` = tile preenchido (pedra B); `.` = vazio.
 */

export const LETTER_ROWS = Object.freeze({
  A: Object.freeze([".#.", "#.#", "###", "#.#", "#.#"]),
  B: Object.freeze(["##.", "#.#", "##.", "#.#", "##."]),
  C: Object.freeze(["###", "#..", "#..", "#..", "###"]),
  D: Object.freeze(["##.", "#.#", "#.#", "#.#", "##."]),
  E: Object.freeze(["###", "#..", "##.", "#..", "###"]),
  F: Object.freeze(["###", "#..", "##.", "#..", "#.."]),
  G: Object.freeze(["####", "#...", "#.##", "#..#", "####"]),
  H: Object.freeze(["#.#", "#.#", "###", "#.#", "#.#"]),
  I: Object.freeze(["###", ".#.", ".#.", ".#.", "###"]),
  J: Object.freeze(["###", "..#", "..#", "#.#", ".#."]),
  K: Object.freeze(["#.#", "#.#", "##.", "#.#", "#.#"]),
  L: Object.freeze(["#..", "#..", "#..", "#..", "###"]),
  M: Object.freeze(["#...#", "##.##", "#.#.#", "#...#", "#...#"]),
  N: Object.freeze(["#..#", "##.#", "#.##", "#..#", "#..#"]),
  O: Object.freeze(["###", "#.#", "#.#", "#.#", "###"]),
  P: Object.freeze(["##.", "#.#", "##.", "#..", "#.."]),
  Q: Object.freeze(["###.", "#.#.", "#.#.", "###.", "...#"]),
  R: Object.freeze(["##.", "#.#", "##.", "#.#", "#.#"]),
  S: Object.freeze(["###", "#..", "###", "..#", "###"]),
  T: Object.freeze(["###", ".#.", ".#.", ".#.", ".#."]),
  U: Object.freeze(["#.#", "#.#", "#.#", "#.#", "###"]),
  V: Object.freeze(["#.#", "#.#", "#.#", "#.#", ".#."]),
  W: Object.freeze(["#...#", "#...#", "#.#.#", "##.##", "#...#"]),
  X: Object.freeze(["#.#", "#.#", ".#.", "#.#", "#.#"]),
  Y: Object.freeze(["#.#", "#.#", ".#.", ".#.", ".#."]),
  Z: Object.freeze(["###", "..#", ".#.", "#..", "###"]),
});

export const LETTER_ORDER = Object.freeze(Object.keys(LETTER_ROWS));

/**
 * @param {readonly string[]} rows
 * @returns {{ w: number, h: number, cells: readonly { x: number, y: number }[], filled: number }}
 */
export function parseLetterRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const h = list.length;
  let w = 0;
  for (const row of list) w = Math.max(w, String(row || "").length);
  /** @type {{ x: number, y: number }[]} */
  const cells = [];
  for (let y = 0; y < h; y++) {
    const row = String(list[y] || "");
    for (let x = 0; x < w; x++) {
      if (row[x] === "#") cells.push({ x, y });
    }
  }
  return Object.freeze({
    w,
    h,
    cells: Object.freeze(cells),
    filled: cells.length,
  });
}

/**
 * @param {string} letter
 * @returns {{ letter: string, rows: readonly string[], w: number, h: number, cells: readonly { x: number, y: number }[], filled: number } | null}
 */
export function getLetterGrid(letter) {
  const key = String(letter || "").toUpperCase();
  const rows = LETTER_ROWS[key];
  if (!rows) return null;
  const parsed = parseLetterRows(rows);
  return Object.freeze({
    letter: key,
    rows,
    ...parsed,
  });
}

/**
 * Escala nearest-neighbor da grade (ex.: 2 → cada `#` vira bloco 2×2).
 * @param {readonly string[]} rows
 * @param {number} [scale]
 * @returns {string[]}
 */
export function scaleLetterRows(rows, scale = 2) {
  const s = Math.max(1, Math.floor(Number(scale) || 1));
  if (s === 1) return Array.isArray(rows) ? rows.map((r) => String(r || "")) : [];
  /** @type {string[]} */
  const out = [];
  const list = Array.isArray(rows) ? rows : [];
  for (let y = 0; y < list.length; y++) {
    const row = String(list[y] || "");
    let scaled = "";
    for (let x = 0; x < row.length; x++) {
      scaled += row[x].repeat(s);
    }
    for (let i = 0; i < s; i++) out.push(scaled);
  }
  return out;
}

/**
 * @param {string} letter
 * @param {number} [scale]
 * @returns {{ letter: string, rows: readonly string[], w: number, h: number, cells: readonly { x: number, y: number }[], filled: number, scale: number } | null}
 */
export function getScaledLetterGrid(letter, scale = 2) {
  const base = getLetterGrid(letter);
  if (!base) return null;
  const s = Math.max(1, Math.floor(Number(scale) || 1));
  if (s === 1) {
    return Object.freeze({ ...base, scale: 1 });
  }
  const rows = Object.freeze(scaleLetterRows(base.rows, s));
  const parsed = parseLetterRows(rows);
  return Object.freeze({
    letter: base.letter,
    rows,
    ...parsed,
    scale: s,
  });
}

/** @returns {readonly ReturnType<typeof getLetterGrid>[]} */
export function listLetterGrids() {
  return LETTER_ORDER.map((letter) => getLetterGrid(letter)).filter(Boolean);
}
