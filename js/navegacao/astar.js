import { COLUNAS } from "../mundo/mapaDemo.js";
import { celulaDeChave, paraCadaVizinho } from "./navGrade.js";

/**
 * Min-heap por f (g+h). Índices 0-based.
 */
export function criarHeap() {
  return { keys: [], f: [] };
}

function heapPush(h, key, fScore) {
  h.keys.push(key);
  h.f.push(fScore);
  siftUp(h, h.keys.length - 1);
}

function heapPop(h) {
  const n = h.keys.length;
  if (n === 0) return -1;
  const root = h.keys[0];
  const lastK = h.keys.pop();
  const lastF = h.f.pop();
  if (n > 1) {
    h.keys[0] = lastK;
    h.f[0] = lastF;
    siftDown(h, 0);
  }
  return root;
}

function siftUp(h, i) {
  const { keys, f } = h;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (f[p] <= f[i]) break;
    swap(h, i, p);
    i = p;
  }
}

function siftDown(h, i) {
  const { keys, f } = h;
  const n = keys.length;
  while (true) {
    let menor = i;
    const l = i * 2 + 1;
    const r = l + 1;
    if (l < n && f[l] < f[menor]) menor = l;
    if (r < n && f[r] < f[menor]) menor = r;
    if (menor === i) break;
    swap(h, i, menor);
    i = menor;
  }
}

function swap(h, a, b) {
  let t = h.keys[a];
  h.keys[a] = h.keys[b];
  h.keys[b] = t;
  t = h.f[a];
  h.f[a] = h.f[b];
  h.f[b] = t;
}

export function heuristica(key, goalKey, cols = COLUNAS) {
  const ax = key % cols;
  const ay = (key / cols) | 0;
  const bx = goalKey % cols;
  const by = (goalKey / cols) | 0;
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

/**
 * Estado resumível de uma busca A*.
 */
export function criarBusca(grade, startKey, goalKey) {
  const n = grade.edges.length;
  const gScore = new Float32Array(n);
  gScore.fill(Infinity);
  gScore[startKey] = 0;

  const veioDe = new Int32Array(n);
  veioDe.fill(-1);
  const veioTipo = new Int8Array(n);
  veioTipo.fill(0);

  const fechado = new Uint8Array(n);
  const heap = criarHeap();
  const h0 = heuristica(startKey, goalKey, grade.cols);
  heapPush(heap, startKey, h0);

  return {
    grade,
    startKey,
    goalKey,
    gScore,
    veioDe,
    veioTipo,
    fechado,
    heap,
    melhorKey: startKey,
    melhorH: h0,
    pronto: false,
    achou: false,
    expansoes: 0,
  };
}

/**
 * Expande até `orcamento` nós. Retorna true se terminou (achou ou sem caminho).
 */
export function expandirBusca(busca, orcamento) {
  if (busca.pronto) return true;
  const { grade, goalKey, gScore, veioDe, veioTipo, fechado, heap } = busca;
  let restam = orcamento;

  while (restam > 0 && heap.keys.length > 0) {
    const atual = heapPop(heap);
    if (atual < 0) break;
    if (fechado[atual]) continue;
    fechado[atual] = 1;
    busca.expansoes++;
    restam--;

    if (atual === goalKey) {
      busca.pronto = true;
      busca.achou = true;
      busca.melhorKey = atual;
      return true;
    }

    const hAt = heuristica(atual, goalKey, grade.cols);
    if (hAt < busca.melhorH) {
      busca.melhorH = hAt;
      busca.melhorKey = atual;
    }

    paraCadaVizinho(grade, atual, (viz, custo, tipo) => {
      if (fechado[viz]) return;
      const tent = gScore[atual] + custo;
      if (tent >= gScore[viz]) return;
      veioDe[viz] = atual;
      veioTipo[viz] = tipo | 0;
      gScore[viz] = tent;
      const f = tent + heuristica(viz, goalKey, grade.cols);
      heapPush(heap, viz, f);
    });
  }

  if (heap.keys.length === 0) {
    busca.pronto = true;
    busca.achou = false;
    return true;
  }
  return false;
}

/** Reconstrói path de células {cx,cy,tipo}[] — tipo = aresta de entrada (0 no start). */
export function reconstruirCaminho(busca) {
  const fim = busca.achou ? busca.goalKey : busca.melhorKey;
  const keys = [];
  let k = fim;
  const guard = busca.grade.edges.length + 2;
  let passos = 0;
  while (k >= 0 && passos < guard) {
    keys.push(k);
    if (k === busca.startKey) break;
    k = busca.veioDe[k];
    passos++;
  }
  keys.reverse();

  const cells = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const { cx, cy } = celulaDeChave(keys[i]);
    const tipo = i === 0 ? 0 : busca.veioTipo[keys[i]] | 0;
    cells[i] = { cx, cy, key: keys[i], tipo };
  }
  return {
    cells,
    achou: busca.achou,
    startKey: busca.startKey,
    goalKey: busca.goalKey,
    fimKey: fim,
  };
}
