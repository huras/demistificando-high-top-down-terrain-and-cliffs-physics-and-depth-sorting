import {
  STAMINA_DRAIN_ESCALADA,
  STAMINA_MAX,
  STAMINA_REGEN,
} from "../config.js";

export function iniciarStamina(corpo) {
  corpo.staminaMax = STAMINA_MAX;
  corpo.stamina = STAMINA_MAX;
}

/** Drena só se estiver se movendo na parede. Retorna true se esgotou. */
export function drenarStaminaEscalada(corpo, dt, movendo = true) {
  if (!movendo || dt <= 0) return (corpo.stamina ?? 0) <= 1e-4;
  corpo.stamina = Math.max(0, corpo.stamina - STAMINA_DRAIN_ESCALADA * dt);
  return corpo.stamina <= 1e-4;
}

/** Regen no chão (parado ou andando). */
export function regenerarStamina(corpo, dt) {
  if (corpo.escalando || corpo.planando || (!corpo.noChao && corpo.pulando)) {
    return;
  }
  const max = corpo.staminaMax ?? STAMINA_MAX;
  if (corpo.stamina >= max) {
    corpo.stamina = max;
    return;
  }
  corpo.stamina = Math.min(max, corpo.stamina + STAMINA_REGEN * dt);
}

export function razaoStamina(corpo) {
  const max = corpo.staminaMax ?? STAMINA_MAX;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, (corpo.stamina ?? 0) / max));
}
