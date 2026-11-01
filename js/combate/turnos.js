/** Roteiro do combate em turnos. Arena 1v1 ou grupo Chrono no overworld. */

import { RAIO_POKEMON } from "../config.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { invadeDisco } from "../fisica/obstaculos.js";
import { bloqueioNoTrecho } from "./arenas.js";
import { dispararGolpeTurno } from "../pokemon/combate/executor.js";
import { projeteisVivos } from "../pokemon/combate/projeteis.js";
import { emAvanco, velocidadeDe } from "../pokemon/ator.js";
import { processarInicioTurno, residualTurno } from "../pokemon/combate/status.js";
import { RAIO_PROJETIL } from "../pokemon/ia/constantes.js";
import { limitarArena, paradaDe } from "../pokemon/ia/espaco.js";
import { notaGolpeTurno, resolverTurno } from "../pokemon/combate/acertoClassico.js";
import { mapaPp, podeGastarPp } from "../pokemon/pp.js";
import { emImpacto } from "./impacto.js";
import { CAM_TURNO } from "./cameraTurno.js";
import { limitarVolumeChrono, volumeChronoAtivo } from "./chrono/volume.js";

const ESPERA_LINHA = 1.6;
const ESPERA_CARGA = 0.85;
const ESPERA_TEATRO = 1;
/** Chrono OW: props/pedras — corta a espera e teleporta pro contato. */
const ESPERA_CORPO_CHRONO = 1.45;
const ESPERA_CORPO_ARENA = 3.2;
const ESPERA_SEM_PROGRESSO = 0.55;

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
/** @type {object[]} */
let aliados = [];
/** @type {object[]} */
let foes = [];
let modoGrupo = false;
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
let efeitosRef = null;
let distAntesAprox = Infinity;
let semProgresso = 0;

function limitarPosicao(quem) {
  if (volumeChronoAtivo()) limitarVolumeChrono(quem);
  else limitarArena(quem);
}

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
  if ((fase === "teatro" || aproximandoCorpo() || fase === "voltar") && esquerda && direita) {
    const a = vivo(ator) ? ator : esquerda;
    const b = vivo(alvo) ? alvo : direita;
    return { tipo: "teatro", a, b };
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
      categoria: def.categoria || "physical",
      poder: def.poder || 0,
      acerto: def.acerto,
      custo: def.pp || 1,
    });
  }
  return {
    versao: versaoEscolha,
    ppPorTipo: mapaPp(ator),
    ppTipos: ator.ppTipos ? ator.ppTipos.slice() : [],
    ppMax: ator.ppMax || 1,
    golpes: lista,
  };
}

/** Alvos vivos do lado oposto (só grupo Chrono). */
export function alvosEscolhaTurno() {
  if (!modoGrupo || modo !== "turnos" || fase !== "escolha") return null;
  const lista = [];
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (!vivo(f)) continue;
    lista.push({
      id: f.id,
      nome: f.especie?.nome || "—",
      nivel: f.nivel | 0,
      selecionado: f === alvo,
    });
  }
  return lista;
}

export function escolherAlvoTurno(id) {
  if (!modoGrupo || fase !== "escolha") return false;
  const chave = String(id);
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (!vivo(f)) continue;
    if (String(f.id) !== chave) continue;
    alvo = f;
    if (ator) ator.alvo = f;
    versaoEscolha += 1;
    return true;
  }
  return false;
}

export function escolherGolpeTurno(chave) {
  if (fase !== "escolha" || !ator || !alvo) return false;
  if (!vivo(alvo)) {
    const prox = primeiroVivo(foes);
    if (!prox) return false;
    alvo = prox;
    ator.alvo = prox;
  }
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
  modoGrupo = false;
  aliados = esq ? [esq] : [];
  foes = dir ? [dir] : [];
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

/** Chrono OW: vários combatentes na mesma fila de velocidade. */
export function prepararTurnosGrupo(listaAliados, listaFoes) {
  modoGrupo = true;
  aliados = (listaAliados || []).slice();
  foes = (listaFoes || []).slice();
  esquerda = aliados[0] || null;
  direita = foes[0] || null;
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
  modoGrupo = false;
  limparFlags(esquerda);
  limparFlags(direita);
  for (let i = 0; i < aliados.length; i++) limparFlags(aliados[i]);
  for (let i = 0; i < foes.length; i++) limparFlags(foes[i]);
  aliados = [];
  foes = [];
  esquerda = null;
  direita = null;
}

function limparFlags(quem) {
  if (!quem) return;
  quem.resultadoTurno = null;
  quem.carregarDepois = false;
}

export function avisoTurno() {
  if (modo !== "turnos" || fase !== "carregar") return null;
  return { versao: versaoEscolha, titulo: "Carregando" };
}

export function tickTurnos(dt, agora, efeitos) {
  efeitosRef = efeitos || null;
  if (modo !== "turnos" || fase === "ocioso" || fase === "escolha" || fase === "foco") return;
  if (!ladoVivo(aliados, esquerda) || !ladoVivo(foes, direita)) return;
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
    if (corpoDoGolpe(slot?.def) && temCasa(ator)) {
      fase = "voltar";
      return;
    }
    comecarTeatro();
    return;
  }
  if (fase === "voltar") {
    if (passoVoltar(dt)) comecarTeatro();
    return;
  }
  if (fase === "teatro") {
    esperaTeatro -= dt;
    if (esperaTeatro > 0) return;
    if (ator) residualTurno(ator, efeitos);
    indice += 1;
    veioDoTeatro = true;
    abrirTurno();
  }
}

