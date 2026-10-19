import { atoresPerto } from "../grade.js";
import { alturaPe, comecarAvanco, cruzaAltura, emAvanco, emEsquiva, emRecuo, emRolamentoAtivo } from "../ator.js";
import { acertoCorpo, alcanceCorpo } from "../ia/espaco.js";
import { definirEmocao, EMOCAO } from "../emocoes.js";
import { calcularDano, COR_TIPO } from "../tipos.js";
import { abrirKi, fecharKi, pulsarKi } from "./ki.js";
import { puloNoGolpe } from "./pulo.js";
import { soltarProjetil } from "./projeteis.js";
import { angulosLeque, desvioJato, receitaRajada } from "./rajadas.js";
import { folhaGolpe } from "./folhasGolpe.js";
import { agendarDesmaio, marcarPose, tempoClipGolpe } from "../sprites.js";
import { bloqueioNoTrecho, cortaVisada } from "../../combate/arenas.js";
import { RAIO_PROJETIL } from "../ia/constantes.js";
import { tocarGrito } from "../../jogo/som/gritos.js";

const CURA = /recover|synthesis|roost|softboiled|milkdrink|slackoff|heal|moonlight|rest/i;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function usaCorpo(ator) {
  return ator.usaCorpo !== false;
}

function usaDistancia(ator) {
  return ator.usaDistancia !== false;
}

/** Trava no lugar e depois desliza. 0,1 s e 0,7 m no toque; 1 s e 4,2 m quando o dano cobre a vida inteira. */
function iniciarRecuo(alvo, atacante, dano, agora) {
  const hp = Math.max(1, alvo.hpMax || 1);
  const fracao = Math.min(1, Math.max(0, dano) / hp);
  const tempo = 0.1 + fracao * 0.9;
  const trava = 0.08 + fracao * 0.1;
  let dx = alvo.x - (atacante?.x ?? alvo.x);
  let dy = alvo.y - (atacante?.y ?? alvo.y);
  let len = Math.hypot(dx, dy);
  if (len < 0.05) {
    dx = -(atacante?.dirX || 0);
    dy = -(atacante?.dirY || 1);
    len = Math.hypot(dx, dy) || 1;
  }
  alvo.recuoDur = tempo;
  alvo.recuoRestante = tempo;
  alvo.recuoTrava = trava;
  alvo.recuoDist = 0.7 + fracao * 3.5;
  alvo.recuoDirX = dx / len;
  alvo.recuoDirY = dy / len;
  alvo.vx = 0;
  alvo.vy = 0;
  alvo.andando = false;
  alvo.avancoRestante = 0;
  alvo.poseAte = agora + trava + tempo;
  cancelarGolpe(alvo);
  if (alvo.visual) {
    alvo.visual.anim = "Hurt";
    alvo.visual.frame = 0;
    alvo.visual.t = 0;
  }
  return { tempo, dist: alvo.recuoDist };
}

function notar(efeitos, item) {
  if (efeitos && efeitos.anotar) efeitos.anotar(item);
}

function inimigo(a, b) {
  if (!a || !b || a === b) return false;
  if (a.faccao === b.faccao) return false;
  return true;
}

function resultadoTravado(atacante, alvo) {
  const r = atacante?.resultadoTurno;
  if (!r || (r.alvo && r.alvo !== alvo)) return null;
  return r;
}

function aplicarTravado(atacante, alvo, agora, efeitos, travado) {
  if (!alvo || alvo.morto || alvo.capturado || alvo.hp <= 0) return;
  if (!inimigo(atacante, alvo)) return;
  travado.gasto = true;
  if (travado.imune) {
    efeitos.flutuar(alvo, "imune", "#94a3b8");
    alvo.iframe = 0.2;
    notar(efeitos, { tipo: "imune", alvo });
    return;
  }
  if (!travado.acertou) {
    efeitos.flutuar(alvo, "errou", "#cbd5e1");
    notar(efeitos, { tipo: "erro", ator: atacante, alvo });
    return;
  }
  const dano = travado.dano | 0;
  const efet = travado.efet || 1;
  alvo.hp -= dano;
  alvo.iframe = 0.15;
  alvo.iframeRajada = 0;
  if (alvo.hp > 0) subirFuria(alvo, efeitos);
  marcarPose(alvo, "Hurt", agora);
  const recuo = iniciarRecuo(alvo, atacante, dano, agora);
  efeitos.flutuar(alvo, String(dano), efet > 1 ? "#fbbf24" : "#f8fafc");
  if (efeitos.aoImpacto) efeitos.aoImpacto(alvo, "", efet);
  notar(efeitos, {
    tipo: "dano",
    alvo,
    dano,
    efet,
    recuo: recuo.tempo,
    dist: recuo.dist,
  });
  if (alvo.faccao === "selvagem") {
    alvo.pendenteAtacante = atacante;
    if (atacante.faccao === "party") alvo.participantes.add(atacante.id);
  }
  if (alvo.hp > 0) return;
  derrubar(alvo, atacante, agora, efeitos);
}

