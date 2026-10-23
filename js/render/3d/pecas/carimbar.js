import { CHUNK_XZ } from "../../../config.js";
import { alturaEm } from "../../../mundo/altura.js";
import {
  LABIO,
  OC_PAREDE,
  PASSOS,
  celulaPlana,
  oclusaoDe,
  pontosLado,
  quadsDaCelula,
} from "./catalogo.js";

const N = CHUNK_XZ + 2;

const OPOSTO = { s: "n", n: "s", e: "w", w: "e" };
const DELTA = {
  s: { dx: 0, dy: 1 },
  n: { dx: 0, dy: -1 },
  e: { dx: 1, dy: 0 },
  w: { dx: -1, dy: 0 },
};
const FORA = { s: [0, 0, 1], n: [0, 0, -1], e: [1, 0, 0], w: [-1, 0, 0] };
const PERP0 = { s: "w", n: "w", w: "n", e: "n" };
const PERP3 = { s: "e", n: "e", w: "s", e: "s" };

function ler(grade, lx, ly, wx, wy) {
  const ix = lx + 1;
  const iy = ly + 1;
  if (ix >= 0 && iy >= 0 && ix < N && iy < N) return grade[iy * N + ix] | 0;
  return alturaEm(wx, wy) | 0;
}

function vizinhanca(grade, lx, ly, wx, wy) {
  const v = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let k = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      v[k++] = ler(grade, lx + dx, ly + dz, wx + dx, wy + dz);
    }
  }
  return v;
}

function empurrar(lote, x, y, z, nx, ny, nz, u, v, oc) {
  lote.pos.push(x, y, z);
  lote.uv.push(u, v);
  lote.nor.push(nx, ny, nz);
  if (lote.cor) lote.cor.push(oc, oc, oc);
  if (lote.splat) lote.splat.push(0);
  if (lote.pele) lote.pele.push(0, 0);
}

function normalDe(a, b, c) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-8) return null;
  return [nx / len, ny / len, nz / len];
}

function tri(lote, a, b, c, uva, uvb, uvc, oca, ocb, occ, fora, virado) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
  const ca = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);
  if (ab < 1e-6 || bc < 1e-6 || ca < 1e-6) return;
  const n = normalDe(a, b, c);
  if (!n) return;
  if (!virado && n[0] * fora[0] + n[1] * fora[1] + n[2] * fora[2] < 0) {
    tri(lote, a, c, b, uva, uvc, uvb, oca, occ, ocb, fora, true);
    return;
  }
  empurrar(lote, a.x, a.y, a.z, n[0], n[1], n[2], uva[0], uva[1], oca);
  empurrar(lote, b.x, b.y, b.z, n[0], n[1], n[2], uvb[0], uvb[1], ocb);
  empurrar(lote, c.x, c.y, c.z, n[0], n[1], n[2], uvc[0], uvc[1], occ);
}

function noMundo(p, wx, wy) {
  return { x: wx + p.x, y: p.y, z: wy + p.z };
}

function uvChao(p) {
  return [p.x, -p.z];
}

function emitirQuad(lote, q, wx, wy, h) {
  const pts = q.map((p) => noMundo(p, wx, wy));
  const oc = q.map((p) => oclusaoDe(p.y, h));
  const uv = pts.map(uvChao);
  if (q.length === 3) {
    tri(lote, pts[0], pts[1], pts[2], uv[0], uv[1], uv[2], oc[0], oc[1], oc[2], [0, 1, 0]);
    return;
  }
  tri(lote, pts[0], pts[1], pts[2], uv[0], uv[1], uv[2], oc[0], oc[1], oc[2], [0, 1, 0]);
  tri(lote, pts[1], pts[3], pts[2], uv[1], uv[3], uv[2], oc[1], oc[3], oc[2], [0, 1, 0]);
}

function chanfrosDe(viz) {
  const h = viz[4];
  const convexo = (hX, hZ, hXZ) => hX >= h - 1e-4 && hZ >= h - 1e-4 && hXZ < h - 1e-4;
  return {
    nw: convexo(viz[3], viz[1], viz[0]),
    ne: convexo(viz[5], viz[1], viz[2]),
    sw: convexo(viz[3], viz[7], viz[6]),
    se: convexo(viz[5], viz[7], viz[8]),
  };
}

function indiceCanto(lado, perp) {
  if (lado === "n" || lado === "s") return perp === "w" ? 0 : 3;
  return perp === "n" ? 0 : 3;
}

