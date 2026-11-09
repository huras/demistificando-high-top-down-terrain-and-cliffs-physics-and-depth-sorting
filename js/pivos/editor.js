import { CAMINHOS, JOGADOR_ESCALA, JOGADOR_FRAME, TILE } from "../config.js";
import { blitQuadro, garantirAtlas } from "../pokemon/sprites.js";
import { pivoDoFrame } from "../render/pivoPe.js";
import {
  ASSENTOS_PADRAO,
  definirAssentoRide,
  definirEstadoRideAssentos,
  estadoRideAssentos,
  garantirRideAssentos,
  obterAssentoRide,
} from "../jogo/rideAssentos.js";

const CHAVE_JOGADOR = "jogador";
const JOGADOR = Object.freeze({
  key: CHAVE_JOGADOR,
  nome: "Jogador",
  dex: 0,
  escala: JOGADOR_ESCALA,
});
const LINHA_JOGADOR = Object.freeze({ 0: 0, 2: 1, 6: 2, 4: 3 });
const CICLO_ANDAR = [0, 1, 0, 3];
const ZOOM = 6;
const PREVIEW_KEY = "pivos.previewMode";
const PREVIEWS = new Set(["livre", "comparar", "montaria"]);
const ORDEM_ANIMS = Object.freeze([
  "Idle",
  "Walk",
  "Attack",
  "Strike",
  "Shoot",
  "Hurt",
  "Sleep",
  "FlapAround",
  "Hover",
  "Hop",
  "Float",
]);
const LABEL_ANIM = Object.freeze({
  Idle: "Parado",
  Walk: "Andando",
  Attack: "Ataque",
  Strike: "Golpe",
  Shoot: "Tiro",
  Hurt: "Ferido",
  Sleep: "Sono",
  FlapAround: "Voo",
  Hover: "Pairar",
  Hop: "Pulo",
  Float: "Flutuar",
});
const ANIMS_JOGADOR = new Set(["Idle", "Walk"]);

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista-pokemon");
const buscaEl = document.getElementById("busca");
const salvarEl = document.getElementById("salvar");
const offsetEl = document.getElementById("offset");
const offsetNumEl = document.getElementById("offset-num");
const offsetValorEl = document.getElementById("offset-valor");
const coordsEl = document.getElementById("coords");
const escalaEl = document.getElementById("escala");
const escalaNumEl = document.getElementById("escala-num");
const escalaValorEl = document.getElementById("escala-valor");
const escalaBaseEl = document.getElementById("escala-base");
const painelMontaria = document.getElementById("painel-montaria");
const montariaAviso = document.getElementById("montaria-aviso");
const montariaControles = document.getElementById("montaria-controles");
const seatXEl = document.getElementById("seat-x");
const seatYEl = document.getElementById("seat-y");
const seatElevEl = document.getElementById("seat-elev");
const seatXNumEl = document.getElementById("seat-x-num");
const seatYNumEl = document.getElementById("seat-y-num");
const seatElevNumEl = document.getElementById("seat-elev-num");
const seatXValor = document.getElementById("seat-x-valor");
const seatYValor = document.getElementById("seat-y-valor");
const seatElevValor = document.getElementById("seat-elev-valor");
const seatCoords = document.getElementById("seat-coords");
const faixasEl = document.getElementById("faixas");
const dirsEl = document.getElementById("dirs");
const canvas = document.getElementById("vista");
const ctx = canvas.getContext("2d");

let arquivo = {};
let especies = [];
let imgJogador = null;
let escolhida = null;
let faixa = "Idle";
let dir = 0;
let frame = 0;
let frameT = 0;
let passoAndar = 0;
let ultimo = performance.now();
let arraste = null;
let arrasteAssento = null;
let modoAssento = "ride";
let modoPreview = "livre";
let avisoSprite = "";
let vistaW = 1;
let vistaH = 1;
let sujo = false;
let chipsKey = "";
function dizer(texto) {
  statusEl.textContent = texto;
}

function marcarSujo(v = true) {
  sujo = !!v;
  salvarEl.classList.toggle("sujo", sujo);
  salvarEl.textContent = sujo ? "Salvar ·" : "Salvar";
}

function celula(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(-4, Math.min(4, v)) * 100) / 100;
}

function pixel(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(-256, Math.min(256, v)));
}

function escalaNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(Math.max(0.05, Math.min(4, v)) * 100) / 100;
}

