/**
 * Máquina do Centro: as bolas entram uma a uma, pulsam e recolhem juntas.
 * Layout 3D dos slots fica em slotsCuraConfig / slots.json.
 */

import { QTD_SLOTS_CURA } from "./slotsCuraConfig.js";

const ESPERA = 0.11;
const ESTOURO = 0.16;
const PULSO = 0.55;
const RECOLHER = 0.32;
const FOLGA = 0.14;
const POR_RODADA = QTD_SLOTS_CURA;

/** Compat: 6 vagas (índices). Posições vêm do JSON. */
export const SLOTS_CURA = Object.freeze(
  Array.from({ length: QTD_SLOTS_CURA }, (_, i) => Object.freeze({ slot: i })),
);

const quadro = [null, null, null, null, null, null];

let sessao = null;

export function curaOcupada() {
  return !!sessao;
}

/**
 * @param {number | string[]} qtdOuKeys quantidade ou lista de ballKeys do time
 */
export function iniciarCuraMaquina(qtdOuKeys) {
  if (sessao) return false;
  let keys = [];
  if (Array.isArray(qtdOuKeys)) {
    keys = qtdOuKeys.map((k) => (typeof k === "string" && k ? k : "pokeball"));
  } else {
    const n = Math.max(0, qtdOuKeys | 0);
    keys = Array.from({ length: n }, () => "pokeball");
  }
  sessao = {
    fase: "por",
    t: 0,
    keys,
    qtd: keys.length,
    rodada: 0,
    rodadas: Math.max(1, Math.ceil(Math.max(1, keys.length) / POR_RODADA)),
    indice: 0,
    bolas: [],
  };
  comecarRodada();
  return true;
}

function bolasDaRodada() {
  if (!sessao || sessao.qtd <= 0) return 0;
  const inicio = sessao.rodada * POR_RODADA;
  return Math.min(POR_RODADA, sessao.qtd - inicio);
}

function comecarRodada() {
  if (!sessao) return;
  const n = bolasDaRodada();
  const inicio = sessao.rodada * POR_RODADA;
  sessao.indice = 0;
  sessao.fase = n > 0 ? "por" : "cura";
  sessao.t = 0;
  sessao.bolas = [];
  for (let i = 0; i < n; i++) {
    sessao.bolas.push({
      slot: i,
      ballKey: sessao.keys[inicio + i] || "pokeball",
      visivel: false,
      escala: 0,
      brilho: 0,
      sobe: 0,
    });
  }
}

function avancar() {
  if (!sessao) return;
  if (sessao.fase === "por") {
    sessao.fase = "cura";
    sessao.t = 0;
    for (let i = 0; i < sessao.bolas.length; i++) {
      const b = sessao.bolas[i];
      b.visivel = true;
      b.escala = 1;
      b.brilho = 0;
    }
    return;
  }
  if (sessao.fase === "cura") {
    sessao.fase = "recolher";
    sessao.t = 0;
    return;
  }
  if (sessao.fase === "recolher") {
    if (sessao.rodada + 1 < sessao.rodadas) {
      sessao.fase = "folga";
      sessao.t = 0;
      sessao.bolas = [];
      return;
    }
    sessao = null;
    return;
  }
  if (sessao.fase === "folga") {
    sessao.rodada += 1;
    comecarRodada();
  }
}

export function atualizarCuraMaquina(dt) {
  if (!sessao || !(dt > 0)) return;
  sessao.t += dt;
  const bolas = sessao.bolas;

  if (sessao.fase === "por") {
    const n = bolas.length;
    const alvo = Math.min(n, Math.floor(sessao.t / ESPERA) + 1);
    while (sessao.indice < alvo) {
      const b = bolas[sessao.indice];
      if (b) {
        b.visivel = true;
        b.escala = 0.15;
      }
      sessao.indice += 1;
    }
    for (let i = 0; i < sessao.indice; i++) {
      const b = bolas[i];
      if (!b) continue;
      const local = Math.max(0, sessao.t - i * ESPERA);
      const t = Math.min(1, local / ESTOURO);
      const suave = 1 - (1 - t) ** 3;
      b.escala = t >= 1 ? 1 : 0.2 + 1.15 * suave;
      b.brilho = 0;
      b.sobe = 0;
    }
    const pronto = Math.max(0, n - 1) * ESPERA + ESTOURO + 0.04;
    if (sessao.t >= pronto || n === 0) avancar();
    return;
  }

  if (sessao.fase === "cura") {
    const u = Math.min(1, sessao.t / PULSO);
    const pulso = 0.55 + 0.45 * Math.sin(sessao.t * Math.PI * 6);
    for (let i = 0; i < bolas.length; i++) {
      const b = bolas[i];
      b.visivel = true;
      b.escala = 1 + 0.08 * pulso;
      b.brilho = 0.35 + 0.65 * pulso * (0.4 + 0.6 * u);
      b.sobe = 0;
    }
    if (sessao.t >= PULSO) avancar();
    return;
  }

  if (sessao.fase === "recolher") {
    const u = Math.min(1, sessao.t / RECOLHER);
    const suave = u * u;
    for (let i = 0; i < bolas.length; i++) {
      const b = bolas[i];
      b.visivel = u < 0.98;
      b.escala = Math.max(0, 1 - suave * 1.15);
      b.brilho = (1 - u) * 0.4;
      b.sobe = suave * 0.55;
    }
    if (sessao.t >= RECOLHER) avancar();
    return;
  }

  if (sessao.fase === "folga" && sessao.t >= FOLGA) avancar();
}

/** Seis vagas. Null é vaga vazia nesta rodada. */
export function fotoCuraMaquina() {
  for (let i = 0; i < quadro.length; i++) quadro[i] = null;
  if (!sessao) return null;
  const bolas = sessao.bolas;
  for (let i = 0; i < bolas.length; i++) quadro[bolas[i].slot] = bolas[i];
  return quadro;
}
