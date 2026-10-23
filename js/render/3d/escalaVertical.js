/**
 * Escala Y por domínio: relevo × casas × props × cartões.
 * Casas/props/cartões sob o grupo do terreno compensam o squash do pai.
 */
import {
  ALTURA_BLOCO,
  ESCALA_Y_CARTAO,
  ESCALA_Y_CASA,
  ESCALA_Y_PROP,
  ESCALA_Y_RELEVO,
} from "../../config.js";

/** Metros Three por bloco no chão / jogador / câmera. */
export function metrosPorBloco() {
  return ALTURA_BLOCO * ESCALA_Y_RELEVO;
}

/** Escala Y do grupo que contém a malha de relevo. */
export function escalaYGrupoRelevo() {
  return metrosPorBloco();
}

/** Y mundo a partir da cota em blocos. */
export function yDoBloco(bloco) {
  return (Number(bloco) || 0) * metrosPorBloco();
}

/**
 * Fator de scale.y local sob o grupo do relevo, para atingir `escalaMundo` final.
 * @param {number} escalaMundo
 */
export function fatorYSobRelevo(escalaMundo) {
  const pai = escalaYGrupoRelevo();
  if (!(pai > 1e-8)) return escalaMundo;
  return escalaMundo / pai;
}

export function fatorYCasa() {
  return fatorYSobRelevo(ESCALA_Y_CASA);
}

export function fatorYProp() {
  return fatorYSobRelevo(ESCALA_Y_PROP);
}

export function fatorYCartao() {
  return fatorYSobRelevo(ESCALA_Y_CARTAO);
}

/** Lote/casa/poste: XZ uniforme; Y usa o knob do domínio. */
export function aplicarEscalaCasa(grupo, escalaXZ) {
  const s = escalaXZ;
  grupo.scale.set(s, s * fatorYCasa(), s);
  return grupo;
}

export function aplicarEscalaProp(grupo, escalaXZ, multY = 1) {
  const s = escalaXZ;
  const fy = fatorYSobRelevo(ESCALA_Y_PROP * (multY > 0 ? multY : 1));
  grupo.scale.set(s, s * fy, s);
  return grupo;
}

/** Billboard/cartão em pé (compensa o pai do terreno). */
export function aplicarEscalaCartao(grupo) {
  grupo.scale.y = fatorYCartao();
  return grupo;
}

/** Só o eixo Y — cartão de casa/prédio sob o grupo do relevo. */
export function aplicarFatorYCasa(grupo) {
  grupo.scale.y = fatorYCasa();
  return grupo;
}
