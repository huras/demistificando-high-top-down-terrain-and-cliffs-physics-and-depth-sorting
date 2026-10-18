import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRADAS, OCULTOS } from "../js/pokemon/ia/constantes.js";
import { regua } from "../js/pokemon/ia/espaco.js";
import { observar } from "../js/pokemon/ia/observacao.js";
import { instalarLayout, instalarPesos } from "../js/pokemon/ia/pesos.js";
import { montarLayout, ORDEM, propagar } from "../js/pokemon/ia/rede.js";
import { prepararAmostra, rotulo } from "./rotulo.mjs";
import {
  avaliarAcerto,
  avaliarAproximacao,
  avaliarEsquiva,
  avaliarFuga,
  bancada,
  lutador,
} from "./simulacao.mjs";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const arquivoPesos = path.join(raiz, "..", "js", "pokemon", "ia", "pesos.js");
const { fatia, total } = montarLayout();
const pesos = new Float64Array(total);
const grad = new Float64Array(total);
const cache = {
  pre: new Float64Array(OCULTOS),
  h: new Float64Array(OCULTOS),
  z: new Float64Array(5),
  y: new Float64Array(5),
  dH: new Float64Array(OCULTOS),
};

function mulberry32(semente) {
  let a = semente >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function iniciar(rng) {
  for (let k = 0; k < ORDEM.length; k++) {
    const fat = fatia[ORDEM[k]];
    const e1 = Math.sqrt(2 / (ENTRADAS + OCULTOS)) * 0.85;
    const e2 = Math.sqrt(2 / (OCULTOS + fat.n)) * 0.85;
    for (let i = 0; i < ENTRADAS * OCULTOS; i++) pesos[fat.w1 + i] = gauss(rng) * e1;
    for (let i = 0; i < OCULTOS; i++) pesos[fat.b1 + i] = 0;
    for (let i = 0; i < OCULTOS * fat.n; i++) pesos[fat.w2 + i] = gauss(rng) * e2;
    for (let i = 0; i < fat.n; i++) pesos[fat.b2 + i] = 0;
  }
}

function publicar() {
  instalarLayout(fatia);
  instalarPesos(pesos);
}

function forward(fat, x) {
  const n = fat.n;
  for (let h = 0; h < OCULTOS; h++) {
    let s = pesos[fat.b1 + h];
    const base = fat.w1 + h * ENTRADAS;
    for (let i = 0; i < ENTRADAS; i++) s += pesos[base + i] * x[i];
    cache.pre[h] = s;
    cache.h[h] = Math.tanh(s);
  }
  for (let o = 0; o < n; o++) {
    let s = pesos[fat.b2 + o];
    const base = fat.w2 + o * OCULTOS;
    for (let h = 0; h < OCULTOS; h++) s += pesos[base + h] * cache.h[h];
    cache.z[o] = s;
    cache.y[o] = Math.tanh(s);
  }
}

function acumular(fat, x, alvo) {
  forward(fat, x);
  for (let h = 0; h < OCULTOS; h++) cache.dH[h] = 0;
  for (let o = 0; o < fat.n; o++) {
    const y = cache.y[o];
    const dz = (y - alvo[o]) * (1 - y * y);
    grad[fat.b2 + o] += dz;
    const base = fat.w2 + o * OCULTOS;
    for (let h = 0; h < OCULTOS; h++) {
      grad[base + h] += dz * cache.h[h];
      cache.dH[h] += dz * pesos[base + h];
    }
  }
  for (let h = 0; h < OCULTOS; h++) {
    const dh = cache.dH[h] * (1 - cache.h[h] * cache.h[h]);
    grad[fat.b1 + h] += dh;
    const base = fat.w1 + h * ENTRADAS;
    for (let i = 0; i < ENTRADAS; i++) grad[base + i] += dh * x[i];
  }
}

function clonar(hab, rng, amostras, escalaEpocas) {
  const fat = fatia[hab];
  const n = amostras;
  const lote = 128;
  const x = new Float32Array(n * ENTRADAS);
  const y = new Float32Array(n * fat.n);
  const ator = lutador();
  const alvo = lutador({ faccao: "b" });
  const tiros = [];
  const rot = new Float32Array(5);
  let dash = 0;
  let segura = 0;
  for (let s = 0; s < n; s++) {
    prepararAmostra(hab, ator, alvo, tiros, rng);
    const faixa = reguaSegura(ator, hab);
    observar(ator, alvo, tiros, faixa, x.subarray(s * ENTRADAS, s * ENTRADAS + ENTRADAS));
    rotulo(hab, ator, alvo, tiros, rot);
    for (let o = 0; o < fat.n; o++) y[s * fat.n + o] = rot[o];
    if (hab === "esquivar") {
      if (rot[2] > 0) dash += 1;
      else segura += 1;
    }
  }
  const idx = new Uint16Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const i0 = fat.w1;
  const i1 = fat.b2 + fat.n;
  const baseEpocas = hab === "esquivar" ? 96 : hab === "fugir" ? 56 : 72;
  const epocas = Math.max(8, Math.round(baseEpocas * escalaEpocas));
  for (let epoca = 0; epoca < epocas; epoca++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
    }
    const lr = epoca < epocas / 2 ? 0.08 : 0.025;
    for (let b = 0; b < n; b += lote) {
      for (let g = i0; g < i1; g++) grad[g] = 0;
      const fim = Math.min(n, b + lote);
      const qtd = fim - b;
      for (let k = b; k < fim; k++) {
        const s = idx[k];
        acumular(fat, x.subarray(s * ENTRADAS, s * ENTRADAS + ENTRADAS), y.subarray(s * fat.n, s * fat.n + fat.n));
      }
      for (let g = i0; g < i1; g++) {
        pesos[g] -= (lr * grad[g]) / qtd + lr * 1e-5 * pesos[g];
        if (pesos[g] > 4) pesos[g] = 4;
        else if (pesos[g] < -4) pesos[g] = -4;
      }
    }
  }
  publicar();
  let erro = 0;
  const saida = new Float32Array(5);
  for (let s = 0; s < n; s += 8) {
    propagar(pesos, fat, x.subarray(s * ENTRADAS, s * ENTRADAS + ENTRADAS), saida);
    for (let o = 0; o < fat.n; o++) {
      const diff = Math.tanh(saida[o]) - y[s * fat.n + o];
      erro += diff * diff;
    }
  }
  const vistos = Math.ceil(n / 8);
  console.log(
    `${hab}: erro ${((erro / (vistos * fat.n)) ** 0.5).toFixed(3)}` +
      (hab === "esquivar" ? `  dash ${dash} segura ${segura}` : ""),
  );
}

