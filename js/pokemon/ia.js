import { AGENTE_DIST_PARAR, POKEMON } from "../config.js";
import { ehCidade } from "../mundo/regiao/grafoKanto.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { atualizarAgente, garantirCorpoLocomocao } from "../fisica/agente.js";
import { soltarEscalada } from "../fisica/escalada.js";
import { cancelarPath } from "../navegacao/filaPath.js";
import { PERFIL_COMPANHEIRO, PERFIL_ESCALADOR } from "../navegacao/perfilMovimento.js";
import { garantirNav } from "../navegacao/seguirCaminho.js";
import { definirEmocao, EMOCAO } from "./emocoes.js";
import { emAvanco, emEsquiva, emRecuo, velocidadeDe } from "./ator.js";

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function noTerritorio(ator, x, y) {
  const dx = x - ator.casaX;
  const dy = y - ator.casaY;
  const r = ator.raioTerritorio;
  return dx * dx + dy * dy <= r * r;
}

function escolherMeta(ator) {
  const z = Math.round(ator.z ?? ator.elevacao ?? 1);
  let reserva = null;
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2;
    const raio = 2 + Math.random() * (ator.raioTerritorio - 2);
    const x = ator.casaX + Math.cos(ang) * raio;
    const y = ator.casaY + Math.sin(ang) * raio;
    if (!noTerritorio(ator, x, y) || ehCidade(x, y)) continue;
    const hz = alturaSobPes(x, y, z + 1.2);
    if (hz === z) {
      ator.metaX = x;
      ator.metaY = y;
      return;
    }
    if (reserva == null && (hz === z + 1 || hz === z - 1)) reserva = { x, y };
  }
  const meta = reserva || { x: ator.casaX, y: ator.casaY };
  ator.metaX = meta.x;
  ator.metaY = meta.y;
}

function marcarAncora(ator) {
  ator._ancoraT = 0;
  ator._ax = ator.x;
  ator._ay = ator.y;
  ator._az = ator.z ?? ator.elevacao ?? 0;
  ator._ae = ator.elevacao ?? ator.z ?? 0;
}

function pararCorpo(ator) {
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
}

function desistirMeta(ator) {
  if (ator.escalando) soltarEscalada(ator, { impulso: false, pousarBase: true });
  cancelarPath(ator.id);
  const nav = garantirNav(ator);
  nav.estado = "idle";
  nav.path = null;
  nav.climbAlvo = null;
  ator.roam = "waiting";
  ator.espera = 0.35;
  pararCorpo(ator);
  if (ator.noChao && !ator.pulando) ator.acao = "parado";
  marcarAncora(ator);
}

function entrarAgro(ator, alvo) {
  if (!alvo || alvo.morto) return;
  ator.modo = "agro";
  ator.alvo = alvo;
  ator.replanejar = 0;
}

function ameacaMaisPerto(ator, party, jogador) {
  let melhor = null;
  let melhorD = Infinity;
  const mon = party?.mon || null;
  if (mon && !mon.morto) {
    const d = dist2(ator, mon);
    if (d < melhorD) {
      melhor = mon;
      melhorD = d;
    }
  }
  if (jogador && jogador.hp > 0) {
    const d = dist2(ator, jogador);
    const prefere = ator.prefereParty && mon && !mon.morto;
    if (!prefere && d < melhorD) melhor = jogador;
    if (!mon || mon.morto) melhor = d < melhorD ? jogador : melhor;
  }
  return melhor;
}

function soltarAgro(ator, alvo) {
  if (ator.agroPersistente) return false;
  if (!alvo) return true;
  return dist2(ator, alvo) > POKEMON.RAIO_SOLTA * POKEMON.RAIO_SOLTA;
}

function tipoVoador(ator) {
  const tipos = ator.tipos || ator.especie?.tipos;
  if (!tipos) return false;
  for (let i = 0; i < tipos.length; i++) {
    if (tipos[i] === "flying") return true;
  }
  return false;
}

/** Selvagem no chão escala e pula. Só o tipo voador (e o companheiro) sobe no ar. */
function perfilCampo(ator) {
  if (ator.faccao === "party" && ator.perfil) return ator.perfil;
  return tipoVoador(ator) ? PERFIL_COMPANHEIRO : PERFIL_ESCALADOR;
}

/** Quem não voa persegue o chão embaixo de quem está no ar, não a altitude do voo. */
function zDePerseguicao(ator, alvo) {
  const z = alvo?.z ?? alvo?.elevacao ?? 0;
  if (ator.perfil?.podeVoar) return z;
  if (!alvo?.voando && !alvo?.planando) return z;
  const chao = alturaSobPes(alvo.x, alvo.y, z);
  return chao > 0 ? chao : z;
}

/** Mesmo seguidor do companheiro: pula, escala e não teleporta. distParar menor chega mais perto do ponto. */
export function irPara(ator, gx, gy, gz, vel, dt, distParar = 0) {
  if ((ator.conjuroRestante || 0) > 0) {
    pararCorpo(ator);
    return false;
  }
  const perfil = perfilCampo(ator);
  if (ator.perfil !== perfil) ator.perfil = perfil;
  garantirCorpoLocomocao(ator, ator.perfil);
  const zBase = ator.elevacao ?? ator.z ?? 0;
  const zAlvo = gz != null && gz > 0 ? gz : alturaSobPes(gx, gy, zBase + 12);
  atualizarAgente(
    ator,
    { x: gx, y: gy, z: zAlvo > 0 ? zAlvo : zBase, elevacao: zAlvo > 0 ? zAlvo : zBase },
    dt,
    vel,
    distParar,
  );
  return !!(ator.andando || ator.pulando || ator.escalando || ator.voando || ator.planando || ator.mantle);
}

