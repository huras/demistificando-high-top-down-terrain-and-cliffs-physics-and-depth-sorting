/** Status major: sleep, paralysis, poison, burn, freeze. */

export const STATUS = Object.freeze({
  poison: "poison",
  burn: "burn",
  paralysis: "paralysis",
  sleep: "sleep",
  freeze: "freeze",
});

const PO = Object.freeze({
  sleepPowder: true,
  stunSpore: true,
  poisonPowder: true,
  spore: true,
  cottonSpore: true,
});

const COR = Object.freeze({
  sleep: "#c4b5fd",
  paralysis: "#facc15",
  burn: "#f97316",
  freeze: "#67e8f9",
  poison: "#a855f7",
});

const ROTULO = Object.freeze({
  sleep: "dormindo",
  paralysis: "paralisado",
  burn: "queimado",
  freeze: "congelado",
  poison: "envenenado",
});

const JA = Object.freeze({
  sleep: "já dormindo",
  paralysis: "já paralisado",
  burn: "já queimado",
  freeze: "já congelado",
  poison: "já envenenado",
});

function temTipo(ator, tipo) {
  const tipos = ator?.tipos || [];
  for (let i = 0; i < tipos.length; i++) {
    if (tipos[i] === tipo) return true;
  }
  return false;
}

function notar(efeitos, item) {
  if (efeitos?.anotar) efeitos.anotar(item);
}

export function corStatus(id) {
  return COR[id] || "#e2e8f0";
}

export function rotuloStatus(id) {
  return ROTULO[id] || id || "";
}

/** Imunidades por tipo / pó. */
export function imuneAStatus(alvo, id, def) {
  if (!alvo || !id) return true;
  if (def?.key && PO[def.key]) {
    if (temTipo(alvo, "grass") || temTipo(alvo, "flying")) return true;
  }
  if (id === STATUS.poison && (temTipo(alvo, "poison") || temTipo(alvo, "steel"))) return true;
  if (id === STATUS.burn && temTipo(alvo, "fire")) return true;
  if (id === STATUS.paralysis && temTipo(alvo, "electric")) return true;
  if (id === STATUS.freeze && temTipo(alvo, "ice")) return true;
  return false;
}

export function limparStatus(alvo) {
  if (!alvo) return;
  const eraSleep = alvo.status === STATUS.sleep;
  alvo.status = null;
  alvo.statusTurnos = 0;
  alvo.venenoAte = 0;
  alvo.queimaAte = 0;
  alvo.geloAte = 0;
  alvo.paraTrava = 0;
  if (eraSleep || (alvo.dormindo || 0) > 0.5) {
    alvo.dormindo = 0;
    alvo.sonoNatural = false;
  }
}

/**
 * @returns {"ok"|"imune"|"ja"|"falhou"|"ocupado"|false}
 */
export function aplicarStatus(alvo, id, efeitos, opts = {}) {
  if (!alvo || !id || !STATUS[id]) return false;
  if (alvo.morto || alvo.capturado || alvo.hp <= 0) return false;
  const def = opts.def || null;
  const rng = opts.rng || Math.random;
  if (imuneAStatus(alvo, id, def)) {
    if (efeitos?.flutuar) efeitos.flutuar(alvo, "imune", "#94a3b8");
    notar(efeitos, { tipo: "imune", alvo });
    return "imune";
  }
  if (alvo.status === id) {
    if (efeitos?.flutuar) efeitos.flutuar(alvo, JA[id] || "já", COR[id]);
    return "ja";
  }
  if (alvo.status) {
    if (efeitos?.flutuar) efeitos.flutuar(alvo, "falhou", "#94a3b8");
    return "ocupado";
  }
  const chance = Number.isFinite(opts.chance) ? opts.chance : 100;
  if (rng() * 100 >= chance) {
    if (efeitos?.flutuar && opts.mostrarFalha !== false) {
      efeitos.flutuar(alvo, "falhou", "#94a3b8");
    }
    return "falhou";
  }

  alvo.status = id;
  alvo.venenoAte = 0;
  alvo.queimaAte = 0;
  alvo.geloAte = 0;
  alvo.statusTurnos = 0;

  if (id === STATUS.sleep) {
    const turnos = 1 + Math.floor(rng() * 3);
    alvo.statusTurnos = turnos;
    alvo.dormindo = opts.modoTurnos ? 99 : 2.5 + rng() * 4;
  } else if (id === STATUS.freeze) {
    alvo.statusTurnos = 99;
    alvo.geloAte = 0;
  } else if (id === STATUS.paralysis) {
    alvo.statusTurnos = 99;
  } else if (id === STATUS.poison || id === STATUS.burn) {
    alvo.statusTurnos = 99;
  }

  if (efeitos?.flutuar) efeitos.flutuar(alvo, ROTULO[id], COR[id]);
  notar(efeitos, { tipo: "status", alvo, status: id, aplicado: true });
  return "ok";
}

