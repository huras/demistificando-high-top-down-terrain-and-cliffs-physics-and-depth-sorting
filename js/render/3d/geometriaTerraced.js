/**
 * Malha terraced: topo plano por célula + paredes verticais onde a altura muda.
 * Topologia do Terreno 3D do gerador; coords mundo (x,z) e altura em blocos (y).
 */
import * as THREE from "three";

/**
 * @param {Float32Array} alturas grid (nx+1)*(ny+1)
 * @param {Float32Array} coresRgb cores por célula nx*ny*3 (0..1)
 * @param {{ ox: number, oy: number, passo: number, nx: number, ny: number, uvEscala?: number, bioma?: Float32Array, splat?: Float32Array }} opts
 */
export function criarGeometriaTerraced(alturas, coresRgb, opts) {
  const { ox, oy, passo, nx, ny } = opts;
  const uvEsc = Math.max(1e-6, opts.uvEscala || passo);
  const biomaCel = opts.bioma || null;
  const splatCel = opts.splat || null;
  if (nx < 1 || ny < 1 || passo <= 0) return null;

  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const biomas = biomaCel ? [] : null;
  const splats = splatCel ? [] : null;

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

  function dadosBioma(cx, cy) {
    if (!biomaCel) return null;
    const i = (cy * nx + cx) * 3;
    return {
      a: biomaCel[i] ?? 0,
      b: biomaCel[i + 1] ?? 0,
      peso: biomaCel[i + 2] ?? 1,
      splat: splatCel ? splatCel[cy * nx + cx] ?? 0 : 0,
    };
  }

  function addVert(x, y, z, nxn, nyn, nzn, u, v, rgb, bio) {
    positions.push(x, y, z);
    normals.push(nxn, nyn, nzn);
    uvs.push(u, v);
    colors.push(rgb[0], rgb[1], rgb[2]);
    if (biomas && bio) {
      biomas.push(bio.a, bio.b, bio.peso);
      splats.push(bio.splat);
    }
  }

  function addQuadTopo(x0, z0, x1, z1, h, rgb, u0, v0, u1, v1, bio) {
    addVert(x0, h, z0, 0, 1, 0, u0, v0, rgb, bio);
    addVert(x0, h, z1, 0, 1, 0, u0, v1, rgb, bio);
    addVert(x1, h, z0, 0, 1, 0, u1, v0, rgb, bio);
    addVert(x1, h, z0, 0, 1, 0, u1, v0, rgb, bio);
    addVert(x0, h, z1, 0, 1, 0, u0, v1, rgb, bio);
    addVert(x1, h, z1, 0, 1, 0, u1, v1, rgb, bio);
  }

  function addParedeX(x, z0, z1, hA, hB, rgb, bio) {
    if (Math.abs(hA - hB) < 1e-4) return;
    const nxn = hA > hB ? 1 : -1;
    addVert(x, hB, z0, nxn, 0, 0, 0, 0, rgb, bio);
    addVert(x, hA, z0, nxn, 0, 0, 0, 0, rgb, bio);
    addVert(x, hB, z1, nxn, 0, 0, 0, 0, rgb, bio);
    addVert(x, hA, z0, nxn, 0, 0, 0, 0, rgb, bio);
    addVert(x, hA, z1, nxn, 0, 0, 0, 0, rgb, bio);
    addVert(x, hB, z1, nxn, 0, 0, 0, 0, rgb, bio);
  }

  function addParedeZ(z, x0, x1, hA, hB, rgb, bio) {
    if (Math.abs(hA - hB) < 1e-4) return;
    const nzn = hA > hB ? 1 : -1;
    addVert(x0, hB, z, 0, 0, nzn, 0, 0, rgb, bio);
    addVert(x1, hB, z, 0, 0, nzn, 0, 0, rgb, bio);
    addVert(x0, hA, z, 0, 0, nzn, 0, 0, rgb, bio);
    addVert(x1, hB, z, 0, 0, nzn, 0, 0, rgb, bio);
    addVert(x1, hA, z, 0, 0, nzn, 0, 0, rgb, bio);
    addVert(x0, hA, z, 0, 0, nzn, 0, 0, rgb, bio);
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
      const bio = dadosBioma(cx, cy);
      const u0 = x0 / uvEsc;
      const v0 = -z0 / uvEsc;
      const u1 = x1 / uvEsc;
      const v1 = -z1 / uvEsc;

      addQuadTopo(x0, z0, x1, z1, h, rgbTopo, u0, v0, u1, v1, bio);

      const hR = altura(cx + 1, cy);
      if (Number.isFinite(hR)) addParedeX(x1, z0, z1, h, hR, rgbParede, bio);
      const hS = altura(cx, cy + 1);
      if (Number.isFinite(hS)) addParedeZ(z1, x0, x1, h, hS, rgbParede, bio);
    }
  }

  if (!positions.length) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (biomas?.length) {
    geo.setAttribute("aBioma", new THREE.Float32BufferAttribute(biomas, 3));
    geo.setAttribute("splat", new THREE.Float32BufferAttribute(splats, 1));
  }
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Lâmina de mar. Inclui vertex colors brancos — o material do lago exige.
 */
export function criarGeometriaMarPlano(mar, opts) {
  const { ox, oy, passo, nx, ny, nivel } = opts;
  const uvEsc = Math.max(1e-6, opts.uvEscala || passo);
  if (nx < 1 || ny < 1 || passo <= 0 || !Number.isFinite(nivel)) return null;

  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const y = nivel - 0.04;

  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx < nx; cx++) {
      if (!mar[cy * nx + cx]) continue;
      const x0 = ox + cx * passo;
      const z0 = oy + cy * passo;
      const x1 = x0 + passo;
      const z1 = z0 + passo;
      const u0 = x0 / uvEsc;
      const v0 = -z0 / uvEsc;
      const u1 = x1 / uvEsc;
      const v1 = -z1 / uvEsc;
      positions.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      uvs.push(u0, v0, u0, v1, u1, v0, u1, v0, u0, v1, u1, v1);
      for (let i = 0; i < 6; i++) colors.push(1, 1, 1);
    }
  }

  if (!positions.length) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  return geo;
}
