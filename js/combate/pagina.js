import { ALTURA_BLOCO } from "../config.js";
import { carregarDados, especie, golpe, listarEspecies } from "../pokemon/dados.js";
import { NIVEL_MAX } from "../pokemon/experiencia.js";
import { flutuantes } from "../pokemon/flutuantes.js";
import { COR_TIPO } from "../pokemon/tipos.js";
import { desenharArena, ligarArena, projetarArena } from "./arena3d.js";
import { atoresArena, estadoLuta, iniciarLuta, logArena, montarLados, tickLuta } from "./luta.js";

const TIPO = {
  normal: "normal",
  fire: "fogo",
  water: "água",
  electric: "elétrico",
  grass: "planta",
  ice: "gelo",
  fighting: "lutador",
  poison: "veneno",
  ground: "terra",
  flying: "voador",
  psychic: "psíquico",
  bug: "inseto",
  rock: "pedra",
  ghost: "fantasma",
  dragon: "dragão",
  dark: "noturno",
  steel: "aço",
  fairy: "fada",
};

const FORMA = {
  contact: "contato",
  projectile: "projétil",
  arc: "arco",
  radius: "área",
};

const CATEGORIA = {
  physical: "físico",
  special: "especial",
  status: "status",
};

const LADOS = ["esquerda", "direita"];
const ui = {
  esquerda: { busca: "", chave: "", nivel: 50, corpo: "", distancia: "" },
  direita: { busca: "", chave: "", nivel: 50, corpo: "", distancia: "" },
};

let especies = [];
let tempo = 1;
let ultimo = 0;
let lutandoAntes = false;

const statusEl = document.getElementById("status");
const botao = document.getElementById("lutar");
const hud = document.getElementById("hud");
const logN = document.getElementById("log-n");
const logLista = document.getElementById("log-lista");
let versaoLog = -1;
const danos = [];

function campo(raiz, nome) {
  return raiz.querySelector(`[data-campo="${nome}"]`);
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function raizDe(lado) {
  return document.getElementById(lado === "esquerda" ? "lado-esquerda" : "lado-direita");
}

function nomeTipo(tipo) {
  return TIPO[tipo] || tipo || "normal";
}

function golpesNoNivel(esp, nivel) {
  const lista = esp?.learnset || [];
  const saida = [];
  const vistos = new Set();
  for (let i = 0; i < lista.length; i++) {
    if ((lista[i][0] | 0) > nivel) continue;
    const chave = lista[i][1];
    if (!chave || vistos.has(chave)) continue;
    const def = golpe(chave);
    if (!def) continue;
    vistos.add(chave);
    saida.push(def);
  }
  return saida;
}

function eCorpo(def) {
  return def.forma === "contact" || def.forma === "radius";
}

function eDistancia(def) {
  return def.forma === "projectile" || def.forma === "arc";
}

function golpesDoTipo(esp, nivel, tipo) {
  const lista = golpesNoNivel(esp, nivel);
  const serve = tipo === "distancia" ? eDistancia : eCorpo;
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].poder > 0 && serve(lista[i])) saida.push(lista[i]);
  }
  return saida;
}

function golpeInicial(esp, nivel, tipo) {
  const lista = golpesDoTipo(esp, nivel, tipo);
  let moderado = "";
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].poder <= 50) moderado = lista[i].key;
  }
  if (moderado) return moderado;
  return lista.length ? lista[lista.length - 1].key : "";
}

function garantirSlot(lado, campoNome, tipo) {
  const chave = ui[lado][campoNome];
  if (!chave) return;
  const lista = golpesDoTipo(especie(ui[lado].chave), ui[lado].nivel, tipo);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].key === chave) return;
  }
  ui[lado][campoNome] = golpeInicial(especie(ui[lado].chave), ui[lado].nivel, tipo);
}

function textoFicha(def, vazio) {
  if (!def) return vazio;
  const forma = FORMA[def.forma] || def.forma;
  const categoria = CATEGORIA[def.categoria] || def.categoria;
  return `${forma} · ${categoria} · poder ${def.poder | 0} · alcance ${Number(def.alcance) || 0} · ${Number(def.recarga) || 0} s · custo ${def.pp || 0} PP`;
}

