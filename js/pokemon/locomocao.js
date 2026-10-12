import { alturaSobPes, moverComColisao } from "../fisica/colisao.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";

function chaoValido(x, y, elev) {
  const chao = alturaSobPes(x, y, elev + 0.45);
  if (chao <= 0) return null;
  const dz = chao - elev;
  if (dz > 1.05 || dz < -1.05) return null;
  const agua = colunaAgua(x, y);
  if (agua.superficie > 0 && agua.superficie >= chao - 0.05) return null;
  return chao;
}

function tentar(ator, dx, dy) {
  const ax = ator.x;
  const ay = ator.y;
  const elev = ator.elevacao ?? ator.z ?? 0;
  const mov = moverComColisao(ator, dx, dy, "andar");
  if (mov.x === ax && mov.y === ay) return false;
  const chao = chaoValido(mov.x, mov.y, elev);
  if (chao == null) return false;
  ator.x = mov.x;
  ator.y = mov.y;
  ator.z = chao;
  ator.elevacao = chao;
  return true;
}

/** Steering no chão. Recua se o passo cair de cliff ou entrar na água. */
export function andar(ator, ix, iy, vel, dt) {
  const len = Math.hypot(ix, iy);
  if (len < 1e-4 || vel <= 0) {
    ator.andando = false;
    return false;
  }
  const nx = ix / len;
  const ny = iy / len;
  const dx = nx * vel * dt;
  const dy = ny * vel * dt;
  let ok = tentar(ator, dx, dy);
  if (!ok) ok = tentar(ator, dx, 0) || tentar(ator, 0, dy);
  if (ok) {
    ator.dirX = nx;
    ator.dirY = ny;
    ator.andando = true;
  } else {
    ator.andando = false;
  }
  return ok;
}

export function separar(a, b, dt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = 0.72;
  if (d2 <= 1e-6 || d2 >= min * min) return;
  const d = Math.sqrt(d2);
  const empurra = ((min - d) * 0.5 * Math.min(1, dt * 8)) / d;
  andar(a, -dx, -dy, empurra / Math.max(dt, 1e-4), dt);
}
