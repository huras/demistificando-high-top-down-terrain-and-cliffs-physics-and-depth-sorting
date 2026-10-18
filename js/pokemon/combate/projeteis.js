import { POKEMON } from "../../config.js";
import { FOLGA_PROJETIL, RAIO_PROJETIL } from "../ia/constantes.js";
import { alturaCorpo, alturaPe } from "../ator.js";
import { COR_TIPO } from "../tipos.js";
import { FOLHAS } from "./folhasGolpe.js";
import { rajada } from "./particulas.js";
import { bloqueioNoTrecho } from "../../combate/arenas.js";

const vivos = [];
const impactos = [];

export function limparProjeteis() {
  vivos.length = 0;
  impactos.length = 0;
}

export function soltarProjetil(opts) {
  if (vivos.length >= POKEMON.PROJETEIS_MAX) vivos.shift();
  const arco = opts.arco;
  vivos.push({
    x: opts.x,
    y: opts.y,
    z: opts.z + 0.8,
    vx: opts.vx,
    vy: opts.vy,
    vz: arco ? 4.2 : 0,
    grav: arco ? 14 : 0,
    dono: opts.dono,
    faccao: opts.faccao,
    poder: opts.poder,
    tipo: opts.tipo,
    categoria: opts.categoria,
    acerto: opts.acerto,
    forma: opts.forma || (opts.arco ? "arc" : "projectile"),
    cor: COR_TIPO[opts.tipo] || "#f8fafc",
    raio: opts.raio || RAIO_PROJETIL,
    viajou: 0,
    max: opts.max || 12,
    viva: true,
    rajada: opts.rajada || 0,
    giro: opts.giro || 0,
    ang: opts.ang || 0,
    amp: opts.amp || 0,
    freq: opts.freq || 0,
    fase: opts.fase || 0,
    t: 0,
    baseX: opts.x,
    baseY: opts.y,
    dirX: 0,
    dirY: 0,
    cresce: opts.cresce || 0,
    distCresce: opts.distCresce || 7,
    escala0: opts.escala || 0,
    escala: opts.escala || 0,
    folha: opts.folha || "",
    rastroEspaco: opts.rastroEspaco || 0,
  });
  const ultimo = vivos[vivos.length - 1];
  const vel = Math.hypot(ultimo.vx, ultimo.vy) || 1;
  ultimo.dirX = ultimo.vx / vel;
  ultimo.dirY = ultimo.vy / vel;
}

export function projeteisVivos() {
  return vivos;
}

export function impactosVivos() {
  return impactos;
}

function nascerImpacto(p) {
  const cfg = FOLHAS[p.folha];
  if (!cfg?.impacto) return;
  let frame = 0;
  if (cfg.animar && cfg.frames > 1) frame = Math.floor((p.t || 0) / cfg.duracao) % cfg.frames;
  impactos.push({
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vy: p.vy,
    folha: p.folha,
    t: 0,
    giro: (cfg.giro || 0) * (p.t || 0) * Math.PI * 2,
    frame,
    escala: cfg.impacto === "cravar" ? p.escala || cfg.escalaVoo : cfg.escalaImpacto,
    impacto: true,
  });
}

function atualizarImpactos(dt) {
  for (let i = impactos.length - 1; i >= 0; i--) {
    const imp = impactos[i];
    imp.t += dt;
    const cfg = FOLHAS[imp.folha];
    const dur = cfg?.impacto === "folha"
      ? (cfg.duracao || 0.07) * Math.max(1, cfg.frames - (cfg.frameImpacto || 0))
      : cfg?.duracaoImpacto || 0.9;
    if (imp.t >= dur) impactos.splice(i, 1);
  }
}

export function atualizarProjeteis(dt, candidatos, aoAtingir) {
  for (let i = vivos.length - 1; i >= 0; i--) {
    const p = vivos[i];
    p.antX = p.x;
    p.antY = p.y;
    p.antZ = p.z;
    p.viajouAntes = p.viajou;
    const passo = Math.hypot(p.vx, p.vy) * dt;
    p.t += dt;
    if (p.amp > 0) {
      p.baseX += p.vx * dt;
      p.baseY += p.vy * dt;
      const lat = Math.sin(p.t * p.freq * Math.PI * 2 + p.fase) * p.amp;
      p.x = p.baseX - p.dirY * lat;
      p.y = p.baseY + p.dirX * lat;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.z += p.vz * dt;
    p.vz -= p.grav * dt;
    p.viajou += passo;
    if (p.giro) p.ang += p.giro * Math.PI * 2 * dt;
    if (p.cresce > 1) {
      const u = Math.min(1, p.viajou / (p.distCresce || 7));
      p.escala = (p.escala0 || 0.2) * (1 + (p.cresce - 1) * u);
    }
    const cobertura = bloqueioNoTrecho(p.antX, p.antY, p.x, p.y, p.raio || RAIO_PROJETIL);
    if (cobertura) {
      p.x = cobertura.x;
      p.y = cobertura.y;
      rajada(p.x, p.y, p.z, p.tipo, 4, 0.55);
      nascerImpacto(p);
      vivos.splice(i, 1);
      continue;
    }
    let bateu = false;
    for (let k = 0; k < candidatos.length; k++) {
      const alvo = candidatos[k];
      if (!alvo || alvo.morto || alvo.capturado) continue;
      if (alvo === p.dono || alvo.faccao === p.faccao) continue;
      const dx = alvo.x - p.x;
      const dy = alvo.y - p.y;
      const alcance = p.raio + FOLGA_PROJETIL;
      if (dx * dx + dy * dy > alcance * alcance) continue;
      const pe = alturaPe(alvo);
      const topo = pe + alturaCorpo(alvo);
      const folga = p.raio || RAIO_PROJETIL;
      if (p.z < pe - folga || p.z > topo + folga) continue;
      aoAtingir(p, alvo);
      bateu = true;
      break;
    }
    if (bateu) nascerImpacto(p);
    if (bateu || p.viajou >= p.max || p.z < -2) vivos.splice(i, 1);
  }
  atualizarImpactos(dt);
}
