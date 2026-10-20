import { AGENTE_DIST_PARAR, VELOCIDADE_SPRINT } from "../config.js";
import { atualizarAgente, garantirCorpoLocomocao, resetarNav } from "../fisica/agente.js";
import { alturaEm } from "../mundo/altura.js";
import { deLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, CENTRO_AREA } from "../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../mundo/regiao/kantoCidades.js";
import { PERFIL_COMPANHEIRO } from "../navegacao/perfilMovimento.js";
import { definirInvulneravel } from "../pokemon/sistema.js";

const CHAVES = ["pallet-town", "viridian", "pewter", "celadon", "lavender", "fuchsia", "cinnabar"];
const ORDEM = CHAVES.map((key) => CIDADES_KANTO.find((cidade) => cidade.key === key));
const PASSO_REDE = 36;
const CHEGADA = 4;

const fantasma = { x: 0, y: 0, z: 1, elevacao: 1, correndo: true };

let ativo = false;
let quebrado = false;
let indice = 0;
let alvo = null;
let origemNome = "";
let destinoNome = "";
let cidadeDoAlvo = -1;
let botao = null;

function centro(cidade) {
  return deLocalKanto(cidade.ax * AREA_KANTO + CENTRO_AREA, cidade.ay * AREA_KANTO + CENTRO_AREA);
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

function prepararAlvo(corpo) {
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
    prepararAlvo(corpo);
    return;
  }
  const passo = Math.min(PASSO_REDE, dist);
  const t = passo / dist;
  const x = corpo.x + dx * t;
  const y = corpo.y + dy * t;
  const solido = alturaEm(x, y);
  const z = solido > 0 ? solido + 1 : corpo.elevacao ?? corpo.z ?? 1;
  alvo = { x, y, z };
  fantasma.x = x;
  fantasma.y = y;
  fantasma.z = z;
  fantasma.elevacao = z;
  fantasma.correndo = true;
  const mudouCidade = cidadeDoAlvo !== indice;
  cidadeDoAlvo = indice;
  if (mudouCidade) {
    const rumo = guardarRumo(corpo);
    resetarNav(corpo);
    restaurarRumo(corpo, rumo);
  }
  escreverBotao();
}

function chegouNoAlvo(corpo) {
  if (!alvo) return false;
  return Math.hypot(alvo.x - corpo.x, alvo.y - corpo.y) <= Math.max(CHEGADA, AGENTE_DIST_PARAR);
}

export function passeioAtivo() {
  return ativo;
}

export function alternarPasseio(corpo) {
  if (ativo) {
    ativo = false;
    quebrado = false;
    alvo = null;
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
  if (chegouNoAlvo(corpo)) {
    alvo = null;
    prepararAlvo(corpo);
  }
  atualizarAgente(corpo, fantasma, dt, VELOCIDADE_SPRINT);
  if (corpo.nav?.estado === "semCaminho") {
    quebrado = true;
    corpo.vx = 0;
    corpo.vy = 0;
    corpo.vz = 0;
    escreverBotao();
  }
}

export function ligarBotaoPasseio(el, corpo) {
  botao = el;
  el.addEventListener("click", () => alternarPasseio(corpo));
  escreverBotao();
}
