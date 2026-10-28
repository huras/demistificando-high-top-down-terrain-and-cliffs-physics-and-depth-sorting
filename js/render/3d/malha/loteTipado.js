/**
 * Lote de malha com Float32Array crescente — zero Array.push no hot path.
 * Sem Three: seguro no Worker. geoDoLoteTipado fica em loteTipadoGeo.js.
 */

const CAP_INICIAL = 256;

function crescer(buf, minCap) {
  let n = buf.length;
  while (n < minCap) n *= 2;
  const novo = new Float32Array(n);
  novo.set(buf);
  return novo;
}

/**
 * @param {boolean} [comCor]
 * @param {boolean} [comSplat]
 */
export function criarLoteTipado(comCor = false, comSplat = false) {
  return {
    pos: new Float32Array(CAP_INICIAL * 3),
    uv: new Float32Array(CAP_INICIAL * 2),
    nor: new Float32Array(CAP_INICIAL * 3),
    cor: comCor ? new Float32Array(CAP_INICIAL * 3) : null,
    splat: comSplat ? new Float32Array(CAP_INICIAL) : null,
    pele: comSplat ? new Float32Array(CAP_INICIAL * 2) : null,
    nVerts: 0,
    _splat: 0,
    _rgb: null,
    _n: [0, 1, 0],
  };
}

function garantir(lote, extras) {
  const preciso = lote.nVerts + extras;
  const cap = (lote.pos.length / 3) | 0;
  if (preciso <= cap) return;
  lote.pos = crescer(lote.pos, preciso * 3);
  lote.uv = crescer(lote.uv, preciso * 2);
  lote.nor = crescer(lote.nor, preciso * 3);
  if (lote.cor) lote.cor = crescer(lote.cor, preciso * 3);
  if (lote.splat) lote.splat = crescer(lote.splat, preciso);
  if (lote.pele) lote.pele = crescer(lote.pele, preciso * 2);
}

function escreverVert(lote, i, x, y, z, u, v, nx, ny, nz, r, g, b, splat, pu, pv) {
  const ip = i * 3;
  const iu = i * 2;
  lote.pos[ip] = x;
  lote.pos[ip + 1] = y;
  lote.pos[ip + 2] = z;
  lote.uv[iu] = u;
  lote.uv[iu + 1] = v;
  lote.nor[ip] = nx;
  lote.nor[ip + 1] = ny;
  lote.nor[ip + 2] = nz;
  if (lote.cor) {
    lote.cor[ip] = r;
    lote.cor[ip + 1] = g;
    lote.cor[ip + 2] = b;
  }
  if (lote.splat) lote.splat[i] = splat;
  if (lote.pele) {
    lote.pele[iu] = pu;
    lote.pele[iu + 1] = pv;
  }
}

/** Dois triângulos (6 verts) — mesma API do q6 legado. */
export function q6Tipado(lote, coords, uvs, peleUvs) {
  garantir(lote, 6);
  const base = lote.nVerts;
  const n = lote._n;
  const nx = n[0];
  const ny = n[1];
  const nz = n[2];
  const r = lote._rgb ? lote._rgb[0] : 1;
  const g = lote._rgb ? lote._rgb[1] : 1;
  const b = lote._rgb ? lote._rgb[2] : 1;
  const splat = lote._splat || 0;
  for (let i = 0; i < 6; i++) {
    const pu = peleUvs ? peleUvs[i * 2] : 0;
    const pv = peleUvs ? peleUvs[i * 2 + 1] : 0;
    escreverVert(
      lote,
      base + i,
      coords[i * 3],
      coords[i * 3 + 1],
      coords[i * 3 + 2],
      uvs[i * 2],
      uvs[i * 2 + 1],
      nx,
      ny,
      nz,
      r,
      g,
      b,
      splat,
      pu,
      pv,
    );
  }
  lote.nVerts = base + 6;
}

/** Triângulo solto (3 verts). */
export function pushTriTipado(lote, a, b, c) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
  const ca = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);
  if (ab < 1e-6 || bc < 1e-6 || ca < 1e-6) return;
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  lote._n = [nx, ny, nz];
  garantir(lote, 3);
  const base = lote.nVerts;
  const r = lote._rgb ? lote._rgb[0] : 1;
  const g = lote._rgb ? lote._rgb[1] : 1;
  const bCol = lote._rgb ? lote._rgb[2] : 1;
  const splat = lote._splat || 0;
  const pts = [a, b, c];
  for (let i = 0; i < 3; i++) {
    const p = pts[i];
    escreverVert(
      lote,
      base + i,
      p.x,
      p.y,
      p.z,
      p.u ?? (i === 0 ? 0 : i === 1 ? 1 : 0.5),
      p.v ?? (i === 2 ? 1 : 0),
      nx,
      ny,
      nz,
      r,
      g,
      bCol,
      splat,
      0,
      0,
    );
  }
  lote.nVerts = base + 3;
}

