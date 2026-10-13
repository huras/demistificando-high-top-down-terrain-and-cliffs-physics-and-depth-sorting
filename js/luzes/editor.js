import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { MODELOS_CIDADE, carregarMoldeCidade } from "../render/3d/edificiosCidade.js";
import { blitQuadro, garantirAtlas } from "../pokemon/sprites.js";

const PX = 1.2 / 32;
const LADO = 256;
const PE_X = LADO * 0.5;
const PE_Y = LADO - 64;
const MAX_PONTOS = 12;

const ROTULOS = {
  centro: "Centro",
  loja: "Loja",
  lab: "Laboratório",
  poste: "Poste",
  "casa-bark": "Casa bark",
  "casa-amigo": "Casa amigo",
  "casa-cherry": "Casa cherry",
  "casa-guia": "Casa guia",
};

const statusEl = document.getElementById("status");
const listaCidade = document.getElementById("lista-cidade");
const listaPokemon = document.getElementById("lista-pokemon");
const busca = document.getElementById("busca");
const corEl = document.getElementById("cor");
const raioEl = document.getElementById("raio");
const raioValor = document.getElementById("raio-valor");
const intensidadeEl = document.getElementById("intensidade");
const intensidadeValor = document.getElementById("intensidade-valor");
const coordsEl = document.getElementById("coords");
const canvas = document.getElementById("vista");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x121814, 1);
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
const controles = new OrbitControls(camera, canvas);
controles.enableDamping = true;
controles.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controles.target.set(0, 1.4, 0);
camera.position.set(4.5, 3.2, 6);
controles.update();

cena.add(new THREE.HemisphereLight(0xd7efe0, 0x2a211c, 1.2));
const sol = new THREE.DirectionalLight(0xfff4e0, 1.3);
sol.position.set(4, 10, 3);
cena.add(sol);
cena.add(new THREE.GridHelper(8, 8, 0x3d5248, 0x243028));

const eixos = new TransformControls(camera, canvas);
eixos.setMode("translate");
eixos.setSpace("local");
eixos.setSize(0.9);
cena.add(eixos.getHelper());
eixos.addEventListener("dragging-changed", (ev) => {
  controles.enabled = !ev.value;
});

const raycaster = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
const geoMarca = new THREE.SphereGeometry(0.08, 12, 10);

let catalogo = { modelos: {} };
let especies = [];
let modeloId = "";
let tipoModelo = "cidade";
let grupo = null;
let marcas = [];
let selecionado = -1;
let arrastando = false;
let eixoUsado = false;
let downX = 0;
let downY = 0;
let carga = 0;

function dizer(texto) {
  statusEl.textContent = texto;
}

function pontosAtuais() {
  return catalogo.modelos[modeloId]?.pontos || [];
}

function garantirItem() {
  if (!catalogo.modelos[modeloId]) catalogo.modelos[modeloId] = { pontos: [] };
  return catalogo.modelos[modeloId];
}

function lerForma() {
  return {
    cor: corEl.value,
    raio: Number(raioEl.value),
    intensidade: Number(intensidadeEl.value),
  };
}

function mostrarForma(ponto) {
  if (!ponto) return;
  corEl.value = ponto.cor;
  raioEl.value = String(ponto.raio);
  intensidadeEl.value = String(ponto.intensidade);
  raioValor.textContent = ponto.raio.toFixed(1);
  intensidadeValor.textContent = ponto.intensidade.toFixed(2);
}

function mostrarCoords(ponto) {
  if (!ponto) {
    coordsEl.textContent = "x —    y —    z —";
    return;
  }
  coordsEl.textContent = `x ${ponto.x.toFixed(3)}    y ${ponto.y.toFixed(3)}    z ${ponto.z.toFixed(3)}`;
}

function gravarPosicao(marca) {
  const ponto = pontosAtuais()[selecionado];
  if (!ponto || !marca) return;
  if (tipoModelo === "pokemon") marca.position.z = 0;
  ponto.x = arredondar(marca.position.x);
  ponto.y = arredondar(marca.position.y);
  ponto.z = arredondar(marca.position.z);
  mostrarCoords(ponto);
}

