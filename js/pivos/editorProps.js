import * as THREE from "three";
import { BILLBOARD_INCLINACAO } from "../config.js";
import { pivoDaImagem } from "../render/pivoPe.js";
import {
  alturaPivoAcimaChao,
  definirPivosProps,
  geometriaNoPe,
  poseCartao,
} from "../render/3d/billboard/indice.js";

const ZOOM = 4;
/** Billboard sempre olha pra +Z fixo — a órbita da vista NÃO gira o cartão. */
const YAW_BILLBOARD = 0;

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista");
const buscaEl = document.getElementById("busca");
const coordsEl = document.getElementById("coords");
const dxRangeEl = document.getElementById("dx-range");
const dyRangeEl = document.getElementById("dy-range");
const dzRangeEl = document.getElementById("dz-range");
const dxNumEl = document.getElementById("dx-num");
const dyNumEl = document.getElementById("dy-num");
const dzNumEl = document.getElementById("dz-num");
const dxValorEl = document.getElementById("dx-valor");
const dyValorEl = document.getElementById("dy-valor");
const dzValorEl = document.getElementById("dz-valor");
const canvas = document.getElementById("vista");
const canvas3d = document.getElementById("vista3d");
const ctx = canvas.getContext("2d");

let syncingHud = false;

/** @type {Record<string, { dx?: number, dy?: number, dz?: number, pivotX?: number, pivotY?: number }>} */
let arquivo = {};
/** @type {{ id: string, classe: string, arquivo: string, img?: HTMLImageElement }[]} */
let itens = [];
let escolhido = null;
let arraste = null;
let vistaW = 1;
let vistaH = 1;

let renderer = null;
let cena = null;
let cameraVista = null;
let mesh3d = null;
let gizmoAzul = null;
let marcaChao = null;
let azVista = 0.9;
let polVista = 0.55;
let distVista = 4.5;

function dizer(texto) {
  statusEl.textContent = texto;
}

function pixel(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(-256, Math.min(256, v)));
}

function celulaDz(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-4, Math.min(4, Math.round(v * 100) / 100));
}

function leitura(item) {
  const salvo = item ? arquivo[item.id] : null;
  if (!salvo) return { dx: 0, dy: 0, dz: 0 };
  const dz = celulaDz(salvo.dz);
  if (Number.isFinite(salvo.pivotX) || Number.isFinite(salvo.pivotY)) {
    if (!item?.img) return { dx: 0, dy: 0, dz };
    const base = pivoDaImagem(item.img);
    const w = item.img.naturalWidth || item.img.width || 1;
    const h = item.img.naturalHeight || item.img.height || 1;
    const px = Number.isFinite(salvo.pivotX) ? salvo.pivotX : base.x;
    const py = Number.isFinite(salvo.pivotY) ? salvo.pivotY : base.y;
    return {
      dx: pixel((base.x - px) * w),
      dy: pixel((py - base.y) * h),
      dz,
    };
  }
  return { dx: pixel(salvo.dx), dy: pixel(salvo.dy), dz };
}

function expandirRange(el, valor, teto = 256) {
  const v = Math.abs(valor);
  let lim = Math.max(128, Number(el.max) || 128);
  while (v > lim && lim < teto) lim = Math.min(teto, lim * 2);
  el.min = String(-lim);
  el.max = String(lim);
}

function mostrarHud(ajuste) {
  const dx = pixel(ajuste?.dx);
  const dy = pixel(ajuste?.dy);
  const dz = celulaDz(ajuste?.dz);
  syncingHud = true;
  expandirRange(dxRangeEl, dx);
  expandirRange(dyRangeEl, dy);
  dxRangeEl.value = String(dx);
  dyRangeEl.value = String(dy);
  dzRangeEl.value = String(dz);
  dxNumEl.value = String(dx);
  dyNumEl.value = String(dy);
  dzNumEl.value = String(dz);
  dxValorEl.textContent = String(dx);
  dyValorEl.textContent = String(dy);
  dzValorEl.textContent = dz.toFixed(2);
  coordsEl.textContent = `dx ${dx} · dy ${dy} · dz ${dz.toFixed(2)}`;
  syncingHud = false;
}

function publicar(item, ajuste) {
  if (!item) return;
  const dx = pixel(ajuste.dx);
  const dy = pixel(ajuste.dy);
  const dz = celulaDz(ajuste.dz);
  if (dx === 0 && dy === 0 && dz === 0) delete arquivo[item.id];
  else {
    const out = { dx, dy };
    if (dz !== 0) out.dz = dz;
    arquivo[item.id] = out;
  }
  mostrarHud({ dx, dy, dz });
  const btn = listaEl.querySelector(`button[data-id="${CSS.escape(item.id)}"]`);
  if (btn) btn.classList.toggle("tem-ajuste", !!arquivo[item.id]);
  definirPivosProps(arquivo);
  atualizarGeo3d();
}

