/**
 * Yaw de fachada dos prédios da praça.
 * Sul = 0. Casa/lab/ruína fixos; demais olham para o centro (64,64).
 */

const CENTRO = 64;

/** Papéis cuja porta do modelo já aponta para o sul. */
const YAW_SUL = new Set(["casa", "lab", "ruina", "ginasio"]);

/**
 * @param {string} papel
 * @param {number} mx centro do lote em coords locais da cidade
 * @param {number} my
 * @returns {number} yaw em radianos (Y)
 */
export function yawDoEdificio(papel, mx, my) {
  if (YAW_SUL.has(papel)) return 0;
  const dx = mx - CENTRO;
  const dy = my - CENTRO;
  if (Math.abs(dy) <= Math.abs(dx)) return dy > 0 ? Math.PI : 0;
  return dx > 0 ? -Math.PI / 2 : Math.PI / 2;
}