function ponteiroNdc(ev) {
  ndc(ev);
  return { x: ponteiro.x, y: ponteiro.y, button: ev.button };
}

function arredondar(n) {
  return Math.round(n * 1000) / 1000;
}

function ndc(ev) {
  const r = canvas.getBoundingClientRect();
  ponteiro.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  ponteiro.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
}

function acertos(ev) {
  if (!grupo) return [];
  ndc(ev);
  raycaster.setFromCamera(ponteiro, camera);
  return raycaster.intersectObject(grupo, true);
}

function localDoAcerto(hit) {
  const p = grupo.worldToLocal(hit.point.clone());
  if (tipoModelo === "pokemon") p.z = 0;
  return p;
}

function superficie(ev) {
  const lista = acertos(ev);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].object.userData.marcador != null) continue;
    return localDoAcerto(lista[i]);
  }
  return null;
}

function escalaMarca() {
  const s = grupo?.scale.x || 1;
  return 1 / Math.max(0.05, s);
}

function redesenharMarcas() {
  eixos.detach();
  for (let i = 0; i < marcas.length; i++) {
    grupo?.remove(marcas[i]);
    marcas[i].material?.dispose?.();
  }
  marcas = [];
  if (!grupo) return;
  const pontos = pontosAtuais();
  const esc = escalaMarca();
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i];
    const mat = new THREE.MeshBasicMaterial({
      color: p.cor,
      depthTest: false,
    });
    const malha = new THREE.Mesh(geoMarca, mat);
    malha.position.set(p.x, p.y, p.z);
    malha.scale.setScalar((i === selecionado ? 1.7 : 1) * esc);
    malha.renderOrder = 5;
    malha.userData.marcador = i;
    grupo.add(malha);
    marcas.push(malha);
  }
  eixos.showZ = tipoModelo !== "pokemon";
  if (selecionado >= 0 && marcas[selecionado]) eixos.attach(marcas[selecionado]);
}

function selecionar(indice) {
  selecionado = indice;
  const pontos = pontosAtuais();
  if (indice >= 0 && pontos[indice]) mostrarForma(pontos[indice]);
  mostrarCoords(indice >= 0 ? pontos[indice] : null);
  redesenharMarcas();
  const n = pontos.length;
  dizer(n ? `${modeloId}: ${n} ponto${n === 1 ? "" : "s"}` : `${modeloId}: clique no modelo`);
}

function aplicarNoSelecionado() {
  const pontos = pontosAtuais();
  const ponto = pontos[selecionado];
  if (!ponto) return;
  const forma = lerForma();
  ponto.cor = forma.cor;
  ponto.raio = forma.raio;
  ponto.intensidade = forma.intensidade;
  redesenharMarcas();
}

function adicionar(local) {
  const item = garantirItem();
  if (item.pontos.length >= MAX_PONTOS) {
    dizer("Esse modelo já tem doze pontos.");
    return;
  }
  const forma = lerForma();
  item.pontos.push({
    x: arredondar(local.x),
    y: arredondar(local.y),
    z: arredondar(local.z),
    cor: forma.cor,
    raio: forma.raio,
    intensidade: forma.intensidade,
  });
  selecionar(item.pontos.length - 1);
  pintarListas();
}

function moverSelecionado(local) {
  const ponto = pontosAtuais()[selecionado];
  if (!ponto) return;
  ponto.x = arredondar(local.x);
  ponto.y = arredondar(local.y);
  ponto.z = arredondar(local.z);
  const marca = marcas[selecionado];
  if (marca) marca.position.set(ponto.x, ponto.y, ponto.z);
  mostrarCoords(ponto);
}

function apagarSelecionado() {
  const item = catalogo.modelos[modeloId];
  if (!item || selecionado < 0) return;
  item.pontos.splice(selecionado, 1);
  if (!item.pontos.length) delete catalogo.modelos[modeloId];
  selecionado = catalogo.modelos[modeloId] ? Math.min(selecionado, item.pontos.length - 1) : -1;
  const pontos = pontosAtuais();
  if (selecionado >= 0 && pontos[selecionado]) mostrarForma(pontos[selecionado]);
  redesenharMarcas();
  pintarListas();
}

