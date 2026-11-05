/** Catálogo dos 8 armazéns Team Rocket. */

export const WAREHOUSE_KIND = "warehouse";
export const WAREHOUSE_COUNT = 8;

export const WAREHOUSE_DEFS = Object.freeze({
  "rocket-warehouse-01": Object.freeze({ title: "Depósito Rocket α", baseLevel: 8, floors: 3 }),
  "rocket-warehouse-02": Object.freeze({ title: "Depósito Rocket β", baseLevel: 10, floors: 3 }),
  "rocket-warehouse-03": Object.freeze({ title: "Depósito Rocket γ", baseLevel: 12, floors: 4 }),
  "rocket-warehouse-04": Object.freeze({ title: "Depósito Rocket δ", baseLevel: 14, floors: 4 }),
  "rocket-warehouse-05": Object.freeze({ title: "Depósito Rocket ε", baseLevel: 16, floors: 3 }),
  "rocket-warehouse-06": Object.freeze({ title: "Depósito Rocket ζ", baseLevel: 18, floors: 5 }),
  "rocket-warehouse-07": Object.freeze({ title: "Depósito Rocket η", baseLevel: 20, floors: 4 }),
  "rocket-warehouse-08": Object.freeze({ title: "Depósito Rocket θ", baseLevel: 22, floors: 5 }),
});

export function warehouseIdAtIndex(index) {
  return `rocket-warehouse-${String((index | 0) + 1).padStart(2, "0")}`;
}

export function getWarehouseDef(id) {
  return WAREHOUSE_DEFS[id] || null;
}

export function listarWarehouseIds() {
  return Object.keys(WAREHOUSE_DEFS);
}

/** Layout simples por andar: sala retangular com grunts. */
export function gerarAndaresWarehouse(warehouseId) {
  const def = getWarehouseDef(warehouseId);
  if (!def) return [];
  const floors = [];
  for (let f = 0; f < def.floors; f++) {
    const cols = 18 + (f % 3) * 2;
    const rows = 14 + (f % 2) * 2;
    const trainers = [];
    const n = 2 + f;
    for (let i = 0; i < n; i++) {
      trainers.push({
        id: `${warehouseId}-f${f}-t${i}`,
        x: 4 + (i % 4) * 3,
        y: 4 + Math.floor(i / 4) * 3,
        level: def.baseLevel + f * 2 + i,
        name: i % 2 ? "Rocket Grunt ♀" : "Rocket Grunt ♂",
        female: !!(i % 2),
      });
    }
    floors.push({
      index: f,
      cols,
      rows,
      trainers,
      stairsUp: f < def.floors - 1 ? { x: cols - 3, y: 3 } : null,
      stairsDown: f > 0 ? { x: 3, y: rows - 3 } : null,
      exitSouth: f === 0 ? { x: cols * 0.5, y: rows - 1.2 } : null,
    });
  }
  return floors;
}
