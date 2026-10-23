import { AGENTE_DIST_PARAR, RAIO_CORPO, VELOCIDADE_SPRINT } from "../config.js";
import { atualizarAgente, garantirCorpoLocomocao, resetarNav } from "../fisica/agente.js";
import { centroNaBase, invadeDisco } from "../fisica/obstaculos.js";
import { alturaEm } from "../mundo/altura.js";
import { deLocalKanto } from "../mundo/bounds.js";
import { ehCaminhoKanto } from "../mundo/regiao/amostraKanto.js";
import { AREA_KANTO, CENTRO_AREA } from "../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../mundo/regiao/kantoCidades.js";
import { MEIA_LARGURA_ESTRADA } from "../mundo/regiao/linhasEstrada.js";
import { PERFIL_COMPANHEIRO } from "../navegacao/perfilMovimento.js";
import { definirInvulneravel } from "../pokemon/sistema.js";

const CHAVES = ["pallet-town", "viridian", "pewter", "celadon", "lavender", "fuchsia", "cinnabar"];
const ORDEM = CHAVES.map((key) => CIDADES_KANTO.find((cidade) => cidade.key === key));
const PASSO_REDE = 36;
const CHEGADA = 4;
/** Meta ao norte da praça (quadro/correio ficam a sul do cruzamento). */
const FOLGA_PRACA = 5;
/**
 * Só dentro da faixa. A praça tapa o miolo; ~3u passa na beira do asfalto
 * (poste ± quadro). Além disso = mato/árvore.
 */
const MAX_LATERAL = MEIA_LARGURA_ESTRADA - RAIO_CORPO - 0.15;
const DESVIOS = [0, 2.1, -2.1, 2.6, -2.6, MAX_LATERAL, -MAX_LATERAL];
const PASSO_CORREDOR = 1.25;
const MAX_FALHAS = 10;
const STUCK_SEG = 0.9;
const STUCK_MIN_AVANCO = 0.55;

const fantasma = { x: 0, y: 0, z: 1, elevacao: 1, correndo: true };

let ativo = false;
let quebrado = false;
let indice = 0;
let alvo = null;
let origemNome = "";
let destinoNome = "";
let cidadeDoAlvo = -1;
let botao = null;
let falhasSeguidas = 0;
let ladoDesvio = 1;
let indiceDesvio = 0;
let versaoFalha = -1;
let cooldownFalha = 0;
let stuckT = 0;
let stuckX = 0;
let stuckY = 0;

function centro(cidade) {
  return deLocalKanto(
    cidade.ax * AREA_KANTO + CENTRO_AREA,
    cidade.ay * AREA_KANTO + CENTRO_AREA - FOLGA_PRACA,
  );
}

function zDoPonto(x, y, fallback) {
  const solido = alturaEm(x, y);
  if (solido > 0) return solido;
  return fallback ?? 1;
}

function pontoLivre(x, y, zHint) {
  if (!ehCaminhoKanto(x, y)) return false;
  const z = zDoPonto(x, y, zHint);
  if (centroNaBase(Math.floor(x), Math.floor(y), z)) return false;
  if (invadeDisco(x, y, z, RAIO_CORPO + 0.12)) return false;
  return true;
}

/** Amostra o segmento (pula a origem: corpo pode já estar encostado na placa). */
function corredorLivre(ax, ay, bx, by, zHint) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return pontoLivre(bx, by, zHint);
  const n = Math.max(1, Math.ceil(dist / PASSO_CORREDOR));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!pontoLivre(ax + dx * t, ay + dy * t, zHint)) return false;
  }
  return true;
}