function limparGrupo() {
  eixos.detach();
  if (!grupo) return;
  cena.remove(grupo);
  grupo.traverse((obj) => {
    if (obj.geometry && obj.geometry !== geoMarca) obj.geometry.dispose();
    const mats = obj.material ? [].concat(obj.material) : [];
    for (let i = 0; i < mats.length; i++) {
      if (mats[i].name === "tkwa_sl3" || mats[i].name === "tkwa_sl2l") continue;
      mats[i].map?.dispose?.();
      mats[i].dispose?.();
    }
  });
  grupo = null;
  marcas = [];
}

function enquadrar() {
  const caixa = new THREE.Box3().setFromObject(grupo);
  const tam = caixa.getSize(new THREE.Vector3());
  const centro = caixa.getCenter(new THREE.Vector3());
  const maior = Math.max(tam.x, tam.y, tam.z, 1);
  controles.target.copy(centro);
  camera.position.set(centro.x + maior * 0.9, centro.y + maior * 0.55, centro.z + maior * 1.15);
  controles.update();
}

async function mostrarCidade(id) {
  const token = ++carga;
  limparGrupo();
  dizer(`Carregando ${ROTULOS[id] || id}…`);
  const molde = await carregarMoldeCidade(id);
  if (token !== carga) return;
  grupo = molde;
  cena.add(grupo);
  enquadrar();
  selecionar(pontosAtuais().length ? 0 : -1);
}

function pintarPokemon(mesh, pack) {
  const fr = pack.quadros?.get("Idle:0:0");
  if (!fr || !pack.img) return false;
  const tela = document.createElement("canvas");
  tela.width = LADO;
  tela.height = LADO;
  const ctx = tela.getContext("2d");
  blitQuadro(ctx, pack.img, pack.img.width, pack.img.height, fr, PE_X, PE_Y, 1);
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
  mesh.userData.tex = tex;
  return true;
}

async function mostrarPokemon(esp) {
  const token = ++carga;
  limparGrupo();
  dizer(`Carregando ${esp.nome}…`);
  const geo = new THREE.PlaneGeometry(LADO * PX, LADO * PX);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plano = new THREE.Mesh(geo, mat);
  plano.position.y = (PE_Y - LADO / 2) * PX;
  grupo = new THREE.Group();
  grupo.add(plano);
  grupo.userData.plano = plano;
  grupo.userData.dex = esp.dex;
  cena.add(grupo);
  enquadrar();
  selecionar(pontosAtuais().length ? 0 : -1);
  const pack = garantirAtlas(esp.dex, false);
  const tentar = () => {
    if (token !== carga || !grupo) return;
    if (pack.estado === "pronto" && pintarPokemon(plano, pack)) return;
    if (pack.estado === "falhou") {
      dizer(`${esp.nome} sem sprite.`);
      return;
    }
    requestAnimationFrame(tentar);
  };
  tentar();
}

function botaoLista(rotulo, id, ativo, tem) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = rotulo;
  if (ativo) btn.classList.add("ativo");
  if (tem) btn.classList.add("tem-luz");
  btn.addEventListener("click", () => escolher(id));
  li.appendChild(btn);
  return li;
}

function pintarListas() {
  listaCidade.replaceChildren();
  for (let i = 0; i < MODELOS_CIDADE.length; i++) {
    const id = MODELOS_CIDADE[i];
    listaCidade.appendChild(
      botaoLista(ROTULOS[id] || id, id, id === modeloId, !!catalogo.modelos[id]?.pontos?.length),
    );
  }
  const q = busca.value.trim().toLowerCase();
  listaPokemon.replaceChildren();
  let mostrados = 0;
  for (let i = 0; i < especies.length && mostrados < 40; i++) {
    const esp = especies[i];
    const nome = `${esp.nome || esp.key} ${esp.dex} ${esp.key}`.toLowerCase();
    const tem = !!catalogo.modelos[esp.key]?.pontos?.length;
    if (q && !nome.includes(q) && !tem) continue;
    if (!q && !tem && esp.tipos?.indexOf("electric") < 0 && esp.tipos?.indexOf("psychic") < 0) {
      continue;
    }
    listaPokemon.appendChild(
      botaoLista(`#${esp.dex} ${esp.nome || esp.key}`, esp.key, esp.key === modeloId, tem),
    );
    mostrados++;
  }
}

