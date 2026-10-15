import { COR_TIPO } from "../tipos.js";

const CAP = 160;
const pool = new Array(CAP);
let cursor = 0;

for (let i = 0; i < CAP; i++) {
  pool[i] = {
    viva: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    idade: 0,
    vida: 0.4,
    cor: "#fff",
    tam: 0.18,
  };
}

function ocupar() {
  for (let n = 0; n < CAP; n++) {
    const i = (cursor + n) % CAP;
    if (!pool[i].viva) {
      cursor = (i + 1) % CAP;
      return pool[i];
    }
  }
  const p = pool[cursor];
  cursor = (cursor + 1) % CAP;
  return p;
}

export function limparParticulas() {
  for (let i = 0; i < CAP; i++) pool[i].viva = false;
  cursor = 0;
}

export function particulasVivas() {
  return pool;
}

export function corDoTipo(tipo) {
  return COR_TIPO[tipo] || "#f8fafc";
}

export function rajada(x, y, z, tipo, quantidade, forca) {
  const cor = corDoTipo(tipo);
  const n = Math.max(0, Math.min(18, quantidade | 0));
  const f = forca > 0 ? forca : 1;
  for (let i = 0; i < n; i++) {
    const p = ocupar();
    const ang = (i / n) * Math.PI * 2;
    const rapidez = (1.5 + (i % 5) * 0.42) * f;
    p.viva = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = Math.cos(ang) * rapidez;
    p.vy = Math.sin(ang) * rapidez;
    p.vz = (2.2 + (i % 3) * 0.85) * f;
    p.idade = 0;
    p.vida = 0.26 + (i % 4) * 0.05;
    p.cor = cor;
    p.tam = (0.16 + (i % 3) * 0.05) * f;
  }
}

export function rastro(x, y, z, cor) {
  const p = ocupar();
  p.viva = true;
  p.x = x;
  p.y = y;
  p.z = z;
  p.vx = 0;
  p.vy = 0;
  p.vz = 0.2;
  p.idade = 0;
  p.vida = 0.22;
  p.cor = cor || "#fff";
  p.tam = 0.12;
}

export function tickParticulas(dt) {
  const amortece = 1 - Math.min(1, 2.4 * dt);
  for (let i = 0; i < CAP; i++) {
    const p = pool[i];
    if (!p.viva) continue;
    p.idade += dt;
    if (p.idade >= p.vida) {
      p.viva = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vz -= 8 * dt;
    p.vx *= amortece;
    p.vy *= amortece;
  }
}
