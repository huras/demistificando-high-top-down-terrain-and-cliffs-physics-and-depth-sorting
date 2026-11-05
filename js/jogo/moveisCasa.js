/**
 * Interação com móveis colocados na casa 3D do jogador (cura, PC, cama, bancada).
 */
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { moveisDaSala } from "../mundo/cidade/interiorCasa.js";
import { curarParty, listaParty, reporBolasCura } from "../pokemon/party.js";
import { sfx, tocarCuraCentro } from "./audio.js";
import { curaOcupada, iniciarCuraMaquina } from "./maquinaCura.js";
import { abrirPainel, avisar, estado, marcarQuest } from "./estado.js";
import { MOVEIS } from "../wild/catalogo.js";

const ALCANCE = 1.35;

function tipoDoMovel(item) {
  const key = item.key || "";
  const def = MOVEIS[key];
  if (def?.maquinaCura || item.id === "cura" || key === "maquinaCura") return "cura";
  if (def?.pc || item.id === "pc" || key === "pc") return "pc";
  if (def?.craft || key === "bancada") return "bancada";
  if (def?.cura || key === "cama" || String(item.id || "").startsWith("cama")) return "cama";
  return null;
}

/**
 * @param {number} wx
 * @param {number} wy
 * @returns {{ tipo: string, x: number, y: number, key?: string, id?: string } | null}
 */
export function alvoMovelCasa(wx, wy) {
  if (!estado.interior?.sala3d || estado.interior.papel !== "casa") return null;
  const lista = moveisDaSala();
  let best = null;
  let bestD = ALCANCE;
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    const tipo = tipoDoMovel(item);
    if (!tipo) continue;
    const d = Math.hypot(wx - item.x, wy - item.y);
    if (d >= bestD) continue;
    bestD = d;
    best = {
      tipo,
      x: item.x,
      y: item.y,
      key: item.key || "",
      id: item.id,
    };
  }
  return best;
}

export function ancoraMovelCasa(alvo) {
  if (!alvo) return null;
  return { x: alvo.x, y: alvo.y, z: ALTURA_PRACA };
}

export function executarMovelCasa(alvo) {
  if (!alvo) return;
  if (alvo.tipo === "cura") {
    if (curaOcupada()) return;
    curarParty();
    reporBolasCura();
    marcarQuest("centro");
    iniciarCuraMaquina(listaParty().map((m) => m.ballKey || "pokeball"));
    tocarCuraCentro();
    estado.itemGet = "Aparelho do Centro — time curado e Pokébolas repostas.";
    avisar();
    return;
  }
  if (alvo.tipo === "pc") {
    abrirPainel("pc");
    return;
  }
  if (alvo.tipo === "bancada") {
    estado.craft = true;
    avisar();
    return;
  }
  if (alvo.tipo === "cama") {
    curarParty();
    reporBolasCura();
    marcarQuest("centro");
    sfx("cura");
    estado.itemGet = "Descansou. Time curado e Pokébolas repostas.";
    avisar();
  }
}
