import { PATH_EXPAND_POR_FRAME } from "../config.js";
import { criarBusca, expandirBusca, reconstruirCaminho } from "./astar.js";
import {
  chaveCelula,
  obterNavGrade,
  pisoMaisProximo,
  tickNavGrade,
} from "./navGrade.js";

/** @type {Map<string, any>} */
const pedidos = new Map(); // entidadeId -> pedido
/** @type {Map<string, any>} */
const cacheResultado = new Map(); // coalesceKey -> { path, t }
const CACHE_TTL_MS = 400;

let filaOrdem = [];

function coalesceKey(perfilId, startKey, goalKey) {
  return `${perfilId}:${startKey}>${goalKey}`;
}

/**
 * Solicita (ou atualiza) path 3D (cx,cy,zFloor).
 * sz/gz opcionais — se null, usa piso walkable mais próximo da elevação.
 */
export function solicitarPath(
  entidadeId,
  perfil,
  sx,
  sy,
  gx,
  gy,
  versao = 0,
  sz = null,
  gz = null,
) {
  const sCx = sx | 0;
  const sCy = sy | 0;
  const gCx = gx | 0;
  const gCy = gy | 0;
  const zStart =
    sz != null
      ? pisoMaisProximo(sCx, sCy, sz, perfil)
      : pisoMaisProximo(sCx, sCy, 999, perfil);
  const zGoal =
    gz != null
      ? pisoMaisProximo(gCx, gCy, gz, perfil)
      : pisoMaisProximo(gCx, gCy, 999, perfil);
  const startKey = chaveCelula(sCx, sCy, zStart);
  const goalKey = chaveCelula(gCx, gCy, zGoal);
  const ck = coalesceKey(perfil.id, startKey, goalKey);

  const cached = cacheResultado.get(ck);
  if (cached && performance.now() - cached.t < CACHE_TTL_MS) {
    pedidos.set(entidadeId, {
      entidadeId,
      estado: "pronto",
      path: cached.path,
      versao,
      perfilId: perfil.id,
      startKey,
      goalKey,
      coalesce: ck,
    });
    return;
  }

  const existente = pedidos.get(entidadeId);
  if (
    existente &&
    !existente.busca?.pronto &&
    existente.startKey === startKey &&
    existente.goalKey === goalKey &&
    existente.perfilId === perfil.id
  ) {
    existente.versao = versao;
    return;
  }

  const grade = obterNavGrade(perfil, sCx, sCy, gCx, gCy);
  const pedido = {
    entidadeId,
    estado: grade ? "buscando" : "aguardando",
    busca: grade ? criarBusca(grade, startKey, goalKey) : null,
    path: null,
    versao,
    perfilId: perfil.id,
    perfil,
    sCx,
    sCy,
    gCx,
    gCy,
    startKey,
    goalKey,
    coalesce: ck,
  };
  pedidos.set(entidadeId, pedido);
  if (grade && !filaOrdem.includes(entidadeId)) filaOrdem.push(entidadeId);
}

function promoverGradePronta() {
  for (const p of pedidos.values()) {
    if (p.estado !== "aguardando") continue;
    const grade = obterNavGrade(p.perfil, p.sCx, p.sCy, p.gCx, p.gCy);
    if (!grade) continue;
    p.busca = criarBusca(grade, p.startKey, p.goalKey);
    p.estado = "buscando";
    if (!filaOrdem.includes(p.entidadeId)) filaOrdem.push(p.entidadeId);
  }
}

export function obterResultadoPath(entidadeId) {
  const p = pedidos.get(entidadeId);
  if (!p) return null;
  if (p.estado === "pronto") {
    return { path: p.path, versao: p.versao, estado: "pronto" };
  }
  return { path: null, versao: p.versao, estado: p.estado };
}

export function cancelarPath(entidadeId) {
  pedidos.delete(entidadeId);
  filaOrdem = filaOrdem.filter((id) => id !== entidadeId);
}

/**
 * Processa orçamento global de expansões neste frame.
 */
export function tickFilaPath(orcamento = PATH_EXPAND_POR_FRAME) {
  tickNavGrade();
  promoverGradePronta();
  if (filaOrdem.length === 0) return;
  let restam = orcamento;
  let i = 0;

  while (restam > 0 && filaOrdem.length > 0 && i < filaOrdem.length * 2) {
    i++;
    const id = filaOrdem[0];
    const p = pedidos.get(id);
    if (!p || p.estado === "pronto") {
      filaOrdem.shift();
      continue;
    }

    // fatia justa: pelo menos 32, até restam
    const fatia = Math.max(32, Math.min(restam, Math.ceil(restam / filaOrdem.length)));
    const pronto = expandirBusca(p.busca, fatia);
    restam -= fatia;

    if (pronto) {
      const path = reconstruirCaminho(p.busca);
      p.path = path;
      p.estado = "pronto";
      cacheResultado.set(p.coalesce, { path, t: performance.now() });
      filaOrdem.shift();
    }
  }
}