/** Se já tá na placa, sai pela beira da rua — nunca pro mato. */
function escaparDisco(x, y, z, dirX, dirY) {
  if (pontoLivre(x, y, z)) return null;
  const len = Math.hypot(dirX, dirY) || 1;
  const px = -dirY / len;
  const py = dirX / len;
  const lados = [ladoDesvio, -ladoDesvio];
  for (let L = 1.8; L <= MAX_LATERAL + 0.05; L += 0.55) {
    for (let s = 0; s < lados.length; s++) {
      const tx = x + px * L * lados[s];
      const ty = y + py * L * lados[s];
      if (pontoLivre(tx, ty, z) && corredorLivre(x, y, tx, ty, z)) {
        return { x: tx, y: ty, lateral: L * lados[s] };
      }
    }
  }
  return null;
}

/**
 * Contorna a praça na faixa: ombro com corredor livre.
 * Sem anel radial — isso era o que mandava pra árvore.
 */
function escolherContorno(deX, deY, brutoX, brutoY, z, dirX, dirY, comecaEm = 0) {
  const len = Math.hypot(dirX, dirY) || 1;
  const px = -dirY / len;
  const py = dirX / len;
  const ordem = [];
  const inicio = Math.max(0, Math.min(comecaEm, DESVIOS.length - 1));
  for (let pass = 0; pass < 2; pass++) {
    const a = pass === 0 ? inicio : 0;
    const b = pass === 0 ? DESVIOS.length : inicio;
    for (let i = a; i < b; i++) {
      const d = DESVIOS[i];
      ordem.push(d === 0 ? 0 : d * ladoDesvio);
      if (d !== 0) ordem.push(d * -ladoDesvio);
    }
  }
  const vistos = new Set();
  for (let i = 0; i < ordem.length; i++) {
    let lateral = ordem[i];
    if (Math.abs(lateral) > MAX_LATERAL) lateral = Math.sign(lateral) * MAX_LATERAL;
    const chave = lateral.toFixed(2);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const x = brutoX + px * lateral;
    const y = brutoY + py * lateral;
    if (!pontoLivre(x, y, z)) continue;
    if (!corredorLivre(deX, deY, x, y, z)) continue;
    return { x, y, lateral };
  }
  return null;
}

/**
 * Praça bloqueia o miolo: quebra o avanço em ombro → passa a praça → meta.
 * Só no trecho perto da cidade (não desvia a rota inteira pro acostamento).
 */
function alvoContornoPraca(corpo, meta, zHint) {
  const dx = meta.x - corpo.x;
  const dy = meta.y - corpo.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return null;
  if (corredorLivre(corpo.x, corpo.y, meta.x, meta.y, zHint)) return null;
  // Longe ainda: segue no eixo; o bloqueio da praça só importa perto.
  if (dist > PASSO_REDE * 1.6) return null;

  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy;
  const py = ux;
  const lados = [ladoDesvio, -ladoDesvio];

  // 1) Ombro antes da praça (recuo no rumo).
  for (let recuo = 6; recuo >= 2; recuo -= 2) {
    const bx = meta.x - ux * (FOLGA_PRACA + recuo);
    const by = meta.y - uy * (FOLGA_PRACA + recuo);
    for (let L = 2.2; L <= MAX_LATERAL + 0.05; L += 0.45) {
      for (let s = 0; s < lados.length; s++) {
        const x = bx + px * L * lados[s];
        const y = by + py * L * lados[s];
        if (!pontoLivre(x, y, zHint)) continue;
        if (!corredorLivre(corpo.x, corpo.y, x, y, zHint)) continue;
        return { x, y, lateral: L * lados[s] };
      }
    }
  }

  // 2) Ombro na altura da meta (já passou / ao lado da praça).
  for (let L = 2.2; L <= MAX_LATERAL + 0.05; L += 0.45) {
    for (let s = 0; s < lados.length; s++) {
      const x = meta.x + px * L * lados[s];
      const y = meta.y + py * L * lados[s];
      if (!pontoLivre(x, y, zHint)) continue;
      if (!corredorLivre(corpo.x, corpo.y, x, y, zHint)) continue;
      return { x, y, lateral: L * lados[s] };
    }
  }
  return null;
}

function escreverBotao() {
  if (!botao) return;
  botao.setAttribute("aria-pressed", ativo ? "true" : "false");
  if (!ativo) botao.textContent = "Passeio";
  else if (quebrado) botao.textContent = `Sem caminho: ${origemNome} → ${destinoNome}`;
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
}

