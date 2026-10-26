/**
 * Converte slots de party (OW / viajante) no formato de montarLados.
 */
import { especie } from "../pokemon/dados.js";
import { listaParty } from "../pokemon/party.js";

/**
 * @param {{ especie?: string|object, nivel?: number, golpes?: string[] }|null} slot
 * @returns {{ especie: object, nivel: number, usaCorpo: boolean, usaDistancia: boolean, golpes?: string[] }|null}
 */
const ALIAS_ESPECIE = {
  nidoranf: "nidoranF",
  nidoranm: "nidoranM",
  mrmime: "mrMime",
  mimejr: "mimeJr",
};

function resolverEspecie(chaveBruta) {
  const raw = String(chaveBruta || "").trim();
  if (!raw) return null;
  const direta = especie(raw);
  if (direta) return direta;
  const alias = ALIAS_ESPECIE[raw.toLowerCase()];
  if (alias) {
    const viaAlias = especie(alias);
    if (viaAlias) return viaAlias;
  }
  return especie(raw.toLowerCase()) || null;
}

export function entradaDeSlot(slot) {
  if (!slot) return null;
  const key =
    typeof slot.especie === "string"
      ? slot.especie
      : slot.especie?.key || slot.especie?.id || "";
  const esp = typeof slot.especie === "object" && slot.especie?.stats
    ? slot.especie
    : resolverEspecie(key);
  if (!esp) return null;
  const cfg = {
    especie: esp,
    nivel: Math.max(1, slot.nivel | 0),
    usaCorpo: true,
    usaDistancia: true,
  };
  if (Array.isArray(slot.golpes) && slot.golpes.length) {
    cfg.golpes = slot.golpes.slice(0, 4);
  }
  return cfg;
}

/** Slots vivos do time do jogador no formato { especie, nivel }. */
export function slotsPartyJogador() {
  const party = listaParty() || [];
  const out = [];
  for (let i = 0; i < party.length; i++) {
    const ator = party[i];
    if (!ator || ator.morto || (ator.hp | 0) <= 0) continue;
    const key = ator.especie?.key || ator.especie?.id;
    if (!key) continue;
    out.push({
      especie: key,
      nivel: ator.nivel | 0,
      origemIndex: i,
    });
  }
  return out;
}

/** Prêmio em ₽ a partir do time do oponente. */
export function premioDinheiro(party) {
  if (!party?.length) return 80;
  let soma = 0;
  for (let i = 0; i < party.length; i++) soma += party[i].nivel | 0;
  const medio = soma / party.length;
  return Math.max(40, Math.round(medio * 24));
}
