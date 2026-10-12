import { atoresPerto } from "../grade.js";
import { golpeBasico, recargaDe } from "../ator.js";
import { definirEmocao, EMOCAO } from "../emocoes.js";
import { calcularDano } from "../tipos.js";
import { soltarProjetil } from "./projeteis.js";

const CURA = /recover|synthesis|roost|softboiled|milkdrink|slackoff|heal|moonlight|rest/i;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function inimigo(a, b) {
  if (!a || !b || a === b) return false;
  if (a.faccao === b.faccao) return false;
  return true;
}

function aplicarDano(atacante, alvo, poder, tipo, categoria, agora, efeitos) {
  if (!alvo || alvo.morto || alvo.capturado || alvo.iframe > 0) return;
  if (!inimigo(atacante, alvo)) return;
  const { dano, efet } = calcularDano(atacante, alvo, poder, tipo, categoria);
  if (efet === 0 || dano <= 0) {
    efeitos.flutuar(alvo, "imune", "#94a3b8");
    alvo.iframe = 0.2;
    return;
  }
  alvo.hp -= dano;
  alvo.iframe = 0.15;
  alvo.pose = "Hurt";
  alvo.poseAte = agora + 0.32;
  efeitos.flutuar(alvo, String(dano), efet > 1 ? "#fbbf24" : "#f8fafc");
  if (alvo.faccao === "selvagem") {
    alvo.pendenteAtacante = atacante;
    if (atacante.faccao === "party") alvo.participantes.add(atacante.id);
  }
  if (alvo.hp > 0) return;
  alvo.hp = 0;
  alvo.morto = true;
  atorMorreu(alvo, agora);
  efeitos.aoDerrotar(alvo, atacante);
}

function atorMorreu(alvo, agora) {
  alvo.morreuEm = agora;
  alvo.mortoAte = agora + 60;
  alvo.andando = false;
  alvo.alvo = null;
  alvo.pose = "Idle";
  definirEmocao(alvo, EMOCAO.SUOR, { presa: true });
}

function gastar(ator, slot, agora) {
  if (slot.basico) {
    ator.cdBasico = recargaDe(ator, slot.def.recarga);
    return;
  }
  ator.pp = Math.max(0, ator.pp - (slot.def.pp || 1));
  slot.cd = recargaDe(ator, slot.def.recarga || 4);
  slot.usadoEm = agora;
}

function escolher(ator, alvo, d) {
  const prontos = [];
  for (let i = 0; i < ator.golpes.length; i++) {
    const g = ator.golpes[i];
    if (g.cd > 0) continue;
    if ((g.def.pp || 1) > ator.pp) continue;
    prontos.push(g);
  }
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    if (g.def.forma === "contact" && d <= Math.max(1.05, g.def.alcance)) return g;
  }
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    if ((g.def.forma === "projectile" || g.def.forma === "arc") && d <= g.def.alcance) return g;
  }
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    if (g.def.forma === "radius" && g.def.poder > 0 && d <= Math.max(2.2, g.def.alcance)) return g;
  }
  if (d > 2.4) {
    for (let i = 0; i < prontos.length; i++) {
      if (prontos[i].def.poder <= 0) return prontos[i];
    }
  }
  if (d <= 1.2 && ator.cdBasico <= 0) return { basico: true, def: golpeBasico(), cd: ator.cdBasico };
  return null;
}

function executar(ator, slot, alvo, agora, efeitos) {
  const def = slot.def;
  const dx = (alvo?.x ?? ator.x) - ator.x;
  const dy = (alvo?.y ?? ator.y) - ator.y;
  const len = Math.hypot(dx, dy) || 1;
  ator.dirX = dx / len;
  ator.dirY = dy / len;
  gastar(ator, slot, agora);

  if (def.poder <= 0) {
    if (CURA.test(def.key)) {
      ator.hp = Math.min(ator.hpMax, ator.hp + Math.ceil(ator.hpMax * 0.22));
      efeitos.flutuar(ator, "cura", "#4ade80");
    } else {
      ator.velMul = 1.25;
      ator.velMulAte = agora + 4;
      efeitos.flutuar(ator, def.nome, "#93c5fd");
    }
    ator.pose = "Attack";
    ator.poseAte = agora + 0.4;
    return;
  }

  if (def.forma === "projectile" || def.forma === "arc") {
    ator.pose = "Shoot";
    ator.poseAte = agora + 0.45;
    soltarProjetil({
      x: ator.x + ator.dirX * 0.4,
      y: ator.y + ator.dirY * 0.4,
      z: ator.z,
      vx: ator.dirX * (def.vel || 14),
      vy: ator.dirY * (def.vel || 14),
      dono: ator,
      faccao: ator.faccao,
      poder: def.poder,
      tipo: def.tipo,
      categoria: def.categoria,
      raio: def.raio,
      max: def.alcance || 12,
      arco: def.forma === "arc",
    });
    return;
  }

  if (def.forma === "radius") {
    ator.pose = "Attack";
    ator.poseAte = agora + 0.4;
    const raio = Math.max(2.2, def.alcance || 2.2);
    const perto = atoresPerto(ator.x, ator.y, raio);
    for (let i = 0; i < perto.length; i++) {
      aplicarDano(ator, perto[i], def.poder, def.tipo, def.categoria, agora, efeitos);
    }
    return;
  }

  ator.pose = "Attack";
  ator.poseAte = agora + 0.35;
  ator.hopLift = Math.max(ator.hopLift, 0.42);
  if (alvo) aplicarDano(ator, alvo, def.poder, def.tipo, def.categoria, agora, efeitos);
}

export function tentarGolpe(ator, agora, efeitos) {
  if (ator.morto || ator.capturado || ator.dormindo > 0) return;
  const alvo = ator.alvo;
  if (!alvo || alvo.morto || alvo.capturado) return;
  if (alvo.hp <= 0 && alvo.faccao === "treinador") return;
  const d = dist(ator, alvo);
  const slot = escolher(ator, alvo, d);
  if (!slot) return;
  executar(ator, slot, alvo, agora, efeitos);
}

export function impactoProjetil(projetil, alvo, agora, efeitos) {
  aplicarDano(
    projetil.dono,
    alvo,
    projetil.poder,
    projetil.tipo,
    projetil.categoria,
    agora,
    efeitos,
  );
}

export { atorMorreu };