function corVida(pct) {
  if (pct > 0.5) return "#4ade80";
  if (pct > 0.2) return "#facc15";
  return "#f87171";
}

function textoEstado(lado, ator) {
  const e = estadoLuta();
  if (e.lutando) return "Lutando";
  if (!e.acabou) return "Preparando";
  if (e.vencedor === "empate") return "Caiu";
  if (e.vencedor === lado) return "Venceu";
  return "Caiu";
}

function textoCabecalho() {
  const e = estadoLuta();
  if (!e.esquerda || !e.direita) return "Escolha os dois e lute.";
  if (e.lutando) return "Lutando.";
  if (!e.acabou) return "Arrastar gira · direito move · scroll dá zoom.";
  if (e.vencedor === "empate") return "Os dois caíram.";
  const ator = e.vencedor === "esquerda" ? e.esquerda : e.direita;
  return `${ator.especie.nome} venceu.`;
}

function htmlTipos(esp) {
  const tipos = esp?.tipos || [];
  let html = "";
  for (let i = 0; i < tipos.length; i++) {
    const t = tipos[i];
    const cor = COR_TIPO[t] || "#9ca3af";
    html += `<span class="tipo" style="background:${cor}">${nomeTipo(t)}</span>`;
  }
  return html;
}

function montarColuna(lado) {
  const raiz = raizDe(lado);
  raiz.innerHTML = `
    <header class="lado__topo">
      <div class="lado__retrato" data-campo="retrato"></div>
      <div>
        <h2 class="lado__nome" data-campo="nome">—</h2>
        <div class="lado__tipos" data-campo="tipos"></div>
        <p class="lado__estado" data-campo="estado">Preparando</p>
      </div>
    </header>
    <div class="vida">
      <div class="vida__trilho"><span data-campo="barra"></span></div>
      <p class="vida__num" data-campo="hp">—</p>
      <p class="pp" data-campo="pp">PP —</p>
    </div>
    <div class="stats" data-campo="stats"></div>
    <fieldset class="lado__controles" data-campo="controles">
      <label class="campo">
        Espécie
        <input data-campo="busca" type="search" placeholder="Nome ou número" autocomplete="off" />
      </label>
      <ul class="lista" data-campo="lista"></ul>
      <label class="campo">
        Nível <strong data-campo="nivel-valor">50</strong>
        <input data-campo="nivel" type="range" min="1" max="${NIVEL_MAX}" value="50" />
      </label>
      <label class="campo">
        Corpo a corpo
        <select data-campo="corpo"></select>
        <p class="ficha" data-campo="ficha-corpo"></p>
      </label>
      <label class="campo">
        À distância
        <select data-campo="distancia"></select>
        <p class="ficha" data-campo="ficha-distancia"></p>
      </label>
    </fieldset>
  `;

  campo(raiz, "busca").addEventListener("input", (ev) => {
    ui[lado].busca = ev.target.value;
    pintarLista(lado);
  });
  campo(raiz, "lista").addEventListener("click", (ev) => {
    const botaoEsp = ev.target.closest("button[data-chave]");
    if (!botaoEsp || estadoLuta().lutando) return;
    ui[lado].chave = botaoEsp.dataset.chave;
    ui[lado].corpo = golpeInicial(especie(ui[lado].chave), ui[lado].nivel, "corpo");
    ui[lado].distancia = golpeInicial(especie(ui[lado].chave), ui[lado].nivel, "distancia");
    pintarEscolha(lado);
    aplicar();
  });
  campo(raiz, "nivel").addEventListener("input", (ev) => {
    if (estadoLuta().lutando) return;
    ui[lado].nivel = ev.target.value | 0;
    campo(raiz, "nivel-valor").textContent = String(ui[lado].nivel);
    garantirSlot(lado, "corpo", "corpo");
    garantirSlot(lado, "distancia", "distancia");
    pintarGolpes(lado);
  });
  campo(raiz, "nivel").addEventListener("change", () => {
    if (estadoLuta().lutando) return;
    aplicar();
  });
  campo(raiz, "corpo").addEventListener("change", (ev) => {
    if (estadoLuta().lutando) return;
    ui[lado].corpo = ev.target.value;
    pintarFichaGolpe(lado);
    aplicar();
  });
  campo(raiz, "distancia").addEventListener("change", (ev) => {
    if (estadoLuta().lutando) return;
    ui[lado].distancia = ev.target.value;
    pintarFichaGolpe(lado);
    aplicar();
  });
}

