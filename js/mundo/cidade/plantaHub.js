/**
 * Sala 3D a partir da grade Emerald. Um tile é uma célula, o mesmo passo do jogador.
 * A colisão ocupa o tile. O desenho da parede é só a casca virada para a sala.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import { definirLocal, preencherColunaSolida } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";

export const ESCALA_HUB = 1;
export const ALTURA_PAREDE_HUB = 4;
const GROSSURA_PAREDE = 0.28;
const MARGEM = 12;
const faixasLivres = [];

/** Pegada de cada sala feita por aqui. A população não solta selvagem em volta. */
export function faixasSemSelvagem() {
  return faixasLivres;
}

export function gradeDe(texto) {
  const linhas = texto.trim().split("\n");
  const grade = [];
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    const celulas = [];
    for (let c = 0; c < linha.length; c++) celulas.push(linha[c] === "#");
    grade.push(celulas);
  }
  return grade;
}

function fundir(marca, cols, rows) {
  const visto = new Uint8Array(marca.length);
  const saida = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!marca[i] || visto[i]) continue;
      let w = 1;
      while (x + w < cols && marca[i + w] && !visto[i + w]) w += 1;
      let h = 1;
      while (y + h < rows) {
        let ok = true;
        for (let dx = 0; dx < w; dx++) {
          const j = (y + h) * cols + x + dx;
          if (!marca[j] || visto[j]) ok = false;
        }
        if (!ok) break;
        h += 1;
      }
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) visto[(y + dy) * cols + x + dx] = 1;
      }
      saida.push({ x, y, w, h });
    }
  }
  return saida;
}

/**
 * Cascas finas viradas pra dentro do chão.
 * `face` = lado da *sala* (norte = parede no fundo, visível no top-down).
 * Corredor: parede com chão ao sul → face norte; com chão só ao norte → face sul.
 */
export function cascasDaParede(muro, anda, balcao, cols, rows) {
  const g = GROSSURA_PAREDE;
  const dentro = (x, y) =>
    x >= 0 && y >= 0 && x < cols && y < rows && (anda[y * cols + x] || balcao[y * cols + x]);
  const saida = [];
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      const sul = y + 1 < rows && muro[y * cols + x] && dentro(x, y + 1);
      const norte = y > 0 && muro[y * cols + x] && dentro(x, y - 1);
      if (!sul && !norte) {
        x += 1;
        continue;
      }
      // Prefere chão ao sul → esta é a parede norte daquele vão (corredor/sala).
      const qual = sul ? "sul" : "norte";
      let w = 1;
      while (x + w < cols) {
        const segue =
          qual === "sul"
            ? y + 1 < rows && muro[y * cols + x + w] && dentro(x + w, y + 1)
            : y > 0 && muro[y * cols + x + w] && dentro(x + w, y - 1);
        if (!segue) break;
        w += 1;
      }
      saida.push({
        x,
        y: qual === "sul" ? y + 1 - g : y,
        w,
        h: g,
        face: qual === "sul" ? "norte" : "sul",
      });
      x += w;
    }
  }
  for (let x = 0; x < cols; x++) {
    let y = 0;
    while (y < rows) {
      const leste = x + 1 < cols && muro[y * cols + x] && dentro(x + 1, y);
      const oeste = x > 0 && muro[y * cols + x] && dentro(x - 1, y);
      if (!leste && !oeste) {
        y += 1;
        continue;
      }
      const qual = leste ? "leste" : "oeste";
      let h = 1;
      while (y + h < rows) {
        const segue =
          qual === "leste"
            ? x + 1 < cols && muro[(y + h) * cols + x] && dentro(x + 1, y + h)
            : x > 0 && muro[(y + h) * cols + x] && dentro(x - 1, y + h);
        if (!segue) break;
        h += 1;
      }
      saida.push({
        x: qual === "leste" ? x + 1 - g : x,
        y,
        w: g,
        h,
        face: qual === "leste" ? "oeste" : "leste",
      });
      y += h;
    }
  }
  return saida;
}

function ehSaida(saidas, tx, ty) {
  for (let i = 0; i < saidas.length; i++) {
    if (saidas[i].tx === tx && saidas[i].ty === ty) return true;
  }
  return false;
}