function guardarRumo(corpo) {
  const rx = corpo.nav?.rumoX || 0;
  const ry = corpo.nav?.rumoY || 0;
  return { rx, ry };
}

function restaurarRumo(corpo, rumo) {
  if (!corpo.nav || (!rumo.rx && !rumo.ry)) return;
  corpo.nav.rumoX = rumo.rx;
  corpo.nav.rumoY = rumo.ry;
}

function aplicarAlvo(corpo, x, y, z, resetar) {
  alvo = { x, y, z };
  fantasma.x = x;
  fantasma.y = y;
  fantasma.z = z;
  fantasma.elevacao = z;
  fantasma.correndo = true;
  stuckT = 0;
  stuckX = corpo.x;
  stuckY = corpo.y;
  if (resetar) {
    const rumo = guardarRumo(corpo);
    resetarNav(corpo);
    restaurarRumo(corpo, rumo);
  }
}

function prepararAlvo(corpo, forcarDesvio = false) {
  const destino = ORDEM[indice];
  const origem = ORDEM[(indice + ORDEM.length - 1) % ORDEM.length];
  const meta = centro(destino);
  const dx = meta.x - corpo.x;
  const dy = meta.y - corpo.y;
  const dist = Math.hypot(dx, dy);
  origemNome = origem.nome;
  destinoNome = destino.nome;
  if (dist <= CHEGADA) {
    indice = (indice + 1) % ORDEM.length;
    falhasSeguidas = 0;
    indiceDesvio = 0;
    versaoFalha = -1;
    prepararAlvo(corpo);
    return;
  }

  const zCorpo = zDoPonto(corpo.x, corpo.y, corpo.elevacao ?? corpo.z);
  const fuga = escaparDisco(corpo.x, corpo.y, zCorpo, dx, dy);
  if (fuga) {
    if (fuga.lateral !== 0) ladoDesvio = Math.sign(fuga.lateral) || ladoDesvio;
    cidadeDoAlvo = indice;
    aplicarAlvo(corpo, fuga.x, fuga.y, zDoPonto(fuga.x, fuga.y, zCorpo), true);
    escreverBotao();
    return;
  }

  // Perto da cidade com praça no caminho: ombro na faixa, não acostamento.
  const desvioPraca = alvoContornoPraca(corpo, meta, zCorpo);
  if (desvioPraca && !forcarDesvio) {
    if (desvioPraca.lateral !== 0) ladoDesvio = Math.sign(desvioPraca.lateral) || ladoDesvio;
    const mudouCidade = cidadeDoAlvo !== indice;
    cidadeDoAlvo = indice;
    aplicarAlvo(
      corpo,
      desvioPraca.x,
      desvioPraca.y,
      zDoPonto(desvioPraca.x, desvioPraca.y, zCorpo),
      mudouCidade,
    );
    escreverBotao();
    return;
  }

  const passo = Math.min(PASSO_REDE, dist);
  const t = passo / dist;
  const brutoX = corpo.x + dx * t;
  const brutoY = corpo.y + dy * t;
  const z = zDoPonto(brutoX, brutoY, zCorpo);

  if (forcarDesvio) {
    indiceDesvio = Math.max(1, (indiceDesvio + 1) % DESVIOS.length);
    if (indiceDesvio === 1) ladoDesvio *= -1;
  }

  const livre = escolherContorno(
    corpo.x,
    corpo.y,
    brutoX,
    brutoY,
    z,
    dx,
    dy,
    forcarDesvio ? Math.max(1, indiceDesvio) : 0,
  );

  if (!livre) {
    // Fica no eixo da rua; stuck/semCaminho tenta o outro ombro depois.
    const mudouCidade = cidadeDoAlvo !== indice;
    cidadeDoAlvo = indice;
    aplicarAlvo(corpo, brutoX, brutoY, z, mudouCidade || forcarDesvio);
    escreverBotao();
    return;
  }

  if (livre.lateral !== 0) ladoDesvio = Math.sign(livre.lateral) || ladoDesvio;
  const mudouCidade = cidadeDoAlvo !== indice;
  cidadeDoAlvo = indice;
  aplicarAlvo(corpo, livre.x, livre.y, zDoPonto(livre.x, livre.y, z), mudouCidade || forcarDesvio);
  escreverBotao();
}

