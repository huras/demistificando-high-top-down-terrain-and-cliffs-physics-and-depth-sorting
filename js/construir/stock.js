/**
 * Estoque de casas / móveis reciclados (além de materiais crus).
 */

/** @type {{ key: string, count: number }[]} */
let furnitureStock = [];
/** @type {{ key: string, count: number }[]} */
let houseStock = [];

function achar(lista, key) {
  return lista.find((r) => r.key === key) || null;
}

export function contarStockMovel(key) {
  return achar(furnitureStock, key)?.count | 0;
}

export function contarStockCasa(key) {
  return achar(houseStock, key)?.count | 0;
}

export function adicionarStockMovel(key, n = 1) {
  const q = n | 0;
  if (!key || q <= 0) return;
  const row = achar(furnitureStock, key);
  if (row) row.count = (row.count | 0) + q;
  else furnitureStock.push({ key, count: q });
}

export function adicionarStockCasa(key, n = 1) {
  const q = n | 0;
  if (!key || q <= 0) return;
  const row = achar(houseStock, key);
  if (row) row.count = (row.count | 0) + q;
  else houseStock.push({ key, count: q });
}

export function consumirStockMovel(key, n = 1) {
  const row = achar(furnitureStock, key);
  const q = n | 0;
  if (!row || (row.count | 0) < q) return false;
  row.count -= q;
  if (row.count <= 0) {
    const i = furnitureStock.indexOf(row);
    if (i >= 0) furnitureStock.splice(i, 1);
  }
  return true;
}

export function consumirStockCasa(key, n = 1) {
  const row = achar(houseStock, key);
  const q = n | 0;
  if (!row || (row.count | 0) < q) return false;
  row.count -= q;
  if (row.count <= 0) {
    const i = houseStock.indexOf(row);
    if (i >= 0) houseStock.splice(i, 1);
  }
  return true;
}

export function listarStockMovel() {
  return furnitureStock.map((r) => ({ ...r }));
}

export function listarStockCasa() {
  return houseStock.map((r) => ({ ...r }));
}

export function serializarStock() {
  return {
    furnitureStock: furnitureStock.map((r) => ({ key: r.key, count: r.count | 0 })),
    houseStock: houseStock.map((r) => ({ key: r.key, count: r.count | 0 })),
  };
}

export function hidratarStock(dados) {
  furnitureStock = [];
  houseStock = [];
  for (const r of dados?.furnitureStock || []) {
    if (r?.key && (r.count | 0) > 0) furnitureStock.push({ key: r.key, count: r.count | 0 });
  }
  for (const r of dados?.houseStock || []) {
    if (r?.key && (r.count | 0) > 0) houseStock.push({ key: r.key, count: r.count | 0 });
  }
}

export function resetStock() {
  furnitureStock = [];
  houseStock = [];
}
