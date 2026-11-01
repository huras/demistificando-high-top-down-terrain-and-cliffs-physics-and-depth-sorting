/** Ações do Centro e do Poké Mart: cura, PC e balcão. */

import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { alvoDoCentro, promptDoCentro, ORIGEM_CENTRO_X, ORIGEM_CENTRO_Y } from "../mundo/cidade/centro.js";
import { alvoDaLoja, promptDaLoja, ORIGEM_LOJA_X, ORIGEM_LOJA_Y } from "../mundo/cidade/loja.js";
import { curarParty, listaParty, reporBolasCura } from "../pokemon/party.js";
import { tocarCuraCentro } from "./audio.js";
import { curaOcupada, iniciarCuraMaquina } from "./maquinaCura.js";
import { abrirPainel, avisar, estado, marcarQuest } from "./estado.js";

export function alvoDoHub(papel, x, y) {
  if (papel === "centro") return alvoDoCentro(x, y);
  if (papel === "loja") return alvoDaLoja(x, y);
  return null;
}

export function promptDoHub(papel, alvo) {
  if (papel === "centro") return promptDoCentro(alvo);
  if (papel === "loja") return promptDaLoja(alvo);
  return "";
}

export function ancoraDoHub(papel, alvo) {
  if (!alvo) return null;
  const ox = papel === "loja" ? ORIGEM_LOJA_X : ORIGEM_CENTRO_X;
  const oy = papel === "loja" ? ORIGEM_LOJA_Y : ORIGEM_CENTRO_Y;
  return { x: ox + alvo.x, y: oy + alvo.y, z: ALTURA_PRACA };
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
    estado.itemGet = "A enfermeira curou o time e repôs as Pokébolas.";
    avisar();
    return;
  }
  if (alvo.tipo === "pc") {
    abrirPainel("pc");
    return;
  }
  if (alvo.tipo === "loja") abrirPainel("loja");
}
