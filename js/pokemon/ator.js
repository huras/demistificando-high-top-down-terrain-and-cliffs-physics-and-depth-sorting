import { POKEMON, RAIO_POKEMON } from "../config.js";
import { ESQUIVA_ATIVA, ESQUIVA_DIST, ESQUIVA_DUR, ESQUIVA_PREP, ESQUIVA_REC } from "./ia/constantes.js";
import { golpe } from "./dados.js";
import { totalParaNivel } from "./experiencia.js";
import { calcularStats, escalaRecarga, escalaVelocidade } from "./tipos.js";

let seq = 1;

const BASICO = Object.freeze({
  key: "basico",
  nome: "Investida",
  forma: "contact",
  categoria: "physical",
  tipo: "normal",
  poder: 18,
  acerto: 100,
  pp: 0,
  recarga: 0.55,
  alcance: 1.15,
  vel: 0,
  raio: 0.4,
});

export function golpeBasico() {
  return BASICO;
}

/**
 * Pé no mundo. No ar, elevacao já é a altura; hopLift só entra com os pés no chão
 * (senão o voo conta duas vezes).
 */
export function alturaPe(ator) {
  if (!ator) return 0;
  const elev = ator.elevacao ?? ator.z ?? 0;
  const z = ator.z ?? elev;
  if (elev > z + 0.05) return elev;
  return elev + (ator.hopLift || 0);
}

export function alturaCorpo(ator) {
  const h = ator?.alturaCorpo;
  return h > 0 ? h : 1.8;
}

/** Corpos se cruzam na vertical (golpe no chão não alcança quem está voando). */
export function cruzaAltura(a, b, margem = 0.35) {
  const a0 = alturaPe(a);
  const b0 = alturaPe(b);
  const a1 = a0 + alturaCorpo(a);
  const b1 = b0 + alturaCorpo(b);
  return a0 <= b1 + margem && b0 <= a1 + margem;
}

function montarGolpes(especie, nivel) {
  const lista = especie.learnset || [];
  const sabidos = [];
  for (let i = 0; i < lista.length; i++) {
    if (lista[i][0] <= nivel) sabidos.push(lista[i][1]);
  }
  const ultimos = sabidos.slice(-4);
  const slots = [];
  for (let i = 0; i < ultimos.length; i++) {
    const def = golpe(ultimos[i]);
    if (!def) continue;
    slots.push({ chave: def.key, cd: 0, def });
  }
  return slots;
}

/** A arena equipa só os golpes escolhidos. */
export function equiparGolpes(ator, chaves) {
  if (!ator) return;
  const slots = [];
  const vistos = new Set();
  const lista = Array.isArray(chaves) ? chaves : [chaves];
  for (let i = 0; i < lista.length; i++) {
    const chave = lista[i];
    if (!chave || vistos.has(chave)) continue;
    const def = golpe(chave);
    if (!def) continue;
    vistos.add(chave);
    slots.push({ chave: def.key, cd: 0, def });
  }
  ator.golpes = slots;
}

export function equiparGolpe(ator, chave) {
  equiparGolpes(ator, chave ? [chave] : []);
}

export function ppMaximo(nivel, velocidade) {
  const speBonus = Math.round(((velocidade || 50) - 50) * 0.06);
  const cheio = Math.max(8, Math.round(20 + nivel * 0.25 + speBonus));
  return Math.max(3, Math.round((cheio / 3) * 1.3));
}

/**
 * Corpo de combate. Compatível com moverComColisao (x, y, z, elevacao).
 */
