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

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista-pokemon");
const buscaEl = document.getElementById("busca");
const offsetEl = document.getElementById("offset");
const offsetValorEl = document.getElementById("offset-valor");
const coordsEl = document.getElementById("coords");
const painelAssento = document.getElementById("painel-assento");
const seatXEl = document.getElementById("seat-x");
const seatYEl = document.getElementById("seat-y");
const seatElevEl = document.getElementById("seat-elev");
const seatXValor = document.getElementById("seat-x-valor");
const seatYValor = document.getElementById("seat-y-valor");
const seatElevValor = document.getElementById("seat-elev-valor");
const seatCoords = document.getElementById("seat-coords");
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
let ultimo = performance.now();
let arraste = null;
let arrasteAssento = null;
let modoAssento = "ride";
let avisoSprite = "";
let vistaW = 1;
let vistaH = 1;

function dizer(texto) {
  statusEl.textContent = texto;
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

function escalaDa(esp) {
  const s = Number(esp?.escala);
  return s > 0 ? s : 1;
}

function leitura(esp) {
  const salvo = esp ? arquivo[esp.key] : null;
  if (salvo) {
    return { offsetY: celula(salvo.offsetY), dx: pixel(salvo.dx), dy: pixel(salvo.dy) };
  }
  return { offsetY: celula(esp?.offsetY), dx: 0, dy: 0 };
}

function publicar(esp, ajuste) {
  const base = celula(esp.offsetY);
  if (ajuste.dx === 0 && ajuste.dy === 0 && ajuste.offsetY === base) delete arquivo[esp.key];
  else arquivo[esp.key] = { offsetY: ajuste.offsetY, dx: ajuste.dx, dy: ajuste.dy };
  coordsEl.textContent = `dx ${ajuste.dx}    dy ${ajuste.dy}`;
  const btn = listaEl.querySelector(`button[data-key="${CSS.escape(esp.key)}"]`);
  if (btn) btn.classList.toggle("tem-ajuste", !!arquivo[esp.key]);
}

function mostrarControles(esp) {
  const aj = leitura(esp);
  const limite = Math.max(3, Math.ceil(Math.abs(aj.offsetY)));
  offsetEl.min = String(-limite);
  offsetEl.max = String(limite);
  offsetEl.value = String(aj.offsetY);
  offsetValorEl.textContent = aj.offsetY.toFixed(2);
  coordsEl.textContent = `dx ${aj.dx}    dy ${aj.dy}`;
}

function ehJogador(esp) {
  return esp?.key === CHAVE_JOGADOR;
}

function temAssentoSalvo(key) {
  return !!estadoRideAssentos()[key];
}

function botaoLista(esp) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.key = esp.key;
  btn.textContent = ehJogador(esp) ? "Jogador" : `#${esp.dex} ${esp.nome || esp.key}`;
  if (esp.key === escolhida?.key) btn.classList.add("ativo");
  if (arquivo[esp.key]) btn.classList.add("tem-ajuste");
  if (!ehJogador(esp) && temAssentoSalvo(esp.key)) btn.classList.add("tem-assento");
  li.appendChild(btn);
  return li;
}

function pintarListas() {
  const q = buscaEl.value.trim().toLowerCase();
  const frag = document.createDocumentFragment();
  const nomeJogador = "jogador";
  if (!q || nomeJogador.includes(q)) frag.appendChild(botaoLista(JOGADOR));
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

function ajustarDirs() {
  document.getElementById("dirs").classList.toggle("dirs--jogador", ehJogador(escolhida));
  if (!ehJogador(escolhida)) return;
  if (LINHA_JOGADOR[dir] == null) {
    dir = 0;
    for (const item of document.querySelectorAll("#dirs button")) {
      item.classList.toggle("ativo", item.dataset.dir === "0");
    }
  }
}

function leituraAssento(esp) {
  if (!esp || ehJogador(esp)) return { ...ASSENTOS_PADRAO[modoAssento] };
  return obterAssentoRide(esp.key, modoAssento);
}

function publicarAssento(esp, seat) {
  if (!esp || ehJogador(esp)) return;
  definirAssentoRide(esp.key, modoAssento, seat);
  seatCoords.textContent = `assento ${seat.x.toFixed(2)}, ${seat.y.toFixed(2)} · elev ${seat.elev.toFixed(2)}`;
  const btn = listaEl.querySelector(`button[data-key="${CSS.escape(esp.key)}"]`);
  if (btn) btn.classList.add("tem-assento");
}

function mostrarAssento(esp) {
  const mostra = !!(esp && !ehJogador(esp));
  painelAssento.hidden = !mostra;
  if (!mostra) return;
  const seat = leituraAssento(esp);
  seatXEl.value = String(seat.x);
  seatYEl.value = String(seat.y);
  seatElevEl.value = String(seat.elev);
  seatXValor.textContent = seat.x.toFixed(2);
  seatYValor.textContent = seat.y.toFixed(2);
  seatElevValor.textContent = seat.elev.toFixed(2);
  seatCoords.textContent = `assento ${seat.x.toFixed(2)}, ${seat.y.toFixed(2)} · elev ${seat.elev.toFixed(2)}`;
  for (const btn of document.querySelectorAll("#modos-assento button")) {
    btn.classList.toggle("ativo", btn.dataset.modo === modoAssento);
  }
}

function escolher(key) {
  const esp = key === CHAVE_JOGADOR ? JOGADOR : especies.find((item) => item.key === key);
  if (!esp) return;
  escolhida = esp;
  avisoSprite = "";
  frame = 0;
  frameT = 0;
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

/** Preview: X lateral na tela; Y costas sobe no sprite; elev sobe mais o pezinho. */
function pontoAssentoPreview(peX, peY, seat) {
  const cell = TILE * ZOOM;
  return {
    x: peX + seat.x * cell,
    y: peY + seat.y * cell - seat.elev * cell,
  };
}

function desenhar() {
  ctx.clearRect(0, 0, vistaW, vistaH);
  ctx.fillStyle = "#121814";
  ctx.fillRect(0, 0, vistaW, vistaH);

  const peX = vistaW * 0.5;
  const chaoY = vistaH * 0.72;
  const esp = escolhida;
  const aj = leitura(esp);
  const peY = chaoY + aj.offsetY * TILE * ZOOM;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
  ctx.beginPath();
  ctx.ellipse(peX, chaoY, 36, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (ehJogador(esp)) desenharJogador(peX, peY, aj);
  else {
    const pack = esp ? garantirAtlas(esp.dex, false) : null;
    const fr = quadroAtual(pack);
    if (fr && pack?.img && pack.estado === "pronto") {
      ctx.imageSmoothingEnabled = false;
      blitQuadro(ctx, pack.img, pack.atlasW, pack.atlasH, fr, peX, peY, ZOOM * escalaDa(esp), aj);
    }
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

  ctx.save();
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
  desenharCruz(peX, peY);
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

let passoAndar = 0;

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
    avancarJogador(dt);
    desenhar();
    requestAnimationFrame(quadro);
    return;
  }
  const pack = escolhida ? garantirAtlas(escolhida.dex, false) : null;
  if (pack?.estado === "pronto") avancarPose(pack, dt);
  else if (pack?.estado === "falhou" && escolhida && avisoSprite !== escolhida.key) {
    avisoSprite = escolhida.key;
    dizer(`${escolhida.nome || escolhida.key} sem sprite.`);
  }
  desenhar();
  requestAnimationFrame(quadro);
}

listaEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.key) return;
  escolher(btn.dataset.key);
});

