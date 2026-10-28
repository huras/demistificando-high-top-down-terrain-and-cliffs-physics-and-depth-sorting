/**
 * Mapa de Kanto em tela cheia. M abre e fecha. Arraste, scroll e o zoom
 * trocam o quanto do ruído do terreno cabe na tela.
 */
import { deLocalKanto } from "../../mundo/bounds.js";
import { alturaEm } from "../../mundo/altura.js";
import { AREA_KANTO, CENTRO_AREA, zonaNoMundo } from "../../mundo/regiao/grafoKanto.js";
import { estado } from "../../jogo/estado.js";
import { comecarSubida, prepararViagem, teleporteOcupado } from "../../jogo/teleporte.js";
import { marcasSantuario } from "../../santuario/mapaMarcas.js";
import { getWorldShrinePlan, shrineOutdoorStand } from "../../santuario/colocacao.js";
import { revelarSantuarios } from "../../santuario/estadoSantuario.js";
import { filtrarWildParaVista, marcasWild } from "../../mapa/marcasWild.js";
import { wildPinVisivelNoZoom } from "../../mapa/pinWild.js";
import { marcasLetras } from "../../letras/mapaMarcas.js";
import { getWorldLetterPuzzlePlan } from "../../letras/plano.js";
import { revelarLetras } from "../../letras/estado.js";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { iniciarAtlas, tickAtlas, tickTiles } from "./atlas.js";
import { LADO_MUNDO } from "./grade.js";
import { tickIntimo } from "./intimo.js";
import { cidadesDoMapa } from "./marcas.js";
import { pintarMapa } from "./pintar.js";

const ZOOM_MAX = 8;

let raiz = null;
let tela = null;
let titulo = null;
let confirmEl = null;
let confirmTxt = null;
let aberto = false;
let cx = 0;
let cy = 0;
let zoom = 0.55;
let zoomAlvo = 0.55;
let ancora = null;
let arraste = null;
let dpr = 1;
let jogadorX = 0;
let jogadorY = 0;
let viagem = null;
let pendente = null;
let calorForca = false;
let botaoCalor = null;
let jornadaVisivel = true;
let botaoJornada = null;
let botaoRevelarSantuarios = null;
let botaoRevelarLetras = null;
/** Id da marca (santuario/wild/letra) sob o cursor — título só no hover. */
let hoverMarcaId = null;

const RAIO_CIDADE = 22;
const RAIO_SANTUARIO = 18;
const RAIO_WILD = 16;
const RAIO_LETRA = 16;
const ZOOM_VIAGEM = 1.15;

function sincronizarBotaoCalor() {
  if (!botaoCalor) return;
  botaoCalor.setAttribute("aria-pressed", calorForca ? "true" : "false");
  botaoCalor.classList.toggle("is-ativo", calorForca);
}

function sincronizarBotaoJornada() {
  if (!botaoJornada) return;
  botaoJornada.setAttribute("aria-pressed", jornadaVisivel ? "true" : "false");
  botaoJornada.classList.toggle("is-ativo", jornadaVisivel);
}

export function mapaAberto() {
  return aberto;
}

export function mapaViajando() {
  return !!viagem;
}

function zoomMinimo() {
  if (!tela) return 0.12;
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  return (Math.min(cssW, cssH) / LADO_MUNDO) * 0.92;
}

function travar() {
  const m = 280;
  if (cx < -m) cx = -m;
  else if (cx > LADO_MUNDO + m) cx = LADO_MUNDO + m;
  if (cy < -m) cy = -m;
  else if (cy > LADO_MUNDO + m) cy = LADO_MUNDO + m;
}

function ajustarTela() {
  const rect = tela.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.floor(rect.width * dpr));
  const h = Math.max(2, Math.floor(rect.height * dpr));
  if (tela.width !== w || tela.height !== h) {
    tela.width = w;
    tela.height = h;
  }
}

function definirZoom(alvo, sx, sy) {
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  const wx = cx + (sx - cssW / 2) / zoom;
  const wy = cy + (sy - cssH / 2) / zoom;
  zoomAlvo = Math.max(zoomMinimo(), Math.min(ZOOM_MAX, alvo));
  ancora = { wx, wy, sx, sy };
}

function mesmaCidade(cidade) {
  if (!Number.isFinite(cidade.ax) || !Number.isFinite(cidade.ay)) {
    return Math.hypot(jogadorX - cidade.x, jogadorY - cidade.y) < 48;
  }
  if (estado.interior) {
    return estado.interior.ax === cidade.ax && estado.interior.ay === cidade.ay;
  }
  return ((jogadorX / AREA_KANTO) | 0) === cidade.ax && ((jogadorY / AREA_KANTO) | 0) === cidade.ay;
}