function escolher(id) {
  if (id === modeloId && grupo) return;
  modeloId = id;
  selecionado = -1;
  const cidade = MODELOS_CIDADE.indexOf(id) >= 0;
  tipoModelo = cidade ? "cidade" : "pokemon";
  pintarListas();
  if (cidade) mostrarCidade(id);
  else {
    const esp = especies.find((item) => item.key === id);
    if (esp) mostrarPokemon(esp);
  }
}

function redimensionar() {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

eixos.addEventListener("mouseDown", () => {
  eixoUsado = true;
});
eixos.addEventListener("objectChange", () => {
  gravarPosicao(eixos.object);
});
eixos.addEventListener("mouseUp", () => {
  const marca = eixos.object;
  const ponto = pontosAtuais()[selecionado];
  if (marca && ponto) marca.position.set(ponto.x, ponto.y, ponto.z);
});

canvas.addEventListener(
  "pointerdown",
  (ev) => {
    if (ev.button !== 0 || !eixos.object) return;
    eixos.pointerHover(ponteiroNdc(ev));
    if (eixos.axis) controles.enabled = false;
  },
  true,
);

canvas.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0) return;
  downX = ev.clientX;
  downY = ev.clientY;
  if (eixos.dragging) return;
  const lista = acertos(ev);
  const marca = lista.find((hit) => hit.object.userData.marcador != null);
  if (!marca) return;
  selecionar(marca.object.userData.marcador);
  arrastando = true;
  controles.enabled = false;
});

window.addEventListener("pointermove", (ev) => {
  if (!arrastando) return;
  const local = superficie(ev);
  if (local) moverSelecionado(local);
});

window.addEventListener("pointerup", (ev) => {
  if (ev.button !== 0) return;
  const foiArraste = arrastando;
  const veioDoEixo = eixoUsado;
  arrastando = false;
  eixoUsado = false;
  controles.enabled = true;
  if (foiArraste || veioDoEixo) return;
  const dx = ev.clientX - downX;
  const dy = ev.clientY - downY;
  if (dx * dx + dy * dy > 16) return;
  if (!canvas.contains(ev.target)) return;
  const local = superficie(ev);
  if (local) adicionar(local);
});

window.addEventListener("keydown", (ev) => {
  if (ev.key !== "Delete" && ev.key !== "Backspace") return;
  if (ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA")) return;
  apagarSelecionado();
});

corEl.addEventListener("input", aplicarNoSelecionado);
raioEl.addEventListener("input", () => {
  raioValor.textContent = Number(raioEl.value).toFixed(1);
  aplicarNoSelecionado();
});
intensidadeEl.addEventListener("input", () => {
  intensidadeValor.textContent = Number(intensidadeEl.value).toFixed(2);
  aplicarNoSelecionado();
});
document.getElementById("apagar").addEventListener("click", apagarSelecionado);
busca.addEventListener("input", pintarListas);

document.getElementById("salvar").addEventListener("click", async () => {
  dizer("Salvando…");
  const res = await fetch("/api/luzes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(catalogo),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    dizer(json.erro || "Não salvou.");
    return;
  }
  dizer("Catálogo salvo.");
});

function quadro() {
  redimensionar();
  controles.update();
  renderer.render(cena, camera);
  requestAnimationFrame(quadro);
}

async function iniciar() {
  const [luzesRes, pokeRes] = await Promise.all([
    fetch("/assets/luzes/catalogo.json"),
    fetch("/ref/catalogo.json"),
  ]);
  if (luzesRes.ok) {
    const json = await luzesRes.json();
    if (json?.modelos) catalogo = json;
  }
  if (pokeRes.ok) {
    const json = await pokeRes.json();
    const mapa = json.especies || {};
    especies = Object.keys(mapa)
      .map((key) => mapa[key])
      .filter((esp) => esp && esp.key)
      .sort((a, b) => (a.dex | 0) - (b.dex | 0));
  }
  pintarListas();
  escolher("poste");
  window.addEventListener("resize", redimensionar);
  quadro();
}

iniciar().catch((erro) => dizer(String(erro.message || erro)));
