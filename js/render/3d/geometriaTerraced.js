/**
 * Malha terraced: topo plano por célula + paredes verticais onde a altura muda.
 * Topologia do Terreno 3D do gerador; coords mundo (x,z) e altura em blocos (y).
 */
import * as THREE from "three";

/**
 * @param {Float32Array} alturas grid (nx+1)*(ny+1), linha y depois x
 * @param {Float32Array} coresRgb cores por célula nx*ny*3 (0..1)
 * @param {{ ox: number, oy: number, passo: number, nx: number, ny: number }} opts
 * @returns {THREE.BufferGeometry | null}
 */
export function criarGeometriaTerraced(alturas, coresRgb, opts) {
  const { ox, oy, passo, nx, ny } = opts;
  if (nx < 1 || ny < 1 || passo <= 0) return null;

  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];

  function altura(ix, iy) {
    return alturas[iy * (nx + 1) + ix];
  }

  function corCelula(cx, cy, escuro) {
    const i = (cy * nx + cx) * 3;
    let r = coresRgb[i] ?? 0.4;
    let g = coresRgb[i + 1] ?? 0.55;
    let b = coresRgb[i + 2] ?? 0.3;
    if (escuro) {
      r *= 0.55;
      g *= 0.52;
      b *= 0.48;
    }
    return [r, g, b];
  }

  function addVert(x, y, z, nxn, nyn, nzn, u, v, rgb) {
    positions.push(x, y, z);
    normals.push(nxn, nyn, nzn);
    uvs.push(u, v);
    colors.push(rgb[0], rgb[1], rgb[2]);
  }

  /** Ordem CCW vista de +Y (igual ao terreno suave: i0,i2,i1 / i1,i2,i3). */
  function addQuadTopo(x0, z0, x1, z1, h, rgb, u0, v0, u1, v1) {
    addVert(x0, h, z0, 0, 1, 0, u0, v0, rgb);
    addVert(x0, h, z1, 0, 1, 0, u0, v1, rgb);
    addVert(x1, h, z0, 0, 1, 0, u1, v0, rgb);
    addVert(x1, h, z0, 0, 1, 0, u1, v0, rgb);
    addVert(x0, h, z1, 0, 1, 0, u0, v1, rgb);
    addVert(x1, h, z1, 0, 1, 0, u1, v1, rgb);
  }

  /**
   * Parede vertical: mesma ordem nos dois sentidos — a normal geométrica
   * aponta sozinha pro lado mais baixo (+X/−X ou +Z/−Z).
   */
  function addParedeX(x, z0, z1, hA, hB, rgb) {
    if (Math.abs(hA - hB) < 1e-4) return;
    const nxn = hA > hB ? 1 : -1;
    addVert(x, hB, z0, nxn, 0, 0, 0, 0, rgb);
    addVert(x, hA, z0, nxn, 0, 0, 0, 0, rgb);
    addVert(x, hB, z1, nxn, 0, 0, 0, 0, rgb);
    addVert(x, hA, z0, nxn, 0, 0, 0, 0, rgb);
    addVert(x, hA, z1, nxn, 0, 0, 0, 0, rgb);
    addVert(x, hB, z1, nxn, 0, 0, 0, 0, rgb);
  }

  function addParedeZ(z, x0, x1, hA, hB, rgb) {
    if (Math.abs(hA - hB) < 1e-4) return;
    const nzn = hA > hB ? 1 : -1;
    addVert(x0, hB, z, 0, 0, nzn, 0, 0, rgb);
    addVert(x1, hB, z, 0, 0, nzn, 0, 0, rgb);
    addVert(x0, hA, z, 0, 0, nzn, 0, 0, rgb);
    addVert(x1, hB, z, 0, 0, nzn, 0, 0, rgb);
    addVert(x1, hA, z, 0, 0, nzn, 0, 0, rgb);
    addVert(x0, hA, z, 0, 0, nzn, 0, 0, rgb);
  }

  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx < nx; cx++) {
      const h = altura(cx, cy);
      if (!Number.isFinite(h)) continue;

      const x0 = ox + cx * passo;
      const z0 = oy + cy * passo;
      const x1 = x0 + passo;
      const z1 = z0 + passo;
      const rgbTopo = corCelula(cx, cy, false);
      const rgbParede = corCelula(cx, cy, true);
      const u0 = x0;
      const v0 = -z0;
      const u1 = x1;
      const v1 = -z1;

      addQuadTopo(x0, z0, x1, z1, h, rgbTopo, u0, v0, u1, v1);

      // Inclui a última coluna/linha: canto nx/ny é a amostra do vizinho (fecha junta de chunk).
      const hR = altura(cx + 1, cy);
      if (Number.isFinite(hR)) addParedeX(x1, z0, z1, h, hR, rgbParede);
      const hS = altura(cx, cy + 1);
      if (Number.isFinite(hS)) addParedeZ(z1, x0, x1, h, hS, rgbParede);
    }
  }

  if (!positions.length) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingSphere();
  return geo;
}
