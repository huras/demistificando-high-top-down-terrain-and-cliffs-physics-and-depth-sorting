/** Stage machine da opening. */

import { estado, avisar, marcarQuest, darChave, temChave } from "../../jogo/estado.js";
import { CAMERA3D_DIST_PADRAO } from "../../config.js";
import { OPENING_STAGE, OPENING_TRANSITIONS } from "../flags.js";
import { garantirHistoria } from "../persistencia.js";
import { beginCamTween, cancelarCameraEvento } from "../cameraEvento.js";
import { travarHistoria, liberarHistoria } from "../travas.js";
import { adicionarAtorScriptado, limparAtoresScriptados, removerAtorScriptado } from "../atoresScriptados.js";
import { abrirDialogoHistoria, encadearDialogos } from "../sequenciador.js";
import { OPENING_KANTO_STARTERS, resolveOpeningRivalStarters } from "./starters.js";
import { locaisOpening } from "./locais.js";
import { TXT, retratoOak, retratoRival } from "./textos.js";

const KEEP_OUT = 8;

export function openingAtiva() {
  const op = garantirHistoria().opening;
  return !!(op?.active && op.stage !== OPENING_STAGE.COMPLETE && op.stage !== OPENING_STAGE.LEGACY);
}

export function openingStage() {
  return garantirHistoria().opening?.stage || OPENING_STAGE.COMPLETE;
}

export function avancarOpening(next) {
  const h = garantirHistoria();
  const op = h.opening;
  if (!op) return false;
  if (op.stage === next) return false;
  if (
    op.stage !== OPENING_STAGE.LEGACY &&
    OPENING_TRANSITIONS[op.stage] !== next
  ) {
    return false;
  }
  op.stage = next;
  if (next === OPENING_STAGE.COMPLETE) {
    op.active = false;
    liberarHistoria();
    cancelarCameraEvento(null);
    limparAtoresScriptados((a) => a.openingActor);
  }
  sincronizarQuestHud();
  avisar();
  return true;
}

function sincronizarQuestHud() {
  const stage = openingStage();
  const mapa = {
    [OPENING_STAGE.VISIT_LAB]: TXT.visitLab,
    [OPENING_STAGE.CHECK_LAB]: TXT.checkLab,
    [OPENING_STAGE.RESCUE_ROUTE]: TXT.rescueRoute,
    [OPENING_STAGE.RESCUE_BATTLE]: TXT.rescueRoute,
    [OPENING_STAGE.SCENE_THREE]: "Volte ao laboratório.",
    [OPENING_STAGE.PARCEL]: "Leve o pacote a Viridian.",
    [OPENING_STAGE.FINAL_STARTER]: TXT.finalChoice,
  };
  const q = estado.quests.find((item) => item.id === "opening");
  const texto = mapa[stage];
  if (!texto) return;
  if (!q) {
    estado.quests.unshift({
      id: "opening",
      titulo: "Começo da jornada",
      texto,
      feita: stage === OPENING_STAGE.COMPLETE,
      progresso: 0,
      meta: 1,
    });
  } else {
    q.texto = texto;
    q.feita = stage === OPENING_STAGE.COMPLETE || stage === OPENING_STAGE.LEGACY;
  }
}

export function mesaIniciaisLiberada() {
  const stage = openingStage();
  if (!openingAtiva()) return true;
  return (
    stage === OPENING_STAGE.FINAL_STARTER ||
    stage === OPENING_STAGE.COMPLETE ||
    stage === OPENING_STAGE.LEGACY ||
    stage === OPENING_STAGE.RESCUE_ROUTE ||
    stage === OPENING_STAGE.RESCUE_BATTLE
  );
}

/** Trial na rota: só Kanto starters e só durante resgate. */
export function podeEscolherTrial() {
  const stage = openingStage();
  return stage === OPENING_STAGE.RESCUE_ROUTE;
}

export function podeEscolherFinal() {
  return openingStage() === OPENING_STAGE.FINAL_STARTER || !openingAtiva();
}

export function falarOakLab() {
  const stage = openingStage();
  if (stage === OPENING_STAGE.VISIT_LAB) {
    abrirDialogoHistoria({
      nome: "Professor Carvalho",
      linhas: TXT.oakIdleLab,
      retrato: retratoOak("serious"),
      onClose: () => avancarOpening(OPENING_STAGE.CHECK_LAB),
    });
    return true;
  }
  if (stage === OPENING_STAGE.CHECK_LAB) {
    abrirDialogoHistoria({
      nome: "Pesquisadora",
      linhas: TXT.scientistBrief,
      onClose: () => {
        avancarOpening(OPENING_STAGE.RESCUE_ROUTE);
        garantirEncontroRota();
      },
    });
    return true;
  }
  if (stage === OPENING_STAGE.SCENE_THREE) {
    iniciarCenaTrio();
    return true;
  }
  if (stage === OPENING_STAGE.PARCEL) {
    if (!temChave("oakParcel")) darChave("oakParcel");
    abrirDialogoHistoria({
      nome: "Professor Carvalho",
      linhas: TXT.parcelAsk,
      retrato: retratoOak("serious"),
    });
    return true;
  }
  if (stage === OPENING_STAGE.FINAL_STARTER) {
    abrirDialogoHistoria({
      nome: "Professor Carvalho",
      linhas: TXT.finalChoice,
      retrato: retratoOak("serious"),
    });
    return true;
  }
  return false;
}

