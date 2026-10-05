import * as THREE from "three";

const MAX_RISCOS = 32;
const CAMADAS = Object.freeze([
  Object.freeze({ vel: 5.2, a: 0.18, len: 0.95 }),
  Object.freeze({ vel: 8.4, a: 0.3, len: 0.78 }),
  Object.freeze({ vel: 12.2, a: 0.44, len: 0.58 }),
]);

const DIST2_MORTE = 8.6 * 8.6;
const Z_MORTE = 2.4;
const LIFT_Y = 0.62;

function criarRisco() {
  return {
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: 0,
    jx: 0,
    jy: 0,
    len: 0,
    w: 1,
    r: 1.4,
    life: 0,
    maxLife: 1,
    layer: 0,
    alive: false,
  };
}

function esticarDoPlano(spd, vmin, vfull) {
  if (!(spd > vmin)) return 0;
  if (spd >= vfull) return 1;
  const t = (spd - vmin) / (vfull - vmin);
  return t * t * (3 - 2 * t);
}

function vidaAlpha(life, maxLife) {
  if (!(maxLife > 0)) return 0;
  const t = 1 - life / maxLife;
  if (t < 0.16) return t / 0.16;
  if (t > 0.7) return Math.max(0, 1 - (t - 0.7) / 0.3);
  return 1;
}

function atrasDemais(p, bx, by, dirX, dirY) {
  return (p.x - bx) * dirX + (p.y - by) * dirY < -3.4;
}

function longeDemais(p, bx, by) {
  const dx = p.x - bx;
  const dy = p.y - by;
  return dx * dx + dy * dy > DIST2_MORTE;
}

function pousarParticula(p, bx, by, dirX, dirY, stretch) {
  if (stretch < 0.28) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 0.28 + Math.random() * 4.4;
    p.x = bx + Math.cos(ang) * rad;
    p.y = by + Math.sin(ang) * rad;
    p.z = Math.random() * 0.42;
    return;
  }
  const ahead = 0.55 + Math.random() * (2.2 + stretch * 4.4);
  const side = (Math.random() - 0.5) * (5.4 + (1 - stretch) * 2.6);
  p.x = bx + dirX * ahead - dirY * side;
  p.y = by + dirY * ahead + dirX * side;
  p.z = Math.random() * 0.14;
}

function spawnRisco(p, bx, by, dirX, dirY, layer, stretch) {
  pousarParticula(p, bx, by, dirX, dirY, stretch);
  p.dx = -dirX;
  p.dy = -dirY;
  p.jx = (Math.random() - 0.5) * 0.55;
  p.jy = (Math.random() - 0.5) * 0.55;
  p.layer = layer;
  const cam = CAMADAS[layer] ?? CAMADAS[1];
  p.len = (0.45 + Math.random() * 0.7) * cam.len;
  p.w = layer === 2 ? 1.7 : layer === 1 ? 1.25 : 0.9;
  p.r = 1.05 + Math.random() * 1.35;
  p.maxLife = 0.48 + Math.random() * 0.46;
  p.life = p.maxLife;
  p.alive = true;
}

/**
 * Riscos de vento 3D (LineSegments + motes) — pool fixo, zero alloc no tick.
 */
