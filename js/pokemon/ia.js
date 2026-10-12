import { POKEMON } from "../config.js";
import { PERFIL_COMPANHEIRO } from "../navegacao/perfilMovimento.js";
import { cancelarPath, obterResultadoPath, solicitarPath } from "../navegacao/filaPath.js";
import { TIPO_WALK } from "../navegacao/navGrade.js";
import { definirEmocao, EMOCAO } from "./emocoes.js";
import { andar } from "./locomocao.js";
import { velocidadeDe } from "./ator.js";

let donoPath = null;

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
  for (let i = 0; i < 6; i++) {
    const ang = Math.random() * Math.PI * 2;
    const raio = 2 + Math.random() * (ator.raioTerritorio - 2);
    const x = ator.casaX + Math.cos(ang) * raio;
    const y = ator.casaY + Math.sin(ang) * raio;
    if (noTerritorio(ator, x, y)) {
      ator.metaX = x;
      ator.metaY = y;
      return;
    }
  }
  ator.metaX = ator.casaX;
  ator.metaY = ator.casaY;
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

function seguirCaminho(ator, dt) {
  const res = obterResultadoPath(ator.id);
  const cells = res?.estado === "pronto" ? res.path?.cells : null;
  if (!cells?.length) return false;
  if (ator.navVersao !== res.versao && res.versao != null) {
    ator.navIdx = 0;
    ator.navVersao = res.versao;
  }
  while (ator.navIdx < cells.length) {
    const c = cells[ator.navIdx];
    const dx = c.cx + 0.5 - ator.x;
    const dy = c.cy + 0.5 - ator.y;
    if (dx * dx + dy * dy < 0.45) {
      ator.navIdx++;
      continue;
    }
    if ((c.tipo | 0) !== TIPO_WALK && ator.navIdx > 0) return false;
    const dz = (c.z || ator.z) - ator.z;
    if (Math.abs(dz) > 1.2) return false;
    andar(ator, dx, dy, velocidadeDe(ator, true), dt);
    return true;
  }
  return false;
}

function pedirCaminho(ator, alvo) {
  if (donoPath && donoPath !== ator.id) {
    const outro = obterResultadoPath(donoPath);
    if (outro && outro.estado !== "pronto") return;
  }
  donoPath = ator.id;
  ator.navIdx = 0;
  ator.navVersao++;
  solicitarPath(
    ator.id,
    PERFIL_COMPANHEIRO,
    ator.x,
    ator.y,
    alvo.x,
    alvo.y,
    ator.navVersao,
    ator.elevacao,
    alvo.z ?? alvo.elevacao ?? null,
  );
}

function vagar(ator, dt) {
  if (ator.roam === "waiting") {
    ator.espera -= dt;
    ator.andando = false;
    if (ator.espera <= 0) {
      escolherMeta(ator);
      ator.roam = "moving";
    }
    return;
  }
  const dx = ator.metaX - ator.x;
  const dy = ator.metaY - ator.y;
  if (!noTerritorio(ator, ator.metaX, ator.metaY)) escolherMeta(ator);
  if (dx * dx + dy * dy < 1) {
    ator.roam = "waiting";
    ator.espera = POKEMON.ESPERA_MIN + Math.random() * (POKEMON.ESPERA_MAX - POKEMON.ESPERA_MIN);
    ator.andando = false;
    return;
  }
  const andou = andar(ator, dx, dy, velocidadeDe(ator, false), dt);
  if (!andou) {
    ator.roam = "waiting";
    ator.espera = 0.6;
  }
}

function perseguir(ator, alvo, dt) {
  ator.replanejar -= dt;
  const moved = Math.hypot(ator.x - ator.ultimoX, ator.y - ator.ultimoY);
  if (moved < 0.15) ator.presoT += dt;
  else ator.presoT = 0;
  ator.ultimoX = ator.x;
  ator.ultimoY = ator.y;

  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const alvoAndou =
    ator._alvoX != null && Math.hypot(alvo.x - ator._alvoX, alvo.y - ator._alvoY) > 2;
  if (ator.replanejar <= 0 || alvoAndou) {
    ator.replanejar = 0.3;
    ator._alvoX = alvo.x;
    ator._alvoY = alvo.y;
    if (ator.presoT > 0.45) pedirCaminho(ator, alvo);
  }
  if (ator.presoT > 0.45 && seguirCaminho(ator, dt)) return;
  andar(ator, dx, dy, velocidadeDe(ator, true), dt);
}

function atualizarUm(ator, party, jogador, dt) {
  if (ator.morto || ator.capturado) {
    ator.andando = false;
    ator.alvo = null;
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
        if (donoPath === ator.id) donoPath = null;
      }
      ator.andando = false;
      return;
    }
    vagar(ator, dt);
    return;
  }

  if (ator._ignoraT > 0) ator._ignoraT -= dt;
  const selvagens = party.selvagens || [];
  let alvo = null;
  let melhor = POKEMON.RAIO_AGRO * POKEMON.RAIO_AGRO;
  for (let i = 0; i < selvagens.length; i++) {
    const s = selvagens[i];
    if (s.morto || s.capturado) continue;
    if (ator._ignoraT > 0 && s.id === ator._ignora) continue;
    if (Math.abs((s.z || 0) - (ator.z || 0)) > 0.9) continue;
    const d = dist2(ator, s);
    if (d < melhor) {
      melhor = d;
      alvo = s;
    }
  }
  if (alvo) {
    ator.modo = "agro";
    ator.alvo = alvo;
    const d = Math.sqrt(melhor);
    if (d > 1.15) {
      const andou = andar(ator, alvo.x - ator.x, alvo.y - ator.y, velocidadeDe(ator, true), dt);
      ator.presoT = andou ? 0 : ator.presoT + dt;
      if (ator.presoT > 0.75) {
        ator._ignora = alvo.id;
        ator._ignoraT = 2.2;
        ator.presoT = 0;
        ator.modo = "roam";
        ator.alvo = null;
      }
    } else {
      ator.andando = false;
      ator.presoT = 0;
    }
  } else {
    ator.modo = "roam";
    ator.alvo = null;
    ator.presoT = 0;
  }
}

export function atualizarIa(selvagens, mon, jogador, dt) {
  const party = { mon, selvagens };
  for (let i = 0; i < selvagens.length; i++) atualizarUm(selvagens[i], party, jogador, dt);
  if (mon) atualizarUm(mon, party, jogador, dt);
}