function yDoCanto(grade, lx, ly, wx, wy, lado, perp) {
  const viz = vizinhanca(grade, lx, ly, wx, wy);
  return pontosLado(viz, lado)[indiceCanto(lado, perp)].y;
}

/** Alturas das quatro células que se encontram na quina. */
function ysNaQuina(grade, lx, ly, wx, wy, lado, perp) {
  const dL = DELTA[lado];
  const dP = DELTA[perp];
  return [
    yDoCanto(grade, lx, ly, wx, wy, lado, perp),
    yDoCanto(grade, lx + dL.dx, ly + dL.dy, wx + dL.dx, wy + dL.dy, OPOSTO[lado], perp),
    yDoCanto(grade, lx + dP.dx, ly + dP.dy, wx + dP.dx, wy + dP.dy, OPOSTO[perp], lado),
    yDoCanto(
      grade,
      lx + dL.dx + dP.dx,
      ly + dL.dy + dP.dy,
      wx + dL.dx + dP.dx,
      wy + dL.dy + dP.dy,
      OPOSTO[lado],
      OPOSTO[perp],
    ),
  ];
}

function entre(y0, y1, ys) {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  const out = [];
  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    if (y <= lo + 1e-4 || y >= hi - 1e-4) continue;
    let novo = true;
    for (let k = 0; k < out.length; k++) {
      if (Math.abs(out[k] - y) < 1e-4) novo = false;
    }
    if (novo) out.push(y);
  }
  out.sort((a, b) => (y0 <= y1 ? a - b : b - a));
  return out;
}

function polilinha(p0, p1, cortes) {
  const ys = entre(p0.y, p1.y, cortes);
  const pts = [p0];
  for (let i = 0; i < ys.length; i++) pts.push({ x: p0.x, y: ys[i], z: p0.z, u: p0.u });
  if (Math.abs(p0.y - p1.y) > 1e-4) pts.push(p1);
  return pts;
}

function progresso(y0, y1, y) {
  const d = y1 - y0;
  if (Math.abs(d) < 1e-8) return 0;
  return (y - y0) / d;
}

function costurar(lote, esq, dir, fora) {
  let i = 0;
  let j = 0;
  const uv = (p) => [p.u, p.y];
  const yFimE = esq[esq.length - 1].y;
  const yFimD = dir[dir.length - 1].y;
  while (i < esq.length - 1 || j < dir.length - 1) {
    const podeE = i < esq.length - 1;
    const podeD = j < dir.length - 1;
    let avancaE = podeE;
    if (podeE && podeD) {
      const tE = progresso(esq[0].y, yFimE, esq[i + 1].y);
      const tD = progresso(dir[0].y, yFimD, dir[j + 1].y);
      avancaE = tE <= tD + 1e-6;
    }
    if (avancaE) {
      tri(lote, esq[i], esq[i + 1], dir[j], uv(esq[i]), uv(esq[i + 1]), uv(dir[j]), OC_PAREDE, OC_PAREDE, OC_PAREDE, fora);
      i++;
    } else {
      tri(lote, dir[j], esq[i], dir[j + 1], uv(dir[j]), uv(esq[i]), uv(dir[j + 1]), OC_PAREDE, OC_PAREDE, OC_PAREDE, fora);
      j++;
    }
  }
}

function faixa(lote, cima, baixo, fora, cortes0, cortes3) {
  for (let i = 0; i < 3; i++) {
    const cortesEsq = i === 0 ? cortes0 : [];
    const cortesDir = i === 2 ? cortes3 : [];
    costurar(
      lote,
      polilinha(cima[i], baixo[i], cortesEsq),
      polilinha(cima[i + 1], baixo[i + 1], cortesDir),
      fora,
    );
  }
}

function dentroDoCap(p, cap) {
  return p.x >= cap.x0 - 1e-4 && p.x <= cap.x1 + 1e-4 && p.z >= cap.z0 - 1e-4 && p.z <= cap.z1 + 1e-4;
}

function capDe(viz) {
  const h = viz[4];
  let x0 = viz[3] < h ? LABIO : 0;
  let x1 = viz[5] < h ? 1 - LABIO : 1;
  let z0 = viz[1] < h ? LABIO : 0;
  let z1 = viz[7] < h ? 1 - LABIO : 1;
  // LABIO>0.5: lábios opostos se cruzam — cap plano some.
  if (x0 > x1) x0 = x1 = (x0 + x1) * 0.5;
  if (z0 > z1) z0 = z1 = (z0 + z1) * 0.5;
  return { x0, x1, z0, z1 };
}

