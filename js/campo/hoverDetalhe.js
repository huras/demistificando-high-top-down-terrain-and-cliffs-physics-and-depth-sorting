/**
 * Cartão do detalhe sob o cursor: nome e o que ainda dá para colher.
 * O pick só roda quando a célula, o ponteiro ou a câmera mudam.
 */
import { CHUNK_XZ } from "../config.js";
import { cameraDoHover2d, obterHoverBloco, obterPonteiroCanvas } from "../entrada/hoverBloco.js";
import { obterModo } from "../modoJogo.js";
import { propsDoChunk } from "../mundo/bioma/propsBioma.js";
import { projetarChao3d, projetarPes2d } from "../pokemon/hud.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { imagemIcone } from "../jogo/icones.js";
import { idiomaAtual, t } from "../jogo/i18n.js";
import { nomeDaForma } from "./nomeSprite.js";
import { recursoArvore } from "./cicloArvore.js";
import { recursoBerry } from "./colherBerry.js";
import { FASE } from "./estadoProps.js";
import { recursoTufo } from "./grama.js";
import { alturaDoModelo, lugarEm, prepararLugares, totalLugares } from "./hoverLugar.js";
import { materialDoMineral, recursoMineral } from "./mineracao.js";
import { nomeTemplo } from "../santuario/nomes.js";

const RAIO = 6;
const RAIO2 = RAIO * RAIO;
const RAIO_CASA = 12;
const RAIO_CASA2 = RAIO_CASA * RAIO_CASA;
const COR = Object.freeze({
  arvore: "#4ade80",
  toco: "#d6a15a",
  carvao: "#a8a29e",
  pedra: "#d6d3d1",
  grama: "#86efac",
  berry: "#fb7185",
  sitio: "#facc15",
  lapide: "#a8a29e",
  santuario: "#e879f9",
  casa: "#fcd34d",
});
const COR_CRISTAL = Object.freeze({
  redCrystal: "#f87171",
  yellowCrystal: "#facc15",
  purpleCrystal: "#c084fc",
  greenCrystal: "#4ade80",
  pinkCrystal: "#f9a8d4",
  blueCrystal: "#60a5fa",
  lightBlueCrystal: "#7dd3fc",
});

const estado = {
  assinatura: "",
  chave: "",
  visivel: false,
  nome: "",
  linha: "",
  item: "",
  cor: COR.grama,
  prop: null,
};

function limpar() {
  if (!estado.visivel && !estado.chave) return;
  estado.visivel = false;
  estado.chave = "";
  estado.nome = "";
  estado.linha = "";
  estado.item = "";
  estado.prop = null;
}

function ehArado(prop) {
  return prop.kind === "arado" || prop.propId === "arado";
}

function detalheUtil(prop) {
  if (!prop || prop.oculto || prop.fase === FASE.REMOVIDO) return false;
  const tipo = prop.tipo;
  if (tipo === "site") return !ehArado(prop);
  return (
    tipo === "arvore" ||
    tipo === "pedra" ||
    tipo === "cristal" ||
    tipo === "grama" ||
    tipo === "mata" ||
    tipo === "berry" ||
    tipo === "siteCasa" ||
    tipo === "santuario"
  );
}

function texto(chave, reserva) {
  const s = t(chave);
  return s && s !== chave ? s : reserva;
}

function medida(prop) {
  const veg = prop._veg;
  if (veg && veg.largura > 0 && veg.altura > 0) return { l: veg.largura, a: veg.altura };
  const fase = prop.fase;
  if (prop.tipo === "arvore") {
    if (fase === FASE.TOCO || fase === FASE.TOCO_QUEIMADO) return { l: 0.9, a: 0.7 };
    return { l: 1.8, a: 3.2 };
  }
  if (prop.tipo === "pedra" || prop.tipo === "cristal") return { l: 1.15, a: 1.25 };
  if (prop.tipo === "berry") return { l: 0.95, a: 1.05 };
  if (prop.tipo === "siteCasa") {
    const lado = Math.max(prop.cols || 6, prop.rows || 5);
    return { l: lado * 0.92, a: alturaDoModelo(prop.modelo) };
  }
  if (prop.tipo === "santuario") return { l: 2.4, a: (prop.halfH || 1.6) * 2.2 };
  if (prop.tipo === "site") {
    const lapide = prop.kind === "lapide" || String(prop.propId || "").startsWith("lapide");
    if (lapide) return { l: 0.7, a: 1.35 };
    if (prop.propId === "plantacao") return { l: 0.7, a: 0.7 };
    const lado = Math.max(0.7, (prop.r || 0.4) * 2.2);
    return { l: lado, a: Math.max(1, lado * 1.3) };
  }
  return { l: 0.75, a: 0.85 };
}

