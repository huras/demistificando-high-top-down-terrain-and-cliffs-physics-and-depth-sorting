/**
 * Overrides de altura do sítio outdoor (sem imports de catálogo — evita ciclo).
 * Núcleo: altura fixa (useMinHeight). Avental: blend Chebyshev até o natural.
 */

/** @type {Map<string, { h: number, ring: number }>} */
const plano = new Map();

function chave(x, y) {
  return `${x | 0},${y | 0}`;
}

export function limparRelevoSites() {
  plano.clear();
}

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1 exclusive
 * @param {number} y1 exclusive
 * @param {number} hAltura
 * @param {number} [anel] células de avental (0 = só núcleo)
 */
export function carimbarPlanoSite(x0, y0, x1, y1, hAltura, anel = 3) {
  const h = Math.max(1, hAltura | 0);
  const pad = Math.max(0, anel | 0);
  const xa = (x0 | 0) - pad;
  const ya = (y0 | 0) - pad;
  const xb = (x1 | 0) + pad;
  const yb = (y1 | 0) + pad;
  for (let ty = ya; ty < yb; ty++) {
    for (let tx = xa; tx < xb; tx++) {
      const dx = tx < x0 ? x0 - tx : tx >= x1 ? tx - (x1 - 1) : 0;
      const dy = ty < y0 ? y0 - ty : ty >= y1 ? ty - (y1 - 1) : 0;
      const ring = Math.max(dx, dy);
      const k = chave(tx, ty);
      const prev = plano.get(k);
      if (!prev || ring < prev.ring || (ring === 0 && prev.ring > 0)) {
        plano.set(k, { h, ring });
      } else if (ring === 0 && prev.ring === 0) {
        if (h < prev.h) plano.set(k, { h, ring: 0 });
      }
    }
  }
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {number} hNatural
 * @returns {number}
 */
export function alturaComPlanoSite(wx, wy, hNatural) {
  const e = plano.get(chave(wx, wy));
  if (!e) return hNatural;
  if (e.ring <= 0) return e.h;
  const nat = Number.isFinite(hNatural) ? hNatural | 0 : e.h;
  if (nat === e.h) return e.h;
  const passo = Math.min(e.ring, Math.abs(nat - e.h));
  return nat > e.h ? e.h + passo : e.h - passo;
}

export function temPlanoSite(wx, wy) {
  return plano.has(chave(wx, wy));
}

/** True se célula é núcleo (pad flat), não avental. */
export function ehNucleoPlanoSite(wx, wy) {
  const e = plano.get(chave(wx, wy));
  return !!(e && e.ring <= 0);
}

export function tamanhoPlanoSite() {
  return plano.size;
}
