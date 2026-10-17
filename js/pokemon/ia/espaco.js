import { golpeBasico } from "../ator.js";
import { FOLGA_PARADA, RAIO_ARENA } from "./constantes.js";

export function paradaDe(def) {
  if (!def || def.forma === "contact") {
    const alcance = Math.max(0.9, def?.alcance || 1.05);
    return Math.min(alcance * 0.85, Math.max(0.8, alcance - 0.15));
  }
  if ((def.poder || 0) <= 0) return 2.8;
  const alcance = Math.max(0.6, def.alcance || 1);
  if (def.forma === "radius") {
    const raio = Math.max(2.2, alcance);
    return Math.min(4.2, Math.min(raio - 0.25, Math.max(1.55, raio * 0.7)));
  }
  const dentro = Math.min(alcance * 0.72, 4.4);
  if (alcance <= 1.35) return Math.max(0.7, dentro);
  return Math.min(dentro, Math.max(1.55, Math.min(alcance * 0.45, 4.4)));
}

/** 1 aproxima, -1 recua, 0 segura a distância. */
export function sentidoParada(distancia, parada, forma) {
  if (distancia > parada + FOLGA_PARADA) return 1;
  if (distancia < parada - FOLGA_PARADA && forma !== "contact") return -1;
  return 0;
}

export function golpeProntoForma(ator, formaA, formaB) {
  if (!ator?.golpes) return null;
  for (let i = 0; i < ator.golpes.length; i++) {
    const g = ator.golpes[i];
    const f = g.def.forma;
    if (f !== formaA && f !== formaB) continue;
    if (g.cd > 0) continue;
    if ((g.def.pp || 1) > ator.pp) continue;
    return g.def;
  }
  return null;
}

function golpeEquipadoForma(ator, formaA, formaB) {
  if (!ator?.golpes) return null;
  for (let i = 0; i < ator.golpes.length; i++) {
    const f = ator.golpes[i].def.forma;
    if (f === formaA || f === formaB) return ator.golpes[i].def;
  }
  return null;
}

/** Mesma prioridade da arena: tiro pronto, senão corpo, senão o básico. */
export function posturaDe(ator) {
  const corpo = ator.usaCorpo !== false;
  const distancia = ator.usaDistancia !== false;
  if (distancia) {
    const longe = golpeProntoForma(ator, "projectile", "arc");
    if (longe) return longe;
  }
  if (corpo) {
    const perto = golpeProntoForma(ator, "contact", "radius");
    if (perto) return perto;
    return golpeBasico();
  }
  if (distancia) return golpeEquipadoForma(ator, "projectile", "arc");
  return null;
}

/** Distância que a habilidade tenta segurar. */
export function regua(ator, hab) {
  if (hab === "perseguir") {
    const contato = ator.usaCorpo !== false ? golpeProntoForma(ator, "contact", "contact") : null;
    const area = ator.usaCorpo !== false ? golpeProntoForma(ator, "radius", "radius") : null;
    const def = contato || (area && area.poder > 0 ? area : null) || golpeBasico();
    const forma = def.forma === "radius" ? "radius" : "contact";
    return { parada: paradaDe({ forma, alcance: def.alcance, poder: def.poder ?? 18 }), forma };
  }
  if (hab === "atirar") {
    const tiro = golpeProntoForma(ator, "projectile", "arc") || golpeEquipadoForma(ator, "projectile", "arc");
    if (!tiro) return { parada: paradaDe({ forma: "projectile", alcance: 8, poder: 40 }), forma: "projectile" };
    return { parada: paradaDe(tiro), forma: tiro.forma, vel: tiro.vel || 14 };
  }
  const post = posturaDe(ator);
  if (!post) return { parada: paradaDe(golpeBasico()), forma: "contact", vel: 14 };
  return { parada: paradaDe(post), forma: post.forma, vel: post.vel || 14 };
}

export function alcanceSoco(oponente) {
  const basico = golpeBasico().alcance;
  if (!oponente || oponente.usaCorpo === false) return basico;
  const contato = golpeProntoForma(oponente, "contact", "contact");
  if (contato) return Math.max(basico, contato.alcance);
  return basico;
}

export function vaiMelee(oponente, ator) {
  if (!oponente || oponente.morto || oponente.capturado || oponente.dormindo > 0) return false;
  if ((oponente.recuoRestante || 0) > 0 || (oponente.recuoTrava || 0) > 0) return false;
  if ((oponente.avancoRestante || 0) > 0 || (oponente.esquivaRestante || 0) > 0) return false;
  if (oponente.usaCorpo === false) return false;
  const dx = ator.x - oponente.x;
  const dy = ator.y - oponente.y;
  const d = Math.hypot(dx, dy);
  const basico = golpeBasico().alcance;
  const contato = golpeProntoForma(oponente, "contact", "contact");
  if (contato && d <= Math.max(basico, contato.alcance)) return true;
  const tiro = oponente.usaDistancia !== false && golpeProntoForma(oponente, "projectile", "arc");
  if (tiro && d <= tiro.alcance) return false;
  const area = golpeProntoForma(oponente, "radius", "radius");
  if (area && area.poder > 0 && d <= Math.max(2.2, area.alcance)) return true;
  return d <= basico && (oponente.cdBasico || 0) <= 0;
}

export function limitarArena(ator) {
  const d = Math.hypot(ator.x, ator.y);
  if (d <= RAIO_ARENA) return;
  const k = RAIO_ARENA / d;
  ator.x *= k;
  ator.y *= k;
}