function pintarLista(lado) {
  const raiz = raizDe(lado);
  const lista = campo(raiz, "lista");
  const q = ui[lado].busca.trim().toLowerCase();
  const achados = [];
  let tem = false;
  for (let i = 0; i < especies.length; i++) {
    const esp = especies[i];
    if (esp.key === ui[lado].chave) tem = true;
    if (q) {
      const nome = String(esp.nome || "").toLowerCase();
      const key = String(esp.key || "").toLowerCase();
      const dex = String(esp.dex | 0);
      if (!nome.includes(q) && !key.includes(q) && !dex.includes(q)) continue;
    }
    achados.push(esp);
    if (achados.length >= 40) break;
  }
  if (!tem) {
    const esp = especie(ui[lado].chave);
    if (esp) achados.unshift(esp);
  }
  let html = "";
  for (let i = 0; i < achados.length; i++) {
    const esp = achados[i];
    const ativo = esp.key === ui[lado].chave ? "ativo" : "";
    const dex = String(esp.dex | 0).padStart(3, "0");
    html += `<li><button type="button" class="${ativo}" data-chave="${escapar(esp.key)}">${dex} ${escapar(esp.nome)}</button></li>`;
  }
  lista.innerHTML = html;
}

function pintarSelect(select, lista, escolhido) {
  let html = `<option value="">Nenhum</option>`;
  for (let i = 0; i < lista.length; i++) {
    const def = lista[i];
    const sel = def.key === escolhido ? " selected" : "";
    const forma = FORMA[def.forma] || def.forma;
    html += `<option value="${escapar(def.key)}"${sel}>${escapar(def.nome)} · ${nomeTipo(def.tipo)} · ${escapar(forma)}</option>`;
  }
  select.innerHTML = html;
  select.value = escolhido || "";
}

function pintarGolpes(lado) {
  const raiz = raizDe(lado);
  const esp = especie(ui[lado].chave);
  pintarSelect(campo(raiz, "corpo"), golpesDoTipo(esp, ui[lado].nivel, "corpo"), ui[lado].corpo);
  pintarSelect(campo(raiz, "distancia"), golpesDoTipo(esp, ui[lado].nivel, "distancia"), ui[lado].distancia);
  pintarFichaGolpe(lado);
}

function pintarFichaGolpe(lado) {
  const raiz = raizDe(lado);
  const corpo = ui[lado].corpo ? golpe(ui[lado].corpo) : null;
  const distancia = ui[lado].distancia ? golpe(ui[lado].distancia) : null;
  campo(raiz, "ficha-corpo").textContent = textoFicha(corpo, "Perto, usa Investida.");
  campo(raiz, "ficha-distancia").textContent = textoFicha(distancia, "Sem golpe à distância.");
}

function pintarEscolha(lado) {
  const esp = especie(ui[lado].chave);
  const raiz = raizDe(lado);
  if (!esp) return;
  campo(raiz, "nome").textContent = esp.nome;
  campo(raiz, "tipos").innerHTML = htmlTipos(esp);
  const retrato = campo(raiz, "retrato");
  retrato.style.backgroundImage = `url("/ref/sprites/pokemon-portraits/${esp.dex | 0}.png")`;
  campo(raiz, "nivel").value = String(ui[lado].nivel);
  campo(raiz, "nivel-valor").textContent = String(ui[lado].nivel);
  campo(raiz, "busca").value = ui[lado].busca;
  pintarLista(lado);
  pintarGolpes(lado);
}

