import {
  ALTURA_CORPO,
  CHUNK_Y,
  PULO_EPS_POUSO,
  RAIO_CORPO,
} from "../config.js";
import { dentroDoMapa } from "../mundo/altura.js";
import { obterBloco } from "../mundo/voxel/storeMundo.js";
import { ehSolido } from "../mundo/voxel/tiposBloco.js";
import { discoInvasor, invadeDisco } from "./obstaculos.js";

/**
 * Walk height (= face acima do sólido) sob elevRef na coluna.
 * Scan voxel — funciona com N cavernas / andares.
 */
export function chaoSobElevacao(cx, cy, elevRef) {
  if (!dentroDoMapa(cx, cy)) return 0;
  let z = Math.min(CHUNK_Y - 1, Math.floor(elevRef + PULO_EPS_POUSO));
  if (z < 0) z = 0;
  for (; z >= 0; z--) {
    if (ehSolido(obterBloco(cx, cy, z))) return z + 1;
  }
  return 0;
}

/**
 * Underside do primeiro sólido acima da cabeça (teto).
 * Infinity se céu aberto.
 */
export function tetoSobreCabeca(cx, cy, elevPes, altura = ALTURA_CORPO) {
  if (!dentroDoMapa(cx, cy)) return Infinity;
  const zHead = Math.floor(elevPes + altura - 1e-4);
  const z0 = Math.max(0, zHead);
  for (let z = z0; z < CHUNK_Y; z++) {
    if (ehSolido(obterBloco(cx, cy, z))) return z;
  }
  return Infinity;
}

/**
 * True se há sólido na faixa vertical [elevPes, elevPes+altura).
 * zMin corta a parte de baixo: o nado ignora a quina submersa da margem.
 */
export function corpoColideSolido(cx, cy, elevPes, altura = ALTURA_CORPO, zMin = 0) {
  if (!dentroDoMapa(cx, cy)) return true;
  const z0 = Math.max(Math.floor(elevPes + 1e-4), zMin | 0);
  const z1 = Math.floor(elevPes + altura - 1e-4);
  if (z0 > z1) return false;
  for (let z = Math.max(0, z0); z <= z1 && z < CHUNK_Y; z++) {
    if (ehSolido(obterBloco(cx, cy, z))) return true;
  }
  return false;
}

/**
 * Superfície sob os pés na camada da elevação.
 * Sem elevRef → chão sob y=CHUNK_Y (topo implícito via scan do alto).
 */
export function alturaSobPes(x, y, elevRef = null, _elevAnterior = null) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (elevRef == null) return chaoSobElevacao(cx, cy, CHUNK_Y);
  return chaoSobElevacao(cx, cy, elevRef);
}

/**
 * Pode ocupar a célula destino?
 * modo: "andar" | "aereo" | "escalar"
 */
export function podeEntrar(cx, cy, zAtual, modo = "andar", elevacao = zAtual, zMin = 0) {
  if (!dentroDoMapa(cx, cy)) return false;

  if (modo === "aereo") {
    return !corpoColideSolido(cx, cy, elevacao, ALTURA_CORPO, zMin);
  }

  const zDest = chaoSobElevacao(cx, cy, elevacao + 0.35);

  if (modo === "escalar") {
    if (zDest <= 0) return false;
    return zDest - zAtual === 1 || zDest === zAtual;
  }

  // andar: precisa piso + espaço pra cabeça; sobe só +0 (degrau sobe = pulo)
  if (zDest <= 0) return false;
  if (corpoColideSolido(cx, cy, zDest)) return false;
  const zPes = Math.floor(zAtual + 1e-4);
  if (zDest === zPes) return true;
  if (zDest > zPes) return false;
  return true;
}

/**
 * Movimento no chão. Pode entrar em célula mais baixa — o caller inicia a queda.
 * Sobreposição que já existe não gera empurrão: o passo só não pode afundar mais.
 */
