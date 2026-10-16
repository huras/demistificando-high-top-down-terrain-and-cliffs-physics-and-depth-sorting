import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { idsVisuais, origemDoModelo, urlDoModelo } from "../mundo/cidade/catalogoCasas.js";
import { assarSprite, corpoPadraoSprite, entradasEditorSprite, medidaSprite, portaPadraoSprite } from "../mundo/cidade/spritesPredio.js";
import { pivoDaImagem } from "../render/pivoPe.js";

const LADO_X = 6;
const LADO_Z = 5;
const LIM_OFF = 16;
const LIM_TAM = 24;
const FOLGA = 0.96;
const ALTURA = 3;
const MARGEM_BORDA = 0.18;

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista");
const buscaEl = document.getElementById("busca");
const canvas = document.getElementById("vista");
const btnSalvar = document.getElementById("salvar");
const btnAuto = document.getElementById("automatico");
const semPortaEl = document.getElementById("sem-porta");
const blocoCorpo = document.getElementById("bloco-corpo");
const blocoPorta = document.getElementById("bloco-porta");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x121814, 1);
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
const controles = new OrbitControls(camera, canvas);
controles.enableDamping = true;
controles.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controles.target.set(0, 1.4, 0.4);
camera.position.set(0.4, 7.2, 11);
controles.update();

cena.add(new THREE.HemisphereLight(0xd7efe0, 0x2a211c, 1.2));
const sol = new THREE.DirectionalLight(0xfff4e0, 1.2);
sol.position.set(4, 10, 6);
cena.add(sol);
cena.add(new THREE.GridHelper(12, 12, 0x3d5248, 0x243028));

const lote = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-LADO_X / 2, 0.02, -LADO_Z / 2),
    new THREE.Vector3(LADO_X / 2, 0.02, -LADO_Z / 2),
    new THREE.Vector3(LADO_X / 2, 0.02, LADO_Z / 2),
    new THREE.Vector3(-LADO_X / 2, 0.02, LADO_Z / 2),
  ]),
  new THREE.LineBasicMaterial({ color: 0x93a89a }),
);
cena.add(lote);

const predio = new THREE.Group();
cena.add(predio);

const raycaster = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
const planoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ponto = new THREE.Vector3();

const ROTULOS = {
  centro: "Centro",
  loja: "Loja",
  lab: "Laboratório 3D",
  "casa-bark": "Casa bark",
  "casa-amigo": "Casa amigo",
  "casa-cherry": "Casa cherry",
  "casa-guia": "Casa guia",
};

const itens = [];
for (let n = 1; n <= 5; n++) {
  itens.push({ id: `cartao-${n}`, nome: `Casa 2D ${n}`, cartao: n });
}
for (const id of idsVisuais()) {
  if (id === "poste") continue;
  const origem = origemDoModelo(id);
  const arquivo = origem?.arquivo || "modelo.obj";
  itens.push({
    id,
    nome: ROTULOS[id] || arquivo.replace(/\.obj$/i, ""),
    url: origem
      ? `${urlDoModelo(origem.base)}${urlDoModelo(origem.arquivo)}`
      : `assets/models/cidade/${id}/modelo.obj`,
  });
}

let ajustes = {};
let atual = "";
let foco = "porta";
let vista = null;
let carga = 0;
let arraste = null;

function dizer(texto) {
  statusEl.textContent = texto;
}

function arred(n) {
  return Math.round(Number(n) * 100) / 100;
}

function caixaDe(x, y, lx, ly) {
  return { x: arred(x), y: arred(y), lx: arred(lx), ly: arred(ly) };
}

function padraoDe(item) {
  const corpo = caixaDe(0, 0, LADO_X, LADO_Z);
  if (item.sprite) {
    const corpo = corpoPadraoSprite(item.largura || LADO_X);
    const porta = portaPadraoSprite(item.largura || LADO_X);
    return { corpo: caixaDe(corpo.x, corpo.y, corpo.lx, corpo.ly), porta: caixaDe(porta.x, porta.y, porta.lx, porta.ly) };
  }
  if (item.cartao === 2 || item.cartao === 4) return { corpo, porta: null };
  if (item.cartao) {
    const u0 = (36 / 64 - 0.5) * 4;
    const u1 = (50 / 64 - 0.5) * 4;
    return { corpo, porta: caixaDe((u0 + u1) * 0.5, 2, u1 - u0, 1) };
  }
  return { corpo, porta: caixaDe(0, 2, 1, 1) };
}