export function criarAtor(opts) {
  const esp = opts.especie;
  const nivel = Math.max(1, opts.nivel | 0);
  const stats = calcularStats(esp, nivel);
  const pp = ppMaximo(nivel, stats.velocidade);
  const id = opts.id || `pk-${seq++}`;
  return {
    id,
    especie: esp,
    tipos: esp.tipos.slice(),
    nivel,
    stats,
    hp: opts.hp ?? stats.hp,
    hpMax: stats.hp,
    exp: opts.exp ?? totalParaNivel(nivel, esp.crescimento),
    crescimento: esp.crescimento,
    golpes: montarGolpes(esp, nivel),
    pp,
    ppMax: pp,
    cdBasico: 0,
    furia: false,
    estagioAtk: 0,
    estagioPrecisao: 0,
    estagioEvasao: 0,
    shiny: !!opts.shiny,
    faccao: opts.faccao,
    x: opts.x,
    y: opts.y,
    z: opts.z,
    elevacao: opts.z,
    vx: 0,
    vy: 0,
    dirX: 0,
    dirY: 1,
    andando: false,
    noChao: true,
    pulando: false,
    vz: 0,
    hopLift: 0,
    animT: 0,
    pose: "Idle",
    poseAte: 0,
    poseSeguinte: "",
    morto: false,
    morreuEm: 0,
    mortoAte: 0,
    desmaioEm: 0,
    capturado: false,
    efemero: !!opts.efemero,
    hostil: !!opts.hostil,
    agroPersistente: !!opts.agroPersistente,
    prefereParty: !!opts.prefereParty,
    casaX: opts.casaX ?? opts.x,
    casaY: opts.casaY ?? opts.y,
    casaZ: opts.casaZ ?? opts.z,
    raioTerritorio: opts.raioTerritorio ?? POKEMON.RAIO_TERRITORIO,
    raioCorpo: RAIO_POKEMON,
    modo: "roam",
    roam: "waiting",
    espera: 0.4,
    metaX: opts.x,
    metaY: opts.y,
    alvo: null,
    avisou: false,
    dormindo: opts.dormindo ?? 0,
    iframe: 0,
    recuoRestante: 0,
    recuoDur: 0,
    recuoDist: 0,
    recuoDirX: 0,
    recuoDirY: 0,
    recuoTrava: 0,
    avancoRestante: 0,
    avancoDur: 0,
    avancoDist: 0,
    avancoDirX: 0,
    avancoDirY: 0,
    esquiva: 0,
    esquivaRestante: 0,
    esquivaDur: 0,
    esquivaDist: 0,
    esquivaDirX: 0,
    esquivaDirY: 0,
    esquivaFase: 0,
    esquivaFaseRestante: 0,
    esquivaFaseDur: 0,
    esquivaInv: false,
    golpeRecRestante: 0,
    golpeRecDur: 0,
    golpeSlot: null,
    golpePose: "",
    golpeClip: 0,
    jatoDur: 0,
    jatoTempo: 0,
    jatoProx: 0,
    jatoFila: 0,
    jatoSlot: null,
    jatoId: 0,
    leadX: 0,
    leadY: 0,
    esquivaLado: 1,
    participantes: new Set(),
    emocao: null,
    emocaoIdade: 0,
    emocaoPresa: false,
    emocaoAte: 0,
    navIdx: 0,
    navVersao: 0,
    presoT: 0,
    ultimoX: opts.x,
    ultimoY: opts.y,
    replanejar: 0,
    velMul: 1,
    velMulAte: 0,
  };
}

export function reviverAtor(ator, x, y, z) {
  ator.morto = false;
  ator.capturado = false;
  ator.morreuEm = 0;
  ator.mortoAte = 0;
  ator.hp = ator.hpMax;
  ator.x = x;
  ator.y = y;
  ator.z = z;
  ator.elevacao = z;
  ator.modo = "roam";
  ator.roam = "waiting";
  ator.espera = 0.6;
  ator.alvo = null;
  ator.participantes = new Set();
  ator.emocao = null;
  ator.emocaoPresa = false;
  ator.pose = "Idle";
  ator.poseSeguinte = "";
  ator.desmaioEm = 0;
  ator.iframe = 0.4;
  ator.dormindo = 0.6;
  ator.recuoRestante = 0;
  ator.recuoDur = 0;
  ator.recuoDist = 0;
  ator.recuoTrava = 0;
  ator.avancoRestante = 0;
  ator.avancoDur = 0;
  ator.avancoDist = 0;
  ator.esquiva = 0;
  ator.esquivaRestante = 0;
  ator.esquivaDur = 0;
  ator.esquivaDist = 0;
  ator.esquivaFase = 0;
  ator.esquivaFaseRestante = 0;
  ator.esquivaFaseDur = 0;
  ator.esquivaInv = false;
  ator.golpeRecRestante = 0;
  ator.golpeRecDur = 0;
  ator.golpeSlot = null;
  ator.golpePose = "";
  ator.golpeClip = 0;
  ator.jatoDur = 0;
  ator.jatoTempo = 0;
  ator.jatoProx = 0;
  ator.jatoFila = 0;
  ator.jatoSlot = null;
  ator.jatoId = 0;
  ator.leadX = 0;
  ator.leadY = 0;
}

