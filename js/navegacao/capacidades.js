import { cancelarPath } from "./filaPath.js";
import { clonarPerfil, PERFIL_CAMPO, PERFIL_COMPANHEIRO } from "./perfilMovimento.js";
import { resetarNav } from "./seguirCaminho.js";

/** Caps padrão do companheiro (HUD): andar / nadar / pular — climb/fly off. */
export const CAPS_PADRAO = Object.freeze({
  pular: true,
  escalar: false,
  planar: false,
  correr: true,
  voar: false,
  vadear: true,
  nadar: true,
  cachoeira: false,
});

export function normalizarCaps(caps = {}) {
  return {
    pular: caps.pular !== false,
    escalar: caps.escalar !== false,
    planar: caps.planar !== false,
    correr: caps.correr !== false,
    voar: caps.voar !== false,
    vadear: caps.vadear !== false,
    nadar: caps.nadar !== false,
    cachoeira: caps.cachoeira !== false,
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
    `vau=${c.vadear ? 1 : 0}`,
    `nado=${c.nadar ? 1 : 0}`,
    `queda=${c.cachoeira ? 1 : 0}`,
  ].join("|");
}

export function perfilDeCapacidades(caps, base = PERFIL_COMPANHEIRO) {
  const c = normalizarCaps(caps);
  // Compartilha grafo com selvagens quando caps = campo (sem climb/fly).
  const soCampo =
    c.pular &&
    !c.escalar &&
    !c.planar &&
    !c.voar &&
    c.correr &&
    c.vadear &&
    c.nadar &&
    !c.cachoeira;
  const baseUsar = soCampo ? PERFIL_CAMPO : base;
  return clonarPerfil(baseUsar, {
    id: soCampo ? PERFIL_CAMPO.id : fingerprintCaps(c),
    podePular: c.pular,
    podeEscalar: c.escalar,
    podePlanar: c.planar,
    podeCorrer: c.correr,
    podeVoar: c.voar,
    podeVadear: c.vadear,
    podeNadar: c.nadar,
    podeCachoeira: c.cachoeira,
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
