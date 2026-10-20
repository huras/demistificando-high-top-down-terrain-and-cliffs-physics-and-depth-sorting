/** Batidas cinemáticas do turno: disparo lento, voo rápido, aproximação e impacto. */

import { CAM_TURNO } from "./cameraTurno.js";

const DISPARO_DUR = 0.4;
const DISPARO_RITMO = 0.28;
const VOO_RITMO = 1.75;
const APROX_DIST = 2.4;
const APROX_FRAC = 0.78;
const APROX_RITMO = 0.36;
const APROX_DIST2 = APROX_DIST * APROX_DIST;

const cena = {
  tipo: "",
  alvo: null,
  atirador: null,
  projetil: null,
  alvoOlhar: null,
  dist: 0,
  restante: 0,
  ritmo: 1,
};

const pose = {
  tipo: "impacto",
  alvo: null,
  raio: CAM_TURNO.impactoErro.raio,
  altura: CAM_TURNO.impactoErro.altura,
  giro: CAM_TURNO.impactoErro.giro,
};

const poseTiroDisparo = {
  tipo: "tiro",
  alvo: null,
};

function limparFaseTiro() {
  if (cena.tipo === "acerto" || cena.tipo === "erro") return;
  cena.tipo = "";
  cena.atirador = null;
  cena.projetil = null;
  cena.alvoOlhar = null;
  cena.alvo = null;
  cena.restante = 0;
  cena.ritmo = 1;
}

function pertoDoAlvo(projetil) {
  const alvo = projetil.garantirAlvo;
  if (!alvo) return false;
  const dx = alvo.x - projetil.x;
  const dy = alvo.y - projetil.y;
  if (dx * dx + dy * dy < APROX_DIST2) return true;
  const max = projetil.max || 0;
  if (max <= 0) return false;
  return projetil.viajou / max >= APROX_FRAC;
}

/**
 * Só chamar no modo turnos. Tiro real (garantirAlvo, não ensaio).
 * Inicia o filminho do disparo e acompanha voo → aproximação.
 */
export function observarTiro(projetil) {
  if (cena.tipo === "acerto" || cena.tipo === "erro") return;

  if (projetil && projetil.garantirAlvo && !projetil.ensaio) {
    if (
      cena.tipo === "disparo" ||
      cena.tipo === "voo" ||
      cena.tipo === "aproximacao"
    ) {
      if (cena.projetil !== projetil) return;
      if (cena.tipo === "voo" || cena.tipo === "aproximacao") {
        if (pertoDoAlvo(projetil)) {
          cena.tipo = "aproximacao";
          cena.ritmo = APROX_RITMO;
        }
      }
      return;
    }

    cena.tipo = "disparo";
    cena.projetil = projetil;
    cena.atirador = projetil.dono || null;
    cena.alvoOlhar = projetil.garantirAlvo;
    cena.alvo = cena.atirador;
    cena.dist = 0;
    cena.restante = DISPARO_DUR;
    cena.ritmo = DISPARO_RITMO;
    return;
  }

  if (cena.tipo === "voo" || cena.tipo === "aproximacao" || cena.tipo === "disparo") {
    limparFaseTiro();
  }
}

export function marcarImpacto(item) {
  if (!item) return;
  if (item.tipo === "dano" && item.alvo) {
    const dist = Number(item.dist) || 0.7;
    const fracao = Math.max(0, Math.min(1, (dist - 0.7) / 3.5));
    const tempo = Number(item.recuo) || 0.1 + fracao * 0.9;
    cena.tipo = "acerto";
    cena.alvo = item.alvo;
    cena.atirador = null;
    cena.projetil = null;
    cena.alvoOlhar = null;
    cena.dist = dist;
    cena.restante = Math.max(0.22, tempo + 0.12);
    cena.ritmo = 0.62 - fracao * 0.34;
    return;
  }
  if (item.tipo === "erro" && (item.alvo || item.ator)) {
    cena.tipo = "erro";
    cena.alvo = item.alvo || item.ator;
    cena.atirador = null;
    cena.projetil = null;
    cena.alvoOlhar = null;
    cena.dist = 0;
    cena.restante = 0.32;
    cena.ritmo = 0.55;
  }
}

export function tickImpacto(dt) {
  if (cena.tipo === "disparo") {
    cena.restante -= dt;
    if (cena.restante > 0) return;
    cena.restante = 0;
    if (!cena.projetil) {
      limparFaseTiro();
      return;
    }
    cena.tipo = "voo";
    cena.ritmo = VOO_RITMO;
    cena.alvo = null;
    return;
  }

  if (cena.tipo !== "acerto" && cena.tipo !== "erro") return;
  if (cena.restante <= 0) return;
  cena.restante -= dt;
  if (cena.restante > 0) return;
  cena.restante = 0;
  cena.alvo = null;
  cena.tipo = "";
  cena.ritmo = 1;
}

export function emImpacto() {
  if (cena.tipo === "acerto" || cena.tipo === "erro") {
    return cena.restante > 0 && !!cena.alvo;
  }
  if (cena.tipo === "disparo") return cena.restante > 0;
  if (cena.tipo === "voo" || cena.tipo === "aproximacao") return !!cena.projetil;
  return false;
}

export function ritmoImpacto() {
  if (cena.tipo === "acerto" || cena.tipo === "erro") {
    return cena.restante > 0 ? cena.ritmo : 1;
  }
  if (cena.tipo === "disparo" || cena.tipo === "voo" || cena.tipo === "aproximacao") {
    return cena.ritmo;
  }
  return 1;
}

export function poseImpacto() {
  if (cena.tipo !== "acerto" && cena.tipo !== "erro") return null;
  if (cena.restante <= 0 || !cena.alvo) return null;
  if (cena.tipo === "acerto") {
    const dist = cena.dist;
    const cfg = CAM_TURNO.impactoAcerto;
    pose.raio = cfg.raio0 + Math.min(cfg.raioExtra, Math.max(0, dist - 0.7));
    pose.altura = cfg.altura0 + Math.min(cfg.alturaExtra, dist * 0.28);
    pose.giro = cfg.giro;
  } else {
    const cfg = CAM_TURNO.impactoErro;
    pose.raio = cfg.raio;
    pose.altura = cfg.altura;
    pose.giro = cfg.giro;
  }
  pose.alvo = cena.alvo;
  return pose;
}

/** Perfil lateral já no wind-up do projétil (mesmo eixo do tracking de voo). */
export function poseDisparo() {
  if (cena.tipo !== "disparo" || cena.restante <= 0) return null;
  const p = cena.projetil;
  if (!p) return null;
  poseTiroDisparo.alvo = p;
  return poseTiroDisparo;
}

export function limparImpacto() {
  cena.tipo = "";
  cena.alvo = null;
  cena.atirador = null;
  cena.projetil = null;
  cena.alvoOlhar = null;
  cena.dist = 0;
  cena.restante = 0;
  cena.ritmo = 1;
}
