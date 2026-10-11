import * as THREE from "three";
import { estaEmCena } from "../../cena/modoCena.js";
import { obterEntradaCena } from "../../cena/registroCena.js";
import {
  aoMudarSelecaoCena,
  nomeBlocoSelecionado,
  obterSelecaoCena,
} from "../../cena/selecaoCena.js";

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const escala = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");
const matriz = new THREE.Matrix4();

let acc = 0;
let forcar = true;
let ultimo = "";

function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function trisGeometria(geo) {
  if (!geo?.attributes?.position) return 0;
  const n = geo.index ? geo.index.count : geo.attributes.position.count;
  return Math.floor(n / 3);
}

function triangulosDe(obj, instanceId) {
  if (!obj) return 0;
  if (obj.isInstancedMesh && instanceId != null) return trisGeometria(obj.geometry);
  let total = 0;
  obj.traverse((filho) => {
    if (!filho.geometry) return;
    const inst = filho.isInstancedMesh ? filho.count | 0 : 1;
    total += trisGeometria(filho.geometry) * inst;
  });
  return total;
}

function chunkDe(nome) {
  const m = /(?:cubos|chunk-real|agua|queda)-(-?\d+),(-?\d+)$/.exec(nome || "");
  if (!m) return null;
  return `${m[1]}, ${m[2]}`;
}

function linhasAtributos() {
  const sel = obterSelecaoCena();
  if (!sel) return null;
  const entrada = obterEntradaCena(sel.id);
  if (!entrada) return null;
  const obj = entrada.objeto;
  const linhas = [
    ["nome", entrada.rotulo],
    ["tipo", entrada.tipo],
    ["pasta", entrada.pasta],
  ];

  if (sel.instanceId != null && obj.isInstancedMesh && entrada.obterInstancia) {
    const item = entrada.obterInstancia(sel.instanceId);
    linhas.push(["instância", String(sel.instanceId)]);
    if (item?.id != null) linhas.push(["id", String(item.id)]);
    if (item?.tipo) linhas.push(["prop", String(item.tipo)]);
    if (item?.sprite) linhas.push(["sprite", String(item.sprite)]);
    if (Number.isFinite(item?.x) && Number.isFinite(item?.y)) {
      linhas.push(["chão", `${fmt(item.x)}  ${fmt(item.y)}`]);
    }
    obj.updateWorldMatrix(true, false);
    if (sel.instanceId < (obj.count | 0)) {
      obj.getMatrixAt(sel.instanceId, matriz);
      matriz.premultiply(obj.matrixWorld);
      matriz.decompose(pos, quat, escala);
    }
  } else {
    obj.updateWorldMatrix(true, false);
    obj.matrixWorld.decompose(pos, quat, escala);
  }

  euler.setFromQuaternion(quat, "YXZ");
  const graus = THREE.MathUtils.radToDeg;
  linhas.push(["posição", `${fmt(pos.x)}  ${fmt(pos.y)}  ${fmt(pos.z)}`]);
  linhas.push(["rotação", `${fmt(graus(euler.x))}°  ${fmt(graus(euler.y))}°  ${fmt(graus(euler.z))}°`]);
  linhas.push(["escala", `${fmt(escala.x)}  ${fmt(escala.y)}  ${fmt(escala.z)}`]);

  const tris = triangulosDe(obj, sel.instanceId);
  if (tris > 0) linhas.push(["triângulos", String(tris)]);

  const chunk = chunkDe(entrada.rotulo);
  if (chunk) linhas.push(["chunk", chunk]);

  if (sel.voxel) {
    linhas.push(["bloco", `${sel.voxel.x}, ${sel.voxel.y}, ${sel.voxel.z}`]);
    linhas.push(["material", nomeBlocoSelecionado(sel.voxel) || "ar"]);
  }

  const sim = obj.userData?.estadoSim;
  if (sim && sel.instanceId == null) {
    linhas.push(["simulação", `${fmt(sim.x)}  ${fmt(sim.y)}  ${fmt(sim.z)}`]);
    if (sim.acao) linhas.push(["ação", sim.acao]);
    const flags = [];
    if (sim.voando) flags.push("voando");
    if (sim.escalando) flags.push("escalando");
    if (sim.nadando) flags.push("nadando");
    if (sim.planando) flags.push("planando");
    if (flags.length) linhas.push(["estado", flags.join(", ")]);
  }

  if (obj.isLight) {
    linhas.push(["intensidade", fmt(obj.intensity)]);
    if (obj.color?.getHexString) linhas.push(["cor", `#${obj.color.getHexString()}`]);
  }

  return linhas;
}

function desenhar(linhas) {
  const raiz = document.getElementById("cena-inspetor");
  if (!raiz) return;
  raiz.replaceChildren();
  if (!linhas) {
    const vazio = document.createElement("p");
    vazio.className = "cena-vazio";
    vazio.textContent = "Nenhum objeto selecionado.";
    raiz.appendChild(vazio);
    return;
  }
  const dl = document.createElement("dl");
  dl.className = "cena-attrs";
  for (let i = 0; i < linhas.length; i++) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = linhas[i][0];
    dd.textContent = linhas[i][1];
    dl.append(dt, dd);
  }
  raiz.appendChild(dl);
}

function publicar() {
  const linhas = linhasAtributos();
  const texto = linhas ? linhas.map((par) => par.join("\t")).join("\n") : "";
  if (texto === ultimo) return;
  ultimo = texto;
  desenhar(linhas);
}

export function ligarInspetorCena() {
  aoMudarSelecaoCena(() => {
    forcar = true;
    ultimo = "";
    if (estaEmCena()) publicar();
  });
}

export function sincronizarInspetorCena(dt) {
  if (!estaEmCena()) return;
  acc += dt;
  if (!forcar && acc < 0.1) return;
  acc = 0;
  forcar = false;
  publicar();
}
