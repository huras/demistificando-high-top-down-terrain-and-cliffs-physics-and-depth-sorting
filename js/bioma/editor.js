import { ALTURA_MAX_RELEVO, SEED_MUNDO } from "../config.js";
import {
  alturaDoRelevo,
  biomaDominante,
} from "../mundo/bioma/catalogo.js";
import { amostrarNos, avaliarGrafo } from "../mundo/bioma/grafo.js";
import { carregarDetalhe, definirDetalhe, obterDetalhe } from "../mundo/bioma/detalhe.js";
import { carregarKits, idsDeKit, obterKit } from "../mundo/bioma/kits.js";
import { DEMO_3D, atualizarPreviewBioma, iniciarPreviewBioma } from "./preview3d.js";

const PORTAS = {
  constante: { entradas: [], saidas: ["Out"] },
  ruido: { entradas: [], saidas: ["Out"] },
  perlin: { entradas: [], saidas: ["Out"] },
  queda: { entradas: [], saidas: ["Out"] },
  somar: { entradas: ["A", "B"], saidas: ["Out"] },
  multiplicar: { entradas: ["A", "B"], saidas: ["Out"] },
  mistura: { entradas: ["A", "B"], saidas: ["Out"] },
  mascara: { entradas: ["Source", "Mask"], saidas: ["Out"] },
  terraco: { entradas: ["In"], saidas: ["Out"] },
  achatar: { entradas: ["In"], saidas: ["Out"] },
  limitar: { entradas: ["In"], saidas: ["Out"] },
  cratera: { entradas: ["In"], saidas: ["Out"] },
  saida: { entradas: ["In"], saidas: [] },
};

const ROTULOS = {
  constante: "Constante",
  ruido: "Ruído",
  perlin: "Perlin",
  queda: "Queda",
  somar: "Somar",
  multiplicar: "Multiplicar",
  mistura: "Mistura",
  mascara: "Máscara",
  terraco: "Terraço",
  achatar: "Achatar",
  limitar: "Limitar",
  cratera: "Cratera",
  saida: "Saída",
};

const listaEl = document.getElementById("lista");
const nosEl = document.getElementById("nos");
const fiosEl = document.getElementById("fios");
const quadroEl = document.getElementById("quadro");
const inspectorEl = document.getElementById("inspector");
const paletaEl = document.getElementById("paleta");
const statusEl = document.getElementById("status");
const escalaEl = document.getElementById("escala");

/** @type {object | null} */
let dados = null;
let indice = 0;
let noSelecionado = null;
/** @type {{ de: string, portaDe: string, x: number, y: number } | null} */
let fioArraste = null;
let previewPedido = 0;

const PREVIA_NO_LADO = DEMO_3D.lado * 2;
const PREVIA_NO_ORIGEM = DEMO_3D.origem - (DEMO_3D.lado * DEMO_3D.passo) / 2;

function biomaAtual() {
  return dados.biomas[indice];
}

function sementeAtual() {
  return (SEED_MUNDO + (dados.semente | 0)) | 0;
}

function idNovo() {
  return `n${Math.random().toString(36).slice(2, 8)}`;
}

function definirStatus(texto) {
  statusEl.textContent = texto;
}

function criarNo(tipo) {
  const no = {
    id: idNovo(),
    tipo,
    x: 80 + (biomaAtual().nos.length % 5) * 28,
    y: 80 + (biomaAtual().nos.length % 4) * 36,
  };
  if (tipo === "perlin") {
    no.escala = 2;
    no.escalaU = 1;
    no.escalaV = 1;
    no.oitavas = 4;
    no.persistencia = 0.5;
    no.lacunarity = 2;
    no.offsetX = 0;
    no.offsetY = 0;
    no.degraus = 0;
    no.inverter = false;
    no.amplitude = 1;
  }
  if (tipo === "queda") {
    no.centroU = 0.5;
    no.centroV = 0.5;
    no.raioInterno = 0;
    no.raioExterno = 0.5;
    no.expoente = 1;
    no.inverter = false;
    no.amplitude = 1;
  }
  if (tipo === "mistura") {
    no.mistura = 0.5;
    no.amplitude = 1;
  }
  if (tipo === "mascara") {
    no.limiar = 0.5;
    no.suavidade = 0;
    no.inverter = false;
    no.amplitude = 1;
  }
  if (tipo === "constante") no.valor = 4;
  if (tipo === "ruido") {
    no.frequencia = 0.03;
    no.oitavas = 3;
    no.semente = 1;
    no.ganho = 4;
  }
  if (tipo === "terraco") no.degrau = 2;
  if (tipo === "achatar") {
    no.alvo = 8;
    no.forca = 0.5;
  }
  if (tipo === "limitar") {
    no.minimo = 1;
    no.maximo = 36;
  }
  if (tipo === "cratera") {
    no.limiar = 16;
    no.profundidade = 1;
  }
  return no;
}

