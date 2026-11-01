/**
 * Labirinto de lápides do cemitério — perfeito + corredor largo na solução.
 */
import { lapideDoSlot } from "./catalogo.js";
import { hash3, rngDe } from "./hash.js";

const DIRS = Object.freeze([
  Object.freeze([0, -1]),
  Object.freeze([1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([-1, 0]),
]);

function chave(x, y) {
  return `${x},${y}`;
}

function resolverLabirinto(parede, entrada) {
  const rows = parede.length;
  const cols = parede[0]?.length ?? 0;
  const fila = [entrada];
  const dist = new Map([[chave(entrada.x, entrada.y), 0]]);
  const ant = new Map();
  let longe = entrada;

  for (let qi = 0; qi < fila.length; qi++) {
    const cur = fila[qi];
    const dCur = dist.get(chave(cur.x, cur.y)) ?? 0;
    const dLonge = dist.get(chave(longe.x, longe.y)) ?? 0;
    if (dCur > dLonge || (dCur === dLonge && cur.y < longe.y)) longe = cur;

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (parede[ny][nx]) continue;
      const k = chave(nx, ny);
      if (dist.has(k)) continue;
      dist.set(k, dCur + 1);
      ant.set(k, cur);
      fila.push({ x: nx, y: ny });
    }
  }

  const rota = [];
  let cursor = longe;
  while (cursor) {
    rota.push(cursor);
    cursor = ant.get(chave(cursor.x, cursor.y)) ?? null;
  }
  rota.reverse();
  return rota;
}

function alargarRota(parede, rota) {
  const rows = parede.length;
  const cols = parede[0]?.length ?? 0;
  for (let i = 0; i < rota.length; i++) {
    const ponto = rota[i];
    const prox = rota[i + 1] ?? rota[i - 1];
    if (!prox) continue;
    const dx = Math.sign(prox.x - ponto.x);
    const dy = Math.sign(prox.y - ponto.y);
    const sx = -dy;
    const sy = dx;
    const x = ponto.x + sx;
    const y = ponto.y + sy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    parede[y][x] = false;
  }
}

function esculpir(cols, rows, rng) {
  /** @type {boolean[][]} */
  const parede = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => true)
  );

  const sx = 1 + 2 * Math.floor(rng() * Math.floor((cols - 1) / 2));
  const sy = 1 + 2 * Math.floor(rng() * Math.floor((rows - 1) / 2));
  parede[sy][sx] = false;

  const pilha = [{ x: sx, y: sy }];
  const saltos = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ];

  while (pilha.length) {
    const cur = pilha[pilha.length - 1];
    const ordem = saltos.slice();
    for (let i = ordem.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = ordem[i];
      ordem[i] = ordem[j];
      ordem[j] = tmp;
    }
    let cavou = false;
    for (const [dx, dy] of ordem) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1) continue;
      if (!parede[ny][nx]) continue;
      parede[ny][nx] = false;
      parede[cur.y + dy / 2][cur.x + dx / 2] = false;
      pilha.push({ x: nx, y: ny });
      cavou = true;
      break;
    }
    if (!cavou) pilha.pop();
  }

  let entradaX = Math.floor(cols / 2);
  if (entradaX % 2 === 0) entradaX += entradaX < cols - 2 ? 1 : -1;
  const entrada = { x: entradaX, y: rows - 1 };
  parede[entrada.y][entrada.x] = false;
  parede[rows - 2][entrada.x] = false;

  const loops = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < loops; i++) {
    const x = 1 + Math.floor(rng() * (cols - 2));
    const y = 1 + Math.floor(rng() * (rows - 2));
    parede[y][x] = false;
  }

  const solucao = resolverLabirinto(parede, entrada);
  alargarRota(parede, solucao);
  return { parede, entrada, solucao };
}

/**
 * @returns {{ props: object[], navegacao: object }}
 */
export function montarLabirintoCemiterio(opts) {
  const ax = opts.ax | 0;
  const ay = opts.ay | 0;
  const mazeDx = opts.mazeDx ?? 1;
  const mazeDy = opts.mazeDy ?? 6;
  const cellCols = opts.cellCols ?? 13;
  const cellRows = opts.cellRows ?? 9;
  const passo = Math.max(1, opts.cellPitch ?? 2);

  const rng = rngDe(hash3(ax, ay, 0x67726176));
  const { parede, entrada, solucao } = esculpir(cellCols, cellRows, rng);

  const props = [];
  for (let cy = 0; cy < cellRows; cy++) {
    for (let cx = 0; cx < cellCols; cx++) {
      if (!parede[cy][cx]) continue;
      const dx = mazeDx + cx * passo;
      const dy = mazeDy + cy * passo;
      props.push(
        Object.freeze({
          propId: lapideDoSlot(cx + cy * 3 + ax + ay),
          dx,
          dy: dy + 0.5,
          kind: "lapide",
        })
      );
    }
  }

  const pontoMundo = (p) =>
    Object.freeze({
      x: mazeDx + p.x * passo + 0.5,
      y: mazeDy + p.y * passo + 1,
    });

  return Object.freeze({
    props: Object.freeze(props),
    navegacao: Object.freeze({
      entrada: pontoMundo(entrada),
      solucao: Object.freeze(solucao.map(pontoMundo)),
      bounds: Object.freeze({
        x0: mazeDx,
        y0: mazeDy,
        x1: mazeDx + cellCols * passo,
        y1: mazeDy + cellRows * passo,
      }),
    }),
  });
}
