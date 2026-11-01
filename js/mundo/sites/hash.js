import { SEED_MUNDO } from "../../config.js";

export function hash2(a, b) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function hash3(a, b, c) {
  let h =
    Math.imul(a | 0, 374761393) ^
    Math.imul(b | 0, 668265263) ^
    Math.imul(c | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16) ^ (SEED_MUNDO | 0)) >>> 0;
}

export function unidade(h) {
  return (h >>> 0) / 4294967296;
}

/** PRNG determinístico (mulberry32). */
export function rngDe(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