function escalaCatalogo(esp) {
  if (ehJogador(esp)) return JOGADOR_ESCALA;
  const s = Number(esp?.escalaCatalogo ?? esp?.escala);
  return s > 0 ? s : 1;
}

function escalaDa(esp) {
  if (!esp) return 1;
  if (ehJogador(esp)) return JOGADOR_ESCALA;
  const aj = leitura(esp);
  if (aj.escala > 0) return aj.escala;
  return escalaCatalogo(esp);
}

function ehJogador(esp) {
  return esp?.key === CHAVE_JOGADOR;
}

function temAssentoSalvo(key) {
  return !!estadoRideAssentos()[key];
}

function temEscalaSalva(key) {
  const item = arquivo[key];
  return !!(item && Number.isFinite(Number(item.escala)) && Number(item.escala) > 0);
}

function leitura(esp) {
  const salvo = esp ? arquivo[esp.key] : null;
  if (salvo) {
    return {
      offsetY: celula(salvo.offsetY),
      dx: pixel(salvo.dx),
      dy: pixel(salvo.dy),
      escala: escalaNum(salvo.escala),
    };
  }
  return { offsetY: celula(esp?.offsetY), dx: 0, dy: 0, escala: 0 };
}

function publicar(esp, ajuste) {
  if (!esp) return;
  const base = celula(esp.offsetY);
  const cat = escalaCatalogo(esp);
  const esc = escalaNum(ajuste.escala);
  const igualBase =
    ajuste.dx === 0 &&
    ajuste.dy === 0 &&
    ajuste.offsetY === base &&
    (!esc || Math.abs(esc - cat) < 0.005);
  if (igualBase) delete arquivo[esp.key];
  else {
    const out = { offsetY: ajuste.offsetY, dx: ajuste.dx, dy: ajuste.dy };
    if (esc && Math.abs(esc - cat) >= 0.005) out.escala = esc;
    arquivo[esp.key] = out;
  }
  coordsEl.textContent = `dx ${ajuste.dx} · dy ${ajuste.dy}`;
  atualizarMarcasLista(esp.key);
  marcarSujo(true);
}

function atualizarMarcasLista(key) {
  const btn = listaEl.querySelector(`button[data-key="${CSS.escape(key)}"]`);
  if (!btn) return;
  const marcas = btn.querySelector(".lista__marcas");
  if (!marcas) return;
  preencherMarcas(marcas, key);
}

function preencherMarcas(marcas, key) {
  marcas.replaceChildren();
  if (arquivo[key]) {
    const s = document.createElement("span");
    s.className = "lista__marca--pivo";
    s.textContent = "·";
    s.title = "pivô ajustado";
    marcas.appendChild(s);
  }
  if (temEscalaSalva(key)) {
    const s = document.createElement("span");
    s.className = "lista__marca--escala";
    s.textContent = "◈";
    s.title = "escala ajustada";
    marcas.appendChild(s);
  }
  if (key !== CHAVE_JOGADOR && temAssentoSalvo(key)) {
    const s = document.createElement("span");
    s.className = "lista__marca--assento";
    s.textContent = "★";
    s.title = "assento salvo";
    marcas.appendChild(s);
  }
}

function botaoLista(esp) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.key = esp.key;
  const nome = document.createElement("span");
  nome.className = "lista__nome";
  nome.textContent = ehJogador(esp) ? "Jogador" : `#${esp.dex} ${esp.nome || esp.key}`;
  const marcas = document.createElement("span");
  marcas.className = "lista__marcas";
  preencherMarcas(marcas, esp.key);
  btn.append(nome, marcas);
  if (esp.key === escolhida?.key) btn.classList.add("ativo");
  li.appendChild(btn);
  return li;
}

function pintarListas() {
  const q = buscaEl.value.trim().toLowerCase();
  const frag = document.createDocumentFragment();
  if (!q || "jogador".includes(q)) frag.appendChild(botaoLista(JOGADOR));
  let mostrados = 0;
  for (let i = 0; i < especies.length && mostrados < 80; i++) {
    const esp = especies[i];
    const nome = `${esp.nome || esp.key} ${esp.dex} ${esp.key}`.toLowerCase();
    const tem = !!arquivo[esp.key];
    if (q && !nome.includes(q)) continue;
    if (!q && !tem && mostrados >= 40 && esp.key !== escolhida?.key) continue;
    frag.appendChild(botaoLista(esp));
    mostrados++;
  }
  listaEl.replaceChildren(frag);
}

