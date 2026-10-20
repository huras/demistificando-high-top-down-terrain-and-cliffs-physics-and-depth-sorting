import { estaEmCena } from "../cena/modoCena.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { BOLAS, TIPO_ITEM } from "../wild/catalogo.js";
import {
  avisar,
  contar,
  gastar,
  guardarCapturaNaCaixa,
  hotbarAtivo,
  temChave,
  vagasNasCaixas,
} from "../jogo/estado.js";
import { selvagensAtivos } from "./populacao.js";
import { ajustarItem, partyCheia, receberCaptura } from "./party.js";

export const ALCANCE_BOLA = 10;
const LARGURA_MIRA = 0.86;
const RAIO_PICKUP = 2;
const MAX_BOLAS = 12;

/** @type {object[]} */
const bolas = [];
let segurando = false;
let pedidoSegurar = false;
let soltarPendente = false;
let carga = 0;
let miraCursor = null;
const particulas = [];

export function particulasCaptura() {
  return particulas;
}

/** Primeira bola ativa (compat). */
export function obterBola() {
  for (let i = 0; i < bolas.length; i++) {
    if (!bolas[i].morta) return bolas[i];
  }
  return null;
}

export function bolasAtivas() {
  return bolas;
}

export function cargaAtual() {
  return segurando ? carga : 0;
}

/** O cursor no chão. A mira da bola lê isso o tempo todo. */
export function definirMiraCursor(x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) miraCursor = { x, y };
}

/**
 * Direção e ponto de queda da bola, presos ao anel de alcance.
 * @returns {{x0:number,y0:number,z:number,ux:number,uy:number,alcance:number,voo:number,largura:number,carga:number}|null}
 */
export function obterMiraBola(corpo) {
  if (!corpo) return null;
  let dx = corpo.dirX || 0;
  let dy = corpo.dirY || 1;
  if (miraCursor) {
    dx = miraCursor.x - corpo.x;
    dy = miraCursor.y - corpo.y;
  }
  let dist = Math.hypot(dx, dy);
  if (dist < 0.2) {
    dx = corpo.dirX || 0;
    dy = corpo.dirY || 1;
    dist = Math.hypot(dx, dy) || 1;
  }
  const ux = dx / dist;
  const uy = dy / dist;
  const voo = Math.min(Math.max(dist, 1.15), ALCANCE_BOLA);
  return {
    x0: corpo.x,
    y0: corpo.y,
    z: corpo.elevacao ?? corpo.z ?? 0,
    ux,
    uy,
    alcance: ALCANCE_BOLA,
    voo,
    largura: LARGURA_MIRA,
    carga: segurando ? carga : 0,
  };
}

/** Segurar o clique esquerdo com uma bola na hotbar carrega o arremesso. */
export function definirSegurarBola(ativo, x, y) {
  if (ativo) {
    pedidoSegurar = true;
    soltarPendente = false;
    definirMiraCursor(x, y);
    return;
  }
  if (pedidoSegurar || segurando) soltarPendente = true;
  pedidoSegurar = false;
}

function chanceDe(alvo, mul) {
  if (mul >= 255) return 1;
  const taxa = Math.max(0, Math.min(1, (alvo.especie?.captura ?? 45) / 255));
  const desmaiado = alvo.morto || alvo.hp <= 0;
  const hpTerm = desmaiado ? 0.68 : (3 * alvo.hpMax - 2 * Math.max(0, alvo.hp)) / (3 * alvo.hpMax);
  const nivelMul = 1 / (1 + Math.max(0, (alvo.nivel | 0) - 1) * 0);
  return Math.max(0, Math.min(1, hpTerm * taxa * nivelMul * (mul || 1)));
}

function tremoresDe(chance, sucesso) {
  if (sucesso) return 3;
  return Math.max(1, Math.min(2, Math.round(chance * 3) || 1));
}

function semLugarParaCaptura() {
  return partyCheia() && vagasNasCaixas() <= 0;
}

function temIma() {
  return temChave("ballMagnet");
}

function podeRetornar(bola, forcarMiss) {
  if (bola.returnsOnFail) return true;
  return !!(forcarMiss && temIma());
}

function iniciarRetorno(bola) {
  bola.fase = "volta";
  bola.faseT = 0;
}

function reembolsar(bola) {
  if (!bola || bola.reembolsada || !bola.ballKey) return;
  bola.reembolsada = true;
  ajustarItem(bola.ballKey, 1, "mudo");
  avisar();
}

