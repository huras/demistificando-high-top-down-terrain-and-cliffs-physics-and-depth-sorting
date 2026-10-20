/**
 * Relevo autoral de Kanto: um byte por área (32×32).
 * 0 terra, 1 montanha, 2 raso, 3 fundo, 255 sem pintura.
 */

const LADO = 32;
const TERRA = 0;
const MONTANHA = 1;
const RASO = 2;
const FUNDO = 3;

const RELEVO_B64 =
  "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAQEBAQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMBAQEBAQABAQEBAQEBAQEBAQAAAAD//wMDAwMDAwMDAwEBAQEBAQEBAQEBAQEBAQAAAAEBAQEBAwMDAwMDAwMDAQEBAQEAAQEBAQEBAQEBAQEAAQEBAQEDAwMDAwMDAwMBAQEBAAABAQEBAQEBAQEBAQABAQABAQMDAwMDAwMDAwEBAQEAAAABAQEBAQEBAQEBAAEBAAEBAwMDAwMDAwMDAQEBAQAAAAAAAAAAAAAAAAAAAQEBAQEAAAMDAwMDAwMBAQEBAAAAAAAAAAAAAwAAAAABAQEBAQMDAwMDAwMDA/8BAQEBAAAAAAAAAAAAAAAAAAEBAQEBAgICAwMDAwMD/wEBAQEAAAIAAAAAAAAAAAAAAAAAAAECAgIDAwMDAwP/AQEBAQAAAgMCAAAAAAAAAAAAAAAAAgMDAwMDAwMDA///AAAAAAACAwIAAAAAAAAAAAAAAAACAwMDAwMDAwMD//8AAAAAAwMDAwMAAAAAAAAAAAAAAAIDAwMDAwMDAwP//wAAAAACAgMCAgL/AAAAAAAAAAAAAgMDAwMDAwMDA///AAAAAAICAwICAv8AAAAAAAAAAAACAwMDAwMDAwMD//8AAAIAAgIDAgIC/wAAAAAAAAAAAAIDAwMDAwMDAwP/AwMCAwMCAgMCAgICAwMDAwIAAAAAAgMDAwMDAwMDA/8DAwIDAwICAwICAgIDAwMCAgICAgACAwMDAwMDAwMD/wMDAgMDAgIDAgICAgICAgICAgICAAIDAwMDAwMDAwP/AwMCAwMCAgMCAgIAAAAAAgICAgIAAgMDAwMDAwMDA/8DAwIDAwICAwICAgAAAAACAgICAgACAwMDAwMDAwMD/wMDAgMDAwMDAwMAAAAAAAICAAAAAAIDAwMDAwMDAwP/AwMCAwMDAgMAAAAAAAAAAAAAAv//AgMDAwMDAwMDAwMDAwIBAAECAwMCAgICAgMCAgICAwMDAwMDAwMDAwMDAwMDAgABAAMDAwMDAwMDAwICAgIDAwMDAwMDAwMDAwMDAwMDAQABAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw==";

const FORCAR_TERRA = Object.freeze([
  [25, 6],
  [25, 7],
  [20, 4],
  [21, 4],
  [28, 8],
  [29, 8],
]);

function decodificar(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function dentro(ax, ay) {
  return ax >= 0 && ay >= 0 && ax < LADO && ay < LADO;
}

function ler(celulas, ax, ay) {
  if (!dentro(ax, ay)) return 255;
  return celulas[ay * LADO + ax];
}

function gravar(celulas, ax, ay, tipo) {
  if (!dentro(ax, ay)) return;
  celulas[ay * LADO + ax] = tipo;
}

function ilha(celulas, ax, ay, montanha, metade) {
  const minX = ax - metade;
  const maxX = ax + metade;
  const minY = ay - metade;
  const maxY = ay + metade;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const borda = x === minX || x === maxX || y === minY || y === maxY;
      if (borda) {
        const atual = ler(celulas, x, y);
        if (atual === FUNDO || atual === 255) gravar(celulas, x, y, RASO);
        continue;
      }
      const miolo = x > minX + 1 && x < maxX - 1 && y > minY + 1 && y < maxY - 1;
      gravar(celulas, x, y, montanha && miolo ? MONTANHA : TERRA);
    }
  }
}

function carimbarIlhas(celulas) {
  ilha(celulas, 3, 25, true, 2);
  ilha(celulas, 20, 29, true, 2);
  ilha(celulas, 23, 30, true, 2);
  for (let ay = 2; ay <= 7; ay++) {
    for (let ax = 25; ax <= 29; ax++) {
      const borda = ax === 25 || ax === 29 || ay === 2 || ay === 7;
      if (borda) {
        const atual = ler(celulas, ax, ay);
        if (atual === FUNDO || atual === 255) gravar(celulas, ax, ay, RASO);
        continue;
      }
      gravar(celulas, ax, ay, TERRA);
    }
  }
}

function montar() {
  const celulas = decodificar(RELEVO_B64);
  if (celulas.length !== LADO * LADO) {
    throw new Error(`relevo Kanto: ${celulas.length} bytes`);
  }
  carimbarIlhas(celulas);
  for (let i = 0; i < FORCAR_TERRA.length; i++) {
    gravar(celulas, FORCAR_TERRA[i][0], FORCAR_TERRA[i][1], TERRA);
  }
  return celulas;
}

const CELULAS = montar();

export const RELEVO_TERRA = TERRA;
export const RELEVO_MONTANHA = MONTANHA;
export const RELEVO_RASO = RASO;
export const RELEVO_FUNDO = FUNDO;

export function relevoEm(ax, ay) {
  return ler(CELULAS, ax | 0, ay | 0);
}
