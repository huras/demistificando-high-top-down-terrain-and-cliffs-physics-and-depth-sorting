import { comecarEsquiva, criarAtor, emAvanco, emEsquiva, emRecuo, equiparGolpes, tickPassivo, velocidadeDe } from "../pokemon/ator.js";
import { cancelarConjuracao, impactoProjetil, tentarGolpe, tickConjuracao } from "../pokemon/combate/executor.js";
import { limparKi } from "../pokemon/combate/ki.js";
import { limparParticulas, poeiraDash, rajada, rastro, tickParticulas } from "../pokemon/combate/particulas.js";
import { atualizarProjeteis, limparProjeteis, projeteisVivos } from "../pokemon/combate/projeteis.js";
import { tickEmocoes } from "../pokemon/emocoes.js";
import { flutuar, limparFlutuantes, tickFlutuantes } from "../pokemon/flutuantes.js";
import { montarGrade } from "../pokemon/grade.js";
import { tickVisual } from "../pokemon/sprites.js";
import { CORREDOR_TIRO, JANELA_TIRO, RAIO_PROJETIL } from "../pokemon/ia/constantes.js";
import { limitarArena, paradaDe, posturaDe, sentidoParada, vaiMelee } from "../pokemon/ia/espaco.js";
import { integrarComando } from "../pokemon/ia/habilidades.js";
import { iaRedeLigada, pensar, reagirEsquiva } from "../pokemon/ia/seletor.js";

export { definirIaRede } from "../pokemon/ia/seletor.js";

const CASA = {
  esquerda: { x: -5.2, y: 0, dirX: 1 },
  direita: { x: 5.2, y: 0, dirX: -1 },
};

const par = [null, null];
const vazio = [];
const cfg = { esquerda: null, direita: null };

let esquerda = null;
let direita = null;
let lutando = false;
let acabou = false;
let vencedor = null;
let agora = 0;
let inicio = 0;
const linhasLog = [];
let versaoLog = 0;
const CAP_LOG = 80;

const estado = {
  lutando: false,
  acabou: false,
  vencedor: null,
  esquerda: null,
  direita: null,
};

function limparLog() {
  linhasLog.length = 0;
  versaoLog++;
}

function registrar(campos) {
  const t = Math.max(0, agora - inicio);
  linhasLog.push({ ...campos, selo: t.toFixed(2).replace(".", ",") });
  if (linhasLog.length > CAP_LOG) linhasLog.shift();
  versaoLog++;
}

function nomeDe(ator) {
  return ator?.especie?.nome || "—";
}

function sujeito(ator) {
  return { lado: ator?.faccao || "", nome: nomeDe(ator) };
}

function anotar(item) {
  if (!item) return;
  if (item.tipo === "golpe") {
    registrar({
      tipo: "golpe",
      ...sujeito(item.ator),
      golpe: item.def?.nome || "golpe",
      tipoGolpe: item.def?.tipo || "",
    });
    return;
  }
  if (item.tipo === "dano") {
    registrar({
      tipo: "dano",
      ...sujeito(item.alvo),
      dano: item.dano,
      efet: item.efet > 1 ? "super" : item.efet < 1 ? "pouco" : "",
      recuo: Number(item.recuo).toFixed(2).replace(".", ","),
      dist: Number(item.dist).toFixed(1).replace(".", ","),
    });
    return;
  }
  if (item.tipo === "imune") {
    registrar({ tipo: "imune", ...sujeito(item.alvo) });
    return;
  }
  if (item.tipo === "erro") {
    registrar({ tipo: "erro", ...sujeito(item.ator) });
    return;
  }
  if (item.tipo === "dodge") {
    registrar({ tipo: "dodge", ...sujeito(item.alvo) });
    return;
  }
  if (item.tipo === "cura") {
    registrar({ tipo: "cura", ...sujeito(item.ator), ganho: item.ganho });
    return;
  }
  if (item.tipo === "ataque") {
    registrar({ tipo: "ataque", ...sujeito(item.alvo), estagio: item.estagio });
    return;
  }
  if (item.tipo === "queda") registrar({ tipo: "queda", ...sujeito(item.alvo) });
}

const efeitos = {
  flutuar,
  anotar,
  aoDerrotar() {},
  aoGolpe(ator, def) {
    const z = (ator.z || 0) + (ator.hopLift || 0) + 2.2;
    rajada(ator.x, ator.y, z, def.tipo, 8, 0.85);
  },
  aoImpacto(alvo, tipo, efet) {
    const z = (alvo.z || 0) + (alvo.hopLift || 0) + 2.2;
    const n = efet > 1 ? 16 : efet < 1 ? 6 : 10;
    const f = efet > 1 ? 1.35 : 1;
    rajada(alvo.x, alvo.y, z, tipo, n, f);
  },
};

