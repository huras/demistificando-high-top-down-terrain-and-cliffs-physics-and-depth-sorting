/** Roteiro do combate em turnos. A fórmula já saiu; aqui só anda e dispara uma vez. */

import { bloqueioNoTrecho } from "./arenas.js";
import { dispararGolpeTurno } from "../pokemon/combate/executor.js";
import { projeteisVivos } from "../pokemon/combate/projeteis.js";
import { emAvanco, velocidadeDe } from "../pokemon/ator.js";
import { RAIO_PROJETIL } from "../pokemon/ia/constantes.js";
import { limitarArena, paradaDe } from "../pokemon/ia/espaco.js";
import { notaGolpeTurno, resolverTurno } from "../pokemon/combate/acertoClassico.js";
import { emImpacto } from "./impacto.js";
import { CAM_TURNO } from "./cameraTurno.js";

const ESPERA_LINHA = 1.6;
const ESPERA_CARGA = 0.85;
const ESPERA_TEATRO = 1;

const RECARREGA_DEPOIS = {
  hyperBeam: true,
  gigaImpact: true,
  rockWrecker: true,
  roarOfTime: true,
  frenzyPlant: true,
  blastBurn: true,
  hydroCannon: true,
};

let modo = "real";
let fase = "ocioso";
let esquerda = null;
let direita = null;
let fila = [];
let indice = 0;
let ator = null;
let alvo = null;
let slot = null;
let versaoEscolha = 0;
let esperaLinha = 0;
let esperaCorpo = 0;
let esperaCarregar = 0;
let esperaTeatro = 0;
let avisouCarregar = false;
let disparou = false;
let veioDoTeatro = false;

export function definirModoLuta(proximo) {
  modo = proximo === "turnos" ? "turnos" : "real";
}

export function modoTurnos() {
  return modo === "turnos";
}

export function emTeatro() {
  return modo === "turnos" && fase === "teatro";
}

export function emCena() {
  return modo === "turnos" && (fase === "teatro" || fase === "foco");
}

export function emFoco() {
  return modo === "turnos" && fase === "foco";
}

export function concluirFoco() {
  if (fase !== "foco") return;
  abrirTurno();
}

const poseVolta = {
  tipo: "volta",
  alvo: null,
  raio: CAM_TURNO.volta.raio,
  altura: CAM_TURNO.volta.altura,
  giro: CAM_TURNO.volta.giro,
};

export function enquadramentoTurno() {
  if (modo !== "turnos" || fase === "ocioso") return null;
  if ((fase === "teatro" || aproximandoCorpo()) && esquerda && direita) {
    return { tipo: "teatro", a: esquerda, b: direita };
  }
  if (!ator || !alvo) return null;
  if (fase === "escolha") {
    poseVolta.alvo = ator;
    return poseVolta;
  }
  return { de: ator, para: alvo, perto: fase === "foco" };
}

export function pedidoEscolha() {
  if (modo !== "turnos" || fase !== "escolha" || !ator) return null;
  const golpes = golpesDisponiveis(ator);
  const lista = [];
  for (let i = 0; i < golpes.length; i++) {
    const def = golpes[i].def;
    lista.push({
      chave: def.key,
      nome: def.nome,
      forma: def.forma,
      tipo: def.tipo,
      poder: def.poder || 0,
      acerto: def.acerto,
      custo: def.pp || 1,
    });
  }
  return { versao: versaoEscolha, pp: ator.pp, golpes: lista };
}

export function escolherGolpeTurno(chave) {
  if (fase !== "escolha" || !ator || !alvo) return false;
  const golpes = golpesDisponiveis(ator);
  let achado = null;
  for (let i = 0; i < golpes.length; i++) {
    if (golpes[i].def.key === chave) achado = golpes[i];
  }
  if (!achado) return false;
  armar(achado);
  return true;
}

export function prepararTurnos(esq, dir) {
  esquerda = esq;
  direita = dir;
  if (modo !== "turnos") {
    fase = "ocioso";
    ator = null;
    alvo = null;
    return;
  }
  novaRodada();
}

export function encerrarTurnos() {
  fase = "ocioso";
  ator = null;
  alvo = null;
  slot = null;
  fila = [];
  indice = 0;
  veioDoTeatro = false;
  if (esquerda) {
    esquerda.resultadoTurno = null;
    esquerda.carregarDepois = false;
  }
  if (direita) {
    direita.resultadoTurno = null;
    direita.carregarDepois = false;
  }
}