function itemAtual() {
  return itens.find((item) => item.id === atual) || null;
}

function temAjuste(id) {
  const salvo = ajustes[id];
  if (!salvo) return false;
  return !!(salvo.corpo || Object.prototype.hasOwnProperty.call(salvo, "porta"));
}

function leitura(id) {
  const item = itens.find((entrada) => entrada.id === id);
  const base = padraoDe(item);
  const salvo = ajustes[id];
  const corpo = salvo?.corpo ? { ...salvo.corpo } : { ...base.corpo };
  let porta = base.porta ? { ...base.porta } : null;
  if (salvo && Object.prototype.hasOwnProperty.call(salvo, "porta")) {
    porta = salvo.porta ? { ...salvo.porta } : null;
  }
  return { corpo, porta, salvo: temAjuste(id) };
}

function criarCaixa(cor, corBorda) {
  const grupo = new THREE.Group();
  const malha = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: cor,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  const linhas = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: corBorda }),
  );
  grupo.add(malha, linhas);
  grupo.userData.malha = malha;
  return grupo;
}

const corpoVis = criarCaixa(0xff9a3c, 0xffe0c2);
const portaVis = criarCaixa(0x3ec6ff, 0xe7f8ff);
cena.add(corpoVis, portaVis);

function porCaixa(grupo, caixa, altura) {
  if (!caixa) {
    grupo.visible = false;
    return;
  }
  grupo.visible = true;
  grupo.position.set(caixa.x, altura * 0.5, caixa.y);
  grupo.scale.set(caixa.lx, altura, caixa.ly);
}

function pintarCaixas() {
  if (!vista) return;
  porCaixa(corpoVis, vista.corpo, ALTURA);
  porCaixa(portaVis, vista.porta, ALTURA + 0.08);
  corpoVis.userData.malha.material.opacity = foco === "corpo" ? 0.4 : 0.2;
  portaVis.userData.malha.material.opacity = foco === "porta" ? 0.45 : 0.22;
  blocoCorpo.classList.toggle("foco", foco === "corpo");
  blocoPorta.classList.toggle("foco", foco === "porta");
  blocoPorta.classList.toggle("sem-porta", !vista.porta);
}

function preencherCampos() {
  const mapas = [
    ["corpo", vista?.corpo],
    ["porta", vista?.porta],
  ];
  for (let i = 0; i < mapas.length; i++) {
    const nome = mapas[i][0];
    const caixa = mapas[i][1];
    const inputs = document.querySelectorAll(`[data-caixa="${nome}"]`);
    inputs.forEach((input) => {
      const eixo = input.dataset.eixo;
      const valor = caixa ? caixa[eixo] : 0;
      input.value = String(valor);
      input.disabled = nome === "porta" && !vista?.porta;
      const forte = document.querySelector(`[data-valor="${nome}.${eixo}"]`);
      if (forte) forte.textContent = Number(valor).toFixed(2);
    });
  }
  semPortaEl.checked = !vista?.porta;
  btnAuto.disabled = !vista?.salvo;
}

function mostrar() {
  pintarCaixas();
  preencherCampos();
  const item = itemAtual();
  if (!item) return;
  dizer(vista.salvo ? `${item.nome} · medida sua, salve pra entrar no jogo` : `${item.nome} · automático`);
}

function desenharLista() {
  const q = buscaEl.value.trim().toLowerCase();
  listaEl.replaceChildren();
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    if (q && !item.nome.toLowerCase().includes(q) && !item.id.includes(q)) continue;
    const li = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = item.nome;
    if (item.id === atual) botao.classList.add("ativo");
    if (temAjuste(item.id)) botao.classList.add("tem-ajuste");
    botao.addEventListener("click", () => abrir(item.id));
    li.append(botao);
    listaEl.append(li);
  }
}

function soltarPredio() {
  const texturas = new Set();
  predio.traverse((filho) => {
    if (!filho.isMesh) return;
    filho.geometry?.dispose();
    const lista = Array.isArray(filho.material) ? filho.material : [filho.material];
    for (let i = 0; i < lista.length; i++) {
      if (lista[i]?.map) texturas.add(lista[i].map);
      lista[i]?.dispose();
    }
  });
  for (const tex of texturas) tex.dispose();
  predio.clear();
}