/** Quad horizontal XZ com UV fluxo (água). */
export function pushQuadAgua(lote, wx, wy, y, fx, fy, r, g, b) {
  lote._rgb = [r, g, b];
  lote._n = [0, 1, 0];
  let uvs = [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1];
  if (Math.abs(fy) > Math.abs(fx)) {
    uvs = [0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1];
  }
  if (fx < 0 || (fx === 0 && fy < 0)) {
    for (let i = 0; i < 6; i++) uvs[i * 2] = 1 - uvs[i * 2];
  }
  const x0 = wx;
  const x1 = wx + 1;
  const z0 = wy;
  const z1 = wy + 1;
  q6Tipado(
    lote,
    [
      x0, y, z0,
      x0, y, z1,
      x1, y, z0,
      x0, y, z1,
      x1, y, z1,
      x1, y, z0,
    ],
    uvs,
  );
}

/** Queda vertical (plano 1×h). */
export function pushQuadQueda(lote, wx, wy, y0, y1, dir) {
  const h = Math.max(0.2, y1 - y0);
  const yc = (y0 + y1) * 0.5;
  lote._rgb = [1, 1, 1];
  const uvs = [0, h, 0, 0, 1, h, 0, 0, 1, 0, 1, h];
  let coords;
  // Mesmo winding de pushCuboLote (frente pra fora).
  if (dir === "s") {
    lote._n = [0, 0, 1];
    coords = [
      wx, yc + h * 0.5, wy + 1,
      wx, yc - h * 0.5, wy + 1,
      wx + 1, yc + h * 0.5, wy + 1,
      wx, yc - h * 0.5, wy + 1,
      wx + 1, yc - h * 0.5, wy + 1,
      wx + 1, yc + h * 0.5, wy + 1,
    ];
  } else if (dir === "n") {
    lote._n = [0, 0, -1];
    coords = [
      wx + 1, yc + h * 0.5, wy,
      wx + 1, yc - h * 0.5, wy,
      wx, yc + h * 0.5, wy,
      wx + 1, yc - h * 0.5, wy,
      wx, yc - h * 0.5, wy,
      wx, yc + h * 0.5, wy,
    ];
  } else if (dir === "e") {
    lote._n = [1, 0, 0];
    coords = [
      wx + 1, yc - h * 0.5, wy,
      wx + 1, yc + h * 0.5, wy,
      wx + 1, yc + h * 0.5, wy + 1,
      wx + 1, yc - h * 0.5, wy,
      wx + 1, yc + h * 0.5, wy + 1,
      wx + 1, yc - h * 0.5, wy + 1,
    ];
  } else {
    lote._n = [-1, 0, 0];
    coords = [
      wx, yc - h * 0.5, wy + 1,
      wx, yc + h * 0.5, wy + 1,
      wx, yc + h * 0.5, wy,
      wx, yc - h * 0.5, wy + 1,
      wx, yc + h * 0.5, wy,
      wx, yc - h * 0.5, wy,
    ];
  }
  q6Tipado(lote, coords, uvs);
}

/** Ledge caixa sob o topo. */
export function pushLedge(lote, wx, wy, wzTopo, dir, corTopo, corFace) {
  const LEDGE_H = 0.12;
  const y = wzTopo - LEDGE_H;
  const y0 = y;
  const y1 = y + LEDGE_H;
  let x0;
  let x1;
  let z0;
  let z1;
  if (dir === "s") {
    x0 = wx;
    x1 = wx + 1;
    z0 = wy + 1 - 0.18;
    z1 = wy + 1;
  } else if (dir === "n") {
    x0 = wx;
    x1 = wx + 1;
    z0 = wy;
    z1 = wy + 0.18;
  } else if (dir === "e") {
    x0 = wx + 1 - 0.18;
    x1 = wx + 1;
    z0 = wy;
    z1 = wy + 1;
  } else {
    x0 = wx;
    x1 = wx + 0.18;
    z0 = wy;
    z1 = wy + 1;
  }
  const ct = hexParaRgb(corTopo);
  const cf = hexParaRgb(corFace);
  // Topo
  lote._rgb = [ct.r, ct.g, ct.b];
  lote._n = [0, 1, 0];
  q6Tipado(
    lote,
    [x0, y1, z0, x0, y1, z1, x1, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0],
    [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1],
  );
  // Faces laterais simplificadas (4 lados)
  lote._rgb = [cf.r * 0.88, cf.g * 0.88, cf.b * 0.88];
  lote._n = [0, 0, 1];
  q6Tipado(
    lote,
    [x0, y0, z1, x0, y1, z1, x1, y0, z1, x0, y1, z1, x1, y1, z1, x1, y0, z1],
    [0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0],
  );
  lote._n = [0, 0, -1];
  q6Tipado(
    lote,
    [x1, y0, z0, x1, y1, z0, x0, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z0],
    [0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0],
  );
  lote._n = [1, 0, 0];
  q6Tipado(
    lote,
    [x1, y0, z1, x1, y1, z1, x1, y0, z0, x1, y1, z1, x1, y1, z0, x1, y0, z0],
    [0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0],
  );
  lote._n = [-1, 0, 0];
  q6Tipado(
    lote,
    [x0, y0, z0, x0, y1, z0, x0, y0, z1, x0, y1, z0, x0, y1, z1, x0, y0, z1],
    [0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0],
  );
}

