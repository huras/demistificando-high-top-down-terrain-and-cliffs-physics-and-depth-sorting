/** Noise determinístico leve (value noise) — sem deps. */

export function hash2(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function hash3(x, y, z, seed) {
  let n = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const u = a + (b - a) * fx;
  const v = c + (d - c) * fx;
  return u + (v - u) * fy;
}

export function fbm2(x, y, seed, oitavas = 4) {
  let amp = 1;
  let freq = 1;
  let soma = 0;
  let norm = 0;
  for (let i = 0; i < oitavas; i++) {
    soma += valueNoise2(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return soma / norm;
}

export function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const fz = fade(z - z0);

  const n000 = hash3(x0, y0, z0, seed);
  const n100 = hash3(x0 + 1, y0, z0, seed);
  const n010 = hash3(x0, y0 + 1, z0, seed);
  const n110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const n001 = hash3(x0, y0, z0 + 1, seed);
  const n101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const n011 = hash3(x0, y0 + 1, z0 + 1, seed);
  const n111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);

  const x00 = n000 + (n100 - n000) * fx;
  const x10 = n010 + (n110 - n010) * fx;
  const x01 = n001 + (n101 - n001) * fx;
  const x11 = n011 + (n111 - n011) * fx;
  const y0v = x00 + (x10 - x00) * fy;
  const y1v = x01 + (x11 - x01) * fy;
  return y0v + (y1v - y0v) * fz;
}

/** Permutação clássica. O Perlin do Unity não é idêntico, mas a escala e os degraus batem. */
const PERM = new Uint8Array(512);
const PERM_BASE = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142,
  8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117,
  35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
  134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41,
  55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89,
  18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226,
  250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182,
  189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43,
  172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97,
  228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
  49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138,
  236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];
for (let i = 0; i < 256; i++) PERM[i] = PERM[i + 256] = PERM_BASE[i];

function fadePerlin(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function gradPerlin(h, x, y) {
  const h4 = h & 3;
  const u = h4 < 2 ? x : y;
  const v = h4 < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Perlin 2D em 0..1, contínuo no plano (sem embrulhar o UV). */
export function perlin01(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const xi = x0 & 255;
  const yi = y0 & 255;
  const u = fadePerlin(xf);
  const v = fadePerlin(yf);
  const aa = PERM[PERM[xi] + yi];
  const ba = PERM[PERM[xi + 1] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const bb = PERM[PERM[xi + 1] + yi + 1];
  const x1 = gradPerlin(aa, xf, yf) + u * (gradPerlin(ba, xf - 1, yf) - gradPerlin(aa, xf, yf));
  const x2 = gradPerlin(ab, xf, yf - 1) + u * (gradPerlin(bb, xf - 1, yf - 1) - gradPerlin(ab, xf, yf - 1));
  const n = x1 + v * (x2 - x1);
  return Math.max(0, Math.min(1, (n + 1) * 0.5));
}

function degraus01(t, niveis) {
  if (niveis < 2) return t;
  const c = Math.max(0, Math.min(1, t));
  const idx = Math.min(niveis - 1, Math.floor(c * niveis));
  return idx / (niveis - 1);
}

/** fBm no estilo do Perlin do Unity (globalScale, persistence, lacunarity, degraus). */
export function fbmPerlin01(u, v, p) {
  const gs = Math.max(0.0001, Number(p.escala) || 1);
  const sx = Math.max(0.0001, Number(p.escalaU) || 1) * gs;
  const sy = Math.max(0.0001, Number(p.escalaV) || 1) * gs;
  const oct = Math.max(1, Math.min(8, p.oitavas | 0 || 1));
  const pers = Number(p.persistencia);
  const persistence = Number.isFinite(pers) ? pers : 0.5;
  const lac = Number(p.lacunarity);
  const lacunarity = Number.isFinite(lac) ? lac : 2;
  let soma = 0;
  let amplitude = 1;
  let frequencia = 1;
  let norma = 0;
  for (let i = 0; i < oct; i++) {
    const nx = u * sx * frequencia + (Number(p.offsetX) || 0);
    const ny = v * sy * frequencia + (Number(p.offsetY) || 0);
    soma += perlin01(nx, ny) * amplitude;
    norma += amplitude;
    amplitude *= persistence;
    frequencia *= lacunarity;
  }
  let n = norma > 0 ? soma / norma : 0;
  n = Math.max(0, Math.min(1, n));
  n = degraus01(n, p.degraus | 0);
  if (p.inverter) n = 1 - n;
  return Math.max(0, Math.min(1, n));
}
