/**
 * Inundação amortizada: ar cavado adjacente a líquido enche até a superfície da fonte.
 * Sem níveis Minecraft — fonte infinita. fluxo.js só cuida de corrente.
 */
import {
  CHUNK_Y,
  INUNDAR_CELULAS_POR_FRAME,
  INUNDAR_FILA_MAX,
} from "../../config.js";
import { invalidarNavCache } from "../../navegacao/navGrade.js";
import {
  chunkCarregadoEm,
  definirLiquidoLote,
  obterBloco,
} from "../voxel/storeMundo.js";
import { BLOCO, ehLiquido } from "../voxel/tiposBloco.js";
import { FLUIDO, fluidoDe } from "./fluidos.js";
import { colunaAgua } from "./fluxo.js";

const VIZ = Object.freeze([
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]);

/** @type {{ x: number, y: number, z: number, superficie: number, fluido: number }[]} */
const fila = [];
let filaIni = 0;
/** @type {Set<string>} */
const visitado = new Set();

function chave(x, y, z) {
  return `${x|0},${y|0},${z|0}`;
}

function filaTam() {
  return fila.length - filaIni;
}

function compactarFila() {
  if (filaIni === 0) return;
  if (filaIni > 64 && filaIni * 2 > fila.length) {
    fila.splice(0, filaIni);
    filaIni = 0;
  }
}

function enfileirar(x, y, z, superficie, fluido) {
  const xi = x | 0;
  const yi = y | 0;
  const zi = z | 0;
  const sup = superficie | 0;
  if (zi < 0 || zi >= CHUNK_Y || zi >= sup) return;
  if (!chunkCarregadoEm(xi, yi)) return;
  const k = chave(xi, yi, zi);
  if (visitado.has(k)) return;
  if (filaTam() >= INUNDAR_FILA_MAX) return;
  visitado.add(k);
  fila.push({
    x: xi,
    y: yi,
    z: zi,
    superficie: sup,
    fluido: fluido | 0,
  });
}

function fonteRepouso(wx, wy) {
  const col = colunaAgua(wx, wy);
  if (!(col.superficie > 0) || col.caindo) return null;
  const fam = col.fluido | 0;
  return {
    superficie: col.superficie | 0,
    fluido: fam > 0 ? fam : FLUIDO.AGUA,
  };
}

/**
 * Após criar ar em (x,y,z): semente a partir de líquidos em repouso vizinhos.
 * Se o próprio líquido foi quebrado, também tenta encher o buraco e o ar ao redor.
 */
export function semearInundacao(x, y, z) {
  const xi = x | 0;
  const yi = y | 0;
  const zi = z | 0;

  for (let i = 0; i < VIZ.length; i++) {
    const nx = xi + VIZ[i][0];
    const ny = yi + VIZ[i][1];
    const nz = zi + VIZ[i][2];
    if (!ehLiquido(obterBloco(nx, ny, nz))) continue;
    const fonte = fonteRepouso(nx, ny);
    if (!fonte) continue;
    enfileirar(xi, yi, zi, fonte.superficie, fonte.fluido);
  }

  // Buraco abaixo da lâmina de uma coluna líquida na mesma XZ (topo aberto).
  const acima = fonteRepouso(xi, yi);
  if (acima && zi < acima.superficie) {
    enfileirar(xi, yi, zi, acima.superficie, acima.fluido);
  }

  // Líquido quebrado: vizinhos ar podem precisar de refill da fonte.
  for (let i = 0; i < VIZ.length; i++) {
    const ax = xi + VIZ[i][0];
    const ay = yi + VIZ[i][1];
    const az = zi + VIZ[i][2];
    if (obterBloco(ax, ay, az) !== BLOCO.AR) continue;
    for (let j = 0; j < VIZ.length; j++) {
      const nx = ax + VIZ[j][0];
      const ny = ay + VIZ[j][1];
      const nz = az + VIZ[j][2];
      if (!ehLiquido(obterBloco(nx, ny, nz))) continue;
      const fonte = fonteRepouso(nx, ny);
      if (!fonte) continue;
      enfileirar(ax, ay, az, fonte.superficie, fonte.fluido);
    }
  }
}

/** Processa até INUNDAR_CELULAS_POR_FRAME células. */
export function tickInundar() {
  if (filaIni >= fila.length) {
    fila.length = 0;
    filaIni = 0;
    visitado.clear();
    return;
  }

  const lote = [];
  let processados = 0;
  const teto = INUNDAR_CELULAS_POR_FRAME | 0;

  while (processados < teto && filaIni < fila.length) {
    const item = fila[filaIni++];
    processados++;
    const { x, y, z, superficie, fluido } = item;
    if (!chunkCarregadoEm(x, y)) continue;
    if (obterBloco(x, y, z) !== BLOCO.AR) continue;
    if (z >= superficie) continue;

    const fam = fluidoDe(fluido) || fluidoDe(FLUIDO.AGUA);
    lote.push({ x, y, z, id: fam.bloco, fluido: fam.id });

    for (let i = 0; i < VIZ.length; i++) {
      const nx = x + VIZ[i][0];
      const ny = y + VIZ[i][1];
      const nz = z + VIZ[i][2];
      if (nz < 0 || nz >= CHUNK_Y || nz >= superficie) continue;
      if (!chunkCarregadoEm(nx, ny)) continue;
      if (obterBloco(nx, ny, nz) !== BLOCO.AR) continue;
      enfileirar(nx, ny, nz, superficie, fluido);
    }
  }

  compactarFila();
  if (filaIni >= fila.length) {
    fila.length = 0;
    filaIni = 0;
    // Mantém visitado enquanto a onda pode ainda crescer via novos seeds;
    // limpa só quando a fila esvazia de verdade.
    visitado.clear();
  }

  if (lote.length && definirLiquidoLote(lote) > 0) {
    invalidarNavCache();
  }
}