function sincronizarOffset(aj) {
  const limite = Math.max(3, Math.ceil(Math.abs(aj.offsetY)));
  offsetEl.min = String(-limite);
  offsetEl.max = String(limite);
  offsetEl.value = String(aj.offsetY);
  offsetNumEl.value = String(aj.offsetY);
  offsetValorEl.textContent = aj.offsetY.toFixed(2);
  coordsEl.textContent = `dx ${aj.dx} · dy ${aj.dy}`;
}

function sincronizarEscala(esp) {
  const cat = escalaCatalogo(esp);
  const efetiva = escalaDa(esp);
  escalaEl.value = String(efetiva);
  escalaNumEl.value = String(efetiva);
  escalaValorEl.textContent = efetiva.toFixed(2);
  escalaBaseEl.textContent = `catálogo ${cat.toFixed(2)} · jogador ${JOGADOR_ESCALA.toFixed(2)}`;
  const travado = ehJogador(esp);
  escalaEl.disabled = travado;
  escalaNumEl.disabled = travado;
  document.getElementById("escala-reset").disabled = travado;
}

function mostrarControles(esp) {
  const aj = leitura(esp);
  sincronizarOffset(aj);
  sincronizarEscala(esp);
}

function leituraAssento(esp) {
  if (!esp || ehJogador(esp)) return { ...ASSENTOS_PADRAO[modoAssento] };
  return obterAssentoRide(esp.key, modoAssento);
}

function publicarAssento(esp, seat) {
  if (!esp || ehJogador(esp)) return;
  definirAssentoRide(esp.key, modoAssento, seat);
  seatCoords.textContent = `assento ${seat.x.toFixed(2)}, ${seat.y.toFixed(2)} · elev ${seat.elev.toFixed(2)}`;
  atualizarMarcasLista(esp.key);
  marcarSujo(true);
}

function mostrarAssento(esp) {
  const ehMon = !!(esp && !ehJogador(esp));
  painelMontaria.classList.toggle("painel-aba--jogador", !ehMon);
  const seat = leituraAssento(esp);
  seatXEl.value = String(seat.x);
  seatYEl.value = String(seat.y);
  seatElevEl.value = String(seat.elev);
  seatXNumEl.value = String(seat.x);
  seatYNumEl.value = String(seat.y);
  seatElevNumEl.value = String(seat.elev);
  seatXValor.textContent = seat.x.toFixed(2);
  seatYValor.textContent = seat.y.toFixed(2);
  seatElevValor.textContent = seat.elev.toFixed(2);
  seatCoords.textContent = `assento ${seat.x.toFixed(2)}, ${seat.y.toFixed(2)} · elev ${seat.elev.toFixed(2)}`;
  for (const btn of document.querySelectorAll("#modos-assento button")) {
    btn.classList.toggle("ativo", btn.dataset.modo === modoAssento);
  }
  atualizarGateMontaria();
}

function atualizarGateMontaria() {
  const ehMon = !!(escolhida && !ehJogador(escolhida));
  const ativo = ehMon && modoPreview === "montaria";
  painelMontaria.classList.toggle("painel-aba--travado", ehMon && !ativo);
  montariaAviso.hidden = !ehMon || ativo;
  if (!ehMon) {
    montariaAviso.hidden = false;
    montariaAviso.innerHTML = "Selecione um Pokémon para editar o assento de montaria.";
  } else if (!ativo) {
    montariaAviso.innerHTML =
      'Ative o modo <strong>Montaria</strong> no palco para editar o assento com preview.';
  }
}

function carregarPreviewSalvo() {
  try {
    const v = localStorage.getItem(PREVIEW_KEY);
    if (PREVIEWS.has(v)) return v;
  } catch {
    /* ignore */
  }
  return "livre";
}

function salvarPreview(modo) {
  modoPreview = modo;
  try {
    localStorage.setItem(PREVIEW_KEY, modo);
  } catch {
    /* ignore */
  }
  for (const btn of document.querySelectorAll("#modos-preview button")) {
    btn.classList.toggle("ativo", btn.dataset.preview === modo);
  }
  atualizarGateMontaria();
}

