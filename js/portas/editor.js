import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { idsVisuais, origemDoModelo, urlDoModelo } from "../mundo/cidade/catalogoCasas.js";
import { lerFacesObj } from "../mundo/cidade/facesObj.js";

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista");
const buscaEl = document.getElementById("busca");
const contagemEl = document.getElementById("contagem");
const canvas = document.getElementById("vista");
const btnPorta = document.getElementById("papel-porta");
const btnJanela = document.getElementById("papel-janela");
const btnSalvar = document.getElementById("salvar");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x121814, 1);
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
const controles = new OrbitControls(camera, canvas);
controles.enableDamping = true;
controles.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controles.target.set(0, 1.2, 0);
camera.position.set(6, 4, 8);
controles.update();

cena.add(new THREE.HemisphereLight(0xd7efe0, 0x2a211c, 1.15));
const sol = new THREE.DirectionalLight(0xfff4e0, 1.25);
sol.position.set(4, 10, 3);
cena.add(sol);
cena.add(new THREE.GridHelper(10, 10, 0x3d5248, 0x243028));

const raycaster = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
const matCasa = new THREE.MeshLambertMaterial({ color: 0xc8c2b4, side: THREE.DoubleSide });
const matPorta = new THREE.MeshBasicMaterial({
  color: 0x3ddc6a,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  transparent: true,
  opacity: 0.82,
});
const matJanela = new THREE.MeshBasicMaterial({
  color: 0x4aa3e8,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  transparent: true,
  opacity: 0.82,
});
const matHover = new THREE.MeshBasicMaterial({
  color: 0xffe08a,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3,
  transparent: true,
  opacity: 0.55,
});

const grupo = new THREE.Group();
cena.add(grupo);

const ROTULOS = {
  centro: "Centro",
  loja: "Loja",
  lab: "Laboratório",
  "casa-bark": "Casa bark",
  "casa-amigo": "Casa amigo",
  "casa-cherry": "Casa cherry",
  "casa-guia": "Casa guia",
};

const modelos = idsVisuais()
  .filter((id) => id !== "poste")
  .map((id) => {
    const origem = origemDoModelo(id);
    const arquivo = origem?.arquivo || "modelo.obj";
    return {
      id,
      nome: ROTULOS[id] || arquivo.replace(/\.obj$/i, ""),
      url: origem
        ? `${urlDoModelo(origem.base)}${urlDoModelo(origem.arquivo)}`
        : `assets/models/cidade/${id}/modelo.obj`,
    };
  });

let partes = {};
let modeloId = "";
let papel = "porta";
let faces = [];
let triParaFace = [];
let portaArquivo = new Set();
let malhaCasa = null;
let malhaPorta = null;
let malhaJanela = null;
let malhaHover = null;
let downX = 0;
let downY = 0;
let carga = 0;
let hoverIndice = -2;

function dizer(texto) {
  statusEl.textContent = texto;
}

function itemDo(id) {
  if (!partes[id]) partes[id] = { porta: [], janela: [] };
  if (!Array.isArray(partes[id].porta)) partes[id].porta = [];
  if (!Array.isArray(partes[id].janela)) partes[id].janela = [];
  return partes[id];
}

function temMarca(id) {
  const item = partes[id];
  return !!(item && ((item.porta && item.porta.length) || (item.janela && item.janela.length)));
}

function desenharLista() {
  const q = buscaEl.value.trim().toLowerCase();
  listaEl.replaceChildren();
  for (let i = 0; i < modelos.length; i++) {
    const modelo = modelos[i];
    if (q && !modelo.nome.toLowerCase().includes(q) && !modelo.id.includes(q)) continue;
    const li = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = modelo.nome;
    if (modelo.id === modeloId) botao.classList.add("ativo");
    if (temMarca(modelo.id)) botao.classList.add("tem-ajuste");
    botao.addEventListener("click", () => abrir(modelo.id));
    li.append(botao);
    listaEl.append(li);
  }
}

function geometriaDas(indices) {
  const pos = [];
  const quer = indices instanceof Set ? indices : new Set(indices);
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    if (!quer.has(f.indice)) continue;
    pos.push(f.a[0], f.a[1], f.a[2], f.b[0], f.b[1], f.b[2], f.c[0], f.c[1], f.c[2]);
  }
  const geo = new THREE.BufferGeometry();
  if (pos.length) geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

function soltar(malha) {
  if (!malha) return;
  malha.geometry.dispose();
  malha.removeFromParent();
}

function pintar() {
  const item = modeloId ? itemDo(modeloId) : { porta: [], janela: [] };
  const portas = new Set(item.porta);
  for (const indice of portaArquivo) portas.add(indice);
  soltar(malhaPorta);
  soltar(malhaJanela);
  malhaPorta = new THREE.Mesh(geometriaDas(portas), matPorta);
  malhaJanela = new THREE.Mesh(geometriaDas(item.janela), matJanela);
  grupo.add(malhaPorta, malhaJanela);
  const nPorta = item.porta.length + [...portaArquivo].filter((n) => !item.porta.includes(n)).length;
  contagemEl.textContent = modeloId
    ? `Porta: ${nPorta} face${nPorta === 1 ? "" : "s"} · Janela: ${item.janela.length}`
    : "Nenhuma face marcada";
  desenharLista();
}

function enquadrar() {
  const caixa = new THREE.Box3().setFromObject(grupo);
  if (caixa.isEmpty()) return;
  const tam = caixa.getSize(new THREE.Vector3());
  const centro = caixa.getCenter(new THREE.Vector3());
  const dist = Math.max(tam.x, tam.y, tam.z, 1) * 1.7;
  controles.target.copy(centro);
  camera.position.set(centro.x + dist * 0.72, centro.y + tam.y * 0.2, centro.z + dist * 0.72);
  camera.near = Math.max(0.02, dist / 200);
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  controles.update();
}