function errouGolpe(acerto) {
  if (acerto == null) return false;
  const p = Number(acerto);
  if (!Number.isFinite(p) || p >= 100) return false;
  if (p <= 0) return true;
  return Math.floor(Math.random() * 100) + 1 > p;
}

function aplicarDano(atacante, alvo, poder, tipo, categoria, agora, efeitos, acerto, forma, rajada) {
  const travado = resultadoTravado(atacante, alvo);
  if (travado) {
    if (!travado.gasto) aplicarTravado(atacante, alvo, agora, efeitos, travado);
    return;
  }
  const mesmaRajada = rajada && alvo?.iframeRajada === rajada;
  if (!alvo || alvo.morto || alvo.capturado || alvo.hp <= 0 || (alvo.iframe > 0 && !mesmaRajada) || alvo.invulneravel) return;
  if (!inimigo(atacante, alvo)) return;
  if (forma !== "projectile" && forma !== "arc" && !cruzaAltura(atacante, alvo, forma === "radius" ? 0.55 : 0.35)) return;
  if (emRolamentoAtivo(alvo) && forma !== "contact") {
    efeitos.flutuar(alvo, "rolou", "#67e8f9");
    notar(efeitos, { tipo: "dodge", ator: atacante, alvo });
    return;
  }
  if ((forma === "contact" || forma === "radius") && cortaVisada(atacante.x, atacante.y, alvo.x, alvo.y)) {
    efeitos.flutuar(alvo, "cobriu", "#cbd5e1");
    return;
  }
  if (errouGolpe(acerto)) {
    efeitos.flutuar(alvo, "errou", "#cbd5e1");
    notar(efeitos, { tipo: "erro", ator: atacante, alvo });
    return;
  }
  const { dano, efet } = calcularDano(atacante, alvo, poder, tipo, categoria);
  if (efet === 0 || dano <= 0) {
    efeitos.flutuar(alvo, "imune", "#94a3b8");
    alvo.iframe = 0.2;
    notar(efeitos, { tipo: "imune", alvo });
    return;
  }
  alvo.hp -= dano;
  if (rajada) {
    alvo.iframe = 0.02;
    alvo.iframeRajada = rajada;
  } else {
    alvo.iframe = 0.15;
    alvo.iframeRajada = 0;
  }
  if (alvo.hp > 0) subirFuria(alvo, efeitos);
  marcarPose(alvo, "Hurt", agora);
  const recuo = iniciarRecuo(alvo, atacante, dano, agora);
  efeitos.flutuar(alvo, String(dano), efet > 1 ? "#fbbf24" : "#f8fafc");
  if (efeitos.aoImpacto) efeitos.aoImpacto(alvo, tipo, efet);
  notar(efeitos, {
    tipo: "dano",
    alvo,
    dano,
    efet,
    recuo: recuo.tempo,
    dist: recuo.dist,
  });
  if (alvo.faccao === "selvagem") {
    alvo.pendenteAtacante = atacante;
    if (atacante.faccao === "party") alvo.participantes.add(atacante.id);
  }
  if (alvo.hp > 0) return;
  derrubar(alvo, atacante, agora, efeitos);
}

function marcarFuria(ator, def) {
  ator.furia = def?.key === "rage";
}

