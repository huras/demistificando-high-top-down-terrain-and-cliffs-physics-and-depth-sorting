import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRADAS, OCULTOS } from "../js/navegacao/ia/constantes.js";
import { instalarPesos } from "../js/navegacao/ia/pesos.js";
import { montarLayout, ORDEM, propagar } from "../js/navegacao/ia/rede.js";
import {
  A_PE,
  NADA,
  PLANA,
  TUDO,
  VOA,
  episodio,
  provaEspecialista,
} from "./seguirCena.mjs";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const arquivoPesos = path.join(raiz, "..", "js", "navegacao", "ia", "pesos.js");
const { fatia, total } = montarLayout();
const pesos = new Float64Array(total);
const grad = new Float64Array(total);
const cache = {
  pre: new Float64Array(OCULTOS),
  h: new Float64Array(OCULTOS),
  z: new Float64Array(3),
  y: new Float64Array(3),
  dH: new Float64Array(OCULTOS),
};
const saida = new Float32Array(3);

const CENA = {
  chao: { tipo: "arvores", perfil: A_PE },
  nadar: { tipo: "agua", perfil: NADA },
  voar: { tipo: "voo", perfil: VOA },
  planar: { tipo: "planar", perfil: PLANA },
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

function decidirRede(hab, observacao) {
  propagar(pesos, fatia[hab], observacao, saida);
  saida[0] = Math.tanh(saida[0]);
  saida[1] = Math.tanh(saida[1]);
  saida[2] = Math.tanh(saida[2]);
  return saida;
}

function clonar(hab, rng) {
  const fat = fatia[hab];
  const cena = CENA[hab];
  const n = 3072;
  const lote = 128;
  const x = new Float32Array(n * ENTRADAS);
  const y = new Float32Array(n * fat.n);
  const gravar = { hab, n: 0, limite: n, saidas: fat.n, x, y };
  let guarda = 0;
  while (gravar.n < n && guarda < 400) {
    const perfil = guarda % 5 === 0 ? TUDO : cena.perfil;
    episodio(cena.tipo, perfil, rng, null, gravar);
    guarda++;
  }
  const qtdAmostra = gravar.n;
  const idx = new Uint16Array(qtdAmostra);
  for (let i = 0; i < qtdAmostra; i++) idx[i] = i;
  const i0 = fat.w1;
  const i1 = fat.b2 + fat.n;
  for (let epoca = 0; epoca < 48; epoca++) {
    for (let i = qtdAmostra - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
    }
    const lr = epoca < 24 ? 0.08 : 0.025;
    for (let b = 0; b < qtdAmostra; b += lote) {
      for (let g = i0; g < i1; g++) grad[g] = 0;
      const fim = Math.min(qtdAmostra, b + lote);
      const qtd = fim - b;
      for (let k = b; k < fim; k++) {
        const s = idx[k];
        acumular(
          fat,
          x.subarray(s * ENTRADAS, s * ENTRADAS + ENTRADAS),
          y.subarray(s * fat.n, s * fat.n + fat.n),
        );
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
  const amostra = new Float32Array(ENTRADAS);
  let vistos = 0;
  for (let s = 0; s < qtdAmostra; s += 8) {
    for (let i = 0; i < ENTRADAS; i++) amostra[i] = x[s * ENTRADAS + i];
    propagar(pesos, fat, amostra, saida);
    for (let o = 0; o < fat.n; o++) {
      const diff = Math.tanh(saida[o]) - y[s * fat.n + o];
      erro += diff * diff;
    }
    vistos++;
  }
  console.log(`${hab}: amostras ${qtdAmostra} erro ${((erro / (vistos * fat.n)) ** 0.5).toFixed(3)}`);
}

function medir(decidir, rng, n) {
  const arvores = provaEspecialista("arvores", A_PE, rng, n, decidir);
  const agua = provaEspecialista("agua", NADA, rng, n, decidir);
  const voo = provaEspecialista("voo", VOA, rng, n, decidir);
  const plano = provaEspecialista("planar", PLANA, rng, n, decidir);
  const seco = provaEspecialista("agua", A_PE, rng, n, decidir);
  const muro = provaEspecialista("voo", A_PE, rng, n, decidir);
  const vao = provaEspecialista("planar", A_PE, rng, n, decidir);
  const chegada = (arvores.chegada + agua.chegada + voo.chegada + plano.chegada) / 4;
  const batida = arvores.batida;
  const mascara = (seco.mascara + muro.mascara + vao.mascara + arvores.mascara) / 4;
  return { chegada, batida, mascara, voo: voo.chegada, voou: voo.voou, arvores: arvores.chegada, agua: agua.chegada, plano: plano.chegada };
}

function nota(nome, rng) {
  const cena = CENA[nome];
  const r = provaEspecialista(cena.tipo, cena.perfil, rng, 6, decidirRede);
  if (nome === "chao") return r.chegada - r.batida * 0.15;
  if (nome === "voar") return r.chegada + Math.min(r.voou, 4) * 0.02;
  return r.chegada - (1 - r.mascara) * 2;
}

function evoluir(nome, rng) {
  const fat = fatia[nome];
  const i0 = fat.w1;
  const i1 = fat.b2 + fat.n;
  const largura = i1 - i0;
  const theta = pesos.slice(i0, i1);
  publicar();
  const base = nota(nome, rng);
  const sigma = 0.04;
  const pares = 6;
  const lr = 0.02;
  for (let it = 0; it < 4; it++) {
    const g = new Float64Array(largura);
    for (let k = 0; k < pares; k++) {
      const eps = new Float64Array(largura);
      for (let i = 0; i < largura; i++) eps[i] = gauss(rng);
      for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i] + sigma * eps[i];
      publicar();
      const fp = nota(nome, rng);
      for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i] - sigma * eps[i];
      publicar();
      const fm = nota(nome, rng);
      const esc = (fp - fm) / (2 * sigma);
      for (let i = 0; i < largura; i++) g[i] += esc * eps[i];
      for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i];
    }
    for (let i = 0; i < largura; i++) theta[i] += (lr / pares) * g[i];
    for (let i = 0; i < largura; i++) pesos[i0 + i] = theta[i];
  }
  publicar();
  const depois = nota(nome, rng);
  if (depois <= base + 1e-3) {
    const pedaco = copia[nome];
    for (let i = 0; i < largura; i++) pesos[i0 + i] = pedaco[i];
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

function aceita(rede, heur) {
  return (
    rede.chegada >= heur.chegada - 0.08 &&
    rede.batida <= heur.batida + 0.2 &&
    rede.mascara >= heur.mascara - 0.03 &&
    rede.voou >= 1
  );
}

function formatar(m) {
  return `chegada ${(m.chegada * 100).toFixed(0)}% batida ${m.batida.toFixed(2)} máscara ${(m.mascara * 100).toFixed(1)}% voo ${(m.voou || 0).toFixed(1)}`;
}

function gravar(aceito) {
  const nums = new Array(pesos.length);
  for (let i = 0; i < pesos.length; i++) {
    const n = pesos[i];
    nums[i] = Number.isFinite(n) ? Number(n.toFixed(6)) : 0;
  }
  const texto =
    "/** Pesos congelados. Gerado por treino/seguir.mjs. */\n" +
    `export const REDE_ACEITA = ${aceito ? "true" : "false"};\n` +
    `export const FATIA = ${JSON.stringify(fatia)};\n` +
    `export const PESOS = new Float32Array(${JSON.stringify(nums)});\n` +
    "export function instalarPesos(src) {\n" +
    "  PESOS.set(src);\n" +
    "}\n";
  fs.writeFileSync(arquivoPesos, texto);
}

function bancaTempo() {
  const relogio = mulberry32(99);
  const t0 = performance.now();
  let passos = 0;
  const meta = 30 * 100;
  while (passos < meta) {
    const r = episodio("arvores", A_PE, relogio, decidirRede, null);
    passos += r.passos;
  }
  const ms = performance.now() - t0;
  const sim = passos * 0.1;
  console.log(`tempo ${(ms / sim).toFixed(3)} ms por segundo simulado (${ms.toFixed(0)} ms em ${sim.toFixed(0)} s)`);
}

const rng = mulberry32(20261017);
iniciar(rng);
for (let k = 0; k < ORDEM.length; k++) {
  clonar(ORDEM[k], rng);
  guardarClone(ORDEM[k]);
}
publicar();
const heur = medir(null, mulberry32(7), 16);
let rede = medir(decidirRede, mulberry32(7), 16);
console.log("especialista", formatar(heur));
console.log("clone", formatar(rede));
for (let k = 0; k < ORDEM.length; k++) evoluir(ORDEM[k], rng);
rede = medir(decidirRede, mulberry32(7), 16);
console.log("rede", formatar(rede));
const ok = aceita(rede, heur);
if (!ok) {
  for (let k = 0; k < ORDEM.length; k++) {
    const nome = ORDEM[k];
    const fat = fatia[nome];
    const pedaco = copia[nome];
    for (let i = 0; i < pedaco.length; i++) pesos[fat.w1 + i] = pedaco[i];
  }
  publicar();
  rede = medir(decidirRede, mulberry32(7), 16);
  console.log("clone de novo", formatar(rede));
}
const ficou = aceita(rede, heur);
gravar(ficou);
bancaTempo();
console.log(ficou ? "pesos aceitos" : "pesos recusados");
if (!ficou) process.exitCode = 1;
