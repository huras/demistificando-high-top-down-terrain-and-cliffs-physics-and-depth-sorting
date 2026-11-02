/**
 * Claim de base do jogador (bandeira): retângulo relocável em metros mundiais.
 */
import { AREA_KANTO } from "../mundo/regiao/grafoKanto.js";
import { paraLocalKanto } from "../mundo/bounds.js";
import {
  anyBlockerOverlaps,
  blockersCasaRegistro,
  blockersInsideRect,
  blockersMovel,
  footprintEm,
} from "./pegadas.js";
import {
  listarCasas,
  listarCercas,
  listarMoveisOutdoor,
  obterBundleEm,
  traduzirEstruturas,
} from "./estruturas.js";

/** Tamanho padrão do claim (células/metros). */
export const CLAIM_COLS_PADRAO = 16;
export const CLAIM_ROWS_PADRAO = 16;

/** @type {{ x0: number, y0: number } | null} */
let playerBase = null;

/** @type {{ cols: number, rows: number }} */
let tamanho = { cols: CLAIM_COLS_PADRAO, rows: CLAIM_ROWS_PADRAO };

let versaoBase = 0;

export function versaoBaseJogador() {
  return versaoBase;
}

export function resetBase() {
  playerBase = null;
  tamanho = { cols: CLAIM_COLS_PADRAO, rows: CLAIM_ROWS_PADRAO };
  versaoBase++;
}

export function tamanhoClaim() {
  return { cols: tamanho.cols | 0 || CLAIM_COLS_PADRAO, rows: tamanho.rows | 0 || CLAIM_ROWS_PADRAO };
}

export function definirTamanhoClaim(cols, rows) {
  tamanho = {
    cols: Math.max(8, Math.min(48, cols | 0)),
    rows: Math.max(8, Math.min(48, rows | 0)),
  };
  versaoBase++;
}

/**
 * @returns {{ x0: number, y0: number, x1: number, y1: number, cols: number, rows: number } | null}
 */
export function claimRect() {
  if (!playerBase || !Number.isFinite(playerBase.x0) || !Number.isFinite(playerBase.y0)) {
    return null;
  }
  const { cols, rows } = tamanhoClaim();
  const x0 = Math.floor(playerBase.x0);
  const y0 = Math.floor(playerBase.y0);
  return { x0, y0, x1: x0 + cols, y1: y0 + rows, cols, rows };
}

export function temClaim() {
  return !!claimRect();
}

/**
 * @param {number} x
 * @param {number} y
 */
export function pontoNoClaim(x, y) {
  const claim = claimRect();
  if (!claim) return false;
  return x >= claim.x0 && x < claim.x1 && y >= claim.y0 && y < claim.y1;
}

/**
 * @param {{ x0:number,y0:number,x1:number,y1:number }} fp
 */
export function footprintNoClaim(fp) {
  const claim = claimRect();
  if (!claim || !fp) return false;
  return (
    fp.x0 >= claim.x0 &&
    fp.y0 >= claim.y0 &&
    fp.x1 <= claim.x1 &&
    fp.y1 <= claim.y1
  );
}

/**
 * @param {number} aimX
 * @param {number} aimY
 */
export function rectClaimNaMira(aimX, aimY) {
  if (!Number.isFinite(aimX) || !Number.isFinite(aimY)) return null;
  const { cols, rows } = tamanhoClaim();
  const x0 = Math.floor(aimX);
  const y0 = Math.floor(aimY);
  return { x0, y0, x1: x0 + cols, y1: y0 + rows, cols, rows };
}

/**
 * Preview da bandeira.
 * @returns {{ ok: boolean, reason?: string, rect?: object }}
 */
export function previewBandeira(aimX, aimY) {
  const rect = rectClaimNaMira(aimX, aimY);
  if (!rect) return { ok: false, reason: "mira" };
  return { ok: true, rect };
}

