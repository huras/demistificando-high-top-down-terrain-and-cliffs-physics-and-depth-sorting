/**
 * Cronômetro de estágios do load de chunk.
 * Zero custo no jogo enquanto a sessão estiver desligada (só um boolean).
 */

const NULO = Object.freeze({
  pausar() {},
  retomar() {},
  fim() {},
});

let ativo = false;
/** @type {{ meta: object, estagios: Record<string, number>, t0: number } | null} */
let runAtual = null;
/** @type {Array<object>} */
let historico = [];

export function sessaoAtiva() {
  return ativo;
}

export function iniciarSessao() {
  ativo = true;
  historico = [];
  runAtual = null;
}

export function encerrarSessao() {
  ativo = false;
  runAtual = null;
  return historico;
}

export function historicoSessao() {
  return historico;
}

/**
 * @param {object} [meta]
 */
export function iniciarRun(meta = {}) {
  if (!ativo) return;
  runAtual = {
    meta: { ...meta },
    estagios: Object.create(null),
    t0: performance.now(),
  };
}

/**
 * @param {string} nome
 * @param {number} ms
 */
export function acumular(nome, ms) {
  if (!ativo || !runAtual || !(ms > 0)) return;
  runAtual.estagios[nome] = (runAtual.estagios[nome] || 0) + ms;
}

/**
 * @param {string} nome
 * @param {() => any} fn
 */
export function medir(nome, fn) {
  if (!ativo || !runAtual) return fn();
  const t0 = performance.now();
  const out = fn();
  acumular(nome, performance.now() - t0);
  return out;
}

/**
 * Fatia com yields: pausa antes do yield, retoma depois (só CPU, não espera de frame).
 * @param {string} nome
 */
export function cronometroFatia(nome) {
  if (!ativo || !runAtual) return NULO;
  let t0 = performance.now();
  let aberto = true;
  return {
    pausar() {
      if (!aberto) return;
      acumular(nome, performance.now() - t0);
      aberto = false;
    },
    retomar() {
      t0 = performance.now();
      aberto = true;
    },
    fim() {
      if (!aberto) return;
      acumular(nome, performance.now() - t0);
      aberto = false;
    },
  };
}

export function finalizarRun() {
  if (!ativo || !runAtual) return null;
  const totalMs = performance.now() - runAtual.t0;
  const somaEstagios = Object.values(runAtual.estagios).reduce((a, b) => a + b, 0);
  const registro = {
    meta: runAtual.meta,
    estagios: { ...runAtual.estagios },
    totalMs,
    somaEstagiosMs: somaEstagios,
  };
  historico.push(registro);
  runAtual = null;
  return registro;
}

/**
 * @param {number[]} valores
 * @param {number} p 0..1
 */
function percentil(valores, p) {
  if (!valores.length) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const i = Math.min(ord.length - 1, Math.max(0, Math.ceil(p * ord.length) - 1));
  return ord[i];
}

/**
 * Agrega vários runs (mesmo conjunto de estágios).
 * @param {Array<object>} [runs]
 */
export function agregarRuns(runs = historico) {
  /** @type {Map<string, number[]>} */
  const porEstagio = new Map();
  const totais = [];
  for (const run of runs) {
    totais.push(run.totalMs);
    for (const [nome, ms] of Object.entries(run.estagios)) {
      let arr = porEstagio.get(nome);
      if (!arr) {
        arr = [];
        porEstagio.set(nome, arr);
      }
      arr.push(ms);
    }
  }
  const mediaTotal = totais.length
    ? totais.reduce((a, b) => a + b, 0) / totais.length
    : 0;

  const estagios = [];
  for (const [nome, vals] of porEstagio) {
    const soma = vals.reduce((a, b) => a + b, 0);
    const media = soma / vals.length;
    estagios.push({
      nome,
      n: vals.length,
      min: Math.min(...vals),
      media,
      p50: percentil(vals, 0.5),
      p95: percentil(vals, 0.95),
      max: Math.max(...vals),
      pctTotal: mediaTotal > 0 ? (media / mediaTotal) * 100 : 0,
    });
  }
  estagios.sort((a, b) => b.media - a.media);

  return {
    n: runs.length,
    total: {
      min: totais.length ? Math.min(...totais) : 0,
      media: mediaTotal,
      p50: percentil(totais, 0.5),
      p95: percentil(totais, 0.95),
      max: totais.length ? Math.max(...totais) : 0,
    },
    estagios,
    runs,
  };
}

/**
 * @param {ReturnType<typeof agregarRuns>} agg
 * @param {object} [extra]
 */
export function textoRelatorio(agg, extra = {}) {
  const linhas = [];
  linhas.push("=== Profiling load de chunk ===");
  if (extra.titulo) linhas.push(extra.titulo);
  if (extra.modo) linhas.push(`Modo: ${extra.modo}`);
  if (extra.coords) linhas.push(`Coords: ${extra.coords}`);
  linhas.push(`Runs: ${agg.n}`);
  linhas.push(
    `Total ms — min ${agg.total.min.toFixed(2)} | méd ${agg.total.media.toFixed(2)} | p50 ${agg.total.p50.toFixed(2)} | p95 ${agg.total.p95.toFixed(2)} | max ${agg.total.max.toFixed(2)}`,
  );
  linhas.push("");
  linhas.push("Estágio | min | méd | p50 | p95 | max | %");
  for (const e of agg.estagios) {
    linhas.push(
      `${e.nome} | ${e.min.toFixed(2)} | ${e.media.toFixed(2)} | ${e.p50.toFixed(2)} | ${e.p95.toFixed(2)} | ${e.max.toFixed(2)} | ${e.pctTotal.toFixed(1)}%`,
    );
  }
  if (extra.notas?.length) {
    linhas.push("");
    for (const n of extra.notas) linhas.push(`- ${n}`);
  }
  return linhas.join("\n");
}

/**
 * @param {ReturnType<typeof agregarRuns>} agg
 * @param {object} [extra]
 */
export function jsonRelatorio(agg, extra = {}) {
  return {
    geradoEm: new Date().toISOString(),
    ...extra,
    resumo: {
      n: agg.n,
      total: agg.total,
      estagios: agg.estagios,
    },
    runs: agg.runs.map((r) => ({
      meta: r.meta,
      totalMs: r.totalMs,
      somaEstagiosMs: r.somaEstagiosMs,
      estagios: r.estagios,
    })),
  };
}