function ativarAba(id) {
  for (const btn of document.querySelectorAll("#abas button")) {
    const on = btn.dataset.aba === id;
    btn.classList.toggle("ativo", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  }
  for (const painel of document.querySelectorAll(".painel-aba")) {
    painel.hidden = painel.dataset.painel !== id;
  }
}

function animsDisponiveis(pack) {
  if (ehJogador(escolhida)) return [...ANIMS_JOGADOR];
  if (!pack?.anims) return ["Idle"];
  const out = [];
  for (let i = 0; i < ORDEM_ANIMS.length; i++) {
    const nome = ORDEM_ANIMS[i];
    if (pack.anims[nome]) out.push(nome);
  }
  return out.length ? out : ["Idle"];
}

function pintarChips(pack) {
  const disponiveis = animsDisponiveis(pack);
  const key = `${escolhida?.key || ""}:${disponiveis.join(",")}`;
  if (key === chipsKey) {
    for (const btn of faixasEl.querySelectorAll("button")) {
      btn.classList.toggle("ativo", btn.dataset.faixa === faixa);
    }
    return;
  }
  chipsKey = key;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < disponiveis.length; i++) {
    const nome = disponiveis[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.faixa = nome;
    btn.textContent = LABEL_ANIM[nome] || nome;
    if (nome === faixa) btn.classList.add("ativo");
    frag.appendChild(btn);
  }
  faixasEl.replaceChildren(frag);
  if (!disponiveis.includes(faixa)) {
    faixa = disponiveis[0] || "Idle";
    frame = 0;
    frameT = 0;
    passoAndar = 0;
    for (const btn of faixasEl.querySelectorAll("button")) {
      btn.classList.toggle("ativo", btn.dataset.faixa === faixa);
    }
  }
}

function ajustarDirs() {
  dirsEl.classList.toggle("dirs--jogador", ehJogador(escolhida));
  if (!ehJogador(escolhida)) return;
  if (LINHA_JOGADOR[dir] == null) {
    dir = 0;
    for (const item of dirsEl.querySelectorAll("button")) {
      item.classList.toggle("ativo", item.dataset.dir === "0");
    }
  }
}

function escolher(key) {
  const esp = key === CHAVE_JOGADOR ? JOGADOR : especies.find((item) => item.key === key);
  if (!esp) return;
  escolhida = esp;
  avisoSprite = "";
  chipsKey = "";
  frame = 0;
  frameT = 0;
  passoAndar = 0;
  arrasteAssento = null;
  if (!ehJogador(esp)) garantirAtlas(esp.dex, false);
  ajustarDirs();
  mostrarControles(esp);
  mostrarAssento(esp);
  pintarListas();
  dizer(`${esp.nome || esp.key} · escala ${escalaDa(esp).toFixed(2)}`);
}

function quadroAtual(pack) {
  if (!pack?.quadros) return null;
  const nome = pack.anims?.[faixa] ? faixa : "Idle";
  return (
    pack.quadros.get(`${nome}:${dir}:${frame}`) ||
    pack.quadros.get(`${nome}:0:${frame}`) ||
    pack.quadros.get(`${nome}:0:0`) ||
    pack.quadros.get("Idle:0:0")
  );
}

function avancarPose(pack, dt) {
  const nome = pack?.anims?.[faixa] ? faixa : "Idle";
  const spec = pack?.anims?.[nome];
  if (!spec) return;
  const n = spec.frameCount || 1;
  if (frame >= n) frame = 0;
  const dur = (spec.durations?.[frame] || spec.durations?.[0] || 80) / 1000;
  frameT += dt;
  if (frameT < dur) return;
  frameT = 0;
  frame = (frame + 1) % n;
}

function avancarJogador(dt) {
  if (faixa !== "Walk") {
    frame = 0;
    passoAndar = 0;
    return;
  }
  frameT += dt;
  if (frameT < 0.12) return;
  frameT = 0;
  passoAndar = (passoAndar + 1) % CICLO_ANDAR.length;
  frame = CICLO_ANDAR[passoAndar];
}

function desenharCruz(x, y, cor = "#ffcc66") {
  ctx.save();
  ctx.strokeStyle = "#1a120c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x + 12, y);
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x, y + 12);
  ctx.stroke();
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function pontoAssentoPreview(peX, peY, seat) {
  const cell = TILE * ZOOM;
  return {
    x: peX + seat.x * cell,
    y: peY + seat.y * cell - seat.elev * cell,
  };
}

function peCanvas() {
  const peX = vistaW * 0.5;
  const chaoY = vistaH * 0.72;
  const aj = leitura(escolhida);
  const peY = chaoY + aj.offsetY * TILE * ZOOM;
  return { peX, peY, chaoY };
}

function desenharJogador(peX, peY, aj) {
  if (!imgJogador) return;
  const linha = LINHA_JOGADOR[dir] ?? 0;
  const col = faixa === "Walk" ? frame : 0;
  const pivo = pivoDoFrame(imgJogador, col, linha, JOGADOR_FRAME);
  const esc = ZOOM * JOGADOR_ESCALA;
  const lado = JOGADOR_FRAME * esc;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    imgJogador,
    col * JOGADOR_FRAME,
    linha * JOGADOR_FRAME,
    JOGADOR_FRAME,
    JOGADOR_FRAME,
    peX + aj.dx * esc - pivo.x * lado,
    peY + aj.dy * esc - pivo.y * lado,
    lado,
    lado,
  );
}

