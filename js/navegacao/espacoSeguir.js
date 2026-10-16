import { AGENTE_DIST_SEGUIR, AGENTE_GAP_ELEV_PARAR } from "../config.js";

/** Dentro disto já conta como parado — evita tremer na borda do raio. */
const TOLERANCIA = 0.08;
/** Células finais em que a velocidade cai até parar, em vez de derrapar. */
const FAIXA_FREIO = 1.25;
const FREIO_MIN = 0.22;
const VEL_RECUO = 2.2;

const DIR_X = 1.7;
const DIR_Y = 1.85;
const DIR = Math.hypot(DIR_X, DIR_Y);
/** Nasce dentro da tolerância, então não dá o passo de recuo no primeiro frame. */
const DIST_NASCER = AGENTE_DIST_SEGUIR - TOLERANCIA * 0.5;
const LATERAL = (DIR_X / DIR) * DIST_NASCER;
const ATRAS = (DIR_Y / DIR) * DIST_NASCER;

/** NPC companheiro, atrás e à esquerda do jogador. */
export const OFFSET_NPC = Object.freeze({ x: -LATERAL, y: ATRAS });
/** Pokémon do time, atrás e à direita — não nasce em cima do NPC. */
export const OFFSET_MON = Object.freeze({ x: LATERAL, y: ATRAS });

const _passo = { ix: 0, iy: 0, velMax: 0 };

/**
 * Ajusta o passo de quem segue o jogador.
 * O objeto devolvido é reutilizado: vale só até a próxima chamada.
 * distSeguir <= 0 deixa o passo intacto (perseguição de combate).
 */
export function aplicarEspacoSeguir(agente, lider, ix, iy, velMax, distSeguir) {
  _passo.ix = ix;
  _passo.iy = iy;
  _passo.velMax = velMax;
  if (!(distSeguir > 0)) return _passo;
  if (agente.voando || agente.planando || agente.escalando || agente.mantle) return _passo;

  const dx = lider.x - agente.x;
  const dy = lider.y - agente.y;
  const dist = Math.hypot(dx, dy);
  const zLider = lider.elevacao ?? lider.z ?? 0;
  const zAg = agente.elevacao ?? agente.z ?? 0;
  if (Math.abs(zAg - zLider) >= AGENTE_GAP_ELEV_PARAR) return _passo;

  const folga = dist - distSeguir;
  if (folga < -TOLERANCIA) {
    const d = dist > 1e-4 ? dist : 1;
    _passo.ix = -dx / d;
    _passo.iy = -dy / d;
    if (agente.vx * dx + agente.vy * dy > 0) {
      agente.vx = 0;
      agente.vy = 0;
    }
    _passo.velMax = velMax < VEL_RECUO ? velMax : VEL_RECUO;
    return _passo;
  }
  if (folga <= 0) {
    agente.vx = 0;
    agente.vy = 0;
    _passo.ix = 0;
    _passo.iy = 0;
    return _passo;
  }
  if (folga < FAIXA_FREIO) {
    const escala = folga / FAIXA_FREIO;
    _passo.velMax = velMax * (escala > FREIO_MIN ? escala : FREIO_MIN);
  }
  return _passo;
}

export { AGENTE_DIST_SEGUIR };
