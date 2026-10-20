import * as THREE from "three";
import { BILLBOARD_INCLINACAO } from "../config.js";
import { pivoDaImagem } from "../render/pivoPe.js";
import {
  definirPivosProps,
  geometriaNoPe,
  poseCartao,
} from "../render/3d/billboard/indice.js";

const ZOOM = 4;

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("lista");
const buscaEl = document.getElementById("busca");
const coordsEl = document.getElementById("coords");
const canvas = document.getElementById("vista");
const canvas3d = document.getElementById("vista3d");
const ctx = canvas.getContext("2d");

/** @type {Record<string, { dx: number, dy: number }>} */
let arquivo = {};
/** @type {{ id: string, classe: string, arquivo: string, img?: HTMLImageElement }[]} */
let itens = [];
let escolhido = null;
let arraste = null;
let vistaW = 1;
let vistaH = 1;

let renderer = null;
let cena = null;
let camera = null;
let mesh3d = null;
let chao = null;
let yawPrev = 0.55;
let distPrev = 4.2;

function dizer(texto) {
  statusEl.textContent = texto;
}

function pixel(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(-256, Math.min(256, v)));
}

function leitura(item) {
  const salvo = item ? arquivo[item.id] : null;
  if (!salvo) return { dx: 0, dy: 0 };
  if (Number.isFinite(salvo.pivotX) || Number.isFinite(salvo.pivotY)) {
    if (!item?.img) return { dx: 0, dy: 0 };
    const base = pivoDaImagem(item.img);
    const w = item.img.naturalWidth || item.img.width || 1;
    const h = item.img.naturalHeight || item.img.height || 1;
    const px = Number.isFinite(salvo.pivotX) ? salvo.pivotX : base.x;
    const py = Number.isFinite(salvo.pivotY) ? salvo.pivotY : base.y;
    return {
      dx: pixel((base.x - px) * w),
      dy: pixel((py - base.y) * h),
    };
  }
  return { dx: pixel(salvo.dx), dy: pixel(salvo.dy) };
}

function publicar(item, ajuste) {
  if (!item) return;
  if (ajuste.dx === 0 && ajuste.dy === 0) delete arquivo[item.id];
  else arquivo[item.id] = { dx: ajuste.dx, dy: ajuste.dy };
  coordsEl.textContent = `dx ${ajuste.dx}    dy ${ajuste.dy}`;
  const btn = listaEl.querySelector(`button[data-id="${CSS.escape(item.id)}"]`);
  if (btn) btn.classList.toggle("tem-ajuste", !!arquivo[item.id]);
  definirPivosProps(arquivo);
  atualizarGeo3d();
}

function pivoEfetivo(item) {
  if (!item?.img) return { x: 0.5, y: 1 };
  const base = pivoDaImagem(item.img);
  const aj = leitura(item);
  const w = item.img.naturalWidth || item.img.width || 1;
  const h = item.img.naturalHeight || item.img.height || 1;
  return {
    x: Math.max(0, Math.min(1, base.x - aj.dx / w)),
    y: Math.max(0, Math.min(1, base.y + aj.dy / h)),
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
  const r = canvas.parentElement.getBoundingClientRect();
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
    camera.aspect = metade / Math.max(1, h);
    camera.updateProjectionMatrix();
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
  const dx = cx - pivo.x * dw;
  const dy = cy - pivo.y * dh;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function iniciar3d() {
  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x152018, 1);
  cena = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.05, 80);
  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x3a4a30, 0.85);
  const sol = new THREE.DirectionalLight(0xfff2d0, 1.1);
  sol.position.set(2.5, 4, 1.5);
  cena.add(hemi, sol);
  const chaoGeo = new THREE.PlaneGeometry(8, 8);
  chaoGeo.rotateX(-Math.PI / 2);
  chao = new THREE.Mesh(
    chaoGeo,
    new THREE.MeshLambertMaterial({ color: 0x3a5a3c }),
  );
  chao.position.y = 0;
  cena.add(chao);
  const grade = new THREE.GridHelper(8, 8, 0x5a7a5c, 0x2a3a2c);
  grade.position.y = 0.01;
  cena.add(grade);
}

function soltarMesh3d() {
  if (!mesh3d) return;
  cena.remove(mesh3d);
  mesh3d.geometry?.dispose();
  mesh3d.material?.map?.dispose();
  mesh3d.material?.dispose();
  mesh3d = null;
}

function atualizarGeo3d() {
  if (!cena || !escolhido?.img) {
    soltarMesh3d();
    return;
  }
  const img = escolhido.img;
  const w = img.naturalWidth || img.width || 1;
  const h = img.naturalHeight || img.height || 1;
  const pivo = pivoEfetivo(escolhido);
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
  const escala = Math.max(w, h) / 32;
  poseCartao(mesh3d, {
    x: 0,
    y: 0,
    z: 0,
    largura: (w / 32) * Math.min(1.4, 2.2 / escala),
    altura: (h / 32) * Math.min(1.4, 2.2 / escala),
    yaw: yawPrev,
    inclinacao: BILLBOARD_INCLINACAO,
  });
  cena.add(mesh3d);
}

function desenhar3d() {
  if (!renderer || !camera) return;
  camera.position.set(
    Math.sin(yawPrev) * distPrev,
    distPrev * 0.55,
    Math.cos(yawPrev) * distPrev,
  );
  camera.lookAt(0, 0.6, 0);
  if (mesh3d) {
    poseCartao(mesh3d, {
      x: 0,
      y: 0,
      z: 0,
      largura: mesh3d.scale.x,
      altura: mesh3d.scale.y,
      yaw: yawPrev,
      inclinacao: BILLBOARD_INCLINACAO,
    });
  }
  renderer.render(cena, camera);
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
  if (!item.img) {
    tentarCarregar(item);
  } else {
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
  arraste = { x: ev.clientX, y: ev.clientY, dx: aj.dx, dy: aj.dy };
  canvas.classList.add("arrastando");
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove", (ev) => {
  if (!arraste || !escolhido) return;
  const aj = leitura(escolhido);
  aj.dx = pixel(arraste.dx + (ev.clientX - arraste.x) / ZOOM);
  aj.dy = pixel(arraste.dy + (ev.clientY - arraste.y) / ZOOM);
  publicar(escolhido, aj);
});

canvas.addEventListener("pointerup", () => {
  arraste = null;
  canvas.classList.remove("arrastando");
});

let orbit = null;
canvas3d.addEventListener("pointerdown", (ev) => {
  if (ev.button !== 0) return;
  orbit = { x: ev.clientX, yaw: yawPrev };
  canvas3d.classList.add("arrastando");
  canvas3d.setPointerCapture(ev.pointerId);
});
canvas3d.addEventListener("pointermove", (ev) => {
  if (!orbit) return;
  yawPrev = orbit.yaw + (ev.clientX - orbit.x) * 0.01;
});
canvas3d.addEventListener("pointerup", () => {
  orbit = null;
  canvas3d.classList.remove("arrastando");
});
canvas3d.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    distPrev = Math.max(2, Math.min(10, distPrev + ev.deltaY * 0.004));
  },
  { passive: false },
);

document.getElementById("resetar").addEventListener("click", () => {
  if (!escolhido) return;
  publicar(escolhido, { dx: 0, dy: 0 });
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
      };
    } else {
      arquivo[chaves[i]] = { dx: pixel(item.dx), dy: pixel(item.dy) };
    }
  }
  definirPivosProps(arquivo);
}

async function iniciar() {
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
