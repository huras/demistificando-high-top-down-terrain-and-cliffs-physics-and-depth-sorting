import { CHUNK_XZ, SEED_MUNDO } from "../config.js";
import { deLocalKanto } from "../mundo/bounds.js";
import { carregarCascasCidade } from "../mundo/cidade/cascaCasa.js";
import { AREA_KANTO, CENTRO_AREA } from "../mundo/regiao/grafoKanto.js";
import { SPAWN_PALLET } from "../mundo/regiao/spawnKanto.js";
import { criarChunk, mundoParaChunk } from "../mundo/voxel/chunk.js";
import { passosChunk } from "../mundo/voxel/gerarChunk.js";
import {
  carregarChunk,
  descarregarChunk,
  instalarChunk,
  obterChunk,
  obterSeed,
  definirSeed,
  publicarChunkGerado,
} from "../mundo/voxel/storeMundo.js";
import {
  contarVertsGeos,
  instalarGeosDescartavel,
  iterarGeosChunk,
  malharChunk,
} from "../render/3d/terrenoMalha.js";
import {
  agregarRuns,
  encerrarSessao,
  finalizarRun,
  historicoSessao,
  iniciarRun,
  iniciarSessao,
  jsonRelatorio,
  textoRelatorio,
} from "./perfChunk.js";

/** Mesmos orçamentos do jogo (storeMundo / terrenoMalha). */
const ORCAMENTO_STREAM_MS = 0.8;
const ORCAMENTO_MALHA_MS = 1;

function chunkDeArea(ax, ay, lx = CENTRO_AREA, ly = CENTRO_AREA) {
  const w = deLocalKanto(ax * AREA_KANTO + lx, ay * AREA_KANTO + ly);
  return mundoParaChunk(w.x, w.y);
}

const PRESETS = [
  {
    id: "cidade",
    nome: "Pallet (hub)",
    nota: "Praça / cascas / hub — costuma ser o pior caso de cidade.",
    ...mundoParaChunk(SPAWN_PALLET.x, SPAWN_PALLET.y),
  },
  {
    id: "campo",
    nome: "Campo (mato)",
    nota: "Área de mato perto de Pallet, sem casca de cidade.",
    ...chunkDeArea(9, 16),
  },
  {
    id: "costa",
    nome: "Costa (água)",
    nota: "Rota 19 — coluna com água / fluxo.",
    ...chunkDeArea(20, 25),
  },
  {
    id: "cliff",
    nome: "Cliff (montanha)",
    nota: "Rota 3 / massif perto de Pewter.",
    ...chunkDeArea(12, 5),
  },
];

function $(id) {
  return document.getElementById(id);
}

function celulasDisco(cx, cy, r) {
  const out = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) out.push({ cx: cx + dx, cy: cy + dy });
    }
  }
  return out;
}

function limparCelulas(celulas) {
  for (const c of celulas) descarregarChunk(c.cx, c.cy);
}

function metaChunk(chunk) {
  let agua = 0;
  let corpo = 0;
  const n = CHUNK_XZ * CHUNK_XZ;
  for (let i = 0; i < n; i++) {
    if (chunk.fluido[i]) agua++;
    if (chunk.corpo[i]) corpo++;
  }
  return { celulasAgua: agua, celulasCorpo: corpo };
}