function pintarLista() {
  listaEl.innerHTML = "";
  for (let i = 0; i < dados.biomas.length; i++) {
    const b = dados.biomas[i];
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    if (i === indice) botao.className = "ativo";
    const amostra = document.createElement("span");
    amostra.className = "amostra";
    amostra.style.background = b.cor || "#5aaa45";
    botao.append(amostra, document.createTextNode(b.nome || b.id));
    botao.addEventListener("click", () => {
      indice = i;
      noSelecionado = null;
      pintarTudo();
    });
    item.append(botao);
    listaEl.append(item);
  }
  escalaEl.value = String(dados.escalaRegiao || 220);
}

function pintarNos() {
  const bioma = biomaAtual();
  nosEl.innerHTML = "";
  for (let i = 0; i < bioma.nos.length; i++) {
    const no = bioma.nos[i];
    const portas = PORTAS[no.tipo] || PORTAS.constante;
    const el = document.createElement("article");
    el.className = "no" + (no.id === noSelecionado ? " selecionado" : "");
    el.style.left = `${no.x || 0}px`;
    el.style.top = `${no.y || 0}px`;
    el.dataset.id = no.id;

    const titulo = document.createElement("header");
    titulo.className = "no__titulo";
    titulo.textContent = ROTULOS[no.tipo] || no.tipo;
    titulo.addEventListener("pointerdown", (ev) => comecarArrasteNo(ev, no));
    el.append(titulo);

    const previa = document.createElement("canvas");
    previa.className = "no__previa";
    previa.width = PREVIA_NO_LADO;
    previa.height = PREVIA_NO_LADO;
    previa.dataset.previa = no.id;
    el.append(previa);

    const corpo = document.createElement("div");
    corpo.className = "no__corpo";
    for (let p = 0; p < portas.entradas.length; p++) {
      corpo.append(portaEl(no.id, portas.entradas[p], "entrada"));
    }
    for (let p = 0; p < portas.saidas.length; p++) {
      corpo.append(portaEl(no.id, portas.saidas[p], "saida"));
    }
    el.append(corpo);
    el.addEventListener("pointerdown", () => {
      noSelecionado = no.id;
      pintarInspector();
      pintarNos();
      pintarFios();
    });
    nosEl.append(el);
  }
  pedirPreviews();
}

function portaEl(idNo, nome, lado) {
  const linha = document.createElement("div");
  linha.className = `porta porta--${lado}`;
  linha.dataset.no = idNo;
  linha.dataset.porta = nome;
  linha.dataset.lado = lado;
  const ponto = document.createElement("i");
  ponto.dataset.no = idNo;
  ponto.dataset.porta = nome;
  ponto.dataset.lado = lado;
  linha.append(ponto, document.createTextNode(nome));
  ponto.addEventListener("pointerdown", (ev) => {
    ev.stopPropagation();
    if (lado === "saida") comecarFio(ev, idNo, nome);
  });
  ponto.addEventListener("pointerup", (ev) => {
    ev.stopPropagation();
    if (lado === "entrada") soltarFio(idNo, nome);
  });
  return linha;
}

function centroPorta(idNo, nome, lado) {
  const ponto = nosEl.querySelector(
    `i[data-no="${CSS.escape(idNo)}"][data-porta="${CSS.escape(nome)}"][data-lado="${lado}"]`,
  );
  if (!ponto) return null;
  const quadro = quadroEl.getBoundingClientRect();
  const r = ponto.getBoundingClientRect();
  return {
    x: r.left - quadro.left + quadroEl.scrollLeft + r.width / 2,
    y: r.top - quadro.top + quadroEl.scrollTop + r.height / 2,
  };
}