function reguaSegura(ator, hab) {
  return regua(ator, hab).parada;
}

let tetoAproximacao = 0;

function nota(nome) {
  if (nome === "perseguir") {
    const r = avaliarAproximacao("rede", 8);
    return -r.tempo - r.falhas * 2;
  }
  if (nome === "esquivar") {
    const esquiva = avaliarEsquiva("rede", 8);
    const acerto = avaliarAcerto("rede", 12);
    const aprox = avaliarAproximacao("rede", 8);
    const lento = tetoAproximacao > 0 && aprox.tempo > tetoAproximacao;
    const quebrado = acerto < 0.5 || aprox.falhas > 0 || (tetoAproximacao > 0 && aprox.tempo > tetoAproximacao * 1.2);
    if (quebrado) return -2;
    if (acerto < 0.75 || lento) return esquiva - 0.08;
    return esquiva;
  }
  if (nome === "atirar") return avaliarAcerto("rede", 12);
  const f = avaliarFuga(6);
  return f.distancia - f.borda * 5;
}

function evoluir(nome, rng, vezes) {
  const fat = fatia[nome];
  const i0 = fat.w1;
  const i1 = fat.b2 + fat.n;
  const largura = i1 - i0;
  const theta = pesos.slice(i0, i1);
  publicar();
  const base = nota(nome);
  let melhorNota = base;
  const melhor = theta.slice();
  const sigma = 0.05;
  const pares = 8;
  const lr = 0.03;
  for (let it = 0; it < vezes; it++) {
    const g = new Float64Array(largura);
    for (let k = 0; k < pares; k++) {
      const eps = new Float64Array(largura);
      for (let i = 0; i < largura; i++) eps[i] = gauss(rng);
      for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i] + sigma * eps[i];
      publicar();
      const fp = nota(nome);
      for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i] - sigma * eps[i];
      publicar();
      const fm = nota(nome);
      const esc = (fp - fm) / (2 * sigma);
      for (let i = 0; i < largura; i++) g[i] += esc * eps[i];
      for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i];
    }
    for (let i = 0; i < largura; i++) theta[i] += (lr / pares) * g[i];
    for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i];
    publicar();
    const agora = nota(nome);
    if (agora > melhorNota + 1e-3) {
      melhorNota = agora;
      melhor.set(theta);
    }
  }
  for (let i = 0; i < largura; i++) pesos[i0 + i] = melhor[i];
  publicar();
  const depois = melhorNota;
  if (depois <= base + 1e-3) {
    const clone = thetaAntes(nome);
    for (let i = 0; i < largura; i++) pesos[i0 + i] = clone[i];
    publicar();
    console.log(`${nome}: evolução sem ganho (${depois.toFixed(3)} contra ${base.toFixed(3)})`);
    return;
  }
  console.log(`${nome}: evolução ${base.toFixed(3)} → ${depois.toFixed(3)}`);
}

const copia = {};

function guardarClone(nome) {
  const fat = fatia[nome];
  copia[nome] = pesos.slice(fat.w1, fat.b2 + fat.n);
}

function thetaAntes(nome) {
  return copia[nome];
}

function medir(modo) {
  const aprox = avaliarAproximacao(modo, 24);
  return {
    tempo: aprox.tempo,
    falhas: aprox.falhas,
    esquiva: avaliarEsquiva(modo, 12),
    acerto: avaliarAcerto(modo, 24),
  };
}