export function garantirEncontroRota() {
  if (openingStage() !== OPENING_STAGE.RESCUE_ROUTE && openingStage() !== OPENING_STAGE.RESCUE_BATTLE) {
    return;
  }
  const loc = locaisOpening();
  adicionarAtorScriptado({
    id: "opening-oak",
    openingActor: true,
    role: "professor",
    nome: "Professor Carvalho",
    retrato: retratoOak("pinch"),
    x: loc.professor.x,
    y: loc.professor.y,
    z: 0,
    invulneravel: true,
  });
  for (let i = 0; i < OPENING_KANTO_STARTERS.length; i++) {
    const sp = OPENING_KANTO_STARTERS[i];
    adicionarAtorScriptado({
      id: `opening-ball-${sp}`,
      openingActor: true,
      role: "trialBall",
      species: sp,
      nome: "Pokébola",
      x: loc.bag.x + (i - 1) * 1.1,
      y: loc.bag.y,
      z: 0,
      oculto: true,
    });
  }
  adicionarAtorScriptado({
    id: "opening-bag",
    openingActor: true,
    role: "bag",
    nome: "Bolsa",
    x: loc.bag.x,
    y: loc.bag.y,
    z: 0,
  });
}

export function clampLongeDoOak(corpo) {
  if (openingStage() !== OPENING_STAGE.RESCUE_ROUTE) return;
  const op = garantirHistoria().opening;
  if (op.encounterPhase && op.encounterPhase !== "waitingBag") return;
  const loc = locaisOpening();
  const dx = corpo.x - loc.professor.x;
  const dy = corpo.y - loc.professor.y;
  const d = Math.hypot(dx, dy);
  if (d >= KEEP_OUT || d < 1e-4) return;
  const s = KEEP_OUT / d;
  corpo.x = loc.professor.x + dx * s;
  corpo.y = loc.professor.y + dy * s;
}

export function tentarDispararCinemaResgate(corpo) {
  if (openingStage() !== OPENING_STAGE.RESCUE_ROUTE) return false;
  const op = garantirHistoria().opening;
  if (op.encounterPhase) return false;
  const loc = locaisOpening();
  const d = Math.hypot(corpo.x - loc.bag.x, corpo.y - loc.bag.y);
  if (d > 14) return false;
  iniciarCinemaResgate(corpo);
  return true;
}

function iniciarCinemaResgate(corpo) {
  const h = garantirHistoria();
  h.cinemaAtiva = true;
  h.opening.encounterPhase = "cinemaPanOak";
  travarHistoria();
  const loc = locaisOpening();
  beginCamTween(corpo, loc.professor.x, loc.professor.y, CAMERA3D_DIST_PADRAO * 0.72, 1.2);
  // Após pan, fala do Oak
  window.setTimeout(() => {
    if (openingStage() !== OPENING_STAGE.RESCUE_ROUTE) return;
    h.opening.encounterPhase = "cinemaOakHelp";
    abrirDialogoHistoria({
      nome: "Professor Carvalho",
      linhas: TXT.rescueHelp,
      retrato: retratoOak("pinch"),
      ancora: loc.professor,
      onClose: () => panParaBolsa(corpo),
    });
  }, 1300);
}

function panParaBolsa(corpo) {
  const h = garantirHistoria();
  h.opening.encounterPhase = "cinemaPanBag";
  const loc = locaisOpening();
  beginCamTween(corpo, loc.bag.x, loc.bag.y, CAMERA3D_DIST_PADRAO * 0.55, 1.0);
  window.setTimeout(() => {
    abrirDialogoHistoria({
      nome: "Professor Carvalho",
      linhas: [...TXT.rescuePointBag, ...TXT.rescueChoice],
      retrato: retratoOak("pinch"),
      onClose: () => revelarBolas(corpo),
    });
  }, 1100);
}

function revelarBolas(corpo) {
  const h = garantirHistoria();
  h.opening.encounterPhase = "cinemaChoice";
  limparAtoresScriptados((a) => a.role === "trialBall");
  const loc = locaisOpening();
  OPENING_KANTO_STARTERS.forEach((sp, i) => {
    adicionarAtorScriptado({
      id: `opening-ball-${sp}`,
      openingActor: true,
      role: "trialBall",
      species: sp,
      nome: sp,
      x: loc.bag.x + (i - 1) * 1.2,
      y: loc.bag.y,
      z: 0,
      oculto: false,
    });
  });
  h.cinemaAtiva = false;
  liberarHistoria();
  beginCamTween(corpo, corpo.x, corpo.y, CAMERA3D_DIST_PADRAO, 0.85, "restore");
  avisar();
}

