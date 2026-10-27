/**
 * Força psíquica: telecinese (anexo flutuante) + hover do carrier.
 */

export const PSIQUICO_REACH_EXTRA = 0.45;
/** Distância máx. pedra↔carrier enquanto carrega (tiles/blocos mundo). */
export const PSIQUICO_ALCANCE_MAX = 2;
/** Distância à frente do carrier (clampada em ALCANCE_MAX). */
export const PSIQUICO_DIST_FRENTE = 2;
export const PSIQUICO_ALTURA_BASE = 1.05;
export const PSIQUICO_HOVER_BASE = 0.42;
export const PSIQUICO_HOVER_BOB = 0.08;
export const PSIQUICO_OBJ_BOB = 0.06;

/** Facing unitário — evita `facingDe` que trata dirY=0 como ausente (`|| 1`). */
function facingUnitario(carrier) {
  let fx = Number(carrier?.dirX ?? carrier?.facingX);
  let fy = Number(carrier?.dirY ?? carrier?.facingY);
  if (!Number.isFinite(fx)) fx = 0;
  if (!Number.isFinite(fy)) fy = 0;
  const fl = Math.hypot(fx, fy);
  if (fl < 1e-6) return { x: 0, y: 1 };
  return { x: fx / fl, y: fy / fl };
}

/**
 * @param {object | null | undefined} carrier
 * @returns {string[]}
 */
export function tiposDoCarrier(carrier) {
  if (!carrier) return [];
  if (Array.isArray(carrier.tipos) && carrier.tipos.length) {
    return carrier.tipos.map((t) => String(t).toLowerCase());
  }
  const esp = carrier.especie;
  if (Array.isArray(esp?.tipos) && esp.tipos.length) {
    return esp.tipos.map((t) => String(t).toLowerCase());
  }
  return [];
}

/**
 * @param {object | null | undefined} carrier
 */
export function temTipoPsiquico(carrier) {
  const tipos = tiposDoCarrier(carrier);
  for (let i = 0; i < tipos.length; i++) {
    if (tipos[i] === "psychic") return true;
  }
  return false;
}

/**
 * @param {object | null | undefined} carrier
 * @returns {"fisico"|"psiquico"}
 */
export function modoAnexoForca(carrier) {
  return temTipoPsiquico(carrier) ? "psiquico" : "fisico";
}

/**
 * Clona gate de cone com reach maior (telecinese).
 * @param {object} gate
 */
export function alcanceGatePsiquico(gate) {
  if (!gate) return gate;
  const extra = PSIQUICO_REACH_EXTRA;
  return {
    ...gate,
    enterReach: gate.enterReach + extra,
    exitReach: gate.exitReach + extra,
  };
}

/**
 * Ponto world onde o alvo flutua (frente do carrier + bob).
 * @param {object} carrier
 * @param {{ halfH?: number, halfW?: number } | null} [carga]
 * @param {number} [tSec]
 * @returns {{ x: number, y: number, z: number }}
 */
export function offsetTelecinese(carrier, carga = null, tSec = 0) {
  const f = facingUnitario(carrier);
  const half = Math.max(0.25, Number(carga?.halfH) || 0.4);
  // Até 2 tiles do carregador — flutua à frente, sem colar na cabeça.
  const dist = Math.min(PSIQUICO_ALCANCE_MAX, PSIQUICO_DIST_FRENTE);
  const bob = Math.sin((tSec || 0) * 5.2) * PSIQUICO_OBJ_BOB;
  const zBase = Number(carrier.elevacao ?? carrier.z) || 0;
  const hover = Number(carrier._forcaHover) || PSIQUICO_HOVER_BASE;
  return {
    x: carrier.x + f.x * dist,
    y: carrier.y + f.y * dist,
    z: zBase + hover + PSIQUICO_ALTURA_BASE + bob + half * 0.15,
  };
}

/**
 * Hover visual do carrier psíquico enquanto concentra / carrega.
 * Física de chão inalterada — só `_forcaHover` pro render/anexo.
 * @param {object | null} carrier
 * @param {boolean} ativo
 * @param {number} dt
 * @param {number} [tSec]
 */
export function hoverCarrierPsiquico(carrier, ativo, dt, tSec = 0) {
  if (!carrier) return;
  if (!ativo || !temTipoPsiquico(carrier)) {
    limparHoverPsiquico(carrier);
    return;
  }
  const bob = Math.sin((tSec || performance.now() * 0.001) * 4.4) * PSIQUICO_HOVER_BOB;
  const alvo = PSIQUICO_HOVER_BASE + bob;
  const atual = Number(carrier._forcaHover);
  const cur = Number.isFinite(atual) ? atual : 0;
  const k = Math.min(1, Math.max(0.08, (dt || 0.016) * 6));
  carrier._forcaHover = cur + (alvo - cur) * k;
  carrier._forcaPsiquico = true;
}

/**
 * @param {object | null | undefined} carrier
 */
export function limparHoverPsiquico(carrier) {
  if (!carrier) return;
  if (carrier._forcaHover != null) carrier._forcaHover = 0;
  delete carrier._forcaPsiquico;
}