function aceita(rede, heur) {
  return rede.tempo <= heur.tempo * 1.3 && rede.falhas <= heur.falhas + 1 && rede.esquiva >= heur.esquiva - 0.03 && rede.acerto >= heur.acerto - 0.03 && rede.acerto >= 0.5;
}

function numerosDe(src) {
  const nums = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const n = src[i];
    nums[i] = Number.isFinite(n) ? Number(n.toFixed(6)) : 0;
  }
  return nums;
}

function gravar(guardados) {
  const linhas = ["facil", "medio", "dificil"]
    .map((id) => `  ${id}: new Float32Array(${JSON.stringify(numerosDe(guardados[id]))}),`)
    .join("\n");
  const texto =
    "/** Pesos congelados. Gerado por treino/iaCombate.mjs. */\n" +
    `export const FATIA = ${JSON.stringify(fatia)};\n` +
    "export let PESOS = new Float32Array(" +
    String(guardados.dificil.length) +
    ");\n" +
    "const tabela = {\n" +
    linhas +
    "\n};\n" +
    "PESOS.set(tabela.dificil);\n" +
    "export function instalarLayout(novo) {\n" +
    "  for (const nome in novo) {\n" +
    "    const src = novo[nome];\n" +
    "    const dst = FATIA[nome];\n" +
    "    if (!dst) continue;\n" +
    "    dst.w1 = src.w1;\n" +
    "    dst.b1 = src.b1;\n" +
    "    dst.w2 = src.w2;\n" +
    "    dst.b2 = src.b2;\n" +
    "    dst.n = src.n;\n" +
    "  }\n" +
    "}\n" +
    "export function instalarPesos(src) {\n" +
    "  if (PESOS.length < src.length) PESOS = Float32Array.from(src);\n" +
    "  else PESOS.set(src);\n" +
    "}\n" +
    "export function usarNivel(nivel) {\n" +
    "  const src = tabela[nivel];\n" +
    "  if (src) PESOS.set(src);\n" +
    "}\n";
  fs.writeFileSync(arquivoPesos, texto);
}

function restaurarClone() {
  for (let k = 0; k < ORDEM.length; k++) {
    const nome = ORDEM[k];
    const fat = fatia[nome];
    const pedaco = copia[nome];
    for (let i = 0; i < pedaco.length; i++) pesos[fat.w1 + i] = pedaco[i];
  }
  publicar();
}

const NIVEIS = [
  { id: "facil", amostras: 3072, escala: 0.75, evolucoes: 0, semente: 11 },
  { id: "medio", amostras: 3584, escala: 0.9, evolucoes: 2, semente: 29 },
  { id: "dificil", amostras: 4096, escala: 1, evolucoes: 8, semente: 20261017 },
];

function treinarNivel(cfg) {
  const rng = mulberry32(cfg.semente);
  iniciar(rng);
  for (let k = 0; k < ORDEM.length; k++) {
    clonar(ORDEM[k], rng, cfg.amostras, cfg.escala);
    guardarClone(ORDEM[k]);
  }
  publicar();
  const heur = medir("heuristica");
  let rede = medir("rede");
  console.log(cfg.id, "heurística", formatar(heur));
  console.log(cfg.id, "clone", formatar(rede));
  tetoAproximacao = heur.tempo * 1.12;
  if (cfg.evolucoes > 0) {
    for (let k = 0; k < ORDEM.length; k++) evoluir(ORDEM[k], rng, cfg.evolucoes);
    publicar();
    rede = medir("rede");
    console.log(cfg.id, "evoluída", formatar(rede));
  }
  if (cfg.id === "dificil" && cfg.evolucoes > 0 && !aceita(rede, heur)) {
    restaurarClone();
    rede = medir("rede");
    console.log(cfg.id, "clone de novo", formatar(rede));
    if (!aceita(rede, heur)) console.error("Difícil ficou atrás da heurística. O clone foi gravado mesmo assim.");
  }
  return Float32Array.from(pesos);
}

const guardados = {};
for (let i = 0; i < NIVEIS.length; i++) guardados[NIVEIS[i].id] = treinarNivel(NIVEIS[i]);

function aproveitavel(nivel) {
  instalarPesos(guardados[nivel]);
  const rede = medir("rede");
  return rede.falhas <= 4 && rede.esquiva >= 0.4;
}

for (let i = 0; i < NIVEIS.length; i++) {
  const id = NIVEIS[i].id;
  if (id === "dificil" || aproveitavel(id)) continue;
  guardados[id] = Float32Array.from(guardados.dificil);
  console.log(id, "herda o difícil: não contornava a cobertura");
}
instalarPesos(guardados.dificil);
gravar(guardados);
const ms = bancada(10);
console.log(`banca 30 lutadores: ${ms.toFixed(2)} ms por segundo simulado`);
console.log("pesos gravados");

function formatar(m) {
  return `tempo ${m.tempo.toFixed(3)}s falhas ${m.falhas} esquiva ${(m.esquiva * 100).toFixed(1)}% acerto ${(m.acerto * 100).toFixed(1)}%`;
}