function desenharChao(chaoY, peX, peY) {
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
  ctx.beginPath();
  ctx.ellipse(peX, chaoY, 36, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7dce6a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, chaoY);
  ctx.lineTo(vistaW - 24, chaoY);
  ctx.stroke();
  if (Math.abs(peY - chaoY) > 0.5) {
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(peX, chaoY);
    ctx.lineTo(peX, peY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#93a89a";
  ctx.font = "13px Segoe UI, sans-serif";
  ctx.fillText("chão", 28, chaoY - 8);
  ctx.restore();
}

function desenhar() {
  ctx.clearRect(0, 0, vistaW, vistaH);
  ctx.fillStyle = "#121814";
  ctx.fillRect(0, 0, vistaW, vistaH);

  const esp = escolhida;
  if (!esp) return;
  const aj = leitura(esp);
  const chaoY = vistaH * 0.72;
  const peX = vistaW * 0.5;
  const peY = chaoY + aj.offsetY * TILE * ZOOM;

  desenharChao(chaoY, peX, peY);

  if (ehJogador(esp)) {
    desenharJogador(peX, peY, aj);
    desenharCruz(peX, peY);
    return;
  }

  const pack = garantirAtlas(esp.dex, false);
  pintarChips(pack);
  const fr = quadroAtual(pack);
  if (fr && pack?.img && pack.estado === "pronto") {
    ctx.imageSmoothingEnabled = false;
    blitQuadro(ctx, pack.img, pack.atlasW, pack.atlasH, fr, peX, peY, ZOOM * escalaDa(esp), aj);
  }

  if (modoPreview === "comparar") {
    const gap = Math.min(TILE * ZOOM * 2.2, Math.max(48, vistaW * 0.28));
    const ajJog = leitura(JOGADOR);
    const peJogY = chaoY + ajJog.offsetY * TILE * ZOOM;
    desenharJogador(peX - gap, peJogY, ajJog);
    desenharCruz(peX - gap, peJogY, "#a7f3d0");
  } else if (modoPreview === "montaria") {
    const seat = leituraAssento(esp);
    const rider = pontoAssentoPreview(peX, peY, seat);
    const ajJog = leitura(JOGADOR);
    desenharJogador(rider.x, rider.y, ajJog);
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(peX, peY);
    ctx.lineTo(rider.x, rider.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    desenharCruz(rider.x, rider.y, "#38bdf8");
  }

  desenharCruz(peX, peY);
}

function redimensionar() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  vistaW = Math.max(1, r.width);
  vistaH = Math.max(1, r.height);
  const bw = Math.round(vistaW * dpr);
  const bh = Math.round(vistaH * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function quadro(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;
  redimensionar();
  if (ehJogador(escolhida)) {
    pintarChips(null);
    avancarJogador(dt);
    desenhar();
    requestAnimationFrame(quadro);
    return;
  }
  const pack = escolhida ? garantirAtlas(escolhida.dex, false) : null;
  if (pack?.estado === "pronto") {
    pintarChips(pack);
    avancarPose(pack, dt);
  } else if (pack?.estado === "falhou" && escolhida && avisoSprite !== escolhida.key) {
    avisoSprite = escolhida.key;
    dizer(`${escolhida.nome || escolhida.key} sem sprite.`);
    pintarChips(null);
  }
  desenhar();
  requestAnimationFrame(quadro);
}

function pointerPertoAssento(clientX, clientY) {
  if (modoPreview !== "montaria" || !escolhida || ehJogador(escolhida)) return false;
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * vistaW;
  const y = ((clientY - rect.top) / rect.height) * vistaH;
  const { peX, peY } = peCanvas();
  const rider = pontoAssentoPreview(peX, peY, leituraAssento(escolhida));
  return Math.hypot(x - rider.x, y - rider.y) <= 28;
}

function aplicarOffset(valor) {
  if (!escolhida) return;
  const aj = leitura(escolhida);
  aj.offsetY = celula(valor);
  sincronizarOffset(aj);
  publicar(escolhida, aj);
}

function aplicarEscala(valor) {
  if (!escolhida || ehJogador(escolhida)) return;
  const aj = leitura(escolhida);
  aj.escala = escalaNum(valor);
  publicar(escolhida, aj);
  sincronizarEscala(escolhida);
  dizer(`${escolhida.nome || escolhida.key} · escala ${escalaDa(escolhida).toFixed(2)}`);
}

listaEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.key) return;
  escolher(btn.dataset.key);
});

buscaEl.addEventListener("input", pintarListas);

document.getElementById("abas").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-aba]");
  if (!btn) return;
  ativarAba(btn.dataset.aba);
});

