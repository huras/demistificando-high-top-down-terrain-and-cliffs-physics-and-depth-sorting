/**
 * Uma caverna ativa por vez. O layout fica em cache pela id,
 * então sair e voltar não sorteia de novo.
 */
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { ORIGEM_CAVERNA_X, ORIGEM_CAVERNA_Y } from "../../mundo/bounds.js";
import { temChave } from "../../jogo/estado.js";
import { cavernaPorId, defProcedural } from "../catalogo.js";
import { definirLeituraChave, gerarInterior } from "./gerar.js";

definirLeituraChave(temChave);

/** @type {Map<string, object>} */
const cache = new Map();
/** @type {object | null} */
let ativo = null;
let folgaSaida = 0;

export function layoutAtivo() {
  return ativo;
}

export function caveIdAtiva() {
  return ativo?.id || null;
}

export function obterLayout(cave) {
  if (!cave?.id) return null;
  let lay = cache.get(cave.id);
  if (!lay) {
    lay = gerarInterior(cave);
    cache.set(cave.id, lay);
  }
  return lay;
}

export function definirCavernaAtiva(cave) {
  ativo = obterLayout(cave);
  folgaSaida = 0.85;
  return ativo;
}

export function limparCavernaAtiva() {
  ativo = null;
  folgaSaida = 0;
}

export function tickFolgaSaida(dt) {
  if (folgaSaida > 0) folgaSaida = Math.max(0, folgaSaida - dt);
}

export function saidaLiberada() {
  return folgaSaida <= 0;
}

export function caveDaBoca(boca) {
  if (!boca) return null;
  if (boca.procedural) return defProcedural(boca.ax, boca.ay);
  return cavernaPorId(boca.caveId);
}

function paraDentro(lado) {
  if (lado === "west") return { x: 1, y: 0 };
  if (lado === "east") return { x: -1, y: 0 };
  if (lado === "north") return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

export function spawnDoPortal(layout, lado) {
  const portals = layout?.portals || [];
  let portal = portals[0];
  for (let i = 0; i < portals.length; i++) {
    if (portals[i].lado === lado) portal = portals[i];
  }
  const inn = paraDentro(portal?.lado || lado || "south");
  const gx = (portal?.x ?? 1) + inn.x * 5;
  const gy = (portal?.y ?? 1) + inn.y * 5;
  return {
    x: ORIGEM_CAVERNA_X + gx + 0.5,
    y: ORIGEM_CAVERNA_Y + gy + 0.5,
    z: ALTURA_PRACA,
    dirX: inn.x,
    dirY: inn.y,
  };
}

export function portalNaBorda(x, y) {
  const lay = ativo;
  if (!lay) return null;
  const tx = x - ORIGEM_CAVERNA_X;
  const ty = y - ORIGEM_CAVERNA_Y;
  const portals = lay.portals;
  for (let i = 0; i < portals.length; i++) {
    const p = portals[i];
    if (Math.abs(tx - (p.x + 0.5)) < 1.35 && Math.abs(ty - (p.y + 0.5)) < 1.35) return p;
  }
  return null;
}
