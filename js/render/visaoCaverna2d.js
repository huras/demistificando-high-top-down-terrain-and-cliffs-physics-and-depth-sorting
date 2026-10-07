import { tetoSobreCabeca } from "../fisica/colisao.js";

/**
 * Quando o player tem sólido acima da cabeça, a câmera 2D entra em
 * visão de caverna: só geometria sob o teto (sem mundo exterior).
 * @returns {{ teto: number, elev: number } | null}
 */
export function obterVisaoCaverna2d(corpo) {
  if (!corpo) return null;
  const elev = corpo.elevacao ?? corpo.z + (corpo.hopLift || 0);
  const cx = Math.floor(corpo.x);
  const cy = Math.floor(corpo.y);
  const teto = tetoSobreCabeca(cx, cy, elev);
  if (!Number.isFinite(teto)) return null;
  return { teto, elev };
}
