/**
 * Injeta props/casas do sítio no chunk e marca células sem vegetação procedural.
 */
import { CHUNK_XZ } from "../../config.js";
import { alturaDoRelevo } from "../bioma/catalogo.js";
import { sitesDoChunk } from "./plano.js";

function chaveCelula(x, y) {
  return `${x | 0},${y | 0}`;
}

/**
 * Células do footprint (+ limpaVeg) que caem neste chunk.
 * @returns {Set<string>|null}
 */
export function celulasSiteChunk(cx, cy) {
  const sites = sitesDoChunk(cx, cy);
  if (!sites.length) return null;
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  /** @type {Set<string>} */
  const set = new Set();
  for (const site of sites) {
    // Prefer plaza (footprint + pad de flatten); fallback limpaVeg.
    const plaza = site.plaza;
    const pad = site.limpaVeg | 0;
    const x0 = plaza ? plaza.x0 | 0 : Math.floor(site.x0) - pad;
    const y0 = plaza ? plaza.y0 | 0 : Math.floor(site.y0) - pad;
    const x1 = plaza ? plaza.x1 | 0 : Math.ceil(site.x1) + pad;
    const y1 = plaza ? plaza.y1 | 0 : Math.ceil(site.y1) + pad;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x < baseX || y < baseY || x >= baseX + CHUNK_XZ || y >= baseY + CHUNK_XZ) continue;
        set.add(chaveCelula(x, y));
      }
    }
  }
  return set.size ? set : null;
}

/**
 * Props billboard + discos de casa pra colisão/visual stream.
 * @returns {object[]}
 */
export function propsSiteChunk(cx, cy) {
  const sites = sitesDoChunk(cx, cy);
  if (!sites.length) return [];
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  const xMax = baseX + CHUNK_XZ;
  const yMax = baseY + CHUNK_XZ;
  const out = [];

  for (const site of sites) {
    for (const p of site.props) {
      if (p.x < baseX || p.y < baseY || p.x >= xMax || p.y >= yMax) continue;
      const z = alturaDoRelevo(p.x, p.y);
      out.push({
        id: p.id,
        x: p.x,
        y: p.y,
        z,
        tipo: "site",
        propId: p.propId,
        sprite: p.propId,
        r: p.r,
        kind: p.kind || null,
        siteId: site.id,
        siteTipo: site.tipo,
      });
    }
    for (const e of site.edificios) {
      if (e.x < baseX - 2 || e.y < baseY - 2 || e.x >= xMax + 2 || e.y >= yMax + 2) continue;
      const z = alturaDoRelevo(e.x, e.y);
      out.push({
        id: e.id,
        x: e.x,
        y: e.y,
        z,
        tipo: "siteCasa",
        modelo: e.modelo,
        sprite: e.modelo,
        r: e.r,
        cols: e.cols,
        rows: e.rows,
        tint: e.tint,
        siteId: site.id,
        siteTipo: site.tipo,
        ocultoBillboard: true,
      });
    }
  }
  return out;
}