function materialVisivel(orig) {
  const mapa = orig?.map || null;
  if (mapa) {
    mapa.colorSpace = THREE.SRGBColorSpace;
    mapa.magFilter = THREE.NearestFilter;
    mapa.minFilter = THREE.NearestFilter;
    mapa.generateMipmaps = false;
    mapa.needsUpdate = true;
  }
  return new THREE.MeshLambertMaterial({
    map: mapa,
    color: mapa ? 0xffffff : orig?.color || 0xffffff,
    alphaTest: 0.2,
    side: THREE.DoubleSide,
  });
}

function prepararMalha(raiz) {
  raiz.traverse((filho) => {
    if (!filho.isMesh) return;
    const antigo = Array.isArray(filho.material) ? filho.material[0] : filho.material;
    const nome = (antigo?.name || filho.name || "").toLowerCase();
    if (nome.includes("kage")) {
      filho.visible = false;
      return;
    }
    filho.material = materialVisivel(antigo);
    if (antigo) {
      antigo.map = null;
      antigo.dispose();
    }
  });
  raiz.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(raiz);
  const sx = caixa.max.x - caixa.min.x || 1;
  const sz = caixa.max.z - caixa.min.z || 1;
  const escala = Math.min(LADO_X / sx, LADO_Z / sz) * FOLGA;
  raiz.position.set(
    -((caixa.min.x + caixa.max.x) * 0.5),
    -caixa.min.y,
    -((caixa.min.z + caixa.max.z) * 0.5),
  );
  const grupo = new THREE.Group();
  grupo.add(raiz);
  grupo.scale.setScalar(escala);
  return grupo;
}

function carregarObj(url) {
  const barra = url.lastIndexOf("/");
  const base = url.slice(0, barra + 1);
  const arquivo = url.slice(barra + 1);
  const mtl = arquivo.replace(/\.obj$/i, ".mtl");
  return new Promise((resolve, reject) => {
    const mats = new MTLLoader();
    mats.setResourcePath(base);
    mats.load(
      `${base}${mtl}`,
      (pronto) => {
        pronto.preload();
        const obj = new OBJLoader();
        obj.setMaterials(pronto);
        obj.load(`${base}${arquivo}`, resolve, undefined, reject);
      },
      undefined,
      () => new OBJLoader().load(`${base}${arquivo}`, resolve, undefined, reject),
    );
  });
}

function planoSprite(item) {
  const img = imagensSprite.get(item.def.image);
  const tela = assarSprite(item.def, img, item.tipo || null);
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(item.largura, item.altura);
  geo.translate(0, item.altura * 0.5, 0);
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.FrontSide,
  }));
}

function enquadrar(item) {
  const alcance = Math.max(item?.largura || 8, item?.altura || 6, 8);
  const dist = alcance * 1.15;
  controles.target.set(0, alcance * 0.28, 0);
  camera.position.set(alcance * 0.08, dist * 0.7, dist);
  camera.far = Math.max(80, dist * 8);
  camera.updateProjectionMatrix();
  controles.update();
}

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

let prediosDef = {};
const imagensSprite = new Map();

async function incluirSprites() {
  const res = await fetch("assets/sprites/predios/manifesto.json", { cache: "no-store" });
  if (!res.ok) return;
  const json = await res.json();
  prediosDef = json.buildings || {};
  const arquivos = [...new Set(Object.values(prediosDef).map((def) => def.image).filter(Boolean))];
  await Promise.all(arquivos.map(async (arquivo) => {
    const img = await carregarImagem(`assets/sprites/predios/${encodeURIComponent(arquivo)}`);
    imagensSprite.set(arquivo, img);
  }));
  const entradas = entradasEditorSprite();
  const novos = [];
  for (let i = 0; i < entradas.length; i++) {
    const entrada = entradas[i];
    const def = prediosDef[entrada.sprite];
    if (!def || !imagensSprite.get(def.image)) continue;
    const tam = medidaSprite(entrada.sprite, def);
    novos.push({ ...entrada, def, largura: tam.largura, altura: tam.altura });
  }
  itens.splice(5, 0, ...novos);
}

function cartao(folha) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(`assets/sprites/casas/casa-${folha}.png`, (pronta) => {
      pronta.colorSpace = THREE.SRGBColorSpace;
      pronta.magFilter = THREE.NearestFilter;
      pronta.minFilter = THREE.NearestFilter;
      pronta.generateMipmaps = false;
      pronta.needsUpdate = true;
      const img = pronta.image;
      const largura = (img.width || 64) / 16;
      const altura = (img.height || 80) / 16;
      const pivo = pivoDaImagem(img);
      const geo = new THREE.PlaneGeometry(largura, altura);
      geo.translate(largura * (0.5 - pivo.x), altura * (pivo.y - 0.5), 0);
      const malha = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        map: pronta,
        transparent: true,
        alphaTest: 0.12,
        side: THREE.FrontSide,
      }));
      malha.position.set(0, 0, LADO_Z / 2 - 1);
      resolve(malha);
    }, undefined, () => reject(new Error("sprite")));
  });
}

