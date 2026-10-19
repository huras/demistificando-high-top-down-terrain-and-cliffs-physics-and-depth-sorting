/** Plano lento do acerto e do erro. Um estado só, reescrito no lugar. */

const cena = {
  tipo: "",
  alvo: null,
  dist: 0,
  restante: 0,
  ritmo: 1,
};

const pose = {
  tipo: "impacto",
  alvo: null,
  raio: 4.6,
  altura: 2.4,
  giro: 0.45,
};

export function marcarImpacto(item) {
  if (!item) return;
  if (item.tipo === "dano" && item.alvo) {
    const dist = Number(item.dist) || 0.7;
    const fracao = Math.max(0, Math.min(1, (dist - 0.7) / 3.5));
    const tempo = Number(item.recuo) || 0.1 + fracao * 0.9;
    cena.tipo = "acerto";
    cena.alvo = item.alvo;
    cena.dist = dist;
    cena.restante = Math.max(0.22, tempo + 0.12);
    cena.ritmo = 0.62 - fracao * 0.34;
    return;
  }
  if (item.tipo === "erro" && (item.alvo || item.ator)) {
    cena.tipo = "erro";
    cena.alvo = item.alvo || item.ator;
    cena.dist = 0;
    cena.restante = 0.32;
    cena.ritmo = 0.55;
  }
}

export function tickImpacto(dt) {
  if (cena.restante <= 0) return;
  cena.restante -= dt;
  if (cena.restante > 0) return;
  cena.restante = 0;
  cena.alvo = null;
  cena.ritmo = 1;
}

export function emImpacto() {
  return cena.restante > 0 && !!cena.alvo;
}

export function ritmoImpacto() {
  return emImpacto() ? cena.ritmo : 1;
}

export function poseImpacto() {
  if (!emImpacto()) return null;
  if (cena.tipo === "acerto") {
    const dist = cena.dist;
    pose.raio = 4.2 + Math.min(3.2, Math.max(0, dist - 0.7));
    pose.altura = 2.15 + Math.min(1.35, dist * 0.28);
    pose.giro = 0.42;
  } else {
    pose.raio = 4.4;
    pose.altura = 2.7;
    pose.giro = 0.85;
  }
  pose.alvo = cena.alvo;
  return pose;
}

export function limparImpacto() {
  cena.tipo = "";
  cena.alvo = null;
  cena.dist = 0;
  cena.restante = 0;
  cena.ritmo = 1;
}