function estourar(x, y, z, cor, n, sobe) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.8 + Math.random() * 2.6;
    particulas.push({
      x,
      y,
      z,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      vz: (sobe ? 1.4 : 0.2) + Math.random() * 2.2,
      vida: 0.45 + Math.random() * 0.45,
      idade: 0,
      cor,
    });
  }
}

function tickParticulas(dt) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.idade += dt;
    if (p.idade >= p.vida) {
      particulas.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vz -= 6 * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
}

function limparMortas() {
  for (let i = bolas.length - 1; i >= 0; i--) {
    if (bolas[i].morta) bolas.splice(i, 1);
  }
  while (bolas.length > MAX_BOLAS) {
    const velha = bolas.shift();
    if (velha) velha.morta = true;
  }
}

function soltar(corpo) {
  const item = hotbarAtivo();
  if (!item || item.tipo !== TIPO_ITEM.BOLA) return;
  const def = BOLAS[item.key];
  if (!def || semLugarParaCaptura()) return;
  if (!gastar(item.tipo, item.key, 1)) return;
  avisar();

  const geo = obterMiraBola(corpo);
  const ux = geo?.ux ?? (corpo.dirX || 0);
  const uy = geo?.uy ?? (corpo.dirY || 1);
  const dist = geo?.voo ?? ALCANCE_BOLA;
  const tempo = 0.42 + dist * 0.045;
  const vel = dist / tempo;
  const vz = -1.15 / tempo + 10 * tempo + carga * 1.4;
  bolas.push({
    fase: "voo",
    ballKey: item.key,
    cor: def.cor || "#ee3344",
    capturaMul: def.capturaMul ?? 1,
    returnsOnFail: !!def.returnsOnFail,
    reembolsada: false,
    morta: false,
    x: corpo.x,
    y: corpo.y,
    z: (corpo.elevacao ?? corpo.z ?? 0) + 1.15,
    vx: ux * vel,
    vy: uy * vel,
    vz,
    viajou: 0,
    max: dist,
    tremor: 0,
    tremores: 0,
    sucesso: false,
    alvo: null,
    faseT: 0,
    giro: 0,
  });
}

function tentarPickup(corpo) {
  if (!corpo) return;
  for (let i = 0; i < bolas.length; i++) {
    const b = bolas[i];
    if (b.morta || b.fase !== "grounded") continue;
    const d = Math.hypot(b.x - corpo.x, b.y - corpo.y);
    if (d > RAIO_PICKUP) continue;
    reembolsar(b);
    b.morta = true;
    estourar(b.x, b.y, b.z, "#cbd5e1", 5, false);
  }
}

function aterrissarMiss(bola) {
  if (podeRetornar(bola, true)) {
    iniciarRetorno(bola);
    return;
  }
  bola.fase = "grounded";
  bola.faseT = 0;
  bola.vx = 0;
  bola.vy = 0;
  bola.vz = 0;
}

function selar(bola, alvo) {
  alvo.preso = true;
  alvo.andando = false;
  alvo._sumindo = 1;
  const chance = chanceDe(alvo, bola.capturaMul);
  const sucesso = Math.random() < chance;
  bola.alvo = alvo;
  bola.sucesso = sucesso;
  bola.tremores = tremoresDe(chance, sucesso);
  bola.tremor = 0;
  bola.fase = "tremendo";
  bola.faseT = 0;
  bola.x = alvo.x;
  bola.y = alvo.y;
  bola.z = alvo.z + 0.9;
}

