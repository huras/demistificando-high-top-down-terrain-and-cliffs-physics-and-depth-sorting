import { POKEMON, RAIO_POKEMON } from "../config.js";
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
  pp: 0,
  recarga: 0.55,
  alcance: 1.15,
  vel: 0,
  raio: 0.4,
});

export function golpeBasico() {
  return BASICO;
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

/** A arena testa um golpe só. Sem chave, fica a Investida. */
export function equiparGolpe(ator, chave) {
  if (!ator) return;
  if (!chave) {
    ator.golpes = [];
    return;
  }
  const def = golpe(chave);
  ator.golpes = def ? [{ chave: def.key, cd: 0, def }] : [];
}

export function ppMaximo(nivel, velocidade) {
  const speBonus = Math.round(((velocidade || 50) - 50) * 0.06);
  return Math.max(8, Math.round(20 + nivel * 0.25 + speBonus));
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
    hopLift: 0,
    animT: 0,
    pose: "Idle",
    poseAte: 0,
    morto: false,
    morreuEm: 0,
    mortoAte: 0,
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
  ator.iframe = 0.4;
  ator.dormindo = 0.6;
  ator.recuoRestante = 0;
  ator.recuoDur = 0;
  ator.recuoDist = 0;
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
  return (ator?.recuoRestante || 0) > 0;
}

function integrarRecuo(ator, dt) {
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

export function tickPassivo(ator, dt, agora) {
  if (ator.hopLift > 0) ator.hopLift = Math.max(0, ator.hopLift - dt * 3.2);
  if (ator.iframe > 0) ator.iframe = Math.max(0, ator.iframe - dt);
  if ((ator.recuoRestante || 0) > 0) integrarRecuo(ator, dt);
  if (ator.velMulAte > 0 && agora >= ator.velMulAte) {
    ator.velMul = 1;
    ator.velMulAte = 0;
  }
  if (ator.morto || ator.capturado) {
    ator.andando = false;
    return;
  }
  const regen = (1 / 10) * (1 / escalaRecarga(ator.stats.velocidade));
  ator.pp = Math.min(ator.ppMax, ator.pp + regen * dt);
  if (ator.cdBasico > 0) ator.cdBasico = Math.max(0, ator.cdBasico - dt);
  for (let i = 0; i < ator.golpes.length; i++) {
    const g = ator.golpes[i];
    if (g.cd > 0) g.cd = Math.max(0, g.cd - dt);
  }
  ator.animT += dt;
}

export function velocidadeDe(ator, correndo) {
  const base = correndo ? POKEMON.VEL_AGRO : POKEMON.VEL_ROAM;
  return base * escalaVelocidade(ator.stats.velocidade) * (ator.velMul || 1);
}

export function recargaDe(ator, segundos) {
  return segundos * escalaRecarga(ator.stats.velocidade);
}
