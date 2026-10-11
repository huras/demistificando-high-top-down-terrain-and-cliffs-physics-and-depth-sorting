import { alternarModoCena, aoMudarCena, estaEmCena } from "../../cena/modoCena.js";
import {
  alinharCameraCena,
  obterCameraCena,
  obterVelocidadeCena,
} from "../../cena/cameraCena.js";
import { listarEntradasCena } from "../../cena/registroCena.js";
import { aoMudarSelecaoCena, obterSelecaoCena, selecionarCena } from "../../cena/selecaoCena.js";

const PASTAS = ["Personagens", "Terreno", "Água", "Vegetação", "Céu", "Luzes", "Marcadores"];
const ALTURA = 22;

const fechadas = new Set();
const grupos = new Map(PASTAS.map((pasta) => [pasta, []]));
const pool = [];
let usadas = 0;
let assinatura = "";
const doms = [];
const giroMatriz = new Float32Array(16);

function pegarLinha() {
  let linha = pool[usadas];
  if (!linha) {
    linha = {
      tipo: "",
      chave: "",
      id: "",
      pasta: "",
      texto: "",
      nivel: 0,
      instanceId: null,
      aberta: false,
    };
    pool[usadas] = linha;
  }
  usadas += 1;
  return linha;
}

function compor(busca) {
  usadas = 0;
  for (const lista of grupos.values()) lista.length = 0;
  for (const entrada of listarEntradasCena()) {
    if (!entrada.visivel()) continue;
    const lista = grupos.get(entrada.pasta);
    if (lista) lista.push(entrada);
  }

  const q = busca.trim().toLowerCase();
  const sel = obterSelecaoCena();
  for (const pasta of PASTAS) {
    const lista = grupos.get(pasta);
    if (!lista.length) continue;
    lista.sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
    const filhos = [];
    for (let i = 0; i < lista.length; i++) {
      const entrada = lista[i];
      const rotulo = entrada.objeto.isInstancedMesh
        ? `${entrada.rotulo} (${entrada.objeto.count | 0})`
        : entrada.rotulo;
      if (q && !rotulo.toLowerCase().includes(q) && !pasta.toLowerCase().includes(q)) continue;
      filhos.push({ entrada, rotulo });
    }
    if (!filhos.length) continue;

    const aberta = q.length > 0 || !fechadas.has(pasta);
    const pastaLinha = pegarLinha();
    pastaLinha.tipo = "pasta";
    pastaLinha.pasta = pasta;
    pastaLinha.id = "";
    pastaLinha.instanceId = null;
    pastaLinha.nivel = 0;
    pastaLinha.aberta = aberta;
    pastaLinha.texto = `${pasta}  ${filhos.length}`;
    pastaLinha.chave = `p:${pasta}:${aberta}:${filhos.length}`;
    if (!aberta) continue;

    for (let i = 0; i < filhos.length; i++) {
      const { entrada, rotulo } = filhos[i];
      const linha = pegarLinha();
      linha.tipo = "objeto";
      linha.pasta = pasta;
      linha.id = entrada.id;
      linha.instanceId = null;
      linha.nivel = 1;
      linha.aberta = false;
      linha.texto = rotulo;
      linha.chave = `o:${entrada.id}:${rotulo}`;
      if (sel?.id === entrada.id && sel.instanceId != null) {
        const inst = pegarLinha();
        inst.tipo = "instancia";
        inst.pasta = pasta;
        inst.id = entrada.id;
        inst.instanceId = sel.instanceId;
        inst.nivel = 2;
        inst.aberta = false;
        inst.texto = `instância ${sel.instanceId}`;
        inst.chave = `i:${entrada.id}:${sel.instanceId}`;
      }
    }
  }
  return usadas;
}

function selecionada(linha) {
  const sel = obterSelecaoCena();
  if (!sel || linha.tipo === "pasta") return false;
  if (sel.id !== linha.id) return false;
  if (linha.tipo === "instancia") return sel.instanceId === linha.instanceId;
  return sel.instanceId == null;
}

