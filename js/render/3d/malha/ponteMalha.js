/**
 * Fila de malha async: 1 job in-flight no Worker; fallback sync no main.
 */
import { scoreChunk, obterContextoPrioridade } from "../../../mundo/voxel/prioridadeChunk.js";
import { capturarSnapshotChunk } from "./snapshotChunk.js";
import { hidratarLotes, malharDeSnapshot } from "./mesherSnapshot.js";

let worker = null;
/** null = ainda não tentou; true/false após init */
let workerOk = null;
let seq = 1;
/** @type {Map<number, {cx:number,cy:number,rev:number}>} */
const pendentes = new Map();
/** @type {Array<{cx:number,cy:number,rev:number,chunk:object,score:number}>} */
const fila = [];
/** @type {Map<string, {meta:object, lotes:object}>} */
const prontos = new Map();
let emVoo = false;

function chave(cx, cy) {
  return `${cx},${cy}`;
}

function garantirWorker() {
  if (workerOk === false) return false;
  if (worker) return true;
  try {
    worker = new Worker(new URL("./malha.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg) {
        emVoo = false;
        bombear();
        return;
      }
      const ped = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (ped && msg.tipo === "pronto") {
        prontos.set(chave(ped.cx, ped.cy), {
          meta: msg.meta,
          lotes: hidratarLotes(msg.lotes),
        });
      }
      emVoo = false;
      bombear();
    };
    worker.onerror = () => {
      workerOk = false;
      emVoo = false;
      try {
        worker?.terminate();
      } catch (_) {}
      worker = null;
    };
    workerOk = true;
  } catch (_) {
    workerOk = false;
    worker = null;
  }
  return workerOk === true;
}

function bombear() {
  if (emVoo || !fila.length) return;
  if (!garantirWorker()) {
    const job = fila.shift();
    if (!job) return;
    try {
      const { payload } = capturarSnapshotChunk(job.chunk);
      const out = malharDeSnapshot(payload);
      prontos.set(chave(job.cx, job.cy), {
        meta: out.meta,
        lotes: hidratarLotes(out.lotes),
      });
    } catch (_) {
      /* tickMalha usa generator clássico */
    }
    return;
  }
  const job = fila.shift();
  if (!job) return;
  emVoo = true;
  const id = seq++;
  pendentes.set(id, { cx: job.cx, cy: job.cy, rev: job.rev });
  try {
    const { payload, buffers } = capturarSnapshotChunk(job.chunk);
    worker.postMessage({ tipo: "malhar", id, snap: payload }, buffers);
  } catch (_) {
    pendentes.delete(id);
    emVoo = false;
    workerOk = false;
  }
}

/** Worker utilizável (ou ainda não falhou). */
export function malhaWorkerAtivo() {
  if (workerOk === false) return false;
  garantirWorker();
  return workerOk === true;
}

/**
 * Enfileira chunk sujo. Dedup por cx,cy (mantém rev mais novo).
 */
export function enfileirarMalhaWorker(chunk) {
  if (!chunk) return;
  const cx = chunk.cx | 0;
  const cy = chunk.cy | 0;
  const rev = chunk.rev | 0;
  const k = chave(cx, cy);
  prontos.delete(k);
  for (let i = fila.length - 1; i >= 0; i--) {
    if (fila[i].cx === cx && fila[i].cy === cy) fila.splice(i, 1);
  }
  const ctx = obterContextoPrioridade();
  const sc = ctx ? scoreChunk(cx, cy, ctx) : 0;
  const job = { cx, cy, rev, chunk, score: sc };
  let inseriu = false;
  for (let i = 0; i < fila.length; i++) {
    if (job.score < fila[i].score) {
      fila.splice(i, 0, job);
      inseriu = true;
      break;
    }
  }
  if (!inseriu) fila.push(job);
  bombear();
}

/** @returns {{ meta: object, lotes: object } | null} */
export function consumirMalhaPronta(cx, cy, rev) {
  const k = chave(cx, cy);
  const r = prontos.get(k);
  if (!r) return null;
  if ((r.meta?.rev | 0) !== (rev | 0)) {
    prontos.delete(k);
    return null;
  }
  prontos.delete(k);
  return r;
}

export function cancelarMalhaWorker() {
  fila.length = 0;
  pendentes.clear();
  prontos.clear();
  emVoo = false;
  if (worker) {
    try {
      worker.terminate();
    } catch (_) {}
    worker = null;
  }
  // Permite recriar no próximo uso (mesmo após erro anterior).
  workerOk = null;
}

export function tickPonteMalha() {
  bombear();
}
