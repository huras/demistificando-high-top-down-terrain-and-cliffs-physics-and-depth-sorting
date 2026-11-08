/**
 * Chapéu de cogumelo: meio cliff de piso e relance no pouso.
 * Busca por x/y real na área do disco (sobrevive a prop movida de chunk).
 */
import {
  GRAVIDADE,
  GRAVIDADE_PULO_SEGURANDO,
  PULO_EPS_POUSO,
  PULO_VELOCIDADE,
  RAIO_BASE_PEDRA,
} from "../config.js";
import { sacudir } from "../campo/sacudida.js";
import { visitarVegetacaoNaArea } from "../mundo/bioma/propsBioma.js";

/** Compat: sprite clássico de bolinhas (todos os mushroom-* pulam agora). */
export const SPRITE_TRAMPOLIM = "mushroom-1";

/** Qualquer prop cujo sprite seja cogumelo. */
export function ehSpriteTrampolim(sprite) {
  const id = String(sprite || "");
  return id === SPRITE_TRAMPOLIM || id.includes("mushroom");
}

/** Metade de um nível de cliff. */
export const ALTURA_CHAPEU = 0.5;

const MUL_BASE = 3;
const MUL_TIMING = 6;
/** Espaço depois do contato, enquanto sobe. */
const JANELA_MS = 100;
/** Espaço na descida perto do chapéu conta como o timing, não abre a asa. */
const PERTO_BLOCOS = 1.6;
const ARMA_MS = 350;

const ALTURA_NORMAL =
  (PULO_VELOCIDADE * PULO_VELOCIDADE) / (2 * GRAVIDADE_PULO_SEGURANDO);

const RAIO2 = RAIO_BASE_PEDRA * RAIO_BASE_PEDRA;

function vzDe(mul) {
  return Math.sqrt(2 * GRAVIDADE * ALTURA_NORMAL * mul);
}

function vivo(prop) {
  if (!prop || prop.oculto || prop.forcaCarregado) return false;
  if (!ehSpriteTrampolim(prop.sprite)) return false;
  const fase = prop.fase;
  return fase !== "caindo" && fase !== "removido";
}

/** Cogumelo sob o ponto, no disco da pedra (por x/y real, não só bucket do chunk). */
export function cogumeloNoDisco(x, y) {
  let melhor = null;
  let melhorD = RAIO2;
  visitarVegetacaoNaArea(
    x - RAIO_BASE_PEDRA,
    y - RAIO_BASE_PEDRA,
    x + RAIO_BASE_PEDRA,
    y + RAIO_BASE_PEDRA,
    (p) => {
      if (!vivo(p)) return;
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d >= melhorD) return;
      melhorD = d;
      melhor = p;
    },
  );
  return melhor;
}

function topoDe(prop) {
  return (Number(prop.z) || 0) + ALTURA_CHAPEU;
}

/**
 * Piso do chapéu quando o pé alcança ele, ou o degrau de meio cliff
 * a partir do chão atual. Fora isso devolve `solido`.
 * @param {number} solido
 */
export function pisoComTrampolim(x, y, elevRef, solido) {
  if (!(solido > 0)) return solido;
  const prop = cogumeloNoDisco(x, y);
  if (!prop) return solido;
  const topo = topoDe(prop);
  const ref = elevRef != null && Number.isFinite(elevRef) ? elevRef : topo;
  if (topo <= ref + PULO_EPS_POUSO) return Math.max(solido, topo);
  if (topo <= ref + ALTURA_CHAPEU + 1e-3 && topo + 1e-3 >= solido) return topo;
  return solido;
}

function impulso(corpo, topo, mul, prop) {
  corpo.z = topo;
  corpo.elevacao = topo;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.voando = false;
  corpo.vz = vzDe(mul);
  corpo.puloCortado = true;
  corpo.segurarPulo = false;
  corpo.coyoteT = 0;
  corpo.tempoAr = 0;
  corpo.hopLift = 0;
  corpo.acao = "pulando";
  if (mul >= MUL_TIMING) corpo.trampolimAte = 0;
  else corpo.trampolimAte = performance.now() + JANELA_MS;
  corpo.trampolimArmadoAte = 0;
  sacudir(prop, mul >= MUL_TIMING ? 0.16 : 0.12);
}

/**
 * Relance no pouso. Agente não dispara. Segurar Space não estica:
 * o corte já nasce marcado. Timing (buffer ou arma) vai a 6×.
 * @returns {boolean}
 */
export function relancarTrampolim(corpo, zChao) {
  if (!corpo || corpo.agente || corpo.voando || corpo.nadando) return false;
  // Pouso de queda. Andar só copia o piso e não passa por aqui.
  if (!((corpo.vz || 0) < 0)) return false;
  const prop = cogumeloNoDisco(corpo.x, corpo.y);
  if (!prop) return false;
  const topo = topoDe(prop);
  if (Math.abs(zChao - topo) > PULO_EPS_POUSO + 0.02) return false;
  const agora = performance.now();
  const timing =
    (corpo.puloBufferT || 0) > 0 ||
    (corpo.trampolimArmadoAte || 0) >= agora;
  corpo.puloBufferT = 0;
  impulso(corpo, topo, timing ? MUL_TIMING : MUL_BASE, prop);
  return true;
}

/**
 * Espaço na janela depois do contato troca 3× por 6×.
 * @returns {boolean} consumiu a tecla
 */
export function tentarTimingTrampolim(corpo, apertou) {
  if (!apertou || !corpo || corpo.agente) return false;
  if (!((corpo.vz || 0) > 0)) return false;
  const ate = corpo.trampolimAte || 0;
  if (ate <= 0 || performance.now() > ate) return false;
  const prop = cogumeloNoDisco(corpo.x, corpo.y);
  const topo = corpo.z;
  impulso(corpo, topo, MUL_TIMING, prop);
  return true;
}

/**
 * Perto do chapéu, na descida, o espaço fica reservado pro relance.
 * @returns {boolean} não abrir a asa
 */
export function armarTimingTrampolim(corpo) {
  if (!corpo || corpo.agente || corpo.voando || corpo.planando) return false;
  if ((corpo.vz || 0) > 0.35) return false;
  const prop = cogumeloNoDisco(corpo.x, corpo.y);
  if (!prop) return false;
  const topo = topoDe(prop);
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  if (elev + 0.05 < topo) return false;
  if (elev > topo + PERTO_BLOCOS) return false;
  corpo.trampolimArmadoAte = performance.now() + ARMA_MS;
  return true;
}