offsetEl.addEventListener("input", () => aplicarOffset(offsetEl.value));
offsetNumEl.addEventListener("change", () => aplicarOffset(offsetNumEl.value));
escalaEl.addEventListener("input", () => aplicarEscala(escalaEl.value));
escalaNumEl.addEventListener("change", () => aplicarEscala(escalaNumEl.value));

document.getElementById("escala-reset").addEventListener("click", () => {
  if (!escolhida || ehJogador(escolhida)) return;
  const aj = leitura(escolhida);
  aj.escala = 0;
  publicar(escolhida, aj);
  sincronizarEscala(escolhida);
  dizer(`${escolhida.nome || escolhida.key} · escala ${escalaDa(escolhida).toFixed(2)}`);
});

faixasEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.faixa || btn.disabled) return;
  faixa = btn.dataset.faixa;
  frame = 0;
  frameT = 0;
  passoAndar = 0;
  for (const item of faixasEl.querySelectorAll("button")) {
    item.classList.toggle("ativo", item === btn);
  }
});

dirsEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.dir || btn.hidden) return;
  dir = Number(btn.dataset.dir) || 0;
  frame = 0;
  frameT = 0;
  passoAndar = 0;
  for (const item of dirsEl.querySelectorAll("button")) {
    item.classList.toggle("ativo", item === btn);
  }
});

document.getElementById("modos-preview").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-preview]");
  if (!btn || !PREVIEWS.has(btn.dataset.preview)) return;
  salvarPreview(btn.dataset.preview);
  if (btn.dataset.preview === "montaria" && escolhida && !ehJogador(escolhida)) {
    ativarAba("montaria");
  } else if (btn.dataset.preview === "comparar") {
    ativarAba("tamanho");
  }
});

canvas.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0 || !escolhida) return;
  if (pointerPertoAssento(ev.clientX, ev.clientY)) {
    const seat = leituraAssento(escolhida);
    arrasteAssento = {
      x: ev.clientX,
      y: ev.clientY,
      seatX: seat.x,
      seatY: seat.y,
      elev: seat.elev,
    };
    canvas.classList.add("arrastando");
    canvas.setPointerCapture(ev.pointerId);
    return;
  }
  const aj = leitura(escolhida);
  arraste = { x: ev.clientX, y: ev.clientY, dx: aj.dx, dy: aj.dy };
  canvas.classList.add("arrastando");
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove", (ev) => {
  if (arrasteAssento && escolhida && !ehJogador(escolhida) && modoPreview === "montaria") {
    const cell = TILE * ZOOM;
    const dx = (ev.clientX - arrasteAssento.x) / cell;
    const dy = (ev.clientY - arrasteAssento.y) / cell;
    let seatX = celula(arrasteAssento.seatX + dx);
    let seatY = celula(arrasteAssento.seatY + (ev.shiftKey ? 0 : dy));
    let elev = celula(arrasteAssento.elev + (ev.shiftKey ? -dy : 0));
    seatX = Math.max(-1.5, Math.min(1.5, seatX));
    seatY = Math.max(-1.5, Math.min(1.5, seatY));
    elev = Math.max(0, Math.min(2, elev));
    publicarAssento(escolhida, { x: seatX, y: seatY, elev });
    mostrarAssento(escolhida);
    return;
  }
  if (!arraste || !escolhida) return;
  const esc = ZOOM * escalaDa(escolhida);
  const aj = leitura(escolhida);
  aj.dx = pixel(arraste.dx + (ev.clientX - arraste.x) / esc);
  aj.dy = pixel(arraste.dy + (ev.clientY - arraste.y) / esc);
  publicar(escolhida, aj);
});

