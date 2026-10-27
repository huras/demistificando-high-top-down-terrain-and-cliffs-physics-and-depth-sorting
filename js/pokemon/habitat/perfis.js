/**
 * Perfis de locomocão por habitat (consumidos por locomocaoCampo / agentes).
 */
import { PERFIL_CAMPO, clonarPerfil } from "../../navegacao/perfilMovimento.js";
import { HABITAT } from "./kinds.js";

/** Reexport do OW padrão (terra / andar+nadar). */
export { PERFIL_CAMPO };

/** Ninho alto FlapAround: voo livre entre mesa e solo. */
export const PERFIL_NINHO_VOO = Object.freeze(
  clonarPerfil(PERFIL_CAMPO, {
    id: "ninho-voo",
    podeVoar: true,
    podePlanar: true,
    podeNadar: false,
    quedaMaxAndar: 2,
  }),
);

/** Lar na lâmina d'água. */
export const PERFIL_SUPERFICIE = Object.freeze(
  clonarPerfil(PERFIL_CAMPO, {
    id: "lar-superficie",
    podeVoar: false,
    podePlanar: false,
    podeNadar: true,
    podeVadear: true,
    quedaMaxAndar: 1,
  }),
);

/** Lar no fundo submerso. */
export const PERFIL_UNDERSEA = Object.freeze(
  clonarPerfil(PERFIL_CAMPO, {
    id: "lar-undersea",
    podeVoar: false,
    podePlanar: false,
    podeNadar: true,
    podeVadear: true,
    podeCachoeira: false,
    quedaMaxAndar: 1,
  }),
);

/**
 * @param {string | null | undefined} kind
 * @param {object | null} [ator]
 */
export function perfilDoHabitat(kind, ator = null) {
  if (ator?.faccao === "party" && ator.perfil) return ator.perfil;
  if (kind === HABITAT.HIGH) return PERFIL_NINHO_VOO;
  if (kind === HABITAT.SURFACE) return PERFIL_SUPERFICIE;
  if (kind === HABITAT.UNDERSEA) return PERFIL_UNDERSEA;
  if (kind === HABITAT.SKY) return PERFIL_NINHO_VOO;
  return PERFIL_CAMPO;
}
