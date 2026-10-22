/**
 * Gesto ranged unificado: arco e pokébola.
 * RMB segurar = só mirar (sem carga).
 * LMB segurar = carregar; soltar LMB = disparo.
 */
import { FLECHA_FORCA_MIN, RANGED_CARGA_TEMPO } from "../config.js";
import {
  botaoDireitoSegurado,
  soltarTravaMira,
  zerarBotoesMira,
} from "../entrada/ponteiro3d.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import {
  arremessarBola,
  sincronizarGestoBola,
} from "../pokemon/captura.js";
import { TIPO_ITEM } from "../wild/catalogo.js";
import { arcoNaMao } from "./blocos.js";
import { contar, hotbarAtivo } from "./estado.js";

let carga = 0;
let estavaMirando = false;
let estavaCarregando = false;

export function bolaNaMao() {
  const item = hotbarAtivo();
  return !!(item && item.tipo === TIPO_ITEM.BOLA && contar(item.tipo, item.key) > 0);
}

/** @returns {"bow" | "bola" | null} */
export function rangedNaMao() {
  if (arcoNaMao()) return "bow";
  if (bolaNaMao()) return "bola";
  return null;
}

export function cargaRanged() {
  return carga;
}

function definirCargaFlecha(valor) {
  obterCenario3d()?.flechas?.definirCargaVisual?.(valor);
}

function dispararFlecha(corpo, forca) {
  const cen = obterCenario3d();
  cen?.flechas?.disparar?.(cen.camera3d, corpo, forca);
}

/**
 * Cancela mira/carga sem disparar (troca de slot, UI, Escape).
 */
export function cancelarRanged() {
  carga = 0;
  estavaMirando = false;
  estavaCarregando = false;
  definirCargaFlecha(0);
  sincronizarGestoBola({ carga: 0, mirando: false });
  zerarBotoesMira();
  soltarTravaMira();
}

function miraChaoDaCamera(camera3d, corpo) {
  if (!camera3d?.direcaoTiro || !corpo) return null;
  const d = camera3d.direcaoTiro;
  const hx = d.x;
  const hy = d.z;
  const len = Math.hypot(hx, hy);
  if (len < 1e-4) {
    const fx = corpo.dirX || 0;
    const fy = corpo.dirY || 1;
    const fl = Math.hypot(fx, fy) || 1;
    return { x: corpo.x + (fx / fl) * 6, y: corpo.y + (fy / fl) * 6 };
  }
  const dist = 4 + carga * 6;
  return { x: corpo.x + (hx / len) * dist, y: corpo.y + (hy / len) * dist };
}

function disparar(tipo, corpo, camera3d, forca, miraChao) {
  if (tipo === "bow") {
    dispararFlecha(corpo, forca);
    return;
  }
  if (tipo === "bola") {
    arremessarBola(corpo, {
      carga: forca,
      mira: miraChao || undefined,
      usarFacing: !miraChao,
    });
  }
}

function sincronizarVisual(tipo, mirando, camera3d, corpo) {
  const miraChao = mirando ? miraChaoDaCamera(camera3d, corpo) : null;
  if (tipo === "bow") {
    definirCargaFlecha(carga);
    sincronizarGestoBola({ carga: 0, mirando: false });
    return;
  }
  definirCargaFlecha(0);
  sincronizarGestoBola({
    carga,
    mirando,
    miraX: miraChao?.x,
    miraY: miraChao?.y,
  });
}

/**
 * @param {{
 *   dt: number,
 *   corpo: object,
 *   camera3d: object | null,
 *   mirando: boolean,
 *   carregando: boolean,
 *   soltouEsquerdo: boolean,
 * }} opts
 */
export function tickRanged(opts) {
  const tipo = rangedNaMao();
  const { dt, corpo, camera3d, mirando, carregando, soltouEsquerdo } = opts;

  if (!tipo || !corpo) {
    if (estavaMirando || estavaCarregando || carga > 0) cancelarRanged();
    else {
      definirCargaFlecha(0);
      sincronizarGestoBola({ carga: 0, mirando: false });
    }
    return;
  }

  // Soltar LMB dispara (com a carga acumulada). RMB nunca dispara.
  if (soltouEsquerdo && (estavaCarregando || carga > 0)) {
    const forca = Math.max(carga, FLECHA_FORCA_MIN);
    const mira = mirando || estavaMirando || botaoDireitoSegurado()
      ? miraChaoDaCamera(camera3d, corpo)
      : null;
    disparar(tipo, corpo, camera3d, forca, mira);
    carga = 0;
    estavaCarregando = false;
    estavaMirando = !!(mirando || botaoDireitoSegurado());
    sincronizarVisual(tipo, estavaMirando, camera3d, corpo);
    return;
  }

  if (carregando) {
    estavaCarregando = true;
    carga = Math.min(1, carga + dt / RANGED_CARGA_TEMPO);
  } else if (estavaCarregando) {
    // Soltura já tratada acima; se chegou aqui, carga foi cancelada.
    estavaCarregando = false;
    carga = 0;
  }

  estavaMirando = !!mirando;
  sincronizarVisual(tipo, mirando, camera3d, corpo);
}

/**
 * Disparo imediato (atalhos / legado). Mantém a mira se o RMB estiver segurado.
 * @param {object} corpo
 * @param {object | null} camera3d
 * @param {{ x: number, y: number } | null} [miraChao]
 */
export function pedirTiroRapido(corpo, camera3d, miraChao = null) {
  const tipo = rangedNaMao();
  if (!tipo || !corpo) return false;

  const naMira = estavaMirando || botaoDireitoSegurado();
  const forca = Math.max(carga, FLECHA_FORCA_MIN);
  const mira = naMira ? miraChaoDaCamera(camera3d, corpo) || miraChao : miraChao;
  disparar(tipo, corpo, camera3d, forca, mira);
  carga = 0;
  estavaCarregando = false;
  estavaMirando = naMira;
  sincronizarVisual(tipo, naMira, camera3d, corpo);
  return true;
}
