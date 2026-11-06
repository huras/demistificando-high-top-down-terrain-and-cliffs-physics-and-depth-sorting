/**
 * Entrar a pé no vão. O corte só acontece com o bolso já gerado.
 */
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { ORIGEM_CAVERNA_X, ORIGEM_CAVERNA_Y } from "../mundo/bounds.js";
import {
  atualizarStreaming,
  atualizarStreamingDuplo,
  descarregarChunk,
  obterRaioStream,
  paraCadaChunk,
} from "../mundo/voxel/storeMundo.js";
import { CHUNK_XZ, RAIO_STREAM_BOLSO } from "../config.js";
import { estado } from "../jogo/estado.js";
import { sfx } from "../jogo/audio.js";
import { pousarCompanheiro } from "../pokemon/pousarCompanheiro.js";
import { bocaPorId, gatilhoSobPe } from "./bocas.js";
import { cavernaPorId } from "./catalogo.js";
import {
  caveDaBoca,
  definirCavernaAtiva,
  limparCavernaAtiva,
  layoutAtivo,
  portalNaBorda,
  saidaLiberada,
  spawnDoPortal,
  tickFolgaSaida,
} from "./interior/sessao.js";
import { iniciarPedrasCaverna, limparPedrasCaverna, tickPedrasCaverna } from "./puzzle/runtime.js";
import { limparRecompensaCaverna, soltarRecompensasAbertas } from "./recompensa.js";
import { limparSelvagensCaverna, spawnSelvagensCaverna } from "./selvagens.js";

const FADE_OUT = 0.18;
const FADE_IN = 0.28;

/** @type {{ fase: "out" | "in", t: number, corpo: object, onTeleport: () => void } | null} */
let fade = null;
/** @type {HTMLElement | null} */
let overlay = null;

function garantirOverlay() {
  if (overlay) return overlay;
  overlay = document.getElementById("jogo-porta-fade");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "jogo-porta-fade";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:80;pointer-events:none;background:#07080c;opacity:0;";
    const hud = document.getElementById("jogo-hud") || document.body;
    hud.appendChild(overlay);
  }
  return overlay;
}

function setFade(a) {
  garantirOverlay().style.opacity = String(Math.max(0, Math.min(1, a)));
}

export function soltarCaverna() {
  limparSelvagensCaverna();
  limparPedrasCaverna();
  limparRecompensaCaverna();
  descarregarBolso();
  limparCavernaAtiva();
}

export function fadeCavernaOcupado() {
  return !!fade;
}

function iniciarFade(corpo, onTeleport) {
  if (fade || !corpo) return false;
  fade = { fase: "out", t: 0, corpo, onTeleport };
  setFade(0);
  return true;
}

export function tickFadeCaverna(dt) {
  if (!fade) return;
  const d = Math.min(0.05, Math.max(0, dt || 0));
  fade.t += d;
  if (fade.fase === "out") {
    setFade(Math.min(1, fade.t / FADE_OUT));
    if (fade.t < FADE_OUT) return;
    try {
      fade.onTeleport();
    } catch (e) {
      console.error("caverna", e);
    }
    fade.fase = "in";
    fade.t = 0;
    setFade(1);
    return;
  }
  setFade(1 - Math.min(1, fade.t / FADE_IN));
  if (fade.t < FADE_IN) return;
  setFade(0);
  fade = null;
}

function descarregarBolso() {
  const lay = layoutAtivo();
  const cols = lay?.cols || 256;
  const rows = lay?.rows || 160;
  const x0 = Math.floor((ORIGEM_CAVERNA_X - 8) / CHUNK_XZ);
  const y0 = Math.floor((ORIGEM_CAVERNA_Y - 8) / CHUNK_XZ);
  const x1 = Math.floor((ORIGEM_CAVERNA_X + cols + 8) / CHUNK_XZ);
  const y1 = Math.floor((ORIGEM_CAVERNA_Y + rows + 8) / CHUNK_XZ);
  const alvos = [];
  paraCadaChunk((chunk) => {
    if (chunk.cx >= x0 && chunk.cx <= x1 && chunk.cy >= y0 && chunk.cy <= y1) {
      alvos.push([chunk.cx, chunk.cy]);
    }
  });
  for (let i = 0; i < alvos.length; i++) descarregarChunk(alvos[i][0], alvos[i][1]);
}

function pousar(corpo, x, y, z, dirX, dirY) {
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
  if (dirX || dirY) {
    corpo.dirX = dirX;
    corpo.dirY = dirY;
  }
  const ox = estado.interior?.outdoorX;
  const oy = estado.interior?.outdoorY;
  if (Number.isFinite(ox) && Number.isFinite(oy)) {
    atualizarStreamingDuplo(ox, oy, x, y, obterRaioStream(), true, RAIO_STREAM_BOLSO);
  } else {
    atualizarStreaming(x, y, undefined, true);
  }
  corpo._renasceu = true;
  estado.painel = null;
  pousarCompanheiro(corpo, { z, dirX, dirY });
}