function pintarFios() {
  const bioma = biomaAtual();
  const partes = [];
  const ligacoes = bioma.ligacoes || [];
  for (let i = 0; i < ligacoes.length; i++) {
    const l = ligacoes[i];
    const a = centroPorta(l.de, l.portaDe || "Out", "saida");
    const b = centroPorta(l.para, l.portaPara, "entrada");
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2;
    partes.push(
      `<path d="M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}" fill="none" stroke="#8fd18a" stroke-width="2"/>`,
    );
  }
  if (fioArraste) {
    const a = centroPorta(fioArraste.de, fioArraste.portaDe, "saida");
    if (a) {
      const mx = (a.x + fioArraste.x) / 2;
      partes.push(
        `<path d="M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${fioArraste.y}, ${fioArraste.x} ${fioArraste.y}" fill="none" stroke="#e0c36a" stroke-width="2"/>`,
      );
    }
  }
  fiosEl.innerHTML = partes.join("");
}

function comecarArrasteNo(ev, no) {
  ev.stopPropagation();
  noSelecionado = no.id;
  const inicioX = ev.clientX;
  const inicioY = ev.clientY;
  const ox = no.x || 0;
  const oy = no.y || 0;
  const mover = (e) => {
    no.x = Math.max(0, ox + e.clientX - inicioX);
    no.y = Math.max(0, oy + e.clientY - inicioY);
    const el = nosEl.querySelector(`[data-id="${CSS.escape(no.id)}"]`);
    if (el) {
      el.style.left = `${no.x}px`;
      el.style.top = `${no.y}px`;
    }
    pintarFios();
  };
  const soltar = () => {
    window.removeEventListener("pointermove", mover);
    window.removeEventListener("pointerup", soltar);
  };
  window.addEventListener("pointermove", mover);
  window.addEventListener("pointerup", soltar);
}

function posNoQuadro(ev) {
  const quadro = quadroEl.getBoundingClientRect();
  return {
    x: ev.clientX - quadro.left + quadroEl.scrollLeft,
    y: ev.clientY - quadro.top + quadroEl.scrollTop,
  };
}

function comecarFio(ev, idNo, porta) {
  const p = posNoQuadro(ev);
  fioArraste = { de: idNo, portaDe: porta, x: p.x, y: p.y };
  const mover = (e) => {
    if (!fioArraste) return;
    const q = posNoQuadro(e);
    fioArraste.x = q.x;
    fioArraste.y = q.y;
    pintarFios();
  };
  const soltar = () => {
    fioArraste = null;
    window.removeEventListener("pointermove", mover);
    window.removeEventListener("pointerup", soltar);
    pintarFios();
  };
  window.addEventListener("pointermove", mover);
  window.addEventListener("pointerup", soltar);
  pintarFios();
}

function soltarFio(idNo, porta) {
  if (!fioArraste || fioArraste.de === idNo) return;
  const bioma = biomaAtual();
  bioma.ligacoes = (bioma.ligacoes || []).filter(
    (l) => !(l.para === idNo && l.portaPara === porta),
  );
  bioma.ligacoes.push({
    de: fioArraste.de,
    portaDe: fioArraste.portaDe,
    para: idNo,
    portaPara: porta,
  });
  fioArraste = null;
  pintarFios();
  pedirPreviews();
}

function campo(rotulo, valor, aoMudar, tipo = "number") {
  const label = document.createElement("label");
  label.className = "campo";
  label.append(document.createTextNode(rotulo));
  const input = document.createElement("input");
  input.type = tipo;
  if (tipo === "number") input.step = "any";
  input.value = valor ?? "";
  input.addEventListener("input", () => {
    aoMudar(tipo === "number" ? Number(input.value) : input.value);
    pintarLista();
    pedirPreviews();
  });
  label.append(input);
  return label;
}

function tituloSecao(texto) {
  const h = document.createElement("h2");
  h.textContent = texto;
  h.style.fontSize = "0.95rem";
  return h;
}

function campoDetalhe(rotulo, valor, aoMudar) {
  return campo(rotulo, valor, (v) => {
    aoMudar(v);
    definirDetalhe(obterDetalhe());
  });
}

