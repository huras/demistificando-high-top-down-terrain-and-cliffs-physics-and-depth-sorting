import {
  LESTE,
  NORTE,
  OC_PAREDE,
  OESTE,
  PASSO_VERTICE,
  PECAS,
  QUEDA_LABIO,
  SUL,
} from "./catalogo.js";
import { alturaVizinha, idDaPeca } from "./mascara.js";

const LADOS = [
  { bit: SUL, nome: "s" },
  { bit: NORTE, nome: "n" },
  { bit: LESTE, nome: "e" },
  { bit: OESTE, nome: "w" },
];

function empurrar(lote, x, y, z, nx, ny, nz, u, v, oc) {
  lote.pos.push(x, y, z);
  lote.uv.push(u, v);
  lote.nor.push(nx, ny, nz);
  if (lote.cor) lote.cor.push(oc, oc, oc);
  if (lote.splat) lote.splat.push(0);
  if (lote.pele) lote.pele.push(0, 0);
}

export function carimbarTris(lote, tris, wx, wy, y) {
  const passo = PASSO_VERTICE;
  for (let i = 0; i < tris.length; i += passo) {
    const x = wx + tris[i];
    const z = wy + tris[i + 2];
    empurrar(
      lote,
      x,
      y + tris[i + 1],
      z,
      tris[i + 3],
      tris[i + 4],
      tris[i + 5],
      x,
      -z,
      tris[i + 6],
    );
  }
}

/** Quad do chão fundido. UV global, um tile por bloco. */
export function carimbarPlano(lote, x0, z0, x1, z1, y) {
  lote._n = [0, 1, 0];
  const v = [
    [x0, y, z0, x0, -z0],
    [x0, y, z1, x0, -z1],
    [x1, y, z0, x1, -z0],
    [x0, y, z1, x0, -z1],
    [x1, y, z1, x1, -z1],
    [x1, y, z0, x1, -z0],
  ];
  for (let i = 0; i < v.length; i++) {
    const p = v[i];
    empurrar(lote, p[0], p[1], p[2], 0, 1, 0, p[3], p[4], 1);
  }
}

function parede(lote, nome, wx, wy, yBase, yTopo) {
  const oc = OC_PAREDE;
  if (nome === "s") {
    const z = wy + 1;
    empurrar(lote, wx, yTopo, z, 0, 0, 1, 0, yTopo, oc);
    empurrar(lote, wx, yBase, z, 0, 0, 1, 0, yBase, oc);
    empurrar(lote, wx + 1, yTopo, z, 0, 0, 1, 1, yTopo, oc);
    empurrar(lote, wx, yBase, z, 0, 0, 1, 0, yBase, oc);
    empurrar(lote, wx + 1, yBase, z, 0, 0, 1, 1, yBase, oc);
    empurrar(lote, wx + 1, yTopo, z, 0, 0, 1, 1, yTopo, oc);
  } else if (nome === "n") {
    const z = wy;
    empurrar(lote, wx + 1, yTopo, z, 0, 0, -1, 0, yTopo, oc);
    empurrar(lote, wx + 1, yBase, z, 0, 0, -1, 0, yBase, oc);
    empurrar(lote, wx, yTopo, z, 0, 0, -1, 1, yTopo, oc);
    empurrar(lote, wx + 1, yBase, z, 0, 0, -1, 0, yBase, oc);
    empurrar(lote, wx, yBase, z, 0, 0, -1, 1, yBase, oc);
    empurrar(lote, wx, yTopo, z, 0, 0, -1, 1, yTopo, oc);
  } else if (nome === "e") {
    const x = wx + 1;
    empurrar(lote, x, yBase, wy, 1, 0, 0, 0, yBase, oc);
    empurrar(lote, x, yTopo, wy, 1, 0, 0, 0, yTopo, oc);
    empurrar(lote, x, yTopo, wy + 1, 1, 0, 0, 1, yTopo, oc);
    empurrar(lote, x, yBase, wy, 1, 0, 0, 0, yBase, oc);
    empurrar(lote, x, yTopo, wy + 1, 1, 0, 0, 1, yTopo, oc);
    empurrar(lote, x, yBase, wy + 1, 1, 0, 0, 1, yBase, oc);
  } else {
    const x = wx;
    empurrar(lote, x, yBase, wy + 1, -1, 0, 0, 0, yBase, oc);
    empurrar(lote, x, yTopo, wy + 1, -1, 0, 0, 0, yTopo, oc);
    empurrar(lote, x, yTopo, wy, -1, 0, 0, 1, yTopo, oc);
    empurrar(lote, x, yBase, wy + 1, -1, 0, 0, 0, yBase, oc);
    empurrar(lote, x, yTopo, wy, -1, 0, 0, 1, yTopo, oc);
    empurrar(lote, x, yBase, wy, -1, 0, 0, 1, yBase, oc);
  }
}

/**
 * Lábio e paredes de uma célula de borda.
 * O cap fica de fora quando o splat precisa do recorte do autotile.
 */
export function carimbarBorda(loteTopo, loteParede, grade, lx, ly, wx, wy, y, mascara, comCap) {
  const atual = PECAS[idDaPeca(mascara)];
  if (comCap && atual.topo.length) carimbarTris(loteTopo, atual.topo, wx, wy, y);
  if (atual.labio.length) carimbarTris(loteTopo, atual.labio, wx, wy, y);
  const quedas = [];
  for (let i = 0; i < LADOS.length; i++) {
    const lado = LADOS[i];
    if (!(mascara & lado.bit)) continue;
    const yBase = alturaVizinha(grade, lx, ly, lado.bit);
    const yTopo = y - QUEDA_LABIO;
    if (yTopo - yBase <= 1e-4) continue;
    parede(loteParede, lado.nome, wx, wy, yBase, yTopo);
    quedas.push({ nome: lado.nome, yBase, queda: y - yBase });
  }
  return { cap: atual, quedas };
}