function publicar() {
  estado.lutando = lutando;
  estado.acabou = acabou;
  estado.vencedor = vencedor;
  estado.esquerda = esquerda;
  estado.direita = direita;
  par[0] = esquerda;
  par[1] = direita;
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

function ameacaAgora(ator, oponente) {
  if ((ator.esquiva || 0) < 1) return false;
  if (emRecuo(ator) || emAvanco(ator) || emEsquiva(ator)) return false;
  if (vaiMelee(oponente, ator)) return true;
  const tiros = projeteisVivos();
  for (let i = 0; i < tiros.length; i++) {
    if (tiroVem(tiros[i], ator)) return true;
  }
  return false;
}

function tentarEsquiva(ator, dx, dy, d) {
  const lado = ator.esquivaLado || 1;
  ator.esquivaLado = -lado;
  const ok = comecarEsquiva(ator, (-dy / d) * lado, (dx / d) * lado);
  if (!ok) ator.esquivaLado = lado;
  else cancelarConjuracao(ator);
  return ok;
}

function reagirPar(a, b) {
  const ameacaA = ameacaAgora(a, b);
  const ameacaB = ameacaAgora(b, a);
  if (ameacaA) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    tentarEsquiva(a, dx, dy, Math.hypot(dx, dy) || 0.0001);
  }
  if (ameacaB) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    tentarEsquiva(b, dx, dy, Math.hypot(dx, dy) || 0.0001);
  }
}

function avancar(ator, tx, ty, dt) {
  if (ator.morto || ator.capturado) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  const dx = tx - ator.x;
  const dy = ty - ator.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  ator.dirX = dx / d;
  ator.dirY = dy / d;
  if (((ator.conjuroRestante || 0) > 0 || (ator.golpeRecRestante || 0) > 0) && !emAvanco(ator)) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  if (emRecuo(ator) || emAvanco(ator) || emEsquiva(ator)) {
    ator.andando = false;
    return;
  }
  const def = posturaDe(ator);
  if (!def) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  const parada = paradaDe(def);
  const sentido = sentidoParada(d, parada, def.forma);
  if (sentido === 0) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  const vel = velocidadeDe(ator, true);
  let passo = vel * dt;
  if (sentido > 0) passo = Math.min(passo, Math.max(0, d - parada));
  else passo = Math.min(passo, Math.max(0, parada - d));
  if (passo <= 0.0001) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  ator.x += (dx / d) * sentido * passo;
  ator.y += (dy / d) * sentido * passo;
  ator.vx = (dx / d) * sentido * vel;
  ator.vy = (dy / d) * sentido * vel;
  ator.andando = true;
  limitarArena(ator);
}

function apresentar(ator) {
  ator.visual = null;
  tickVisual(ator, 0.016, agora);
}

function montar(lado, entrada) {
  const casa = CASA[lado];
  const esp = entrada.especie;
  const nivel = Math.max(1, entrada.nivel | 0);
  const ator = criarAtor({
    id: lado === "esquerda" ? "arena-esq" : "arena-dir",
    especie: esp,
    nivel,
    faccao: lado,
    x: casa.x,
    y: casa.y,
    z: 0,
    casaX: casa.x,
    casaY: casa.y,
    casaZ: 0,
  });
  ator.dirX = casa.dirX;
  ator.dirY = 0;
  ator.usaCorpo = entrada.usaCorpo !== false;
  ator.usaDistancia = entrada.usaDistancia !== false;
  equiparGolpes(ator, [entrada.corpo, entrada.distancia]);
  apresentar(ator);
  return ator;
}

function limparCampo() {
  limparProjeteis();
  limparParticulas();
  limparFlutuantes();
  limparKi();
}

function soltarPoeiraDash(ator, dt) {
  if (ator.esquivaFase !== 2) {
    ator._poeiraAcum = 0;
    ator._poeiraNoDash = false;
    return;
  }
  const primeiro = !ator._poeiraNoDash;
  ator._poeiraNoDash = true;
  ator._poeiraAcum = (ator._poeiraAcum || 0) + dt;
  if (!primeiro && ator._poeiraAcum < 0.04) return;
  ator._poeiraAcum = 0;
  poeiraDash(ator.x, ator.y, ator.esquivaDirX || 0, ator.esquivaDirY || 0, primeiro);
}

function soltarRastros() {
  const tiros = projeteisVivos();
  for (let i = 0; i < tiros.length; i++) {
    const t = tiros[i];
    if (t.viajou - (t.rastroEm || 0) < 0.28) continue;
    t.rastroEm = t.viajou;
    rastro(t.x, t.y, t.z, t.cor);
  }
}