/** Aplica ailment de um golpe (status ou secundário). */
export function aplicarAilmentGolpe(def, alvo, efeitos, opts = {}) {
  const a = def?.ailment;
  if (!a?.id || !alvo) return false;
  if (!STATUS[a.id]) return false;
  const r = aplicarStatus(alvo, a.id, efeitos, {
    def,
    chance: Number.isFinite(a.chance) ? a.chance : 100,
    rng: opts.rng,
    modoTurnos: opts.modoTurnos,
    mostrarFalha: opts.secundario ? false : true,
  });
  return r === "ok" || r === "imune" || r === "ja" || r === "ocupado" || r === "falhou";
}

export function multiplicadorAtkQueimado(ator) {
  return ator?.status === STATUS.burn ? 0.5 : 1;
}

export function multiplicadorVelParalisado(ator) {
  return ator?.status === STATUS.paralysis ? 0.5 : 1;
}

/**
 * Sleep/freeze bloqueiam; para 25% full para.
 * @returns {{ ok: boolean, motivo?: string }}
 */
export function podeAgir(ator, rng = Math.random) {
  if (!ator || ator.morto || ator.capturado || ator.hp <= 0) {
    return { ok: false, motivo: "morto" };
  }
  if (ator.status === STATUS.sleep || (ator.dormindo || 0) > 0) {
    return { ok: false, motivo: "sleep" };
  }
  if (ator.status === STATUS.freeze) {
    return { ok: false, motivo: "freeze" };
  }
  if (ator.status === STATUS.paralysis) {
    if ((ator.paraTrava || 0) > 0) return { ok: false, motivo: "paralysis" };
    if (rng() < 0.25) {
      ator.paraTrava = 0.85;
      return { ok: false, motivo: "paralysis", aviso: true };
    }
  }
  return { ok: true };
}

/** Fogo em alvo congelado derrete. */
export function tentarDerreter(alvo, tipoGolpe, efeitos) {
  if (!alvo || alvo.status !== STATUS.freeze) return false;
  if (tipoGolpe !== "fire") return false;
  limparStatus(alvo);
  if (efeitos?.flutuar) efeitos.flutuar(alvo, "derreteu", "#fdba74");
  notar(efeitos, { tipo: "status", alvo, status: "thaw", aplicado: false });
  return true;
}

function danoResidual(ator, fracao, efeitos, cor, rotulo) {
  const dano = Math.max(1, Math.floor((ator.hpMax || 1) * fracao));
  ator.hp = Math.max(0, ator.hp - dano);
  if (efeitos?.flutuar) efeitos.flutuar(ator, String(dano), cor);
  notar(efeitos, { tipo: "status", alvo: ator, status: rotulo, dano, residual: true });
  return dano;
}

