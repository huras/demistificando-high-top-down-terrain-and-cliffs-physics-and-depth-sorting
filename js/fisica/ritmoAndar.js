const RITMO_MIN = 0.45;
const RITMO_MAX = 5.5;

/**
 * Multiplicador do ciclo de andar.
 * 1 = a cadência de referência, em células/s.
 */
export function ritmoAndar(velocidade, referencia) {
  const base = referencia > 0.05 ? referencia : 1;
  const v = Math.max(0, velocidade || 0);
  if (v < 0.2) return RITMO_MIN;
  return Math.min(RITMO_MAX, Math.max(RITMO_MIN, v / base));
}