function vagar(ator, dt) {
  if (ator.roam === "waiting") {
    ator.espera -= dt;
    pararCorpo(ator);
    if (ator.espera <= 0) {
      escolherMeta(ator);
      ator.roam = "moving";
      marcarAncora(ator);
    }
    return;
  }
  const dx = ator.metaX - ator.x;
  const dy = ator.metaY - ator.y;
  if (!noTerritorio(ator, ator.metaX, ator.metaY)) escolherMeta(ator);
  if (
    dx * dx + dy * dy < AGENTE_DIST_PARAR * AGENTE_DIST_PARAR &&
    ator.noChao &&
    !ator.pulando &&
    !ator.escalando
  ) {
    ator.roam = "waiting";
    ator.espera = POKEMON.ESPERA_MIN + Math.random() * (POKEMON.ESPERA_MAX - POKEMON.ESPERA_MIN);
    pararCorpo(ator);
    ator.acao = "parado";
    return;
  }
  if (ator._ancoraT == null) marcarAncora(ator);
  irPara(ator, ator.metaX, ator.metaY, null, velocidadeDe(ator, false), dt);
  const elev = ator.elevacao ?? ator.z ?? 0;
  const progXY = Math.hypot(ator.x - ator._ax, ator.y - ator._ay);
  const progZ = Math.abs((ator.z ?? 0) - ator._az);
  const subindoParede = ator.escalando && elev - ator._ae > 0.3;
  if (progXY > 0.45 || progZ >= 0.9 || subindoParede) {
    marcarAncora(ator);
    return;
  }
  ator._ancoraT += dt;
  if (ator._ancoraT > 1.3) desistirMeta(ator);
}

function perseguir(ator, alvo, dt) {
  const perfil = perfilCampo(ator);
  if (ator.perfil !== perfil) ator.perfil = perfil;
  irPara(
    ator,
    alvo.x,
    alvo.y,
    zDePerseguicao(ator, alvo),
    velocidadeDe(ator, true),
    dt,
  );
}

function atualizarUm(ator, party, jogador, dt) {
  if (ator.morto || ator.capturado || ator.preso) {
    ator.andando = false;
    ator.alvo = null;
    return;
  }
  if ((ator.conjuroRestante || 0) > 0 || emRecuo(ator) || emAvanco(ator) || emEsquiva(ator)) {
    pararCorpo(ator);
    return;
  }
  if (ator.dormindo > 0) {
    ator.dormindo -= dt;
    ator.andando = false;
    return;
  }

  if (ator.faccao === "selvagem") {
    const raioAviso = POKEMON.RAIO_AVISO * POKEMON.RAIO_AVISO;
    const raioVer = (ator.hostil ? POKEMON.RAIO_AGRO : POKEMON.RAIO_AGRO * 2) ** 2;
    const foco = ameacaMaisPerto(ator, party, jogador);
    if (!ator.efemero && !ator.avisou && foco && dist2(ator, foco) < raioAviso) {
      ator.avisou = true;
      definirEmocao(ator, EMOCAO.EXCLAMACAO);
      if (foco.faccao === "party") definirEmocao(foco, EMOCAO.EXCLAMACAO, { duracao: 1.2 });
    }
    if (ator.pendenteAtacante && !ator.pendenteAtacante.morto) {
      entrarAgro(ator, ator.pendenteAtacante);
      ator.pendenteAtacante = null;
    } else if (ator.modo !== "agro" && ator.hostil && foco && dist2(ator, foco) < raioVer) {
      entrarAgro(ator, foco);
    }
    if (ator.modo === "agro") {
      if (!ator.alvo || ator.alvo.morto) ator.alvo = ameacaMaisPerto(ator, party, jogador);
      if (ator.alvo && !soltarAgro(ator, ator.alvo)) {
        perseguir(ator, ator.alvo, dt);
        return;
      }
      if (!ator.agroPersistente) {
        ator.modo = "roam";
        ator.alvo = null;
        ator.roam = "waiting";
        ator.espera = 0.4;
        cancelarPath(ator.id);
        const nav = garantirNav(ator);
        nav.estado = "idle";
        nav.path = null;
      }
      ator.andando = false;
      return;
    }
    vagar(ator, dt);
    return;
  }

  if (ator.ordemCampo) return;

  const ordem = ator.ordemAlvo;
  if (!ordem || ordem.morto || ordem.capturado) {
    ator.ordemAlvo = null;
    ator.modo = "roam";
    ator.alvo = null;
    ator.presoT = 0;
    return;
  }
  ator.modo = "agro";
  ator.alvo = ordem;
  const perfil = perfilCampo(ator);
  if (ator.perfil !== perfil) ator.perfil = perfil;
  const d = Math.hypot(ator.x - ordem.x, ator.y - ordem.y);
  if (d > 1.15) {
    irPara(ator, ordem.x, ordem.y, zDePerseguicao(ator, ordem), velocidadeDe(ator, true), dt);
  } else {
    pararCorpo(ator);
  }
}

export function atualizarIa(selvagens, mon, jogador, dt) {
  const party = { mon, selvagens };
  for (let i = 0; i < selvagens.length; i++) atualizarUm(selvagens[i], party, jogador, dt);
  if (mon) atualizarUm(mon, party, jogador, dt);
}
