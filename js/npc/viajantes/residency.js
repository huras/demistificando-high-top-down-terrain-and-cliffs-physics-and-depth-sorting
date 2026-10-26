import { paraLocalKanto } from "../../mundo/bounds.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { OW_CFG, OW_LOD } from "./config.js";

export function contarAtivos(lista) {
  let n = 0;
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].lod === OW_LOD.ACTIVE) n += 1;
  }
  return n;
}

export function ehDormente(t) {
  return t?.lod === OW_LOD.DORMANT;
}

/**
 * Mantém vistos no anel; poda excedentes.
 */
export function atualizarResidencia(player, lista, cameraAabb) {
  if (!player || !lista) return;
  const local = paraLocalKanto(player.x, player.y);
  const pax = Math.floor(local.x / AREA_KANTO);
  const pay = Math.floor(local.y / AREA_KANTO);
  const ring = OW_CFG.KEEP_AREA_RING;

  for (let i = lista.length - 1; i >= 0; i--) {
    const t = lista[i];
    const dx = Math.abs((t.ax | 0) - pax);
    const dy = Math.abs((t.ay | 0) - pay);
    const dist = Math.hypot(t.x - player.x, t.y - player.y);

    if (cameraAabb) {
      const inCam =
        t.x >= cameraAabb.minX - OW_CFG.VIEW_PAD &&
        t.x <= cameraAabb.maxX + OW_CFG.VIEW_PAD &&
        t.y >= cameraAabb.minY - OW_CFG.VIEW_PAD &&
        t.y <= cameraAabb.maxY + OW_CFG.VIEW_PAD;
      if (inCam) t.seenByPlayer = true;
    }

    if (dx > ring || dy > ring) {
      if (!t.seenByPlayer || dist > OW_CFG.MAX_PLAYER_SIM_DIST * 1.5) {
        lista.splice(i, 1);
        continue;
      }
    }

    if (dist > OW_CFG.MAX_PLAYER_SIM_DIST) {
      t.lod = OW_LOD.DORMANT;
    } else {
      t.lod = OW_LOD.ACTIVE;
    }
  }

  while (lista.length > OW_CFG.MAX_RASTREADOS) {
    let drop = -1;
    let best = -1;
    for (let i = 0; i < lista.length; i++) {
      const t = lista[i];
      if (t.seenByPlayer && t.lod === OW_LOD.ACTIVE) continue;
      const d = Math.hypot(t.x - player.x, t.y - player.y);
      if (d > best) {
        best = d;
        drop = i;
      }
    }
    if (drop < 0) break;
    lista.splice(drop, 1);
  }
}