/** Rage: cada golpe que acerta enche um tubo de ataque, até +6. */
function subirFuria(alvo, efeitos) {
  if (!alvo?.furia) return;
  const atual = alvo.estagioAtk || 0;
  if (atual >= 6) return;
  alvo.estagioAtk = atual + 1;
  efeitos.flutuar(alvo, `Ataque +${alvo.estagioAtk}`, "#f87171");
  notar(efeitos, { tipo: "ataque", alvo, estagio: alvo.estagioAtk });
}

/** HP a zero: Hurt na folha, depois morto / Sleep / faint. */
function derrubar(alvo, atacante, agora, efeitos) {
  alvo.hp = 0;
  if (!agendarDesmaio(alvo, agora)) {
    alvo.morto = true;
    atorMorreu(alvo, agora);
  }
  efeitos.aoDerrotar(alvo, atacante);
  notar(efeitos, { tipo: "queda", alvo });
}

function atorMorreu(alvo, agora) {
  alvo.morreuEm = agora;
  alvo.mortoAte = agora + 60;
  alvo.desmaioEm = 0;
  alvo.andando = false;
  alvo.furia = false;
  alvo.alvo = null;
  alvo.pose = "Idle";
  alvo.poseSeguinte = "";
  definirEmocao(alvo, EMOCAO.SUOR, { presa: true });
}

/** Fecha o desmaio quando o Hurt acabou. Chamado do tick passivo. */
export function tickDesmaio(ator, agora) {
  if (!ator || ator.morto || ator.capturado) return;
  if (ator.hp > 0 || !(ator.desmaioEm > 0) || agora < ator.desmaioEm) return;
  ator.morto = true;
  atorMorreu(ator, agora);
}

function gastar(ator, slot, agora) {
  ator.pp = Math.max(0, ator.pp - (slot.def.pp || 1));
  slot.usadoEm = agora;
}

function miraDoTiro(ator, alvo) {
  if (Number.isFinite(ator.miraX) && Number.isFinite(ator.miraY)) return { x: ator.miraX, y: ator.miraY };
  return { x: alvo.x, y: alvo.y };
}

function tiroLimpo(ator, alvo) {
  if (!alvo) return true;
  const mira = miraDoTiro(ator, alvo);
  return !bloqueioNoTrecho(ator.x, ator.y, mira.x, mira.y, RAIO_PROJETIL);
}

function escolher(ator, alvo, d) {
  const prontos = [];
  for (let i = 0; i < ator.golpes.length; i++) {
    const g = ator.golpes[i];
    if ((g.def.pp || 1) > ator.pp) continue;
    prontos.push(g);
  }
  const corpo = usaCorpo(ator);
  const distancia = usaDistancia(ator);
  const noPlano = !alvo || cruzaAltura(ator, alvo);
  const linhaLivre = tiroLimpo(ator, alvo);
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    if (corpo && noPlano && g.def.forma === "contact" && d <= alcanceCorpo(g.def)) return g;
  }
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    if (distancia && linhaLivre && (g.def.forma === "projectile" || g.def.forma === "arc") && d <= g.def.alcance) return g;
  }
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    if (corpo && noPlano && g.def.forma === "radius" && g.def.poder > 0 && d <= Math.max(2.2, g.def.alcance)) return g;
  }
  if (d > 2.4) {
    for (let i = 0; i < prontos.length; i++) {
      if (prontos[i].def.poder <= 0) return prontos[i];
    }
  }
  return null;
}

/** Preparação. Corpo a corpo sai mais cedo que o tiro. O poder alonga os dois. */
export function tempoPreparacao(def) {
  const poder = Math.max(0, def?.poder || 0);
  if (poder <= 0) return 0.16;
  const base = 0.2 + Math.min(0.32, poder / 240);
  if (def?.forma === "contact" || def?.forma === "radius") return Math.max(0.12, base * 0.72);
  return base;
}

/** Cauda depois que o golpe sai. O rolamento com a barra cheia corta a recuperação. */
export function tempoRecuperacao(def) {
  const prep = tempoPreparacao(def);
  if (def?.forma === "contact" || def?.forma === "radius") return Math.max(0.22, Math.min(0.32, prep * 0.9));
  return Math.max(0.12, Math.min(0.24, prep * 0.48));
}

export function tempoConjuracao(def) {
  return tempoPreparacao(def);
}

