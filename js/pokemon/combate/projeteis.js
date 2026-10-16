import { POKEMON } from "../../config.js";
import { COR_TIPO } from "../tipos.js";

const vivos = [];

export function limparProjeteis() {
  vivos.length = 0;
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
    raio: opts.raio || 0.45,
    viajou: 0,
    max: opts.max || 12,
    viva: true,
  });
}

export function projeteisVivos() {
  return vivos;
}

export function atualizarProjeteis(dt, candidatos, aoAtingir) {
  for (let i = vivos.length - 1; i >= 0; i--) {
    const p = vivos[i];
    const passo = Math.hypot(p.vx, p.vy) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vz -= p.grav * dt;
    p.viajou += passo;
    let bateu = false;
    for (let k = 0; k < candidatos.length; k++) {
      const alvo = candidatos[k];
      if (!alvo || alvo.morto || alvo.capturado) continue;
      if (alvo === p.dono || alvo.faccao === p.faccao) continue;
      const dx = alvo.x - p.x;
      const dy = alvo.y - p.y;
      const alcance = p.raio + 0.38;
      if (dx * dx + dy * dy > alcance * alcance) continue;
      aoAtingir(p, alvo);
      bateu = true;
      break;
    }
    if (bateu || p.viajou >= p.max || p.z < -2) vivos.splice(i, 1);
  }
}
