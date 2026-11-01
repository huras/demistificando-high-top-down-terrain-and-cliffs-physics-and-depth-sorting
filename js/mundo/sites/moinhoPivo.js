/**
 * Offset do pivô do ventilador (espaço local do pai do eixo, após escala do molde).
 * Editado em colisores.html → aba Moinho.
 */

/** @type {Record<string, { dx:number, dy:number, dz:number }>} */
let cache = {};
/** @type {Promise<Record<string, { dx:number, dy:number, dz:number }>> | null} */
let pedido = null;

function limparOffset(raw) {
  if (!raw || typeof raw !== "object") return { dx: 0, dy: 0, dz: 0 };
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : 0;
  };
  return { dx: n(raw.dx), dy: n(raw.dy), dz: n(raw.dz) };
}

export function carregarMoinhoPivo() {
  if (!pedido) {
    pedido = fetch("assets/models/moinho-pivo.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((json) => {
        cache = json && typeof json === "object" && !Array.isArray(json) ? json : {};
        return cache;
      })
      .catch(() => {
        cache = {};
        return cache;
      });
  }
  return pedido;
}

/** Injeta mapa (editor após salvar / testes). */
export function definirCacheMoinhoPivo(obj) {
  cache = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
}

/**
 * @param {string} modeloId
 * @returns {{ dx:number, dy:number, dz:number }}
 */
export function offsetMoinho(modeloId) {
  return limparOffset(cache[modeloId]);
}

export function temOffsetMoinho(modeloId) {
  const o = cache[modeloId];
  if (!o) return false;
  const limpo = limparOffset(o);
  return limpo.dx !== 0 || limpo.dy !== 0 || limpo.dz !== 0;
}