function pivoEfetivo(item) {
  if (!item?.img) return { x: 0.5, y: 1, dz: 0, opacoY: 1 };
  const base = pivoDaImagem(item.img);
  const aj = leitura(item);
  const w = item.img.naturalWidth || item.img.width || 1;
  const h = item.img.naturalHeight || item.img.height || 1;
  return {
    x: Math.max(0, Math.min(1, base.x - aj.dx / w)),
    y: Math.max(0, Math.min(1, base.y + aj.dy / h)),
    dz: aj.dz,
    opacoY: base.y,
  };
}

function pintarLista() {
  const q = (buscaEl.value || "").trim().toLowerCase();
  listaEl.innerHTML = "";
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    if (q && !item.id.toLowerCase().includes(q) && !item.classe.toLowerCase().includes(q)) {
      continue;
    }
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = item.id;
    btn.textContent = `${item.id} · ${item.classe}`;
    btn.classList.toggle("ativo", escolhido?.id === item.id);
    btn.classList.toggle("tem-ajuste", !!arquivo[item.id]);
    li.appendChild(btn);
    listaEl.appendChild(li);
  }
}

function redimensionar() {
  const r = canvas.parentElement.parentElement.getBoundingClientRect();
  const metade = Math.max(1, Math.floor(r.width / 2));
  const h = Math.max(1, Math.floor(r.height));
  vistaW = metade;
  vistaH = h;
  canvas.width = metade;
  canvas.height = h;
  canvas3d.width = metade;
  canvas3d.height = h;
  if (renderer) {
    renderer.setSize(metade, h, false);
    cameraVista.aspect = metade / Math.max(1, h);
    cameraVista.updateProjectionMatrix();
  }
}

function desenhar2d() {
  ctx.clearRect(0, 0, vistaW, vistaH);
  ctx.fillStyle = "#0e1411";
  ctx.fillRect(0, 0, vistaW, vistaH);
  const cx = vistaW * 0.5;
  const cy = vistaH * 0.72;
  ctx.strokeStyle = "#7dce6a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy);
  ctx.lineTo(cx + 18, cy);
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx, cy + 18);
  ctx.stroke();
  ctx.strokeStyle = "#314038";
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(vistaW, cy);
  ctx.stroke();

  if (!escolhido?.img) return;
  const img = escolhido.img;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const pivo = pivoEfetivo(escolhido);
  const dw = w * ZOOM;
  const dh = h * ZOOM;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, cx - pivo.x * dw, cy - pivo.y * dh, dw, dh);
}

function iniciar3d() {
  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x152018, 1);
  cena = new THREE.Scene();
  cameraVista = new THREE.PerspectiveCamera(40, 1, 0.05, 80);
  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x3a4a30, 0.85);
  const sol = new THREE.DirectionalLight(0xfff2d0, 1.1);
  sol.position.set(2.5, 4, 1.5);
  cena.add(hemi, sol);
  const chaoGeo = new THREE.PlaneGeometry(8, 8);
  chaoGeo.rotateX(-Math.PI / 2);
  cena.add(new THREE.Mesh(chaoGeo, new THREE.MeshLambertMaterial({ color: 0x3a5a3c })));
  const grade = new THREE.GridHelper(8, 8, 0x5a7a5c, 0x2a3a2c);
  grade.position.y = 0.01;
  cena.add(grade);

  // Linha azul: centro mundo → pivô elevado (como no diagrama).
  const azulGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  gizmoAzul = new THREE.Line(azulGeo, new THREE.LineBasicMaterial({ color: 0x4aa3ff }));
  cena.add(gizmoAzul);

  const anel = new THREE.RingGeometry(0.08, 0.14, 24);
  anel.rotateX(-Math.PI / 2);
  marcaChao = new THREE.Mesh(anel, new THREE.MeshBasicMaterial({ color: 0x4aa3ff, side: THREE.DoubleSide }));
  marcaChao.position.y = 0.02;
  cena.add(marcaChao);

  // Seta fixa: direção pra onde o billboard olha (+Z).
  const seta = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.05, 0), 1.2, 0xff8866);
  cena.add(seta);
}

function soltarMesh3d() {
  if (!mesh3d) return;
  cena.remove(mesh3d);
  mesh3d.geometry?.dispose();
  mesh3d.material?.map?.dispose();
  mesh3d.material?.dispose();
  mesh3d = null;
}