export function moverComColisao(corpo, dx, dy, modo = "andar") {
  let { x, y, z } = corpo;
  const r = corpo.raioCorpo > 0 ? corpo.raioCorpo : RAIO_CORPO;
  const x0 = x;
  const y0 = y;
  const elev = corpo.elevacao ?? z;

  if (dx !== 0) {
    const nx = x + dx;
    if (podeAvancar(nx, y, x, y, elev, r, modo, elev, 0)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (podeAvancar(x, ny, x, y, elev, r, modo, elev, 0)) y = ny;
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
 * Movimento no ar: AABB vs sólidos na faixa do corpo.
 * Não expulsa da quina — só recusa o eixo que entra mais no sólido.
 */
export function moverAereo(corpo, dx, dy, elevacao, zMin = 0) {
  let { x, y } = corpo;
  const r = RAIO_CORPO;
  const x0 = x;
  const y0 = y;
  const zRef = corpo.z;

  if (dx !== 0) {
    const nx = x + dx;
    if (podeAvancar(nx, y, x, y, zRef, r, "aereo", elevacao, zMin)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (podeAvancar(x, ny, x, y, zRef, r, "aereo", elevacao, zMin)) y = ny;
  }

  return {
    x,
    y,
    bloqueouX: dx !== 0 && x === x0,
    bloqueouY: dy !== 0 && y === y0,
  };
}

export function espacoVoxelLivre(x, y, elev, raio, modo = "andar") {
  return cantosLivres(x, y, elev, raio, modo, elev);
}

function cantosDoCorpo(x, y, r) {
  return [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ];
}

function cantosLivres(x, y, z, r, modo, elevacao, zMin = 0) {
  for (const [px, py] of cantosDoCorpo(x, y, r)) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (!podeEntrar(cx, cy, z, modo, elevacao, zMin)) return false;
  }
  return true;
}

/** Distância do ponto até sair da célula, pelo lado mais perto. */
function profundidadeCanto(px, py) {
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  return Math.min(px - cx, cx + 1 - px, py - cy, cy + 1 - py);
}

function profNoSolido(px, py, elev, zMin) {
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  if (!corpoColideSolido(cx, cy, elev, ALTURA_CORPO, zMin)) return 0;
  return profundidadeCanto(px, py);
}

/**
 * Livre, ou já estava no sólido e nenhum canto aprofunda.
 * Buraco e fora do mapa continuam bloqueando.
 */
function podeAvancar(x, y, x0, y0, z, r, modo, elev, zMin) {
  const noChao = modo === "andar";
  if (cantosLivres(x, y, z, r, modo, elev, zMin) && (!noChao || !invadeDisco(x, y, elev, r))) {
    return true;
  }
  if (noChao) {
    const inv1 = discoInvasor(x, y, elev, r);
    if (inv1) {
      const inv0 = discoInvasor(x0, y0, elev, r);
      // Já dentro da pedra/árvore: só permite passo que AFROUXA a penetração.
      if (inv0) {
        const d0 = Math.hypot(x0 - inv0.x, y0 - inv0.y);
        const d1 = Math.hypot(x - inv1.x, y - inv1.y);
        if (d1 > d0 + 1e-4 && cantosLivres(x, y, z, r, modo, elev, zMin)) {
          return true;
        }
      }
      return false;
    }
  }
  if (modo !== "andar" && modo !== "aereo") return false;
  if (!jaPenetra(x0, y0, elev, r, zMin)) return false;
  if (bloqueioSemSolido(x, y, r, modo, elev, zMin)) return false;
  return !afundaMais(x, y, x0, y0, elev, r, zMin);
}

function jaPenetra(x, y, elev, r, zMin) {
  for (const [px, py] of cantosDoCorpo(x, y, r)) {
    if (profNoSolido(px, py, elev, zMin) > 1e-4) return true;
  }
  return false;
}

function afundaMais(x, y, x0, y0, elev, r, zMin) {
  const antes = cantosDoCorpo(x0, y0, r);
  const depois = cantosDoCorpo(x, y, r);
  for (let i = 0; i < 4; i++) {
    const p0 = profNoSolido(antes[i][0], antes[i][1], elev, zMin);
    const p1 = profNoSolido(depois[i][0], depois[i][1], elev, zMin);
    if (p1 > p0 + 1e-4) return true;
  }
  return false;
}

function bloqueioSemSolido(x, y, r, modo, elev, zMin) {
  for (const [px, py] of cantosDoCorpo(x, y, r)) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (podeEntrar(cx, cy, zRefAndar(elev), modo, elev, zMin)) continue;
    if (!dentroDoMapa(cx, cy)) return true;
    if (modo !== "andar") continue;
    if (chaoSobElevacao(cx, cy, elev + 0.35) <= 0) return true;
  }
  return false;
}

function zRefAndar(elev) {
  return Math.floor(elev + 1e-4);
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
  const elev = elevRef != null ? elevRef : CHUNK_Y;
  const z = chaoSobElevacao(fx, fy, elev);
  return { cx: fx, cy: fy, z };
}

/**
 * Clamp vertical: não atravessa teto sólido acima da cabeça.
 */
export function aplicarTetoOverhang(corpo) {
  const elev = corpo.elevacao ?? corpo.z;
  const r = RAIO_CORPO;
  const cantos = [
    [corpo.x - r, corpo.y - r],
    [corpo.x + r, corpo.y - r],
    [corpo.x - r, corpo.y + r],
    [corpo.x + r, corpo.y + r],
  ];

  let lim = Infinity;
  for (const [px, py] of cantos) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (!dentroDoMapa(cx, cy)) continue;
    const teto = tetoSobreCabeca(cx, cy, elev);
    if (Number.isFinite(teto)) {
      lim = Math.min(lim, teto - ALTURA_CORPO);
    }
  }

  if (Number.isFinite(lim) && elev > lim) {
    corpo.elevacao = lim;
    if (corpo.vz > 0) corpo.vz = 0;
  }
}

/**
 * Lista pisos walkable da coluna (sólido abaixo, 2 ar pra cabeça).
 * Usado pelo nav multi-floor.
 */
export function listarPisosWalkable(cx, cy, maxPisos = 8) {
  if (!dentroDoMapa(cx, cy)) return [];
  const out = [];
  for (let z = 0; z < CHUNK_Y - 1 && out.length < maxPisos; z++) {
    if (!ehSolido(obterBloco(cx, cy, z))) continue;
    const floor = z + 1;
    if (floor >= CHUNK_Y) continue;
    if (ehSolido(obterBloco(cx, cy, floor))) continue;
    if (floor + 1 < CHUNK_Y && ehSolido(obterBloco(cx, cy, floor + 1))) {
      continue;
    }
    out.push(floor);
  }
  return out;
}
