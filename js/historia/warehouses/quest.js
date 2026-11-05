/** Quest Jenny: descobrir / limpar / entregar 8 warehouses. */

import { estado, avisar } from "../../jogo/estado.js";
import { OPENING_STAGE, ROCKET_CLEANUP } from "../flags.js";
import { garantirHistoria } from "../persistencia.js";
import { abrirDialogoHistoria } from "../sequenciador.js";
import { WAREHOUSE_COUNT, getWarehouseDef } from "./catalogo.js";
import { TXT } from "../opening/textos.js";
import { entregarParcelaViridian, openingStage } from "../opening/flow.js";

function setHas(arr, id) {
  return Array.isArray(arr) && arr.includes(id);
}

function addUnique(arr, id) {
  if (!arr.includes(id)) arr.push(id);
}

export function descobrirWarehouse(id) {
  const h = garantirHistoria();
  addUnique(h.discoveredWarehouses, id);
  if (h.rocketCleanupQuestStatus === ROCKET_CLEANUP.IDLE) {
    h.rocketCleanupQuestStatus = ROCKET_CLEANUP.AWAITING_REPORT;
  }
  sincronizarQuestJenny();
  avisar();
}

export function marcarWarehouseLimpo(id) {
  const h = garantirHistoria();
  addUnique(h.clearedWarehouses, id);
  sincronizarQuestJenny();
  avisar();
}

export function entradaDesbloqueada(id) {
  const h = garantirHistoria();
  return setHas(h.unlockedEntrances, id);
}

export function desbloquearEntrada(id) {
  const h = garantirHistoria();
  addUnique(h.unlockedEntrances, id);
  descobrirWarehouse(id);
}

export function derrotarGuard(guardId, warehouseId) {
  const h = garantirHistoria();
  addUnique(h.warehouseGuardsDefeated, guardId);
  // Ambos guards do site → unlock
  const scout = `${warehouseId}-scout`;
  const door = `${warehouseId}-door`;
  if (setHas(h.warehouseGuardsDefeated, scout) && setHas(h.warehouseGuardsDefeated, door)) {
    desbloquearEntrada(warehouseId);
  }
  avisar();
}

export function warehouseLimpo(id) {
  return setHas(garantirHistoria().clearedWarehouses, id);
}

function sincronizarQuestJenny() {
  const h = garantirHistoria();
  const n = h.clearedWarehouses.length;
  const turned = h.rocketCleanupTurnedIn.length;
  let q = estado.quests.find((item) => item.id === "rocketCleanup");
  if (!q && h.rocketCleanupQuestStatus !== ROCKET_CLEANUP.IDLE) {
    q = {
      id: "rocketCleanup",
      titulo: "Limpeza Rocket",
      texto: "Reporte à Jenny em Viridian.",
      feita: false,
      progresso: turned,
      meta: WAREHOUSE_COUNT,
    };
    estado.quests.push(q);
  }
  if (!q) return;
  if (h.rocketCleanupQuestStatus === ROCKET_CLEANUP.AWAITING_REPORT) {
    q.texto = "Fale com a Jenny em Viridian sobre os depósitos Rocket.";
  } else if (h.rocketCleanupQuestStatus === ROCKET_CLEANUP.ACTIVE) {
    q.texto = `Limpe os depósitos Rocket (${turned}/${WAREHOUSE_COUNT} reportados, ${n} limpos).`;
    q.progresso = turned;
  } else if (h.rocketCleanupQuestStatus === ROCKET_CLEANUP.DONE) {
    q.texto = "Todos os depósitos Rocket foram limpos.";
    q.feita = true;
    q.progresso = WAREHOUSE_COUNT;
  }
}

export function falarJenny() {
  const h = garantirHistoria();
  if (openingStage() === OPENING_STAGE.PARCEL && entregarParcelaViridian()) return true;
  sincronizarQuestJenny();
  if (h.rocketCleanupQuestStatus === ROCKET_CLEANUP.IDLE) {
    abrirDialogoHistoria({
      nome: "Jenny",
      linhas: ["Nada suspeito por enquanto. Fique de olho nos armazéns abandonados."],
    });
    return true;
  }
  if (h.rocketCleanupQuestStatus === ROCKET_CLEANUP.AWAITING_REPORT) {
    abrirDialogoHistoria({
      nome: "Jenny",
      linhas: TXT.jennyReport,
      onClose: () => {
        h.rocketCleanupQuestStatus = ROCKET_CLEANUP.ACTIVE;
        sincronizarQuestJenny();
        avisar();
      },
    });
    return true;
  }
  if (h.rocketCleanupQuestStatus === ROCKET_CLEANUP.ACTIVE) {
    const pendentes = h.clearedWarehouses.filter((id) => !h.rocketCleanupTurnedIn.includes(id));
    if (pendentes.length) {
      for (const id of pendentes) h.rocketCleanupTurnedIn.push(id);
      const nomes = pendentes.map((id) => getWarehouseDef(id)?.title || id).join(", ");
      abrirDialogoHistoria({
        nome: "Jenny",
        linhas: [`Registrado: ${nomes}.`, ...TXT.jennyTurnIn],
        onClose: () => {
          if (h.rocketCleanupTurnedIn.length >= WAREHOUSE_COUNT) {
            h.rocketCleanupQuestStatus = ROCKET_CLEANUP.DONE;
            abrirDialogoHistoria({ nome: "Jenny", linhas: TXT.jennyDone });
          }
          sincronizarQuestJenny();
          avisar();
        },
      });
      return true;
    }
    abrirDialogoHistoria({
      nome: "Jenny",
      linhas: [`Ainda faltam ${WAREHOUSE_COUNT - h.rocketCleanupTurnedIn.length} depósitos.`],
    });
    return true;
  }
  abrirDialogoHistoria({ nome: "Jenny", linhas: TXT.jennyDone });
  return true;
}
