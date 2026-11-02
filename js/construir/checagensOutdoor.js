/**
 * Validação de terreno e sobreposição outdoor.
 */
import { alturaDoRelevo, nivelMarBlocos } from "../mundo/bioma/catalogo.js";
import { amostraKanto } from "../mundo/regiao/amostraKanto.js";
import { dentroDoKanto } from "../mundo/bounds.js";
import { siteEm } from "../mundo/sites/plano.js";
import { temPlanoSite } from "../mundo/sites/relevo.js";
import { temPlanoLetra } from "../letras/relevo.js";
import { getWorldShrinePlan } from "../santuario/colocacao.js";
import {
  anyBlockerOverlaps,
  blockersCasaRegistro,
  unionBoxes,
} from "./pegadas.js";
import { listarCasas, listarMoveisOutdoor, cercaEm } from "./estruturas.js";
import { tileOcupado } from "./ocupacao.js";

/**
 * @param {object[]} blockers
 * @returns {string|null} motivo de falha
 */
export function motivoTerrenoOutdoor(blockers) {
  if (!blockers?.length) return "unknown";
  const mar = nivelMarBlocos();
  for (const b of blockers) {
    const x0 = Math.floor(b.x0);
    const y0 = Math.floor(b.y0);
    const x1 = Math.ceil(b.x1);
    const y1 = Math.ceil(b.y1);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const wx = x + 0.5;
        const wy = y + 0.5;
        const h = alturaDoRelevo(wx, wy);
        if (h < mar) return "water";
        if (dentroDoKanto(wx, wy)) {
          const am = amostraKanto(wx, wy);
          if (am?.rua) return "road";
          if (am?.predio || am?.modelo) return "city";
          if (am?.nome && String(am.nome).includes("Town")) return "city";
        }
      }
    }
  }
  return null;
}

function santuarioSobrepoe(union) {
  try {
    const slots = getWorldShrinePlan()?.slots || [];
    const cx = (union.x0 + union.x1) * 0.5;
    const cy = (union.y0 + union.y1) * 0.5;
    for (const s of slots) {
      const sx = s.x ?? s.wx ?? s.mapX;
      const sy = s.y ?? s.wy ?? s.mapY;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      const dx = sx - cx;
      const dy = sy - cy;
      if (dx * dx + dy * dy < 36) return true;
    }
  } catch {
    /* plano ainda não pronto */
  }
  return false;
}

/**
 * @param {object[]} blockers
 * @param {{ ignoreHouseId?: string, ignoreFurnitureId?: string }} [opts]
 */
export function motivoSobreposicao(blockers, opts = {}) {
  if (!blockers?.length) return "unknown";
  const union = unionBoxes(blockers);
  if (!union) return "unknown";

  for (const h of listarCasas()) {
    if (opts.ignoreHouseId && h.id === opts.ignoreHouseId) continue;
    if (anyBlockerOverlaps(blockers, blockersCasaRegistro(h))) return "overlap";
  }

  for (const f of listarMoveisOutdoor()) {
    if (opts.ignoreFurnitureId && f.id === opts.ignoreFurnitureId) continue;
    const rect = {
      x0: f.x,
      y0: f.y,
      x1: f.x + (f.cols || 1),
      y1: f.y + (f.rows || 1),
    };
    if (anyBlockerOverlaps(blockers, rect)) return "overlap";
  }

  const cx = (union.x0 + union.x1) * 0.5;
  const cy = (union.y0 + union.y1) * 0.5;
  if (siteEm(cx, cy)) return "site";
  if (santuarioSobrepoe(union)) return "shrine";

  const x0 = Math.floor(union.x0);
  const y0 = Math.floor(union.y0);
  const x1 = Math.ceil(union.x1);
  const y1 = Math.ceil(union.y1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (temPlanoSite(x, y) || temPlanoLetra(x, y)) return "site";
      if (cercaEm(x, y)) return "fence";
      if (opts.checkOcc && tileOcupado(x, y)) return "occupied";
    }
  }

  return null;
}

/**
 * @param {object[]} blockers
 */
export function celulasDoStamp(blockers) {
  const union = unionBoxes(blockers);
  if (!union) return [];
  const cells = [];
  const x0 = Math.floor(union.x0);
  const y0 = Math.floor(union.y0);
  const x1 = Math.ceil(union.x1);
  const y1 = Math.ceil(union.y1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) cells.push({ x, y });
  }
  return cells;
}