export function emConjuracao(ator) {
  return (ator?.conjuroRestante || 0) > 0;
}

function pararNoLugar(ator) {
  if (ator?.pulando) {
    ator.andando = false;
    return;
  }
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
}

export function cancelarGolpe(ator) {
  if (!ator) return;
  ator.conjuroRestante = 0;
  ator.conjuroDur = 0;
  ator.conjuroSlot = null;
  ator.golpeRecRestante = 0;
  ator.golpeRecDur = 0;
  ator.golpeSlot = null;
  ator.golpePose = "";
  ator.golpeClip = 0;
  ator.poseSeguinte = "";
  ator.jatoDur = 0;
  ator.jatoTempo = 0;
  ator.jatoProx = 0;
  ator.jatoFila = 0;
  ator.jatoSlot = null;
  ator.jatoId = 0;
  fecharKi(ator);
}

export function cancelarConjuracao(ator) {
  cancelarGolpe(ator);
}

function miraDoGolpe(ator, slot, alvo) {
  const def = slot.def;
  let mx = alvo?.x ?? ator.x;
  let my = alvo?.y ?? ator.y;
  if ((def.forma === "projectile" || def.forma === "arc") && Number.isFinite(ator.miraX) && Number.isFinite(ator.miraY)) {
    mx = ator.miraX;
    my = ator.miraY;
  }
  return { mx, my };
}

function apontar(ator, mx, my) {
  const dx = mx - ator.x;
  const dy = my - ator.y;
  const len = Math.hypot(dx, dy) || 1;
  ator.dirX = dx / len;
  ator.dirY = dy / len;
}

function comecarPreparacao(ator, slot, mx, my, agora, efeitos) {
  const def = slot.def;
  const dur = tempoPreparacao(def);
  const distancia = def.forma === "projectile" || def.forma === "arc";
  const pose = distancia ? "Shoot" : "Attack";
  const clip = distancia ? 0 : tempoClipGolpe(ator, "Attack");
  const rec = distancia ? tempoRecuperacao(def) : Math.max(tempoRecuperacao(def), Math.max(0, clip - dur));
  ator.conjuroRestante = dur;
  ator.conjuroDur = dur;
  ator.conjuroSlot = slot;
  ator.conjuroMx = mx;
  ator.conjuroMy = my;
  ator.golpeRecDur = rec;
  ator.golpeRecRestante = 0;
  ator.golpeSlot = null;
  ator.golpeClip = distancia ? dur + rec : 0;
  puloNoGolpe(ator);
  pararNoLugar(ator);
  marcarPose(ator, pose, agora);
  ator.golpePose = ator.pose;
  const ate = agora + (distancia ? dur + rec : Math.max(dur + rec, clip));
  if (ate > ator.poseAte) ator.poseAte = ate;
  if (distancia && def.poder > 0) abrirKi(ator, def.tipo);
  if (efeitos?.flutuar) efeitos.flutuar(ator, def.nome, COR_TIPO[def.tipo] || "#e2e8f0");
}

function abrirRecuperacao(ator, slot) {
  ator.golpeSlot = slot;
  ator.golpeRecRestante = ator.golpeRecDur || tempoRecuperacao(slot.def);
  ator.conjuroRestante = 0;
  ator.conjuroSlot = null;
  fecharKi(ator);
  if (!emAvanco(ator)) pararNoLugar(ator);
}

let rajadaSeq = 1;

function soltarTiro(ator, slot, ang, extra) {
  const def = slot.def;
  const dirX = Math.cos(ang);
  const dirY = Math.sin(ang);
  const vel = extra.vel || def.vel || 14;
  const travado = ator.resultadoTurno;
  const longe = travado?.alvo
    ? Math.hypot(travado.alvo.x - ator.x, travado.alvo.y - ator.y) + 1.5
    : 0;
  soltarProjetil({
    x: ator.x + dirX * 0.4,
    y: ator.y + dirY * 0.4,
    z: alturaPe(ator),
    vx: dirX * vel,
    vy: dirY * vel,
    dono: ator,
    faccao: ator.faccao,
    poder: extra.poder ?? def.poder,
    tipo: def.tipo,
    categoria: def.categoria,
    acerto: extra.acerto != null ? extra.acerto : def.acerto,
    forma: def.forma,
    raio: extra.raio || def.raio,
    max: Math.max(def.alcance || 12, longe),
    garantirAlvo: travado?.alvo || null,
    ensaio: !!extra.ensaio,
    arco: !!extra.arco,
    rajada: extra.rajada || 0,
    giro: extra.giro || 0,
    amp: extra.amp || 0,
    freq: extra.freq || 0,
    fase: extra.fase || 0,
    cresce: extra.cresce || 0,
    distCresce: extra.distCresce || 7,
    escala: extra.escala || 0,
    folha: extra.folha || "",
    rastroEspaco: def.key === "ember" || def.key === "waterGun" ? 0.14 : 0,
  });
}