function publicar(prop) {
  const chave = `${prop.id}|${prop.fase || ""}|${prop.hp | 0}|${prop.estagio || ""}|${idiomaAtual()}`;
  if (chave === estado.chave) return;
  estado.chave = chave;
  estado.visivel = true;
  const tipo = prop.tipo;
  const fase = prop.fase || FASE.EM_PE;
  let nome = "";
  let linha = "";
  let item = "";
  let cor = COR.grama;
  const forma = nomeDaForma(prop.sprite);

  if (tipo === "arvore") {
    const especie = forma || t("detalhe.arvore");
    nome =
      fase === FASE.TOCO
        ? `${t("detalhe.toco")} · ${especie}`
        : fase === FASE.TOCO_QUEIMADO
          ? `${t("detalhe.tocoQueimado")} · ${especie}`
          : especie;
    cor = fase === FASE.TOCO_QUEIMADO ? COR.carvao : fase === FASE.TOCO ? COR.toco : COR.arvore;
    if (fase === FASE.CAINDO) linha = t("detalhe.caindo");
    else if (fase === FASE.QUEIMANDO) linha = t("detalhe.queimando");
    else {
      const rec = recursoArvore(prop);
      if (rec) {
        item = rec.item;
        linha = `${t("materials." + rec.item)} × ${rec.n}`;
      }
    }
  } else if (tipo === "pedra" || tipo === "cristal") {
    const material = materialDoMineral(prop);
    nome = forma || (tipo === "cristal" ? t("materials." + material) : t("detalhe.pedra"));
    cor = tipo === "cristal" ? COR_CRISTAL[material] || COR_CRISTAL.blueCrystal : COR.pedra;
    const rec = recursoMineral(prop);
    if (rec) {
      item = rec.item;
      linha = `${t("materials." + rec.item)} × ${rec.n}`;
    }
  } else if (tipo === "grama" || tipo === "mata") {
    nome = forma || t(tipo === "mata" ? "detalhe.mata" : "detalhe.grama");
    cor = COR.grama;
    const rec = recursoTufo(prop);
    if (rec) {
      item = rec.item;
      linha = `${t("materials." + rec.item)} × ${rec.n}`;
    }
  } else if (tipo === "berry") {
    const berry = prop.berryKey || "oran";
    nome = t("berries." + berry);
    cor = COR.berry;
    item = berry;
    const estagio = prop.estagio || "maduro";
    if (estagio === "flor") linha = t("detalhe.flor");
    else if (estagio === "arbusto") linha = t("detalhe.arbusto");
    else {
      const rec = recursoBerry(prop);
      if (rec) linha = `${rec.min}–${rec.max}`;
      else item = "";
    }
  } else if (tipo === "siteCasa") {
    const modelo = prop.modelo === "ruina" && prop.siteTipo === "dock" ? "farol" : prop.modelo;
    nome = texto("detalhe.modelo." + (modelo || "casa"), t("detalhe.papel.casa"));
    cor = COR.casa;
    linha = texto("detalhe.sitio." + (prop.siteTipo || ""), "");
  } else if (tipo === "site") {
    const lapide = prop.kind === "lapide" || String(prop.propId || "").startsWith("lapide");
    nome = texto("detalhe.poi." + (prop.propId || "poco"), t("detalhe.poi.poco"));
    cor = lapide ? COR.lapide : prop.propId === "plantacao" ? COR.grama : COR.sitio;
    linha = texto("detalhe.sitio." + (prop.siteTipo || ""), "");
  } else if (tipo === "santuario") {
    nome = nomeTemplo(prop.shrineId || prop.id, prop.element);
    cor = COR.santuario;
    linha = prop.cleared
      ? t("santuario.totemVazio")
      : texto("detalhe.elemento." + (prop.element || "normal"), "");
  }

  estado.nome = nome;
  estado.linha = linha;
  estado.item = item;
  estado.cor = cor;
}

