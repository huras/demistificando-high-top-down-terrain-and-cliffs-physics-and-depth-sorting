/**
 * Mystery-dungeon style shrine floor: rooms + winding corridors.
 * Entrance on the south; totem in the room farthest from entrance (BFS).
 */
export function minShrineRoomGap() { return 12; }

const ROOM_IDS = ["stone-rock-a", "stone-rock-b", "stone-rock-c", "stone-rock-d", "stone-rock-e"];

/**
 * @param {number|string} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string|number|null|undefined} value
 * @returns {number}
 */
export function hashSeed(value) {
  const s = String(value ?? "shrine");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {Uint8Array} mask
 * @param {number} cols
 * @param {number} rows
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function carveRect(mask, cols, rows, x0, y0, x1, y1) {
  const xa = Math.max(0, Math.min(cols, Math.floor(x0)));
  const ya = Math.max(0, Math.min(rows, Math.floor(y0)));
  const xb = Math.max(0, Math.min(cols, Math.ceil(x1)));
  const yb = Math.max(0, Math.min(rows, Math.ceil(y1)));
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      mask[y * cols + x] = 1;
    }
  }
}

/**
 * L-shaped corridor between two points (centers), width in cells.
 * @returns {{ x0: number, y0: number, x1: number, y1: number }[]}
 */
function carveLCorridor(mask, cols, rows, xA, yA, xB, yB, width, rng) {
  // +1 width: double-cliff SOUTH UNDER eats the north floor row beside rock.
  const w = Math.max(2, width | 0) + 1;
  const hw = Math.floor(w / 2);
  const segments = [];
  const ax = Math.round(xA);
  const ay = Math.round(yA);
  const bx = Math.round(xB);
  const by = Math.round(yB);
  const horizontalFirst = rng() < 0.5;

  const carveH = (y, x0, x1) => {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    carveRect(mask, cols, rows, lo - hw, y - hw, hi + hw + 1, y + hw + 1);
    segments.push({
      x0: lo - hw,
      y0: y - hw,
      x1: hi + hw + 1,
      y1: y + hw + 1,
    });
  };
  const carveV = (x, y0, y1) => {
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    carveRect(mask, cols, rows, x - hw, lo - hw, x + hw + 1, hi + hw + 1);
    segments.push({
      x0: x - hw,
      y0: lo - hw,
      x1: x + hw + 1,
      y1: hi + hw + 1,
    });
  };

  if (horizontalFirst) {
    carveH(ay, ax, bx);
    carveV(bx, ay, by);
  } else {
    carveV(ax, ay, by);
    carveH(by, ax, bx);
  }
  return segments;
}

function roomsOverlap(a, b, gap) {
  return !(
    a.x1 + gap <= b.x0 ||
    b.x1 + gap <= a.x0 ||
    a.y1 + gap <= b.y0 ||
    b.y1 + gap <= a.y0
  );
}

function roomCenter(room) {
  return {
    x: (room.x0 + room.x1) * 0.5,
    y: (room.y0 + room.y1) * 0.5,
  };
}

/**
 * BFS over carved floor from (sx, sy). Returns cell distances.
 * @returns {Int32Array}
 */
function bfsFloorDist(mask, cols, rows, sx, sy) {
  const n = cols * rows;
  const dist = new Int32Array(n);
  dist.fill(-1);
  if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) return dist;
  if (!mask[sy * cols + sx]) return dist;

  const qx = [sx];
  const qy = [sy];
  dist[sy * cols + sx] = 0;
  let head = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (head < qx.length) {
    const x = qx[head];
    const y = qy[head];
    head++;
    const i = y * cols + x;
    const d = dist[i];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!mask[ni] || dist[ni] >= 0) continue;
      dist[ni] = d + 1;
      qx.push(nx);
      qy.push(ny);
    }
  }
  return dist;
}

/**
 * Undirected room-graph edge list → adjacency.
 * @param {number} roomCount
 * @param {Array<[number, number]>} edges
 * @returns {number[][]}
 */
