/** Ações do laboratório: cura, cápsula, inicial e fala dos pesquisadores. */

import { alvoDoLaboratorio } from "../mundo/cidade/laboratorio.js";
import { ganharBolas, listaParty, receberEspecie, curarParty, reporBolasCura, substituirParty } from "../pokemon/party.js";
import { criarAtor } from "../pokemon/ator.js";
import { especie } from "../pokemon/dados.js";
import { POKEMON } from "../config.js";
import { tocarCuraCentro } from "./audio.js";
import { curaOcupada, iniciarCuraMaquina } from "./maquinaCura.js";
import { darChave, estado, guardarNaCaixa, guardarVariosNaCaixa, marcarQuest, snapshot, temChave, vagasNasCaixas, avisar } from "./estado.js";
import { abrirCapsula } from "./apiHud.js";
import { falarRinaSantuario, garantirQuestDevice } from "../santuario/questDevice.js";
import {
  falarOakLab,
  mesaIniciaisLiberada,
  openingAtiva,
  openingStage,
  podeEscolherFinal,
  concluirFinalStarter,
  OPENING_STAGE,
} from "../historia/index.js";

export function alvoLaboratorio(x, y) {
  return alvoDoLaboratorio(x, y);
}

export function executarAlvoLaboratorio(alvo) {
  if (!alvo) return;
  if (alvo.tipo === "cura") {
    if (curaOcupada()) return;
    curarParty();
    reporBolasCura();
    marcarQuest("centro");
    iniciarCuraMaquina(listaParty().map((m) => m.ballKey || "pokeball"));
    tocarCuraCentro();
    estado.itemGet = "A máquina curou o time e repôs as Pokébolas.";
    avisar();
    return;
  }
  if (alvo.tipo === "capsula") {
    abrirCapsula();
    return;
  }
  if (alvo.tipo === "inicial") {
    const chave = alvo.ref.especie;
    if (openingAtiva() && openingStage() === OPENING_STAGE.RESCUE_ROUTE) {
      // Trial só na rota (bolas scriptadas), não na mesa.
      estado.itemGet = "As Pokébolas de emergência estão na Rota 1.";
      avisar();
      return;
    }
    if (openingAtiva() && !mesaIniciaisLiberada()) {
      estado.itemGet = "O Professor ainda não liberou os iniciais.";
      avisar();
      return;
    }
    if (openingAtiva() && openingStage() === OPENING_STAGE.FINAL_STARTER) {
      if (!podeEscolherFinal()) return;
      // Mesa final: qualquer inicial da mesa.
    } else if (openingAtiva() && !podeEscolherFinal()) {
      estado.itemGet = "Termine a introdução antes de pegar um inicial permanente.";
      avisar();
      return;
    }
    const esp = especie(chave);
    if (!esp) {
      estado.itemGet = `Espécie desconhecida (${chave}).`;
      avisar();
      return;
    }
    if (listaParty().length < POKEMON.PARTY_MAX) {
      const ator = receberEspecie(chave, 5);
      estado.itemGet = ator ? `${ator.especie.nome} entrou no time.` : "Não foi possível receber.";
      if (ator && openingAtiva() && openingStage() === OPENING_STAGE.FINAL_STARTER) {
        concluirFinalStarter();
      }
      avisar();
      return;
    }
    const ator = criarAtor({
      especie: esp,
      nivel: 5,
      shiny: false,
      faccao: "party",
      x: 0,
      y: 0,
      z: 1,
      hostil: false,
    });
    if (!guardarNaCaixa(snapshot(ator))) {
      estado.itemGet = "O time e o PC estão cheios.";
      avisar();
      return;
    }
    estado.itemGet = `${esp.nome} foi para o PC.`;
    avisar();
    return;
  }
  if (alvo.tipo === "npc") falarNpc(alvo.ref);
}

function falarNpc(npc) {
  const ancora = {
    x: Number.isFinite(npc.x) ? npc.x : 0,
    y: Number.isFinite(npc.y) ? npc.y : 0,
    z: Number.isFinite(npc.z) ? npc.z : 0,
  };
  if (npc.id === "rina") {
    garantirQuestDevice();
    estado.dialogo = {
      nome: npc.nome,
      linhas: falarRinaSantuario(),
      i: 0,
      retrato: npc.retrato || "",
      npcRef: npc,
      ancora,
    };
    avisar();
    return;
  }
  if (npc.id === "oak" || npc.role === "professor") {
    if (falarOakLab()) return;
  }
  // Cientistas avançam checkLab
  if (openingAtiva() && openingStage() === OPENING_STAGE.CHECK_LAB && npc.id !== "oak") {
    if (falarOakLab()) return;
  }
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
    npcRef: npc,
    ancora,
  };
  avisar();
}

export function montarTimeCapsula(chaves, nivel) {
  const lv = nivelCapsula(nivel);
  const atual = listaParty();
  if (vagasNasCaixas() < atual.length) {
    estado.itemGet = "O PC não cabe o time atual.";
    avisar();
    return false;
  }
  const snaps = [];
  for (let i = 0; i < atual.length; i++) snaps.push(snapshot(atual[i]));
  const atores = [];
  for (let i = 0; i < chaves.length && atores.length < POKEMON.PARTY_MAX; i++) {
    const esp = especie(chaves[i]);
    if (!esp) continue;
    atores.push(
      criarAtor({
        id: `party-cap-${i}-${esp.key}`,
        especie: esp,
        nivel: lv,
        shiny: Math.random() < 0.01,
        faccao: "party",
        x: 0,
        y: 0,
        z: 1,
        hostil: false,
      }),
    );
  }
  if (!atores.length) return false;
  substituirParty(atores);
  if (snaps.length) guardarVariosNaCaixa(snaps);
  estado.itemGet = "A cápsula montou um time novo.";
  avisar();
  return true;
}

function nivelCapsula(nivel) {
  const n = Math.round(Number(nivel));
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(100, n));
}

export function darDaCapsula(chave, nivel) {
  const lv = nivelCapsula(nivel);
  const esp = especie(chave);
  if (!esp) {
    estado.itemGet = "Espécie desconhecida.";
    avisar();
    return false;
  }
  const shiny = Math.random() < 0.01;
  const brilho = shiny ? " brilhante" : "";
  if (listaParty().length < POKEMON.PARTY_MAX) {
    const ator = receberEspecie(chave, lv, shiny);
    estado.itemGet = ator ? `${ator.especie.nome}${brilho} entrou no time.` : "O time está cheio.";
    avisar();
    return !!ator;
  }
  const ator = criarAtor({
    especie: esp,
    nivel: lv,
    shiny,
    faccao: "party",
    x: 0,
    y: 0,
    z: 1,
    hostil: false,
  });
  if (!guardarNaCaixa(snapshot(ator))) {
    estado.itemGet = "O time e o PC estão cheios.";
    avisar();
    return false;
  }
  estado.itemGet = `${esp.nome}${brilho} foi para o PC.`;
  avisar();
  return true;
}
