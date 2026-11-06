/**
 * Chute no grid: desliza até muro ou outra pedra, ~10 células/s.
 * Sala não resolvida volta ao início quando o jogador sai.
 */
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { ORIGEM_CAVERNA_X, ORIGEM_CAVERNA_Y } from "../../mundo/bounds.js";
import { CHUNK_XZ } from "../../config.js";
import { mundoParaChunk } from "../../mundo/voxel/chunk.js";
import { carregarChunk } from "../../mundo/voxel/storeMundo.js";
import { indexarBases } from "../../fisica/obstaculos.js";
import { darChave } from "../../jogo/estado.js";
import { deslizarPedra, interruptoresCobertos } from "./gerar.js";
import { abrirPortaNoLayout, chaveResolvida } from "../interior/gerar.js";
import { escreverChaoCaverna } from "../interior/carimbar.js";
import { layoutAtivo } from "../interior/sessao.js";
import { soltarRecompensa } from "../recompensa.js";

const TILES_POR_SEG = 10;
const CX_DISCO = -9997;
const CY_DISCO = -9997;

/** @type {object[]} */
let pedras = [];

function mundoDe(sala, gx, gy) {
  return {
    x: ORIGEM_CAVERNA_X + sala.x0 + gx + 0.5,
    y: ORIGEM_CAVERNA_Y + sala.y0 + gy + 0.5,
  };
}

function salaDaPedra(idSala) {
  const lay = layoutAtivo();
  const salas = lay?.puzzles || [];
  for (let i = 0; i < salas.length; i++) {
    if (salas[i].id === idSala) return salas[i];
  }
  return null;
}

export function limparPedrasCaverna() {
  pedras = [];
  indexarBases(CX_DISCO, CY_DISCO, []);
}

export function iniciarPedrasCaverna() {
  limparPedrasCaverna();
  const lay = layoutAtivo();
  if (!lay) return;
  const salas = lay.puzzles || [];
  for (let s = 0; s < salas.length; s++) {
    const sala = salas[s];
    const lista = sala.pedras || [];
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      const pos = mundoDe(sala, p.x, p.y);
      pedras.push({
        id: `${lay.id}:${sala.id}:${p.id}`,
        salaId: sala.id,
        gid: p.id,
        gx: p.x,
        gy: p.y,
        sx: p.sx,
        sy: p.sy,
        x: pos.x,
        y: pos.y,
        anim: null,
      });
    }
  }
  sincronizarDiscos();
}

export function listarPedrasCaverna() {
  return pedras;
}

export function listarInterruptoresCaverna() {
  const lay = layoutAtivo();
  if (!lay) return [];
  const saida = [];
  const salas = lay.puzzles || [];
  for (let s = 0; s < salas.length; s++) {
    const sala = salas[s];
    const lista = sala.interruptores || [];
    for (let i = 0; i < lista.length; i++) {
      const sw = lista[i];
      const pos = mundoDe(sala, sw.x, sw.y);
      let coberto = false;
      for (let p = 0; p < pedras.length; p++) {
        const pedra = pedras[p];
        if (pedra.salaId !== sala.id || pedra.anim) continue;
        if (pedra.gx === sw.x && pedra.gy === sw.y) coberto = true;
      }
      saida.push({ x: pos.x, y: pos.y, z: ALTURA_PRACA, coberto, salaId: sala.id });
    }
  }
  return saida;
}

function sincronizarDiscos() {
  const lista = [];
  for (let i = 0; i < pedras.length; i++) {
    const p = pedras[i];
    lista.push({ x: p.x, y: p.y, z: ALTURA_PRACA, r: 0.42, tipo: "pedraCaverna" });
  }
  indexarBases(CX_DISCO, CY_DISCO, lista);
}

function pedrasDaSala(salaId) {
  const lista = [];
  for (let i = 0; i < pedras.length; i++) {
    if (pedras[i].salaId === salaId) lista.push(pedras[i]);
  }
  return lista;
}

function gradeDaSala(sala) {
  return pedrasDaSala(sala.id).map((p) => ({ id: p.gid, x: p.gx, y: p.gy }));
}

function jogadorNaSala(sala, x, y) {
  const tx = x - ORIGEM_CAVERNA_X;
  const ty = y - ORIGEM_CAVERNA_Y;
  return (
    tx >= sala.x0 - 0.35 &&
    ty >= sala.y0 - 0.35 &&
    tx < sala.x0 + sala.w + 0.35 &&
    ty < sala.y0 + sala.h + 0.35
  );
}

function resetarSala(sala) {
  const lista = pedrasDaSala(sala.id);
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    p.gx = p.sx;
    p.gy = p.sy;
    p.anim = null;
    const pos = mundoDe(sala, p.sx, p.sy);
    p.x = pos.x;
    p.y = pos.y;
  }
}