/**
 * Superfície, saia e paredes de uma célula.
 * O cap plano sai fora quando o splat precisa do recorte do autotile.
 */
export function carimbarBorda(loteTopo, loteParede, grade, lx, ly, wx, wy, _y, _mascara, comCap) {
  const viz = vizinhanca(grade, lx, ly, wx, wy);
  const h = viz[4];
  const cap = capDe(viz);
  const chanfros = chanfrosDe(viz);
  const { topo, saia } = quadsDaCelula(viz);
  for (let i = 0; i < saia.length; i++) emitirQuad(loteParede, saia[i], wx, wy, h);
  for (let i = 0; i < topo.length; i++) {
    const q = topo[i];
    if (!comCap && q.every((p) => dentroDoCap(p, cap) && p.y >= h - 1e-4)) continue;
    emitirQuad(loteTopo, q, wx, wy, h);
  }

  const quedas = [];
  const lados = ["s", "n", "e", "w"];
  for (let i = 0; i < lados.length; i++) {
    const nome = lados[i];
    const d = DELTA[nome];
    const hViz = ler(grade, lx + d.dx, ly + d.dy, wx + d.dx, wy + d.dy);
    if (hViz >= h) continue;
    const cimaLocal = pontosLado(viz, nome);
    const vizN = vizinhanca(grade, lx + d.dx, ly + d.dy, wx + d.dx, wy + d.dy);
    const baixoLocal = pontosLado(vizN, OPOSTO[nome]);
    const uDe = nome === "s" || nome === "n" ? (p) => p.x : (p) => p.z;
    const cima = cimaLocal.map((p) => {
      const w = noMundo(p, wx, wy);
      w.u = uDe(w);
      return w;
    });
    const baixo = baixoLocal.map((p) => {
      const w = noMundo(p, wx + d.dx, wy + d.dy);
      w.u = uDe(w);
      return w;
    });
    faixa(
      loteParede,
      cima,
      baixo,
      FORA[nome],
      ysNaQuina(grade, lx, ly, wx, wy, nome, PERP0[nome]),
      ysNaQuina(grade, lx, ly, wx, wy, nome, PERP3[nome]),
    );
    quedas.push({ nome, yBase: hViz, queda: h - hViz });
  }

  return { cap, chanfros, quedas };
}

function unico(valores) {
  const out = [];
  for (let i = 0; i < valores.length; i++) {
    if (!out.length || Math.abs(out[out.length - 1] - valores[i]) > 1e-4) out.push(valores[i]);
  }
  return out;
}

function eixo(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const n = Math.round(hi - lo);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const base = lo + i;
    const fim = i === n - 1 ? 4 : 3;
    for (let k = 0; k < fim; k++) pts.push(base + PASSOS[k]);
  }
  if (!pts.length) pts.push(lo, hi);
  const asc = unico(pts);
  if (a > b) asc.reverse();
  return asc;
}

export function planaNo(grade, lx, ly, wx, wy) {
  return celulaPlana(vizinhanca(grade, lx, ly, wx, wy));
}

function contorno(x0, z0, x1, z1) {
  const sul = eixo(x0, x1);
  const leste = eixo(z1, z0);
  const norte = eixo(x1, x0);
  const oeste = eixo(z0, z1);
  const anel = [];
  for (let i = 0; i < oeste.length - 1; i++) anel.push({ x: x0, z: oeste[i] });
  for (let i = 0; i < sul.length - 1; i++) anel.push({ x: sul[i], z: z1 });
  for (let i = 0; i < leste.length - 1; i++) anel.push({ x: x1, z: leste[i] });
  for (let i = 0; i < norte.length - 1; i++) anel.push({ x: norte[i], z: z0 });
  return anel;
}

/** Chão fundido. O perímetro repete a grade da célula, senão a borda fica aberta. */
export function carimbarPlano(lote, x0, z0, x1, z1, y) {
  const anel = contorno(x0, z0, x1, z1);
  if (anel.length < 3) return;
  const cx = (x0 + x1) * 0.5;
  const cz = (z0 + z1) * 0.5;
  const centro = { x: cx, y, z: cz };
  for (let i = 0; i < anel.length; i++) {
    const a = { x: anel[i].x, y, z: anel[i].z };
    const b = { x: anel[(i + 1) % anel.length].x, y, z: anel[(i + 1) % anel.length].z };
    tri(lote, centro, a, b, uvChao(centro), uvChao(a), uvChao(b), 1, 1, 1, [0, 1, 0]);
  }
}

