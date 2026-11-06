/**
 * Interior compacto: máscara derivada do caminho, das salas e do puzzle.
 * O orçamento cabe em 256×128, então a máscara é um lookup por célula
 * (o carimbo do chunk não varre o mundo).
 */
import { hashSeed, mulberry32 } from "../../santuario/dungeonGen.js";
import { temChave } from "../../jogo/estado.js";
import {
  TILE_FLOOR,
  TILE_WALL,
  abrirEntradaPuzzle,
  gerarPuzzlePedra,
} from "../puzzle/gerar.js";

export const CHAO = 1;
export const MURO = 2;
export const PORTA = 3;

const VERSAO = "v1";
const LARGURA_CORREDOR = 1.55;

function chaveResolvida(caveId, roomId) {
  return `caverna-ok:${caveId}:${roomId}`;
}

export function cavernaResolvida(caveId, roomId) {
  return temChave(chaveResolvida(caveId, roomId));
}

export { chaveResolvida };

function pintarDisco(mask, cols, rows, x, y, raio) {
  const r2 = raio * raio;
  const x0 = Math.max(1, Math.floor(x - raio));
  const x1 = Math.min(cols - 2, Math.ceil(x + raio));
  const y0 = Math.max(1, Math.floor(y - raio));
  const y1 = Math.min(rows - 2, Math.ceil(y + raio));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const dx = tx + 0.5 - x;
      const dy = ty + 0.5 - y;
      if (dx * dx + dy * dy <= r2) mask[ty * cols + tx] = CHAO;
    }
  }
}

function pintarTrecho(mask, cols, rows, a, b, raio) {
  const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    pintarDisco(mask, cols, rows, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, raio);
  }
}

function pintarRet(mask, cols, rows, x0, y0, x1, y1) {
  const xa = Math.max(1, x0 | 0);
  const ya = Math.max(1, y0 | 0);
  const xb = Math.min(cols - 2, x1 | 0);
  const yb = Math.min(rows - 2, y1 | 0);
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) mask[y * cols + x] = CHAO;
  }
}

function abrirPortal(mask, cols, rows, lado) {
  const mx = cols >> 1;
  const my = rows >> 1;
  if (lado === "west" || lado === "east") {
    const xBase = lado === "west" ? 0 : cols - 6;
    pintarRet(mask, cols, rows, xBase, my - 1, xBase + 5, my + 1);
    for (let y = my - 1; y <= my + 1; y++) {
      const borda = lado === "west" ? 0 : cols - 1;
      if (y > 0 && y < rows - 1) mask[y * cols + borda] = CHAO;
    }
    return { lado, x: lado === "west" ? 1 : cols - 2, y: my };
  }
  const yBase = lado === "north" ? 0 : rows - 6;
  pintarRet(mask, cols, rows, mx - 1, yBase, mx + 1, yBase + 5);
  for (let x = mx - 1; x <= mx + 1; x++) {
    const borda = lado === "north" ? 0 : rows - 1;
    if (x > 0 && x < cols - 1) mask[borda * cols + x] = CHAO;
  }
  return { lado, x: mx, y: lado === "north" ? 1 : rows - 2 };
}

function caminho(cols, rows, a, b, rng) {
  const pts = [{ x: a.x + 0.5, y: a.y + 0.5 }];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const curvas = 3;
  for (let i = 1; i <= curvas; i++) {
    const t = i / (curvas + 1);
    const amp = (4 + rng() * 8) * (i % 2 === 0 ? 1 : -1);
    let x = a.x + dx * t + nx * amp;
    let y = a.y + dy * t + ny * amp;
    x = Math.max(6, Math.min(cols - 7, x));
    y = Math.max(6, Math.min(rows - 7, y));
    pts.push({ x, y });
  }
  pts.push({ x: b.x + 0.5, y: b.y + 0.5 });
  return pts;
}