export function avisoTurno() {
  if (modo !== "turnos" || fase !== "carregar") return null;
  return { versao: versaoEscolha, titulo: "Carregando" };
}

export function tickTurnos(dt, agora, efeitos) {
  if (modo !== "turnos" || fase === "ocioso" || fase === "escolha" || fase === "foco") return;
  if (!vivo(esquerda) || !vivo(direita)) return;
  if (fase === "carregar") {
    if (!avisouCarregar) {
      avisouCarregar = true;
      if (efeitos?.flutuar) efeitos.flutuar(ator, "Carregando", "#93c5fd");
      if (efeitos?.anotar) efeitos.anotar({ tipo: "carregar", ator });
    }
    esperaCarregar -= dt;
    if (esperaCarregar > 0) return;
    indice += 1;
    abrirTurno();
    return;
  }
  if (fase === "aproximar") {
    if (passoAproximar(dt)) soltar(agora, efeitos);
    return;
  }
  if (fase === "golpe") {
    if (!disparou) soltar(agora, efeitos);
    if (ocupado(ator)) return;
    if (!disparou) return;
    ator.resultadoTurno = null;
    comecarTeatro();
    return;
  }
  if (fase === "teatro") {
    esperaTeatro -= dt;
    if (esperaTeatro > 0) return;
    indice += 1;
    veioDoTeatro = true;
    abrirTurno();
  }
}

function comecarTeatro() {
  fase = "teatro";
  esperaTeatro = ESPERA_TEATRO;
  if (ator && slot?.def?.key) ator.ensaioEvitar = slot.def.key;
  soltarEnsaio(esquerda);
  soltarEnsaio(direita);
}

function soltarEnsaio(quem) {
  if (!quem) return;
  quem.resultadoTurno = null;
  quem.ensaioFeito = false;
  quem.esquiva = 1;
}

function golpeLegal(quem, def) {
  if (!def) return false;
  if ((def.pp || 1) > (quem.pp || 0)) return false;
  const forma = def.forma;
  if (forma === "contact" || forma === "radius") return quem.usaCorpo !== false;
  if (forma === "projectile" || forma === "arc") return quem.usaDistancia !== false;
  return false;
}

function golpesDisponiveis(quem) {
  const lista = [];
  const golpes = quem?.golpes;
  if (!golpes) return lista;
  for (let i = 0; i < golpes.length; i++) {
    if (!golpeLegal(quem, golpes[i].def)) continue;
    lista.push(golpes[i]);
  }
  return lista;
}

function vivo(atorAtual) {
  return !!(atorAtual && atorAtual.hp > 0 && !atorAtual.morto);
}

function oponente(de) {
  return de === esquerda ? direita : esquerda;
}

function novaRodada() {
  const lista = [];
  if (vivo(esquerda)) lista.push(esquerda);
  if (vivo(direita)) lista.push(direita);
  lista.sort((a, b) => {
    const diff = (b.stats?.velocidade || 0) - (a.stats?.velocidade || 0);
    if (diff !== 0) return diff;
    return Math.random() < 0.5 ? -1 : 1;
  });
  fila = lista;
  indice = 0;
  abrirTurno();
}

function abrirTurno() {
  slot = null;
  disparou = false;
  esperaLinha = 0;
  esperaCorpo = 0;
  while (indice < fila.length) {
    const atual = fila[indice];
    const outro = oponente(atual);
    if (!vivo(atual) || !vivo(outro)) {
      indice += 1;
      continue;
    }
    ator = atual;
    alvo = outro;
    atual.alvo = outro;
    if (atual.carregarDepois) {
      veioDoTeatro = false;
      atual.carregarDepois = false;
      fase = "carregar";
      esperaCarregar = ESPERA_CARGA;
      avisouCarregar = false;
      versaoEscolha += 1;
      return;
    }
    const golpes = golpesDisponiveis(atual);
    if (!golpes.length) {
      indice += 1;
      continue;
    }
    if (atual.faccao === "esquerda") {
      if (veioDoTeatro) {
        veioDoTeatro = false;
        fase = "foco";
        return;
      }
      fase = "escolha";
      versaoEscolha += 1;
      return;
    }
    veioDoTeatro = false;
    armar(escolherIa(atual, outro, golpes));
    return;
  }
  if (!vivo(esquerda) || !vivo(direita)) {
    veioDoTeatro = false;
    fase = "ocioso";
    return;
  }
  if (!golpesDisponiveis(esquerda).length && !golpesDisponiveis(direita).length) {
    veioDoTeatro = false;
    fase = "ocioso";
    return;
  }
  novaRodada();
}

