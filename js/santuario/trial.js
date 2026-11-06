/**
 * No santuário: party recall + avatar trial da espécie da pedra.
 */
import { criarAtor } from "../pokemon/ator.js";
import { especie } from "../pokemon/dados.js";
import {
  listaParty,
  pokemonDeployado,
  substituirParty,
} from "../pokemon/party.js";
import { especiePorDex } from "./cota.js";
import { forcarSairSimbiose } from "../jogo/simbiose.js";

/** @type {object[] | null} */
let backup = null;

export function emTrialSantuario() {
  return !!backup;
}

/**
 * @param {object} hub
 */
export function iniciarTrialSantuario(hub) {
  if (backup) return;
  const party = listaParty();
  backup = party.slice();
  const esp =
    (hub.speciesKey && especie(hub.speciesKey)) ||
    especiePorDex(hub.dex) ||
    especie("eevee");
  if (!esp) {
    backup = null;
    return;
  }
  const nivel = Math.max(5, pokemonDeployado()?.nivel || party[0]?.nivel || 10);
  const trial = criarAtor({
    id: `shrine-trial-${hub.shrineId}`,
    especie: esp,
    nivel,
    faccao: "party",
    x: hub.spawn.x,
    y: hub.spawn.y,
    z: hub.spawn.z,
    hostil: false,
  });
  trial._trialSantuario = true;
  trial._shrineAvatar = true;
  substituirParty([trial]);
}

/** Party de verdade enquanto o avatar do trial ocupa a lista. */
export function partyRealOuAtual() {
  return backup || listaParty();
}

export function encerrarTrialSantuario(corpo) {
  if (!backup) return;
  forcarSairSimbiose(corpo);
  substituirParty(backup);
  backup = null;
}