function miraViva(ator, alvo) {
  const mx = (alvo?.x ?? ator.x) + (ator.leadX || 0);
  const my = (alvo?.y ?? ator.y) + (ator.leadY || 0);
  ator.miraX = mx;
  ator.miraY = my;
  return { mx, my };
}

function soltarLeque(ator, slot, receita) {
  const base = Math.atan2(ator.dirY, ator.dirX);
  const angs = angulosLeque(receita.n, receita.graus);
  const id = rajadaSeq++;
  const poder = (slot.def.poder || 0) / receita.n;
  const velocidade = receita.vel || slot.def.vel || 14;
  for (let i = 0; i < angs.length; i++) {
    const folga = receita.vel ? 0.85 + Math.random() * 0.2 : 1;
    soltarTiro(ator, slot, base + angs[i], {
      vel: velocidade * folga,
      poder,
      rajada: id,
      giro: receita.giro || 0,
      amp: receita.amp || 0,
      freq: receita.freq || 0,
      fase: (i / Math.max(1, receita.n)) * Math.PI * 2,
      escala: folhaGolpe(slot.def.key)?.escalaVoo || 0.4,
      folha: slot.def.key,
      raio: receita.amp ? 0.36 : 0.32,
    });
  }
}

function dispararJato(ator, slot) {
  const receita = receitaRajada(slot.def.key);
  if (!receita) return;
  const alvo = ator.alvo;
  const mira = miraViva(ator, alvo);
  apontar(ator, mira.mx, mira.my);
  const base = Math.atan2(ator.dirY, ator.dirX);
  soltarTiro(ator, slot, base + desvioJato(receita.graus), {
    vel: receita.vel,
    poder: (slot.def.poder || 0) / receita.n,
    rajada: ator.jatoId,
    cresce: receita.cresce,
    distCresce: receita.distCresce,
    escala: folhaGolpe(slot.def.key)?.escalaVoo || 0.28,
    folha: slot.def.key,
    raio: 0.34,
  });
}

function abrirJato(ator, slot) {
  const receita = receitaRajada(slot.def.key);
  ator.jatoSlot = slot;
  ator.jatoDur = receita.dur;
  ator.jatoTempo = 0;
  ator.jatoProx = receita.intervalo;
  ator.jatoFila = receita.n - 1;
  ator.jatoId = rajadaSeq++;
  ator.conjuroRestante = 0;
  ator.conjuroSlot = null;
  ator.golpePose = "Shoot";
  dispararJato(ator, slot);
}

function encerrarJato(ator, slot) {
  ator.jatoDur = 0;
  ator.jatoTempo = 0;
  ator.jatoProx = 0;
  ator.jatoFila = 0;
  ator.jatoSlot = null;
  ator.jatoId = 0;
  abrirRecuperacao(ator, slot);
}

function tickJato(ator, dt, agora) {
  const slot = ator.jatoSlot;
  const alvo = ator.alvo;
  if (!slot || !alvo || alvo.morto) {
    cancelarGolpe(ator);
    return;
  }
  ator.jatoTempo += dt;
  while (ator.jatoFila > 0 && ator.jatoTempo >= ator.jatoProx && ator.jatoTempo < ator.jatoDur) {
    dispararJato(ator, slot);
    ator.jatoProx += receitaRajada(slot.def.key).intervalo;
    ator.jatoFila -= 1;
  }
  const mira = miraViva(ator, alvo);
  apontar(ator, mira.mx, mira.my);
  manterPoseGolpe(ator, agora);
  if (ator.jatoTempo < ator.jatoDur) return;
  encerrarJato(ator, slot);
}