export function aplicarNivel(ator, nivelNovo) {
  const antes = ator.hpMax;
  ator.nivel = nivelNovo;
  ator.stats = calcularStats(ator.especie, nivelNovo);
  ator.hpMax = ator.stats.hp;
  ator.hp = Math.min(ator.hpMax, ator.hp + Math.max(0, ator.hpMax - antes));
  ator.golpes = montarGolpes(ator.especie, nivelNovo);
  ator.ppMax = ppMaximo(nivelNovo, ator.stats.velocidade);
  ator.pp = ator.ppMax;
}

export function emRecuo(ator) {
  return (ator?.recuoRestante || 0) > 0 || (ator?.recuoTrava || 0) > 0;
}

export function emAvanco(ator) {
  return (ator?.avancoRestante || 0) > 0;
}

export function emEsquiva(ator) {
  return (ator?.esquivaFase || 0) > 0;
}

/** Janela em que o rolamento não toma tiro. Corpo a corpo ignora isso. */
export function emRolamentoAtivo(ator) {
  return (ator?.esquivaFase || 0) === 2;
}

/** Preparação ou recuperação de um golpe. O corpo não anda. */
export function presoNoGolpe(ator) {
  return (ator?.conjuroRestante || 0) > 0 || (ator?.golpeRecRestante || 0) > 0;
}

function zerarRolamento(ator) {
  ator.esquivaRestante = 0;
  ator.esquivaFase = 0;
  ator.esquivaFaseRestante = 0;
  ator.esquivaFaseDur = 0;
  ator.esquivaInv = false;
}

function integrarRecuo(ator, dt) {
  ator.avancoRestante = 0;
  zerarRolamento(ator);
  if ((ator.recuoTrava || 0) > 0) {
    const gasto = Math.min(ator.recuoTrava, dt);
    ator.recuoTrava -= gasto;
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    dt -= gasto;
    if (dt <= 1e-6 || ator.recuoTrava > 0) return;
  }
  const dur = ator.recuoDur || ator.recuoRestante;
  const antes = ator.recuoRestante;
  const depois = Math.max(0, antes - dt);
  const u0 = 1 - antes / dur;
  const u1 = 1 - depois / dur;
  const fatia = (1 - u0) * (1 - u0) - (1 - u1) * (1 - u1);
  const anda = (ator.recuoDist || 0) * Math.max(0, fatia);
  ator.x += (ator.recuoDirX || 0) * anda;
  ator.y += (ator.recuoDirY || 0) * anda;
  const vel = (ator.recuoDist * 2 * Math.max(0, 1 - u0)) / dur;
  ator.vx = (ator.recuoDirX || 0) * vel;
  ator.vy = (ator.recuoDirY || 0) * vel;
  ator.andando = false;
  ator.recuoRestante = depois;
  if (depois > 0) return;
  ator.vx = 0;
  ator.vy = 0;
  if (ator.pose === "Hurt") ator.poseAte = 0;
}

