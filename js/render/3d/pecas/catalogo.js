/**
 * Superfície da célula numa grade fixa.
 * Os dois lados de uma aresta usam os mesmos parâmetros, então a solda fecha.
 * y da quina sai só das quatro alturas que se encontram ali.
 */

export const SUL = 1;
export const NORTE = 2;
export const LESTE = 4;
export const OESTE = 8;

export const LABIO = 0.2;
export const QUEDA_LABIO = 0.16;
export const PASSOS = [0, LABIO, 1 - LABIO, 1];

const OC_TOPO = 1;
const OC_LABIO = 0.86;
export const OC_PAREDE = 0.72;

function yCanto(h, hX, hZ, hXZ) {
  const desceX = hX < h;
  const desceZ = hZ < h;
  const contPeloX = hX === h && hXZ < hX;
  const contPeloZ = hZ === h && hXZ < hZ;
  if (desceX || desceZ || contPeloX || contPeloZ) return h - QUEDA_LABIO;
  return h;
}

function yMeio(h, hLado) {
  return hLado < h ? h - QUEDA_LABIO : h;
}

/** Alturas absolutas da grade 4×4. viz é o 3×3 com o centro em [4]. */
export function alturasGrade(viz) {
  const h = viz[4];
  const ys = new Float64Array(16);
  const canto = [
    yCanto(h, viz[3], viz[1], viz[0]),
    yCanto(h, viz[5], viz[1], viz[2]),
    yCanto(h, viz[3], viz[7], viz[6]),
    yCanto(h, viz[5], viz[7], viz[8]),
  ];
  for (let iz = 0; iz < 4; iz++) {
    for (let ix = 0; ix < 4; ix++) {
      let y = h;
      if (ix === 0 && iz === 0) y = canto[0];
      else if (ix === 3 && iz === 0) y = canto[1];
      else if (ix === 0 && iz === 3) y = canto[2];
      else if (ix === 3 && iz === 3) y = canto[3];
      else if (iz === 0) y = yMeio(h, viz[1]);
      else if (iz === 3) y = yMeio(h, viz[7]);
      else if (ix === 0) y = yMeio(h, viz[3]);
      else if (ix === 3) y = yMeio(h, viz[5]);
      ys[iz * 4 + ix] = y;
    }
  }
  return ys;
}

export function celulaPlana(viz) {
  const h = viz[4];
  const ys = alturasGrade(viz);
  for (let i = 0; i < ys.length; i++) {
    if (ys[i] !== h) return false;
  }
  return true;
}

function ponto(ys, ix, iz) {
  return { x: PASSOS[ix], y: ys[iz * 4 + ix], z: PASSOS[iz] };
}

/**
 * Quads da superfície. `topo` fica na textura do chão, `saia` na do penhasco.
 * Cada quad: quatro pontos em ordem (x0,z0), (x0,z1), (x1,z0), (x1,z1).
 */
export function quadsDaCelula(viz) {
  const h = viz[4];
  const ys = alturasGrade(viz);
  const topo = [];
  const saia = [];
  for (let iz = 0; iz < 3; iz++) {
    for (let ix = 0; ix < 3; ix++) {
      const q = [ponto(ys, ix, iz), ponto(ys, ix, iz + 1), ponto(ys, ix + 1, iz), ponto(ys, ix + 1, iz + 1)];
      let baixo = false;
      for (let i = 0; i < 4; i++) {
        if (q[i].y < h - 1e-4) baixo = true;
      }
      (baixo ? saia : topo).push(q);
    }
  }
  return { topo, saia, h };
}

const LADO = {
  n: { ix: [0, 1, 2, 3], iz: [0, 0, 0, 0] },
  s: { ix: [0, 1, 2, 3], iz: [3, 3, 3, 3] },
  w: { ix: [0, 0, 0, 0], iz: [0, 1, 2, 3] },
  e: { ix: [3, 3, 3, 3], iz: [0, 1, 2, 3] },
};

/** Quatro pontos da aresta, no sentido crescente de x (n/s) ou de z (w/e). */
export function pontosLado(viz, lado) {
  const ys = alturasGrade(viz);
  const spec = LADO[lado];
  const pts = [];
  for (let i = 0; i < 4; i++) pts.push(ponto(ys, spec.ix[i], spec.iz[i]));
  return pts;
}

export function oclusaoDe(y, h) {
  return y < h - 1e-4 ? OC_LABIO : OC_TOPO;
}