function esperarFrame() {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/**
 * Drena um generator respeitando orçamento ms por “frame”.
 * @returns {{ value: any, frames: number }}
 */
async function drenarComOrcamento(gen, orcamentoMs) {
  let passo = gen.next();
  let frames = 0;
  while (!passo.done) {
    frames++;
    const limite = performance.now() + orcamentoMs;
    while (!passo.done && performance.now() < limite) {
      passo = gen.next();
    }
    if (!passo.done) await esperarFrame();
  }
  return { value: passo.value, frames: Math.max(1, frames) };
}

function drenarSync(gen) {
  let passo = gen.next();
  while (!passo.done) passo = gen.next();
  return passo.value;
}

/** Gera vizinhos sem cronometrar (borda do mesher). */
function garantirVizinhos(cx, cy, rHalo = 1) {
  const seed = obterSeed();
  for (let dy = -rHalo; dy <= rHalo; dy++) {
    for (let dx = -rHalo; dx <= rHalo; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (obterChunk(nx, ny)) continue;
      const chunk = criarChunk(nx, ny);
      drenarSync(passosChunk(chunk, seed));
      instalarChunk(chunk);
    }
  }
}

/**
 * @param {{ cx: number, cy: number, modo: string, instalar: boolean }} opts
 */
async function medirUmChunk(opts) {
  const { cx, cy, modo, instalar } = opts;
  const seed = obterSeed();
  descarregarChunk(cx, cy);
  // Halo sem cronômetro — só pra borda do mesher ficar justa.
  garantirVizinhos(cx, cy, 1);

  iniciarRun({ cx, cy, modo });

  let chunk;
  let framesGen = 1;
  if (modo === "stream") {
    chunk = criarChunk(cx, cy);
    const r = await drenarComOrcamento(passosChunk(chunk, seed), ORCAMENTO_STREAM_MS);
    framesGen = r.frames;
    publicarChunkGerado(chunk);
  } else {
    // Path real do jogo: gerar + publicar (patch demo, dirty vizinhos).
    chunk = carregarChunk(cx, cy);
  }
  if (!chunk) chunk = obterChunk(cx, cy);

  let framesMalha = 1;
  let geos;
  if (modo === "stream") {
    const r = await drenarComOrcamento(iterarGeosChunk(chunk), ORCAMENTO_MALHA_MS);
    geos = r.value;
    framesMalha = r.frames;
  } else {
    geos = malharChunk(chunk);
  }

  const verts = contarVertsGeos(geos);
  let instalacao = { meshes: 0, verts };
  if (instalar) {
    instalacao = instalarGeosDescartavel(geos) || instalacao;
  } else {
    // libera geos se não instalou
    const liberar = (g) => g?.dispose?.();
    liberar(geos.geoCubos);
    liberar(geos.geoLedges);
    liberar(geos.geoAgua);
    liberar(geos.geoAguaPantano);
    liberar(geos.geoAguaLava);
    liberar(geos.geoEspuma);
    liberar(geos.geoQueda);
    liberar(geos.geoQuedaLava);
    for (const item of geos.topos || []) liberar(item.geo);
    for (const item of geos.paredes || []) liberar(item.geo);
  }

  const flags = metaChunk(chunk);
  const reg = finalizarRun();
  if (reg) {
    reg.meta.framesGen = framesGen;
    reg.meta.framesMalha = framesMalha;
    reg.meta.verts = verts;
    reg.meta.meshes = instalacao.meshes || 0;
    Object.assign(reg.meta, flags);
  }
  return reg;
}

function pintarWaterfall(agg) {
  const el = $("waterfall");
  el.innerHTML = "";
  const total = agg.total.media || 1;
  for (const e of agg.estagios) {
    const row = document.createElement("div");
    row.className = "wf-row";
    const pct = Math.max(0.4, (e.media / total) * 100);
    row.innerHTML = `
      <span class="wf-nome">${e.nome}</span>
      <div class="wf-barra-wrap"><div class="wf-barra" style="width:${pct}%"></div></div>
      <span class="wf-ms">${e.media.toFixed(2)} ms</span>
      <span class="wf-pct">${e.pctTotal.toFixed(1)}%</span>`;
    el.appendChild(row);
  }
}

function pintarTabela(agg) {
  const tb = $("tabela-estagios");
  tb.innerHTML = "";
  for (const e of agg.estagios) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.nome}</td>
      <td>${e.min.toFixed(2)}</td>
      <td>${e.media.toFixed(2)}</td>
      <td>${e.p50.toFixed(2)}</td>
      <td>${e.p95.toFixed(2)}</td>
      <td>${e.max.toFixed(2)}</td>
      <td>${e.pctTotal.toFixed(1)}%</td>`;
    tb.appendChild(tr);
  }
}

function pintarResumo(agg, extra) {
  const el = $("resumo");
  const framesGen = extra.framesGenMed;
  const framesMalha = extra.framesMalhaMed;
  const partes = [
    `<strong>${agg.n}</strong> run(s)`,
    `total méd <strong>${agg.total.media.toFixed(2)} ms</strong>`,
    `p95 <strong>${agg.total.p95.toFixed(2)} ms</strong>`,
  ];
  if (framesGen != null) {
    partes.push(`frames gen ~<strong>${framesGen.toFixed(1)}</strong>`);
    partes.push(`frames malha ~<strong>${framesMalha.toFixed(1)}</strong>`);
  }
  if (extra.vertsMed != null) partes.push(`verts ~<strong>${Math.round(extra.vertsMed)}</strong>`);
  if (extra.pior) {
    partes.push(
      `pior chunk <strong>(${extra.pior.cx},${extra.pior.cy})</strong> ${extra.pior.totalMs.toFixed(2)} ms`,
    );
  }
  el.innerHTML = partes.join(" · ");
}

function status(msg) {
  $("status").textContent = msg;
}

let ultimoAgg = null;
let ultimoExtra = {};

async function rodar() {
  const btn = $("btn-rodar");
  btn.disabled = true;
  try {
    const cx = Number($("cx").value) | 0;
    const cy = Number($("cy").value) | 0;
    const runs = Math.max(1, Math.min(50, Number($("runs").value) | 0));
    const modo = $("modo").value === "stream" ? "stream" : "wall";
    const raio = Math.max(0, Math.min(2, Number($("raio").value) | 0));
    const instalar = $("instalar").checked;

    definirSeed(SEED_MUNDO);
    iniciarSessao();
    status("Carregando cascas da cidade…");
    await carregarCascasCidade();

    const alvos = raio > 0 ? celulasDisco(cx, cy, raio) : [{ cx, cy }];
    const limpar = celulasDisco(cx, cy, raio + 1);
    limparCelulas(limpar);

    status(
      modo === "stream"
        ? `Simulando stream (${ORCAMENTO_STREAM_MS}/${ORCAMENTO_MALHA_MS} ms)…`
        : "Medindo wall-clock…",
    );

    for (let i = 0; i < runs; i++) {
      limparCelulas(limpar);
      for (let a = 0; a < alvos.length; a++) {
        const alvo = alvos[a];
        status(`Run ${i + 1}/${runs} · chunk (${alvo.cx},${alvo.cy}) ${a + 1}/${alvos.length}`);
        await medirUmChunk({ cx: alvo.cx, cy: alvo.cy, modo, instalar });
        if (modo === "stream") await esperarFrame();
      }
    }

    const runsHist = historicoSessao();
    encerrarSessao();
    limparCelulas(limpar);

    const agg = agregarRuns(runsHist);
    let framesGenMed = 0;
    let framesMalhaMed = 0;
    let vertsMed = 0;
    let pior = null;
    for (const r of runsHist) {
      framesGenMed += r.meta.framesGen || 0;
      framesMalhaMed += r.meta.framesMalha || 0;
      vertsMed += r.meta.verts || 0;
      if (!pior || r.totalMs > pior.totalMs) {
        pior = { cx: r.meta.cx, cy: r.meta.cy, totalMs: r.totalMs };
      }
    }
    const n = runsHist.length || 1;
    framesGenMed /= n;
    framesMalhaMed /= n;
    vertsMed /= n;

    ultimoAgg = agg;
    ultimoExtra = {
      modo: modo === "stream" ? `stream (${ORCAMENTO_STREAM_MS}/${ORCAMENTO_MALHA_MS} ms)` : "wall-clock",
      coords: raio > 0 ? `disco r=${raio} centro (${cx},${cy})` : `(${cx},${cy})`,
      titulo: `Seed ${SEED_MUNDO}`,
      framesGenMed: modo === "stream" ? framesGenMed : null,
      framesMalhaMed: modo === "stream" ? framesMalhaMed : null,
      vertsMed,
      pior: raio > 0 ? pior : null,
      notas: [
        `Cascas cidade: carregadas`,
        `Instalar meshes: ${instalar ? "sim" : "não"}`,
        `Alvos por run: ${alvos.length}`,
      ],
    };

    pintarWaterfall(agg);
    pintarTabela(agg);
    pintarResumo(agg, ultimoExtra);
    status(
      `Pronto — ${agg.n} amostra(s), total méd ${agg.total.media.toFixed(2)} ms` +
        (agg.estagios[0] ? ` · pior estágio: ${agg.estagios[0].nome}` : ""),
    );
  } catch (err) {
    console.error(err);
    status(`Erro: ${err?.message || err}`);
    encerrarSessao();
  } finally {
    btn.disabled = false;
  }
}

async function copiarRelatorio() {
  if (!ultimoAgg) {
    status("Rode o bench antes de copiar.");
    return;
  }
  const texto = textoRelatorio(ultimoAgg, ultimoExtra);
  const json = JSON.stringify(jsonRelatorio(ultimoAgg, ultimoExtra), null, 2);
  const payload = `${texto}\n\n--- JSON ---\n${json}`;
  try {
    await navigator.clipboard.writeText(payload);
    status("Relatório copiado.");
  } catch {
    status("Não deu pra copiar — veja o console.");
    console.log(payload);
  }
}

function aplicarPreset(id) {
  const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
  $("cx").value = String(p.cx);
  $("cy").value = String(p.cy);
  $("nota-preset").textContent = `${p.nome}: ${p.nota} → chunk (${p.cx}, ${p.cy})`;
}

function montarPresets() {
  const ul = $("presets");
  ul.innerHTML = "";
  for (const p of PRESETS) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.nome;
    b.addEventListener("click", () => aplicarPreset(p.id));
    li.appendChild(b);
    ul.appendChild(li);
  }
  aplicarPreset("cidade");
}

montarPresets();
$("btn-rodar").addEventListener("click", () => rodar());
$("btn-copiar").addEventListener("click", () => copiarRelatorio());
status("Escolha um preset ou coords e rode o bench.");