function pontoNoCaminho(pts, t) {
  const seg = Math.max(1, pts.length - 1);
  const f = Math.max(0, Math.min(0.999, t)) * seg;
  const i = Math.floor(f);
  const u = f - i;
  const a = pts[i];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function cabe(cols, rows, x, y, w, h) {
  return x >= 2 && y >= 2 && x + w < cols - 2 && y + h < rows - 2;
}

function ladoOposto(dir) {
  return { x: -dir.x, y: -dir.y, name: dir.name };
}

function colocarPuzzle(mask, cols, rows, cave, pts, indice, rng) {
  const largura = 12;
  const altura = 10;
  const premioW = 8;
  const premioH = 8;
  const dirs = [
    { x: 1, y: 0, name: "east" },
    { x: -1, y: 0, name: "west" },
    { x: 0, y: 1, name: "south" },
    { x: 0, y: -1, name: "north" },
  ];
  const semente = hashSeed(`${cave.id}:puzzle:${indice}:${VERSAO}`);
  const puzzle = gerarPuzzlePedra({
    width: largura,
    height: altura,
    switchCount: indice === 0 ? 1 : 2,
    minSteps: 2,
    maxSteps: indice === 0 ? 3 : 4,
    distMin: 2,
    distMax: 4,
    seed: semente,
  });
  if (!puzzle) return null;

  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const t = 0.28 + ((indice + tentativa * 0.17) % 5) * 0.1;
    const centro = pontoNoCaminho(pts, Math.min(0.82, t));
    const ordem = dirs.slice().sort(() => rng() - 0.5);
    for (let d = 0; d < ordem.length; d++) {
      const dir = ordem[d];
      const aberto = abrirEntradaPuzzle(puzzle, { dx: dir.x, dy: dir.y });
      if (!aberto) continue;
      const porta = aberto.door;
      const x0 = Math.round(centro.x - porta.x + dir.x * 2);
      const y0 = Math.round(centro.y - porta.y + dir.y * 2);
      if (!cabe(cols, rows, x0, y0, largura, altura)) continue;

      const premioX = dir.x > 0 ? x0 + largura : dir.x < 0 ? x0 - premioW : x0 + ((largura - premioW) >> 1);
      const premioY = dir.y > 0 ? y0 + altura : dir.y < 0 ? y0 - premioH : y0 + ((altura - premioH) >> 1);
      if (!cabe(cols, rows, premioX, premioY, premioW, premioH)) continue;

      const grid = aberto.grid;
      for (let gy = 0; gy < altura; gy++) {
        for (let gx = 0; gx < largura; gx++) {
          const tx = x0 + gx;
          const ty = y0 + gy;
          mask[ty * cols + tx] = grid[gy][gx] === TILE_WALL ? MURO : CHAO;
        }
      }
      pintarTrecho(
        mask,
        cols,
        rows,
        centro,
        { x: x0 + porta.x + 0.5, y: y0 + porta.y + 0.5 },
        1.2,
      );

      let fx = x0 + (largura >> 1);
      let fy = y0 + (altura >> 1);
      if (dir.x > 0) fx = x0 + largura - 1;
      else if (dir.x < 0) fx = x0;
      else if (dir.y > 0) fy = y0 + altura - 1;
      else fy = y0;
      const resolvida = cavernaResolvida(cave.id, indice);
      mask[fy * cols + fx] = resolvida ? CHAO : PORTA;

      pintarRet(
        mask,
        cols,
        rows,
        premioX,
        premioY,
        premioX + premioW - 1,
        premioY + premioH - 1,
      );
      if (!resolvida) mask[fy * cols + fx] = PORTA;

      const pedras = puzzle.boulders.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        sx: p.x,
        sy: p.y,
      }));
      return {
        id: indice,
        x0,
        y0,
        w: largura,
        h: altura,
        grid,
        pedras,
        interruptores: puzzle.switches.map((s) => ({ x: s.x, y: s.y })),
        porta: { x: fx - x0, y: fy - y0 },
        portaMundo: { x: fx, y: fy },
        aberta: resolvida,
        premio: { x0: premioX, y0: premioY, x1: premioX + premioW, y1: premioY + premioH },
        dir,
      };
    }
  }
  return null;
}

function salasAoLongo(mask, cols, rows, pts, n, rng) {
  const salas = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const p = pontoNoCaminho(pts, t);
    const w = 10 + Math.floor(rng() * 6);
    const h = 8 + Math.floor(rng() * 4);
    const x0 = Math.round(p.x - w / 2);
    const y0 = Math.round(p.y - h / 2);
    if (!cabe(cols, rows, x0, y0, w, h)) continue;
    pintarRet(mask, cols, rows, x0, y0, x0 + w - 1, y0 + h - 1);
    salas.push({ x0, y0, x1: x0 + w, y1: y0 + h });
  }
  return salas;
}

/**
 * @param {object} cave
 */
export function gerarInterior(cave) {
  const cols = cave.cols | 0;
  const rows = cave.rows | 0;
  const mask = new Uint8Array(cols * rows);
  mask.fill(MURO);
  const rng = mulberry32(hashSeed(`${cave.id}:${VERSAO}`));
  const lados = cave.mouths.map((m) => m.portal);
  const portals = [];
  for (let i = 0; i < lados.length; i++) {
    portals.push(abrirPortal(mask, cols, rows, lados[i]));
  }
  const a = portals[0];
  const b = portals[1] || {
    x: cols >> 1,
    y: cave.kind === "deadend" ? 8 : rows >> 1,
  };
  const pts = caminho(cols, rows, a, b, rng);
  for (let i = 0; i < pts.length - 1; i++) {
    pintarTrecho(mask, cols, rows, pts[i], pts[i + 1], LARGURA_CORREDOR);
  }
  if (!portals[1]) {
    pintarRet(mask, cols, rows, (cols >> 1) - 8, 6, (cols >> 1) + 8, 18);
  }
  const salas = salasAoLongo(mask, cols, rows, pts, cave.kind === "corridor" ? 2 : 3, rng);
  const puzzles = [];
  const nPuzzle = cave.puzzles | 0;
  for (let i = 0; i < nPuzzle; i++) {
    const sala = colocarPuzzle(mask, cols, rows, cave, pts, i, rng);
    if (sala) puzzles.push(sala);
  }
  return {
    id: cave.id,
    nome: cave.nome,
    kind: cave.kind,
    cols,
    rows,
    mask,
    portals,
    salas,
    puzzles,
    encontros: cave.encontros,
    wilds: cave.wilds | 0,
  };
}

export function classeDaCelula(layout, tx, ty) {
  if (!layout) return 0;
  if (tx < 0 || ty < 0 || tx >= layout.cols || ty >= layout.rows) return 0;
  return layout.mask[ty * layout.cols + tx] | 0;
}

export function abrirPortaNoLayout(layout, sala) {
  if (!layout || !sala || sala.aberta) return;
  sala.aberta = true;
  const x = sala.x0 + sala.porta.x;
  const y = sala.y0 + sala.porta.y;
  if (x >= 0 && y >= 0 && x < layout.cols && y < layout.rows) {
    layout.mask[y * layout.cols + x] = CHAO;
  }
}

export { TILE_FLOOR, TILE_WALL, ladoOposto };
