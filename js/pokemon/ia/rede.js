import { ENTRADAS, OCULTOS } from "./constantes.js";

/** Saídas por habilidade. O seletor escolhe qual fatia roda. */
export const ORDEM = ["perseguir", "fugir", "esquivar", "atirar"];
export const SAIDAS = {
  perseguir: 3,
  fugir: 3,
  esquivar: 3,
  atirar: 5,
};

const oculto = new Float32Array(OCULTOS);

export function montarLayout() {
  const fatia = {};
  let cursor = 0;
  for (let i = 0; i < ORDEM.length; i++) {
    const nome = ORDEM[i];
    const n = SAIDAS[nome];
    const nW1 = ENTRADAS * OCULTOS;
    const nB1 = OCULTOS;
    const nW2 = OCULTOS * n;
    fatia[nome] = {
      w1: cursor,
      b1: cursor + nW1,
      w2: cursor + nW1 + nB1,
      b2: cursor + nW1 + nB1 + nW2,
      n,
    };
    cursor += nW1 + nB1 + nW2 + n;
  }
  return { fatia, total: cursor };
}

/** Uma camada tanh e uma saída linear. Escreve em `saida`. Sem alocação. */
export function propagar(pesos, fatia, entrada, saida) {
  const n = fatia.n;
  for (let h = 0; h < OCULTOS; h++) {
    let s = pesos[fatia.b1 + h];
    const base = fatia.w1 + h * ENTRADAS;
    for (let i = 0; i < ENTRADAS; i++) s += pesos[base + i] * entrada[i];
    oculto[h] = Math.tanh(s);
  }
  for (let o = 0; o < n; o++) {
    let s = pesos[fatia.b2 + o];
    const base = fatia.w2 + o * OCULTOS;
    for (let h = 0; h < OCULTOS; h++) s += pesos[base + h] * oculto[h];
    saida[o] = s;
  }
}
