/**
 * Assentos de montaria por espécie (célula relativa ao centro do mon).
 * x = lateral (direita do facing), y = frente do facing (negativo = costas),
 * elev = altura dos pés do jogador acima do chão do mon.
 */

export const MODOS_RIDE = Object.freeze(["ride", "fly", "surf"]);

/** Defaults no estilo Pokémon AI (y negativo ≈ costas / cima no sprite). */
export const ASSENTOS_PADRAO = Object.freeze({
  ride: Object.freeze({ x: 0, y: -0.22, elev: 0.55 }),
  fly: Object.freeze({ x: 0, y: -0.18, elev: 0.72 }),
  surf: Object.freeze({ x: 0, y: -0.14, elev: 0.42 }),
});

const URL = "/assets/pokemon/ride-assentos.json";

/** @type {Record<string, object>} */
let estado = {};
let carregado = false;
/** @type {Promise<void> | null} */
let pedido = null;

function clampSeat(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(min, Math.min(max, v)) * 100) / 100;
}

export function normalizarAssento(raw, fallback) {
  const fb = fallback || ASSENTOS_PADRAO.ride;
  if (!raw || typeof raw !== "object") {
    return { x: fb.x, y: fb.y, elev: fb.elev };
  }
  return {
    x: clampSeat(raw.x ?? fb.x, -2, 2),
    y: clampSeat(raw.y ?? fb.y, -2, 2),
    elev: clampSeat(raw.elev ?? fb.elev, 0, 3),
  };
}

function normalizarEntrada(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ride: normalizarAssento(raw.ride, ASSENTOS_PADRAO.ride),
    fly: normalizarAssento(raw.fly, ASSENTOS_PADRAO.fly),
    surf: normalizarAssento(raw.surf, ASSENTOS_PADRAO.surf),
  };
}

function chaveDe(atorOuKey) {
  if (!atorOuKey) return null;
  if (typeof atorOuKey === "string") return atorOuKey;
  return atorOuKey.especie?.key || atorOuKey.key || null;
}

export function garantirRideAssentos() {
  if (carregado) return Promise.resolve();
  if (pedido) return pedido;
  pedido = fetch(URL, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((json) => {
      estado = {};
      if (json && typeof json === "object") {
        for (const [k, v] of Object.entries(json)) {
          const ent = normalizarEntrada(v);
          if (ent) estado[k] = ent;
        }
      }
      carregado = true;
    })
    .catch(() => {
      estado = {};
      carregado = true;
    });
  return pedido;
}

export function estadoRideAssentos() {
  return estado;
}

export function definirEstadoRideAssentos(mapa) {
  estado = {};
  if (!mapa || typeof mapa !== "object") return estado;
  for (const [k, v] of Object.entries(mapa)) {
    const ent = normalizarEntrada(v);
    if (ent) estado[k] = ent;
  }
  return estado;
}

/**
 * @param {object|string|null} atorOuKey
 * @param {"ride"|"fly"|"surf"} modo
 */
export function obterAssentoRide(atorOuKey, modo = "ride") {
  const m = MODOS_RIDE.includes(modo) ? modo : "ride";
  const fb = ASSENTOS_PADRAO[m];
  const key = chaveDe(atorOuKey);
  if (!key) return { ...fb };
  const ent = estado[key];
  if (!ent) return { ...fb };
  return normalizarAssento(ent[m], fb);
}

/**
 * @param {string} key
 * @param {"ride"|"fly"|"surf"} modo
 * @param {{ x?: number, y?: number, elev?: number }} seat
 */
export function definirAssentoRide(key, modo, seat) {
  if (!key || !MODOS_RIDE.includes(modo)) return null;
  const prev = estado[key] || {
    ride: { ...ASSENTOS_PADRAO.ride },
    fly: { ...ASSENTOS_PADRAO.fly },
    surf: { ...ASSENTOS_PADRAO.surf },
  };
  const next = {
    ride: normalizarAssento(prev.ride, ASSENTOS_PADRAO.ride),
    fly: normalizarAssento(prev.fly, ASSENTOS_PADRAO.fly),
    surf: normalizarAssento(prev.surf, ASSENTOS_PADRAO.surf),
    [modo]: normalizarAssento({ ...prev[modo], ...seat }, ASSENTOS_PADRAO[modo]),
  };
  estado[key] = next;
  return next;
}

/** Offset no plano do chão a partir do facing (dirX/dirY). */
export function offsetAssentoMundo(dirX, dirY, seat) {
  let fx = Number(dirX) || 0;
  let fy = Number(dirY) || 0;
  if (fx === 0 && fy === 0) {
    fx = 0;
    fy = 1;
  }
  const len = Math.hypot(fx, fy) || 1;
  fx /= len;
  fy /= len;
  // direita do facing
  const rx = fy;
  const ry = -fx;
  const sx = seat?.x || 0;
  const sy = seat?.y || 0;
  return {
    x: sx * rx + sy * fx,
    y: sx * ry + sy * fy,
    elev: Number(seat?.elev) > 0 ? Number(seat.elev) : 0,
  };
}

/**
 * Ponto do assento no mundo.
 * `comElev`: se true, soma a altura do assento (preview); no cinema/física o lift
 * visual vai em `_rideSeatElev` pra não flutuar a hitbox.
 */
export function pontoAssentoMundo(ator, modo = "ride", { comElev = false } = {}) {
  const seat = obterAssentoRide(ator, modo);
  const off = offsetAssentoMundo(ator?.dirX, ator?.dirY, seat);
  const elevBase = Number.isFinite(ator?.elevacao)
    ? ator.elevacao
    : Number.isFinite(ator?.z)
      ? ator.z
      : 0;
  return {
    x: (ator?.x || 0) + off.x,
    y: (ator?.y || 0) + off.y,
    elev: comElev ? elevBase + off.elev : elevBase,
    off,
    seat,
  };
}

garantirRideAssentos();
