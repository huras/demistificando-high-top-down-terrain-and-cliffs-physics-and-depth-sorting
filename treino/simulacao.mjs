import { RAIO_POKEMON } from "../js/config.js";
import { cenarioIndice, cortaVisada, definirCenario, desviarRumo, empurrarCorpo } from "../js/combate/arenas.js";
import { comecarEsquiva, emAvanco, emEsquiva, emRecuo, passoEsquiva, recarregarBarraEsquiva, velocidadeDe } from "../js/pokemon/ator.js";
import {
  CORREDOR_TIRO,
  FOLGA_PARADA,
  FOLGA_PROJETIL,
  JANELA_TIRO,
  RAIO_ARENA,
  RAIO_PROJETIL,
} from "../js/pokemon/ia/constantes.js";
import { limitarArena, paradaDe, posturaDe, sentidoParada, vaiMelee } from "../js/pokemon/ia/espaco.js";
import { integrarComando } from "../js/pokemon/ia/habilidades.js";
import { pensar, reagirEsquiva } from "../js/pokemon/ia/seletor.js";

const VAZIO = [];

export function lutador(opts = {}) {
  return {
    x: opts.x || 0,
    y: opts.y || 0,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    dirX: 1,
    dirY: 0,
    hp: opts.hp ?? 100,
    hpMax: opts.hpMax ?? 100,
    esquiva: opts.esquiva ?? 1,
    esquivaRestante: 0,
    esquivaDur: 0,
    esquivaDist: 0,
    esquivaDirX: 0,
    esquivaDirY: 0,
    esquivaLado: 1,
    recuoRestante: 0,
    recuoTrava: 0,
    avancoRestante: 0,
    morto: false,
    capturado: false,
    dormindo: 0,
    andando: false,
    usaCorpo: opts.usaCorpo !== false,
    usaDistancia: opts.usaDistancia !== false,
    pp: 30,
    ppMax: 30,
    cdBasico: 0,
    velMul: 1,
    stats: { velocidade: 50 },
    faccao: opts.faccao || "a",
    golpes: [
      { cd: 0, def: { forma: "contact", alcance: 1.15, poder: 18, pp: 1, recarga: 0.55, vel: 0 } },
      { cd: 0, def: { forma: "projectile", alcance: 8, poder: 40, pp: 1, recarga: 1.2, vel: 14, raio: RAIO_PROJETIL } },
    ],
    cmdX: 0,
    cmdY: 0,
    _iaT: 0,
    hab: "",
    miraX: NaN,
    miraY: NaN,
  };
}

function ocupado(ator) {
  return emRecuo(ator) || emAvanco(ator) || emEsquiva(ator);
}

function tiroVem(p, ator) {
  if (!p || p.dono === ator || p.faccao === ator.faccao) return false;
  const dx = ator.x - p.x;
  const dy = ator.y - p.y;
  const vel = Math.hypot(p.vx, p.vy);
  if (vel < 0.5) return false;
  if (dx * p.vx + dy * p.vy <= 0) return false;
  const lateral = Math.abs(dx * p.vy - dy * p.vx) / vel;
  if (lateral > (p.raio || RAIO_PROJETIL) + CORREDOR_TIRO) return false;
  return Math.hypot(dx, dy) / vel < JANELA_TIRO;
}

function ameacaHeuristica(ator, alvo, tiros) {
  if ((ator.esquiva || 0) < 1 || ocupado(ator)) return false;
  if (vaiMelee(alvo, ator)) return true;
  const n = tiros ? tiros.length : 0;
  for (let i = 0; i < n; i++) {
    if (tiroVem(tiros[i], ator)) return true;
  }
  return false;
}

function esquivarHeuristica(ator, alvo) {
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const lado = ator.esquivaLado || 1;
  ator.esquivaLado = -lado;
  const ok = comecarEsquiva(ator, (-dy / d) * lado, (dx / d) * lado);
  if (!ok) ator.esquivaLado = lado;
  return ok;
}

function moverHeuristica(ator, alvo, dt) {
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  ator.dirX = dx / d;
  ator.dirY = dy / d;
  if (ocupado(ator)) {
    ator.andando = false;
    return d;
  }
  const def = posturaDe(ator);
  if (!def) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return d;
  }
  const parada = paradaDe(def);
  const sentidoFaixa = sentidoParada(d, parada, def.forma);
  const bloqueado = cortaVisada(ator.x, ator.y, alvo.x, alvo.y);
  const sentido = bloqueado && sentidoFaixa === 0 ? 1 : sentidoFaixa;
  if (sentido === 0) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return d;
  }
  const vel = velocidadeDe(ator, true);
  let passo = vel * dt;
  if (sentidoFaixa > 0) passo = Math.min(passo, Math.max(0, d - parada));
  else if (sentidoFaixa < 0) passo = Math.min(passo, Math.max(0, parada - d));
  if (passo <= 0.0001) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return d;
  }
  const rumo = desviarRumo(ator.x, ator.y, (dx / d) * sentido, (dy / d) * sentido, RAIO_POKEMON);
  ator.x += rumo.x * passo;
  ator.y += rumo.y * passo;
  ator.vx = rumo.x * vel;
  ator.vy = rumo.y * vel;
  ator.andando = true;
  limitarArena(ator);
  return Math.hypot(alvo.x - ator.x, alvo.y - ator.y);
}