function soltarGolpe(ator, slot, alvo, agora, efeitos) {
  const def = slot.def;
  apontar(ator, ator.conjuroMx, ator.conjuroMy);
  gastar(ator, slot, agora);
  marcarFuria(ator, def);
  if (efeitos.aoGolpe) efeitos.aoGolpe(ator, def);
  notar(efeitos, { tipo: "golpe", ator, def });

  if (def.poder <= 0) {
    const travado = resultadoTravado(ator, alvo);
    if (travado && (!travado.acertou || travado.imune)) {
      if (!travado.gasto) aplicarTravado(ator, alvo, agora, efeitos, travado);
      abrirRecuperacao(ator, slot);
      return;
    }
    if (travado) travado.gasto = true;
    if (CURA.test(def.key || "")) {
      const antes = ator.hp;
      ator.hp = Math.min(ator.hpMax, ator.hp + Math.ceil(ator.hpMax * 0.22));
      efeitos.flutuar(ator, "cura", "#4ade80");
      notar(efeitos, { tipo: "cura", ator, ganho: ator.hp - antes });
    } else {
      ator.velMul = 1.25;
      ator.velMulAte = agora + 4;
      efeitos.flutuar(ator, def.nome, "#93c5fd");
    }
    abrirRecuperacao(ator, slot);
    return;
  }

  if (def.forma === "projectile" || def.forma === "arc") {
    const receita = def.forma === "projectile" ? receitaRajada(def.key) : null;
    if (receita?.tipo === "jato") {
      abrirJato(ator, slot);
      return;
    }
    if (receita?.tipo === "leque") soltarLeque(ator, slot, receita);
    else {
      soltarTiro(ator, slot, Math.atan2(ator.dirY, ator.dirX), {
        vel: def.vel || 14,
        arco: def.forma === "arc",
      });
    }
    abrirRecuperacao(ator, slot);
    return;
  }

  if (def.forma === "radius") {
    avancarNoGolpe(ator, alvo);
    const raio = Math.max(2.2, def.alcance || 2.2);
    const perto = atoresPerto(ator.x, ator.y, raio);
    for (let i = 0; i < perto.length; i++) {
      aplicarDano(ator, perto[i], def.poder, def.tipo, def.categoria, agora, efeitos, def.acerto, def.forma);
    }
    if (ator.resultadoTurno && !ator.resultadoTurno.gasto && alvo) {
      aplicarDano(ator, alvo, def.poder, def.tipo, def.categoria, agora, efeitos, def.acerto, def.forma);
    }
    abrirRecuperacao(ator, slot);
    return;
  }

  const alcance = alcanceCorpo(def);
  const d = alvo ? dist(ator, alvo) : Infinity;
  const travado = ator.resultadoTurno && !ator.resultadoTurno.gasto;
  if (alvo && (d <= alcance || travado)) {
    avancarNoGolpe(ator, alvo);
    ator.hopLift = Math.max(ator.hopLift || 0, 0.28);
    aplicarDano(ator, alvo, def.poder, def.tipo, def.categoria, agora, efeitos, acertoCorpo(def.acerto, d, alcance), def.forma);
  } else if (efeitos?.flutuar) {
    efeitos.flutuar(ator, "errou", "#cbd5e1");
    notar(efeitos, { tipo: "erro", ator, alvo });
  }
  abrirRecuperacao(ator, slot);
}

function manterPoseGolpe(ator, agora) {
  if (!ator.golpePose) return;
  ator.pose = ator.golpePose;
  const ate = agora + Math.max(ator.conjuroRestante || 0, ator.golpeRecRestante || 0, 0.05);
  if (ate > (ator.poseAte || 0)) ator.poseAte = ate;
}

