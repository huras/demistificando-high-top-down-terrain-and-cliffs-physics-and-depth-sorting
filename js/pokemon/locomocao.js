import { RAIO_CORPO } from "../config.js";
import { alturaSobPes, espacoVoxelLivre, moverComColisao } from "../fisica/colisao.js";
import { corposSolidos, discoInvasor, invadeDisco } from "../fisica/obstaculos.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";

const PASSOS_SEPARAR = 3;
const FOLGA_PISO = 1.05;

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
  if (!ok) {
    ok = tentar(ator, dx, 0);
    if (!ok) ok = tentar(ator, 0, dy);
  }
  if (ok) {
    ator.dirX = nx;
    ator.dirY = ny;
    ator.andando = true;
  } else {
    ator.andando = false;
  }
  return ok;
}

function raioDe(corpo) {
  return corpo.raioCorpo > 0 ? corpo.raioCorpo : RAIO_CORPO;
}

function cabe(corpo, x, y) {
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const r = raioDe(corpo);
  return espacoVoxelLivre(x, y, elev, r) && !invadeDisco(x, y, elev, r);
}

function aplicar(corpo, x, y) {
  if (!cabe(corpo, x, y)) return false;
  corpo.x = x;
  corpo.y = y;
  return true;
}

/** Empurra o corpo para fora. Se a frente está fechada, escorrega para o lado. */
function ceder(corpo, nx, ny, folga) {
  const lados = [
    [nx, ny],
    [ny, -nx],
    [-ny, nx],
  ];
  for (let i = 0; i < lados.length; i++) {
    const ux = lados[i][0];
    const uy = lados[i][1];
    const len = Math.hypot(ux, uy) || 1;
    if (aplicar(corpo, corpo.x + (ux / len) * folga, corpo.y + (uy / len) * folga)) return true;
  }
  return false;
}

/** Desfaz sobreposição de quem já nasceu em cima do outro. Não usa o passo de andar. */
function sairDaBase(corpo) {
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const r = raioDe(corpo);
  const disco = discoInvasor(corpo.x, corpo.y, elev, r);
  if (!disco) return false;
  let dx = corpo.x - disco.x;
  let dy = corpo.y - disco.y;
  let d = Math.hypot(dx, dy);
  const falta = r + disco.r - d + 0.02;
  if (d < 1e-4) {
    dx = 0;
    dy = 1;
    d = 1;
  }
  const ux = dx / d;
  const uy = dy / d;
  const candidatos = [
    [ux, uy],
    [-uy, ux],
    [uy, -ux],
    [-ux, -uy],
  ];
  for (let i = 0; i < candidatos.length; i++) {
    const [cx, cy] = candidatos[i];
    if (aplicar(corpo, corpo.x + cx * falta, corpo.y + cy * falta)) return true;
  }
  return false;
}

export function despenetrarCorpos() {
  const lista = corposSolidos();
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].morto || lista[i].capturado) continue;
    sairDaBase(lista[i]);
  }
  for (let passo = 0; passo < PASSOS_SEPARAR; passo++) {
    let mexeu = false;
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      if (a.morto || a.capturado) continue;
      for (let j = i + 1; j < lista.length; j++) {
        const b = lista[j];
        if (b.morto || b.capturado) continue;
        const ea = a.elevacao ?? a.z ?? 0;
        const eb = b.elevacao ?? b.z ?? 0;
        if (Math.abs(ea - eb) > FOLGA_PISO) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = raioDe(a) + raioDe(b);
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-4) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const nx = dx / d;
        const ny = dy / d;
        const folga = min - d + 0.02;
        if (a.ancora && !b.ancora) {
          if (ceder(b, nx, ny, folga) || aplicar(a, a.x - nx * folga, a.y - ny * folga)) mexeu = true;
          continue;
        }
        if (b.ancora && !a.ancora) {
          if (ceder(a, -nx, -ny, folga) || aplicar(b, b.x + nx * folga, b.y + ny * folga)) mexeu = true;
          continue;
        }
        const meio = folga * 0.5;
        const aMeio = aplicar(a, a.x - nx * meio, a.y - ny * meio);
        const bMeio = aplicar(b, b.x + nx * meio, b.y + ny * meio);
        if (aMeio || bMeio) {
          mexeu = true;
          continue;
        }
        if (aplicar(a, a.x - nx * folga, a.y - ny * folga) || aplicar(b, b.x + nx * folga, b.y + ny * folga)) {
          mexeu = true;
        }
      }
    }
    if (!mexeu) break;
  }
}
