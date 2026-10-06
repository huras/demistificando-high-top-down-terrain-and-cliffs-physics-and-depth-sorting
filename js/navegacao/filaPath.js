import { PATH_EXPAND_POR_FRAME } from "../config.js";
import { criarBusca, expandirBusca, reconstruirCaminho } from "./astar.js";
import { celulaDeChave, chaveCelula, obterNavGrade } from "./navGrade.js";

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
 * Solicita (ou atualiza) path. Não bloqueia — resultado via obterResultadoPath.
 */
export function solicitarPath(entidadeId, perfil, sx, sy, gx, gy, versao = 0) {
  const startKey = chaveCelula(sx | 0, sy | 0);
  const goalKey = chaveCelula(gx | 0, gy | 0);
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

  const grade = obterNavGrade(perfil, sx | 0, sy | 0, gx | 0, gy | 0);
  // #region agent log
  const __gk = chaveCelula(gx | 0, gy | 0);
  const __goalIn = grade.edges.has(__gk);
  if (!solicitarPath.__lastLog || performance.now() - solicitarPath.__lastLog > 800) {
    const __dist = Math.hypot((gx|0)-(sx|0),(gy|0)-(sy|0));
    fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'proc-follow',hypothesisId:'H-NavFar',location:'filaPath.js:solicitarPath',message:'path_request',data:{sx:sx|0,sy:sy|0,gx:gx|0,gy:gy|0,dist:+__dist.toFixed(1),goalInGrade:__goalIn,startInGrade:grade.edges.has(startKey),gradeW:(grade.x1-grade.x0+1),gradeH:(grade.y1-grade.y0+1),gx0:grade.x0,gy0:grade.y0,gx1:grade.x1,gy1:grade.y1},timestamp:Date.now()})}).catch(()=>{});
    solicitarPath.__lastLog = performance.now();
  }
  // #endregion
  const busca = criarBusca(grade, startKey, goalKey);
  const pedido = {
    entidadeId,
    estado: "buscando",
    busca,
    path: null,
    versao,
    perfilId: perfil.id,
    startKey,
    goalKey,
    coalesce: ck,
  };
  pedidos.set(entidadeId, pedido);
  if (!filaOrdem.includes(entidadeId)) filaOrdem.push(entidadeId);
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
    const fatia = Math.max(32, Math.min(restam, (orcamento / Math.max(1, filaOrdem.length)) | 0));
    const terminou = expandirBusca(p.busca, fatia);
    restam -= fatia;

    if (terminou) {
      const path = reconstruirCaminho(p.busca);
      p.path = path;
      p.estado = "pronto";
      cacheResultado.set(p.coalesce, { path, t: performance.now() });
      // #region agent log
      fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix3',hypothesisId:'Float32',location:'filaPath.js:tickFilaPath',message:'path_done',data:{achou:!!path.achou,cells:path.cells?.length??0,expansoes:p.busca?.expansoes??0,id,start:celulaDeChave(p.startKey),goal:celulaDeChave(p.goalKey)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      filaOrdem.shift();
    } else {
      // round-robin
      filaOrdem.push(filaOrdem.shift());
    }
  }

  // limpa cache velho ocasionalmente
  if (cacheResultado.size > 64) {
    const agora = performance.now();
    for (const [k, v] of cacheResultado) {
      if (agora - v.t > CACHE_TTL_MS * 3) cacheResultado.delete(k);
    }
  }
}