function pintarStats(lado) {
  const ator = estadoLuta()[lado];
  const raiz = raizDe(lado);
  if (!ator) return;
  const s = ator.stats;
  campo(raiz, "stats").innerHTML = `
    <span>HP <strong>${ator.hpMax}</strong></span>
    <span>Ataque <strong>${s.ataque}</strong></span>
    <span>Defesa <strong>${s.defesa}</strong></span>
    <span>Atq. Esp. <strong>${s.ataqueEsp}</strong></span>
    <span>Def. Esp. <strong>${s.defesaEsp}</strong></span>
    <span>Velocidade <strong>${s.velocidade}</strong></span>
  `;
}

function pintarVida(lado) {
  const ator = estadoLuta()[lado];
  const raiz = raizDe(lado);
  if (!ator) return;
  const pct = ator.hpMax > 0 ? Math.max(0, ator.hp) / ator.hpMax : 0;
  const barra = campo(raiz, "barra");
  barra.style.width = `${pct * 100}%`;
  barra.style.background = corVida(pct);
  campo(raiz, "hp").textContent = `${Math.max(0, Math.ceil(ator.hp))} / ${ator.hpMax}`;
  campo(raiz, "pp").textContent = `PP ${Math.ceil(ator.pp)} / ${ator.ppMax}`;
  campo(raiz, "estado").textContent = textoEstado(lado, ator);

  const marca = hud.querySelector(`[data-marca="${lado}"]`);
  const pe = ((ator.z || 0) + (ator.hopLift || 0)) * ALTURA_BLOCO;
  const p = projetarArena(ator.x, pe + 2.15, ator.y);
  if (!p) {
    marca.hidden = true;
    return;
  }
  marca.hidden = false;
  marca.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  marca.querySelector(".marca__nome").textContent = ator.especie.nome;
  const miolo = marca.querySelector("span");
  miolo.style.width = `${pct * 100}%`;
  miolo.style.background = corVida(pct);
}

function pintarDanos() {
  const lista = flutuantes();
  for (let i = 0; i < danos.length; i++) {
    const el = danos[i];
    const f = lista[i];
    if (!f) {
      el.hidden = true;
      continue;
    }
    const p = projetarArena(f.x, f.z * ALTURA_BLOCO + 1.35, f.y);
    if (!p) {
      el.hidden = true;
      continue;
    }
    el.hidden = false;
    el.textContent = f.texto;
    el.style.color = f.cor || "#fff";
    el.style.opacity = String(Math.max(0, 1 - f.idade / 0.85));
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }
}

function travar(ativo) {
  for (let i = 0; i < LADOS.length; i++) {
    campo(raizDe(LADOS[i]), "controles").disabled = ativo;
  }
}

function atualizarBotao() {
  const e = estadoLuta();
  botao.disabled = e.lutando;
  if (e.lutando) botao.textContent = "Lutando";
  else if (e.acabou) botao.textContent = "De novo";
  else botao.textContent = "Lutar";
}

function aplicar() {
  if (estadoLuta().lutando) return;
  const esq = especie(ui.esquerda.chave);
  const dir = especie(ui.direita.chave);
  if (!esq || !dir) return;
  montarLados(
    { especie: esq, nivel: ui.esquerda.nivel, corpo: ui.esquerda.corpo, distancia: ui.esquerda.distancia },
    { especie: dir, nivel: ui.direita.nivel, corpo: ui.direita.corpo, distancia: ui.direita.distancia },
  );
  pintarStats("esquerda");
  pintarStats("direita");
  pintarVida("esquerda");
  pintarVida("direita");
  atualizarBotao();
  statusEl.textContent = textoCabecalho();
}

function cfgInicial() {
  let esq = especie("charmander") || especies[0];
  let dir = especie("squirtle") || especies[1] || especies[0];
  if (esq && dir && esq.key === dir.key && especies[1]) dir = especies[1];
  ui.esquerda.chave = esq?.key || "";
  ui.direita.chave = dir?.key || "";
  ui.esquerda.nivel = 50;
  ui.direita.nivel = 50;
  ui.esquerda.corpo = golpeInicial(esq, 50, "corpo");
  ui.direita.corpo = golpeInicial(dir, 50, "corpo");
  ui.esquerda.distancia = golpeInicial(esq, 50, "distancia");
  ui.direita.distancia = golpeInicial(dir, 50, "distancia");
}