/** Residual de fim de turno (1/8 poison, 1/16 burn). */
export function residualTurno(ator, efeitos) {
  if (!ator || ator.morto || ator.hp <= 0) return 0;
  if (ator.status === STATUS.poison) return danoResidual(ator, 1 / 8, efeitos, COR.poison, "poison");
  if (ator.status === STATUS.burn) return danoResidual(ator, 1 / 16, efeitos, COR.burn, "burn");
  return 0;
}

/**
 * Início do turno: sleep/freeze/para.
 * @returns {{ pulou: boolean, motivo?: string }}
 */
export function processarInicioTurno(ator, efeitos, rng = Math.random) {
  if (!ator || ator.morto || ator.hp <= 0) return { pulou: true, motivo: "morto" };

  if (ator.status === STATUS.sleep) {
    if ((ator.statusTurnos | 0) <= 0) {
      limparStatus(ator);
      if (efeitos?.flutuar) efeitos.flutuar(ator, "acordou", "#c4b5fd");
      notar(efeitos, { tipo: "status", alvo: ator, status: "wake" });
      return { pulou: false };
    }
    ator.statusTurnos = Math.max(0, (ator.statusTurnos | 0) - 1);
    if (efeitos?.flutuar) efeitos.flutuar(ator, "dormindo", COR.sleep);
    notar(efeitos, { tipo: "status", alvo: ator, status: "sleep", skip: true });
    return { pulou: true, motivo: "sleep" };
  }

  if (ator.status === STATUS.freeze) {
    if (rng() < 0.2) {
      limparStatus(ator);
      if (efeitos?.flutuar) efeitos.flutuar(ator, "descongelou", COR.freeze);
      notar(efeitos, { tipo: "status", alvo: ator, status: "thaw" });
      return { pulou: false };
    }
    if (efeitos?.flutuar) efeitos.flutuar(ator, "congelado", COR.freeze);
    return { pulou: true, motivo: "freeze" };
  }

  if (ator.status === STATUS.paralysis && rng() < 0.25) {
    if (efeitos?.flutuar) efeitos.flutuar(ator, "paralisado", COR.paralysis);
    notar(efeitos, { tipo: "status", alvo: ator, status: "paralysis", skip: true });
    return { pulou: true, motivo: "paralysis" };
  }

  return { pulou: false };
}

/**
 * Tempo real: chips de poison/burn, wake sleep, thaw freeze.
 * @param {"real"|"turnos"} modo
 */
export function tickStatus(ator, agora, efeitos, modo = "real") {
  if (!ator || ator.morto || ator.capturado || ator.hp <= 0) return;
  if (modo === "turnos") return;

  if (ator.status === STATUS.sleep) {
    if ((ator.dormindo || 0) <= 0) {
      limparStatus(ator);
      if (efeitos?.flutuar) efeitos.flutuar(ator, "acordou", "#c4b5fd");
      notar(efeitos, { tipo: "status", alvo: ator, status: "wake" });
    }
    return;
  }

  if (ator.status === STATUS.freeze) {
    if (!(ator.geloAte > 0)) ator.geloAte = agora + 3;
    if (agora >= ator.geloAte) {
      ator.geloAte = agora + 3;
      if (Math.random() < 0.2) {
        limparStatus(ator);
        if (efeitos?.flutuar) efeitos.flutuar(ator, "descongelou", COR.freeze);
      }
    }
    return;
  }

  if (ator.status === STATUS.poison) {
    if (!(ator.venenoAte > 0)) ator.venenoAte = agora + 4;
    if (agora >= ator.venenoAte) {
      ator.venenoAte = agora + 4;
      danoResidual(ator, 1 / 8, efeitos, COR.poison, "poison");
    }
    return;
  }

  if (ator.status === STATUS.burn) {
    if (!(ator.queimaAte > 0)) ator.queimaAte = agora + 4;
    if (agora >= ator.queimaAte) {
      ator.queimaAte = agora + 4;
      danoResidual(ator, 1 / 16, efeitos, COR.burn, "burn");
    }
  }
}