function medidasCartao(img) {
  const w = img.naturalWidth || img.width || 1;
  const h = img.naturalHeight || img.height || 1;
  const escala = Math.max(w, h) / 32;
  const f = Math.min(1.4, 2.2 / escala);
  return { largura: (w / 32) * f, altura: (h / 32) * f };
}

function atualizarGeo3d() {
  if (!cena || !escolhido?.img) {
    soltarMesh3d();
    return;
  }
  const img = escolhido.img;
  const pivo = pivoEfetivo(escolhido);
  const { largura, altura } = medidasCartao(img);
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const geo = geometriaNoPe(pivo.x, pivo.y);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 1,
    metalness: 0,
    transparent: false,
    alphaTest: 0.12,
    side: THREE.FrontSide,
  });
  soltarMesh3d();
  mesh3d = new THREE.Mesh(geo, mat);
  mesh3d.rotation.order = "YXZ";
  cena.add(mesh3d);
  aplicarPoseEstudo(pivo, largura, altura);
}

function aplicarPoseEstudo(pivo, largura, altura) {
  if (!mesh3d) return;
  poseCartao(mesh3d, {
    x: 0,
    y: 0,
    z: 0,
    largura,
    altura,
    yaw: YAW_BILLBOARD,
    inclinacao: BILLBOARD_INCLINACAO,
    pivotY: pivo.y,
    opacoY: pivo.opacoY,
    dz: pivo.dz,
    elevado: true,
  });
  const lift = alturaPivoAcimaChao(pivo.y, altura, BILLBOARD_INCLINACAO, pivo.opacoY);
  if (gizmoAzul) {
    const pos = gizmoAzul.geometry.attributes.position;
    pos.setXYZ(0, 0, 0, 0);
    pos.setXYZ(1, 0, lift, 0);
    pos.needsUpdate = true;
    gizmoAzul.geometry.computeBoundingSphere();
  }
}

function desenhar3d() {
  if (!renderer || !cameraVista) return;
  const x = Math.sin(azVista) * Math.cos(polVista) * distVista;
  const y = Math.sin(polVista) * distVista + 0.4;
  const z = Math.cos(azVista) * Math.cos(polVista) * distVista;
  cameraVista.position.set(x, y, z);
  cameraVista.lookAt(0, 0.7, 0);

  // Billboard NÃO segue a câmera da vista — fica fixo em YAW_BILLBOARD.
  if (mesh3d && escolhido?.img) {
    const pivo = pivoEfetivo(escolhido);
    const m = medidasCartao(escolhido.img);
    aplicarPoseEstudo(pivo, m.largura, m.altura);
  }
  renderer.render(cena, cameraVista);
}

function quadro() {
  desenhar2d();
  desenhar3d();
  requestAnimationFrame(quadro);
}

async function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = encodeURI(url);
  });
}

async function escolher(id) {
  const item = itens.find((x) => x.id === id);
  if (!item) return;
  escolhido = item;
  pintarLista();
  if (!item.img) tentarCarregar(item);
  else {
    publicar(item, leitura(item));
    atualizarGeo3d();
  }
  dizer(`${item.id} (${item.classe})`);
}

async function tentarCarregar(item) {
  dizer(`Carregando ${item.id}…`);
  try {
    item.img = await carregarImagem(item.arquivo);
    if (escolhido?.id === item.id) {
      publicar(item, leitura(item));
      atualizarGeo3d();
      dizer(`${item.id} (${item.classe})`);
    }
  } catch {
    dizer(`Falhou: ${item.arquivo}`);
  }
}

listaEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn?.dataset.id) return;
  escolher(btn.dataset.id);
});

buscaEl.addEventListener("input", pintarLista);

canvas.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0 || !escolhido?.img) return;
  const aj = leitura(escolhido);
  arraste = { x: ev.clientX, y: ev.clientY, dx: aj.dx, dy: aj.dy, dz: aj.dz };
  canvas.classList.add("arrastando");
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove", (ev) => {
  if (!arraste || !escolhido) return;
  publicar(escolhido, {
    dx: pixel(arraste.dx + (ev.clientX - arraste.x) / ZOOM),
    dy: pixel(arraste.dy - (ev.clientY - arraste.y) / ZOOM),
    dz: arraste.dz,
  });
});

canvas.addEventListener("pointerup", () => {
  arraste = null;
  canvas.classList.remove("arrastando");
});

