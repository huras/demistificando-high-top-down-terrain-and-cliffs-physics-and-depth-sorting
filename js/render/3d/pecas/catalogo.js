/**
 * Peças locais 0..1, alocadas uma vez.
 * Cada triângulo: x,y,z, nx,ny,nz, oclusão.
 * y = 0 é o piso andável. A parede começa em -QUEDA_LABIO.
 */

export const SUL = 1;
export const NORTE = 2;
export const LESTE = 4;
export const OESTE = 8;

export const LABIO = 0.2;
export const QUEDA_LABIO = 0.16;

const OC_TOPO = 1;
const OC_LABIO = 0.86;
const OC_CANTO = 0.78;
export const OC_PAREDE = 0.72;

const PASSO = 7;

function ponto(dest, p, nx, ny, nz, oc) {
  dest.push(p[0], p[1], p[2], nx, ny, nz, oc);
}

function soltar(dest, a, b, c, ox, oy, oz, oc) {
  let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
  let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-8) return;
  if (nx * ox + ny * oy + nz * oz < 0) {
    const troca = b;
    b = c;
    c = troca;
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  nx /= len;
  ny /= len;
  nz /= len;
  ponto(dest, a, nx, ny, nz, oc);
  ponto(dest, b, nx, ny, nz, oc);
  ponto(dest, c, nx, ny, nz, oc);
}

function faixa(dest, a, b, c, d, ox, oy, oz, oc) {
  soltar(dest, a, b, c, ox, oy, oz, oc);
  soltar(dest, b, d, c, ox, oy, oz, oc);
}

function canto(dest, interno, p, q, extremo, ox, oy, oz, oc) {
  soltar(dest, interno, p, extremo, ox, oy, oz, oc);
  soltar(dest, interno, extremo, q, ox, oy, oz, oc);
}

function montar(mascara) {
  const iS = mascara & SUL ? LABIO : 0;
  const iN = mascara & NORTE ? LABIO : 0;
  const iE = mascara & LESTE ? LABIO : 0;
  const iW = mascara & OESTE ? LABIO : 0;
  const q = QUEDA_LABIO;
  const topo = [];
  const labio = [];
  const x0 = iW;
  const z0 = iN;
  const x1 = 1 - iE;
  const z1 = 1 - iS;

  if (x1 - x0 > 1e-4 && z1 - z0 > 1e-4) {
    faixa(
      topo,
      [x0, 0, z0],
      [x0, 0, z1],
      [x1, 0, z0],
      [x1, 0, z1],
      0, 1, 0,
      OC_TOPO,
    );
  }

  if (iS && x1 - x0 > 1e-4) {
    faixa(
      labio,
      [x0, 0, z1],
      [x0, -q, 1],
      [x1, 0, z1],
      [x1, -q, 1],
      0, 1, 1,
      OC_LABIO,
    );
  }
  if (iN && x1 - x0 > 1e-4) {
    faixa(
      labio,
      [x1, 0, z0],
      [x1, -q, 0],
      [x0, 0, z0],
      [x0, -q, 0],
      0, 1, -1,
      OC_LABIO,
    );
  }
  if (iE && z1 - z0 > 1e-4) {
    faixa(
      labio,
      [x1, 0, z0],
      [1, -q, z0],
      [x1, 0, z1],
      [1, -q, z1],
      1, 1, 0,
      OC_LABIO,
    );
  }
  if (iW && z1 - z0 > 1e-4) {
    faixa(
      labio,
      [x0, 0, z1],
      [0, -q, z1],
      [x0, 0, z0],
      [0, -q, z0],
      -1, 1, 0,
      OC_LABIO,
    );
  }

  if (iS && iE) {
    canto(
      labio,
      [x1, 0, z1],
      [x1, -q, 1],
      [1, -q, z1],
      [1, -q, 1],
      1, 1, 1,
      OC_CANTO,
    );
  }
  if (iS && iW) {
    canto(
      labio,
      [x0, 0, z1],
      [0, -q, z1],
      [x0, -q, 1],
      [0, -q, 1],
      -1, 1, 1,
      OC_CANTO,
    );
  }
  if (iN && iE) {
    canto(
      labio,
      [x1, 0, z0],
      [1, -q, z0],
      [x1, -q, 0],
      [1, -q, 0],
      1, 1, -1,
      OC_CANTO,
    );
  }
  if (iN && iW) {
    canto(
      labio,
      [x0, 0, z0],
      [x0, -q, 0],
      [0, -q, z0],
      [0, -q, 0],
      -1, 1, -1,
      OC_CANTO,
    );
  }

  return {
    x0,
    z0,
    x1,
    z1,
    topo: Float32Array.from(topo),
    labio: Float32Array.from(labio),
  };
}

/** Índice = máscara dos 4 vizinhos mais baixos. */
export const PECAS = Array.from({ length: 16 }, (_, mascara) => montar(mascara));

export const PASSO_VERTICE = PASSO;
