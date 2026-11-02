/**
 * Pin da base do jogador no mapa mundi.
 */
import { claimRect, versaoBaseJogador } from "./base.js";
import { listarCasas, versaoEstruturasJogador } from "./estruturas.js";

let cache = null;
let cacheKey = "";

export function invalidarMarcasBase() {
  cache = null;
  cacheKey = "";
}

/**
 * @returns {{ tipo: string, id: string, x: number, y: number, cor: string, z?: number }[]}
 */
export function marcasBaseJogador() {
  const key = `${versaoBaseJogador()}:${versaoEstruturasJogador()}`;
  if (cache && cacheKey === key) return cache;
  cacheKey = key;
  /** @type {{ tipo: string, id: string, x: number, y: number, cor: string, z?: number }[]} */
  const out = [];
  const claim = claimRect();
  if (claim) {
    out.push({
      tipo: "baseJogador",
      id: "player-base",
      x: claim.x0 + claim.cols * 0.5,
      y: claim.y0 + claim.rows * 0.5,
      cor: "#38bdf8",
      z: 0,
    });
  }
  for (const h of listarCasas()) {
    out.push({
      tipo: "casaJogador",
      id: h.id,
      x: h.x,
      y: h.y,
      cor: "#fbbf24",
      z: h.z || 0,
    });
  }
  cache = out;
  return out;
}