function hexParaRgb(hex) {
  const h = String(hex || "#ffffff").replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/**
 * Quad espuma XZ. v** = costa (0 água / 1 terra) → vai em UV.v e cor.
 * Empurra 2 tris não-indexados.
 */
export function pushQuadEspuma(lote, x0, z0, x1, z1, y, v00, v10, v11, v01) {
  lote._n = [0, 1, 0];
  garantir(lote, 6);
  const base = lote.nVerts;
  const verts = [
    [x0, y, z0, 0, v00, v00],
    [x1, y, z0, 0, v10, v10],
    [x1, y, z1, 0, v11, v11],
    [x0, y, z1, 0, v01, v01],
  ];
  // tris 0,2,1 e 0,3,2 (CCW de cima)
  const idx = [0, 2, 1, 0, 3, 2];
  for (let i = 0; i < 6; i++) {
    const v = verts[idx[i]];
    escreverVert(lote, base + i, v[0], v[1], v[2], v[3], v[4], 0, 1, 0, v[5], v[5], v[5], 0, 0, 0);
  }
  lote.nVerts = base + 6;
}

export function pushTriEspuma(lote, ax, az, bx, bz, cx, cz, y, va, vb, vc) {
  lote._n = [0, 1, 0];
  garantir(lote, 3);
  const base = lote.nVerts;
  const pts = [
    [ax, y, az, 0, va, va],
    [bx, y, bz, 0, vb, vb],
    [cx, y, cz, 0, vc, vc],
  ];
  for (let i = 0; i < 3; i++) {
    const v = pts[i];
    escreverVert(lote, base + i, v[0], v[1], v[2], v[3], v[4], 0, 1, 0, v[5], v[5], v[5], 0, 0, 0);
  }
  lote.nVerts = base + 3;
}

/** Copia atributos de um BufferGeometry (já non-indexed) para o lote. */
export function anexarGeoAoLote(lote, geo) {
  if (!geo?.attributes?.position) return;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const nor = geo.attributes.normal;
  const cor = geo.attributes.color;
  const splat = geo.attributes.splat;
  const pele = geo.attributes.peleUv;
  const n = pos.count;
  garantir(lote, n);
  const base = lote.nVerts;
  for (let i = 0; i < n; i++) {
    const ip = (base + i) * 3;
    const iu = (base + i) * 2;
    lote.pos[ip] = pos.getX(i);
    lote.pos[ip + 1] = pos.getY(i);
    lote.pos[ip + 2] = pos.getZ(i);
    lote.uv[iu] = uv ? uv.getX(i) : 0;
    lote.uv[iu + 1] = uv ? uv.getY(i) : 0;
    lote.nor[ip] = nor ? nor.getX(i) : 0;
    lote.nor[ip + 1] = nor ? nor.getY(i) : 1;
    lote.nor[ip + 2] = nor ? nor.getZ(i) : 0;
    if (lote.cor) {
      lote.cor[ip] = cor ? cor.getX(i) : 1;
      lote.cor[ip + 1] = cor ? cor.getY(i) : 1;
      lote.cor[ip + 2] = cor ? cor.getZ(i) : 1;
    }
    if (lote.splat) lote.splat[base + i] = splat ? splat.getX(i) : 0;
    if (lote.pele) {
      lote.pele[iu] = pele ? pele.getX(i) : 0;
      lote.pele[iu + 1] = pele ? pele.getY(i) : 0;
    }
  }
  lote.nVerts = base + n;
}

/** Copia verts de src → dest. */
export function anexarLoteAoLote(dest, src) {
  if (!dest || !src || src.nVerts <= 0) return;
  const n = src.nVerts;
  garantir(dest, n);
  const base = dest.nVerts;
  dest.pos.set(src.pos.subarray(0, n * 3), base * 3);
  dest.uv.set(src.uv.subarray(0, n * 2), base * 2);
  dest.nor.set(src.nor.subarray(0, n * 3), base * 3);
  if (dest.cor) {
    if (src.cor) dest.cor.set(src.cor.subarray(0, n * 3), base * 3);
    else dest.cor.fill(1, base * 3, (base + n) * 3);
  }
  if (dest.splat) {
    if (src.splat) dest.splat.set(src.splat.subarray(0, n), base);
    else dest.splat.fill(0, base, base + n);
  }
  if (dest.pele) {
    if (src.pele) dest.pele.set(src.pele.subarray(0, n * 2), base * 2);
    else dest.pele.fill(0, base * 2, (base + n) * 2);
  }
  dest.nVerts = base + n;
}

export { garantir as garantirCapLote };