function pintarDetalhe(bioma) {
  const detalhe = obterDetalhe();
  if (!detalhe) return;
  inspectorEl.append(tituloSecao("Portas do mundo"));
  const grama = detalhe.grama || (detalhe.grama = {});
  const arvore = detalhe.arvore || (detalhe.arvore = {});
  const mar = detalhe.mar || (detalhe.mar = {});
  inspectorEl.append(
    campoDetalhe("Grama limiar", grama.limiar, (v) => { grama.limiar = v; }),
    campoDetalhe("Grama densidade", grama.densidade, (v) => { grama.densidade = v; }),
    campoDetalhe("Grama escala", grama.escala, (v) => { grama.escala = v; }),
    campoDetalhe("Grama oitavas", grama.oitavas, (v) => { grama.oitavas = v; }),
    campoDetalhe("Grama semente", grama.semente, (v) => { grama.semente = v; }),
    campoDetalhe("Árvore limiar", arvore.limiar, (v) => { arvore.limiar = v; }),
    campoDetalhe("Árvore densidade", arvore.densidade, (v) => { arvore.densidade = v; }),
    campoDetalhe("Árvore escala", arvore.escala, (v) => { arvore.escala = v; }),
    campoDetalhe("Árvore oitavas", arvore.oitavas, (v) => { arvore.oitavas = v; }),
    campoDetalhe("Árvore semente", arvore.semente, (v) => { arvore.semente = v; }),
    campoDetalhe("Mar densidade", mar.densidade, (v) => { mar.densidade = v; }),
  );

  const id = bioma.id;
  const kit = obterKit(bioma.kit || id);
  const pesos = detalhe.pesosGrama || (detalhe.pesosGrama = {});
  const doBioma = pesos[id] || (pesos[id] = {});
  const gramas = kit?.grama || [];
  if (gramas.length) {
    inspectorEl.append(tituloSecao("Pesos da grama"));
    for (let i = 0; i < gramas.length; i++) {
      const sprite = gramas[i].id;
      if (!sprite) continue;
      const atual = Object.prototype.hasOwnProperty.call(doBioma, sprite) ? doBioma[sprite] : 1;
      inspectorEl.append(campoDetalhe(sprite, atual, (v) => { doBioma[sprite] = v; }));
    }
  }

  const ruido = detalhe.ruidoGrama?.[id];
  if (ruido) {
    const sprites = Object.keys(ruido);
    if (sprites.length) inspectorEl.append(tituloSecao("Ruído da grama"));
    for (let i = 0; i < sprites.length; i++) {
      const spec = ruido[sprites[i]];
      inspectorEl.append(
        campoDetalhe(`${sprites[i]} canal`, spec.canal, (v) => { spec.canal = v; }),
        campoDetalhe(`${sprites[i]} freq`, spec.freq, (v) => { spec.freq = v; }),
        campoDetalhe(`${sprites[i]} limiar`, spec.limiar, (v) => { spec.limiar = v; }),
        campoDetalhe(`${sprites[i]} oitavas`, spec.oitavas, (v) => { spec.oitavas = v; }),
      );
    }
  }

  const splat = (detalhe.splat || (detalhe.splat = {}))[id] || (detalhe.splat[id] = {});
  inspectorEl.append(tituloSecao("Mancha do chão"));
  inspectorEl.append(
    campoDetalhe("Canal", splat.canal, (v) => { splat.canal = v; }),
    campoDetalhe("Frequência", splat.freq, (v) => { splat.freq = v; }),
    campoDetalhe("Limiar", splat.limiar, (v) => { splat.limiar = v; }),
    campoDetalhe("Oitavas", splat.oitavas, (v) => { splat.oitavas = v; }),
  );

  const pedras = (detalhe.pedras || []).filter((p) => p.biomas?.includes(id));
  if (pedras.length) inspectorEl.append(tituloSecao("Pedras"));
  for (let i = 0; i < pedras.length; i++) {
    const pedra = pedras[i];
    inspectorEl.append(
      campoDetalhe(`${pedra.id} freq`, pedra.freq, (v) => { pedra.freq = v; }),
      campoDetalhe(`${pedra.id} limiar`, pedra.limiar, (v) => { pedra.limiar = v; }),
    );
  }
}