function mesmoDestino(dest) {
  if (!dest) return false;
  if (dest.tipo === "santuario" || dest.tipo === "letra" || dest.tipo === "wild") {
    return Math.hypot(jogadorX - dest.x, jogadorY - dest.y) < 40;
  }
  return mesmaCidade(dest);
}

function destinoSantuario(marca) {
  const stand = shrineOutdoorStand(marca);
  const z =
    alturaEm(Math.floor(stand.x), Math.floor(stand.y)) ||
    (Number.isFinite(marca.z) ? marca.z : 1);
  return {
    tipo: "santuario",
    id: marca.id,
    nome: marca.nome || "Santuário",
    x: stand.x,
    y: stand.y,
    z,
    element: marca.element,
  };
}

function hitNoPonto(lista, sx, sy, rect, raio) {
  let melhor = null;
  let melhorD = raio * raio;
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    const px = (item.x - cx) * zoom + rect.width / 2;
    const py = (item.y - cy) * zoom + rect.height / 2;
    const dx = sx - px;
    const dy = sy - py;
    const d = dx * dx + dy * dy;
    if (d <= melhorD) {
      melhorD = d;
      melhor = item;
    }
  }
  return melhor;
}

function destinoWild(marca) {
  if (!marca) return null;
  const z = Number.isFinite(marca.z) ? marca.z : alturaDoRelevo(marca.x, marca.y);
  return {
    tipo: "wild",
    id: marca.id,
    nome: marca.nome || marca.speciesKey || "Pokémon",
    x: marca.x,
    y: marca.y,
    z: z || 1,
  };
}

function destinoLetra(marca) {
  if (!marca) return null;
  const z = Number.isFinite(marca.z) ? marca.z : alturaDoRelevo(marca.x, marca.y);
  return {
    tipo: "letra",
    id: marca.id,
    nome: marca.nome || `Letra ${marca.letter}`,
    x: marca.x,
    y: marca.y,
    z: z || 1,
    letter: marca.letter,
  };
}

/** Cidade / santuário / letra / wild sob o cursor (teleporte). */
function destinoNoPonto(clientX, clientY) {
  if (!tela || !aberto) return null;
  const rect = tela.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const cidade = hitNoPonto(cidadesDoMapa(), sx, sy, rect, RAIO_CIDADE);
  if (cidade) return cidade;
  const shrine = hitNoPonto(marcasSantuario(), sx, sy, rect, RAIO_SANTUARIO);
  if (shrine) return destinoSantuario(shrine);
  const letra = hitNoPonto(marcasLetras(), sx, sy, rect, RAIO_LETRA);
  if (letra) return destinoLetra(letra);
  const vista = { cx, cy, zoom, mini: false };
  if (!wildPinVisivelNoZoom(vista)) return null;
  const wilds = filtrarWildParaVista(marcasWild(), vista);
  const wild = hitNoPonto(wilds, sx, sy, rect, RAIO_WILD);
  return wild ? destinoWild(wild) : null;
}

/** Santuário / wild / letra sob o cursor (só para título no hover). */
function marcaRotuloNoPonto(clientX, clientY) {
  if (!tela || !aberto) return null;
  const rect = tela.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const shrine = hitNoPonto(marcasSantuario(), sx, sy, rect, RAIO_SANTUARIO);
  if (shrine) return shrine;
  const letra = hitNoPonto(marcasLetras(), sx, sy, rect, RAIO_LETRA);
  if (letra) return letra;
  const vista = { cx, cy, zoom, mini: false };
  if (!wildPinVisivelNoZoom(vista)) return null;
  const wilds = filtrarWildParaVista(marcasWild(), vista);
  return hitNoPonto(wilds, sx, sy, rect, RAIO_WILD);
}

function apontarCidade(ev) {
  if (!tela || viagem || pendente) {
    hoverMarcaId = null;
    return;
  }
  const rotulo = marcaRotuloNoPonto(ev.clientX, ev.clientY);
  hoverMarcaId = rotulo?.id ?? null;
  const dest = destinoNoPonto(ev.clientX, ev.clientY);
  const viaja = dest && !mesmoDestino(dest);
  tela.classList.toggle("mapa-mundo__tela--cidade", !!viaja);
}

function mostrarConfirmacao(dest) {
  pendente = dest;
  let rotulo = dest.nome;
  if (dest.tipo === "santuario") rotulo = `o santuário ${dest.nome}`;
  else if (dest.tipo === "letra") rotulo = `o puzzle ${dest.nome}`;
  else if (dest.tipo === "wild") rotulo = `o spawn de ${dest.nome}`;
  if (confirmTxt) confirmTxt.textContent = `Teleportar para ${rotulo}?`;
  if (confirmEl) confirmEl.hidden = false;
  tela?.classList.remove("mapa-mundo__tela--cidade");
}

