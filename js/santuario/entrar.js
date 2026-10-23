/**
 * Enter / exit do santuário (bolso + trial + defensores).
 */
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import {
  atualizarStreaming,
  descarregarChunk,
  paraCadaChunk,
} from "../mundo/voxel/storeMundo.js";
import { CHUNK_XZ } from "../config.js";
import { estado } from "../jogo/estado.js";
import { sfx } from "../jogo/audio.js";
import { entradaAberta } from "./estadoSantuario.js";
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
import { shrineOutdoorStand } from "./colocacao.js";
import { spawnDefensoresSantuario, limparDefensoresSantuario } from "./defensores.js";
import { iniciarTrialSantuario, encerrarTrialSantuario } from "./trial.js";
import { iniciarFeixe, feixeAtivo } from "./feixe.js";
import { onShrineEnteredQuest } from "./questDevice.js";
import { abrirPuzzleSantuario } from "./interagir.js";

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
  atualizarStreaming(x, y, undefined, true);
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
    spawnDefensoresSantuario(hub);
    onShrineEnteredQuest();
    sfx("porta");
  });
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
    pousar(corpo, ox, oy, oz);
    estado.saidaGrace = 0.6;
    sfx("porta");
  });
}
