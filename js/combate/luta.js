import { criarAtor, emRecuo, equiparGolpe, tickPassivo, velocidadeDe } from "../pokemon/ator.js";
import { impactoProjetil, tentarGolpe } from "../pokemon/combate/executor.js";
import { limparParticulas, rajada, rastro, tickParticulas } from "../pokemon/combate/particulas.js";
import { atualizarProjeteis, limparProjeteis, projeteisVivos } from "../pokemon/combate/projeteis.js";
import { tickEmocoes } from "../pokemon/emocoes.js";
import { flutuar, limparFlutuantes, tickFlutuantes } from "../pokemon/flutuantes.js";
import { montarGrade } from "../pokemon/grade.js";
import { tickVisual } from "../pokemon/sprites.js";

const RAIO_ARENA = 9.2;
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
  if (item.tipo === "cura") {
    registrar({ tipo: "cura", ...sujeito(item.ator), ganho: item.ganho });
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

function limitar(ator) {
  const d = Math.hypot(ator.x, ator.y);
  if (d <= RAIO_ARENA) return;
  const k = RAIO_ARENA / d;
  ator.x *= k;
  ator.y *= k;
}

function postura(ator) {
  const g = ator.golpes[0];
  if (!g || (g.def.pp || 1) > ator.pp) {
    return { forma: "contact", alcance: 1.05, poder: 18 };
  }
  return g.def;
}

function paradaDe(def) {
  if (!def || def.forma === "contact") {
    const alcance = Math.max(0.9, def?.alcance || 1.05);
    return Math.min(alcance * 0.85, Math.max(0.8, alcance - 0.15));
  }
  if ((def.poder || 0) <= 0) return 2.8;
  const alcance = Math.max(0.6, def.alcance || 1);
  if (def.forma === "radius") {
    const raio = Math.max(2.2, alcance);
    return Math.min(4.2, Math.min(raio - 0.25, Math.max(1.55, raio * 0.7)));
  }
  const dentro = Math.min(alcance * 0.72, 4.4);
  if (alcance <= 1.35) return Math.max(0.7, dentro);
  return Math.min(dentro, Math.max(1.55, Math.min(alcance * 0.45, 4.4)));
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
  if (emRecuo(ator)) {
    ator.andando = false;
    return;
  }
  const def = postura(ator);
  const parada = paradaDe(def);
  const folga = 0.18;
  let sentido = 0;
  if (d > parada + folga) sentido = 1;
  else if (d < parada - folga && def.forma !== "contact") sentido = -1;
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
  limitar(ator);
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
  equiparGolpe(ator, entrada.golpe || "");
  apresentar(ator);
  return ator;
}

function limparCampo() {
  limparProjeteis();
  limparParticulas();
  limparFlutuantes();
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
    avancar(esquerda, bx, by, passo);
    avancar(direita, ax, ay, passo);
    esquerda.alvo = direita;
    direita.alvo = esquerda;
  }

  tickPassivo(esquerda, passo, agora);
  tickPassivo(direita, passo, agora);
  limitar(esquerda);
  limitar(direita);

  if (lutando) {
    montarGrade(par);
    esquerda.recuoNoTick = esquerda.recuoRestante || 0;
    direita.recuoNoTick = direita.recuoRestante || 0;
    tentarGolpe(esquerda, agora, efeitos);
    tentarGolpe(direita, agora, efeitos);
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
