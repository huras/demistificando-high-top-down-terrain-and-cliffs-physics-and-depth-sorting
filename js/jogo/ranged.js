/**
 * Gesto ranged unificado: arco e pokébola.
 * RMB = só mirar. LMB segurar = carregar; soltar = disparo.
 * Hipfire: círculo de carga. Mira: arco 3D (miraArcoBola3d).
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
/** LMB down via input — permanece até mouseup/cancel (não depende só do ponteiro). */
let segurandoCarga = false;
let disparoPedido = false;

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

export function rangedCarregando() {
  return segurandoCarga || estavaCarregando;
}

/** mousedown LMB com arco/bola — inicia carga (fonte de verdade do hipfire). */
export function iniciarCargaRanged() {
  if (!rangedNaMao()) return false;
  segurandoCarga = true;
  estavaCarregando = true;
  return true;
}

/** mouseup LMB — pede disparo no próximo tick. */
export function pedirDisparoRanged() {
  if (!rangedNaMao()) return false;
  if (!segurandoCarga && !estavaCarregando && carga <= 0) return false;
  segurandoCarga = false;
  disparoPedido = true;
  return true;
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
  segurandoCarga = false;
  disparoPedido = false;
  definirCargaFlecha(0);
  sincronizarGestoBola({ carga: 0, mirando: false, camera3d: null });
  zerarBotoesMira();
  soltarTravaMira();
}

function disparar(tipo, corpo, camera3d, forca) {
  if (tipo === "bow") {
    dispararFlecha(corpo, forca);
    return;
  }
  if (tipo === "bola") {
    arremessarBola(corpo, { carga: forca, camera3d });
  }
}

function sincronizarVisual(tipo, mirando, camera3d) {
  if (tipo === "bow") {
    definirCargaFlecha(carga);
    sincronizarGestoBola({ carga: 0, mirando: false, camera3d: null });
    return;
  }
  definirCargaFlecha(0);
  // Sempre passa câmera: hipfire usa facing; mira usa direcaoTiro.
  sincronizarGestoBola({
    carga,
    mirando,
    carregando: estavaCarregando,
    camera3d,
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

  // Enquanto carrega um objeto de Força, LMB é do arremesso — não da bola/arco.
  if (opts.bloqueadoPorForca) {
    if (estavaMirando || estavaCarregando || carga > 0) cancelarRanged();
    return;
  }

  if (!tipo || !corpo) {
    if (estavaMirando || estavaCarregando || carga > 0) cancelarRanged();
    else {
      definirCargaFlecha(0);
      sincronizarGestoBola({ carga: 0, mirando: false, camera3d: null });
    }
    return;
  }

  const deveDisparar = disparoPedido || (soltouEsquerdo && (segurandoCarga || estavaCarregando || carga > 0));
  if (deveDisparar && (estavaCarregando || segurandoCarga || carga > 0 || disparoPedido)) {
    const forca = tipo === "bola" ? carga : Math.max(carga, FLECHA_FORCA_MIN);
    disparar(tipo, corpo, camera3d, forca);
    carga = 0;
    estavaCarregando = false;
    segurandoCarga = false;
    disparoPedido = false;
    estavaMirando = !!(mirando || botaoDireitoSegurado());
    sincronizarVisual(tipo, estavaMirando, camera3d);
    return;
  }
  disparoPedido = false;

  // Carga: segurandoCarga (input) ou botão do ponteiro (mira com lock).
  if (segurandoCarga || carregando) {
    estavaCarregando = true;
    carga = Math.min(1, carga + dt / RANGED_CARGA_TEMPO);
  }

  estavaMirando = !!mirando;
  sincronizarVisual(tipo, mirando, camera3d);
}

/**
 * Disparo imediato (atalhos / legado).
 * @param {object} corpo
 * @param {object | null} camera3d
 */
export function pedirTiroRapido(corpo, camera3d) {
  const tipo = rangedNaMao();
  if (!tipo || !corpo) return false;

  const naMira = estavaMirando || botaoDireitoSegurado();
  const forca = tipo === "bola" ? carga : Math.max(carga, FLECHA_FORCA_MIN);
  disparar(tipo, corpo, camera3d, forca);
  carga = 0;
  estavaCarregando = false;
  segurandoCarga = false;
  disparoPedido = false;
  estavaMirando = naMira;
  sincronizarVisual(tipo, naMira, camera3d);
  return true;
}
