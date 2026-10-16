/** Ações do laboratório: cura, cápsula, inicial e fala dos pesquisadores. */

import { alvoDoLaboratorio } from "../mundo/cidade/laboratorio.js";
import { ganharBolas, especieNoTime, montarTime, receberEspecie, curarParty } from "../pokemon/party.js";
import { sfx } from "./audio.js";
import { abrirPainel, darChave, estado, marcarQuest, temChave, avisar } from "./estado.js";

export function alvoLaboratorio(x, y) {
  return alvoDoLaboratorio(x, y);
}

export function executarAlvoLaboratorio(alvo) {
  if (!alvo) return;
  if (alvo.tipo === "cura") {
    curarParty();
    marcarQuest("centro");
    sfx("cura");
    estado.itemGet = "A máquina do Centro curou o time.";
    avisar();
    return;
  }
  if (alvo.tipo === "capsula") {
    abrirPainel("capsula");
    return;
  }
  if (alvo.tipo === "inicial") {
    const chave = alvo.ref.especie;
    if (especieNoTime(chave)) {
      estado.itemGet = "Esse Pokémon já está no time.";
      avisar();
      return;
    }
    const ator = receberEspecie(chave, 5);
    estado.itemGet = ator ? `${ator.especie.nome} entrou no time.` : "O time está cheio.";
    avisar();
    return;
  }
  if (alvo.tipo === "npc") falarNpc(alvo.ref);
}

function falarNpc(npc) {
  const feita = !!(npc.presente && temChave(npc.presente));
  if (npc.presente && !feita) {
    ganharBolas(10);
    darChave(npc.presente);
  }
  estado.dialogo = {
    nome: npc.nome,
    linhas: (feita ? npc.falaFeita : npc.fala).slice(),
    i: 0,
    retrato: npc.retrato || "",
  };
  avisar();
}

export function montarTimeCapsula(chaves, nivel) {
  if (!montarTime(chaves, nivel)) return false;
  estado.itemGet = "A cápsula montou um time novo.";
  avisar();
  return true;
}

export function darDaCapsula(chave, nivel) {
  const ator = receberEspecie(chave, nivel);
  estado.itemGet = ator ? `${ator.especie.nome} entrou no time.` : "O time está cheio.";
  avisar();
  return !!ator;
}