/**
 * Jogador escolhe trial starter na rota.
 * @param {string} species
 * @param {(sp: string) => void} darPokemon
 */
export function escolherTrial(species, darPokemon) {
  if (!podeEscolherTrial()) return false;
  if (!OPENING_KANTO_STARTERS.includes(species)) return false;
  const h = garantirHistoria();
  h.opening.trialSpecies = species;
  h.opening.rivalStarters = resolveOpeningRivalStarters(species);
  darPokemon?.(species);
  removerAtorScriptado(`opening-ball-${species}`);
  avancarOpening(OPENING_STAGE.RESCUE_BATTLE);
  h.opening.encounterPhase = "battle";
  abrirDialogoHistoria({
    nome: "Professor Carvalho",
    linhas: ["Agora — derrote esses Rattata!"],
    retrato: retratoOak("pinch"),
    onClose: () => {
      // Batalha simplificada: marca encontro completo (combate real pode pluguar depois).
      concluirBatalhaResgate();
    },
  });
  return true;
}

export function concluirBatalhaResgate() {
  if (openingStage() !== OPENING_STAGE.RESCUE_BATTLE) return;
  const h = garantirHistoria();
  h.opening.encounterComplete = true;
  limparAtoresScriptados((a) => a.openingActor && a.role !== "professor");
  encadearDialogos(
    [
      { nome: "Professor Carvalho", linhas: TXT.outroThanks, retrato: retratoOak("serious") },
      { nome: "Professor Carvalho", linhas: TXT.outroPraise, retrato: retratoOak("serious") },
      { nome: "Professor Carvalho", linhas: TXT.outroLabInvite, retrato: retratoOak("thinking") },
    ],
    () => {
      limparAtoresScriptados((a) => a.openingActor);
      avancarOpening(OPENING_STAGE.SCENE_THREE);
    },
  );
}

function iniciarCenaTrio() {
  const h = garantirHistoria();
  const rivals = h.opening.rivalStarters;
  encadearDialogos(
    [
      { nome: "Professor Carvalho", linhas: TXT.sceneThreeBriefing, retrato: retratoOak("serious") },
      { nome: "Red", linhas: TXT.redVow, retrato: retratoRival("red") },
      { nome: "Blue", linhas: TXT.blueVow, retrato: retratoRival("blue") },
      { nome: "Leaf", linhas: TXT.leafVow, retrato: retratoRival("leaf") },
      {
        nome: "Professor Carvalho",
        linhas: rivals
          ? [
              `Blue escolheu ${rivals.blue}. Red ficou com ${rivals.red}. Leaf espelhou com ${rivals.leaf}.`,
              ...TXT.parcelAsk,
            ]
          : TXT.parcelAsk,
        retrato: retratoOak("serious"),
      },
    ],
    () => {
      if (!temChave("oakParcel")) darChave("oakParcel");
      avancarOpening(OPENING_STAGE.PARCEL);
    },
  );
}

export function entregarParcelaViridian() {
  if (openingStage() !== OPENING_STAGE.PARCEL) return false;
  if (!temChave("oakParcel")) return false;
  // Consome a chave simbolicamente mantendo registro
  abrirDialogoHistoria({
    nome: "Atendente",
    linhas: TXT.parcelDone,
    onClose: () => avancarOpening(OPENING_STAGE.FINAL_STARTER),
  });
  return true;
}

export function concluirFinalStarter() {
  if (openingStage() !== OPENING_STAGE.FINAL_STARTER) return false;
  avancarOpening(OPENING_STAGE.COMPLETE);
  marcarQuest("opening");
  return true;
}

export function tickOpening(corpo, dt) {
  if (!openingAtiva()) return;
  sincronizarQuestHud();
  if (openingStage() === OPENING_STAGE.RESCUE_ROUTE || openingStage() === OPENING_STAGE.RESCUE_BATTLE) {
    garantirEncontroRota();
    clampLongeDoOak(corpo);
    tentarDispararCinemaResgate(corpo);
  }
  void dt;
}

export function interagirAtorOpening(ator, darPokemon) {
  if (!ator?.openingActor) return false;
  if (ator.role === "trialBall" && !ator.oculto) {
    return escolherTrial(ator.species, darPokemon);
  }
  if (ator.role === "professor") {
    abrirDialogoHistoria({
      nome: ator.nome,
      linhas: TXT.rescueHelp,
      retrato: ator.retrato,
    });
    return true;
  }
  return false;
}