canvas.addEventListener("pointerup", () => {
  arraste = null;
  arrasteAssento = null;
  canvas.classList.remove("arrastando");
});

document.getElementById("modos-assento").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.modo) return;
  modoAssento = btn.dataset.modo;
  mostrarAssento(escolhida);
});

function aoSliderAssento() {
  if (!escolhida || ehJogador(escolhida)) return;
  const seat = {
    x: celula(seatXEl.value),
    y: celula(seatYEl.value),
    elev: celula(seatElevEl.value),
  };
  publicarAssento(escolhida, seat);
  mostrarAssento(escolhida);
}

function ligarParAssento(range, num) {
  range.addEventListener("input", () => {
    num.value = range.value;
    aoSliderAssento();
  });
  num.addEventListener("change", () => {
    range.value = num.value;
    aoSliderAssento();
  });
}

ligarParAssento(seatXEl, seatXNumEl);
ligarParAssento(seatYEl, seatYNumEl);
ligarParAssento(seatElevEl, seatElevNumEl);

salvarEl.addEventListener("click", async () => {
  dizer("Salvando…");
  const [resPivo, resSeat] = await Promise.all([
    fetch("/api/pivos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arquivo),
    }),
    fetch("/api/ride-assentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(estadoRideAssentos()),
    }),
  ]);
  const jsonPivo = await resPivo.json().catch(() => ({}));
  const jsonSeat = await resSeat.json().catch(() => ({}));
  if (!resPivo.ok) {
    dizer(jsonPivo.erro || "Não salvou pivôs.");
    return;
  }
  if (!resSeat.ok) {
    dizer(jsonSeat.erro || "Não salvou assentos.");
    return;
  }
  marcarSujo(false);
  const n = Object.keys(arquivo).length;
  const a = Object.keys(estadoRideAssentos()).length;
  dizer(`Salvo. ${n} pivô${n === 1 ? "" : "s"} · ${a} assento${a === 1 ? "" : "s"}.`);
});

function aceitarArquivo(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return;
  const chaves = Object.keys(json);
  for (let i = 0; i < chaves.length; i++) {
    const item = json[chaves[i]];
    if (!item || typeof item !== "object") continue;
    const out = {
      offsetY: celula(item.offsetY),
      dx: pixel(item.dx),
      dy: pixel(item.dy),
    };
    const esc = escalaNum(item.escala);
    if (esc) out.escala = esc;
    arquivo[chaves[i]] = out;
  }
}

async function iniciar() {
  modoPreview = carregarPreviewSalvo();
  salvarPreview(modoPreview);
  ativarAba("pivo");

  const [pivoRes, pokeRes, seatRes] = await Promise.all([
    fetch("/assets/pokemon/pivos.json"),
    fetch("/ref/catalogo.json"),
    garantirRideAssentos().then(() =>
      fetch("/assets/pokemon/ride-assentos.json", { cache: "no-store" }),
    ),
  ]);
  if (pivoRes.ok) aceitarArquivo(await pivoRes.json());
  if (seatRes.ok) {
    const seatJson = await seatRes.json();
    definirEstadoRideAssentos(seatJson);
  }
  if (!pokeRes.ok) throw new Error("catálogo de pokémon indisponível");
  const json = await pokeRes.json();
  const mapa = json.especies || {};
  especies = Object.keys(mapa)
    .map((key) => {
      const esp = mapa[key];
      if (!esp || !esp.key) return null;
      // preserva escala do catálogo para reset / comparação
      esp.escalaCatalogo = Number(esp.escala) > 0 ? Number(esp.escala) : 1;
      return esp;
    })
    .filter(Boolean)
    .sort((a, b) => (a.dex | 0) - (b.dex | 0));
  pintarListas();
  escolher(CHAVE_JOGADOR);
  const img = new Image();
  img.onload = () => {
    imgJogador = img;
  };
  img.src = CAMINHOS.jogador;
  window.addEventListener("resize", redimensionar);
  requestAnimationFrame(quadro);
}

iniciar().catch((erro) => dizer(String(erro.message || erro)));