async function abrir(id) {
  const modelo = modelos.find((m) => m.id === id);
  if (!modelo) return;
  modeloId = id;
  const ticket = ++carga;
  dizer(`Abrindo ${modelo.nome}…`);
  desenharLista();
  const res = await fetch(modelo.url);
  if (ticket !== carga) return;
  if (!res.ok) {
    dizer(`Não achei o modelo de ${modelo.nome}`);
    return;
  }
  const obj = lerFacesObj(await res.text());
  if (ticket !== carga) return;
  faces = obj.faces;
  portaArquivo = new Set();
  hoverIndice = -2;
  const pos = [];
  triParaFace = [];
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    const nome = (f.mtl || "").toLowerCase();
    if (nome.includes("kage")) continue;
    if (nome.startsWith("door_only")) portaArquivo.add(f.indice);
    pos.push(f.a[0], f.a[1], f.a[2], f.b[0], f.b[1], f.b[2], f.c[0], f.c[1], f.c[2]);
    triParaFace.push(f.indice);
  }
  soltar(malhaCasa);
  soltar(malhaHover);
  malhaHover = null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  malhaCasa = new THREE.Mesh(geo, matCasa);
  grupo.clear();
  grupo.add(malhaCasa);
  grupo.position.set(0, 0, 0);
  geo.computeBoundingBox();
  const caixa = geo.boundingBox;
  if (caixa) {
    grupo.position.set(
      -((caixa.min.x + caixa.max.x) * 0.5),
      -caixa.min.y,
      -((caixa.min.z + caixa.max.z) * 0.5),
    );
  }
  pintar();
  enquadrar();
  dizer(`${modelo.nome} · clique numa face`);
}

function indiceNoPonteiro(ev) {
  const rect = canvas.getBoundingClientRect();
  ponteiro.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ponteiro.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ponteiro, camera);
  if (!malhaCasa) return -1;
  const hits = raycaster.intersectObject(malhaCasa, false);
  if (!hits.length || hits[0].faceIndex == null) return -1;
  const indice = triParaFace[hits[0].faceIndex];
  return indice == null ? -1 : indice;
}

function mostrarHover(indice) {
  if (indice === hoverIndice) return;
  hoverIndice = indice;
  soltar(malhaHover);
  malhaHover = null;
  if (indice < 0) return;
  malhaHover = new THREE.Mesh(geometriaDas([indice]), matHover);
  grupo.add(malhaHover);
}

function alternar(indice) {
  if (!modeloId || indice < 0) return;
  if (portaArquivo.has(indice)) {
    dizer("Essa face já é porta no arquivo do modelo");
    return;
  }
  const item = itemDo(modeloId);
  const outro = papel === "porta" ? "janela" : "porta";
  const lista = item[papel];
  const i = lista.indexOf(indice);
  if (i >= 0) lista.splice(i, 1);
  else {
    item[outro] = item[outro].filter((n) => n !== indice);
    lista.push(indice);
  }
  pintar();
  salvar();
}

function corpoParaSalvar() {
  const saida = {};
  const ids = Object.keys(partes);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const item = partes[id];
    const porta = [...new Set(item.porta || [])].filter((n) => Number.isInteger(n) && n >= 0);
    const janela = [...new Set(item.janela || [])].filter((n) => Number.isInteger(n) && n >= 0 && !porta.includes(n));
    if (!porta.length && !janela.length) continue;
    saida[id] = {};
    if (porta.length) saida[id].porta = porta;
    if (janela.length) saida[id].janela = janela;
  }
  return saida;
}

let filaSalvar = Promise.resolve();

function salvar() {
  filaSalvar = filaSalvar.then(() => enviarPartes(), () => enviarPartes());
  return filaSalvar;
}

async function enviarPartes() {
  btnSalvar.disabled = true;
  const corpo = JSON.stringify(corpoParaSalvar());
  try {
    const res = await fetch("/api/partes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corpo,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.erro || "não salvou");
    const modelo = modelos.find((m) => m.id === modeloId);
    dizer(modelo ? `${modelo.nome} salva` : "Salvo");
  } catch (erro) {
    dizer(`Não salvou: ${erro.message || erro}`);
  } finally {
    btnSalvar.disabled = false;
  }
}

function ajustarTela() {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

btnPorta.addEventListener("click", () => {
  papel = "porta";
  btnPorta.classList.add("ativo");
  btnJanela.classList.remove("ativo");
});
btnJanela.addEventListener("click", () => {
  papel = "janela";
  btnJanela.classList.add("ativo");
  btnPorta.classList.remove("ativo");
});
buscaEl.addEventListener("input", desenharLista);
btnSalvar.addEventListener("click", salvar);

canvas.addEventListener("pointerdown", (ev) => {
  downX = ev.clientX;
  downY = ev.clientY;
});
canvas.addEventListener("pointerup", (ev) => {
  if (ev.button !== 0) return;
  if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 5) return;
  alternar(indiceNoPonteiro(ev));
});
canvas.addEventListener("pointermove", (ev) => {
  if (!malhaCasa) return;
  mostrarHover(indiceNoPonteiro(ev));
});

window.addEventListener("resize", ajustarTela);
ajustarTela();
renderer.setAnimationLoop(() => {
  controles.update();
  renderer.render(cena, camera);
});

async function iniciar() {
  const res = await fetch("assets/models/partes.json", { cache: "no-store" });
  if (res.ok) {
    const json = await res.json();
    if (json && typeof json === "object") partes = json;
  }
  desenharLista();
  dizer("Escolha uma casa e clique na face da porta");
  if (modelos.length) abrir(modelos[0].id);
}

iniciar();