function integrarAvanco(ator, dt) {
  const dur = ator.avancoDur || ator.avancoRestante;
  if (dur <= 0) {
    ator.avancoRestante = 0;
    return;
  }
  const antes = ator.avancoRestante;
  const depois = Math.max(0, antes - dt);
  const u0 = 1 - antes / dur;
  const u1 = 1 - depois / dur;
  const fatia = (1 - u0) * (1 - u0) - (1 - u1) * (1 - u1);
  const anda = (ator.avancoDist || 0) * Math.max(0, fatia);
  ator.x += (ator.avancoDirX || 0) * anda;
  ator.y += (ator.avancoDirY || 0) * anda;
  const vel = (ator.avancoDist * 2 * Math.max(0, 1 - u0)) / dur;
  ator.vx = (ator.avancoDirX || 0) * vel;
  ator.vy = (ator.avancoDirY || 0) * vel;
  ator.andando = false;
  ator.avancoRestante = depois;
  if (depois > 0) return;
  ator.vx = 0;
  ator.vy = 0;
}

const FASE_PREP = 1;
const FASE_ATIVA = 2;
const FASE_REC = 3;

function durFaseRolamento(fase) {
  if (fase === FASE_PREP) return ESQUIVA_PREP;
  if (fase === FASE_ATIVA) return ESQUIVA_ATIVA;
  return ESQUIVA_REC;
}

function distFaseRolamento(fase) {
  if (fase === FASE_PREP) return ESQUIVA_DIST * 0.07;
  if (fase === FASE_ATIVA) return ESQUIVA_DIST * 0.8;
  return ESQUIVA_DIST * 0.13;
}

function restanteRolamento(fase, faseRestante) {
  let t = faseRestante;
  for (let f = fase + 1; f <= FASE_REC; f++) t += durFaseRolamento(f);
  return t;
}

function aplicarFatiaRolamento(ator, fase, antes, depois, dur) {
  const u0 = dur > 0 ? 1 - antes / dur : 1;
  const u1 = dur > 0 ? 1 - depois / dur : 1;
  const fatia = (1 - u0) * (1 - u0) - (1 - u1) * (1 - u1);
  const dist = distFaseRolamento(fase);
  const anda = dist * Math.max(0, fatia);
  const dx = ator.esquivaDirX || 0;
  const dy = ator.esquivaDirY || 0;
  ator.x += dx * anda;
  ator.y += dy * anda;
  const vel = dur > 0 ? (dist * 2 * Math.max(0, 1 - u0)) / dur : 0;
  ator.vx = dx * vel;
  ator.vy = dy * vel;
  ator.andando = false;
  ator.esquivaInv = fase === FASE_ATIVA;
  const pulo = fase === FASE_ATIVA ? 0.36 : fase === FASE_PREP ? 0.05 : 0.1;
  ator.hopLift = Math.max(ator.hopLift || 0, pulo);
}

function integrarEsquiva(ator, dt) {
  let sobra = dt;
  for (let i = 0; i < 3 && sobra > 1e-6; i++) {
    const fase = ator.esquivaFase || 0;
    if (fase < FASE_PREP || fase > FASE_REC) {
      zerarRolamento(ator);
      return;
    }
    const dur = ator.esquivaFaseDur || durFaseRolamento(fase);
    const antes = ator.esquivaFaseRestante;
    const gasto = Math.min(antes, sobra);
    const depois = antes - gasto;
    aplicarFatiaRolamento(ator, fase, antes, depois, dur);
    sobra -= gasto;
    if (depois > 1e-5) {
      ator.esquivaFaseRestante = depois;
      ator.esquivaRestante = restanteRolamento(fase, depois);
      return;
    }
    if (fase >= FASE_REC) {
      zerarRolamento(ator);
      ator.vx = 0;
      ator.vy = 0;
      return;
    }
    const prox = fase + 1;
    ator.esquivaFase = prox;
    ator.esquivaFaseDur = durFaseRolamento(prox);
    ator.esquivaFaseRestante = ator.esquivaFaseDur;
    ator.esquivaRestante = restanteRolamento(prox, ator.esquivaFaseRestante);
  }
}

/** Passo curto para o alvo. O primeiro pedaço sai no quadro do golpe. */
export function comecarAvanco(ator, dirX, dirY, dist) {
  ator.avancoDur = 0.14;
  ator.avancoRestante = 0.14;
  ator.avancoDist = dist;
  ator.avancoDirX = dirX;
  ator.avancoDirY = dirY;
  integrarAvanco(ator, 0.05);
}