function bocaDoPortal(caveId, lado) {
  const cave = cavernaPorId(caveId);
  if (cave) {
    for (let i = 0; i < cave.mouths.length; i++) {
      if (cave.mouths[i].portal === lado) return bocaPorId(cave.mouths[i].id);
    }
    return null;
  }
  if (String(caveId || "").startsWith("proc-")) return bocaPorId(`${caveId}-mouth`);
  return null;
}

export function tentarEntrarCaverna(corpo) {
  if (!corpo || estado.interior || fade) return false;
  const boca = gatilhoSobPe(corpo.x, corpo.y, corpo.elevacao ?? corpo.z);
  if (!boca) return false;
  const cave = caveDaBoca(boca);
  if (!cave) return false;
  return iniciarFade(corpo, () => {
    limparSelvagensCaverna();
    limparPedrasCaverna();
    limparRecompensaCaverna();
    limparCavernaAtiva();
    descarregarBolso();
    const lay = definirCavernaAtiva(cave);
    estado.interior = {
      sala3d: true,
      papel: "caverna",
      caveId: cave.id,
      bocaId: boca.id,
      outdoorX: boca.stand.x,
      outdoorY: boca.stand.y,
      outdoorZ: boca.stand.z,
    };
    const spawn = spawnDoPortal(lay, boca.portal);
    pousar(corpo, spawn.x, spawn.y, spawn.z, spawn.dirX, spawn.dirY);
    iniciarPedrasCaverna();
    spawnSelvagensCaverna(boca.stand.x, boca.stand.y);
    soltarRecompensasAbertas();
    sfx("porta");
  });
}

export function checarSaidaCaverna(corpo) {
  if (estado.interior?.papel !== "caverna" || fade || !saidaLiberada()) return false;
  const portal = portalNaBorda(corpo.x, corpo.y);
  if (!portal) return false;
  const boca = bocaDoPortal(estado.interior.caveId, portal.lado);
  if (!boca) return false;
  const ox = boca.stand.x;
  const oy = boca.stand.y;
  const oz = boca.stand.z ?? ALTURA_PRACA;
  return iniciarFade(corpo, () => {
    limparSelvagensCaverna();
    limparPedrasCaverna();
    limparRecompensaCaverna();
    limparCavernaAtiva();
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
    corpo.dirX = boca.dirX || 0;
    corpo.dirY = boca.dirY || 1;
    atualizarStreaming(ox, oy, undefined, true);
    corpo._renasceu = true;
    pousarCompanheiro(corpo, { z: oz, dirX: corpo.dirX, dirY: corpo.dirY });
    sfx("porta");
  });
}

export function tickCaverna(dt, corpo) {
  tickFadeCaverna(dt);
  if (estado.interior?.papel !== "caverna") return;
  tickFolgaSaida(dt);
  tickPedrasCaverna(dt, corpo);
}

export function restaurarCavernaSalva(corpo, snap, local) {
  if (!corpo || !snap?.caveId) return false;
  const boca = snap.bocaId ? bocaPorId(snap.bocaId) : null;
  const cave = boca ? caveDaBoca(boca) : cavernaPorId(snap.caveId);
  if (!cave) return false;
  limparCavernaAtiva();
  descarregarBolso();
  const lay = definirCavernaAtiva(cave);
  const outdoorX = Number.isFinite(snap.outdoorX) ? snap.outdoorX : boca?.stand.x;
  const outdoorY = Number.isFinite(snap.outdoorY) ? snap.outdoorY : boca?.stand.y;
  if (!Number.isFinite(outdoorX) || !Number.isFinite(outdoorY)) return false;
  estado.interior = {
    sala3d: true,
    papel: "caverna",
    caveId: cave.id,
    bocaId: boca?.id || snap.bocaId || "",
    outdoorX,
    outdoorY,
    outdoorZ: Number.isFinite(snap.outdoorZ) ? snap.outdoorZ : boca?.stand.z ?? ALTURA_PRACA,
  };
  const spawn = spawnDoPortal(lay, boca?.portal || lay.portals?.[0]?.lado);
  const x = Number.isFinite(local?.x) ? local.x : spawn.x;
  const y = Number.isFinite(local?.y) ? local.y : spawn.y;
  const z = Number.isFinite(local?.z) ? local.z : spawn.z;
  pousar(corpo, x, y, z, local?.dirX ?? spawn.dirX, local?.dirY ?? spawn.dirY);
  iniciarPedrasCaverna();
  spawnSelvagensCaverna(outdoorX, outdoorY);
  soltarRecompensasAbertas();
  return true;
}
