import { estaEmCena } from "../cena/modoCena.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { BOLAS, TIPO_ITEM } from "../wild/catalogo.js";
import {
  ALTURA_BLOCO,
  BOLA_GRAVIDADE,
  BOLA_MAX,
  BOLA_PICKUP_RAIO,
  BOLA_RAIO_BLOCO,
  BOLA_ROLAR_TEMPO,
  POKEMON,
} from "../config.js";
import {
  avisar,
  gastar,
  guardarCapturaNaCaixa,
  hotbarAtivo,
  temChave,
  vagasNasCaixas,
} from "../jogo/estado.js";
import {
  estimarQuedaBola,
  parametrosArremessoBola,
} from "../jogo/rangedFisica.js";
import { selvagensAtivos } from "./populacao.js";
import { ajustarItem, partyCheia, pokemonDeployado, receberCaptura } from "./party.js";

/** @deprecated use BOLA_PICKUP / alcance via rangedFisica — mantido p/ HUD legado */
export const ALCANCE_BOLA = 14;
const LARGURA_MIRA = 0.86;

/** @type {object[]} */
const bolas = [];
let carga = 0;
let miraCursor = null;
let gestoMirando = false;
/** @type {object | null} */
let cameraMira = null;
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

/** Carga pra HUD: círculo no hipfire / arco na mira. */
export function cargaAtual() {
  if (gestoMirando || gestoCarregando || carga > 0) return carga;
  return 0;
}

/** True enquanto o gesto ranged está na mira com bola. */
export function bolaEmMira() {
  return gestoMirando;
}

/** O cursor no chão. A mira da bola lê isso o tempo todo. */
export function definirMiraCursor(x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) miraCursor = { x, y };
}

/** @returns {{ x: number, y: number } | null} */
export function obterMiraCursor() {
  return miraCursor;
}

/**
 * Sincroniza carga/mira vindas do gesto ranged (LMB carga, RMB mira).
 * @param {{ carga?: number, mirando?: boolean, miraX?: number, miraY?: number, camera3d?: object | null }} opts
 */
let gestoCarregando = false;

export function sincronizarGestoBola(opts = {}) {
  gestoMirando = !!opts.mirando;
  gestoCarregando = !!opts.carregando;
  carga = Math.min(1, Math.max(0, Number(opts.carga) || 0));
  cameraMira = opts.camera3d || null;
  if (Number.isFinite(opts.miraX) && Number.isFinite(opts.miraY)) {
    miraCursor = { x: opts.miraX, y: opts.miraY };
  }
}

/**
 * Direção e ponto de queda estimados (balística 3D) para o HUD.
 * @returns {{x0:number,y0:number,z:number,ux:number,uy:number,alcance:number,voo:number,largura:number,carga:number}|null}
 */
export function obterMiraBola(corpo) {
  if (!corpo) return null;
  const queda = estimarQuedaBola(
    corpo,
    cameraMira,
    gestoMirando || gestoCarregando || carga > 0 ? carga : 0,
    miraCursor,
  );
  if (queda) {
    return {
      x0: corpo.x,
      y0: corpo.y,
      z: queda.z,
      ux: queda.ux,
      uy: queda.uy,
      alcance: ALCANCE_BOLA,
      voo: queda.voo,
      largura: LARGURA_MIRA,
      carga: gestoMirando ? carga : 0,
    };
  }
  // Fallback sem câmera: anel no facing / cursor.
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
  const voo = Math.min(Math.max(dist, BOLA_PICKUP_RAIO * 1.1), ALCANCE_BOLA);
  return {
    x0: corpo.x,
    y0: corpo.y,
    z: corpo.elevacao ?? corpo.z ?? 0,
    ux,
    uy,
    alcance: ALCANCE_BOLA,
    voo,
    largura: LARGURA_MIRA,
    carga: gestoMirando ? carga : 0,
  };
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
  while (bolas.length > BOLA_MAX) {
    const velha = bolas.shift();
    if (velha) velha.morta = true;
  }
}

/**
 * Arremessa a bola da hotbar em balística 3D (mesma direção da flecha).
 * @param {object} corpo
 * @param {{
 *   carga?: number,
 *   camera3d?: object | null,
 *   mira?: { x: number, y: number },
 *   usarFacing?: boolean,
 * }} [opts]
 * @returns {boolean}
 */
