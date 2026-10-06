import { celulaDeChave, paraCadaVizinho } from "./navGrade.js";

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
  if (n === 0) return null;
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

export function heuristica(key, goalKey) {
  const a = celulaDeChave(key);
  const b = celulaDeChave(goalKey);
  const dx = Math.abs(a.cx - b.cx);
  const dy = Math.abs(a.cy - b.cy);
  return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

export function criarBusca(grade, startKey, goalKey) {
  const gScore = new Map();
  gScore.set(startKey, 0);

  const veioDe = new Map();
  const veioTipo = new Map();
  const fechado = new Set();
  const heap = criarHeap();
  const h0 = heuristica(startKey, goalKey);
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

export function expandirBusca(busca, orcamento) {
  if (busca.pronto) return true;
  const { grade, goalKey, gScore, veioDe, veioTipo, fechado, heap } = busca;
  let restam = orcamento;

  while (restam > 0 && heap.keys.length > 0) {
    const atual = heapPop(heap);
    if (atual == null) break;
    if (fechado.has(atual)) continue;
    fechado.add(atual);
    busca.expansoes++;
    restam--;

    if (atual === goalKey) {
      busca.pronto = true;
      busca.achou = true;
      busca.melhorKey = atual;
      return true;
    }

    const hAt = heuristica(atual, goalKey);
    if (hAt < busca.melhorH) {
      busca.melhorH = hAt;
      busca.melhorKey = atual;
    }

    const gAtual = gScore.get(atual) ?? Infinity;
    paraCadaVizinho(grade, atual, (viz, custo, tipo) => {
      if (fechado.has(viz)) return;
      const tent = gAtual + custo;
      if (tent >= (gScore.get(viz) ?? Infinity)) return;
      veioDe.set(viz, atual);
      veioTipo.set(viz, tipo | 0);
      gScore.set(viz, tent);
      heapPush(heap, viz, tent + heuristica(viz, goalKey));
    });
  }

  if (heap.keys.length === 0) {
    busca.pronto = true;
    busca.achou = false;
    return true;
  }
  return false;
}

export function reconstruirCaminho(busca) {
  const fim = busca.achou ? busca.goalKey : busca.melhorKey;
  const keys = [];
  let k = fim;
  let passos = 0;
  const guard = 100000;
  while (k != null && passos < guard) {
    keys.push(k);
    if (k === busca.startKey) break;
    k = busca.veioDe.get(k);
    if (k === undefined) break;
    passos++;
  }
  keys.reverse();

  const cells = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const { cx, cy } = celulaDeChave(keys[i]);
    const tipo = i === 0 ? 0 : busca.veioTipo.get(keys[i]) | 0;
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
