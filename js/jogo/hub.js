/** Ações do Centro, Poké Mart, ginásio e mansão. */

import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { alvoDoCentro, promptDoCentro, ORIGEM_CENTRO_X, ORIGEM_CENTRO_Y } from "../mundo/cidade/centro.js";
import { alvoDaLoja, promptDaLoja, ORIGEM_LOJA_X, ORIGEM_LOJA_Y } from "../mundo/cidade/loja.js";
import { alvoDoGinasio, promptDoGinasio, ORIGEM_GINASIO_X, ORIGEM_GINASIO_Y } from "../mundo/cidade/ginasio.js";
import { alvoDaMansao, promptDaMansao, ORIGEM_MANSAO_X, ORIGEM_MANSAO_Y } from "../mundo/cidade/mansao.js";
import { curarParty, listaParty, reporBolasCura } from "../pokemon/party.js";
import { tocarCuraCentro } from "./audio.js";
import { curaOcupada, iniciarCuraMaquina } from "./maquinaCura.js";
import { abrirPainel, avisar, estado, marcarQuest } from "./estado.js";

function origemDoPapel(papel) {
  if (papel === "loja") return { x: ORIGEM_LOJA_X, y: ORIGEM_LOJA_Y };
  if (papel === "ginasio") return { x: ORIGEM_GINASIO_X, y: ORIGEM_GINASIO_Y };
  if (papel === "mansao") return { x: ORIGEM_MANSAO_X, y: ORIGEM_MANSAO_Y };
  return { x: ORIGEM_CENTRO_X, y: ORIGEM_CENTRO_Y };
}

function ehCeladon() {
  return String(estado.interior?.casaId || "").startsWith("celadon:");
}

export function alvoDoHub(papel, x, y) {
  if (papel === "centro") return alvoDoCentro(x, y);
  if (papel === "loja") return alvoDaLoja(x, y);
  if (papel === "ginasio") return alvoDoGinasio(x, y);
  if (papel === "mansao") return alvoDaMansao(x, y);
  return null;
}

export function promptDoHub(papel, alvo) {
  if (papel === "centro") return promptDoCentro(alvo);
  if (papel === "loja") return promptDaLoja(alvo);
  if (papel === "ginasio") return promptDoGinasio(alvo);
  if (papel === "mansao") return promptDaMansao(alvo);
  return "";
}

export function ancoraDoHub(papel, alvo) {
  if (!alvo) return null;
  const o = origemDoPapel(papel);
  return { x: o.x + alvo.x, y: o.y + alvo.y, z: ALTURA_PRACA };
}

function falarRef(ref) {
  if (!ref) return;
  estado.dialogo = {
    nome: ref.nome || "…",
    linhas: (ref.fala || ["…"]).slice(),
    i: 0,
    retrato: ref.retrato || "",
    npcRef: ref,
    ancora: {
      x: Number.isFinite(ref.x) ? ref.x : 0,
      y: Number.isFinite(ref.y) ? ref.y : 0,
      z: Number.isFinite(ref.z) ? ref.z : ALTURA_PRACA,
    },
  };
  avisar();
}

export function executarAlvoHub(alvo) {
  if (!alvo) return;
  if (alvo.tipo === "cura") {
    if (curaOcupada()) return;
    curarParty();
    reporBolasCura();
    marcarQuest("centro");
    iniciarCuraMaquina(listaParty().map((m) => m.ballKey || "pokeball"));
    tocarCuraCentro();
    estado.itemGet = ehCeladon()
      ? "A enfermeira curou o time. “O jardim de Celadon fica lindo nesta época.”"
      : "A enfermeira curou o time e repôs as Pokébolas.";
    avisar();
    return;
  }
  if (alvo.tipo === "pc") {
    abrirPainel("pc");
    return;
  }
  if (alvo.tipo === "loja") {
    if (ehCeladon()) {
      estado.itemGet = "Balcão de Celadon — “Leve pó de cura pra explorar a mansão.”";
      avisar();
    }
    abrirPainel("loja");
    return;
  }
  if (alvo.tipo === "npc" || alvo.tipo === "lore") {
    falarRef(alvo.ref);
  }
}
