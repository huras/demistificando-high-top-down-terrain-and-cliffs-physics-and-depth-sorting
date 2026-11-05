/**
 * Smoke offline do núcleo metaLivre (sem mapa/voxel).
 * node tools/smoke-nav-unstick.mjs
 */

function invadeFake(x, y, discos, rCorpo) {
  for (const d of discos) {
    const dx = x - d.x;
    const dy = y - d.y;
    const rr = rCorpo + d.r;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}

function projetar(x, y, discos, raioCorpo) {
  const r = raioCorpo + 0.04;
  if (!invadeFake(x, y, discos, r)) return { x, y };
  for (let ring = 1; ring <= 12; ring++) {
    const dist = ring * 0.45;
    const passos = 8 + ring * 2;
    for (let k = 0; k < passos; k++) {
      const ang = (k / passos) * Math.PI * 2 + ring * 0.17;
      const nx = x + Math.cos(ang) * dist;
      const ny = y + Math.sin(ang) * dist;
      if (!invadeFake(nx, ny, discos, r)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

const discos = [{ x: 0, y: 0, r: 1.5 }];
const meta = projetar(0, 0, discos, 0.3);
const livre = !invadeFake(meta.x, meta.y, discos, 0.34);
const dist = Math.hypot(meta.x, meta.y);

if (!livre || dist < 1.5) {
  console.error("FAIL projetarMetaLivre", meta, { livre, dist });
  process.exit(1);
}

// Anel de lar: vários discos
const anel = [];
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  anel.push({ x: Math.cos(a) * 1.1, y: Math.sin(a) * 1.1, r: 0.55 });
}
const metaAnel = projetar(0, 0, anel, 0.3);
const livreAnel = !invadeFake(metaAnel.x, metaAnel.y, anel, 0.34);
if (!livreAnel) {
  console.error("FAIL anel de lar", metaAnel);
  process.exit(1);
}

console.log("OK smoke-nav-unstick", {
  meta: { x: +meta.x.toFixed(2), y: +meta.y.toFixed(2), dist: +dist.toFixed(2) },
  anel: {
    x: +metaAnel.x.toFixed(2),
    y: +metaAnel.y.toFixed(2),
  },
});