function buildRoomAdj(roomCount, edges) {
  /** @type {number[][]} */
  const adj = Array.from({ length: roomCount }, () => []);
  for (const [a, b] of edges) {
    if (a === b || a < 0 || b < 0 || a >= roomCount || b >= roomCount) continue;
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return adj;
}

/**
 * Shortest room path start → goal on the corridor graph.
 * @returns {number[]} inclusive indices, or [] if unreachable
 */
function shortestRoomPath(adj, startIdx, goalIdx) {
  if (startIdx === goalIdx) return [startIdx];
  const n = adj.length;
  const prev = new Int32Array(n);
  prev.fill(-1);
  const seen = new Uint8Array(n);
  const q = [startIdx];
  seen[startIdx] = 1;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goalIdx) break;
    for (const nxt of adj[cur]) {
      if (seen[nxt]) continue;
      seen[nxt] = 1;
      prev[nxt] = cur;
      q.push(nxt);
    }
  }
  if (!seen[goalIdx]) return [];
  const path = [];
  for (let i = goalIdx; i >= 0; i = prev[i]) {
    path.push(i);
    if (i === startIdx) break;
  }
  path.reverse();
  return path[0] === startIdx ? path : [];
}

/**
 * Hop depth on the MST from start (root) to idx.
 */
function mstHopDepth(treeParent, startIdx, idx) {
  let d = 0;
  let i = idx;
  const guard = treeParent.length + 2;
  while (i !== startIdx && i >= 0 && d < guard) {
    i = treeParent[i];
    d++;
  }
  return i === startIdx ? d : -1;
}

/**
 * Farthest room from entrance (floor BFS). Prefer rooms with MST depth >= 2
 * so the entrance→goal room path always has at least one intermediate.
 * @returns {number} room index
 */
function farthestRoomIndex(mask, cols, rows, rooms, startIdx, treeParent) {
  const start = roomCenter(rooms[startIdx]);
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  const dist = bfsFloorDist(mask, cols, rows, sx, sy);

  const scoreRoom = (i) => {
    const c = roomCenter(rooms[i]);
    return dist[Math.floor(c.y) * cols + Math.floor(c.x)];
  };

  let bestDeep = startIdx;
  let bestDeepD = -1;
  let bestAny = startIdx;
  let bestAnyD = -1;
  for (let i = 0; i < rooms.length; i++) {
    if (i === startIdx) continue;
    const d = scoreRoom(i);
    if (d > bestAnyD) {
      bestAnyD = d;
      bestAny = i;
    }
    if (mstHopDepth(treeParent, startIdx, i) >= 2 && d > bestDeepD) {
      bestDeepD = d;
      bestDeep = i;
    }
  }
  return bestDeepD >= 0 ? bestDeep : bestAny;
}

/**
 * Intermediate rooms on the MST tree path from start → reward.
 * @param {Int32Array} treeParent
 * @param {number} startIdx
 * @param {number} rewardIdx
 * @returns {number[]}
 */
function roomsOnTreePath(treeParent, startIdx, rewardIdx) {
  const out = [];
  let i = treeParent[rewardIdx];
  const guard = treeParent.length + 2;
  let steps = 0;
  while (i >= 0 && i !== startIdx && steps++ < guard) {
    out.push(i);
    i = treeParent[i];
  }
  return out;
}

/**
 * Puzzle = one room strictly between entrance and goal on the solution path.
 * Uses the shortest room-graph path (MST + shortcuts). If a shortcut collapses
 * that to a direct link, falls back to the MST chain so a mid room still exists.
 * @returns {number} room index or -1
 */
function pickPuzzleRoomOnSolutionPath(
  adj,
  treeParent,
  startIdx,
  rewardIdx,
  rng
) {
  const path = shortestRoomPath(adj, startIdx, rewardIdx);
  let mid = path.length >= 3 ? path.slice(1, -1) : [];
  if (!mid.length) {
    mid = roomsOnTreePath(treeParent, startIdx, rewardIdx);
  }
  if (!mid.length) return -1;
  return mid[Math.floor(rng() * mid.length)];
}

/**
 * @param {number} cols
 * @param {number} rows
 * @param {{
 *   seed?: number|string,
 *   rng?: () => number,
 *   roomCount?: number,
 *   corridorWidth?: number,
 *   roomGap?: number,
 * }} [opts]
 */