async function abrir(id) {
  const item = itens.find((entrada) => entrada.id === id);
  if (!item) return;
  atual = id;
  vista = leitura(id);
  foco = vista.porta ? "porta" : "corpo";
  const ticket = ++carga;
  dizer(`Abrindo ${item.nome}…`);
  desenharLista();
  enquadrar(item);
  mostrar();
  soltarPredio();
  try {
    const visual = item.cartao
      ? await cartao(item.cartao)
      : item.sprite
        ? planoSprite(item)
        : prepararMalha(await carregarObj(item.url));
    if (ticket !== carga) {
      visual.traverse?.((filho) => {
        filho.geometry?.dispose?.();
      });
      return;
    }
    predio.add(visual);
  } catch (erro) {
    if (ticket === carga) dizer(`Não abriu ${item.nome}`);
    console.error(erro);
  }
}

function apontar(ev) {
  const rect = canvas.getBoundingClientRect();
  ponteiro.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ponteiro.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ponteiro, camera);
}

function noChao() {
  if (!raycaster.ray.intersectPlane(planoChao, ponto)) return null;
  return ponto.clone();
}

function bordasDe(caixa, chao) {
  const hx = caixa.lx * 0.5;
  const hy = caixa.ly * 0.5;
  const dx = chao.x - caixa.x;
  const dz = chao.z - caixa.y;
  const margemX = Math.min(MARGEM_BORDA, hx * 0.45);
  const margemZ = Math.min(MARGEM_BORDA, hy * 0.45);
  return {
    leste: dx > hx - margemX,
    oeste: dx < -hx + margemX,
    sul: dz > hy - margemZ,
    norte: dz < -hy + margemZ,
  };
}

function temBorda(bordas) {
  return bordas.leste || bordas.oeste || bordas.sul || bordas.norte;
}

function caixaNoPonteiro() {
  const alvos = [];
  if (portaVis.visible) alvos.push(portaVis);
  if (corpoVis.visible) alvos.push(corpoVis);
  const hits = raycaster.intersectObjects(alvos, true);
  if (!hits.length) return null;
  let no = hits[0].object;
  while (no && no !== corpoVis && no !== portaVis) no = no.parent;
  if (!no || !vista) return null;
  const papel = no === portaVis ? "porta" : "corpo";
  return { papel, chao: hits[0].point, caixa: vista[papel] };
}

function aplicarBorda(caixa, chao, bordas) {
  let x0 = caixa.x - caixa.lx * 0.5;
  let x1 = caixa.x + caixa.lx * 0.5;
  let y0 = caixa.y - caixa.ly * 0.5;
  let y1 = caixa.y + caixa.ly * 0.5;
  if (bordas.leste) x1 = chao.x;
  if (bordas.oeste) x0 = chao.x;
  if (bordas.sul) y1 = chao.z;
  if (bordas.norte) y0 = chao.z;
  if (x1 - x0 < 0.2) {
    if (bordas.leste) x1 = x0 + 0.2;
    else x0 = x1 - 0.2;
  }
  if (y1 - y0 < 0.2) {
    if (bordas.sul) y1 = y0 + 0.2;
    else y0 = y1 - 0.2;
  }
  const nova = caixaDe((x0 + x1) * 0.5, (y0 + y1) * 0.5, x1 - x0, y1 - y0);
  nova.x = Math.min(LIM_OFF, Math.max(-LIM_OFF, nova.x));
  nova.y = Math.min(LIM_OFF, Math.max(-LIM_OFF, nova.y));
  nova.lx = Math.min(LIM_TAM, Math.max(0.2, nova.lx));
  nova.ly = Math.min(LIM_TAM, Math.max(0.2, nova.ly));
  return nova;
}

function tocar(papel) {
  if (!ajustes[atual]) ajustes[atual] = {};
  const item = ajustes[atual];
  if (papel === "corpo") item.corpo = { ...vista.corpo };
  if (papel === "porta") item.porta = vista.porta ? { ...vista.porta } : null;
  vista.salvo = true;
}

canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());

canvas.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0 || !vista) return;
  apontar(ev);
  const alvo = caixaNoPonteiro();
  if (!alvo) return;
  ev.stopImmediatePropagation();
  controles.enabled = false;
  foco = alvo.papel;
  const bordas = bordasDe(alvo.caixa, alvo.chao);
  arraste = {
    papel: alvo.papel,
    bordas: temBorda(bordas) ? bordas : null,
    dx: alvo.chao.x - alvo.caixa.x,
    dz: alvo.chao.z - alvo.caixa.y,
  };
  canvas.setPointerCapture(ev.pointerId);
  mostrar();
}, true);

canvas.addEventListener("pointermove", (ev) => {
  if (!arraste || !vista) return;
  apontar(ev);
  const chao = noChao();
  if (!chao) return;
  const caixa = vista[arraste.papel];
  if (arraste.bordas) {
    vista[arraste.papel] = aplicarBorda(caixa, chao, arraste.bordas);
  } else {
    vista[arraste.papel] = caixaDe(
      Math.min(LIM_OFF, Math.max(-LIM_OFF, chao.x - arraste.dx)),
      Math.min(LIM_OFF, Math.max(-LIM_OFF, chao.z - arraste.dz)),
      caixa.lx,
      caixa.ly,
    );
  }
  tocar(arraste.papel);
  mostrar();
});

function soltarArraste(ev) {
  if (!arraste) return;
  arraste = null;
  controles.enabled = true;
  desenharLista();
  if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
}
canvas.addEventListener("pointerup", soltarArraste);
canvas.addEventListener("pointercancel", soltarArraste);

document.querySelectorAll("[data-caixa]").forEach((input) => {
  input.addEventListener("input", () => {
    if (!vista) return;
    const nome = input.dataset.caixa;
    const eixo = input.dataset.eixo;
    if (nome === "porta" && !vista.porta) return;
    foco = nome;
    const caixa = vista[nome];
    caixa[eixo] = arred(input.value);
    tocar(nome);
    mostrar();
    desenharLista();
  });
});

semPortaEl.addEventListener("change", () => {
  if (!vista) return;
  foco = "porta";
  if (semPortaEl.checked) vista.porta = null;
  else vista.porta = padraoDe(itemAtual()).porta || caixaDe(0, 2, 1, 1);
  tocar("porta");
  mostrar();
  desenharLista();
});

btnAuto.addEventListener("click", () => {
  if (!atual) return;
  delete ajustes[atual];
  vista = leitura(atual);
  foco = vista.porta ? "porta" : "corpo";
  mostrar();
  desenharLista();
  dizer(`${itemAtual().nome} voltou ao automático`);
});

function corpoParaSalvar() {
  const saida = {};
  const ids = Object.keys(ajustes);
  for (let i = 0; i < ids.length; i++) {
    const item = ajustes[ids[i]];
    if (!item) continue;
    const registro = {};
    if (item.corpo) registro.corpo = { ...item.corpo };
    if (Object.prototype.hasOwnProperty.call(item, "porta")) {
      registro.porta = item.porta ? { ...item.porta } : null;
    }
    if (!registro.corpo && !Object.prototype.hasOwnProperty.call(registro, "porta")) continue;
    saida[ids[i]] = registro;
  }
  return saida;
}

btnSalvar.addEventListener("click", async () => {
  btnSalvar.disabled = true;
  try {
    const res = await fetch("/api/colisores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpoParaSalvar()),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.erro || "não salvou");
    dizer("Salvo. Recarrega o jogo pra ver na cidade.");
  } catch (erro) {
    dizer(`Não salvou: ${erro.message || erro}`);
  } finally {
    btnSalvar.disabled = false;
  }
});

buscaEl.addEventListener("input", desenharLista);

function ajustarTela() {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", ajustarTela);
ajustarTela();
renderer.setAnimationLoop(() => {
  controles.update();
  renderer.render(cena, camera);
});

async function iniciar() {
  const res = await fetch("assets/models/colisores.json", { cache: "no-store" });
  if (res.ok) {
    const json = await res.json();
    if (json && typeof json === "object") ajustes = json;
  }
  try {
    await incluirSprites();
  } catch (erro) {
    console.error(erro);
    dizer("Não carregou os prédios 2D");
  }
  desenharLista();
  dizer("Escolha um prédio e puxe a caixa até a porta");
  if (itens.length) abrir(itens[0].id);
}

iniciar();
