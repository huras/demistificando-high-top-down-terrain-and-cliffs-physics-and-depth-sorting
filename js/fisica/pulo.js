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
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";
import { alturaSobPes, podeEntrar } from "./colisao.js";

/** Edge de pulo com buffer (aperta um pouco antes de pousar). */
export function registrarBufferPulo(corpo, apertou) {
  if (apertou) corpo.puloBufferT = PULO_BUFFER;
}

export function podeIniciarPulo(corpo) {
  if (corpo.escalando || corpo.planando || corpo.mantle) return false;
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
 */
export function atualizarAereo(corpo, dt) {
  if (corpo.coyoteT > 0) corpo.coyoteT -= dt;
  corpo.tempoAr = (corpo.tempoAr ?? 0) + dt;

  if (
    !corpo.puloCortado &&
    corpo.vz > 0 &&
    !teclaBaixa("Space")
  ) {
    corpo.vz *= PULO_CORTE_SOLTAR;
    corpo.puloCortado = true;
  }

  const segurando =
    !corpo.puloCortado && corpo.vz > 0 && teclaBaixa("Space");
  const g = segurando ? GRAVIDADE_PULO_SEGURANDO : GRAVIDADE;

  corpo.vz -= g * dt;
  corpo.elevacao += corpo.vz * dt;

  const zChao = alturaSobPes(corpo.x, corpo.y);

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
  corpo.puloCortado = false;
  corpo.coyoteT = 0;
  corpo.tempoAr = 0;
  empurrarForaDeCliff(corpo);

  const queda = Math.max(0, Math.round(zAntes) - zChao);
  corpo.acao = queda >= 2 ? `pousou ${queda}↓` : "pousou";

  if (corpo.puloBufferT > 0) {
    iniciarPulo(corpo);
  }
}

/** Se algum canto ainda pisa célula mais alta, empurra pro centro seguro. */
export function empurrarForaDeCliff(corpo) {
  const r = RAIO_CORPO;
  const z = corpo.z;
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
    const hz = alturaEm(cx, cy);
    if (hz > z) {
      empX += Math.sign(corpo.x - (cx + 0.5));
      empY += Math.sign(corpo.y - (cy + 0.5));
    }
  }
  if (empX === 0 && empY === 0) {
    const cx = Math.floor(corpo.x);
    const cy = Math.floor(corpo.y);
    if (alturaEm(cx, cy) === z) return;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      if (podeEntrar(cx + dx, cy + dy, z, "andar") && alturaEm(cx + dx, cy + dy) === z) {
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
  if (alturaEm(cx, cy) === z) {
    corpo.x = clamp(corpo.x, cx + r + 0.02, cx + 1 - r - 0.02);
    corpo.y = clamp(corpo.y, cy + r + 0.02, cy + 1 - r - 0.02);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