function pintar() {
  const busca = document.getElementById("cena-busca");
  const lista = document.getElementById("cena-lista");
  const trilho = document.getElementById("cena-lista-trilho");
  if (!busca || !lista || !trilho) return;

  const n = compor(busca.value || "");
  const alto = lista.clientHeight || 1;
  const i0 = Math.max(0, Math.floor(lista.scrollTop / ALTURA) - 4);
  const i1 = Math.min(n, Math.ceil((lista.scrollTop + alto) / ALTURA) + 4);
  const sel = obterSelecaoCena();
  let sig = `${i0}:${i1}:${n}:${busca.value}:${sel?.id ?? ""}:${sel?.instanceId ?? ""}`;
  for (let i = i0; i < i1; i++) sig += `|${pool[i].chave}`;
  if (sig === assinatura) return;
  assinatura = sig;

  trilho.style.height = `${n * ALTURA}px`;
  const visiveis = Math.max(0, i1 - i0);
  while (doms.length < visiveis) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cena-linha";
    btn.addEventListener("click", () => aoCliqueLinha(btn));
    trilho.appendChild(btn);
    doms.push(btn);
  }

  for (let d = 0; d < doms.length; d++) {
    const el = doms[d];
    if (d >= visiveis) {
      el.hidden = true;
      continue;
    }
    const linha = pool[i0 + d];
    el.hidden = false;
    el.style.transform = `translateY(${(i0 + d) * ALTURA}px)`;
    el.style.paddingLeft = `${8 + linha.nivel * 14}px`;
    el.dataset.tipo = linha.tipo;
    el.dataset.id = linha.id;
    el.dataset.pasta = linha.pasta;
    el.dataset.instance = linha.instanceId == null ? "" : String(linha.instanceId);
    el.classList.toggle("cena-linha--pasta", linha.tipo === "pasta");
    el.classList.toggle("cena-linha--ativa", selecionada(linha));
    el.textContent = linha.tipo === "pasta"
      ? `${linha.aberta ? "▾" : "▸"}  ${linha.texto}`
      : linha.texto;
  }
}

function aoCliqueLinha(el) {
  if (el.dataset.tipo === "pasta") {
    const pasta = el.dataset.pasta;
    if (fechadas.has(pasta)) fechadas.delete(pasta);
    else fechadas.add(pasta);
    assinatura = "";
    pintar();
    return;
  }
  const instanceId = el.dataset.instance === "" ? null : Number(el.dataset.instance);
  selecionarCena(el.dataset.id, { instanceId });
}

function matrizInversaCss(q) {
  giroMatriz[0] = 1 - 2 * (q.y * q.y + q.z * q.z);
  giroMatriz[1] = 2 * (q.x * q.y + q.w * q.z);
  giroMatriz[2] = 2 * (q.x * q.z - q.w * q.y);
  giroMatriz[4] = 2 * (q.x * q.y - q.w * q.z);
  giroMatriz[5] = 1 - 2 * (q.x * q.x + q.z * q.z);
  giroMatriz[6] = 2 * (q.y * q.z + q.w * q.x);
  giroMatriz[8] = 2 * (q.x * q.z + q.w * q.y);
  giroMatriz[9] = 2 * (q.y * q.z - q.w * q.x);
  giroMatriz[10] = 1 - 2 * (q.x * q.x + q.y * q.y);
  const e = giroMatriz;
  return `matrix3d(${e[0]},${e[1]},${e[2]},0,${e[4]},${e[5]},${e[6]},0,${e[8]},${e[9]},${e[10]},0,0,0,0,1)`;
}

const qInv = { x: 0, y: 0, z: 0, w: 1 };

function aplicarGiro(q) {
  const giro = document.getElementById("cena-eixos-giro");
  if (!giro) return;
  qInv.x = -q.x;
  qInv.y = -q.y;
  qInv.z = -q.z;
  qInv.w = q.w;
  giro.style.transform = matrizInversaCss(qInv);
}

export function ligarHierarquiaCena() {
  const btn = document.getElementById("btn-cena");
  btn?.addEventListener("click", () => {
    if (document.body.dataset.modo !== "3d") return;
    alternarModoCena();
  });
  aoMudarCena((ativo) => {
    btn?.setAttribute("aria-pressed", ativo ? "true" : "false");
    assinatura = "";
    if (ativo) pintar();
  });
  document.getElementById("cena-busca")?.addEventListener("input", () => {
    assinatura = "";
    pintar();
  });
  document.getElementById("cena-lista")?.addEventListener("scroll", () => {
    pintar();
  }, { passive: true });
  document.getElementById("cena-eixos")?.addEventListener("click", (ev) => {
    const alvo = ev.target.closest?.("[data-eixo]");
    if (!alvo) return;
    alinharCameraCena(alvo.dataset.eixo);
  });
  aoMudarSelecaoCena(() => {
    assinatura = "";
    if (estaEmCena()) pintar();
  });
}

export function sincronizarHierarquiaCena() {
  if (!estaEmCena()) return;
  pintar();
  const cam = obterCameraCena();
  aplicarGiro(cam.quaternion);
  const vel = document.getElementById("cena-vel");
  if (!vel) return;
  const texto = `${obterVelocidadeCena().toFixed(1)} u/s`;
  if (vel.textContent !== texto) vel.textContent = texto;
}