function pintarInspector() {
  const bioma = biomaAtual();
  inspectorEl.innerHTML = "";
  inspectorEl.append(
    campo("Nome", bioma.nome, (v) => {
      bioma.nome = v;
    }, "text"),
    campo("Cor", bioma.cor || "#5aaa45", (v) => {
      bioma.cor = v;
    }, "color"),
  );

  const sup = document.createElement("label");
  sup.className = "campo";
  sup.append(document.createTextNode("Superfície"));
  const select = document.createElement("select");
  for (const op of ["grama", "terra", "pedra"]) {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    if (bioma.superficie === op) o.selected = true;
    select.append(o);
  }
  select.addEventListener("change", () => {
    bioma.superficie = select.value;
  });
  sup.append(select);
  inspectorEl.append(sup);

  const kitLabel = document.createElement("label");
  kitLabel.className = "campo";
  kitLabel.append(document.createTextNode("Kit"));
  const kitSelect = document.createElement("select");
  const vazio = document.createElement("option");
  vazio.value = "";
  vazio.textContent = "(nenhum)";
  kitSelect.append(vazio);
  const ids = idsDeKit();
  if (bioma.kit && !ids.includes(bioma.kit)) ids.push(bioma.kit);
  for (const id of ids) {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = id;
    if (bioma.kit === id) o.selected = true;
    kitSelect.append(o);
  }
  kitSelect.addEventListener("change", () => {
    bioma.kit = kitSelect.value || null;
    pedirPreviews();
  });
  kitLabel.append(kitSelect);
  inspectorEl.append(kitLabel);

  inspectorEl.append(
    campo("Árvore (0–1)", bioma.arvore, (v) => {
      bioma.arvore = v;
    }),
    campo("Mata (0–1)", bioma.mata, (v) => {
      bioma.mata = v;
    }),
    campo("Transição (células)", bioma.transicao, (v) => {
      bioma.transicao = v;
    }),
    campo("Degrau da borda", bioma.degrau, (v) => {
      bioma.degrau = v;
    }),
  );

  pintarDetalhe(bioma);

  const no = bioma.nos.find((n) => n.id === noSelecionado);
  if (!no) return;
  const titulo = document.createElement("h2");
  titulo.textContent = ROTULOS[no.tipo] || no.tipo;
  titulo.style.fontSize = "0.95rem";
  inspectorEl.append(titulo);

  if (no.tipo === "perlin") {
    inspectorEl.append(
      campo("Escala", no.escala, (v) => { no.escala = v; }),
      campo("Escala U", no.escalaU, (v) => { no.escalaU = v; }),
      campo("Escala V", no.escalaV, (v) => { no.escalaV = v; }),
      campo("Oitavas", no.oitavas, (v) => { no.oitavas = v; }),
      campo("Persistência", no.persistencia, (v) => { no.persistencia = v; }),
      campo("Lacunarity", no.lacunarity, (v) => { no.lacunarity = v; }),
      campo("Offset X", no.offsetX, (v) => { no.offsetX = v; }),
      campo("Offset Y", no.offsetY, (v) => { no.offsetY = v; }),
      campo("Degraus", no.degraus, (v) => { no.degraus = v; }),
      campo("Amplitude", no.amplitude, (v) => { no.amplitude = v; }),
    );
  }
  if (no.tipo === "queda") {
    inspectorEl.append(
      campo("Centro U", no.centroU, (v) => { no.centroU = v; }),
      campo("Centro V", no.centroV, (v) => { no.centroV = v; }),
      campo("Raio interno", no.raioInterno, (v) => { no.raioInterno = v; }),
      campo("Raio externo", no.raioExterno, (v) => { no.raioExterno = v; }),
      campo("Expoente", no.expoente, (v) => { no.expoente = v; }),
    );
  }
  if (no.tipo === "mistura") {
    inspectorEl.append(campo("Mistura", no.mistura, (v) => { no.mistura = v; }));
  }
  if (no.tipo === "mascara") {
    inspectorEl.append(
      campo("Limiar", no.limiar, (v) => { no.limiar = v; }),
      campo("Suavidade", no.suavidade, (v) => { no.suavidade = v; }),
    );
  }
  if (no.tipo === "constante") {
    inspectorEl.append(campo("Valor", no.valor, (v) => { no.valor = v; }));
  }
  if (no.tipo === "ruido") {
    inspectorEl.append(
      campo("Frequência", no.frequencia, (v) => { no.frequencia = v; }),
      campo("Oitavas", no.oitavas, (v) => { no.oitavas = v; }),
      campo("Semente", no.semente, (v) => { no.semente = v; }),
      campo("Ganho", no.ganho, (v) => { no.ganho = v; }),
    );
  }
  if (no.tipo === "terraco") {
    inspectorEl.append(campo("Degrau", no.degrau, (v) => { no.degrau = v; }));
  }
  if (no.tipo === "achatar") {
    inspectorEl.append(
      campo("Alvo", no.alvo, (v) => { no.alvo = v; }),
      campo("Força", no.forca, (v) => { no.forca = v; }),
    );
  }
  if (no.tipo === "limitar") {
    inspectorEl.append(
      campo("Mínimo", no.minimo, (v) => { no.minimo = v; }),
      campo("Máximo", no.maximo, (v) => { no.maximo = v; }),
    );
  }
  if (no.tipo === "cratera") {
    inspectorEl.append(
      campo("Limiar", no.limiar, (v) => { no.limiar = v; }),
      campo("Profundidade", no.profundidade, (v) => { no.profundidade = v; }),
    );
  }
  if (no.tipo !== "saida") {
    const apagar = document.createElement("button");
    apagar.type = "button";
    apagar.textContent = "Apagar nó";
    apagar.addEventListener("click", () => {
      bioma.nos = bioma.nos.filter((n) => n.id !== no.id);
      bioma.ligacoes = (bioma.ligacoes || []).filter(
        (l) => l.de !== no.id && l.para !== no.id,
      );
      noSelecionado = null;
      pintarTudo();
    });
    inspectorEl.append(apagar);
  }
}

