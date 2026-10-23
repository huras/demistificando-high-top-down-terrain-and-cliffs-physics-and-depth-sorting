/**
 * Passeio burro: rumo à cidade, desvia de árvore, escala parede.
 * Sem A*, sem rota na estrada — stress test do mapa.
 */
import { AGENTE_DIST_PARAR, RAIO_CORPO } from "../config.js";
import { atualizarMovimentoDirecionado } from "../fisica/movimento.js";
import { discoInvasor } from "../fisica/obstaculos.js";
import { deLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, CENTRO_AREA } from "../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../mundo/regiao/kantoCidades.js";
import { definirInvulneravel } from "../pokemon/sistema.js";

const CHAVES = ["pallet-town", "viridian", "pewter", "celadon", "lavender", "fuchsia", "cinnabar"];
const ORDEM = CHAVES.map((key) => CIDADES_KANTO.find((cidade) => cidade.key === key));
/** Chegada folgada — só precisa chegar perto do centro. */
const CHEGADA = 10;
const SONDA = 1.45;
const FOLGA_DISCO = RAIO_CORPO + 0.14;

let ativo = false;
let indice = 0;
let destinoNome = "";
let botao = null;
let ladoDesvio = 1;
let stuckT = 0;
let stuckX = 0;
let stuckY = 0;

function centro(cidade) {
  return deLocalKanto(cidade.ax * AREA_KANTO + CENTRO_AREA, cidade.ay * AREA_KANTO + CENTRO_AREA);
}

function metaAtual() {
  return centro(ORDEM[indice]);
}

function escreverBotao() {
  if (!botao) return;
  botao.setAttribute("aria-pressed", ativo ? "true" : "false");
  if (!ativo) botao.textContent = "Passeio";
  else botao.textContent = `Passeio: ${destinoNome}`;
}

function escolherInicio(corpo) {
  let melhor = 0;
  let melhorD = Infinity;
  for (let i = 0; i < ORDEM.length; i++) {
    const c = centro(ORDEM[i]);
    const d = Math.hypot(c.x - corpo.x, c.y - corpo.y);
    if (d < melhorD) {
      melhorD = d;
      melhor = i;
    }
  }
  indice = melhorD < 70 ? (melhor + 1) % ORDEM.length : melhor;
  destinoNome = ORDEM[indice].nome;
}

function discoNaFrente(x, y, z, ux, uy, dist = SONDA) {
  return discoInvasor(x + ux * dist, y + uy * dist, z, FOLGA_DISCO);
}

/**
 * Rumo à cidade; se tem disco à frente, empurra pro lado (sticky).
 */
function rumoComDesvio(corpo, meta) {
  let dx = meta.x - corpo.x;
  let dy = meta.y - corpo.y;
  const dist = Math.hypot(dx, dy) || 1;
  let ux = dx / dist;
  let uy = dy / dist;
  const z = corpo.elevacao ?? corpo.z ?? 0;

  const bloqueio =
    discoNaFrente(corpo.x, corpo.y, z, ux, uy, 0.9) ||
    discoNaFrente(corpo.x, corpo.y, z, ux, uy, SONDA);
  if (!bloqueio) return { dx: ux, dy: uy };

  const px = -uy;
  const py = ux;
  const lados = [ladoDesvio, -ladoDesvio];
  for (let s = 0; s < lados.length; s++) {
    const lx = ux + px * 1.15 * lados[s];
    const ly = uy + py * 1.15 * lados[s];
    const len = Math.hypot(lx, ly) || 1;
    const nx = lx / len;
    const ny = ly / len;
    if (!discoNaFrente(corpo.x, corpo.y, z, nx, ny, SONDA)) {
      ladoDesvio = lados[s];
      return { dx: nx, dy: ny };
    }
  }
  // Ambos lados tapados: força lateral puro pra sair do aperto.
  ladoDesvio *= -1;
  return { dx: px * ladoDesvio, dy: py * ladoDesvio };
}

function avancarCidadeSeChegou(corpo) {
  const meta = metaAtual();
  const d = Math.hypot(meta.x - corpo.x, meta.y - corpo.y);
  if (d > Math.max(CHEGADA, AGENTE_DIST_PARAR)) return;
  indice = (indice + 1) % ORDEM.length;
  destinoNome = ORDEM[indice].nome;
  stuckT = 0;
  escreverBotao();
}

function tickStuck(corpo, dt) {
  const avanco = Math.hypot(corpo.x - stuckX, corpo.y - stuckY);
  if (avanco >= 0.5) {
    stuckT = 0;
    stuckX = corpo.x;
    stuckY = corpo.y;
    return;
  }
  stuckT += dt;
  if (stuckT >= 1.1) {
    ladoDesvio *= -1;
    stuckT = 0;
    stuckX = corpo.x;
    stuckY = corpo.y;
  }
}

export function passeioAtivo() {
  return ativo;
}

/** Cidade-alvo — stream carrega o rumo à frente. */
export function focoPasseio() {
  if (!ativo) return null;
  const meta = metaAtual();
  return { x: meta.x, y: meta.y, z: 0 };
}

export function alternarPasseio(corpo) {
  if (ativo) {
    ativo = false;
    corpo.invulneravel = false;
    definirInvulneravel(false);
    corpo.vx = 0;
    corpo.vy = 0;
    corpo.correndo = false;
    escreverBotao();
    return;
  }
  ativo = true;
  corpo.invulneravel = true;
  definirInvulneravel(true);
  const max = corpo.staminaMax || 100;
  corpo.stamina = max;
  ladoDesvio = 1;
  stuckT = 0;
  stuckX = corpo.x;
  stuckY = corpo.y;
  escolherInicio(corpo);
  escreverBotao();
}

export function atualizarPasseio(corpo, dt) {
  if (!ativo) return;

  // Vida já via invulneravel; stamina nunca acaba (escala / nado).
  const max = corpo.staminaMax || 100;
  corpo.stamina = max;
  corpo.invulneravel = true;

  avancarCidadeSeChegou(corpo);
  const meta = metaAtual();
  const rumo = rumoComDesvio(corpo, meta);
  tickStuck(corpo, dt);

  atualizarMovimentoDirecionado(corpo, rumo.dx, rumo.dy, dt, {
    correndo: true,
    autoEscalar: true,
    podeSoltarEscala: false,
    apertouPulo: false,
    querEscalar: false,
  });
}

export function ligarBotaoPasseio(el, corpo) {
  botao = el;
  el.addEventListener("click", () => alternarPasseio(corpo));
  escreverBotao();
}