function ladoVivo(lista, fallback) {
  if (modoGrupo) {
    for (let i = 0; i < lista.length; i++) {
      if (vivo(lista[i])) return true;
    }
    return false;
  }
  return vivo(fallback);
}

function comecarTeatro() {
  fase = "teatro";
  esperaTeatro = ESPERA_TEATRO;
  if (ator && slot?.def?.key) ator.ensaioEvitar = slot.def.key;
  if (modoGrupo) {
    for (let i = 0; i < aliados.length; i++) soltarEnsaio(aliados[i]);
    for (let i = 0; i < foes.length; i++) soltarEnsaio(foes[i]);
  } else {
    soltarEnsaio(esquerda);
    soltarEnsaio(direita);
  }
}

function soltarEnsaio(quem) {
  if (!quem) return;
  quem.resultadoTurno = null;
  quem.ensaioFeito = false;
  quem.esquiva = 1;
}

function golpeLegal(quem, def) {
  if (!def) return false;
  if (!podeGastarPp(quem, def)) return false;
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
  return !!(atorAtual && atorAtual.hp > 0 && !atorAtual.morto && !atorAtual.capturado);
}

function primeiroVivo(lista) {
  for (let i = 0; i < lista.length; i++) {
    if (vivo(lista[i])) return lista[i];
  }
  return null;
}

function ehAliado(quem) {
  if (!quem) return false;
  if (modoGrupo) {
    for (let i = 0; i < aliados.length; i++) {
      if (aliados[i] === quem) return true;
    }
    return quem.faccao === "party" || quem.faccao === "esquerda";
  }
  return quem.faccao === "esquerda";
}

function oponenteDe(de) {
  if (!modoGrupo) return de === esquerda ? direita : esquerda;
  if (ehAliado(de)) {
    if (vivo(alvo) && !ehAliado(alvo)) return alvo;
    return primeiroVivo(foes);
  }
  return primeiroVivo(aliados);
}

