import { POKEMON } from "../../config.js";
import { AI_MODE } from "../aiModes.js";
import { modoEfetivo } from "./modos.js";
import { alvoRetaliacao } from "./retaliacao.js";

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

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
    if (dist2(s, jogador) > lim) continue;
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
    if (dist2(s, jogador) > lim) continue;
    out.push(s);
  }
  return out;
}

function maisPertoDe(lista, piv) {
  let melhor = null;
  let melhorD = Infinity;
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    const d = dist2(a, piv);
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
  if (vivo(ordem) && ordem.faccao !== "party") return ordem;
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
      const ainda = zona.includes(mon.alvo) || dist2(mon.alvo, jogador || mon) <= lim2;
      if (ainda) {
        const maisPerto = maisPertoDe(zona, jogador || mon);
        if (maisPerto && maisPerto !== mon.alvo) {
          const dAtual = dist2(mon.alvo, jogador || mon);
          const dNovo = dist2(maisPerto, jogador || mon);
          if (dNovo + 1 < dAtual) return maisPerto;
        }
        return mon.alvo;
      }
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
      const d = dist2(s, mon);
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
  /** Treinador só é alvo válido sem Pokémon deployado. */
  const podeAlvoJogador = jogOk && !partyVivo;

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
      const d = dist2(ator, ator.alvo);
      if (ator.agroPersistente || d <= POKEMON.RAIO_SOLTA * POKEMON.RAIO_SOLTA) {
        return ator.alvo;
      }
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
  const dParty = partyVivo ? dist2(ator, partyMon) : Infinity;
  const partyNoRaio = partyVivo && dParty < raio;

  const dJog = podeAlvoJogador ? dist2(ator, jogador) : Infinity;
  const jogNoRaio = podeAlvoJogador && dJog < raio;

  if (partyNoRaio) return partyMon;
  if (jogNoRaio) return jogador;
  return null;
}
