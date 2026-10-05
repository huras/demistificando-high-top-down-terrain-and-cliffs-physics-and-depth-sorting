import { cancelarPath } from "./filaPath.js";
import { clonarPerfil, PERFIL_COMPANHEIRO } from "./perfilMovimento.js";
import { resetarNav } from "./seguirCaminho.js";

/** Caps padrão do companheiro (HUD). */
export const CAPS_PADRAO = Object.freeze({
  pular: true,
  escalar: true,
  planar: true,
  correr: true,
  voar: true,
});

export function normalizarCaps(caps = {}) {
  return {
    pular: caps.pular !== false,
    escalar: caps.escalar !== false,
    planar: caps.planar !== false,
    correr: caps.correr !== false,
    voar: caps.voar !== false,
  };
}

/** Id estável pro cache do grafo — muda só quando flags mudam. */
export function fingerprintCaps(caps) {
  const c = normalizarCaps(caps);
  return [
    "comp",
    `pular=${c.pular ? 1 : 0}`,
    `escalar=${c.escalar ? 1 : 0}`,
    `planar=${c.planar ? 1 : 0}`,
    `correr=${c.correr ? 1 : 0}`,
    `voar=${c.voar ? 1 : 0}`,
  ].join("|");
}

export function perfilDeCapacidades(caps, base = PERFIL_COMPANHEIRO) {
  const c = normalizarCaps(caps);
  return clonarPerfil(base, {
    id: fingerprintCaps(c),
    podePular: c.pular,
    podeEscalar: c.escalar,
    podePlanar: c.planar,
    podeCorrer: c.correr,
    podeVoar: c.voar,
  });
}

/**
 * Aplica capacidades no companheiro e invalida path atual.
 */
export function aplicarCapacidades(agente, caps) {
  if (!agente) return null;
  const perfil = perfilDeCapacidades(caps);
  agente.perfil = perfil;
  agente.caps = normalizarCaps(caps);
  cancelarPath(agente.id);
  resetarNav(agente);
  return perfil;
}