function novaRodada() {
  const lista = [];
  if (modoGrupo) {
    for (let i = 0; i < aliados.length; i++) {
      if (vivo(aliados[i])) lista.push(aliados[i]);
    }
    for (let i = 0; i < foes.length; i++) {
      if (vivo(foes[i])) lista.push(foes[i]);
    }
  } else {
    if (vivo(esquerda)) lista.push(esquerda);
    if (vivo(direita)) lista.push(direita);
  }
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
    const outro = oponenteDe(atual);
    if (!vivo(atual) || !vivo(outro)) {
      indice += 1;
      continue;
    }
    ator = atual;
    alvo = outro;
    atual.alvo = outro;
    const inicio = processarInicioTurno(atual, efeitosRef);
    if (inicio.pulou) {
      residualTurno(atual, efeitosRef);
      veioDoTeatro = false;
      indice += 1;
      continue;
    }
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
    if (ehAliado(atual)) {
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
  if (!ladoVivo(aliados, esquerda) || !ladoVivo(foes, direita)) {
    veioDoTeatro = false;
    fase = "ocioso";
    return;
  }
  const temGolpeAliado = modoGrupo
    ? aliados.some((a) => vivo(a) && golpesDisponiveis(a).length)
    : golpesDisponiveis(esquerda).length;
  const temGolpeFoe = modoGrupo
    ? foes.some((a) => vivo(a) && golpesDisponiveis(a).length)
    : golpesDisponiveis(direita).length;
  if (!temGolpeAliado && !temGolpeFoe) {
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
  distAntesAprox = Infinity;
  semProgresso = 0;
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

function temCasa(quem) {
  return quem && Number.isFinite(quem.casaChronoX) && Number.isFinite(quem.casaChronoY);
}

function raioAtor(quem) {
  return quem?.raioCorpo > 0 ? quem.raioCorpo : RAIO_POKEMON;
}

function pousarNoChao(quem) {
  if (!quem) return;
  const zRef = (quem.elevacao ?? quem.z ?? 0) + 1.2;
  const chao = alturaSobPes(quem.x, quem.y, zRef);
  if (chao > 0) {
    quem.z = chao;
    quem.elevacao = chao;
  }
}

/** Amostra o segmento até o ponto de parada: pedra/árvore no caminho? */
function trechoComProp(de, para, parada) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const stop = Math.max(0.2, parada);
  const alcance = Math.max(0, d - stop);
  if (alcance < 0.12) return false;
  const elev = de.elevacao ?? de.z ?? 0;
  const r = raioAtor(de);
  const passos = Math.max(3, Math.ceil(alcance * 2.2));
  for (let i = 1; i <= passos; i++) {
    const t = (i / passos) * (alcance / d);
    const x = de.x + dx * t;
    const y = de.y + dy * t;
    if (invadeDisco(x, y, elev, r)) return true;
  }
  return false;
}

/** Ponto no anel de contato; prefere livre de disco e o lado de quem ataca. */
function pontoContato(de, para, parada) {
  const stop = Math.max(0.55, parada);
  const dx = de.x - para.x;
  const dy = de.y - para.y;
  const d = Math.hypot(dx, dy);
  const baseAng = d > 1e-5 ? Math.atan2(dy, dx) : Math.atan2(de.dirY || 1, de.dirX || 0);
  const elev = para.elevacao ?? para.z ?? de.elevacao ?? de.z ?? 0;
  const r = raioAtor(de);
  let fallback = null;
  const offsets = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, Math.PI];
  for (let i = 0; i < offsets.length; i++) {
    const ang = baseAng + offsets[i];
    const x = para.x + Math.cos(ang) * stop;
    const y = para.y + Math.sin(ang) * stop;
    if (!fallback) fallback = { x, y };
    if (!invadeDisco(x, y, elev, r)) return { x, y };
  }
  // Ninho fechado por pedras: entra mesmo assim (teatro Chrono).
  return fallback;
}

function puxarParaContato(quem, para, parada) {
  const p = pontoContato(quem, para, parada);
  if (!p) return;
  quem.x = p.x;
  quem.y = p.y;
  pousarNoChao(quem);
  limitarPosicao(quem);
  const dx = para.x - quem.x;
  const dy = para.y - quem.y;
  const d = Math.hypot(dx, dy) || 1;
  quem.dirX = dx / d;
  quem.dirY = dy / d;
  pararPasso(quem);
}

function passoVoltar(dt) {
  if (!ator || !temCasa(ator)) return true;
  const tx = ator.casaChronoX;
  const ty = ator.casaChronoY;
  const dx = tx - ator.x;
  const dy = ty - ator.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0.12) {
    ator.x = tx;
    ator.y = ty;
    pousarNoChao(ator);
    pararPasso(ator);
    return true;
  }
  const casa = { x: tx, y: ty, elevacao: ator.elevacao ?? ator.z ?? 0 };
  // Props no caminho de volta: warp pra casa (não atravessa o ninho de pedra).
  if (modoGrupo && trechoComProp(ator, casa, 0.1)) {
    ator.x = tx;
    ator.y = ty;
    pousarNoChao(ator);
    pararPasso(ator);
    return true;
  }
  andar(ator, dx / d, dy / d, dt, d, 1.05);
  return false;
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
    andar(ator, (-dy / d) * lado, (dx / d) * lado, dt);
    return false;
  }
  const parada = paradaDe(def);
  esperaCorpo += dt;
  if (d < distAntesAprox - 0.03) semProgresso = 0;
  else semProgresso += dt;
  distAntesAprox = d;

  const limEspera = modoGrupo ? ESPERA_CORPO_CHRONO : ESPERA_CORPO_ARENA;
  const travou = modoGrupo && semProgresso >= ESPERA_SEM_PROGRESSO;
  if (d <= parada + 0.08 || esperaCorpo >= limEspera || travou) {
    if (d > parada + 0.12) puxarParaContato(ator, alvo, parada);
    pararPasso(ator);
    pararPasso(alvo);
    return true;
  }
  if (modoGrupo && trechoComProp(ator, alvo, parada)) {
    // Desvia do anel de pedras; se não fechar, o travou acima teleporta.
    const lado = Math.sin(esperaCorpo * 3.1) >= 0 ? 1 : -1;
    const tx = -dy / d;
    const ty = dx / d;
    const ux = dx / d + tx * lado * 0.95;
    const uy = dy / d + ty * lado * 0.95;
    const ul = Math.hypot(ux, uy) || 1;
    andar(ator, ux / ul, uy / ul, dt, Math.max(0, d - parada), 1.05);
    return false;
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
  // No Chrono o alvo fica plantado (Paper Mario); na arena 1v1 mantém o arco mútuo.
  if (!modoGrupo) {
    andar(alvo, bx / bl, by / bl, dt, falta * 0.32, 0.62);
  }
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
  pousarNoChao(quem);
  limitarPosicao(quem);
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
