/**
 * Wander na área + travel cidade→cidade (grafo Kanto simplificado).
 */
import { deLocalKanto, paraLocalKanto } from "../../mundo/bounds.js";
import {
  AREA_KANTO,
  LADO_KANTO,
  SAIDA_LESTE,
  SAIDA_NORTE,
  SAIDA_OESTE,
  SAIDA_SUL,
  zonaEm,
} from "../../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { linhasDaRota } from "../../mundo/regiao/linhasEstrada.js";
import { hashStr, mulberry32, pickIndex } from "../rng.js";
import { OW_CFG, OW_LOD, OW_MODO } from "./config.js";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function boundsArea(ax, ay) {
  const o = deLocalKanto(ax * AREA_KANTO, ay * AREA_KANTO);
  return {
    minX: o.x + 4,
    minY: o.y + 4,
    maxX: o.x + AREA_KANTO - 4,
    maxY: o.y + AREA_KANTO - 4,
  };
}

function pontoEstrada(ax, ay, rng) {
  const zona = zonaEm(ax, ay);
  const linhas = zona?.tipo === "rota" ? linhasDaRota(zona) : [];
  if (linhas.length) {
    const [a, b] = linhas[pickIndex(rng, linhas.length)];
    const t = rng();
    return deLocalKanto(
      ax * AREA_KANTO + a[0] + (b[0] - a[0]) * t,
      ay * AREA_KANTO + a[1] + (b[1] - a[1]) * t,
    );
  }
  const b = boundsArea(ax, ay);
  return {
    x: b.minX + rng() * (b.maxX - b.minX),
    y: b.minY + rng() * (b.maxY - b.minY),
  };
}

function escolherWanderGoal(trainer, rng) {
  const goal = pontoEstrada(trainer.ax | 0, trainer.ay | 0, rng);
  if (Math.hypot(goal.x - trainer.x, goal.y - trainer.y) < OW_CFG.WANDER_MIN_GOAL) {
    return pontoEstrada(trainer.ax | 0, trainer.ay | 0, rng);
  }
  return goal;
}

function cidadeAleatoria(rng, avoidAx, avoidAy) {
  const pool = CIDADES_KANTO.filter(
    (c) => c.ax !== avoidAx || c.ay !== avoidAy,
  );
  if (!pool.length) return CIDADES_KANTO[0];
  return pool[pickIndex(rng, pool.length)];
}

function vizinhos(ax, ay) {
  const z = zonaEm(ax, ay);
  if (!z) return [];
  const out = [];
  if (z.saidas & SAIDA_NORTE && ay > 0) out.push([ax, ay - 1]);
  if (z.saidas & SAIDA_SUL && ay < LADO_KANTO - 1) out.push([ax, ay + 1]);
  if (z.saidas & SAIDA_OESTE && ax > 0) out.push([ax - 1, ay]);
  if (z.saidas & SAIDA_LESTE && ax < LADO_KANTO - 1) out.push([ax + 1, ay]);
  return out;
}

/** BFS curto no grafo de áreas até a cidade alvo. */
function rotaAreas(sax, say, tax, tay) {
  const key = (x, y) => `${x},${y}`;
  const start = key(sax, say);
  const goal = key(tax, tay);
  if (start === goal) return [[sax, say]];
  const q = [[sax, say]];
  const prev = new Map([[start, null]]);
  while (q.length) {
    const [cx, cy] = q.shift();
    const k = key(cx, cy);
    if (k === goal) break;
    const ns = vizinhos(cx, cy);
    for (let i = 0; i < ns.length; i++) {
      const nk = key(ns[i][0], ns[i][1]);
      if (prev.has(nk)) continue;
      prev.set(nk, k);
      q.push(ns[i]);
    }
    if (prev.size > 80) break;
  }
  if (!prev.has(goal)) return [[sax, say], [tax, tay]];
  const path = [];
  let cur = goal;
  while (cur) {
    const [x, y] = cur.split(",").map(Number);
    path.push([x, y]);
    cur = prev.get(cur);
  }
  path.reverse();
  return path;
}

function moverEmDirecao(trainer, gx, gy, dt) {
  const dx = gx - trainer.x;
  const dy = gy - trainer.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.35) {
    trainer.vx = 0;
    trainer.vy = 0;
    trainer.andando = false;
    return true;
  }
  const sp = OW_CFG.WALK_SPEED;
  const ux = dx / dist;
  const uy = dy / dist;
  const step = Math.min(dist, sp * dt);
  trainer.x += ux * step;
  trainer.y += uy * step;
  trainer.vx = ux * sp;
  trainer.vy = uy * sp;
  trainer.andando = true;
  if (!trainer.facing) trainer.facing = { x: 0, y: 1 };
  trainer.facing.x = Math.abs(ux) >= Math.abs(uy) ? Math.sign(ux) : 0;
  trainer.facing.y = Math.abs(uy) > Math.abs(ux) ? Math.sign(uy) : 0;
  trainer.animT = (trainer.animT || 0) + dt;
  const ciclo = [0, 1, 0, 3];
  trainer.frame = ciclo[Math.floor(trainer.animT * 8) % 4];
  return false;
}

