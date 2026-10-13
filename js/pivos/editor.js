import { TILE } from "../config.js";
import { blitQuadro, garantirAtlas } from "../pokemon/sprites.js";

const ZOOM = 6;

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista-pokemon");
const buscaEl = document.getElementById("busca");
const offsetEl = document.getElementById("offset");
const offsetValorEl = document.getElementById("offset-valor");
const coordsEl = document.getElementById("coords");
const canvas = document.getElementById("vista");
const ctx = canvas.getContext("2d");

let arquivo = {};
let especies = [];
let escolhida = null;
let faixa = "Idle";
let dir = 0;
let frame = 0;
let frameT = 0;
let ultimo = performance.now();
let arraste = null;
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

function botaoLista(esp) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.key = esp.key;
  btn.textContent = `#${esp.dex} ${esp.nome || esp.key}`;
  if (esp.key === escolhida?.key) btn.classList.add("ativo");
  if (arquivo[esp.key]) btn.classList.add("tem-ajuste");
  li.appendChild(btn);
  return li;
}

function pintarListas() {
  const q = buscaEl.value.trim().toLowerCase();
  const frag = document.createDocumentFragment();
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

function escolher(key) {
  const esp = especies.find((item) => item.key === key);
  if (!esp) return;
  escolhida = esp;
  avisoSprite = "";
  frame = 0;
  frameT = 0;
  garantirAtlas(esp.dex, false);
  mostrarControles(esp);
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

function desenharCruz(x, y) {
  ctx.save();
  ctx.strokeStyle = "#1a120c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x + 12, y);
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x, y + 12);
  ctx.stroke();
  ctx.strokeStyle = "#ffcc66";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
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

  const pack = esp ? garantirAtlas(esp.dex, false) : null;
  const fr = quadroAtual(pack);
  if (fr && pack?.img && pack.estado === "pronto") {
    ctx.imageSmoothingEnabled = false;
    blitQuadro(ctx, pack.img, pack.atlasW, pack.atlasH, fr, peX, peY, ZOOM * escalaDa(esp), aj);
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
  for (const item of document.querySelectorAll("#dirs button")) {
    item.classList.toggle("ativo", item === btn);
  }
});

canvas.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0 || !escolhida) return;
  const aj = leitura(escolhida);
  arraste = { x: ev.clientX, y: ev.clientY, dx: aj.dx, dy: aj.dy };
  canvas.classList.add("arrastando");
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove", (ev) => {
  if (!arraste || !escolhida) return;
  const esc = ZOOM * escalaDa(escolhida);
  const aj = leitura(escolhida);
  aj.dx = pixel(arraste.dx + (ev.clientX - arraste.x) / esc);
  aj.dy = pixel(arraste.dy + (ev.clientY - arraste.y) / esc);
  publicar(escolhida, aj);
});

canvas.addEventListener("pointerup", () => {
  arraste = null;
  canvas.classList.remove("arrastando");
});

document.getElementById("salvar").addEventListener("click", async () => {
  dizer("Salvando…");
  const res = await fetch("/api/pivos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arquivo),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    dizer(json.erro || "Não salvou.");
    return;
  }
  const n = Object.keys(arquivo).length;
  dizer(n ? `Salvo. ${n} espécie${n === 1 ? "" : "s"} com ajuste.` : "Salvo. Nenhuma espécie com ajuste.");
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
  const [pivoRes, pokeRes] = await Promise.all([
    fetch("/assets/pokemon/pivos.json"),
    fetch("/ref/catalogo.json"),
  ]);
  if (pivoRes.ok) aceitarArquivo(await pivoRes.json());
  if (!pokeRes.ok) throw new Error("catálogo de pokémon indisponível");
  const json = await pokeRes.json();
  const mapa = json.especies || {};
  especies = Object.keys(mapa)
    .map((key) => mapa[key])
    .filter((esp) => esp && esp.key)
    .sort((a, b) => (a.dex | 0) - (b.dex | 0));
  pintarListas();
  if (especies.length) escolher(especies[0].key);
  else dizer("Catálogo vazio.");
  window.addEventListener("resize", redimensionar);
  requestAnimationFrame(quadro);
}

iniciar().catch((erro) => dizer(String(erro.message || erro)));