/** Um quadro. Devolve a distância depois do passo e antes da esquiva nova. */
export function quadro(ator, alvo, dt, tiros, modo, forcar) {
  let d;
  if (emEsquiva(ator)) {
    passoEsquiva(ator, dt);
    d = Math.hypot(alvo.x - ator.x, alvo.y - ator.y);
  } else if (modo === "heuristica") {
    d = moverHeuristica(ator, alvo, dt);
  } else {
    integrarComando(ator, alvo, dt);
    d = Math.hypot(alvo.x - ator.x, alvo.y - ator.y);
  }
  recarregarBarraEsquiva(ator, dt);
  empurrarCorpo(ator, RAIO_POKEMON);
  limitarArena(ator);
  if (modo === "heuristica") {
    if (ameacaHeuristica(ator, alvo, tiros)) esquivarHeuristica(ator, alvo);
  } else if (forcar === "esquivar") {
    reagirEsquiva(ator, alvo, tiros);
  } else {
    pensar(ator, alvo, dt, tiros, forcar || "");
  }
  return d;
}

export function avaliarAproximacao(modo, n = 24) {
  let soma = 0;
  let falhas = 0;
  const dt = 1 / 30;
  for (let i = 0; i < n; i++) {
    cenarioIndice(i);
    const ang = (i / n) * Math.PI * 2;
    const ator = lutador({
      x: Math.cos(ang) * 4,
      y: Math.sin(ang) * 4,
      usaDistancia: false,
      faccao: "a",
    });
    const alvo = lutador({
      x: Math.cos(ang + Math.PI) * 4,
      y: Math.sin(ang + Math.PI) * 4,
      usaDistancia: false,
      faccao: "b",
    });
    empurrarCorpo(ator, RAIO_POKEMON);
    empurrarCorpo(alvo, RAIO_POKEMON);
    const parada = paradaDe(posturaDe(ator));
    const meta = parada + FOLGA_PARADA;
    let t = 0;
    let ok = false;
    while (t < 4) {
      const d = quadro(ator, alvo, dt, VAZIO, modo);
      t += dt;
      if (d <= meta) {
        ok = true;
        break;
      }
    }
    if (!ok) falhas += 1;
    soma += t;
  }
  return { tempo: soma / n, falhas };
}

function soltarReta(origem, ator) {
  const dx = ator.x - origem.x;
  const dy = ator.y - origem.y;
  const len = Math.hypot(dx, dy) || 1;
  const vel = 14;
  return {
    x: origem.x,
    y: origem.y,
    vx: (dx / len) * vel,
    vy: (dy / len) * vel,
    raio: RAIO_PROJETIL,
    faccao: origem.faccao,
    dono: origem,
    viajou: 0,
    max: 12,
    viva: true,
  };
}

function acertou(p, ator) {
  const dx = ator.x - p.x;
  const dy = ator.y - p.y;
  const r = (p.raio || RAIO_PROJETIL) + FOLGA_PROJETIL;
  return dx * dx + dy * dy <= r * r;
}