function ocultarConfirmacao() {
  pendente = null;
  if (confirmEl) confirmEl.hidden = true;
  if (confirmTxt) confirmTxt.textContent = "";
}

export function cancelarConfirmacaoMapa() {
  if (!pendente) return false;
  ocultarConfirmacao();
  return true;
}

function iniciarViagem(dest) {
  if (!dest || viagem || teleporteOcupado()) return;
  prepararViagem(dest);
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  zoomAlvo = Math.min(ZOOM_MAX, Math.max(ZOOM_VIAGEM, zoom * 1.8));
  ancora = { wx: dest.x, wy: dest.y, sx: cssW / 2, sy: cssH / 2 };
  arraste = null;
  tela.classList.remove("mapa-mundo__tela--arraste");
  tela.classList.remove("mapa-mundo__tela--cidade");
  ocultarConfirmacao();
  viagem = { cidade: dest, t: 0 };
}

function escolherCidade(ev) {
  if (!aberto || viagem || pendente || teleporteOcupado()) return;
  const dest = destinoNoPonto(ev.clientX, ev.clientY);
  if (!dest || mesmoDestino(dest)) return;
  arraste = null;
  tela.classList.remove("mapa-mundo__tela--arraste");
  mostrarConfirmacao(dest);
}

export function zoomMapa(fator) {
  if (!aberto || !tela || viagem) return;
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  definirZoom(zoomAlvo * fator, cssW / 2, cssH / 2);
}

export function abrirMapa(x, y) {
  if (!raiz) return;
  if (estado.interior && Number.isFinite(estado.interior.ax)) {
    const p = deLocalKanto(
      estado.interior.ax * AREA_KANTO + CENTRO_AREA + 0.5,
      estado.interior.ay * AREA_KANTO + CENTRO_AREA + 0.5,
    );
    x = p.x;
    y = p.y;
  }
  cx = x;
  cy = y;
  aberto = true;
  raiz.hidden = false;
  soltarFoco();
}

function soltarFoco() {
  const limpar = () => {
    const ativo = document.activeElement;
    if (!ativo || ativo === document.body || ativo === document.documentElement) return;
    const tag = ativo.tagName;
    if (
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA" ||
      tag === "BUTTON" ||
      raiz?.contains(ativo)
    ) {
      ativo.blur();
    }
  };
  limpar();
  requestAnimationFrame(limpar);
}

/** @type {(() => void) | null} */
let aoFecharMapaCb = null;

/** Callback após fechar (ex.: sair da aba Map do menu). */
export function aoFecharMapa(fn) {
  aoFecharMapaCb = typeof fn === "function" ? fn : null;
}

export function fecharMapa() {
  if (!raiz) return;
  const estavaAberto = aberto;
  aberto = false;
  ancora = null;
  arraste = null;
  hoverMarcaId = null;
  ocultarConfirmacao();
  tela?.classList.remove("mapa-mundo__tela--arraste");
  tela?.classList.remove("mapa-mundo__tela--cidade");
  raiz.hidden = true;
  soltarFoco();
  if (estavaAberto) aoFecharMapaCb?.();
}