function publicarLugar(lugar) {
  const chave = `${lugar.id}|${lugar.nome}|${lugar.linha}|${idiomaAtual()}`;
  if (chave === estado.chave) return;
  estado.chave = chave;
  estado.visivel = true;
  estado.nome = lugar.nome;
  estado.linha = lugar.linha || "";
  estado.item = "";
  estado.cor = lugar.cor || COR.casa;
}

function cobreVolume(x0, y0, x1, y1, z, altura, projetar, px, py) {
  const zs = [z, z + altura];
  const xs = [x0, x1];
  const ys = [y0, y1];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let algum = false;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        const p = projetar(xs[i], ys[j], zs[k], 0);
        if (!p) continue;
        algum = true;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }
  if (!algum) return Infinity;
  if (px < minX - 6 || px > maxX + 6 || py < minY - 6 || py > maxY + 6) return Infinity;
  const dx = px - (minX + maxX) * 0.5;
  const dy = py - (minY + maxY) * 0.5;
  return dx * dx + dy * dy;
}

function cobreCaixa(x, y, z, largura, altura, projetar, px, py) {
  const pes = projetar(x, y, z, 0);
  const topo = projetar(x, y, z + altura, 0);
  if (!pes || !topo) return Infinity;
  const altPx = Math.abs(topo.y - pes.y);
  const meia = Math.max(12, altPx * (largura / Math.max(0.2, altura)) * 0.5);
  const y0 = Math.min(pes.y, topo.y) - 4;
  const y1 = Math.max(pes.y, topo.y) + 6;
  if (px < pes.x - meia || px > pes.x + meia || py < y0 || py > y1) return Infinity;
  const dx = px - pes.x;
  const dy = py - (y0 + y1) * 0.5;
  return dx * dx + dy * dy;
}

function cobre(prop, projetar, px, py) {
  const med = medida(prop);
  return cobreCaixa(prop.x, prop.y, prop.z || 0, med.l, med.a, projetar, px, py);
}

function varrer(hx, hy, projetar, px, py) {
  const cx0 = Math.floor((hx - RAIO_CASA) / CHUNK_XZ);
  const cy0 = Math.floor((hy - RAIO_CASA) / CHUNK_XZ);
  const cx1 = Math.floor((hx + RAIO_CASA) / CHUNK_XZ);
  const cy1 = Math.floor((hy + RAIO_CASA) / CHUNK_XZ);
  let melhor = null;
  let lugar = null;
  let melhorD = Infinity;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const lista = propsDoChunk(cx, cy);
      if (!lista) continue;
      for (let i = 0; i < lista.length; i++) {
        const prop = lista[i];
        if (!detalheUtil(prop)) continue;
        const largo = prop.tipo === "siteCasa" || prop.tipo === "santuario";
        const dx = prop.x - hx;
        const dy = prop.y - hy;
        if (dx * dx + dy * dy > (largo ? RAIO_CASA2 : RAIO2)) continue;
        const d =
          prop.tipo === "siteCasa"
            ? cobreVolume(
                prop.x - (prop.cols || 6) * 0.5,
                prop.y - (prop.rows || 5) * 0.5,
                prop.x + (prop.cols || 6) * 0.5,
                prop.y + (prop.rows || 5) * 0.5,
                prop.z || 0,
                alturaDoModelo(prop.modelo),
                projetar,
                px,
                py
              )
            : cobre(prop, projetar, px, py);
        if (d < melhorD) {
          melhorD = d;
          melhor = prop;
          lugar = null;
        }
      }
    }
  }
  prepararLugares(hx, hy);
  const n = totalLugares();
  for (let i = 0; i < n; i++) {
    const item = lugarEm(i);
    const d = item.volume
      ? cobreVolume(item.x0, item.y0, item.x1, item.y1, item.z, item.a, projetar, px, py)
      : cobreCaixa(item.x, item.y, item.z, item.l, item.a, projetar, px, py);
    if (d < melhorD) {
      melhorD = d;
      melhor = null;
      lugar = item;
    }
  }
  return lugar || melhor;
}