function escolherIa(atual, outro, golpes) {
  let melhor = golpes[0];
  let nota = -1;
  for (let i = 0; i < golpes.length; i++) {
    const n = notaGolpeTurno(golpes[i].def, outro);
    if (n > nota) {
      nota = n;
      melhor = golpes[i];
    }
  }
  return melhor;
}

function armar(escolhido) {
  slot = escolhido;
  ator.resultadoTurno = resolverTurno(ator, alvo, escolhido.def);
  ator.miraX = alvo.x;
  ator.miraY = alvo.y;
  disparou = false;
  esperaLinha = 0;
  esperaCorpo = 0;
  const forma = escolhido.def.forma;
  const longe = forma === "projectile" || forma === "arc";
  fase = longe && linhaLivre(ator, alvo) ? "golpe" : "aproximar";
}

function corpoDoGolpe(def) {
  return def?.forma === "contact" || def?.forma === "radius";
}

function aproximandoCorpo() {
  return fase === "aproximar" && corpoDoGolpe(slot?.def);
}

function linhaLivre(de, para) {
  return !bloqueioNoTrecho(de.x, de.y, para.x, para.y, RAIO_PROJETIL);
}

function passoAproximar(dt) {
  if (!slot || !vivo(ator) || !vivo(alvo)) return true;
  const def = slot.def;
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  ator.dirX = dx / d;
  ator.dirY = dy / d;
  if (!corpoDoGolpe(def)) {
    if (linhaLivre(ator, alvo)) return true;
    esperaLinha += dt;
    if (esperaLinha >= ESPERA_LINHA) return true;
    const lado = esperaLinha < ESPERA_LINHA * 0.5 ? 1 : -1;
    andar(ator, -dy / d * lado, dx / d * lado, dt);
    return false;
  }
  const parada = paradaDe(def);
  esperaCorpo += dt;
  if (d <= parada + 0.08 || esperaCorpo >= 3.2) {
    pararPasso(ator);
    pararPasso(alvo);
    return true;
  }
  fecharEmArco(dx / d, dy / d, dt, Math.max(0, d - parada));
  return false;
}

function fecharEmArco(ux, uy, dt, falta) {
  const curva = Math.sin(esperaCorpo * 2.4);
  const ax = ux - uy * curva * 0.55;
  const ay = uy + ux * curva * 0.55;
  const al = Math.hypot(ax, ay) || 1;
  const bx = -ux + uy * curva * 0.55;
  const by = -uy - ux * curva * 0.55;
  const bl = Math.hypot(bx, by) || 1;
  andar(ator, ax / al, ay / al, dt, falta * 0.68, 1);
  andar(alvo, bx / bl, by / bl, dt, falta * 0.32, 0.62);
  ator.dirX = ux;
  ator.dirY = uy;
  alvo.dirX = -ux;
  alvo.dirY = -uy;
}

function pararPasso(quem) {
  if (!quem) return;
  quem.vx = 0;
  quem.vy = 0;
  quem.andando = false;
}

function andar(quem, dirX, dirY, dt, limite, folga) {
  const vel = velocidadeDe(quem, true) * (folga == null ? 1 : folga);
  let passo = vel * dt;
  if (limite != null) passo = Math.min(passo, limite);
  if (passo <= 0.0001) {
    quem.vx = 0;
    quem.vy = 0;
    quem.andando = false;
    return;
  }
  quem.x += dirX * passo;
  quem.y += dirY * passo;
  quem.vx = dirX * vel;
  quem.vy = dirY * vel;
  quem.andando = true;
  limitarArena(quem);
}

function soltar(agora, efeitos) {
  if (disparou || !slot) return;
  ator.alvo = alvo;
  ator.miraX = alvo.x;
  ator.miraY = alvo.y;
  if (!dispararGolpeTurno(ator, slot, agora, efeitos)) return;
  if (RECARREGA_DEPOIS[slot.def.key]) ator.carregarDepois = true;
  disparou = true;
  fase = "golpe";
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
}

function ocupado(quem) {
  if (emImpacto()) return true;
  if (!quem) return false;
  if ((quem.conjuroRestante || 0) > 0) return true;
  if ((quem.golpeRecRestante || 0) > 0) return true;
  if ((quem.jatoDur || 0) > 0) return true;
  if (emAvanco(quem)) return true;
  const tiros = projeteisVivos();
  for (let i = 0; i < tiros.length; i++) {
    if (tiros[i].dono === quem) return true;
  }
  return false;
}