/**
 * Planta ou reloca o claim. Relocação traduz estruturas internas.
 * @returns {{ ok: boolean, reason?: string, relocated?: boolean }}
 */
export function plantarBandeira(aimX, aimY) {
  const novo = rectClaimNaMira(aimX, aimY);
  if (!novo) return { ok: false, reason: "mira" };

  const antigo = claimRect();
  if (antigo) {
    const dx = novo.x0 - antigo.x0;
    const dy = novo.y0 - antigo.y0;
    if (dx !== 0 || dy !== 0) {
      const check = validarRelocacao(antigo, novo, dx, dy);
      if (!check.ok) return check;
      traduzirEstruturas(dx, dy, antigo);
    }
  }

  playerBase = { x0: novo.x0, y0: novo.y0 };
  versaoBase++;
  return { ok: true, relocated: !!antigo };
}

function validarRelocacao(antigo, novo, dx, dy) {
  const casas = listarCasas().filter((h) => footprintNoClaimRect(antigo, blockersCasaRegistro(h)[0]));
  for (const h of casas) {
    const moved = {
      ...h,
      x: h.x + dx,
      y: h.y + dy,
    };
    const blockers = blockersCasaRegistro(moved);
    if (!blockersInsideRect(blockers, novo)) {
      return { ok: false, reason: "foraClaim" };
    }
  }
  const moveis = listarMoveisOutdoor().filter((f) => pontoNoRect(antigo, f.x + 0.5, f.y + 0.5));
  for (const f of moveis) {
    const b = blockersMovel(f.x + dx, f.y + dy, f.cols || 1, f.rows || 1);
    if (!blockersInsideRect(b, novo)) return { ok: false, reason: "foraClaim" };
  }
  const cercas = listarCercas().filter((c) => pontoNoRect(antigo, c.tx + 0.5, c.ty + 0.5));
  for (const c of cercas) {
    if (!pontoNoRect(novo, c.tx + dx + 0.5, c.ty + dy + 0.5)) {
      return { ok: false, reason: "foraClaim" };
    }
  }
  return { ok: true };
}

function pontoNoRect(rect, x, y) {
  return x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1;
}

function footprintNoClaimRect(claim, fp) {
  if (!claim || !fp) return false;
  return (
    fp.x0 >= claim.x0 &&
    fp.y0 >= claim.y0 &&
    fp.x1 <= claim.x1 &&
    fp.y1 <= claim.y1
  );
}

export function serializarBase() {
  if (!playerBase) return null;
  return {
    x0: playerBase.x0 | 0,
    y0: playerBase.y0 | 0,
    cols: tamanho.cols | 0,
    rows: tamanho.rows | 0,
  };
}

export function hidratarBase(dados) {
  if (!dados || !Number.isFinite(dados.x0) || !Number.isFinite(dados.y0)) {
    playerBase = null;
    tamanho = { cols: CLAIM_COLS_PADRAO, rows: CLAIM_ROWS_PADRAO };
    versaoBase++;
    return;
  }
  playerBase = { x0: dados.x0 | 0, y0: dados.y0 | 0 };
  tamanho = {
    cols: Math.max(8, Math.min(48, (dados.cols | 0) || CLAIM_COLS_PADRAO)),
    rows: Math.max(8, Math.min(48, (dados.rows | 0) || CLAIM_ROWS_PADRAO)),
  };
  versaoBase++;
}

/**
 * Bucket Kanto da origem do claim (para mapa).
 */
export function areaDoClaim() {
  const claim = claimRect();
  if (!claim) return null;
  const local = paraLocalKanto(claim.x0 + claim.cols * 0.5, claim.y0 + claim.rows * 0.5);
  if (!local) return null;
  return {
    ax: Math.floor(local.x / AREA_KANTO),
    ay: Math.floor(local.y / AREA_KANTO),
  };
}

// re-export usado em validação
export { anyBlockerOverlaps, obterBundleEm };