function projetorAtual(canvas) {
  if (obterModo() === "3d") {
    const cam = obterCenario3d()?.camera3d?.cam;
    if (!cam || !canvas) return null;
    const projetar = projetarChao3d(cam, canvas.width, canvas.height);
    return { projetar, camera: cam.position };
  }
  const camera = cameraDoHover2d();
  if (!camera || !canvas) return null;
  return { projetar: projetarPes2d(camera), camera };
}

export function atualizarHoverDetalhe() {
  const canvas = document.getElementById("canvas");
  const ptr = canvas ? obterPonteiroCanvas(canvas) : null;
  const hover = obterHoverBloco();
  const vista = ptr && hover ? projetorAtual(canvas) : null;
  if (!ptr || !hover || !vista) {
    estado.assinatura = "";
    limpar();
    return;
  }
  const cam = vista.camera;
  const assinatura =
    hover.x +
    "," +
    hover.y +
    "," +
    hover.z +
    "|" +
    ((ptr.x / 8) | 0) +
    "," +
    ((ptr.y / 8) | 0) +
    "|" +
    Math.round((cam?.x || 0) * 4) +
    "," +
    Math.round((cam?.y || 0) * 4) +
    "," +
    Math.round((cam?.z || 0) * 4) +
    "|" +
    Math.round((cam?.zoom || 1) * 20) +
    "|" +
    idiomaAtual();
  if (assinatura === estado.assinatura) {
    if (estado.prop && !detalheUtil(estado.prop)) limpar();
    else if (estado.prop) publicar(estado.prop);
    return;
  }
  estado.assinatura = assinatura;
  const melhor = varrer(hover.x + 0.5, hover.y + 0.5, vista.projetar, ptr.x, ptr.y);
  if (!melhor) {
    estado.prop = null;
    limpar();
    return;
  }
  if (melhor.tipo) {
    estado.prop = melhor;
    publicar(melhor);
    return;
  }
  estado.prop = null;
  publicarLugar(melhor);
}

const ICO = 16;

function pintarPill(ctx, x, y, texto) {
  ctx.font = "800 12px Segoe UI, system-ui, sans-serif";
  const textoW = ctx.measureText(texto).width;
  const temIco = !!estado.item;
  const w = Math.ceil((temIco ? ICO + 6 : 0) + textoW + 14);
  const h = 22;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 11);
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fill();
  let tx = x + 8;
  if (temIco) {
    const img = imagemIcone(estado.item);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x + 4, y + 3, ICO, ICO);
      ctx.imageSmoothingEnabled = true;
    }
    tx = x + 4 + ICO + 4;
  }
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, tx, y + h * 0.5);
  return w;
}

export function desenharHoverDetalhe(ctx, canvasW, canvasH) {
  if (!ctx || !estado.visivel || !estado.nome) return;
  const ptr = obterPonteiroCanvas(ctx.canvas);
  if (!ptr) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
  const nomeW = ctx.measureText(estado.nome).width;
  ctx.font = "800 12px Segoe UI, system-ui, sans-serif";
  const linhaW = estado.linha
    ? ctx.measureText(estado.linha).width + (estado.item ? ICO + 6 : 0) + 14
    : 0;
  const w = Math.ceil(Math.max(nomeW, linhaW) + 22);
  const h = estado.linha ? 48 : 26;
  let x = ptr.x + 16;
  let y = ptr.y - h - 10;
  if (x + w > canvasW - 8) x = ptr.x - w - 16;
  if (x < 8) x = 8;
  if (y < 8) y = ptr.y + 16;
  if (y + h > canvasH - 8) y = Math.max(8, canvasH - h - 8);

  ctx.fillStyle = "rgba(10, 14, 12, 0.92)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = estado.cor;
  ctx.fillRect(x, y + 6, 3, h - 12);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(estado.nome, x + 12, y + (estado.linha ? 14 : h * 0.5));
  if (estado.linha) pintarPill(ctx, x + 10, y + 22, estado.linha);
  ctx.restore();
}
