/**
 * Bearing para o santuário uncleared mais próximo (com device).
 */
import { getWorldShrinePlan, shrineMapColor } from "./colocacao.js";
import { santuarioLimpo } from "./estadoSantuario.js";
import { temDeviceSantuario } from "./questDevice.js";

const HIDE_RADIUS = 4;

/**
 * @param {{ x: number, y: number }} player
 * @param {boolean} [interior]
 */
export function closestShrineBearing(player, interior = false) {
  if (!player || interior || !temDeviceSantuario()) return null;
  const slots = getWorldShrinePlan().slots;
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const m = slots[i];
    if (santuarioLimpo(m.id)) continue;
    const dist = Math.hypot(m.x - player.x, m.y - player.y);
    if (dist >= bestDist) continue;
    bestDist = dist;
    best = {
      angle: Math.atan2(m.y - player.y, m.x - player.x),
      element: m.element,
      dist,
      color: shrineMapColor(m.element),
      id: m.id,
    };
  }
  if (!best || best.dist < HIDE_RADIUS) return null;
  return best;
}

export function shrineCompassRotationDeg(angle) {
  return (angle * 180) / Math.PI + 90;
}

export function formatShrineDistanceMeters(distTiles) {
  return `${Math.max(0, Math.round(distTiles))} m`;
}
