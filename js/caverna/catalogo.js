/**
 * Cavernas de Kanto e o orçamento de cada tipo de interior.
 * A área (ax, ay) é a mesma grade 32×32 das rotas. O tile exato
 * sai do lábio do relevo, não de uma coordenada de GBA.
 */

export const FACE = Object.freeze({
  west: Object.freeze({ x: -1, y: 0, yaw: Math.PI / 2 }),
  east: Object.freeze({ x: 1, y: 0, yaw: -Math.PI / 2 }),
  north: Object.freeze({ x: 0, y: -1, yaw: Math.PI }),
  south: Object.freeze({ x: 0, y: 1, yaw: 0 }),
});

/** cols × rows do bolso, selvagens e salas de chute. */
export const MEDIDAS = Object.freeze({
  pass: Object.freeze({ cols: 192, rows: 128, wilds: 6, puzzles: 2 }),
  corridor: Object.freeze({ cols: 256, rows: 32, wilds: 5, puzzles: 1 }),
  deadend: Object.freeze({ cols: 96, rows: 96, wilds: 4, puzzles: 1 }),
});

const ENCONTROS = Object.freeze({
  "mt-moon": Object.freeze(["zubat", "geodude", "paras", "clefairy", "sandshrew"]),
  "rock-tunnel": Object.freeze(["zubat", "geodude", "machop", "onix", "cubone"]),
  "digletts-cave": Object.freeze(["diglett", "dugtrio", "zubat"]),
  "victory-road": Object.freeze(["machop", "geodude", "onix", "zubat", "marowak", "golbat"]),
  "seafoam-islands": Object.freeze(["seel", "shellder", "slowpoke", "horsea", "zubat"]),
  "cerulean-cave": Object.freeze(["golbat", "graveler", "machoke", "golduck", "hypno", "kadabra"]),
  proc: Object.freeze(["zubat", "geodude", "paras", "sandshrew"]),
});

function boca(id, ax, ay, facing, portal, rota) {
  return Object.freeze({ id, ax, ay, facing, portal, rota });
}

function caverna(def) {
  const medidas = MEDIDAS[def.kind] || MEDIDAS.deadend;
  return Object.freeze({
    ...def,
    cols: medidas.cols,
    rows: medidas.rows,
    wilds: medidas.wilds,
    puzzles: medidas.puzzles,
    encontros: ENCONTROS[def.encounterKey] || ENCONTROS.proc,
    mouths: Object.freeze(def.mouths),
  });
}

export const CAVERNAS_KANTO = Object.freeze([
  caverna({
    id: "mt-moon",
    nome: "Mt. Moon",
    kind: "pass",
    eixo: "ew",
    encounterKey: "mt-moon",
    mouths: [
      boca("mt-moon-west", 14, 5, "west", "west", "route-3"),
      boca("mt-moon-east", 20, 5, "east", "east", "route-4"),
    ],
  }),
  caverna({
    id: "rock-tunnel",
    nome: "Rock Tunnel",
    kind: "pass",
    eixo: "ns",
    encounterKey: "rock-tunnel",
    mouths: [
      boca("rock-tunnel-north", 25, 8, "north", "north", "route-9"),
      boca("rock-tunnel-south", 26, 10, "south", "south", "route-10"),
    ],
  }),
  caverna({
    id: "victory-road",
    nome: "Estrada da Vitória",
    kind: "pass",
    eixo: "ns",
    encounterKey: "victory-road",
    mouths: [
      boca("victory-road-south", 7, 6, "south", "south", "route-22"),
      boca("victory-road-north", 7, 4, "north", "north", "victory-road"),
    ],
  }),
  caverna({
    id: "digletts-cave",
    nome: "Diglett's Cave",
    kind: "corridor",
    eixo: "ew",
    encounterKey: "digletts-cave",
    mouths: [
      boca("digletts-cave-north", 11, 8, "west", "west", "route-2"),
      boca("digletts-cave-south", 21, 17, "east", "east", "route-11"),
    ],
  }),
  caverna({
    id: "seafoam-islands",
    nome: "Seafoam Islands",
    kind: "pass",
    eixo: "ew",
    encounterKey: "seafoam-islands",
    mouths: [
      boca("seafoam-east", 16, 26, "east", "east", "route-20"),
      boca("seafoam-west", 14, 26, "west", "west", "route-20-west"),
    ],
  }),
  caverna({
    id: "cerulean-cave",
    nome: "Cerulean Cave",
    kind: "deadend",
    eixo: "ns",
    encounterKey: "cerulean-cave",
    mouths: [
      boca("cerulean-cave-mouth", 21, 4, "south", "south", "route-24"),
    ],
  }),
]);

const POR_ID = new Map(CAVERNAS_KANTO.map((c) => [c.id, c]));

export function cavernaPorId(id) {
  return POR_ID.get(id) || null;
}

export function encontrosDaCaverna(cave) {
  if (!cave) return ENCONTROS.proc;
  return cave.encontros || ENCONTROS.proc;
}

/** Def mínima de um beco procedural (uma boca, um puzzle, uma sala de item). */
export function defProcedural(ax, ay) {
  const id = `proc-${ax}-${ay}`;
  const medidas = MEDIDAS.deadend;
  return {
    id,
    nome: "Caverna",
    kind: "deadend",
    eixo: "ns",
    encounterKey: "proc",
    procedural: true,
    cols: medidas.cols,
    rows: medidas.rows,
    wilds: 4,
    puzzles: 1,
    encontros: ENCONTROS.proc,
    mouths: [
      {
        id: `${id}-mouth`,
        ax,
        ay,
        facing: "south",
        portal: "south",
        rota: "",
        procedural: true,
      },
    ],
  };
}
