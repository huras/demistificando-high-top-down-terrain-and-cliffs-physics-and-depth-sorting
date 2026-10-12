import { POKEMON } from "../config.js";
import { teclaAgora, teclaBaixa } from "../entrada/teclado.js";
import { estaEmCena } from "../cena/modoCena.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { selvagensAtivos } from "./populacao.js";
import { gastarBola, obterBolas, partyCheia, receberCaptura } from "./party.js";

let bola = null;
let segurando = false;
let carga = 0;

export function obterBola() {
  return bola;
}

export function cargaAtual() {
  return segurando ? carga : 0;
}

function chanceDe(alvo) {
  const taxa = Math.max(0, Math.min(1, (alvo.especie?.captura ?? 45) / 255));
  const desmaiado = alvo.morto || alvo.hp <= 0;
  const hpTerm = desmaiado ? 0.68 : (3 * alvo.hpMax - 2 * Math.max(0, alvo.hp)) / (3 * alvo.hpMax);
  const nivel = Math.max(1, alvo.nivel | 0);
  const nivelMul = 1 / (1 + Math.max(0, nivel - 1) * 0);
  return Math.max(0, Math.min(1, hpTerm * taxa * nivelMul));
}

function tremoresDe(chance, sucesso) {
  if (sucesso) return 3;
  return Math.max(1, Math.min(2, Math.round(chance * 3) || 1));
}

function soltar(corpo) {
  if (obterBolas() <= 0 || partyCheia()) return;
  if (!gastarBola()) return;
  const dx = corpo.dirX || 0;
  const dy = corpo.dirY || 1;
  const len = Math.hypot(dx, dy) || 1;
  const dist = 5 + carga * 5;
  const vel = 9;
  bola = {
    fase: "voo",
    x: corpo.x,
    y: corpo.y,
    z: (corpo.elevacao ?? corpo.z ?? 0) + 1.15,
    vx: (dx / len) * vel,
    vy: (dy / len) * vel,
    vz: 5.2 + carga * 2.4,
    viajou: 0,
    max: dist,
    tremor: 0,
    tremores: 0,
    sucesso: false,
    alvo: null,
    faseT: 0,
  };
}

export function atualizarCaptura(corpo, dt, agora, efeitos) {
  const focado = document.activeElement?.tagName;
  const digita = focado === "INPUT" || focado === "SELECT" || focado === "TEXTAREA";
  const pode = !digita && !estaEmCena();

  if (pode && teclaBaixa("KeyB") && !bola) {
    if (!segurando) {
      const edge = teclaAgora("KeyB");
      if (obterBolas() <= 0) {
        if (edge) efeitos.flutuar(corpo, "sem bola", "#fca5a5");
      } else if (partyCheia()) {
        if (edge) efeitos.flutuar(corpo, "party cheia", "#fca5a5");
      } else segurando = true;
    }
    if (segurando) carga = Math.min(1, carga + dt / 0.95);
  } else if (segurando) {
    segurando = false;
    if (pode) soltar(corpo);
    carga = 0;
  }
  if (teclaAgora("KeyB") && !pode) {
    segurando = false;
    carga = 0;
  }

  if (!bola) return;
  bola.faseT += dt;

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
      if (s.capturado) continue;
      const dx = s.x - bola.x;
      const dy = s.y - bola.y;
      if (dx * dx + dy * dy > 0.55 * 0.55) continue;
      selar(s, agora);
      return;
    }
    if (bola.z <= chao || bola.viajou >= bola.max) {
      bola.z = chao;
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
      bola.fase = "volta";
      bola.faseT = 0;
    }
    return;
  }

  if (bola.fase === "tremendo") {
    const passo = Math.floor(bola.faseT / 0.55);
    if (passo > bola.tremor) bola.tremor = passo;
    if (bola.tremor >= bola.tremores) {
      if (bola.sucesso) {
        const mon = receberCaptura(bola.alvo);
        bola.alvo.capturado = true;
        efeitos.flutuar(bola.alvo, mon ? "pego!" : "party cheia", "#4ade80");
        if (!mon) bola.alvo.capturado = false;
        bola = null;
      } else {
        bola.alvo.capturado = false;
        bola.fase = "volta";
        bola.faseT = 0;
        efeitos.flutuar(bola.alvo, "escapou", "#fca5a5");
      }
    }
    return;
  }

  if (bola.fase === "volta") {
    const dx = corpo.x - bola.x;
    const dy = corpo.y - bola.y;
    const d = Math.hypot(dx, dy) || 1;
    bola.x += (dx / d) * 10 * dt;
    bola.y += (dy / d) * 10 * dt;
    bola.z += ((corpo.elevacao ?? corpo.z) + 1 - bola.z) * Math.min(1, dt * 6);
    if (d < 0.6 || bola.faseT > 1.4) bola = null;
  }
}

function selar(alvo, agora) {
  void agora;
  alvo.capturado = true;
  alvo.andando = false;
  const chance = chanceDe(alvo);
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
