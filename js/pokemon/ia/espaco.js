import { golpeBasico } from "../ator.js";
import { podeGastarPp } from "../pp.js";
import { ALCANCE_TIRO_MAX, FOLGA_PARADA, RAIO_ARENA } from "./constantes.js";

/** Corpo a corpo nunca fica mais curto que isto. */
export const ALCANCE_CORPO_MIN = 2.5;
/** No limite do alcance sobra esta fração da taxa do golpe. */
const ACERTO_NO_LIMITE = 0.45;

export function alcanceCorpo(def) {
  const lista = Number(def?.alcance);
  const base = Number.isFinite(lista) && lista > 0 ? lista : ALCANCE_CORPO_MIN;
  return Math.max(ALCANCE_CORPO_MIN, base);
}

/** Alcance efetivo de projectile/arc — nunca passa de ALCANCE_TIRO_MAX tiles. */
export function alcanceTiro(def) {
  const lista = Number(def?.alcance);
  const base = Number.isFinite(lista) && lista > 0 ? lista : ALCANCE_TIRO_MAX;
  return Math.min(ALCANCE_TIRO_MAX, base);
}

/** Taxa do golpe no instante do acerto. Perto vale a taxa cheia; no limite, cai. */
export function acertoCorpo(acerto, distancia, alcance) {
  if (acerto == null) return acerto;
  const base = Number(acerto);
  if (!Number.isFinite(base)) return acerto;
  const faixa = alcance > 0 ? alcance : ALCANCE_CORPO_MIN;
  const t = Math.max(0, Math.min(1, distancia / faixa));
  return base * (1 - (1 - ACERTO_NO_LIMITE) * t);
}

export function paradaDe(def) {
  if (!def || def.forma === "contact") {
    const alcance = alcanceCorpo(def);
    return Math.min(alcance * 0.5, Math.max(1.05, alcance - 1.15));
  }
  if ((def.poder || 0) <= 0) return 2.8;
  if (def.forma === "radius") {
    const alcance = Math.max(0.6, def.alcance || 1);
    const raio = Math.max(2.2, alcance);
    return Math.min(4.2, Math.min(raio - 0.25, Math.max(1.55, raio * 0.7)));
  }
  const alcance = Math.max(0.6, alcanceTiro(def));
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
    if (!podeGastarPp(ator, g.def)) continue;
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

/** Tiro pronto, senão o corpo equipado. Sem Investida. */
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
    const equipado = golpeEquipadoForma(ator, "contact", "radius");
    if (equipado && equipado.poder > 0) return equipado;
  }
  if (distancia) return golpeEquipadoForma(ator, "projectile", "arc");
  return null;
}

export function golpeDeCorpo(ator) {
  if (!ator || ator.usaCorpo === false) return null;
  const def = golpeEquipadoForma(ator, "contact", "radius");
  if (!def || def.poder <= 0) return null;
  return def;
}

/** Distância que a habilidade tenta segurar. */
export function regua(ator, hab) {
  if (hab === "perseguir") {
    const corpo = golpeDeCorpo(ator);
    if (!corpo) {
      // Sem contact equipado: fecha no alcance do basic attack (Investida).
      const basico = golpeBasico();
      return {
        parada: paradaDe({ forma: "contact", alcance: basico.alcance, poder: basico.poder }),
        forma: "contact",
      };
    }
    const forma = corpo.forma === "radius" ? "radius" : "contact";
    return { parada: paradaDe({ forma, alcance: corpo.alcance, poder: corpo.poder ?? 18 }), forma };
  }
  if (hab === "atirar") {
    const tiro = golpeProntoForma(ator, "projectile", "arc") || golpeEquipadoForma(ator, "projectile", "arc");
    if (!tiro) return { parada: paradaDe({ forma: "projectile", alcance: 8, poder: 40 }), forma: "projectile" };
    return { parada: paradaDe(tiro), forma: tiro.forma, vel: tiro.vel || 14 };
  }
  const post = posturaDe(ator);
  if (!post) return { parada: paradaDe({ forma: "projectile", alcance: 8, poder: 40 }), forma: "projectile", vel: 14 };
  return { parada: paradaDe(post), forma: post.forma, vel: post.vel || 14 };
}

export function alcanceSoco(oponente) {
  const corpo = golpeDeCorpo(oponente);
  if (!corpo) return 0;
  if (corpo.forma === "radius") return Math.max(2.2, corpo.alcance || 2.2);
  return alcanceCorpo(corpo);
}

export function vaiMelee(oponente, ator) {
  if (!oponente || oponente.morto || oponente.capturado || oponente.dormindo > 0) return false;
  if ((oponente.recuoRestante || 0) > 0 || (oponente.recuoTrava || 0) > 0) return false;
  if ((oponente.avancoRestante || 0) > 0 || (oponente.esquivaRestante || 0) > 0) return false;
  if (oponente.usaCorpo === false) return false;
  const dx = ator.x - oponente.x;
  const dy = ator.y - oponente.y;
  const d = Math.hypot(dx, dy);
  const contato = golpeProntoForma(oponente, "contact", "contact");
  if (contato && d <= alcanceCorpo(contato)) return true;
  const tiro = oponente.usaDistancia !== false && golpeProntoForma(oponente, "projectile", "arc");
  if (tiro && d <= alcanceTiro(tiro)) return false;
  const area = golpeProntoForma(oponente, "radius", "radius");
  if (area && area.poder > 0 && d <= Math.max(2.2, area.alcance)) return true;
  return false;
}

export function limitarArena(ator) {
  const d = Math.hypot(ator.x, ator.y);
  if (d <= RAIO_ARENA) return;
  const k = RAIO_ARENA / d;
  ator.x *= k;
  ator.y *= k;
}
