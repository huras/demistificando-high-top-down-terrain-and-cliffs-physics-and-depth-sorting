import { POKEMON } from "../../config.js";
import {
  CORREDOR_REDE,
  ENTRADAS,
  FOLGA_PROJETIL,
  JANELA_REDE,
  RAIO_ARENA,
  RAIO_PROJETIL,
} from "./constantes.js";

/** Buffer único do tick. Quem chama escreve aqui e a rede lê em seguida. */
export const entrada = new Float32Array(ENTRADAS);
export const saida = new Float32Array(5);

const VEL = POKEMON.VEL_AGRO || 4.2;
const quadro = { d: 1, fx: 1, fy: 0, lx: 0, ly: 1 };
const ameaca = { tem: 0, t: 0, lat: 0, linha: 0, ax: 0, ay: 0 };

function preencherQuadro(ator, alvo) {
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  quadro.d = d;
  quadro.fx = dx / d;
  quadro.fy = dy / d;
  quadro.lx = -quadro.fy;
  quadro.ly = quadro.fx;
  return quadro;
}

function buscarAmeaca(ator, tiros, lx, ly, janela, corredor) {
  ameaca.tem = 0;
  ameaca.t = 0;
  ameaca.lat = 0;
  ameaca.linha = 0;
  ameaca.ax = 0;
  ameaca.ay = 0;
  const n = tiros ? tiros.length : 0;
  let melhor = janela;
  for (let i = 0; i < n; i++) {
    const p = tiros[i];
    if (!p || p.dono === ator || p.faccao === ator.faccao) continue;
    const vx = p.vx || 0;
    const vy = p.vy || 0;
    const vv = vx * vx + vy * vy;
    if (vv < 0.25) continue;
    const rx = ator.x - p.x;
    const ry = ator.y - p.y;
    if (rx * vx + ry * vy <= 0) continue;
    const vel = Math.sqrt(vv);
    const t = Math.hypot(rx, ry) / vel;
    if (t > janela || t > melhor) continue;
    const tc = (rx * vx + ry * vy) / vv;
    const ox = rx - vx * tc;
    const oy = ry - vy * tc;
    const linha = Math.hypot(ox, oy);
    if (linha > (p.raio || RAIO_PROJETIL) + corredor) continue;
    melhor = t;
    ameaca.tem = 1;
    ameaca.t = t;
    ameaca.lat = ox * lx + oy * ly;
    ameaca.linha = linha;
    ameaca.ax = vx / vel;
    ameaca.ay = vy / vel;
  }
  return ameaca;
}

export function quadroDe(ator, alvo) {
  return preencherQuadro(ator, alvo);
}

/** True se algum tiro passa perto dentro da janela. */
export function tiroNaJanela(ator, alvo, tiros, janela, corredor) {
  const q = preencherQuadro(ator, alvo);
  const a = buscarAmeaca(ator, tiros, q.lx, q.ly, janela, corredor);
  return a.tem === 1;
}

function recargaTiro(ator) {
  if (ator.usaDistancia === false || !ator.golpes) return 1;
  let melhor = 1;
  let achou = false;
  for (let i = 0; i < ator.golpes.length; i++) {
    const g = ator.golpes[i];
    const f = g.def.forma;
    if (f !== "projectile" && f !== "arc") continue;
    achou = true;
    const custo = g.def.pp || 1;
    const u = ator.pp >= custo ? 0 : 1 - Math.max(0, ator.pp) / custo;
    if (u < melhor) melhor = u;
  }
  return achou ? melhor : 1;
}

/**
 * 0 distância, 1 erro até a parada, 2 lateral do alvo (0),
 * 3–4 velocidade relativa, 5–6 vida, 7 esquiva, 8 recarga,
 * 9 alcance, 10–13 ameaça, 14 borda, 15 velocidade.
 */
export function observar(ator, alvo, tiros, alcance, buf) {
  const dst = buf || entrada;
  const q = preencherQuadro(ator, alvo);
  const a = buscarAmeaca(ator, tiros, q.lx, q.ly, JANELA_REDE, CORREDOR_REDE);
  const raio = Math.hypot(ator.x, ator.y);
  const rvx = (alvo.vx || 0) - (ator.vx || 0);
  const rvy = (alvo.vy || 0) - (ator.vy || 0);
  const hpEu = ator.hpMax > 0 ? ator.hp / ator.hpMax : 1;
  const hpAlvo = alvo.hpMax > 0 ? alvo.hp / alvo.hpMax : 1;
  dst[0] = Math.max(0, Math.min(2, q.d / RAIO_ARENA));
  dst[1] = Math.max(-1, Math.min(1, (q.d - alcance) / RAIO_ARENA));
  dst[2] = 0;
  dst[3] = Math.max(-2, Math.min(2, (rvx * q.fx + rvy * q.fy) / VEL));
  dst[4] = Math.max(-2, Math.min(2, (rvx * q.lx + rvy * q.ly) / VEL));
  dst[5] = Math.max(0, Math.min(1, hpEu));
  dst[6] = Math.max(0, Math.min(1, hpAlvo));
  dst[7] = ator.esquiva || 0;
  dst[8] = recargaTiro(ator);
  dst[9] = Math.max(0, Math.min(1, alcance / RAIO_ARENA));
  dst[10] = a.tem ? Math.max(0, Math.min(1, 1 - a.t / JANELA_REDE)) : 0;
  dst[11] = a.tem ? Math.max(-1, Math.min(1, a.lat / (RAIO_PROJETIL + FOLGA_PROJETIL + CORREDOR_REDE))) : 0;
  dst[12] = a.tem ? a.ax * q.fx + a.ay * q.fy : 0;
  dst[13] = a.tem ? a.ax * q.lx + a.ay * q.ly : 0;
  dst[14] = Math.max(0, Math.min(1, 1 - raio / RAIO_ARENA));
  dst[15] = Math.max(0, Math.min(2, Math.hypot(ator.vx || 0, ator.vy || 0) / VEL));
  return dst;
}

/** 1 se o desvio para a esquerda do alvo aumenta o erro. -1 para a direita. 0 sem tiro. */
export function ladoAmeaca(ator, alvo, tiros) {
  const q = preencherQuadro(ator, alvo);
  const a = buscarAmeaca(ator, tiros, q.lx, q.ly, JANELA_REDE, CORREDOR_REDE);
  if (!a.tem) return 0;
  return a.lat >= 0 ? 1 : -1;
}

/** 0 esquerda, 1 direita. O lado que aumenta o erro do tiro. */
export function classeEsquiva(ator, alvo, tiros) {
  return ladoAmeaca(ator, alvo, tiros) < 0 ? 1 : 0;
}
