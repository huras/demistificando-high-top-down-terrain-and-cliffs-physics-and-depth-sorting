/**
 * Enter / exit do santuário (bolso + trial + defensores).
 */
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import {
  atualizarStreaming,
  atualizarStreamingDuplo,
  descarregarChunk,
  obterRaioStream,
  paraCadaChunk,
} from "../mundo/voxel/storeMundo.js";
import { CHUNK_XZ } from "../config.js";
import { estado } from "../jogo/estado.js";
import { sfx } from "../jogo/audio.js";
import { entradaAberta, santuarioLimpo } from "./estadoSantuario.js";
import {
  criarInteriorSantuario,
  limparSantuarioAtivo,
  naSaidaSantuario,
  ORIGEM_SANTUARIO_X,
  ORIGEM_SANTUARIO_Y,
  SHRINE_INTERIOR_COLS,
  SHRINE_INTERIOR_ROWS,
  spawnSantuario,
} from "./interior.js";
import { findShrineSlotById, shrineOutdoorStand } from "./colocacao.js";
import { spawnDefensoresSantuario, limparDefensoresSantuario } from "./defensores.js";
import { iniciarTrialSantuario, encerrarTrialSantuario } from "./trial.js";
import { iniciarFeixe, feixeAtivo } from "./feixe.js";
import { onShrineEnteredQuest } from "./questDevice.js";
import { abrirPuzzleSantuario } from "./interagir.js";
import { pousarCompanheiro } from "../pokemon/pousarCompanheiro.js";

function descarregarBolsoSantuario() {
  const x0 = Math.floor((ORIGEM_SANTUARIO_X - 8) / CHUNK_XZ);
  const y0 = Math.floor((ORIGEM_SANTUARIO_Y - 8) / CHUNK_XZ);
  const x1 = Math.floor((ORIGEM_SANTUARIO_X + SHRINE_INTERIOR_COLS + 8) / CHUNK_XZ);
  const y1 = Math.floor((ORIGEM_SANTUARIO_Y + SHRINE_INTERIOR_ROWS + 8) / CHUNK_XZ);
  const alvos = [];
  paraCadaChunk((chunk) => {
    if (chunk.cx >= x0 && chunk.cx <= x1 && chunk.cy >= y0 && chunk.cy <= y1) {
      alvos.push([chunk.cx, chunk.cy]);
    }
  });
  for (let i = 0; i < alvos.length; i++) descarregarChunk(alvos[i][0], alvos[i][1]);
}

function pousar(corpo, x, y, z = ALTURA_PRACA) {
  corpo.x = x;
  corpo.y = y;
  corpo.z = z;
  corpo.elevacao = z;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.noChao = true;
  corpo.hopLift = 0;
  corpo.pulando = false;
  corpo.pulo = null;
  const ox = estado.interior?.outdoorX;
  const oy = estado.interior?.outdoorY;
  // Mantém o overworld quente; só garante o bolso do santuário.
  if (Number.isFinite(ox) && Number.isFinite(oy)) {
    atualizarStreamingDuplo(ox, oy, x, y, obterRaioStream(), true);
  } else {
    atualizarStreaming(x, y, undefined, true);
  }
  corpo._renasceu = true;
  estado.painel = null;
}

function enterableFromStone(stone) {
  const stand = shrineOutdoorStand(stone);
  return {
    kind: "shrine",
    element: stone.element ?? "normal",
    atlasCol: stone.atlasCol ?? 0,
    shrineId: stone.shrineId,
    speciesKey: stone.speciesKey,
    dex: stone.dex ?? 0,
    x: stone.x,
    y: stone.y,
    outdoorX: stand.x,
    outdoorY: stand.y,
    outdoorZ: stone.z ?? ALTURA_PRACA,
    cleared: !!stone.cleared,
  };
}

/**
 * @param {object} corpo
 * @param {object} stone
 */
export function tentarEntrarSantuario(corpo, stone) {
  if (!stone || estado.interior || feixeAtivo()) return false;
  if (!entradaAberta(stone.shrineId) && !stone.entranceOpen) {
    return abrirPuzzleSantuario(stone, () => {
      stone.entranceOpen = true;
    });
  }
  const enterable = enterableFromStone(stone);
  iniciarFeixe(enterable.element, "enter", () => {
    descarregarBolsoSantuario();
    const hub = criarInteriorSantuario(enterable);
    estado.interior = {
      sala3d: true,
      papel: "santuario",
      shrineId: hub.shrineId,
      element: hub.element,
      outdoorX: hub.outdoorX,
      outdoorY: hub.outdoorY,
      outdoorZ: hub.outdoorZ,
    };
    const spawn = spawnSantuario();
    pousar(corpo, spawn.x, spawn.y, spawn.z);
    iniciarTrialSantuario(hub);
    pousarCompanheiro(corpo, { z: spawn.z });
    spawnDefensoresSantuario(hub);
    onShrineEnteredQuest();
    sfx("porta");
  });
  return true;
}