function pedirPreviews() {
  if (previewPedido) return;
  previewPedido = requestAnimationFrame(() => {
    previewPedido = 0;
    pintarPreviews();
  });
}

function pintarMiniatura(canvas, valores) {
  const w = canvas.width;
  const h = canvas.height;
  if (!valores || valores.length !== w * h) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const data = img.data;
  let min = valores[0];
  let max = valores[0];
  for (let i = 1; i < valores.length; i++) {
    const v = valores[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const faixa = max - min;
  const chapado = faixa < 0.00001;
  for (let i = 0; i < valores.length; i++) {
    const c = chapado ? 128 : Math.floor(20 + ((valores[i] - min) / faixa) * 220);
    const o = i * 4;
    data[o] = c;
    data[o + 1] = c;
    data[o + 2] = c;
    data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function pintarPreviews() {
  const seed = sementeAtual();
  const regiao = document.getElementById("prev-regiao");
  const relevo = document.getElementById("prev-relevo");
  const isolado = document.getElementById("prev-bioma");
  const ctxR = regiao.getContext("2d");
  const ctxH = relevo.getContext("2d");
  const ctxB = isolado.getContext("2d");
  const cel = 4;
  const passo = 8;
  const bioma = biomaAtual();
  for (let py = 0; py < regiao.height; py += cel) {
    for (let px = 0; px < regiao.width; px += cel) {
      const wx = (px - regiao.width / 2) * passo;
      const wy = (py - regiao.height / 2) * passo;
      const dom = biomaDominante(wx, wy, dados, seed);
      ctxR.fillStyle = dom?.cor || "#333";
      ctxR.fillRect(px, py, cel, cel);
      const h = alturaDoRelevo(wx, wy, dados, seed);
      const t = Math.max(0, Math.min(1, h / ALTURA_MAX_RELEVO));
      const c = Math.floor(30 + t * 210);
      ctxH.fillStyle = `rgb(${c},${Math.floor(c * 0.86)},${Math.floor(80 + t * 40)})`;
      ctxH.fillRect(px, py, cel, cel);
    }
  }
  let min = 99;
  let max = 1;
  const cols = Math.ceil(isolado.width / cel);
  const rows = Math.ceil(isolado.height / cel);
  const alturas = new Float32Array(cols * rows);
  for (let py = 0; py < rows; py++) {
    for (let px = 0; px < cols; px++) {
      const h = avaliarGrafo(bioma, px * 10, py * 10, seed, {
        metrosPorBloco: Number(dados.metrosPorBloco) || 48,
        metrosPorCelula: Number(dados.metrosPorCelula) || 1000,
      });
      alturas[py * cols + px] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  const faixa = Math.max(0.001, max - min);
  for (let py = 0; py < rows; py++) {
    for (let px = 0; px < cols; px++) {
      const t = (alturas[py * cols + px] - min) / faixa;
      const c = Math.floor(20 + t * 220);
      ctxB.fillStyle = `rgb(${c},${c},${c})`;
      ctxB.fillRect(px * cel, py * cel, cel, cel);
    }
  }
  const amostras = amostrarNos(
    bioma,
    PREVIA_NO_LADO,
    PREVIA_NO_LADO,
    seed,
    {
      metrosPorBloco: Number(dados.metrosPorBloco) || 48,
      metrosPorCelula: Number(dados.metrosPorCelula) || 1000,
    },
    {
      x: DEMO_3D.passo,
      y: DEMO_3D.passo,
      origemX: PREVIA_NO_ORIGEM,
      origemY: PREVIA_NO_ORIGEM,
    },
  );
  const miniaturas = nosEl.querySelectorAll("canvas.no__previa");
  for (let i = 0; i < miniaturas.length; i++) {
    const canvas = miniaturas[i];
    pintarMiniatura(canvas, amostras.get(canvas.dataset.previa));
  }
  atualizarPreviewBioma({
    bioma,
    catalogo: dados,
    seed,
  });
}

function pintarPaleta() {
  paletaEl.innerHTML = "";
  for (const tipo of Object.keys(PORTAS)) {
    if (tipo === "saida") continue;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = ROTULOS[tipo];
    botao.addEventListener("click", () => {
      biomaAtual().nos.push(criarNo(tipo));
      pintarTudo();
    });
    paletaEl.append(botao);
  }
}

function pintarTudo() {
  pintarLista();
  pintarNos();
  pintarInspector();
  requestAnimationFrame(() => pintarFios());
}

document.getElementById("salvar").addEventListener("click", async () => {
  definirStatus("Salvando…");
  try {
    const res = await fetch("/api/biomas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const corpo = await res.json();
    if (!res.ok || !corpo.ok) throw new Error(corpo.erro || "falha ao salvar");
    const detalhe = obterDetalhe();
    if (detalhe) {
      const resDetalhe = await fetch("/api/detalhe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detalhe),
      });
      const corpoDetalhe = await resDetalhe.json();
      if (!resDetalhe.ok || !corpoDetalhe.ok) throw new Error(corpoDetalhe.erro || "falha ao salvar o detalhe");
    }
    definirStatus("Salvo em biomas/mundo.json e biomas/detalhe.json. Recarrega o jogo.");
  } catch (erro) {
    definirStatus(String(erro.message || erro));
  }
});

document.getElementById("novo-bioma").addEventListener("click", () => {
  const base = biomaAtual();
  const copia = JSON.parse(JSON.stringify(base));
  copia.id = idNovo();
  copia.nome = `${base.nome} cópia`;
  dados.biomas.push(copia);
  indice = dados.biomas.length - 1;
  noSelecionado = null;
  pintarTudo();
});

document.getElementById("apagar-bioma").addEventListener("click", () => {
  if (dados.biomas.length < 2) return;
  dados.biomas.splice(indice, 1);
  indice = Math.max(0, indice - 1);
  noSelecionado = null;
  pintarTudo();
});

escalaEl.addEventListener("input", () => {
  dados.escalaRegiao = Math.max(32, Number(escalaEl.value) || 220);
  pedirPreviews();
});

window.addEventListener("keydown", (ev) => {
  if (ev.key !== "Delete" && ev.key !== "Backspace") return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT") return;
  const bioma = biomaAtual();
  const no = bioma.nos.find((n) => n.id === noSelecionado);
  if (!no || no.tipo === "saida") return;
  bioma.nos = bioma.nos.filter((n) => n.id !== no.id);
  bioma.ligacoes = (bioma.ligacoes || []).filter(
    (l) => l.de !== no.id && l.para !== no.id,
  );
  noSelecionado = null;
  pintarTudo();
});

await carregarKits();
await carregarDetalhe();
try {
  await iniciarPreviewBioma(document.getElementById("prev-3d"));
} catch (erro) {
  console.error(erro);
  definirStatus("Prévia 3D indisponível.");
}
const resposta = await fetch("biomas/mundo.json", { cache: "no-store" });
dados = await resposta.json();
pintarPaleta();
pintarTudo();
