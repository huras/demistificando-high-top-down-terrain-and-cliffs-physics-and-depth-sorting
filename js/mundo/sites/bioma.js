/**
 * Chave de bioma do sítio a partir da zona Kanto.
 */
import {
  RELEVO_FUNDO,
  RELEVO_MONTANHA,
  RELEVO_RASO,
  relevoEm,
} from "../regiao/kantoRelevo.js";

/**
 * @param {object|null|undefined} zona
 * @returns {"terra"|"agua"|"montanha"|"floresta"}
 */
export function biomaDaZona(zona) {
  if (!zona) return "terra";
  if (zona.agua) return "agua";
  if (zona.montanha) return "montanha";
  if (zona.densa || zona.floresta) return "floresta";

  const ax = zona.ax | 0;
  const ay = zona.ay | 0;
  const relevo = relevoEm(ax, ay);
  if (relevo === RELEVO_MONTANHA) return "montanha";
  if (relevo === RELEVO_RASO || relevo === RELEVO_FUNDO) return "agua";
  return "terra";
}

export function zonaAceitaSite(zona) {
  if (!zona) return false;
  return zona.tipo === "rota" || zona.tipo === "mato";
}
