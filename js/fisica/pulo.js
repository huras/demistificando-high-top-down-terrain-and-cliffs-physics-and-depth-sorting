import {
  GRAVIDADE,
  GRAVIDADE_PULO_SEGURANDO,
  PULO_BUFFER,
  PULO_CORTE_SOLTAR,
  PULO_COYOTE,
  PULO_EMPURRAO_POUSO,
  PULO_EPS_POUSO,
  PULO_VELOCIDADE,
  RAIO_CORPO,
} from "../config.js";
import { teclaBaixa } from "../entrada/teclado.js";
import { dentroDoMapa } from "../mundo/altura.js";
import { resolverAguaAereo } from "./agua.js";
import {
  alturaSobPes,
  aplicarTetoOverhang,
  chaoSobElevacao,
  corpoColideSolido,
  podeEntrar,
} from "./colisao.js";

/** Edge de pulo com buffer (aperta um pouco antes de pousar). */
export function registrarBufferPulo(corpo, apertou) {
  if (apertou) corpo.puloBufferT = PULO_BUFFER;
}

export function podeIniciarPulo(corpo) {
  if (
    corpo.escalando ||
    corpo.planando ||
    corpo.voando ||
    corpo.mantle ||
    corpo.nadando
  ) {
    return false;
  }
  if (corpo.noChao) return true;
  return corpo.coyoteT > 0;
}

/**
 * Impulso vertical — hold Space aumenta o pico (Mario);
 * 2º toque no ar abre asa-delta (separado).
 */
export function iniciarPulo(corpo) {
  if (!podeIniciarPulo(corpo)) return false;

  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.elevacao = corpo.z;
  corpo.vz = PULO_VELOCIDADE;
  corpo.puloCortado = false;
  corpo.coyoteT = 0;
  corpo.puloBufferT = 0;
  corpo.tempoAr = 0;
  corpo.hopLift = 0;
  corpo.acao = "pulando";
  return true;
}

/** Sai do chão sem impulso (beirada / degrau). */
export function iniciarQueda(corpo) {
  if (!corpo.noChao) return;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.vz = Math.min(corpo.vz, 0);
  corpo.puloCortado = true;
  corpo.coyoteT = PULO_COYOTE;
  corpo.tempoAr = 0;
  corpo.acao = "caindo";
}

/**
 * Gravidade Mario + pouso (queda livre — sem asa).
 * `segurarPulo` = IA segura o pulo (equivalente a Space).
 */
export function atualizarAereo(corpo, dt) {
  if (corpo.coyoteT > 0) corpo.coyoteT -= dt;
  corpo.tempoAr = (corpo.tempoAr ?? 0) + dt;

  const querSegurar =
    !!corpo.segurarPulo || teclaBaixa("Space");

  if (
    !corpo.puloCortado &&
    corpo.vz > 0 &&
    !querSegurar
  ) {
    corpo.vz *= PULO_CORTE_SOLTAR;
    corpo.puloCortado = true;
  }

  const segurando =
    !corpo.puloCortado && corpo.vz > 0 && querSegurar;
  const g = segurando ? GRAVIDADE_PULO_SEGURANDO : GRAVIDADE;

  corpo.vz -= g * dt;
  const elevAntes = corpo.elevacao;
  corpo._elevAnterior = elevAntes;
  corpo.elevacao += corpo.vz * dt;
  aplicarTetoOverhang(corpo);
  if (resolverAguaAereo(corpo)) return;

  // No ápice / descida: solta o “hold” da IA
  if (corpo.segurarPulo && corpo.vz <= 0) {
    corpo.segurarPulo = false;
  }

  const zChao = alturaSobPes(
    corpo.x,
    corpo.y,
    corpo.elevacao,
    elevAntes,
  );

  if (
    corpo.vz <= 0 &&
    zChao > 0 &&
    corpo.elevacao <= zChao + PULO_EPS_POUSO
  ) {
    pousarNoChao(corpo, zChao);
    return;
  }

  if (corpo.elevacao < -2) {
    corpo.elevacao = -2;
    corpo.vz = 0;
  }

  corpo.z = zChao > 0 ? zChao : 0;
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.pulando = true;
  corpo.acao = corpo.vz > 0.4 ? "pulando" : "caindo";
}

export function pousarNoChao(corpo, zChao) {
  const zAntes = corpo.elevacao;
  corpo.z = zChao;
  corpo.elevacao = zChao;
  corpo.vz = 0;
  corpo.hopLift = 0;
  corpo.noChao = true;
  corpo.pulando = false;
  corpo.planando = false;
  corpo.voando = false;
  corpo.puloCortado = false;
  corpo.segurarPulo = false;
  corpo.coyoteT = 0;
  corpo.tempoAr = 0;
  empurrarForaDeCliff(corpo);

  const queda = Math.max(0, Math.round(zAntes) - zChao);
  corpo.acao = queda >= 2 ? `pousou ${queda}↓` : "pousou";

  if (corpo.puloBufferT > 0) {
    iniciarPulo(corpo);
  }
}