function chegouNoAlvo(corpo) {
  if (!alvo) return false;
  return Math.hypot(alvo.x - corpo.x, alvo.y - corpo.y) <= Math.max(CHEGADA, AGENTE_DIST_PARAR);
}

function registrarStuck(corpo, dt) {
  const avanco = Math.hypot(corpo.x - stuckX, corpo.y - stuckY);
  if (avanco >= STUCK_MIN_AVANCO) {
    stuckT = 0;
    stuckX = corpo.x;
    stuckY = corpo.y;
    return false;
  }
  stuckT += dt;
  return stuckT >= STUCK_SEG;
}

function contornarFalha(corpo) {
  falhasSeguidas += 1;
  if (falhasSeguidas >= MAX_FALHAS) {
    quebrado = true;
    corpo.vx = 0;
    corpo.vy = 0;
    corpo.vz = 0;
    escreverBotao();
    return;
  }
  cooldownFalha = 0.45;
  prepararAlvo(corpo, true);
}

export function passeioAtivo() {
  return ativo;
}

/** Alvo atual do passeio — pra stream carregar o trecho à frente. */
export function focoPasseio() {
  if (!ativo || !alvo) return null;
  return { x: alvo.x, y: alvo.y, z: alvo.z };
}

export function alternarPasseio(corpo) {
  if (ativo) {
    ativo = false;
    quebrado = false;
    alvo = null;
    falhasSeguidas = 0;
    indiceDesvio = 0;
    versaoFalha = -1;
    cooldownFalha = 0;
    stuckT = 0;
    corpo.invulneravel = false;
    definirInvulneravel(false);
    resetarNav(corpo);
    corpo.vx = 0;
    corpo.vy = 0;
    corpo.correndo = false;
    cidadeDoAlvo = -1;
    escreverBotao();
    return;
  }
  corpo.id = "jogador";
  garantirCorpoLocomocao(corpo, PERFIL_COMPANHEIRO);
  corpo.invulneravel = true;
  definirInvulneravel(true);
  ativo = true;
  quebrado = false;
  falhasSeguidas = 0;
  indiceDesvio = 0;
  versaoFalha = -1;
  cooldownFalha = 0;
  stuckT = 0;
  ladoDesvio = 1;
  escolherInicio(corpo);
  prepararAlvo(corpo);
}

export function atualizarPasseio(corpo, dt) {
  if (!ativo) return;
  if (quebrado) {
    corpo.vx = 0;
    corpo.vy = 0;
    return;
  }
  if (cooldownFalha > 0) cooldownFalha -= dt;
  if (chegouNoAlvo(corpo)) {
    alvo = null;
    falhasSeguidas = 0;
    versaoFalha = -1;
    prepararAlvo(corpo);
  }
  atualizarAgente(corpo, fantasma, dt, VELOCIDADE_SPRINT);
  const nav = corpo.nav;
  if (nav?.estado === "semCaminho" && cooldownFalha <= 0) {
    const versao = nav.versao ?? 0;
    if (versao !== versaoFalha) {
      versaoFalha = versao;
      contornarFalha(corpo);
    }
    return;
  }
  if (nav?.estado === "seguindo") {
    falhasSeguidas = Math.max(0, falhasSeguidas - 1);
    versaoFalha = -1;
  }
  if (cooldownFalha <= 0 && registrarStuck(corpo, dt)) {
    contornarFalha(corpo);
  }
}

export function ligarBotaoPasseio(el, corpo) {
  botao = el;
  el.addEventListener("click", () => alternarPasseio(corpo));
  escreverBotao();
}
