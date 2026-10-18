import { ALVO_REDE, FOLGA_PARADA, LEAD_MAX, RAIO_ARENA, RAIO_PROJETIL, VIDA_FUGA } from "../js/pokemon/ia/constantes.js";
import { alcanceSoco, golpeDeCorpo, golpeProntoForma, limitarArena, regua, sentidoParada } from "../js/pokemon/ia/espaco.js";
import { ladoAmeaca } from "../js/pokemon/ia/observacao.js";

export function rotulo(hab, ator, alvo, tiros, dst) {
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const fx = dx / d;
  const fy = dy / d;
  const lx = -fy;
  const ly = fx;
  if (hab === "esquivar") {
    rotuloEsquiva(ator, alvo, tiros, dst, d);
    return;
  }
  if (hab === "fugir") {
    let wx = -fx;
    let wy = -fy;
    const raio = Math.hypot(ator.x, ator.y);
    if (raio > RAIO_ARENA - 1.4) {
      const cx = -ator.x / raio;
      const cy = -ator.y / raio;
      wx = wx * 0.3 + cx * 0.7;
      wy = wy * 0.3 + cy * 0.7;
      const m = Math.hypot(wx, wy) || 1;
      wx /= m;
      wy /= m;
    }
    dst[0] = (wx * fx + wy * fy) * ALVO_REDE;
    dst[1] = (wx * lx + wy * ly) * ALVO_REDE;
    dst[2] = ALVO_REDE;
    return;
  }
  const faixa = regua(ator, hab);
  const sentido = sentidoParada(d, faixa.parada, faixa.forma);
  dst[0] = sentido * ALVO_REDE;
  dst[1] = 0;
  dst[2] = sentido === 0 ? -ALVO_REDE : ALVO_REDE;
  if (hab !== "atirar") return;
  const vel = faixa.vel || 14;
  const tempo = d / vel;
  const leadX = (alvo.vx || 0) * tempo;
  const leadY = (alvo.vy || 0) * tempo;
  dst[3] = Math.max(-ALVO_REDE, Math.min(ALVO_REDE, (leadX * fx + leadY * fy) / LEAD_MAX));
  dst[4] = Math.max(-ALVO_REDE, Math.min(ALVO_REDE, (leadX * lx + leadY * ly) / LEAD_MAX));
}

function marcarEsquiva(dst, ax, ay, gastar) {
  dst[0] = ax;
  dst[1] = ay;
  dst[2] = gastar ? ALVO_REDE : -ALVO_REDE;
}

/** Barra cheia: lado do tiro, para trás se dói, para a frente se o corpo a corpo está longe. */
function rotuloEsquiva(ator, alvo, tiros, dst, d) {
  const cheia = (ator.esquiva || 0) >= 1;
  const lado = ladoAmeaca(ator, alvo, tiros);
  if (lado !== 0) {
    marcarEsquiva(dst, 0, lado * ALVO_REDE, cheia);
    return;
  }
  const hp = ator.hpMax > 0 ? ator.hp / ator.hpMax : 1;
  if (hp < VIDA_FUGA) {
    marcarEsquiva(dst, -ALVO_REDE, 0, cheia);
    return;
  }
  const corpo = golpeDeCorpo(ator);
  const parada = corpo ? regua(ator, "perseguir").parada : 0;
  if (corpo && d < parada - FOLGA_PARADA) {
    marcarEsquiva(dst, -ALVO_REDE, 0, cheia);
    return;
  }
  const tiro = ator.usaDistancia !== false && golpeProntoForma(ator, "projectile", "arc");
  const querFechar = corpo && (!tiro || d <= alcanceSoco(alvo));
  if (querFechar && d > parada + FOLGA_PARADA) {
    marcarEsquiva(dst, ALVO_REDE, 0, cheia);
    return;
  }
  marcarEsquiva(dst, 0, 0, false);
}

function afastar(ator, alvo, dist, ang) {
  alvo.x = ator.x + Math.cos(ang) * dist;
  alvo.y = ator.y + Math.sin(ang) * dist;
  limitarArena(alvo);
}