function cenaEsquiva(modo, episodios, comGolpes) {
  definirCenario("normal", "normal");
  const dt = 1 / 30;
  const intervalo = 1.6;
  let tiros = 0;
  let salvos = 0;
  for (let e = 0; e < episodios; e++) {
    const ang = (e / episodios) * Math.PI * 2;
    const ator = lutador({
      x: 0,
      y: 0,
      faccao: "a",
      usaDistancia: comGolpes,
      usaCorpo: comGolpes,
    });
    const alvo = lutador({
      x: Math.cos(ang) * 6,
      y: Math.sin(ang) * 6,
      faccao: "b",
      usaCorpo: false,
    });
    const vivos = [];
    let proximo = 0.05;
    let gerados = 0;
    for (let t = 0; t < 8.2; t += dt) {
      if (emEsquiva(ator)) passoEsquiva(ator, dt);
      recarregarBarraEsquiva(ator, dt);
      if (modo === "heuristica") {
        if (ameacaHeuristica(ator, alvo, vivos)) esquivarHeuristica(ator, alvo);
      } else {
        reagirEsquiva(ator, alvo, vivos);
      }
      if (t >= proximo && gerados < 5) {
        vivos.push(soltarReta(alvo, ator));
        proximo += intervalo;
        gerados += 1;
      }
      for (let i = vivos.length - 1; i >= 0; i--) {
        const p = vivos[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.viajou += Math.hypot(p.vx, p.vy) * dt;
        if (acertou(p, ator)) {
          tiros += 1;
          vivos.splice(i, 1);
          continue;
        }
        if (p.viajou > p.max) {
          tiros += 1;
          salvos += 1;
          vivos.splice(i, 1);
        }
      }
      if (Math.hypot(ator.x, ator.y) > RAIO_ARENA) limitarArena(ator);
    }
  }
  return tiros > 0 ? salvos / tiros : 0;
}

/** O pior dos dois: sem golpe e com tiro pronto, como na arena. */
export function avaliarEsquiva(modo, episodios = 16) {
  const seco = cenaEsquiva(modo, episodios, false);
  const luta = cenaEsquiva(modo, episodios, true);
  return Math.min(seco, luta);
}

export function avaliarAcerto(modo, n = 24) {
  definirCenario("normal", "normal");
  let acertos = 0;
  const dt = 1 / 60;
  for (let i = 0; i < n; i++) {
    const lado = i % 2 === 0 ? 1 : -1;
    const ator = lutador({ x: -1.8, y: 0, faccao: "a", usaCorpo: false });
    const alvo = lutador({
      x: 1.8,
      y: -1.2 * lado,
      vx: 0,
      vy: 4.2 * lado,
      faccao: "b",
      usaCorpo: false,
    });
    if (modo === "rede") pensar(ator, alvo, 0.1, VAZIO);
    let dx;
    let dy;
    if (modo === "rede" && Number.isFinite(ator.miraX) && Number.isFinite(ator.miraY)) {
      dx = ator.miraX - ator.x;
      dy = ator.miraY - ator.y;
    } else {
      dx = alvo.x - ator.x;
      dy = alvo.y - ator.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    const vel = 14;
    let px = ator.x + (dx / len) * 0.4;
    let py = ator.y + (dy / len) * 0.4;
    const pvx = (dx / len) * vel;
    const pvy = (dy / len) * vel;
    let ok = false;
    for (let s = 0; s < 90; s++) {
      alvo.x += alvo.vx * dt;
      alvo.y += alvo.vy * dt;
      px += pvx * dt;
      py += pvy * dt;
      const hx = alvo.x - px;
      const hy = alvo.y - py;
      const r = RAIO_PROJETIL + FOLGA_PROJETIL;
      if (hx * hx + hy * hy <= r * r) {
        ok = true;
        break;
      }
      if (Math.hypot(px - ator.x, py - ator.y) > 12) break;
    }
    if (ok) acertos += 1;
  }
  return acertos / n;
}

export function avaliarFuga(n = 12) {
  const dt = 1 / 30;
  let soma = 0;
  let borda = 0;
  let passos = 0;
  for (let i = 0; i < n; i++) {
    cenarioIndice(i);
    const ator = lutador({ x: 0.2, y: 0, faccao: "a", usaCorpo: false, hp: 20 });
    const alvo = lutador({ x: 1.4, y: 0, faccao: "b", usaCorpo: true, usaDistancia: false });
    for (let t = 0; t < 2.2; t += dt) {
      quadro(ator, alvo, dt, VAZIO, "rede", "fugir");
      const d = Math.hypot(alvo.x - ator.x, alvo.y - ator.y);
      soma += d;
      passos += 1;
      if (Math.hypot(ator.x, ator.y) > RAIO_ARENA - 0.35) borda += 1;
      alvo.x += Math.sign(ator.x - alvo.x) * 2.2 * dt;
      alvo.y += Math.sign(ator.y - alvo.y) * 2.2 * dt;
    }
  }
  return { distancia: soma / Math.max(1, passos), borda: borda / Math.max(1, passos) };
}

export function bancada(segundos = 10) {
  definirCenario("planta", "pedra");
  const n = 30;
  const atores = [];
  const alvos = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    atores.push(lutador({ x: Math.cos(ang) * 3, y: Math.sin(ang) * 3, faccao: "a", usaDistancia: false }));
    alvos.push(lutador({ x: Math.cos(ang + Math.PI) * 3, y: Math.sin(ang + Math.PI) * 3, faccao: "b" }));
  }
  const dt = 1 / 60;
  const passos = Math.round(segundos / dt);
  const t0 = performance.now();
  for (let s = 0; s < passos; s++) {
    for (let i = 0; i < n; i++) quadro(atores[i], alvos[i], dt, VAZIO, "rede");
  }
  return (performance.now() - t0) / segundos;
}
