/**
 * Prédios e construções perto do cursor.
 * Só a zona da célula (e a vizinha, se o raio cruza a borda) e as
 * estruturas que o jogador já colocou. Sem varrer o mundo.
 */
import { ORIGEM_KANTO_X, ORIGEM_KANTO_Y } from "../mundo/bounds.js";
import { AREA_KANTO, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { visitarEstruturasPerto } from "../construir/estruturas.js";
import { FENCE_KIND } from "../construir/cerca/tipos.js";
import { t } from "../jogo/i18n.js";

const ALCANCE_PREDIO = 14;
const ALCANCE_PREDIO2 = ALCANCE_PREDIO * ALCANCE_PREDIO;
const ALCANCE_MOVEL = 8;
const ALCANCE_MOVEL2 = ALCANCE_MOVEL * ALCANCE_MOVEL;

const COR = Object.freeze({
  casa: "#fcd34d",
  centro: "#f472b6",
  loja: "#38bdf8",
  lab: "#a3e635",
  ginasio: "#fb923c",
  museu: "#c4b5fd",
  torre: "#94a3b8",
  porto: "#67e8f9",
  safari: "#facc15",
  ruina: "#a8a29e",
  coliseu: "#fb7185",
  mansao: "#e9d5ff",
  condominio: "#fdba74",
  movel: "#d6d3d1",
  cerca: "#e7e5e4",
});

const ALTURA_MODELO = Object.freeze({
  "windmill-1": 7,
  "moomoo-farm-silo": 5.5,
  ruina: 5,
  "moomoo-farm": 4.2,
  "pokemon-day-care": 4,
});

const pool = [];
let nPool = 0;
const zonas = [null, null, null, null, null];

function slot() {
  let item = pool[nPool];
  if (!item) {
    item = {
      id: "",
      x: 0,
      y: 0,
      z: 0,
      l: 1,
      a: 1,
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 0,
      volume: false,
      nome: "",
      linha: "",
      cor: COR.casa,
    };
    pool[nPool] = item;
  }
  nPool += 1;
  return item;
}

function texto(chave, reserva) {
  const s = t(chave);
  return s && s !== chave ? s : reserva;
}

function nomePapel(papel) {
  return texto("detalhe.papel." + (papel || "casa"), t("detalhe.papel.casa"));
}

function nomeModelo(id) {
  return texto("detalhe.modelo." + (id || "casa"), t("detalhe.papel.casa"));
}

function guardarZona(zona) {
  if (!zona || zona.tipo !== "cidade" || !zona.layout) return false;
  for (let i = 0; i < zonas.length; i++) {
    if (zonas[i] === zona) return false;
    if (!zonas[i]) {
      zonas[i] = zona;
      return true;
    }
  }
  return false;
}

function pertoDaCaixa(hx, hy, x0, y0, x1, y1) {
  const qx = hx < x0 ? x0 : hx > x1 ? x1 : hx;
  const qy = hy < y0 ? y0 : hy > y1 ? y1 : hy;
  const dx = hx - qx;
  const dy = hy - qy;
  return dx * dx + dy * dy <= ALCANCE_PREDIO2;
}

function encherCidade(hx, hy) {
  for (let i = 0; i < zonas.length; i++) zonas[i] = null;
  guardarZona(zonaNoMundo(hx, hy));
  guardarZona(zonaNoMundo(hx - ALCANCE_PREDIO, hy));
  guardarZona(zonaNoMundo(hx + ALCANCE_PREDIO, hy));
  guardarZona(zonaNoMundo(hx, hy - ALCANCE_PREDIO));
  guardarZona(zonaNoMundo(hx, hy + ALCANCE_PREDIO));

  for (let z = 0; z < zonas.length; z++) {
    const zona = zonas[z];
    if (!zona) break;
    const volumes = zona.layout.volumes;
    if (!volumes) continue;
    const ox = ORIGEM_KANTO_X + zona.ax * AREA_KANTO;
    const oy = ORIGEM_KANTO_Y + zona.ay * AREA_KANTO;
    for (let i = 0; i < volumes.length; i++) {
      const v = volumes[i];
      const x0 = ox + v.x0;
      const y0 = oy + v.y0;
      const x1 = ox + v.x1;
      const y1 = oy + v.y1;
      if (!pertoDaCaixa(hx, hy, x0, y0, x1, y1)) continue;
      const item = slot();
      const papel = v.papel || "casa";
      item.id = zona.id + ":" + i;
      item.x = (x0 + x1) * 0.5;
      item.y = (y0 + y1) * 0.5;
      item.z = ALTURA_PRACA;
      item.x0 = x0;
      item.y0 = y0;
      item.x1 = x1;
      item.y1 = y1;
      item.l = Math.max(x1 - x0, y1 - y0);
      item.a = v.altura || 4;
      item.volume = true;
      item.nome = nomePapel(papel);
      item.linha = zona.nome || "";
      item.cor = COR[papel] || COR.casa;
    }
  }
}

function encherConstruido(hx, hy) {
  visitarEstruturasPerto(hx, hy, ALCANCE_PREDIO, (row, tipo) => {
    if (tipo === "movel" || tipo === "cerca") {
      const x = tipo === "cerca" ? row.tx + 0.5 : row.x + 0.5;
      const y = tipo === "cerca" ? row.ty + 0.5 : row.y + 0.5;
      const dx = x - hx;
      const dy = y - hy;
      if (dx * dx + dy * dy > ALCANCE_MOVEL2) return;
      const item = slot();
      item.x = x;
      item.y = y;
      item.z = row.z || 0;
      item.l = 0.9;
      item.a = 1.15;
      item.volume = false;
      item.cor = tipo === "cerca" ? COR.cerca : COR.movel;
      if (tipo === "cerca") {
        const portao = row.kind === FENCE_KIND.GATE;
        item.id = portao ? "portao:" + row.tx + "," + row.ty : "cerca:" + row.tx + "," + row.ty;
        item.nome = t(portao ? "detalhe.portao" : "detalhe.cerca");
        item.linha = "";
        return;
      }
      item.id = row.id;
      item.nome = texto("detalhe.movel." + (row.key || ""), t("detalhe.movel.mesa"));
      item.linha = "";
      return;
    }
    const cols = row.cols || 6;
    const rows = row.rows || 5;
    const item = slot();
    item.id = row.id;
    item.x = row.x;
    item.y = row.y;
    item.z = row.z || 0;
    item.x0 = row.x - cols * 0.5;
    item.y0 = row.y - rows * 0.5;
    item.x1 = row.x + cols * 0.5;
    item.y1 = row.y + rows * 0.5;
    item.l = Math.max(cols, rows);
    item.a = Math.max(3.5, (row.floors || 1) * 3.5);
    item.volume = true;
    item.nome = nomeModelo(row.buildingId);
    item.linha = t("detalhe.minhaCasa");
    item.cor = COR.casa;
  });
}

/** Preenche o pool. Vale até o próximo prepararLugares. */
export function prepararLugares(hx, hy) {
  nPool = 0;
  encherCidade(hx, hy);
  encherConstruido(hx, hy);
}

export function totalLugares() {
  return nPool;
}

export function lugarEm(i) {
  return pool[i];
}

export function alturaDoModelo(modelo) {
  return ALTURA_MODELO[modelo] || 4;
}