/**
 * Beirada: cantos ainda no piso alto travam o XY no ar (AABB entra no sólido).
 * Empurra até nenhum canto ficar em célula com piso > zMaxPiso.
 */
export function empurrarForaDePisoAlto(corpo, zMaxPiso) {
  const r = RAIO_CORPO;
  const elev = corpo.elevacao ?? corpo.z;
  const lim = zMaxPiso + 0.05;
  const scanZ = Math.max(elev, lim) + 0.35;

  for (let iter = 0; iter < 6; iter++) {
    let empX = 0;
    let empY = 0;
    let n = 0;
    const cantos = [
      [corpo.x - r, corpo.y - r],
      [corpo.x + r, corpo.y - r],
      [corpo.x - r, corpo.y + r],
      [corpo.x + r, corpo.y + r],
    ];
    for (const [px, py] of cantos) {
      const cx = Math.floor(px);
      const cy = Math.floor(py);
      if (!dentroDoMapa(cx, cy)) continue;
      const hz = chaoSobElevacao(cx, cy, scanZ);
      if (hz <= lim) continue;
      const sx = Math.sign(corpo.x - (cx + 0.5));
      const sy = Math.sign(corpo.y - (cy + 0.5));
      empX += sx !== 0 ? sx : corpo.x >= cx + 0.5 ? 1 : -1;
      empY += sy !== 0 ? sy : corpo.y >= cy + 0.5 ? 1 : -1;
      n++;
    }
    if (n === 0) return false;
    const len = Math.hypot(empX, empY) || 1;
    corpo.x += (empX / len) * 0.22;
    corpo.y += (empY / len) * 0.22;
  }
  return true;
}

/**
 * Só resolve penetração em sólido.
 * Não empurra piso alto genérico aqui — isso impede pular pro degrau +1.
 * O push de beirada fica no walk-off (`empurrarForaDePisoAlto`).
 */
export function liberarCorpoAereo(corpo) {
  if (cantoPenetraSolido(corpo)) empurrarForaDeCliff(corpo);
}

function cantoPenetraSolido(corpo) {
  const r = RAIO_CORPO;
  const elev = corpo.elevacao ?? corpo.z;
  const cantos = [
    [corpo.x - r, corpo.y - r],
    [corpo.x + r, corpo.y - r],
    [corpo.x - r, corpo.y + r],
    [corpo.x + r, corpo.y + r],
  ];
  for (const [px, py] of cantos) {
    if (corpoColideSolido(Math.floor(px), Math.floor(py), elev)) return true;
  }
  return false;
}

/** Se algum canto ainda pisa célula mais alta, empurra pro centro seguro. */
export function empurrarForaDeCliff(corpo) {
  const r = RAIO_CORPO;
  const z = corpo.z;
  const elev = corpo.elevacao ?? z;
  let empX = 0;
  let empY = 0;
  const cantos = [
    [corpo.x - r, corpo.y - r],
    [corpo.x + r, corpo.y - r],
    [corpo.x - r, corpo.y + r],
    [corpo.x + r, corpo.y + r],
  ];
  for (const [px, py] of cantos) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (!dentroDoMapa(cx, cy)) continue;
    if (corpoColideSolido(cx, cy, elev)) {
      empX += Math.sign(corpo.x - (cx + 0.5));
      empY += Math.sign(corpo.y - (cy + 0.5));
    }
  }
  if (empX === 0 && empY === 0) {
    const cx = Math.floor(corpo.x);
    const cy = Math.floor(corpo.y);
    const hz = chaoSobElevacao(cx, cy, elev);
    if (hz === Math.floor(elev + 1e-4) || Math.abs(hz - elev) < 0.05) return;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      if (
        podeEntrar(cx + dx, cy + dy, z, "andar", elev) &&
        Math.abs(chaoSobElevacao(cx + dx, cy + dy, elev) - elev) < 0.05
      ) {
        corpo.x = cx + dx + 0.5;
        corpo.y = cy + dy + 0.5;
        return;
      }
    }
    return;
  }
  const len = Math.hypot(empX, empY) || 1;
  corpo.x += (empX / len) * (0.25 + PULO_EMPURRAO_POUSO);
  corpo.y += (empY / len) * (0.25 + PULO_EMPURRAO_POUSO);
  const cx = Math.floor(corpo.x);
  const cy = Math.floor(corpo.y);
  if (Math.abs(chaoSobElevacao(cx, cy, elev) - elev) < 0.05) {
    corpo.x = clamp(corpo.x, cx + r + 0.02, cx + 1 - r - 0.02);
    corpo.y = clamp(corpo.y, cy + r + 0.02, cy + 1 - r - 0.02);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