/** Rolamento. A barra gasta na hora. A preparação do golpe não deixa sair. */
export function comecarEsquiva(ator, dirX, dirY) {
  if (!ator || (ator.esquiva || 0) < 1) return false;
  if (emRecuo(ator) || emAvanco(ator) || emEsquiva(ator)) return false;
  if ((ator.conjuroRestante || 0) > 0 || (ator.jatoDur || 0) > 0) return false;
  const rec = ator.golpeRecRestante || 0;
  const recDur = ator.golpeRecDur || 0;
  if (rec > 0 && rec > recDur * 0.55) return false;
  const len = Math.hypot(dirX, dirY) || 1;
  ator.esquiva = 0;
  ator.golpeRecRestante = 0;
  ator.golpeSlot = null;
  ator.golpePose = "";
  ator.golpeClip = 0;
  ator.poseSeguinte = "";
  ator.esquivaFase = FASE_PREP;
  ator.esquivaFaseDur = ESQUIVA_PREP;
  ator.esquivaFaseRestante = ESQUIVA_PREP;
  ator.esquivaDur = ESQUIVA_DUR;
  ator.esquivaRestante = ESQUIVA_DUR;
  ator.esquivaDist = ESQUIVA_DIST;
  ator.esquivaDirX = dirX / len;
  ator.esquivaDirY = dirY / len;
  ator.esquivaInv = false;
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
  if (ator.pose === "Attack" || ator.pose === "Shoot" || ator.pose === "Strike") ator.poseAte = 0;
  return true;
}

export function passoEsquiva(ator, dt) {
  integrarEsquiva(ator, dt);
}

function emMovimento(ator) {
  return !!(ator.andando || emEsquiva(ator) || (ator.avancoRestante || 0) > 0);
}

export function recarregarBarraEsquiva(ator, dt) {
  if (!ator || emEsquiva(ator)) return;
  const vel = Math.max(1, ator.stats?.velocidade || 50);
  const cheia = Math.min(9, Math.max(1.6, 6.2 * (50 / vel)));
  const ritmo = ator.andando ? 1.25 : 1;
  ator.esquiva = Math.min(1, (ator.esquiva || 0) + (dt / cheia) * 5 * ritmo);
}

export function tickPassivo(ator, dt, agora) {
  if (ator.hopLift > 0) ator.hopLift = Math.max(0, ator.hopLift - dt * 3.2);
  if (ator.iframe > 0) ator.iframe = Math.max(0, ator.iframe - dt);
  if ((ator.recuoRestante || 0) > 0) integrarRecuo(ator, dt);
  else if ((ator.avancoRestante || 0) > 0) integrarAvanco(ator, dt);
  else if (emEsquiva(ator)) integrarEsquiva(ator, dt);
  if (ator.velMulAte > 0 && agora >= ator.velMulAte) {
    ator.velMul = 1;
    ator.velMulAte = 0;
  }
  if (ator.morto || ator.capturado) {
    ator.andando = false;
    return;
  }
  let regen = (1 / 10) * (1 / escalaRecarga(ator.stats.velocidade));
  if (emMovimento(ator)) regen += 1;
  ator.pp = Math.min(ator.ppMax, ator.pp + regen * dt);
  recarregarBarraEsquiva(ator, dt);
  if (ator.cdBasico > 0) ator.cdBasico = Math.max(0, ator.cdBasico - dt);
  ator.animT += dt;
}

export function velocidadeDe(ator, correndo) {
  const base = correndo ? POKEMON.VEL_AGRO : POKEMON.VEL_ROAM;
  return base * escalaVelocidade(ator.stats.velocidade) * (ator.velMul || 1);
}

export function recargaDe(ator, segundos) {
  return segundos * escalaRecarga(ator.stats.velocidade);
}

export function recargaDoGolpe(ator, def) {
  let segundos = def?.recarga || 4;
  if (def?.forma === "projectile" || def?.forma === "arc") segundos *= 0.7;
  return recargaDe(ator, segundos);
}