export function ligarMapaMundo() {
  raiz = document.getElementById("mapa-mundo");
  tela = document.getElementById("mapa-mundo-tela");
  titulo = document.getElementById("mapa-mundo-titulo");
  confirmEl = document.getElementById("mapa-mundo-confirm");
  confirmTxt = document.getElementById("mapa-mundo-confirm-txt");
  botaoCalor = document.getElementById("mapa-calor-forca");
  botaoJornada = document.getElementById("mapa-jornada");
  botaoRevelarSantuarios = document.getElementById("mapa-revelar-santuarios");
  botaoRevelarLetras = document.getElementById("mapa-revelar-letras");
  if (!raiz || !tela) return;
  iniciarAtlas();
  calorForca = false;
  jornadaVisivel = true;
  sincronizarBotaoCalor();
  sincronizarBotaoJornada();
  botaoCalor?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    calorForca = !calorForca;
    sincronizarBotaoCalor();
  });
  botaoJornada?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    jornadaVisivel = !jornadaVisivel;
    sincronizarBotaoJornada();
  });
  botaoRevelarSantuarios?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const slots = getWorldShrinePlan().slots;
    const ids = [];
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]?.id) ids.push(slots[i].id);
    }
    revelarSantuarios(ids);
    botaoRevelarSantuarios.classList.add("is-ativo");
  });
  botaoRevelarLetras?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const slots = getWorldLetterPuzzlePlan().slots;
    const ids = [];
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]?.id) ids.push(slots[i].id);
    }
    revelarLetras(ids);
    botaoRevelarLetras.classList.add("is-ativo");
  });
  document.getElementById("mapa-confirm-ir")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (pendente) iniciarViagem(pendente);
  });
  document.getElementById("mapa-confirm-nao")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ocultarConfirmacao();
  });

  tela.addEventListener("pointerdown", (ev) => {
    if (!aberto || viagem) return;
    if (ev.button === 2) {
      ev.preventDefault();
      escolherCidade(ev);
      return;
    }
    if (ev.button !== 0 || pendente) return;
    tela.setPointerCapture(ev.pointerId);
    arraste = { x: ev.clientX, y: ev.clientY, cx, cy };
    ancora = null;
    tela.classList.add("mapa-mundo__tela--arraste");
  });
  tela.addEventListener("pointermove", (ev) => {
    if (!arraste) {
      apontarCidade(ev);
      return;
    }
    hoverMarcaId = null;
    cx = arraste.cx - (ev.clientX - arraste.x) / zoom;
    cy = arraste.cy - (ev.clientY - arraste.y) / zoom;
    travar();
  });
  const soltar = () => {
    arraste = null;
    tela.classList.remove("mapa-mundo__tela--arraste");
  };
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);
  tela.addEventListener("pointerleave", () => {
    hoverMarcaId = null;
    tela.classList.remove("mapa-mundo__tela--cidade");
  });
  tela.addEventListener("contextmenu", (ev) => ev.preventDefault());
  tela.addEventListener(
    "wheel",
    (ev) => {
      if (!aberto) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (viagem || pendente) return;
      const rect = tela.getBoundingClientRect();
      const fator = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      definirZoom(zoomAlvo * fator, ev.clientX - rect.left, ev.clientY - rect.top);
    },
    { passive: false },
  );
  window.addEventListener("resize", () => {
    if (aberto) ajustarTela();
  });
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} [dt]
 * @param {{ dirX?: number, dirY?: number, facing?: number } | null} [rumo]
 */
export function tickMapaMundo(px, py, dt = 1 / 60, rumo = null) {
  try {
  tickAtlas();
  if (estado.interior && Number.isFinite(estado.interior.ax)) {
    const p = deLocalKanto(
      estado.interior.ax * AREA_KANTO + CENTRO_AREA + 0.5,
      estado.interior.ay * AREA_KANTO + CENTRO_AREA + 0.5,
    );
    px = p.x;
    py = p.y;
  }
  jogadorX = px;
  jogadorY = py;
  if (!aberto || !tela) return;
  ajustarTela();
  const cssW = tela.width / dpr;
  const cssH = tela.height / dpr;
  if (viagem) {
    viagem.t += Math.min(0.05, dt);
    zoom += (zoomAlvo - zoom) * 0.28;
    cx += (viagem.cidade.x - cx) * 0.28;
    cy += (viagem.cidade.y - cy) * 0.28;
    const perto =
      Math.abs(zoomAlvo - zoom) < 0.04 &&
      Math.hypot(viagem.cidade.x - cx, viagem.cidade.y - cy) < 8;
    if ((viagem.t >= 0.42 && perto) || viagem.t >= 0.85) {
      const cidade = viagem.cidade;
      viagem = null;
      fecharMapa();
      comecarSubida(cidade);
      return;
    }
  } else if (Math.abs(zoomAlvo - zoom) > 0.0008) {
    zoom += (zoomAlvo - zoom) * 0.28;
    if (ancora) {
      cx = ancora.wx - (ancora.sx - cssW / 2) / zoom;
      cy = ancora.wy - (ancora.sy - cssH / 2) / zoom;
    }
  } else {
    zoom = zoomAlvo;
    ancora = null;
  }
  travar();
  const meioW = cssW / (2 * zoom);
  const meioH = cssH / (2 * zoom);
  tickTiles(cx, cy, zoom, cx - meioW, cy - meioH, cx + meioW, cy + meioH);
  tickIntimo(cx, cy, zoom, cx - meioW, cy - meioH, cx + meioW, cy + meioH);
  const ctx = tela.getContext("2d");
  pintarMapa(ctx, tela.width, tela.height, dpr, {
    cx,
    cy,
    zoom,
    jogadorX: px,
    jogadorY: py,
    jogadorDirX: rumo?.dirX ?? 0,
    jogadorDirY: rumo?.dirY ?? 0,
    jogadorFacing: rumo?.facing ?? 0,
    agora: performance.now(),
    calorForca,
    jornada: jornadaVisivel,
    hoverMarcaId,
  });
  if (titulo) {
    const zona = zonaNoMundo(px, py);
    const nome = zona?.nome || "Mundo";
    if (titulo.textContent !== nome) titulo.textContent = nome;
  }
  } catch (err) {
    console.error(err);
    viagem = null;
    ocultarConfirmacao();
    aberto = false;
    if (raiz) raiz.hidden = true;
  }
}
