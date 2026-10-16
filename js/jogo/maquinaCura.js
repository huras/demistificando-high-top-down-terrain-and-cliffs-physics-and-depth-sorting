/**
 * Máquina do Centro: as bolas entram uma a uma, pulsam e recolhem juntas.
 * Os deslocamentos são o centro do carimbo, iguais aos pivôs do Pokémon AI.
 */

const ESPERA = 0.11;
const ESTOURO = 0.16;
const PULSO = 0.55;
const RECOLHER = 0.32;
const FOLGA = 0.14;
const POR_RODADA = 6;

export const SLOTS_CURA = Object.freeze([
  Object.freeze({ x: -0.27, y: -0.23 }),
  Object.freeze({ x: 0.21, y: -0.25 }),
  Object.freeze({ x: -0.28, y: 0.04 }),
  Object.freeze({ x: 0.22, y: 0.01 }),
  Object.freeze({ x: -0.29, y: 0.3 }),
  Object.freeze({ x: 0.22, y: 0.28 }),
]);

const quadro = [null, null, null, null, null, null];

let sessao = null;

export function curaOcupada() {
  return !!sessao;
}

export function iniciarCuraMaquina(qtd) {
  if (sessao) return false;
  const n = Math.max(0, qtd | 0);
  sessao = {
    fase: "por",
    t: 0,
    qtd: n,
    rodada: 0,
    rodadas: Math.max(1, Math.ceil(Math.max(1, n) / POR_RODADA)),
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
  sessao.indice = 0;
  sessao.fase = n > 0 ? "por" : "cura";
  sessao.t = 0;
  sessao.bolas = [];
  for (let i = 0; i < n; i++) {
    sessao.bolas.push({
      slot: i,
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