export function generateShrineDungeon(cols, rows, opts = {}) {
  const rng =
    opts.rng ??
    mulberry32(typeof opts.seed === "number" ? opts.seed : hashSeed(opts.seed));
  const targetRooms = Math.max(4, Math.min(16, opts.roomCount ?? 10));
  const corridorWidth = opts.corridorWidth ?? 3;
  const margin = 3;
  const gap = Math.max(minShrineRoomGap(), opts.roomGap ?? 18);

  /** @type {Uint8Array} */
  const floorMask = new Uint8Array(cols * rows);
  /** @type {object[]} */
  const rooms = [];
  /** @type {{ x0: number, y0: number, x1: number, y1: number }[]} */
  const corridorSegments = [];
  /** @type {Array<[number, number]>} */
  const roomEdges = [];

  const placeRoom = (x0, y0, w, h, kind) => {
    // +1 height: SOUTH UNDER cliff face occupies the north floor row.
    const carveH = h + 1;
    const room = {
      x0,
      y0,
      x1: x0 + w,
      y1: y0 + carveH,
      kind,
      id: rooms.length,
    };
    for (const other of rooms) {
      if (roomsOverlap(room, other, gap)) return null;
    }
    if (room.x0 < margin || room.y0 < margin) return null;
    if (room.x1 > cols - margin || room.y1 > rows - margin) return null;
    rooms.push(room);
    carveRect(floorMask, cols, rows, room.x0, room.y0, room.x1, room.y1);
    return room;
  };

  // Entrance room near south-center
  const enterW = 12 + Math.floor(rng() * 5);
  const enterH = 10 + Math.floor(rng() * 4);
  const enterX = Math.floor(cols / 2 - enterW / 2);
  const enterY = rows - margin - enterH - 1;
  const entrance = placeRoom(enterX, enterY, enterW, enterH, "entrance");
  if (!entrance) {
    // Fallback: force a minimal entrance
    carveRect(
      floorMask,
      cols,
      rows,
      margin + 4,
      rows - margin - 12,
      cols - margin - 4,
      rows - margin - 1
    );
    rooms.push({
      x0: margin + 4,
      y0: rows - margin - 12,
      x1: cols - margin - 4,
      y1: rows - margin - 1,
      kind: "entrance",
      id: 0,
    });
  }

  // More rooms scattered inland (extra attempts — large gap is picky)
  const roomWMin = opts.roomWMin ?? 10;
  const roomWSpan = opts.roomWSpan ?? 7;
  const roomHMin = opts.roomHMin ?? 9;
  const roomHSpan = opts.roomHSpan ?? 6;
  let attempts = 0;
  const maxAttempts = targetRooms * 80;
  while (rooms.length < targetRooms && attempts < maxAttempts) {
    attempts++;
    const w = roomWMin + Math.floor(rng() * roomWSpan);
    const h = roomHMin + Math.floor(rng() * roomHSpan);
    const x0 = margin + Math.floor(rng() * Math.max(1, cols - margin * 2 - w));
    const y0 = margin + Math.floor(rng() * Math.max(1, rows - margin * 2 - h - 8));
    placeRoom(x0, y0, w, h, "room");
  }

  // Connect rooms: nearest-neighbor chain from entrance (MST-ish tree).
  /** @type {Int32Array} */
  const treeParent = new Int32Array(rooms.length);
  treeParent.fill(-1);
  const connected = new Set([0]);
  while (connected.size < rooms.length) {
    let bestI = -1;
    let bestJ = -1;
    let bestDist = Infinity;
    for (const i of connected) {
      const ci = roomCenter(rooms[i]);
      for (let j = 0; j < rooms.length; j++) {
        if (connected.has(j)) continue;
        const cj = roomCenter(rooms[j]);
        const d = Math.hypot(ci.x - cj.x, ci.y - cj.y);
        if (d < bestDist) {
          bestDist = d;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestJ < 0) break;
    const a = roomCenter(rooms[bestI]);
    const b = roomCenter(rooms[bestJ]);
    corridorSegments.push(
      ...carveLCorridor(
        floorMask,
        cols,
        rows,
        a.x,
        a.y,
        b.x,
        b.y,
        corridorWidth,
        rng
      )
    );
    treeParent[bestJ] = bestI;
    roomEdges.push([bestI, bestJ]);
    connected.add(bestJ);
  }

  // One optional shortcut between two random rooms (loop)
  if (rooms.length >= 4 && rng() < 0.65) {
    const i = Math.floor(rng() * rooms.length);
    let j = Math.floor(rng() * rooms.length);
    if (j === i) j = (j + 1) % rooms.length;
    const a = roomCenter(rooms[i]);
    const b = roomCenter(rooms[j]);
    corridorSegments.push(
      ...carveLCorridor(
        floorMask,
        cols,
        rows,
        a.x,
        a.y,
        b.x,
        b.y,
        Math.max(2, corridorWidth - 1),
        rng
      )
    );
    roomEdges.push([i, j]);
  }

  // South exit stub from entrance toward map edge
  const ent = rooms.find((r) => r.kind === "entrance") ?? rooms[0];
  const doorCx = Math.floor((ent.x0 + ent.x1) * 0.5);
  const doorHalf = 2;
  const exitStub = {
    kind: "corridor",
    x0: doorCx - doorHalf,
    y0: ent.y1 - 1,
    x1: doorCx + doorHalf,
    y1: rows,
  };
  carveRect(
    floorMask,
    cols,
    rows,
    exitStub.x0,
    exitStub.y0,
    exitStub.x1,
    exitStub.y1
  );

  const entranceIdx = rooms.findIndex((r) => r.kind === "entrance");
  const startIdx = entranceIdx >= 0 ? entranceIdx : 0;
  const roomAdj = buildRoomAdj(rooms.length, roomEdges);
  const rewardIdx = farthestRoomIndex(
    floorMask,
    cols,
    rows,
    rooms,
    startIdx,
    treeParent
  );
  rooms[rewardIdx].kind = "reward";

  const puzzleIdx = pickPuzzleRoomOnSolutionPath(
    roomAdj,
    treeParent,
    startIdx,
    rewardIdx,
    rng
  );
  if (puzzleIdx >= 0) rooms[puzzleIdx].kind = "puzzle";

  const solutionPath = (() => {
    const short = shortestRoomPath(roomAdj, startIdx, rewardIdx);
    if (short.length >= 3) return short;
    // Mirror puzzle fallback so solutionPath always includes the puzzle room.
    const mid = roomsOnTreePath(treeParent, startIdx, rewardIdx);
    return [startIdx, ...mid, rewardIdx];
  })();

  // Floor zones for rendering tints
  const floorZones = rooms.map((r) => ({
    kind:
      r.kind === "reward"
        ? "reward"
        : r.kind === "entrance"
          ? "entrance"
          : r.kind === "puzzle"
            ? "puzzle"
            : "arena",
    x0: r.x0,
    y0: r.y0,
    x1: r.x1,
    y1: r.y1,
  }));
  for (const seg of corridorSegments) {
    floorZones.push({
      kind: "corridor",
      x0: seg.x0,
      y0: seg.y0,
      x1: seg.x1,
      y1: seg.y1,
    });
  }
  floorZones.push(exitStub);

  const reward = rooms[rewardIdx];
  const puzzle = puzzleIdx >= 0 ? rooms[puzzleIdx] : null;
  const totem = {
    x: (reward.x0 + reward.x1) * 0.5,
    y: (reward.y0 + reward.y1) * 0.5 - 0.2,
    halfW: 0.7,
    halfH: 0.85,
  };

  const spawn = {
    x: doorCx + 0.5,
    y: Math.max(ent.y0 + 1.5, ent.y1 - 1.5),
  };

  return {
    floorMask,
    rooms,
    corridorSegments,
    floorZones,
    entrance: ent,
    reward,
    puzzle,
    solutionPath,
    totem,
    spawn,
    doorHalf,
    doorCx: doorCx + 0.5,
    wall: margin,
  };
}

/**
 * Collision AABBs for non-walkable cells on the walkable perimeter.
 * Pass the walk mask (floor minus cliff UNDER faces), not the raw carve mask.
 * @param {Uint8Array} walkMask
 * @param {number} cols
 * @param {number} rows
 * @returns {object[]}
 */
export function wallItemsFromFloorMask(walkMask, cols, rows) {
  const items = [];
  const isWalk = (x, y) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    return walkMask[y * cols + x] === 1;
  };

  // Merge horizontal runs of blocking cells that touch walkable floor.
  for (let y = 0; y < rows; y++) {
    let runStart = -1;
    for (let x = 0; x <= cols; x++) {
      const solid = x < cols && walkMask[y * cols + x] === 0;
      const touches =
        solid &&
        (isWalk(x - 1, y) ||
          isWalk(x + 1, y) ||
          isWalk(x, y - 1) ||
          isWalk(x, y + 1) ||
          x === 0 ||
          y === 0 ||
          x === cols - 1 ||
          y === rows - 1);
      if (touches) {
        if (runStart < 0) runStart = x;
      } else if (runStart >= 0) {
        const x0 = runStart;
        const x1 = x;
        items.push({
          x: (x0 + x1) * 0.5,
          y: y + 0.5,
          halfW: (x1 - x0) * 0.5,
          halfH: 0.5,
          kind: "building",
        });
        runStart = -1;
      }
    }
  }
  return items;
}

/**
 * Pillars in room corners + torches mounted on corridor/room walls.
 */
export function buildDecorFromDungeon(gen) {
  const pillars = [];
  const torches = [];
  if (!gen?.rooms) return { pillars, torches };

  for (let i = 0; i < gen.rooms.length; i++) {
    const r = gen.rooms[i];
    const inset = 1.1;
    const rockId = ROOM_IDS[i % ROOM_IDS.length];
    const spots = [
      { x: r.x0 + inset, y: r.y0 + inset },
      { x: r.x1 - inset, y: r.y0 + inset },
      { x: r.x0 + inset, y: r.y1 - inset },
      { x: r.x1 - inset, y: r.y1 - inset },
    ];
    for (const s of spots) {
      if (s.x <= r.x0 + 0.5 || s.x >= r.x1 - 0.5) continue;
      if (s.y <= r.y0 + 0.5 || s.y >= r.y1 - 0.5) continue;
      pillars.push({
        x: s.x,
        y: s.y,
        halfW: 0.4,
        halfH: 0.35,
        rockId,
      });
    }
  }

  const wallInset = 0.32;

  const addTorch = (x, y, wall) => {
    for (const t of torches) {
      if (Math.hypot(t.x - x, t.y - y) < 1.6) return;
    }
    torches.push({ x, y, wall });
  };

  const placeAlong = (a0, a1, fixed, horizontal, wall) => {
    const span = Math.abs(a1 - a0);
    if (span < 2.5) return;
    const steps = Math.max(1, Math.floor(span / 5.5));
    const lo = Math.min(a0, a1);
    for (let s = 1; s <= steps; s++) {
      const along = lo + (span * s) / (steps + 1);
      if (horizontal) addTorch(along, fixed, wall);
      else addTorch(fixed, along, wall);
    }
  };

  for (const seg of gen.corridorSegments ?? []) {
    const w = seg.x1 - seg.x0;
    const h = seg.y1 - seg.y0;
    const horizontal = w >= h;
    if (horizontal) {
      placeAlong(seg.x0 + 1, seg.x1 - 1, seg.y0 + wallInset, true, "n");
      placeAlong(seg.x0 + 1, seg.x1 - 1, seg.y1 - wallInset, true, "s");
    } else {
      placeAlong(seg.y0 + 1, seg.y1 - 1, seg.x0 + wallInset, false, "w");
      placeAlong(seg.y0 + 1, seg.y1 - 1, seg.x1 - wallInset, false, "e");
    }
  }

  // Room walls (skip corners — pillars live there)
  for (const r of gen.rooms) {
    const midX = (r.x0 + r.x1) * 0.5;
    const midY = (r.y0 + r.y1) * 0.5;
    const rw = r.x1 - r.x0;
    const rh = r.y1 - r.y0;
    if (rw >= 6) {
      placeAlong(r.x0 + 2.2, r.x1 - 2.2, r.y0 + wallInset, true, "n");
      placeAlong(r.x0 + 2.2, r.x1 - 2.2, r.y1 - wallInset, true, "s");
    } else {
      addTorch(midX, r.y0 + wallInset, "n");
      addTorch(midX, r.y1 - wallInset, "s");
    }
    if (rh >= 6) {
      placeAlong(r.y0 + 2.2, r.y1 - 2.2, r.x0 + wallInset, false, "w");
      placeAlong(r.y0 + 2.2, r.y1 - 2.2, r.x1 - wallInset, false, "e");
    } else {
      addTorch(r.x0 + wallInset, midY, "w");
      addTorch(r.x1 - wallInset, midY, "e");
    }
  }

  return { pillars, torches };
}