export function prepararAmostra(hab, ator, alvo, tiros, rng) {
  const ang = rng() * Math.PI * 2;
  const raio = rng() * (RAIO_ARENA - 0.6);
  ator.x = Math.cos(ang) * raio;
  ator.y = Math.sin(ang) * raio;
  ator.vx = (rng() - 0.5) * 2;
  ator.vy = (rng() - 0.5) * 2;
  ator.hp = 25 + rng() * 75;
  ator.hpMax = 100;
  ator.esquiva = rng();
  ator.faccao = "a";
  ator.usaCorpo = true;
  ator.usaDistancia = true;
  if (ator.golpes[1]) ator.golpes[1].cd = rng() < 0.45 ? rng() * 1.2 : 0;
  if (hab === "perseguir") ator.usaDistancia = rng() < 0.5;
  if (hab === "atirar") ator.usaCorpo = rng() < 0.5;
  if (hab === "fugir") {
    ator.usaCorpo = rng() < 0.45;
    ator.hp = rng() < 0.5 ? 15 : ator.hp;
  }
  alvo.faccao = "b";
  alvo.hp = 25 + rng() * 75;
  alvo.hpMax = 100;
  alvo.vx = (rng() - 0.5) * 8.4;
  alvo.vy = (rng() - 0.5) * 8.4;
  const dist = 0.4 + rng() * 9;
  const ang2 = rng() * Math.PI * 2;
  alvo.x = ator.x + Math.cos(ang2) * dist;
  alvo.y = ator.y + Math.sin(ang2) * dist;
  limitarArena(ator);
  limitarArena(alvo);
  tiros.length = 0;
  if (hab !== "esquivar") return;
  ator.esquiva = rng() < 0.88 ? 1 : rng() * 0.85;
  ator.pp = 30;
  const tipo = rng();
  if (tipo < 0.28) {
    ator.usaCorpo = false;
    ator.usaDistancia = false;
    ator.hp = 80 + rng() * 20;
    const dir = rng() * Math.PI * 2;
    const c = Math.cos(dir);
    const s = Math.sin(dir);
    const t = 0.08 + rng() * 0.28;
    const lat = (rng() < 0.5 ? -1 : 1) * (0.15 + rng() * 0.85);
    const vel = 14;
    afastar(ator, alvo, 5.2 + rng() * 1.4, dir + Math.PI);
    tiros.push({
      x: ator.x - c * vel * t - s * lat,
      y: ator.y - s * vel * t + c * lat,
      vx: c * vel,
      vy: s * vel,
      raio: RAIO_PROJETIL,
      faccao: "b",
      dono: alvo,
      viajou: 0,
      max: 12,
    });
    return;
  }
  if (tipo < 0.5) {
    ator.usaCorpo = rng() < 0.55;
    ator.usaDistancia = rng() < 0.65;
    ator.hp = 40 + rng() * 60;
    const dir = rng() * Math.PI * 2;
    const c = Math.cos(dir);
    const s = Math.sin(dir);
    const t = 0.06 + rng() * 0.36;
    const lat = (rng() * 2 - 1) * 1.05;
    const vel = 14;
    afastar(ator, alvo, 2.4 + rng() * 4.2, dir + Math.PI);
    tiros.push({
      x: ator.x - c * vel * t - s * lat,
      y: ator.y - s * vel * t + c * lat,
      vx: c * vel,
      vy: s * vel,
      raio: RAIO_PROJETIL,
      faccao: "b",
      dono: alvo,
      viajou: 0,
      max: 12,
    });
    return;
  }
  if (tipo < 0.68) {
    ator.usaCorpo = true;
    ator.usaDistancia = false;
    ator.hp = 45 + rng() * 55;
    afastar(ator, alvo, 2.2 + rng() * 5.5, rng() * Math.PI * 2);
    return;
  }
  if (tipo < 0.78) {
    ator.usaCorpo = true;
    ator.usaDistancia = rng() < 0.5;
    ator.hp = 45 + rng() * 55;
    afastar(ator, alvo, 0.35 + rng() * 0.5, rng() * Math.PI * 2);
    return;
  }
  if (tipo < 0.86) {
    ator.hp = 6 + rng() * 18;
    ator.usaCorpo = rng() < 0.5;
    ator.usaDistancia = rng() < 0.5;
    afastar(ator, alvo, 0.9 + rng() * 4, rng() * Math.PI * 2);
    return;
  }
  if (tipo < 0.96) {
    ator.usaCorpo = true;
    ator.usaDistancia = true;
    ator.pp = 30;
    ator.hp = 55 + rng() * 45;
    afastar(ator, alvo, 2.6 + rng() * 2.4, rng() * Math.PI * 2);
    return;
  }
  ator.usaCorpo = false;
  ator.usaDistancia = false;
  ator.hp = 70 + rng() * 30;
  afastar(ator, alvo, 4 + rng() * 3, rng() * Math.PI * 2);
}