function ligarDxDy(rangeEl, numEl, eixo) {
  rangeEl.addEventListener("input", () => {
    if (syncingHud || !escolhido) return;
    numEl.value = rangeEl.value;
    const aj = leitura(escolhido);
    if (eixo === "dx") aj.dx = pixel(rangeEl.value);
    else aj.dy = pixel(rangeEl.value);
    publicar(escolhido, aj);
  });
  numEl.addEventListener("input", () => {
    if (syncingHud || !escolhido) return;
    const v = pixel(numEl.value);
    expandirRange(rangeEl, v);
    rangeEl.value = String(v);
    const aj = leitura(escolhido);
    if (eixo === "dx") aj.dx = v;
    else aj.dy = v;
    publicar(escolhido, aj);
  });
}

ligarDxDy(dxRangeEl, dxNumEl, "dx");
ligarDxDy(dyRangeEl, dyNumEl, "dy");

function ligarDz() {
  const aplicar = () => {
    if (syncingHud || !escolhido) return;
    const aj = leitura(escolhido);
    aj.dz = celulaDz(dzNumEl.value);
    publicar(escolhido, aj);
  };
  dzRangeEl.addEventListener("input", () => {
    if (syncingHud || !escolhido) return;
    dzNumEl.value = dzRangeEl.value;
    const aj = leitura(escolhido);
    aj.dz = celulaDz(dzRangeEl.value);
    publicar(escolhido, aj);
  });
  dzNumEl.addEventListener("input", () => {
    if (syncingHud || !escolhido) return;
    const v = celulaDz(dzNumEl.value);
    dzRangeEl.value = String(Math.max(0, Math.min(2, v)));
    aplicar();
  });
}

ligarDz();

let orbit = null;
canvas3d.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0) return;
  orbit = { x: ev.clientX, y: ev.clientY, az: azVista, pol: polVista };
  canvas3d.classList.add("arrastando");
  canvas3d.setPointerCapture(ev.pointerId);
});
canvas3d.addEventListener("pointermove", (ev) => {
  if (!orbit) return;
  azVista = orbit.az - (ev.clientX - orbit.x) * 0.01;
  polVista = Math.max(0.12, Math.min(1.35, orbit.pol + (ev.clientY - orbit.y) * 0.008));
});
canvas3d.addEventListener("pointerup", () => {
  orbit = null;
  canvas3d.classList.remove("arrastando");
});
canvas3d.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    distVista = Math.max(2, Math.min(12, distVista + ev.deltaY * 0.004));
  },
  { passive: false },
);

document.getElementById("resetar").addEventListener("click", () => {
  if (!escolhido) return;
  publicar(escolhido, { dx: 0, dy: 0, dz: 0 });
});

document.getElementById("salvar").addEventListener("click", async () => {
  dizer("Salvando…");
  const res = await fetch("/api/pivos-props", {
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
  dizer(n ? `Salvo. ${n} prop${n === 1 ? "" : "s"} com ajuste.` : "Salvo. Nenhum ajuste.");
});

function aceitarArquivo(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return;
  const chaves = Object.keys(json);
  for (let i = 0; i < chaves.length; i++) {
    const item = json[chaves[i]];
    if (!item || typeof item !== "object") continue;
    if (Number.isFinite(item.pivotX) || Number.isFinite(item.pivotY)) {
      arquivo[chaves[i]] = {
        pivotX: Number(item.pivotX),
        pivotY: Number(item.pivotY),
        dz: celulaDz(item.dz),
      };
    } else {
      arquivo[chaves[i]] = {
        dx: pixel(item.dx),
        dy: pixel(item.dy),
        dz: celulaDz(item.dz),
      };
    }
  }
  definirPivosProps(arquivo);
}

async function iniciar() {
  mostrarHud({ dx: 0, dy: 0, dz: 0 });
  iniciar3d();
  redimensionar();
  window.addEventListener("resize", redimensionar);
  const [pivoRes, kitsRes] = await Promise.all([
    fetch("/assets/props/pivos.json", { cache: "no-store" }),
    fetch("/biomas/kits.json", { cache: "no-store" }),
  ]);
  if (pivoRes.ok) aceitarArquivo(await pivoRes.json());
  if (!kitsRes.ok) throw new Error("biomas/kits.json indisponível");
  const kits = await kitsRes.json();
  const mapa = kits.sprites || {};
  itens = Object.keys(mapa)
    .map((id) => ({
      id,
      classe: mapa[id].classe || "prop",
      arquivo: mapa[id].arquivo,
    }))
    .filter((x) => x.arquivo)
    .sort((a, b) => a.classe.localeCompare(b.classe) || a.id.localeCompare(b.id));
  pintarLista();
  if (itens.length) await escolher(itens[0].id);
  else dizer("Nenhum sprite em kits.json");
  requestAnimationFrame(quadro);
}

iniciar().catch((erro) => dizer(String(erro.message || erro)));
