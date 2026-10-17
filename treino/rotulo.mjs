import { ALVO_REDE, LEAD_MAX, RAIO_ARENA, RAIO_PROJETIL } from "../js/pokemon/ia/constantes.js";
import { limitarArena, regua, sentidoParada } from "../js/pokemon/ia/espaco.js";
import { classeEsquiva } from "../js/pokemon/ia/observacao.js";

export function rotulo(hab, ator, alvo, tiros, dst) {
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const fx = dx / d;
  const fy = dy / d;
  const lx = -fy;
  const ly = fx;
  if (hab === "esquivar") {
    const c = classeEsquiva(ator, alvo, tiros);
    dst[0] = c === 0 ? ALVO_REDE : -ALVO_REDE;
    dst[1] = c === 1 ? ALVO_REDE : -ALVO_REDE;
    dst[2] = -ALVO_REDE;
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
  const dir = rng() * Math.PI * 2;
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  const t = 0.06 + rng() * 0.36;
  const lat = (rng() * 2 - 1) * 1.05;
  const vel = 14;
  const px = ator.x - c * vel * t + -s * lat;
  const py = ator.y - s * vel * t + c * lat;
  alvo.x = ator.x - c * 4;
  alvo.y = ator.y - s * 4;
  limitarArena(alvo);
  tiros.push({
    x: px,
    y: py,
    vx: c * vel,
    vy: s * vel,
    raio: RAIO_PROJETIL,
    faccao: "b",
    dono: alvo,
    viajou: 0,
    max: 12,
  });
}
