/**
 * Descoberta, unlock e clear de santuários (persistido no save).
 */

/** @type {{ unlocked: Set<string>, cleared: Set<string>, clearedElements: Map<string, string>, discovered: Set<string>, questDevice: string }} */
export const estadoSantuario = {
  unlocked: new Set(),
  cleared: new Set(),
  clearedElements: new Map(),
  discovered: new Set(),
  /** idle | talkRina | explore | ready | done */
  questDevice: "idle",
};

/** Bump quando discovered/cleared mudam — cache do mapa observa. */
let versaoMapa = 0;

export function versaoMapaSantuario() {
  return versaoMapa;
}

function bumpMapa() {
  versaoMapa++;
}

export function resetEstadoSantuario() {
  estadoSantuario.unlocked.clear();
  estadoSantuario.cleared.clear();
  estadoSantuario.clearedElements.clear();
  estadoSantuario.discovered.clear();
  estadoSantuario.questDevice = "idle";
  bumpMapa();
}

export function descobrirSantuario(shrineId) {
  if (!shrineId) return false;
  if (estadoSantuario.discovered.has(shrineId)) return false;
  estadoSantuario.discovered.add(shrineId);
  bumpMapa();
  return true;
}

export function entradaAberta(shrineId) {
  return !!(shrineId && estadoSantuario.unlocked.has(shrineId));
}

export function destravarEntrada(shrineId) {
  if (!shrineId) return false;
  if (estadoSantuario.unlocked.has(shrineId)) return false;
  estadoSantuario.unlocked.add(shrineId);
  descobrirSantuario(shrineId);
  return true;
}

export function invalidarMarcasSantuario() {
  bumpMapa();
}

export function santuarioLimpo(shrineId) {
  return !!(shrineId && estadoSantuario.cleared.has(shrineId));
}

export function marcarSantuarioLimpo(shrineId, element = "normal") {
  if (!shrineId) return false;
  const ja = estadoSantuario.cleared.has(shrineId);
  estadoSantuario.cleared.add(shrineId);
  estadoSantuario.clearedElements.set(
    shrineId,
    String(element || "normal").toLowerCase()
  );
  if (!estadoSantuario.discovered.has(shrineId)) {
    estadoSantuario.discovered.add(shrineId);
  }
  bumpMapa();
  return !ja;
}

export function serializarSantuarios() {
  return {
    unlocked: [...estadoSantuario.unlocked],
    cleared: [...estadoSantuario.cleared],
    clearedElements: Object.fromEntries(estadoSantuario.clearedElements),
    discovered: [...estadoSantuario.discovered],
    questDevice: estadoSantuario.questDevice,
  };
}

export function hidratarSantuarios(bruto) {
  estadoSantuario.unlocked.clear();
  estadoSantuario.cleared.clear();
  estadoSantuario.clearedElements.clear();
  estadoSantuario.discovered.clear();
  estadoSantuario.questDevice = "idle";
  if (bruto && typeof bruto === "object") {
    for (const id of bruto.unlocked || []) if (id) estadoSantuario.unlocked.add(id);
    for (const id of bruto.cleared || []) if (id) estadoSantuario.cleared.add(id);
    for (const id of bruto.discovered || []) if (id) estadoSantuario.discovered.add(id);
    const els = bruto.clearedElements || {};
    for (const id of Object.keys(els)) {
      estadoSantuario.clearedElements.set(id, String(els[id] || "normal").toLowerCase());
    }
    if (typeof bruto.questDevice === "string") {
      estadoSantuario.questDevice = bruto.questDevice;
    }
  }
  bumpMapa();
}
