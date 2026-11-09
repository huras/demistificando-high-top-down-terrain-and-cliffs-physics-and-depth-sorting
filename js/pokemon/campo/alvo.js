import { POKEMON } from "../../config.js";
import { AI_MODE } from "../aiModes.js";
import { alcanceEngajavel, dist2Espaco } from "../ator.js";
import { modoEfetivo } from "./modos.js";
import { alvoRetaliacao } from "./retaliacao.js";

function vivo(a) {
  return a && !a.morto && !a.capturado && (a.hp == null || a.hp > 0);
}

/** Wilds em agro dentro do raio do treinador (DEFEND). */
function agroNoRaio(selvagens, jogador) {
  const lim = POKEMON.RAIO_AGRO * POKEMON.RAIO_AGRO;
  const out = [];
  if (!selvagens || !jogador) return out;
  for (let i = 0; i < selvagens.length; i++) {
    const s = selvagens[i];
    if (!vivo(s) || s.modo !== "agro") continue;
    if (dist2Espaco(s, jogador) > lim) continue;
    if (!alcanceEngajavel(s, jogador) && !alcanceEngajavel(jogador, s)) continue;
    out.push(s);
  }
  return out;
}

/** Qualquer selvagem vivo no raio do treinador (AGRO — Pokemon AI). */
function vivosNoRaio(selvagens, jogador) {
  const lim = POKEMON.RAIO_AGRO * POKEMON.RAIO_AGRO;
  const out = [];
  if (!selvagens || !jogador) return out;
  for (let i = 0; i < selvagens.length; i++) {
    const s = selvagens[i];
    if (!vivo(s)) continue;
    if (dist2Espaco(s, jogador) > lim) continue;
    if (!alcanceEngajavel(s, jogador) && !alcanceEngajavel(jogador, s)) continue;
    out.push(s);
  }
  return out;
}

function maisPertoDe(lista, piv) {
  let melhor = null;
  let melhorD = Infinity;
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    const d = dist2Espaco(a, piv);
    if (d < melhorD) {
      melhor = a;
      melhorD = d;
    }
  }
  return melhor;
}

/**
 * Targeting do companion (Pokemon AI).
 * Prioridade: clique (ordemAlvo) → retaliação → modo.
 */
export function escolherAlvoParty(mon, selvagens, jogador) {
  if (!vivo(mon)) return null;

  const ordem = mon.ordemAlvo;
  if (vivo(ordem) && ordem.faccao !== "party") {
    if (alcanceEngajavel(mon, ordem) || dist2Espaco(mon, ordem) <= POKEMON.RAIO_SOLTA * POKEMON.RAIO_SOLTA) {
      return ordem;
    }
  }
  if (mon.ordemAlvo && !vivo(mon.ordemAlvo)) mon.ordemAlvo = null;

  // Retaliação sticky (vale em FOLLOW/DEFEND — não some no próximo frame).
  const retalia = alvoRetaliacao(mon);
  if (retalia) return retalia;

  const modo = modoEfetivo(mon);
  if (modo === AI_MODE.STAY || modo === AI_MODE.FOLLOW) return null;

  if (modo === AI_MODE.DEFEND) {
    return maisPertoDe(agroNoRaio(selvagens, jogador), jogador || mon);
  }

  if (modo === AI_MODE.AGRO) {
    const zona = vivosNoRaio(selvagens, jogador);
    const lim2 = POKEMON.RAIO_AGRO * POKEMON.RAIO_AGRO;
    if (vivo(mon.alvo) && mon.alvo.faccao === "selvagem") {
      const ainda =
        (zona.includes(mon.alvo) || dist2Espaco(mon.alvo, jogador || mon) <= lim2) &&
        (alcanceEngajavel(mon, mon.alvo) || alcanceEngajavel(mon.alvo, mon));
      if (ainda) {
        const maisPerto = maisPertoDe(zona, jogador || mon);
        if (maisPerto && maisPerto !== mon.alvo) {
          const dAtual = dist2Espaco(mon.alvo, jogador || mon);
          const dNovo = dist2Espaco(maisPerto, jogador || mon);
          if (dNovo + 1 < dAtual) return maisPerto;
        }
        return mon.alvo;
      }
      mon.alvo = null;
    }
    return maisPertoDe(zona, jogador || mon);
  }

  if (modo === AI_MODE.AUTO_HUNT) {
    const lim = POKEMON.RAIO_AGRO * 1.4;
    const lim2 = lim * lim;
    let melhor = null;
    let melhorD = Infinity;
    for (let i = 0; i < (selvagens?.length || 0); i++) {
      const s = selvagens[i];
      if (!vivo(s)) continue;
      if (!alcanceEngajavel(mon, s)) continue;
      const d = dist2Espaco(s, mon);
      if (d > lim2) continue;
      if (d < melhorD) {
        melhor = s;
        melhorD = d;
      }
    }
    return melhor;
  }

  return null;
}

/** Alvo do selvagem: party se houver mon fora; treinador só sem party no campo. */
export function escolherAlvoWild(ator, partyMon, jogador) {
  if (!vivo(ator)) return null;
  if (ator.sonoNatural || (ator.dormindo || 0) > 0 || ator.status === "sleep") return null;

  const partyVivo = vivo(partyMon);
  const jogOk = jogador && !jogador.morto && jogador.hp > 0;
  const emGraca = (jogador?.gracaEncontro || 0) > 0;
  /** Treinador só é alvo válido sem Pokémon deployado e fora da graça do encontro. */
  const podeAlvoJogador = jogOk && !partyVivo && !emGraca;

  if (vivo(ator.pendenteAtacante)) {
    const p = ator.pendenteAtacante;
    ator.pendenteAtacante = null;
    if (p === jogador && !podeAlvoJogador) {
      // Golpe no treinador com mon fora → redireciona pra party.
      return partyVivo ? partyMon : null;
    }
    return p;
  }
  if (vivo(ator.alvo) && ator.modo === "agro") {
    const stickyJogador = ator.alvo === jogador;
    if (stickyJogador && !podeAlvoJogador) {
      // Tinha o treinador; mon saiu — troca pra party se possível.
      // (cai no pick abaixo)
    } else {
      const d = dist2Espaco(ator, ator.alvo);
      const aindaPerto = ator.agroPersistente || d <= POKEMON.RAIO_SOLTA * POKEMON.RAIO_SOLTA;
      const aindaEngaja = alcanceEngajavel(ator, ator.alvo) || alcanceEngajavel(ator.alvo, ator);
      if (aindaPerto && aindaEngaja) return ator.alvo;
    }
  }
  if (!ator.hostil && ator.modo !== "agro") return null;

  const raioBase =
    Number.isFinite(ator.raioAgro) && ator.raioAgro > 0
      ? ator.raioAgro
      : ator.hostil
        ? POKEMON.RAIO_AGRO
        : POKEMON.RAIO_AGRO * 2;
  const raio = raioBase * raioBase;
  const dParty = partyVivo ? dist2Espaco(ator, partyMon) : Infinity;
  const partyNoRaio =
    partyVivo && dParty < raio && (alcanceEngajavel(ator, partyMon) || alcanceEngajavel(partyMon, ator));

  const dJog = podeAlvoJogador ? dist2Espaco(ator, jogador) : Infinity;
  const jogNoRaio =
    podeAlvoJogador && dJog < raio && (alcanceEngajavel(ator, jogador) || alcanceEngajavel(jogador, ator));

  if (partyNoRaio) return partyMon;
  if (jogNoRaio) return jogador;
  return null;
}