buscaEl.addEventListener("input", pintarListas);

offsetEl.addEventListener("input", () => {
  if (!escolhida) return;
  const aj = leitura(escolhida);
  aj.offsetY = celula(offsetEl.value);
  offsetValorEl.textContent = aj.offsetY.toFixed(2);
  publicar(escolhida, aj);
});

document.getElementById("faixas").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.faixa) return;
  faixa = btn.dataset.faixa;
  frame = 0;
  frameT = 0;
  passoAndar = 0;
  for (const item of document.querySelectorAll("#faixas button")) {
    item.classList.toggle("ativo", item === btn);
  }
});

document.getElementById("dirs").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.dir || btn.hidden) return;
  dir = Number(btn.dataset.dir) || 0;
  frame = 0;
  frameT = 0;
  passoAndar = 0;
  for (const item of document.querySelectorAll("#dirs button")) {
    item.classList.toggle("ativo", item === btn);
  }
});

function peCanvas() {
  const peX = vistaW * 0.5;
  const chaoY = vistaH * 0.72;
  const aj = leitura(escolhida);
  const peY = chaoY + aj.offsetY * TILE * ZOOM;
  return { peX, peY };
}

function pointerPertoAssento(clientX, clientY) {
  if (!escolhida || ehJogador(escolhida)) return false;
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * vistaW;
  const y = ((clientY - rect.top) / rect.height) * vistaH;
  const { peX, peY } = peCanvas();
  const rider = pontoAssentoPreview(peX, peY, leituraAssento(escolhida));
  return Math.hypot(x - rider.x, y - rider.y) <= 28;
}

canvas.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0 || !escolhida) return;
  if (!ehJogador(escolhida) && pointerPertoAssento(ev.clientX, ev.clientY)) {
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
  if (arrasteAssento && escolhida && !ehJogador(escolhida)) {
    const cell = TILE * ZOOM;
    const dx = (ev.clientX - arrasteAssento.x) / cell;
    const dy = (ev.clientY - arrasteAssento.y) / cell;
    // Arraste: X = lateral; Y mistura costas + elev (Shift = só elev).
    let seatX = celula(arrasteAssento.seatX + dx);
    let seatY = celula(arrasteAssento.seatY + (ev.shiftKey ? 0 : dy));
    let elev = celula(arrasteAssento.elev + (ev.shiftKey ? -dy : 0));
    seatX = Math.max(-1.5, Math.min(1.5, seatX));
    seatY = Math.max(-1.5, Math.min(1.5, seatY));
    elev = Math.max(0, Math.min(2, elev));
    const seat = { x: seatX, y: seatY, elev };
    publicarAssento(escolhida, seat);
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
seatXEl.addEventListener("input", aoSliderAssento);
seatYEl.addEventListener("input", aoSliderAssento);
seatElevEl.addEventListener("input", aoSliderAssento);

document.getElementById("salvar").addEventListener("click", async () => {
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
  const n = Object.keys(arquivo).length;
  const a = Object.keys(estadoRideAssentos()).length;
  dizer(
    `Salvo. ${n} pivô${n === 1 ? "" : "s"} · ${a} assento${a === 1 ? "" : "s"}.`,
  );
});

function aceitarArquivo(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return;
  const chaves = Object.keys(json);
  for (let i = 0; i < chaves.length; i++) {
    const item = json[chaves[i]];
    if (!item || typeof item !== "object") continue;
    arquivo[chaves[i]] = {
      offsetY: celula(item.offsetY),
      dx: pixel(item.dx),
      dy: pixel(item.dy),
    };
  }
}

async function iniciar() {
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
    .map((key) => mapa[key])
    .filter((esp) => esp && esp.key)
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
