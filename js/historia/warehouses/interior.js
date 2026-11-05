/** Interior bolso dos warehouses (planta 2D procedural leve). */

import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { gerarAndaresWarehouse, getWarehouseDef } from "./catalogo.js";

/** Origem do bolso armazém — longe de lab/casa/santuário. */
export const ORIGEM_ARMAZEM_X = 160000;
export const ORIGEM_ARMAZEM_Y = 160000;

/**
 * @param {string} warehouseId
 * @param {number} floorIndex
 */
export function criarInteriorArmazem(warehouseId, floorIndex = 0) {
  const def = getWarehouseDef(warehouseId);
  const floors = gerarAndaresWarehouse(warehouseId);
  const floor = floors[floorIndex] || floors[0];
  if (!def || !floor) return null;
  const ox = ORIGEM_ARMAZEM_X + (floorIndex | 0) * 64;
  const oy = ORIGEM_ARMAZEM_Y;
  return {
    warehouseId,
    title: def.title,
    floorIndex,
    floors,
    floor,
    origemX: ox,
    origemY: oy,
    cols: floor.cols,
    rows: floor.rows,
    spawn: {
      x: ox + (floor.exitSouth?.x ?? floor.cols * 0.5),
      y: oy + (floor.exitSouth?.y ?? floor.rows - 2),
      z: ALTURA_PRACA,
    },
    trainers: (floor.trainers || []).map((t) => ({
      ...t,
      x: ox + t.x,
      y: oy + t.y,
    })),
  };
}

export function spawnArmazem(plan) {
  return plan?.spawn || { x: ORIGEM_ARMAZEM_X + 9, y: ORIGEM_ARMAZEM_Y + 12, z: ALTURA_PRACA };
}