/**
 * Restaura santuário no load (sem feixe / SFX de porta).
 * @param {object} corpo
 * @param {object} snap
 * @param {{ x: number, y: number, z?: number, facing?: number, dirX?: number, dirY?: number } | null} local
 */
export function restaurarSantuarioSalvo(corpo, snap, local) {
  if (!corpo || !snap?.shrineId) return false;
  const slot = findShrineSlotById(snap.shrineId);
  const outdoorX = Number.isFinite(snap.outdoorX)
    ? snap.outdoorX
    : slot
      ? shrineOutdoorStand(slot).x
      : null;
  const outdoorY = Number.isFinite(snap.outdoorY)
    ? snap.outdoorY
    : slot
      ? shrineOutdoorStand(slot).y
      : null;
  if (!Number.isFinite(outdoorX) || !Number.isFinite(outdoorY)) return false;

  descarregarBolsoSantuario();
  const enterable = {
    kind: "shrine",
    element: snap.element || slot?.element || "normal",
    atlasCol: slot?.atlasCol ?? 0,
    shrineId: snap.shrineId,
    speciesKey: slot?.speciesKey,
    dex: slot?.dex ?? 0,
    outdoorX,
    outdoorY,
    outdoorZ: Number.isFinite(snap.outdoorZ)
      ? snap.outdoorZ
      : slot?.z ?? ALTURA_PRACA,
    cleared: santuarioLimpo(snap.shrineId) || !!slot?.cleared,
  };
  const hub = criarInteriorSantuario(enterable);
  estado.interior = {
    sala3d: true,
    papel: "santuario",
    shrineId: hub.shrineId,
    element: hub.element,
    outdoorX: hub.outdoorX,
    outdoorY: hub.outdoorY,
    outdoorZ: hub.outdoorZ,
  };
  const spawn = spawnSantuario();
  const x = Number.isFinite(local?.x) ? local.x : spawn.x;
  const y = Number.isFinite(local?.y) ? local.y : spawn.y;
  const z = Number.isFinite(local?.z) ? local.z : spawn.z;
  pousar(corpo, x, y, z);
  if (local) {
    if (Number.isFinite(local.facing)) corpo.facing = local.facing | 0;
    if (Number.isFinite(local.dirX)) corpo.dirX = local.dirX;
    if (Number.isFinite(local.dirY)) corpo.dirY = local.dirY;
  }
  iniciarTrialSantuario(hub);
  pousarCompanheiro(corpo, { z });
  spawnDefensoresSantuario(hub);
  return true;
}

export function checarSaidaSantuario(corpo) {
  if (estado.interior?.papel !== "santuario") return false;
  if (feixeAtivo()) return false;
  if (!naSaidaSantuario(corpo.x, corpo.y)) return false;
  sairSantuario(corpo);
  return true;
}

export function sairSantuario(corpo) {
  const interior = estado.interior;
  if (!interior || interior.papel !== "santuario") return;
  if (feixeAtivo()) return;
  const element = interior.element || "normal";
  const ox = interior.outdoorX;
  const oy = interior.outdoorY;
  const oz = interior.outdoorZ ?? ALTURA_PRACA;
  iniciarFeixe(element, "exit", () => {
    encerrarTrialSantuario();
    limparDefensoresSantuario();
    limparSantuarioAtivo();
    estado.interior = null;
    corpo.x = ox;
    corpo.y = oy;
    corpo.z = oz;
    corpo.elevacao = oz;
    corpo.vx = 0;
    corpo.vy = 0;
    corpo.vz = 0;
    corpo.noChao = true;
    corpo.hopLift = 0;
    corpo.pulando = false;
    corpo.pulo = null;
    // Outdoor já ancorado na visita — solta o bolso em background.
    atualizarStreaming(ox, oy, undefined, false);
    corpo._renasceu = true;
    pousarCompanheiro(corpo, { z: oz });
    estado.painel = null;
    estado.saidaGrace = 0.6;
    sfx("porta");
  });
}