export function criarVentoAsa3d() {
  const riscos = new Array(MAX_RISCOS);
  for (let i = 0; i < MAX_RISCOS; i++) riscos[i] = criarRisco();

  // 2 verts por risco (linha) — motes usam segmento degenerado curto
  const pos = new Float32Array(MAX_RISCOS * 2 * 3);
  const col = new Float32Array(MAX_RISCOS * 2 * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
  geo.setDrawRange(0, 0);

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    linewidth: 1,
  });
  const linhas = new THREE.LineSegments(geo, mat);
  linhas.name = "vento-asa";
  linhas.frustumCulled = false;
  linhas.renderOrder = 6;
  linhas.visible = false;

  let fade = 0;
  let spawnAcc = 0;
  let dirX = 0;
  let dirY = 1;
  let stretch = 0;
  let queda = 0;
  let lift = 0;

  function desligarTodos() {
    for (let i = 0; i < MAX_RISCOS; i++) riscos[i].alive = false;
    spawnAcc = 0;
    stretch = 0;
    queda = 0;
    lift = 0;
    geo.setDrawRange(0, 0);
    linhas.visible = false;
  }

  function nascer(bx, by, maxVivos) {
    let vivos = 0;
    let slot = -1;
    for (let i = 0; i < MAX_RISCOS; i++) {
      if (riscos[i].alive) vivos++;
      else if (slot < 0) slot = i;
    }
    if (vivos >= maxVivos || slot < 0) return;
    spawnRisco(riscos[slot], bx, by, dirX, dirY, (Math.random() * 3) | 0, stretch);
  }

  function tickRiscos(dt, bx, by) {
    const estica = stretch;
    const streamMul = 0.08 + estica * 0.92;
    const flutuMul = 0.35 + (1 - estica) * 1.15;
    const usaAtras = estica > 0.38;

    for (let i = 0; i < MAX_RISCOS; i++) {
      const p = riscos[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (
        p.life <= 0 ||
        p.z > Z_MORTE ||
        longeDemais(p, bx, by) ||
        (usaAtras && atrasDemais(p, bx, by, dirX, dirY))
      ) {
        p.alive = false;
        continue;
      }
      const cam = CAMADAS[p.layer] ?? CAMADAS[1];
      const stream = cam.vel * streamMul;
      p.x += (p.dx * stream + p.jx * (1 - estica)) * dt;
      p.y += (p.dy * stream + p.jy * (1 - estica)) * dt;
      p.z += queda * flutuMul * dt;
    }
  }

  function syncBuffer(elevBase) {
    const gFade = fade * fade;
    const estica = stretch;
    let wrote = 0;

    for (let i = 0; i < MAX_RISCOS; i++) {
      const p = riscos[i];
      if (!p.alive) continue;
      const cam = CAMADAS[p.layer] ?? CAMADAS[1];
      const a = vidaAlpha(p.life, p.maxLife) * cam.a * gFade;
      if (a < 0.01) continue;

      const yWorld = elevBase + lift * LIFT_Y + p.z * LIFT_Y;
      const len = Math.max(0.08, p.len * estica);
      const mote = len < 0.12;

      const i0 = wrote * 2;
      const i1 = i0 + 1;
      pos[i0 * 3] = p.x;
      pos[i0 * 3 + 1] = yWorld;
      pos[i0 * 3 + 2] = p.y;

      if (mote) {
        const r = Math.max(0.04, p.r * 0.04 * (1.05 - estica * 0.28));
        pos[i1 * 3] = p.x + r;
        pos[i1 * 3 + 1] = yWorld;
        pos[i1 * 3 + 2] = p.y;
      } else {
        pos[i1 * 3] = p.x - p.dx * len;
        pos[i1 * 3 + 1] = yWorld;
        pos[i1 * 3 + 2] = p.y - p.dy * len;
      }

      for (const vi of [i0, i1]) {
        col[vi * 4] = 0.886;
        col[vi * 4 + 1] = 0.949;
        col[vi * 4 + 2] = 1;
        col[vi * 4 + 3] = a;
      }
      wrote++;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, wrote * 2);
    linhas.visible = wrote > 0 && fade > 0.012;
  }

  return {
    objeto: linhas,
    /**
     * @param {number} dt
     * @param {{ gliding: boolean, x: number, y: number, elev: number, vx: number, vy: number, fx: number, fy: number, queda: number, lift: number }} opts
     */
    atualizar(dt, opts) {
      if (!(dt > 0)) return;

      const fadeIn = 0.42;
      const fadeOut = 0.34;
      const alvoFade = opts.gliding ? 1 : 0;
      if (alvoFade > fade) fade = Math.min(1, fade + dt / fadeIn);
      else if (alvoFade < fade) fade = Math.max(0, fade - dt / fadeOut);

      if (fade <= 1e-4 && !opts.gliding) {
        fade = 0;
        desligarTodos();
        return;
      }

      const vx = opts.vx ?? 0;
      const vy = opts.vy ?? 0;
      const spd = Math.hypot(vx, vy);
      if (spd >= 0.08) {
        dirX = vx / spd;
        dirY = vy / spd;
      } else {
        const fx = opts.fx ?? 0;
        const fy = opts.fy ?? 1;
        const fl = Math.hypot(fx, fy);
        if (fl > 1e-4 && stretch < 0.08) {
          dirX = fx / fl;
          dirY = fy / fl;
        }
      }

      const alvoEstica = esticarDoPlano(spd, 0.1, 3.4);
      const taxa = alvoEstica < stretch ? 11 : 7;
      stretch += (alvoEstica - stretch) * (1 - Math.exp(-dt * taxa));
      if (stretch < 0.001) stretch = 0;
      else if (stretch > 0.999) stretch = 1;

      queda = Math.max(0, opts.queda ?? 0);
      lift = Math.max(0, opts.lift ?? 0);

      const bx = opts.x ?? 0;
      const by = opts.y ?? 0;
      const dens = 0.72 + (1 - stretch) * 0.38 + stretch * 0.55;
      const spawnAtivos = Math.ceil(12 + fade * dens * 18);
      spawnAcc += dt * (8 + dens * 14) * fade;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        nascer(bx, by, spawnAtivos);
      }

      tickRiscos(dt, bx, by);
      syncBuffer(opts.elev ?? 0);
    },
    liberar() {
      geo.dispose();
      mat.dispose();
    },
  };
}