export function criarPlantaHub(def) {
  const escala = Math.max(1, (def.escala | 0) || ESCALA_HUB);
  const tilesX = def.tilesX;
  const tilesY = def.tilesY;
  const cols = tilesX * escala;
  const rows = tilesY * escala;
  const fundo = def.linhasFundo ?? 2;
  const muro = new Uint8Array(cols * rows);
  const balcao = new Uint8Array(cols * rows);
  const anda = new Uint8Array(cols * rows);

  for (let ty = 0; ty < tilesY; ty++) {
    const linha = def.anel ? null : def.colisao[ty];
    for (let tx = 0; tx < tilesX; tx++) {
      const solido = !!(linha && linha[tx]);
      const borda = tx === 0 || ty === 0 || tx === tilesX - 1 || ty === tilesY - 1;
      let tipo = "chao";
      if (ehSaida(def.saidas, tx, ty)) tipo = "chao";
      else if (def.anel) tipo = borda ? "muro" : "chao";
      else if (borda || (ty < fundo && solido)) tipo = "muro";
      else if (solido) tipo = "balcao";
      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const x = tx * escala + dx;
          const y = ty * escala + dy;
          const i = y * cols + x;
          if (tipo === "muro") muro[i] = 1;
          else if (tipo === "balcao") balcao[i] = 1;
          else anda[i] = 1;
        }
      }
    }
  }

  let doorX0 = cols;
  let doorX1 = 0;
  for (let i = 0; i < def.saidas.length; i++) {
    const tx = def.saidas[i].tx;
    doorX0 = Math.min(doorX0, tx * escala);
    doorX1 = Math.max(doorX1, (tx + 1) * escala);
  }

  const discos = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!balcao[y * cols + x]) continue;
      discos.push({
        x: def.origemX + x + 0.5,
        y: def.origemY + y + 0.5,
        z: ALTURA_PRACA,
        r: 0.46,
      });
    }
  }
  const props = def.props || [];
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    if (!prop.disco) continue;
    discos.push({
      x: def.origemX + prop.x,
      y: def.origemY + prop.y,
      z: ALTURA_PRACA,
      r: prop.raio || 0.42,
    });
  }

  const planta = {
    papel: def.papel,
    cols,
    rows,
    tilesX,
    tilesY,
    origemX: def.origemX,
    origemY: def.origemY,
    corParede: def.corParede,
    corBalcao: def.corBalcao,
    camada: def.camada,
    muro,
    cascas: cascasDaParede(muro, anda, balcao, cols, rows),
    pisos: fundir(anda, cols, rows),
    balcoes: fundir(balcao, cols, rows),
    doorX0,
    doorX1,
    discos,
    props,
    alvos: def.alvos || [],
    spawn: {
      x: def.origemX + (doorX0 + doorX1) * 0.5,
      y: def.origemY + rows - 1.45,
      z: ALTURA_PRACA,
    },
  };
  faixasLivres.push({
    x0: planta.origemX,
    y0: planta.origemY,
    x1: planta.origemX + planta.cols,
    y1: planta.origemY + planta.rows,
  });
  return planta;
}

export function dentroDoTerrenoHub(planta, wx, wy) {
  return (
    wx >= planta.origemX - MARGEM &&
    wx < planta.origemX + planta.cols + MARGEM &&
    wy >= planta.origemY - MARGEM &&
    wy < planta.origemY + planta.rows + MARGEM
  );
}

/** Vestíbulo sul da porta — passo da transição sem cair no void. */
const PROF_PORTA_HUB = 1.5;

export function aplicarPlantaNoChunk(chunk, planta) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const zParede = Math.min(CHUNK_Y, ALTURA_PRACA + ALTURA_PAREDE_HUB);
  let mudou = false;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      // Pátio (MARGEM) só reserva o bolso do gen outdoor — sem chão andável.
      if (!dentroDoTerrenoHub(planta, wx, wy)) continue;
      const col = wx - planta.origemX;
      const row = wy - planta.origemY;
      const naPlanta =
        col >= 0 && row >= 0 && col < planta.cols && row < planta.rows;
      const noVestibulo =
        row >= planta.rows &&
        row < planta.rows + PROF_PORTA_HUB &&
        col >= planta.doorX0 - 0.01 &&
        col < planta.doorX1;
      if (!naPlanta && !noVestibulo) {
        mudou = true;
        continue;
      }
      preencherColunaSolida(chunk, lx, ly, ALTURA_PRACA, BLOCO.TERRA);
      if (naPlanta && planta.muro[row * planta.cols + col] === 1) {
        for (let z = ALTURA_PRACA; z < zParede; z++) definirLocal(chunk, lx, ly, z, BLOCO.PEDRA);
      }
      mudou = true;
    }
  }
  return mudou;
}

export function naSaidaPlanta(planta, x, y) {
  const localX = x - planta.origemX;
  const localY = y - planta.origemY;
  if (localY < planta.rows - 1.15) return false;
  return localX >= planta.doorX0 - 0.2 && localX < planta.doorX1 + 0.2;
}

export function alvoDaPlanta(planta, x, y) {
  const px = x - planta.origemX;
  const py = y - planta.origemY;
  let melhor = null;
  let dist = Infinity;
  const alvos = planta.alvos;
  for (let i = 0; i < alvos.length; i++) {
    const alvo = alvos[i];
    const d = Math.hypot(px - alvo.x, py - alvo.y);
    if (d <= alvo.alcance && d < dist) {
      dist = d;
      melhor = alvo;
    }
  }
  return melhor;
}
