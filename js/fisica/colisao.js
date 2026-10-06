import { PULO_EPS_POUSO, RAIO_CORPO } from "../config.js";
import {
  alturaEm,
  colunaTemArInterno,
  dentroDoMapa,
  superficieSobElevacao,
  tetoSobreElevacao,
} from "../mundo/altura.js";

/**
 * Superfície sob os pés na camada da elevação.
 * Sem elevRef → topo da coluna (compat heightmap).
 */
export function alturaSobPes(x, y, elevRef = null) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (elevRef == null) return alturaEm(cx, cy);
  return superficieSobElevacao(cx, cy, elevRef);
}

/**
 * Pode ocupar a célula destino?
 * modo: "andar" | "aereo" | "escalar"
 * elevacao: altura contínua dos pés (modo aereo / camada)
 */
export function podeEntrar(cx, cy, zAtual, modo = "andar", elevacao = zAtual) {
  if (!dentroDoMapa(cx, cy)) return false;

  if (modo === "aereo") {
    return podeEntrarAereo(cx, cy, elevacao);
  }

  const zDest = superficieSobElevacao(cx, cy, zAtual);

  if (modo === "escalar") {
    if (zDest <= 0) return false;
    return zDest - zAtual === 1 || zDest === zAtual;
  }

  // andar: compara na mesma camada (sob o deck zDest≈chão; no deck zDest≈topo)
  if (zDest <= 0) return false;
  if (zDest === zAtual) return true;
  if (zDest > zAtual) return false;
  return true; // zDest < zAtual — degrau pra baixo / queda
}

function podeEntrarAereo(cx, cy, elevacao) {
  const topo = alturaEm(cx, cy);
  if (topo <= 0) return true;

  if (!colunaTemArInterno(cx, cy)) {
    return topo <= elevacao + PULO_EPS_POUSO;
  }

  // Overhang: bloqueia só se os pés estão dentro do sólido do deck.
  const teto = tetoSobreElevacao(cx, cy, elevacao);
  if (Number.isFinite(teto) && elevacao >= teto && elevacao < topo) {
    return false;
  }
  return true;
}

/**
 * Movimento no chão. Pode entrar em célula mais baixa — o caller inicia a queda.
 */
export function moverComColisao(corpo, dx, dy, modo = "andar") {
  let { x, y, z } = corpo;
  const r = RAIO_CORPO;
  const x0 = x;
  const y0 = y;

  if (dx !== 0) {
    const nx = x + dx;
    if (cantosLivres(nx, y, z, r, modo, z)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (cantosLivres(x, ny, z, r, modo, z)) y = ny;
  }

  return {
    x,
    y,
    z,
    bloqueouX: dx !== 0 && x === x0,
    bloqueouY: dy !== 0 && y === y0,
  };
}

/**
 * Movimento no ar: atravessa vazios; parede se topo > elevação (ou dentro do deck).
 */
export function moverAereo(corpo, dx, dy, elevacao) {
  let { x, y } = corpo;
  const r = RAIO_CORPO;
  const x0 = x;
  const y0 = y;
  const zRef = corpo.z;

  if (dx !== 0) {
    const nx = x + dx;
    if (cantosLivres(nx, y, zRef, r, "aereo", elevacao)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (cantosLivres(x, ny, zRef, r, "aereo", elevacao)) y = ny;
  }

  return {
    x,
    y,
    bloqueouX: dx !== 0 && x === x0,
    bloqueouY: dy !== 0 && y === y0,
  };
}

function cantosLivres(x, y, z, r, modo, elevacao) {
  const pontos = [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ];
  for (const [px, py] of pontos) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (!podeEntrar(cx, cy, z, modo, elevacao)) return false;
  }
  return true;
}

/** Célula logo à frente do olhar (cardinal puro). */
export function celulaAFrente(x, y, dirX, dirY, elevRef = null) {
  let sx = Math.sign(dirX);
  let sy = Math.sign(dirY);
  if (sx !== 0 && sy !== 0) {
    if (Math.abs(dirX) >= Math.abs(dirY)) sy = 0;
    else sx = 0;
  }
  if (sx === 0 && sy === 0) sy = 1;
  const fx = Math.floor(x) + sx;
  const fy = Math.floor(y) + sy;
  const z =
    elevRef != null
      ? superficieSobElevacao(fx, fy, elevRef)
      : alturaEm(fx, fy);
  return { cx: fx, cy: fy, z };
}

/** Aplica teto do deck (pulo/voo por baixo). */
export function aplicarTetoOverhang(corpo) {
  const cx = Math.floor(corpo.x);
  const cy = Math.floor(corpo.y);
  const elev = corpo.elevacao ?? corpo.z;
  const teto = tetoSobreElevacao(cx, cy, elev);
  if (!Number.isFinite(teto)) return;
  const lim = teto - 0.02;
  if (elev > lim) {
    corpo.elevacao = lim;
    if (corpo.vz > 0) corpo.vz = 0;
  }
}
