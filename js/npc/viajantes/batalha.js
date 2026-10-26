/**
 * Controlador: viajante OW → arena por turnos (multi-mon).
 */
import {
  entradaDeSlot,
  premioDinheiro,
  slotsPartyJogador,
} from "../../combate/entradaArena.js";
import {
  abrirOverlayTreinador,
  definirStatusBatalha,
  fecharOverlayTreinador,
  overlayAberto,
  tickOverlayTreinador,
} from "../../combate/overlayTreinador.js";
import {
  estadoLuta,
  iniciarLuta,
  montarLados,
  tickLuta,
} from "../../combate/luta.js";
import { definirModoLuta } from "../../combate/turnos.js";
import { estado, avisar } from "../../jogo/estado.js";
import { curarParty } from "../../pokemon/party.js";

/** @type {null|{
 *  npc: object,
 *  foeParty: {especie:string,nivel:number}[],
 *  playerSlots: {especie:string,nivel:number}[],
 *  foeIndex: number,
 *  playerIndex: number,
 *  fase: "luta"|"troca"|"fim",
 *  resultado: "vitoria"|"derrota"|null,
 *  trocaAcc: number,
 *  trocaMsg: string,
 * }} */
let sessao = null;

export function batalhaTreinadorAtiva() {
  return !!(estado.batalhaTreinador && sessao);
}

export function iniciarBatalhaViajante(npc) {
  if (!npc?.owTrainer || npc.defeatedByPlayer) return false;
  if (batalhaTreinadorAtiva()) return false;
  const playerSlots = slotsPartyJogador();
  if (!playerSlots.length) {
    estado.itemGet = "Você não tem Pokémon em condições de batalhar.";
    avisar();
    return false;
  }
  const foeParty = (npc.party || []).slice();
  if (!foeParty.length) return false;

  npc.combatHold = true;
  sessao = {
    npc,
    foeParty,
    playerSlots,
    foeIndex: 0,
    playerIndex: 0,
    fase: "luta",
    resultado: null,
    trocaAcc: 0,
    trocaMsg: "",
  };
  estado.batalhaTreinador = { npcId: npc.id };
  estado.dialogo = null;
  avisar();

  definirModoLuta("turnos");
  abrirOverlayTreinador({
    nomePlayer: "Você",
    nomeFoe: npc.nome || "Treinador",
  });
  return montarRodada();
}

function montarRodada() {
  if (!sessao) return false;
  const pSlot = sessao.playerSlots[sessao.playerIndex];
  const fSlot = sessao.foeParty[sessao.foeIndex];
  const esq = entradaDeSlot(pSlot);
  const dir = entradaDeSlot(fSlot);
  if (!esq || !dir) {
    encerrar("derrota");
    return false;
  }
  if (!montarLados(esq, dir)) {
    encerrar("derrota");
    return false;
  }
  if (!iniciarLuta()) {
    encerrar("derrota");
    return false;
  }
  sessao.fase = "luta";
  const nomeFoe = sessao.npc?.nome || "Treinador";
  definirStatusBatalha(`${nomeFoe} enviou ${dir.especie.nome}!`);
  return true;
}

function proximoIndice(lista, atual) {
  const next = atual + 1;
  return next < lista.length ? next : -1;
}

function aoAcabarRodada() {
  const e = estadoLuta();
  if (!e.acabou || !sessao) return;

  if (e.vencedor === "esquerda") {
    const next = proximoIndice(sessao.foeParty, sessao.foeIndex);
    if (next < 0) {
      encerrar("vitoria");
      return;
    }
    sessao.foeIndex = next;
    const slot = sessao.foeParty[next];
    const nome =
      String(slot.especie || "?").charAt(0).toUpperCase() +
      String(slot.especie || "?").slice(1);
    sessao.fase = "troca";
    sessao.trocaAcc = 0;
    sessao.trocaMsg = `O oponente enviou ${nome}!`;
    definirStatusBatalha(sessao.trocaMsg);
    return;
  }

  if (e.vencedor === "direita") {
    const next = proximoIndice(sessao.playerSlots, sessao.playerIndex);
    if (next < 0) {
      encerrar("derrota");
      return;
    }
    sessao.playerIndex = next;
    const slot = sessao.playerSlots[next];
    const nome =
      String(slot.especie || "?").charAt(0).toUpperCase() +
      String(slot.especie || "?").slice(1);
    sessao.fase = "troca";
    sessao.trocaAcc = 0;
    sessao.trocaMsg = `Vai, ${nome}!`;
    definirStatusBatalha(sessao.trocaMsg);
    return;
  }

  encerrar("derrota");
}

function encerrar(resultado) {
  if (!sessao) return;
  sessao.resultado = resultado;
  sessao.fase = "fim";
  const npc = sessao.npc;
  if (npc) npc.combatHold = false;

  if (resultado === "vitoria" && npc) {
    npc.defeatedByPlayer = true;
    const premio = premioDinheiro(npc.party);
    estado.dinheiro = (estado.dinheiro | 0) + premio;
    npc.fala = [
      "Uau, você é forte!",
      `Leva estes ₽${premio}. Até a próxima!`,
    ];
    estado.itemGet = `Vitória! Ganhou ₽${premio}.`;
    definirStatusBatalha(`Você venceu! +₽${premio}`);
  } else {
    curarParty();
    estado.itemGet = "Seu time foi curado após a derrota.";
    definirStatusBatalha("Você perdeu… O Centro curou seu time.");
  }

  sessao.trocaAcc = 0;
  avisar();
}

function fecharTudo() {
  fecharOverlayTreinador();
  estado.batalhaTreinador = null;
  sessao = null;
  avisar();
}

/**
 * @param {number} dt
 */
export function tickBatalhaViajante(dt) {
  if (!sessao || !overlayAberto()) return;

  if (sessao.fase === "fim") {
    tickOverlayTreinador(0, () => {});
    sessao.trocaAcc += dt;
    if (sessao.trocaAcc >= 1.4) fecharTudo();
    return;
  }

  if (sessao.fase === "troca") {
    tickOverlayTreinador(0, () => {});
    sessao.trocaAcc += dt;
    if (sessao.trocaAcc >= 0.85) montarRodada();
    return;
  }

  tickOverlayTreinador(dt, tickLuta);
  if (estadoLuta().acabou) aoAcabarRodada();
}
