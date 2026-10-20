/** Tabela de tipos e dano Gen, no mesmo recorte do projeto de referência. */

const T = {
  normal: "normal",
  fire: "fire",
  water: "water",
  electric: "electric",
  grass: "grass",
  ice: "ice",
  fighting: "fighting",
  poison: "poison",
  ground: "ground",
  flying: "flying",
  psychic: "psychic",
  bug: "bug",
  rock: "rock",
  ghost: "ghost",
  dragon: "dragon",
  dark: "dark",
  steel: "steel",
  fairy: "fairy",
};

const TABELA = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5,
    bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5,
    rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2,
    ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

const NOME_TIPO = Object.freeze({
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Venenoso",
  ground: "Terra",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada",
});

export function nomeTipo(tipo) {
  return NOME_TIPO[tipo] || tipo || "";
}

export const COR_TIPO = Object.freeze({
  normal: "#9ca3af",
  fire: "#f97316",
  water: "#3b82f6",
  electric: "#eab308",
  grass: "#22c55e",
  ice: "#67e8f9",
  fighting: "#b91c1c",
  poison: "#a855f7",
  ground: "#ca8a04",
  flying: "#93c5fd",
  psychic: "#ec4899",
  bug: "#84cc16",
  rock: "#a8a29e",
  ghost: "#7c3aed",
  dragon: "#4f46e5",
  dark: "#57534e",
  steel: "#94a3b8",
  fairy: "#f9a8d4",
});

export function efetividade(tipoGolpe, tiposDefesa) {
  const linha = TABELA[tipoGolpe];
  if (!linha || !tiposDefesa?.length) return 1;
  let m = 1;
  for (let i = 0; i < tiposDefesa.length; i++) {
    const v = linha[tiposDefesa[i]];
    if (v !== undefined) m *= v;
  }
  return m;
}

export function stab(tipoGolpe, tiposAtaque) {
  return tiposAtaque?.includes(tipoGolpe) ? 1.5 : 1;
}

function nucleo(base, nivel) {
  return Math.floor((2 * Math.max(1, base) * nivel) / 100);
}

export function calcularStats(especie, nivel) {
  const lv = Math.max(1, nivel | 0);
  const hp = nucleo(especie.hp, lv) + lv + 10;
  return {
    nivel: lv,
    hp,
    ataque: nucleo(especie.atk, lv) + 5,
    defesa: nucleo(especie.def, lv) + 5,
    ataqueEsp: nucleo(especie.spa, lv) + 5,
    defesaEsp: nucleo(especie.spd, lv) + 5,
    velocidade: nucleo(especie.spe, lv) + 5,
  };
}

export function escalaVelocidade(vel) {
  return Math.max(0.75, Math.min(1.35, (vel || 50) / 50));
}

export function escalaRecarga(vel) {
  return Math.max(0.7, Math.min(1.25, 50 / Math.max(1, vel || 50)));
}

/** Multiplicador de estágio, de −6 a +6. +1 vale 1,5; +6 vale 4. */
export function multiplicadorEstagio(estagio) {
  const e = Math.max(-6, Math.min(6, estagio | 0));
  if (e >= 0) return (2 + e) / 2;
  return 2 / (2 - e);
}

function danoGen(atacante, alvo, poder, categoria) {
  const nivel = Math.max(1, atacante.nivel | 0);
  const especial = categoria === "special";
  const brutoAtk = Math.max(1, especial ? atacante.stats.ataqueEsp : atacante.stats.ataque);
  const estagioAtk = especial ? atacante.estagioSpa || 0 : atacante.estagioAtk || 0;
  let atk = Math.max(1, Math.floor(brutoAtk * multiplicadorEstagio(estagioAtk)));
  if (!especial && atacante.status === "burn") atk = Math.max(1, Math.floor(atk * 0.5));
  const brutoDef = Math.max(1, especial ? alvo.stats.defesaEsp : alvo.stats.defesa);
  const estagioDef = especial ? alvo.estagioSpd || 0 : alvo.estagioDef || 0;
  const def = Math.max(1, Math.floor(brutoDef * multiplicadorEstagio(estagioDef)));
  return (
    Math.floor(Math.floor((Math.floor((2 * nivel) / 5 + 2) * poder * atk) / def) / 50) + 2
  );
}

/**
 * Mon×mon usa a fórmula Gen. Alvo sem stats (treinador) leva o poder cru.
 */
export function calcularDano(atacante, alvo, poder, tipo, categoria) {
  if (poder <= 0) return { dano: 0, efet: 0 };
  const tiposDef = alvo.tipos || [];
  const efet = efetividade(tipo, tiposDef);
  const mult = stab(tipo, atacante.tipos) * efet;
  if (mult === 0) return { dano: 0, efet: 0 };
  const mon = !!(atacante.stats && alvo.stats);
  const base = mon ? danoGen(atacante, alvo, poder, categoria) : poder;
  return { dano: Math.max(1, Math.floor(base * mult)), efet };
}

export { T };