export function tickConjuracao(ator, dt, agora, efeitos) {
  if (ator.morto || ator.capturado || emRecuo(ator) || emEsquiva(ator)) {
    if (emConjuracao(ator) || (ator.golpeRecRestante || 0) > 0 || (ator.jatoDur || 0) > 0) cancelarGolpe(ator);
    return;
  }
  if ((ator.jatoDur || 0) > 0) {
    tickJato(ator, dt, agora);
    return;
  }
  if (emConjuracao(ator)) {
    const slot = ator.conjuroSlot;
    const alvo = ator.alvo;
    if (!slot || !alvo || alvo.morto) {
      cancelarGolpe(ator);
      return;
    }
    const mira = miraDoGolpe(ator, slot, alvo);
    ator.conjuroMx = mira.mx;
    ator.conjuroMy = mira.my;
    apontar(ator, mira.mx, mira.my);
    pararNoLugar(ator);
    ator.conjuroRestante -= dt;
    const dur = ator.conjuroDur || tempoPreparacao(slot.def);
    const u = 1 - Math.max(0, ator.conjuroRestante) / dur;
    if (slot.def.forma === "projectile" || slot.def.forma === "arc") pulsarKi(ator, u, dt);
    manterPoseGolpe(ator, agora);
    if (ator.conjuroRestante > 0) return;
    soltarGolpe(ator, slot, alvo, agora, efeitos);
    return;
  }
  if ((ator.golpeRecRestante || 0) <= 0) return;
  if (!emAvanco(ator)) pararNoLugar(ator);
  ator.golpeRecRestante = Math.max(0, ator.golpeRecRestante - dt);
  manterPoseGolpe(ator, agora);
  if (ator.golpeRecRestante > 0) return;
  ator.golpeSlot = null;
  ator.golpePose = "";
  ator.golpeClip = 0;
}

function avancarNoGolpe(ator, alvo) {
  const dx = (alvo?.x ?? ator.x + ator.dirX) - ator.x;
  const dy = (alvo?.y ?? ator.y + ator.dirY) - ator.y;
  const len = Math.hypot(dx, dy) || 1;
  const dist = Math.min(0.72, Math.max(0.18, len - 0.58));
  comecarAvanco(ator, dx / len, dy / len, dist);
}

function executar(ator, slot, alvo, agora, efeitos) {
  tocarGrito(ator, { x: ator.x, y: ator.y, importante: true });
  const mira = miraDoGolpe(ator, slot, alvo);
  comecarPreparacao(ator, slot, mira.mx, mira.my, agora, efeitos);
}

function soltarImediato(ator, slot, alvo, agora, efeitos) {
  tocarGrito(ator, { x: ator.x, y: ator.y, importante: true });
  const mira = miraDoGolpe(ator, slot, alvo);
  ator.conjuroMx = mira.mx;
  ator.conjuroMy = mira.my;
  apontar(ator, mira.mx, mira.my);
  const distancia = slot.def.forma === "projectile" || slot.def.forma === "arc";
  const pose = distancia ? "Shoot" : "Attack";
  marcarPose(ator, pose, agora);
  ator.golpePose = ator.pose;
  const clip = distancia ? Math.max(0.4, tempoClipGolpe(ator, "Shoot")) : tempoClipGolpe(ator, "Attack");
  ator.golpeRecDur = Math.max(0.16, clip);
  ator.golpeClip = 0;
  if (ator.poseAte < agora + clip) ator.poseAte = agora + clip;
  if (efeitos?.flutuar) efeitos.flutuar(ator, slot.def.nome, COR_TIPO[slot.def.tipo] || "#e2e8f0");
  soltarGolpe(ator, slot, alvo, agora, efeitos);
}

function slotEnsaio(ator, alvo, d) {
  const golpes = ator?.golpes;
  if (!golpes || !alvo) return null;
  const evitar = ator.ensaioEvitar || "";
  let reserva = null;
  for (let i = 0; i < golpes.length; i++) {
    const g = golpes[i];
    const def = g.def;
    if (!def || (def.poder || 0) <= 0) continue;
    if (def.key && def.key === evitar) {
      if (!reserva) reserva = g;
      continue;
    }
    if (serveEnsaio(ator, alvo, def, d)) return g;
  }
  if (reserva && serveEnsaio(ator, alvo, reserva.def, d)) return reserva;
  return null;
}