function aoTiro(p, alvo) {
  impactoProjetil(p, alvo, agora, efeitos);
}

function encerrar() {
  cancelarConjuracao(esquerda);
  cancelarConjuracao(direita);
  lutando = false;
  acabou = true;
  esquerda.alvo = null;
  direita.alvo = null;
  esquerda.vx = 0;
  esquerda.vy = 0;
  esquerda.andando = false;
  direita.vx = 0;
  direita.vy = 0;
  direita.andando = false;
  const esqVivo = esquerda.hp > 0 && !esquerda.morto;
  const dirVivo = direita.hp > 0 && !direita.morto;
  if (esqVivo && !dirVivo) vencedor = "esquerda";
  else if (dirVivo && !esqVivo) vencedor = "direita";
  else vencedor = "empate";
  publicar();
}

export function definirUso(lado, corpo, distancia) {
  const entrada = cfg[lado];
  if (entrada) {
    entrada.usaCorpo = corpo !== false;
    entrada.usaDistancia = distancia !== false;
  }
  const ator = lado === "esquerda" ? esquerda : lado === "direita" ? direita : null;
  if (!ator) return;
  ator.usaCorpo = corpo !== false;
  ator.usaDistancia = distancia !== false;
}

export function montarLados(esqCfg, dirCfg) {
  if (lutando || !esqCfg?.especie || !dirCfg?.especie) return false;
  cfg.esquerda = esqCfg;
  cfg.direita = dirCfg;
  esquerda = montar("esquerda", esqCfg);
  direita = montar("direita", dirCfg);
  lutando = false;
  acabou = false;
  vencedor = null;
  limparCampo();
  publicar();
  return true;
}

export function iniciarLuta() {
  if (lutando || !cfg.esquerda || !cfg.direita) return false;
  if (acabou || !esquerda || !direita || esquerda.morto || direita.morto) {
    esquerda = montar("esquerda", cfg.esquerda);
    direita = montar("direita", cfg.direita);
  }
  limparCampo();
  inicio = agora;
  limparLog();
  acabou = false;
  vencedor = null;
  lutando = true;
  esquerda.alvo = direita;
  direita.alvo = esquerda;
  publicar();
  return true;
}

export function tickLuta(dt) {
  if (!esquerda || !direita) return;
  const passo = Math.min(0.05, dt);
  if (passo <= 0) return;
  agora += passo;

  if (lutando) {
    const ax = esquerda.x;
    const ay = esquerda.y;
    const bx = direita.x;
    const by = direita.y;
    if (iaRedeLigada()) {
      integrarComando(esquerda, direita, passo);
      integrarComando(direita, esquerda, passo);
    } else {
      esquerda.miraX = NaN;
      esquerda.miraY = NaN;
      direita.miraX = NaN;
      direita.miraY = NaN;
      avancar(esquerda, bx, by, passo);
      avancar(direita, ax, ay, passo);
    }
    esquerda.alvo = direita;
    direita.alvo = esquerda;
  }

  tickPassivo(esquerda, passo, agora);
  tickPassivo(direita, passo, agora);
  soltarPoeiraDash(esquerda, passo);
  soltarPoeiraDash(direita, passo);
  limitarArena(esquerda);
  limitarArena(direita);

  if (lutando) {
    montarGrade(par);
    esquerda.recuoNoTick = esquerda.recuoRestante || 0;
    direita.recuoNoTick = direita.recuoRestante || 0;
    const tiros = projeteisVivos();
    if (iaRedeLigada()) {
      pensar(esquerda, direita, passo, tiros);
      pensar(direita, esquerda, passo, tiros);
    } else {
      reagirPar(esquerda, direita);
    }
    tickConjuracao(esquerda, passo, agora, efeitos);
    tickConjuracao(direita, passo, agora, efeitos);
    tentarGolpe(esquerda, agora, efeitos);
    tentarGolpe(direita, agora, efeitos);
    if (iaRedeLigada()) {
      reagirEsquiva(esquerda, direita, tiros);
      reagirEsquiva(direita, esquerda, tiros);
    } else {
      reagirPar(esquerda, direita);
    }
  }
  atualizarProjeteis(passo, lutando ? par : vazio, aoTiro);
  if (lutando && (esquerda.hp <= 0 || direita.hp <= 0)) encerrar();

  soltarRastros();
  tickEmocoes(par, passo);
  tickVisual(esquerda, passo, agora);
  tickVisual(direita, passo, agora);
  tickFlutuantes(passo);
  tickParticulas(passo);
}

export function estadoLuta() {
  return estado;
}

export function logArena() {
  return { linhas: linhasLog, versao: versaoLog };
}

export function atoresArena() {
  return par;
}