function syncArea(trainer) {
  const loc = paraLocalKanto(trainer.x, trainer.y);
  trainer.ax = clamp(Math.floor(loc.x / AREA_KANTO), 0, LADO_KANTO - 1);
  trainer.ay = clamp(Math.floor(loc.y / AREA_KANTO), 0, LADO_KANTO - 1);
}

function tickWander(trainer, dt) {
  const rng = mulberry32(hashStr(`${trainer.id}:w:${trainer._seq | 0}`));
  if (!trainer.wanderGoal) {
    if (trainer.wanderIdle > 0) {
      trainer.wanderIdle -= dt;
      trainer.vx = 0;
      trainer.vy = 0;
      trainer.andando = false;
      return;
    }
    trainer._seq = (trainer._seq | 0) + 1;
    trainer.wanderGoal = escolherWanderGoal(
      trainer,
      mulberry32(hashStr(`${trainer.id}:g:${trainer._seq}`)),
    );
  }
  const chegou = moverEmDirecao(
    trainer,
    trainer.wanderGoal.x,
    trainer.wanderGoal.y,
    dt,
  );
  if (chegou) {
    trainer.wanderGoal = null;
    trainer.wanderIdle =
      OW_CFG.WANDER_IDLE_MIN +
      rng() * (OW_CFG.WANDER_IDLE_MAX - OW_CFG.WANDER_IDLE_MIN);
  }
  syncArea(trainer);
}

function garantirTravel(trainer) {
  if (trainer.travelRoute?.length) return;
  const rng = mulberry32(hashStr(`${trainer.id}:travel`));
  const dest = cidadeAleatoria(rng, trainer.ax, trainer.ay);
  trainer.travelRoute = rotaAreas(trainer.ax | 0, trainer.ay | 0, dest.ax, dest.ay);
  trainer.travelI = 0;
  trainer.travelTarget = null;
  trainer.transitWalked = 0;
}

function tickTravel(trainer, dt) {
  garantirTravel(trainer);
  const route = trainer.travelRoute;
  if (!route?.length) {
    trainer.moveMode = OW_MODO.WANDER;
    return;
  }
  if (trainer.travelI >= route.length) {
    trainer.travelRoute = null;
    trainer.moveMode = OW_MODO.WANDER;
    return;
  }
  const [tax, tay] = route[trainer.travelI];
  if (!trainer.travelTarget) {
    const rng = mulberry32(hashStr(`${trainer.id}:tt:${trainer.travelI}`));
    trainer.travelTarget = pontoEstrada(tax, tay, rng);
  }
  const prevX = trainer.x;
  const prevY = trainer.y;
  const chegou = moverEmDirecao(
    trainer,
    trainer.travelTarget.x,
    trainer.travelTarget.y,
    dt,
  );
  trainer.transitWalked =
    (trainer.transitWalked || 0) + Math.hypot(trainer.x - prevX, trainer.y - prevY);
  syncArea(trainer);
  if (chegou) {
    if (
      trainer.travelI > 0 &&
      (trainer.transitWalked || 0) < OW_CFG.MIN_INTERIOR_TRANSIT &&
      trainer.travelI < route.length - 1
    ) {
      // ainda no miolo — pega outro ponto na mesma área
      const rng = mulberry32(hashStr(`${trainer.id}:retry:${trainer.transitWalked|0}`));
      trainer.travelTarget = pontoEstrada(tax, tay, rng);
      return;
    }
    trainer.travelI += 1;
    trainer.travelTarget = null;
    trainer.transitWalked = 0;
  }
}

/** Dormente: viajantes ainda avançam no grafo barato. */
function tickDormente(trainer, dt) {
  if (trainer.moveMode !== OW_MODO.TRAVEL) return;
  garantirTravel(trainer);
  const route = trainer.travelRoute;
  if (!route || trainer.travelI >= route.length - 1) return;
  // hop ocasional de área
  trainer._dormAcc = (trainer._dormAcc || 0) + dt;
  if (trainer._dormAcc < 4) return;
  trainer._dormAcc = 0;
  trainer.travelI = Math.min(trainer.travelI + 1, route.length - 1);
  const [tax, tay] = route[trainer.travelI];
  const p = deLocalKanto(
    tax * AREA_KANTO + AREA_KANTO * 0.5,
    tay * AREA_KANTO + AREA_KANTO * 0.5,
  );
  trainer.x = p.x;
  trainer.y = p.y;
  syncArea(trainer);
}

export function tickMovimentoViajante(trainer, dt) {
  if (!trainer) return;
  if (trainer.lod === OW_LOD.DORMANT) {
    tickDormente(trainer, dt);
    return;
  }
  if (trainer.moveMode === OW_MODO.TRAVEL) tickTravel(trainer, dt);
  else tickWander(trainer, dt);
}