function serveEnsaio(ator, alvo, def, d) {
  const forma = def.forma;
  if ((forma === "projectile" || forma === "arc") && usaDistancia(ator)) {
    return d <= (def.alcance || 12) && tiroLimpo(ator, alvo);
  }
  if (!usaCorpo(ator)) return false;
  if (forma === "contact") return d <= alcanceCorpo(def);
  if (forma === "radius") return d <= Math.max(2.2, def.alcance || 2.2);
  return false;
}

/** Golpe de mentira entre os turnos. Não gasta PP e o acerto sai zerado. */
export function ensaiarGolpe(ator, agora, efeitos) {
  if (!ator || ator.ensaioFeito) return;
  if (emConjuracao(ator) || (ator.golpeRecRestante || 0) > 0 || (ator.jatoDur || 0) > 0) return;
  if (ator.morto || ator.capturado || emRecuo(ator) || emAvanco(ator) || emEsquiva(ator)) return;
  const alvo = ator.alvo;
  if (!alvo || alvo.morto) return;
  const d = dist(ator, alvo);
  const slot = slotEnsaio(ator, alvo, d);
  if (!slot) return;
  ator.ensaioFeito = true;
  ator.resultadoTurno = null;
  const mira = miraDoGolpe(ator, slot, alvo);
  ator.conjuroMx = mira.mx;
  ator.conjuroMy = mira.my;
  ator.miraX = mira.mx;
  ator.miraY = mira.my;
  apontar(ator, mira.mx, mira.my);
  const def = slot.def;
  const distancia = def.forma === "projectile" || def.forma === "arc";
  const pose = distancia ? "Shoot" : "Attack";
  marcarPose(ator, pose, agora);
  ator.golpePose = ator.pose;
  const clip = distancia ? 0.35 : tempoClipGolpe(ator, "Attack");
  ator.golpeRecDur = Math.max(0.14, clip);
  ator.golpeClip = 0;
  if (ator.poseAte < agora + clip) ator.poseAte = agora + clip;
  tocarGrito(ator, { x: ator.x, y: ator.y, importante: false });
  if (efeitos?.flutuar) efeitos.flutuar(ator, def.nome, COR_TIPO[def.tipo] || "#e2e8f0");
  if (efeitos?.aoGolpe) efeitos.aoGolpe(ator, def);
  if (distancia) {
    soltarTiro(ator, slot, Math.atan2(ator.dirY, ator.dirX), {
      vel: def.vel || 14,
      arco: def.forma === "arc",
      acerto: 0,
      ensaio: true,
    });
    abrirRecuperacao(ator, slot);
    return;
  }
  if (def.forma === "radius") {
    avancarNoGolpe(ator, alvo);
    const raio = Math.max(2.2, def.alcance || 2.2);
    const perto = atoresPerto(ator.x, ator.y, raio);
    for (let i = 0; i < perto.length; i++) {
      aplicarDano(ator, perto[i], def.poder, def.tipo, def.categoria, agora, efeitos, 0, def.forma);
    }
    abrirRecuperacao(ator, slot);
    return;
  }
  avancarNoGolpe(ator, alvo);
  ator.hopLift = Math.max(ator.hopLift || 0, 0.28);
  aplicarDano(ator, alvo, def.poder, def.tipo, def.categoria, agora, efeitos, 0, def.forma);
  abrirRecuperacao(ator, slot);
}

export function dispararGolpeTurno(ator, slot, agora, efeitos) {
  if (!ator || !slot) return false;
  if (emConjuracao(ator) || (ator.golpeRecRestante || 0) > 0 || (ator.jatoDur || 0) > 0) return false;
  const alvo = ator.alvo;
  if (!alvo || alvo.morto) return false;
  soltarImediato(ator, slot, alvo, agora, efeitos);
  return true;
}

export function tentarGolpe(ator, agora, efeitos) {
  if (emConjuracao(ator) || (ator.golpeRecRestante || 0) > 0 || (ator.jatoDur || 0) > 0) return;
  const recuoHerdado = ator.recuoNoTick == null ? emRecuo(ator) : ator.recuoNoTick > 0;
  if (ator.morto || ator.capturado || ator.dormindo > 0 || recuoHerdado || emAvanco(ator) || emEsquiva(ator)) return;
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
    projetil.acerto,
    projetil.forma,
    projetil.rajada,
  );
}

export { atorMorreu };