function tickBola(bola, corpo, dt, efeitos) {
  bola.faseT += dt;
  bola.giro = (bola.giro || 0) + dt * 14;

  if (bola.fase === "voo") {
    bola.x += bola.vx * dt;
    bola.y += bola.vy * dt;
    bola.z += bola.vz * dt;
    bola.vz -= 20 * dt;
    bola.viajou += Math.hypot(bola.vx, bola.vy) * dt;
    const chao = alturaSobPes(bola.x, bola.y, bola.z + 1);
    const lista = selvagensAtivos();
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i];
      if (s.capturado || s.preso) continue;
      const dx = s.x - bola.x;
      const dy = s.y - bola.y;
      if (dx * dx + dy * dy > 0.55 * 0.55) continue;
      selar(bola, s);
      estourar(bola.x, bola.y, bola.z, "#f8fafc", 10, true);
      return;
    }
    if (bola.z <= chao) {
      bola.z = chao;
      if (bola.vz < 0) bola.vz = 0;
    }
    if (bola.viajou >= bola.max) {
      bola.z = Math.max(bola.z, chao);
      bola.vz = 0;
      bola.fase = "rolando";
      bola.faseT = 0;
    }
    return;
  }

  if (bola.fase === "rolando") {
    bola.x += bola.vx * dt * 0.25;
    bola.y += bola.vy * dt * 0.25;
    if (bola.faseT > 0.45) {
      estourar(bola.x, bola.y, bola.z, "#cbd5e1", 6, false);
      aterrissarMiss(bola);
    }
    return;
  }

  if (bola.fase === "tremendo") {
    const passo = Math.floor(bola.faseT / 0.55);
    if (passo > bola.tremor) {
      bola.tremor = passo;
      estourar(bola.x, bola.y, bola.z, "#fde68a", 8, true);
    }
    const some = bola.faseT < 0.4 ? 1 - bola.faseT / 0.4 : 0;
    if (bola.alvo) bola.alvo._sumindo = some;
    if (bola.tremor >= bola.tremores && bola.faseT >= bola.tremores * 0.55) {
      if (bola.sucesso) {
        let ok = !partyCheia() && !!receberCaptura(bola.alvo);
        let texto = "pego!";
        if (!ok) {
          ok = guardarCapturaNaCaixa(bola.alvo);
          texto = ok ? "enviado ao PC" : "PC cheio";
        }
        bola.alvo.capturado = true;
        bola.alvo.preso = false;
        bola.alvo._sumindo = 0;
        estourar(bola.x, bola.y, bola.z, "#facc15", 18, true);
        estourar(bola.x, bola.y, bola.z, "#4ade80", 10, true);
        efeitos.flutuar(bola.alvo, texto, ok ? "#4ade80" : "#fca5a5");
        if (!ok) {
          bola.alvo.capturado = false;
          bola.alvo.preso = false;
          bola.alvo._sumindo = 1;
        }
        bola.fase = "brilho";
        bola.faseT = 0;
      } else {
        bola.alvo.capturado = false;
        bola.alvo.preso = false;
        bola.alvo._sumindo = 1;
        estourar(bola.x, bola.y, bola.z, "#f87171", 14, true);
        efeitos.flutuar(bola.alvo, "escapou", "#fca5a5");
        if (bola.returnsOnFail) iniciarRetorno(bola);
        else bola.morta = true;
      }
    }
    return;
  }

  if (bola.fase === "brilho") {
    if (bola.faseT > 0.45) bola.morta = true;
    return;
  }

  if (bola.fase === "grounded") {
    if (bola.faseT > 45) bola.morta = true;
    return;
  }

  if (bola.fase === "volta") {
    const dx = corpo.x - bola.x;
    const dy = corpo.y - bola.y;
    const d = Math.hypot(dx, dy) || 1;
    bola.x += (dx / d) * 10 * dt;
    bola.y += (dy / d) * 10 * dt;
    bola.z += ((corpo.elevacao ?? corpo.z) + 1 - bola.z) * Math.min(1, dt * 6);
    if (d < 0.6 || bola.faseT > 1.4) {
      reembolsar(bola);
      bola.morta = true;
    }
  }
}

export function atualizarCaptura(corpo, dt, agora, efeitos) {
  void agora;
  const focado = document.activeElement?.tagName;
  const digita = focado === "INPUT" || focado === "SELECT" || focado === "TEXTAREA";
  const pode = !digita && !estaEmCena();

  // Não bloqueia por bola em voo — só carga / estoque / PC.
  if (pode && (pedidoSegurar || soltarPendente)) {
    if (!segurando) {
      const item = hotbarAtivo();
      if (!item || item.tipo !== TIPO_ITEM.BOLA || contar(item.tipo, item.key) <= 0) {
        efeitos.flutuar(corpo, "sem bola", "#fca5a5");
        pedidoSegurar = false;
        soltarPendente = false;
      } else if (semLugarParaCaptura()) {
        efeitos.flutuar(corpo, "PC cheio", "#fca5a5");
        pedidoSegurar = false;
        soltarPendente = false;
      } else segurando = true;
    }
    if (segurando && pedidoSegurar) carga = Math.min(1, carga + dt / 0.95);
  }
  if (segurando && !pedidoSegurar) {
    segurando = false;
    soltarPendente = false;
    if (pode) soltar(corpo);
    carga = 0;
  }

  tickParticulas(dt);
  tentarPickup(corpo);
  for (let i = 0; i < bolas.length; i++) {
    if (!bolas[i].morta) tickBola(bolas[i], corpo, dt, efeitos);
  }
  limparMortas();
}