function pedaco(cls, texto) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = texto;
  return el;
}

function pintarLog() {
  const { linhas, versao } = logArena();
  if (versao === versaoLog) return;
  versaoLog = versao;
  logN.textContent = String(linhas.length);
  logLista.replaceChildren();
  for (const linha of linhas) {
    const li = document.createElement("li");
    li.dataset.tipo = linha.tipo;
    if (linha.lado) li.dataset.lado = linha.lado;
    li.append(pedaco("log__t", `${linha.selo}s`), pedaco("log__nome", linha.nome));
    if (linha.tipo === "golpe") {
      li.append(document.createTextNode(" usou "));
      const golpe = pedaco("log__golpe", linha.golpe);
      const cor = COR_TIPO[linha.tipoGolpe];
      if (cor) golpe.style.color = cor;
      li.append(golpe);
    } else if (linha.tipo === "dano") {
      const marca = linha.efet ? ` log__dano--${linha.efet}` : "";
      li.append(pedaco(`log__dano${marca}`, ` −${linha.dano}`));
      if (linha.efet === "super") li.append(pedaco("log__efet log__efet--super", " super efetivo"));
      else if (linha.efet === "pouco") li.append(pedaco("log__efet log__efet--pouco", " pouco efetivo"));
      li.append(pedaco("log__meta", ` · recuo ${linha.recuo}s · ${linha.dist} m`));
    } else if (linha.tipo === "imune") {
      li.append(pedaco("log__imune", " imune"));
    } else if (linha.tipo === "cura") {
      li.append(pedaco("log__cura", ` +${linha.ganho}`));
    } else if (linha.tipo === "queda") {
      li.append(pedaco("log__queda", " caiu"));
    }
    logLista.appendChild(li);
  }
  logLista.scrollTop = logLista.scrollHeight;
}

function quadro(t) {
  const bruto = ultimo ? (t - ultimo) / 1000 : 0;
  ultimo = t;
  let resto = Math.min(0.1, bruto * tempo);
  if (!Number.isFinite(resto) || resto < 0) resto = 0;
  while (resto > 1e-4) {
    const passo = Math.min(0.05, resto);
    tickLuta(passo);
    resto -= passo;
  }
  desenharArena(atoresArena());
  pintarLog();
  pintarVida("esquerda");
  pintarVida("direita");
  pintarDanos();
  const lutando = estadoLuta().lutando;
  if (lutandoAntes && !lutando) {
    travar(false);
    atualizarBotao();
    statusEl.textContent = textoCabecalho();
  }
  lutandoAntes = lutando;
  requestAnimationFrame(quadro);
}

function ligarTempo() {
  const botoes = document.querySelectorAll(".tempo button");
  botoes.forEach((el) => {
    el.addEventListener("click", () => {
      tempo = Number(el.dataset.tempo) || 1;
      botoes.forEach((b) => b.classList.toggle("ativo", b === el));
    });
  });
}

function prepararDanos() {
  for (let i = 0; i < 16; i++) {
    const el = document.createElement("div");
    el.className = "dano";
    el.hidden = true;
    hud.appendChild(el);
    danos.push(el);
  }
}

async function iniciar() {
  await carregarDados();
  especies = listarEspecies().sort((a, b) => (a.dex | 0) - (b.dex | 0));
  cfgInicial();
  montarColuna("esquerda");
  montarColuna("direita");
  pintarEscolha("esquerda");
  pintarEscolha("direita");
  ligarArena(document.getElementById("vista"));
  prepararDanos();
  ligarTempo();
  aplicar();
  botao.disabled = false;
  botao.addEventListener("click", () => {
    if (estadoLuta().lutando) return;
    if (!iniciarLuta()) return;
    lutandoAntes = true;
    travar(true);
    atualizarBotao();
    statusEl.textContent = textoCabecalho();
  });
  requestAnimationFrame(quadro);
}

iniciar().catch((erro) => {
  statusEl.textContent = erro?.message || "Não carregou o catálogo.";
});