function abrirMundo(sala) {
  const lay = layoutAtivo();
  if (!lay) return;
  abrirPortaNoLayout(lay, sala);
  const wx = ORIGEM_CAVERNA_X + sala.portaMundo.x;
  const wy = ORIGEM_CAVERNA_Y + sala.portaMundo.y;
  const { cx, cy } = mundoParaChunk(wx, wy);
  const chunk = carregarChunk(cx, cy);
  if (!chunk?.gerado) return;
  const lx = (wx | 0) - cx * CHUNK_XZ;
  const ly = (wy | 0) - cy * CHUNK_XZ;
  escreverChaoCaverna(chunk, lx, ly);
  chunk.sujo = true;
}

function resolverSala(sala) {
  if (!sala || sala.aberta) return;
  const lay = layoutAtivo();
  if (!lay) return;
  if (!interruptoresCobertos(sala.interruptores, gradeDaSala(sala))) return;
  sala.aberta = true;
  darChave(chaveResolvida(lay.id, sala.id));
  abrirMundo(sala);
  soltarRecompensa(sala);
}

function terminarAnim(p) {
  const anim = p.anim;
  if (!anim) return;
  p.anim = null;
  if (anim.ejetada) {
    const sala = salaDaPedra(p.salaId);
    if (sala) resetarSala(sala);
    return;
  }
  p.gx = anim.gx;
  p.gy = anim.gy;
  p.x = anim.x1;
  p.y = anim.y1;
  const sala = salaDaPedra(p.salaId);
  if (sala) resolverSala(sala);
}

export function tickPedrasCaverna(dt, corpo) {
  const lay = layoutAtivo();
  if (!lay || !corpo) {
    if (!lay && pedras.length) limparPedrasCaverna();
    return;
  }
  let mudou = false;
  for (let i = 0; i < pedras.length; i++) {
    const p = pedras[i];
    const anim = p.anim;
    if (!anim) continue;
    anim.t += dt;
    const u = anim.dur <= 0 ? 1 : Math.min(1, anim.t / anim.dur);
    p.x = anim.x0 + (anim.x1 - anim.x0) * u;
    p.y = anim.y0 + (anim.y1 - anim.y0) * u;
    mudou = true;
    if (u >= 1) terminarAnim(p);
  }
  const salas = lay.puzzles || [];
  for (let s = 0; s < salas.length; s++) {
    const sala = salas[s];
    if (sala.aberta) continue;
    if (jogadorNaSala(sala, corpo.x, corpo.y)) continue;
    let deslizando = false;
    let fora = false;
    const lista = pedrasDaSala(sala.id);
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].anim) deslizando = true;
      if (lista[i].gx !== lista[i].sx || lista[i].gy !== lista[i].sy) fora = true;
    }
    if (!deslizando && fora) {
      resetarSala(sala);
      mudou = true;
    }
  }
  if (mudou || pedras.length) sincronizarDiscos();
}

function direcaoCardinal(corpo) {
  const dx = Number(corpo.dirX) || 0;
  const dy = Number(corpo.dirY) || 0;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return { x: Math.sign(dx), y: 0 };
  if (dy !== 0) return { x: 0, y: Math.sign(dy) };
  return null;
}

export function pedraNaFrente(corpo) {
  const dir = direcaoCardinal(corpo);
  if (!dir || !pedras.length) return null;
  const fx = corpo.x + dir.x * 0.9;
  const fy = corpo.y + dir.y * 0.9;
  let melhor = null;
  let melhorD = 0.7 * 0.7;
  for (let i = 0; i < pedras.length; i++) {
    const p = pedras[i];
    if (p.anim) continue;
    const dx = fx - p.x;
    const dy = fy - p.y;
    const d = dx * dx + dy * dy;
    if (d < melhorD) {
      melhorD = d;
      melhor = p;
    }
  }
  return melhor;
}

export function tentarChutarPedra(corpo) {
  const alvo = pedraNaFrente(corpo);
  const dir = direcaoCardinal(corpo);
  if (!alvo || !dir) return false;
  const sala = salaDaPedra(alvo.salaId);
  if (!sala?.grid) return false;
  const outras = gradeDaSala(sala);
  const resultado = deslizarPedra(sala.grid, outras, { x: alvo.gx, y: alvo.gy }, dir, () => true);
  if (!resultado) return false;
  if (!resultado.ejected && resultado.x === alvo.gx && resultado.y === alvo.gy) return false;
  const destino = resultado.ejected
    ? mundoDe(sala, alvo.sx, alvo.sy)
    : mundoDe(sala, resultado.x, resultado.y);
  const dist = Math.hypot(destino.x - alvo.x, destino.y - alvo.y);
  alvo.anim = {
    x0: alvo.x,
    y0: alvo.y,
    x1: destino.x,
    y1: destino.y,
    gx: resultado.ejected ? alvo.sx : resultado.x,
    gy: resultado.ejected ? alvo.sy : resultado.y,
    t: 0,
    dur: Math.max(0.08, dist / TILES_POR_SEG),
    ejetada: !!resultado.ejected,
  };
  return true;
}