export function arremessarBola(corpo, opts = {}) {
  if (!corpo || estaEmCena()) return false;
  const item = hotbarAtivo();
  if (!item || item.tipo !== TIPO_ITEM.BOLA) return false;
  const def = BOLAS[item.key];
  if (!def || semLugarParaCaptura()) return false;
  if (!gastar(item.tipo, item.key, 1)) return false;
  avisar();

  const camera3d = opts.camera3d || cameraMira;
  const cargaTiro = Math.min(1, Math.max(0, Number(opts.carga) || 0));
  const mira = opts.mira || miraCursor;
  // Top-down: vel resolvida até o cursor. Ombro: vel por carga.
  const { origem, dir, vel } = parametrosArremessoBola(corpo, camera3d, cargaTiro, mira);

  // Espaço captura: (x,y) horizontal = Three (x,z); altura z = Three y / ALTURA_BLOCO.
  const gBlocos = BOLA_GRAVIDADE / ALTURA_BLOCO;
  bolas.push({
    fase: "voo",
    ballKey: item.key,
    cor: def.cor || "#ee3344",
    capturaMul: def.capturaMul ?? 1,
    returnsOnFail: !!def.returnsOnFail,
    reembolsada: false,
    morta: false,
    x: origem.x,
    y: origem.z,
    z: origem.y / ALTURA_BLOCO,
    vx: dir.x * vel + (corpo.vx || 0) * 0.35,
    vy: dir.z * vel + (corpo.vy || 0) * 0.35,
    vz: (dir.y * vel) / ALTURA_BLOCO,
    grav: gBlocos,
    tremor: 0,
    tremores: 0,
    sucesso: false,
    alvo: null,
    faseT: 0,
    giro: 0,
  });
  return true;
}

function estaPerto(quem, bola) {
  if (!quem || quem.morto) return false;
  return Math.hypot(bola.x - quem.x, bola.y - quem.y) <= BOLA_PICKUP_RAIO;
}

function tentarPickup(corpo) {
  const mon = pokemonDeployado();
  for (let i = 0; i < bolas.length; i++) {
    const b = bolas[i];
    if (b.morta || b.fase !== "grounded") continue;
    if (!estaPerto(corpo, b) && !estaPerto(mon, b)) continue;
    reembolsar(b);
    b.morta = true;
    estourar(b.x, b.y, b.z, "#cbd5e1", 5, false);
  }
}

/** Bola grounded mais perto do mon no raio do treinador (coleta OW / Pokemon AI). */
export function bolaNoChaoMaisPerto(mon, jogador, raio = POKEMON.RAIO_AGRO) {
  if (!mon) return null;
  const lim = (raio > 0 ? raio : POKEMON.RAIO_AGRO) ** 2;
  let melhor = null;
  let melhorD = Infinity;
  for (let i = 0; i < bolas.length; i++) {
    const b = bolas[i];
    if (!b || b.morta || b.fase !== "grounded") continue;
    if (jogador) {
      const dxj = b.x - jogador.x;
      const dyj = b.y - jogador.y;
      if (dxj * dxj + dyj * dyj > lim) continue;
    }
    const dx = b.x - mon.x;
    const dy = b.y - mon.y;
    const d = dx * dx + dy * dy;
    if (d < melhorD) {
      melhor = b;
      melhorD = d;
    }
  }
  return melhor;
}

function aterrissarMiss(bola) {
  bola.vx = 0;
  bola.vy = 0;
  bola.vz = 0;
  if (podeRetornar(bola, true)) {
    iniciarRetorno(bola);
    return;
  }
  bola.fase = "grounded";
  bola.faseT = 0;
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
  if (bola.fase === "voo" || bola.fase === "rolando") {
    bola.giro = (bola.giro || 0) + dt * 14;
  }

  if (bola.fase === "voo") {
    bola.x += bola.vx * dt;
    bola.y += bola.vy * dt;
    bola.z += bola.vz * dt;
    bola.vz -= (bola.grav || BOLA_GRAVIDADE / ALTURA_BLOCO) * dt;

    const lista = selvagensAtivos();
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i];
      if (s.capturado || s.preso) continue;
      const dx = s.x - bola.x;
      const dy = s.y - bola.y;
      const dz = (s.z + 0.55) - bola.z;
      if (dx * dx + dy * dy + dz * dz * 0.35 > 0.6 * 0.6) continue;
      selar(bola, s);
      estourar(bola.x, bola.y, bola.z, "#f8fafc", 10, true);
      return;
    }

    const chao = alturaSobPes(bola.x, bola.y, bola.z + 1);
    const pouso = chao + BOLA_RAIO_BLOCO;
    if (bola.z <= pouso) {
      bola.z = pouso;
      bola.vz = 0;
      bola.fase = "rolando";
      bola.faseT = 0;
    } else if (bola.z < -4) {
      bola.morta = true;
    }
    return;
  }

  if (bola.fase === "rolando") {
    const atrito = Math.max(0, 1 - bola.faseT / BOLA_ROLAR_TEMPO);
    bola.x += bola.vx * dt * 0.28 * atrito;
    bola.y += bola.vy * dt * 0.28 * atrito;
    const chao = alturaSobPes(bola.x, bola.y, bola.z + 1);
    bola.z = chao + BOLA_RAIO_BLOCO;
    if (bola.faseT > BOLA_ROLAR_TEMPO) {
      bola.vx = 0;
      bola.vy = 0;
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
    const chao = alturaSobPes(bola.x, bola.y, bola.z + 1);
    bola.z = chao + BOLA_RAIO_BLOCO;
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
  tickParticulas(dt);
  tentarPickup(corpo);
  for (let i = 0; i < bolas.length; i++) {
    if (!bolas[i].morta) tickBola(bolas[i], corpo, dt, efeitos);
  }
  limparMortas();
}
