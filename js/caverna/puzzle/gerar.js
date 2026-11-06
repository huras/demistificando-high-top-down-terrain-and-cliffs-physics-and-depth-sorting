/**
 * Puzzle de chute: a pedra desliza até a parede ou outra pedra.
 * Gerado de trás pra frente, então a solução existe por construção.
 */
import { mulberry32 } from "../../santuario/dungeonGen.js";

export const DIRS = Object.freeze([
  Object.freeze({ x: 0, y: -1, name: "north" }),
  Object.freeze({ x: 0, y: 1, name: "south" }),
  Object.freeze({ x: 1, y: 0, name: "east" }),
  Object.freeze({ x: -1, y: 0, name: "west" }),
]);

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;

export function cellKey(x, y) {
  return x + "," + y;
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function rangeInclusive(min, max) {
  const items = [];
  for (let i = min; i <= max; i++) items.push(i);
  return items;
}

function createGrid(width, height) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      row.push(border ? TILE_WALL : TILE_FLOOR);
    }
    grid.push(row);
  }
  return grid;
}

function inBounds(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

export function isWall(grid, x, y) {
  if (!inBounds(grid, x, y)) return true;
  return grid[y][x] === TILE_WALL;
}

function boulderSet(boulders, ignore) {
  const occupied = new Set(boulders.map((p) => cellKey(p.x, p.y)));
  if (ignore) occupied.delete(cellKey(ignore.x, ignore.y));
  return occupied;
}

export function slideBoulder(grid, boulders, origin, dir) {
  let x = origin.x;
  let y = origin.y;
  const occupied = boulderSet(boulders, origin);
  while (true) {
    const nx = x + dir.x;
    const ny = y + dir.y;
    if (isWall(grid, nx, ny) || occupied.has(cellKey(nx, ny))) {
      return { x, y };
    }
    x = nx;
    y = ny;
  }
}

function isOuterBorder(grid, x, y) {
  if (!grid?.length) return false;
  return x === 0 || y === 0 || x === grid[0].length - 1 || y === grid.length - 1;
}

/** Interior lock walls only — the outer ring is open so a miss can leave the room. */
export function isInteriorPuzzleWall(grid, x, y) {
  if (!inBounds(grid, x, y) || isOuterBorder(grid, x, y)) return false;
  return grid[y][x] === TILE_WALL;
}

/**
 * Play slide: stop on interior rocks / other boulders; leaving the room ejects.
 * @returns {{ x: number, y: number, ejected: boolean }}
 */
export function deslizarPedra(grid, boulders, origin, dir, isOpen = null) {
  let x = origin.x;
  let y = origin.y;
  const occupied = boulderSet(boulders, origin);
  while (true) {
    const nx = x + dir.x;
    const ny = y + dir.y;
    if (occupied.has(cellKey(nx, ny))) return { x, y, ejected: false };
    if (isInteriorPuzzleWall(grid, nx, ny)) return { x, y, ejected: false };
    if (!inBounds(grid, nx, ny)) {
      if (isOpen?.(nx, ny)) return { x: nx, y: ny, ejected: true };
      return { x, y, ejected: false };
    }
    x = nx;
    y = ny;
  }
}

function playerStep(grid, boulders, origin, dir) {
  const nx = origin.x + dir.x;
  const ny = origin.y + dir.y;
  if (isWall(grid, nx, ny)) return origin;
  if (boulders.some((p) => p.x === nx && p.y === ny)) return origin;
  return { x: nx, y: ny };
}

export function playerBfs(grid, boulders, origin, dest) {
  const target = cellKey(dest.x, dest.y);
  if (cellKey(origin.x, origin.y) === target) return [];

  const blocked = boulderSet(boulders);
  if (blocked.has(target)) return null;
  if (isWall(grid, dest.x, dest.y)) return null;

  const queue = [{ x: origin.x, y: origin.y }];
  const came = new Map();
  came.set(cellKey(origin.x, origin.y), null);
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    for (const dir of DIRS) {
      const next = playerStep(grid, boulders, cur, dir);
      const k = cellKey(next.x, next.y);
      if (came.has(k)) continue;
      if (next.x === cur.x && next.y === cur.y) continue;
      if (isWall(grid, next.x, next.y) || blocked.has(k)) continue;
      came.set(k, cur);
      if (k === target) {
        const path = [{ x: next.x, y: next.y }];
        let p = cur;
        const originK = cellKey(origin.x, origin.y);
        while (p && cellKey(p.x, p.y) !== originK) {
          path.push(p);
          p = came.get(cellKey(p.x, p.y));
        }
        path.reverse();
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

function segmentTiles(from, dir, dist) {
  const tiles = [];
  for (let i = 0; i <= dist; i++) {
    tiles.push({ x: from.x + dir.x * i, y: from.y + dir.y * i });
  }
  return tiles;
}

export function verifySolution(puzzle, startPlayer = null) {
  const boulders = puzzle.boulders.map((p) => ({ ...p }));
  const spawn = startPlayer ?? puzzle.player;
  let player = { x: spawn.x, y: spawn.y };

  for (const step of puzzle.solution) {
    const boulder = boulders.find((p) => p.id === step.boulderId);
    if (!boulder) return false;
    if (boulder.x !== step.from.x || boulder.y !== step.from.y) return false;

    const stand = { x: boulder.x - step.dir.x, y: boulder.y - step.dir.y };
    const path = playerBfs(puzzle.grid, boulders, player, stand);
    if (!path) return false;

    player = { x: stand.x, y: stand.y };
    const dest = slideBoulder(puzzle.grid, boulders, boulder, step.dir);
    if (dest.x !== step.to.x || dest.y !== step.to.y) return false;
    boulder.x = dest.x;
    boulder.y = dest.y;
  }

  return puzzle.switches.every((sw) =>
    boulders.some((p) => p.x === sw.x && p.y === sw.y)
  );
}

function tryGenerate(opts, seed) {
  const rng = mulberry32(seed);
  const width = opts.width;
  const height = opts.height;
  const grid = createGrid(width, height);
  const lockedFloor = new Set();
  const switches = [];
  const boulders = [];
  const solution = [];

  const distMin = Math.max(2, opts.distMin);
  const distMax = Math.max(
    distMin,
    Math.min(opts.distMax, Math.min(width, height) - 4)
  );
  const minSteps = opts.minSteps;
  const maxSteps = Math.max(minSteps, opts.maxSteps);

  function lockFloor(x, y) {
    lockedFloor.add(cellKey(x, y));
  }

  function occupiedBySwitch(x, y) {
    return switches.some((s) => s.x === x && s.y === y);
  }

  function occupiedByBoulder(x, y) {
    return boulders.some((p) => p.x === x && p.y === y);
  }

  function freeInterior(x, y) {
    if (x < 1 || y < 1 || x > width - 2 || y > height - 2) return false;
    if (isWall(grid, x, y)) return false;
    if (occupiedBySwitch(x, y) || occupiedByBoulder(x, y)) return false;
    return true;
  }

  function canLockAsWall(x, y) {
    if (!inBounds(grid, x, y)) return false;
    if (occupiedBySwitch(x, y) || occupiedByBoulder(x, y)) return false;
    if (lockedFloor.has(cellKey(x, y))) return false;
    return true;
  }

  for (let id = 0; id < opts.switchCount; id++) {
    const switchCandidates = [];
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        if (!freeInterior(x, y)) continue;
        if (lockedFloor.has(cellKey(x, y))) continue;
        const far = switches.every(
          (s) => Math.abs(s.x - x) + Math.abs(s.y - y) >= 4
        );
        if (far) switchCandidates.push({ x, y });
      }
    }
    if (!switchCandidates.length) return null;

    const sw = switchCandidates[randInt(rng, 0, switchCandidates.length - 1)];
    switches.push({ x: sw.x, y: sw.y, id });
    lockFloor(sw.x, sw.y);

    let pos = { x: sw.x, y: sw.y };
    const reverse = [];
    const nSteps = randInt(rng, minSteps, maxSteps);

    for (let step = 0; step < nSteps; step++) {
      let chosen = null;
      const dirs = shuffle(rng, DIRS);

      for (const dir of dirs) {
        const lockX = pos.x + dir.x;
        const lockY = pos.y + dir.y;
        if (!canLockAsWall(lockX, lockY) && !isWall(grid, lockX, lockY)) {
          continue;
        }
        if (occupiedBySwitch(lockX, lockY) || occupiedByBoulder(lockX, lockY)) {
          continue;
        }
        if (lockedFloor.has(cellKey(lockX, lockY))) continue;

        const dists = shuffle(rng, rangeInclusive(distMin, distMax));
        for (const dist of dists) {
          const origin = {
            x: pos.x - dir.x * dist,
            y: pos.y - dir.y * dist,
          };
          if (!freeInterior(origin.x, origin.y)) continue;
          if (lockedFloor.has(cellKey(origin.x, origin.y))) continue;

          const stand = { x: origin.x - dir.x, y: origin.y - dir.y };
          if (!inBounds(grid, stand.x, stand.y)) continue;
          if (isWall(grid, stand.x, stand.y)) continue;
          if (occupiedBySwitch(stand.x, stand.y)) continue;
          if (occupiedByBoulder(stand.x, stand.y)) continue;
          if (stand.x === sw.x && stand.y === sw.y) continue;

          let pathClear = true;
          const tiles = segmentTiles(origin, dir, dist);
          for (const tile of tiles) {
            if (!inBounds(grid, tile.x, tile.y) || isWall(grid, tile.x, tile.y)) {
              pathClear = false;
              break;
            }
            if (occupiedByBoulder(tile.x, tile.y)) {
              pathClear = false;
              break;
            }
            if (tile.x === origin.x && tile.y === origin.y) continue;
            if (
              occupiedBySwitch(tile.x, tile.y) &&
              !(tile.x === pos.x && tile.y === pos.y)
            ) {
              pathClear = false;
              break;
            }
          }
          if (!pathClear) continue;

          const lockAlready = isWall(grid, lockX, lockY);
          if (!lockAlready) grid[lockY][lockX] = TILE_WALL;
          const landing = slideBoulder(
            grid,
            boulders.concat([{ x: origin.x, y: origin.y }]),
            origin,
            dir
          );
          if (landing.x !== pos.x || landing.y !== pos.y) {
            if (!lockAlready) grid[lockY][lockX] = TILE_FLOOR;
            continue;
          }

          chosen = {
            dir,
            dist,
            from: origin,
            to: { x: pos.x, y: pos.y },
            lock: { x: lockX, y: lockY },
            lockNew: !lockAlready,
            tiles,
            stand,
          };
          break;
        }
        if (chosen) break;
      }

      if (!chosen) return null;

      if (chosen.lockNew) {
        grid[chosen.lock.y][chosen.lock.x] = TILE_WALL;
      }

      for (const tile of chosen.tiles) lockFloor(tile.x, tile.y);
      lockFloor(chosen.stand.x, chosen.stand.y);

      reverse.push(chosen);
      pos = { x: chosen.from.x, y: chosen.from.y };
    }

    if (pos.x === sw.x && pos.y === sw.y) return null;

    const playSteps = reverse.slice().reverse();
    boulders.push({ x: pos.x, y: pos.y, id });

    for (const step of playSteps) {
      solution.push({
        boulderId: id,
        dir: step.dir,
        from: step.from,
        to: step.to,
        dist: step.dist,
        stand: step.stand,
      });
    }
  }

  const first = solution[0];
  if (!first) return null;

  const startStand = first.stand;
  let player = { x: startStand.x, y: startStand.y, dir: { ...first.dir } };
  const neighbors = shuffle(rng, DIRS);
  for (const dir of neighbors) {
    const nx = startStand.x + dir.x;
    const ny = startStand.y + dir.y;
    if (
      freeInterior(nx, ny) &&
      !occupiedByBoulder(nx, ny) &&
      !isWall(grid, nx, ny)
    ) {
      player = { x: nx, y: ny, dir: { x: -dir.x, y: -dir.y } };
      break;
    }
  }

  if (occupiedByBoulder(player.x, player.y) || isWall(grid, player.x, player.y)) {
    return null;
  }

  const puzzle = {
    width,
    height,
    grid,
    switches,
    boulders,
    player,
    solution,
    seed,
  };

  if (!verifySolution(puzzle)) return null;
  return puzzle;
}

/**
 * @param {{
 *   width: number,
 *   height: number,
 *   switchCount: number,
 *   minSteps: number,
 *   maxSteps: number,
 *   distMin: number,
 *   distMax: number,
 *   seed?: number,
 * }} opts
 */
export function gerarPuzzlePedra(opts) {
  const base = (opts.seed >>> 0) || (Date.now() >>> 0);
  for (let i = 0; i < 160; i++) {
    const puzzle = tryGenerate(opts, (base + i * 9973) >>> 0);
    if (puzzle) return puzzle;
  }
  return tryGenerate(
    {
      ...opts,
      minSteps: Math.max(2, opts.minSteps - 1),
      maxSteps: Math.max(2, opts.maxSteps - 1),
      distMin: 2,
      distMax: Math.max(2, opts.distMax - 1),
    },
    (base + 424242) >>> 0
  );
}

/**
 * Open one border cell on `side` so a corridor can enter, then re-check the
 * official solution from that door.
 * @param {object} puzzle
 * @param {{ dx: number, dy: number }} outwardDir branch direction (room is further along this)
 */
export function abrirEntradaPuzzle(puzzle, outwardDir) {
  const width = puzzle.width;
  const height = puzzle.height;
  const doorSide = { x: -outwardDir.dx, y: -outwardDir.dy };
  /** @type {{ x: number, y: number }[]} */
  const candidates = [];

  if (doorSide.x < 0) {
    for (let y = 1; y < height - 1; y++) {
      if (puzzle.grid[y][1] === TILE_FLOOR) candidates.push({ x: 0, y });
    }
  } else if (doorSide.x > 0) {
    for (let y = 1; y < height - 1; y++) {
      if (puzzle.grid[y][width - 2] === TILE_FLOOR) {
        candidates.push({ x: width - 1, y });
      }
    }
  } else if (doorSide.y < 0) {
    for (let x = 1; x < width - 1; x++) {
      if (puzzle.grid[1][x] === TILE_FLOOR) candidates.push({ x, y: 0 });
    }
  } else {
    for (let x = 1; x < width - 1; x++) {
      if (puzzle.grid[height - 2][x] === TILE_FLOOR) {
        candidates.push({ x, y: height - 1 });
      }
    }
  }

  for (const door of candidates) {
    const grid = puzzle.grid.map((row) => row.slice());
    grid[door.y][door.x] = TILE_FLOOR;
    const test = {
      ...puzzle,
      grid,
      player: { x: door.x, y: door.y },
    };
    if (!verifySolution(test)) continue;
    return { grid, door };
  }
  return null;
}

export function interruptoresCobertos(switches, boulders) {
  return switches.every((sw) => boulders.some((p) => p.x === sw.x && p.y === sw.y));
}
