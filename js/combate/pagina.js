import { ALTURA_BLOCO } from "../config.js";
import { carregarDados, especie, golpe, listarEspecies } from "../pokemon/dados.js";
import { NIVEL_MAX } from "../pokemon/experiencia.js";
import { flutuantes } from "../pokemon/flutuantes.js";
import { COR_TIPO } from "../pokemon/tipos.js";
import { definirOmbro, desenharArena, ligarArena, projetarArena } from "./arena3d.js";
import { definirMetade, definirSemente } from "./arenas.js";
import { definirNivelIa } from "../pokemon/ia/seletor.js";
import { atoresArena, definirUso, estadoLuta, iniciarLuta, limparInterludio, logArena, montarLados, tickLuta } from "./luta.js";
import { avisoTurno, concluirFoco, definirModoLuta, emFoco, escolherGolpeTurno, enquadramentoTurno, modoTurnos, pedidoEscolha } from "./turnos.js";

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
  esquerda: { busca: "", chave: "", nivel: 50, corpo: "", distancia: "", usaCorpo: true, usaDistancia: true },
  direita: { busca: "", chave: "", nivel: 50, corpo: "", distancia: "", usaCorpo: true, usaDistancia: true },
};

let especies = [];
let tempo = 1;
let ritmo = 1;
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
  if (tipo !== "distancia") return saida;
  const extras = ["swift", "hyperBeam"];
  for (let i = 0; i < extras.length; i++) {
    const def = golpe(extras[i]);
    if (!def || def.poder <= 0 || !eDistancia(def)) continue;
    let tem = false;
    for (let j = 0; j < saida.length; j++) {
      if (saida[j].key === def.key) tem = true;
    }
    if (!tem) saida.push(def);
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
  const acerto = def.acerto === null ? "não erra" : def.acerto ?? 100;
  const base = `${forma} · ${categoria} · poder ${def.poder | 0} · acerto ${acerto} · alcance ${Number(def.alcance) || 0} · custo ${def.pp || 0} PP`;
  if (def.key === "rage") return `${base} · cada golpe recebido enche 1 tubo de ataque, até 6`;
  return base;
}

function slotDoGolpe(ator, chave) {
  const golpes = ator?.golpes || [];
  for (let i = 0; i < golpes.length; i++) {
    if (golpes[i].chave === chave) return golpes[i];
  }
  return null;
}

function pintarRecargaUm(raiz, ator, nome, chave) {
  const barra = campo(raiz, `cd-${nome}`);
  const rotulo = campo(raiz, `cd-${nome}-num`);
  if (!chave) {
    barra.style.width = "0%";
    barra.style.background = "#334155";
    rotulo.textContent = "Sem golpe";
    return;
  }
  const slot = slotDoGolpe(ator, chave);
  const preparando = !!(slot && ator.conjuroSlot === slot && (ator.conjuroRestante || 0) > 0);
  if (preparando) {
    const dur = ator.conjuroDur || 1;
    const u = 1 - Math.max(0, ator.conjuroRestante) / dur;
    barra.style.width = `${Math.max(0, Math.min(1, u)) * 100}%`;
    barra.style.background = "#f59e0b";
    rotulo.textContent = "Preparando";
    return;
  }
  const atirando = !!(slot && ator.jatoSlot === slot && (ator.jatoDur || 0) > 0);
  if (atirando) {
    const dur = ator.jatoDur || 1;
    const u = 1 - Math.max(0, ator.jatoTempo || 0) / dur;
    barra.style.width = `${Math.max(0, Math.min(1, u)) * 100}%`;
    barra.style.background = "#fb923c";
    rotulo.textContent = "Atirando";
    return;
  }
  const recuperando = !!(slot && ator.golpeSlot === slot && (ator.golpeRecRestante || 0) > 0);
  if (recuperando) {
    const dur = ator.golpeRecDur || 1;
    const u = Math.max(0, ator.golpeRecRestante) / dur;
    barra.style.width = `${Math.max(0, Math.min(1, u)) * 100}%`;
    barra.style.background = "#f87171";
    rotulo.textContent = "Recuperando";
    return;
  }
  const custo = slot?.def?.pp || 1;
  const u = Math.max(0, Math.min(1, (ator.pp || 0) / custo));
  barra.style.width = `${u * 100}%`;
  if (u < 1) {
    barra.style.background = "#38bdf8";
    rotulo.textContent = `PP ${Math.floor(ator.pp || 0)}/${custo}`;
  } else {
    barra.style.background = "#7dce6a";
    rotulo.textContent = "Pronto";
  }
}

function pintarRecarga(lado) {
  const ator = estadoLuta()[lado];
  const raiz = raizDe(lado);
  if (!ator) return;
  pintarRecargaUm(raiz, ator, "corpo", ui[lado].corpo);
  pintarRecargaUm(raiz, ator, "distancia", ui[lado].distancia);
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
      <div class="tubos" data-campo="tubos" hidden>
        <span class="tubos__nome">Ataque</span>
        <span class="tubos__trilho"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <div class="esquiva">
        <div class="esquiva__trilho"><span data-campo="esquiva"></span></div>
        <p class="pp" data-campo="esquiva-num">Esquiva 0%</p>
      </div>
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
      <div class="campo" data-campo="bloco-corpo">
        <div class="campo__topo">
          <span>Corpo a corpo</span>
          <label class="uso">
            <input data-campo="usa-corpo" type="checkbox" checked />
            Usar
          </label>
        </div>
        <select data-campo="corpo"></select>
        <p class="ficha" data-campo="ficha-corpo"></p>
        <div class="recarga">
          <div class="recarga__trilho"><span data-campo="cd-corpo"></span></div>
          <p class="pp" data-campo="cd-corpo-num">Pronto</p>
        </div>
      </div>
      <div class="campo" data-campo="bloco-distancia">
        <div class="campo__topo">
          <span>À distância</span>
          <label class="uso">
            <input data-campo="usa-distancia" type="checkbox" checked />
            Usar
          </label>
        </div>
        <select data-campo="distancia"></select>
        <p class="ficha" data-campo="ficha-distancia"></p>
        <div class="recarga">
          <div class="recarga__trilho"><span data-campo="cd-distancia"></span></div>
          <p class="pp" data-campo="cd-distancia-num">Pronto</p>
        </div>
      </div>
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
  campo(raiz, "usa-corpo").addEventListener("change", (ev) => {
    ui[lado].usaCorpo = ev.target.checked;
    pintarFichaGolpe(lado);
    sincronizarUso(lado);
  });
  campo(raiz, "usa-distancia").addEventListener("change", (ev) => {
    ui[lado].usaDistancia = ev.target.checked;
    pintarFichaGolpe(lado);
    sincronizarUso(lado);
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
  const usaCorpo = ui[lado].usaCorpo !== false;
  const usaDistancia = ui[lado].usaDistancia !== false;
  campo(raiz, "usa-corpo").checked = usaCorpo;
  campo(raiz, "usa-distancia").checked = usaDistancia;
  campo(raiz, "bloco-corpo").classList.toggle("campo--off", !usaCorpo);
  campo(raiz, "bloco-distancia").classList.toggle("campo--off", !usaDistancia);
  campo(raiz, "ficha-corpo").textContent = textoFicha(corpo, usaCorpo ? "Sem golpe de corpo a corpo." : "Desligado.");
  campo(raiz, "ficha-distancia").textContent = textoFicha(distancia, usaDistancia ? "Sem golpe à distância." : "Desligado.");
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

function pintarTubos(el, ator) {
  if (!el) return;
  const n = Math.max(0, Math.min(6, ator.estagioAtk || 0));
  el.hidden = !ator.furia && n <= 0;
  const tubos = el.querySelectorAll(".tubos__trilho i");
  for (let i = 0; i < tubos.length; i++) tubos[i].classList.toggle("cheio", i < n);
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
  const carga = Math.max(0, Math.min(1, ator.esquiva || 0));
  const trilha = campo(raiz, "esquiva");
  trilha.style.width = `${carga * 100}%`;
  trilha.style.background = carga >= 1 ? "#7dce6a" : "#67e8f9";
  campo(raiz, "esquiva-num").textContent = carga >= 1 ? "Esquiva pronta" : `Esquiva ${Math.round(carga * 100)}%`;
  campo(raiz, "estado").textContent = textoEstado(lado, ator);
  pintarTubos(campo(raiz, "tubos"), ator);

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
  const miolo = marca.querySelector(".marca__barra span");
  miolo.style.width = `${pct * 100}%`;
  miolo.style.background = corVida(pct);
  const esquiva = marca.querySelector(".marca__esquiva span");
  if (esquiva) {
    esquiva.style.width = `${carga * 100}%`;
    esquiva.style.background = carga >= 1 ? "#7dce6a" : "#67e8f9";
  }
  pintarTubos(marca.querySelector("[data-tubos]"), ator);
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
    const controles = campo(raizDe(LADOS[i]), "controles");
    const lista = controles.querySelectorAll("input, select, button");
    for (let j = 0; j < lista.length; j++) {
      const campoNome = lista[j].dataset.campo;
      if (campoNome === "usa-corpo" || campoNome === "usa-distancia") continue;
      lista[j].disabled = ativo;
    }
  }
}

function atualizarBotao() {
  const e = estadoLuta();
  botao.disabled = e.lutando;
  if (e.lutando) botao.textContent = "Lutando";
  else if (e.acabou) botao.textContent = "De novo";
  else botao.textContent = "Lutar";
  const modos = document.querySelectorAll(".modo-luta button");
  for (let i = 0; i < modos.length; i++) modos[i].disabled = e.lutando;
}

function entradaDe(lado, especieLado) {
  return {
    especie: especieLado,
    nivel: ui[lado].nivel,
    corpo: ui[lado].corpo,
    distancia: ui[lado].distancia,
    usaCorpo: ui[lado].usaCorpo !== false,
    usaDistancia: ui[lado].usaDistancia !== false,
  };
}

function sincronizarUso(lado) {
  if (estadoLuta().lutando) {
    definirUso(lado, ui[lado].usaCorpo !== false, ui[lado].usaDistancia !== false);
    return;
  }
  aplicar();
}

function aplicar() {
  if (estadoLuta().lutando) return;
  const esq = especie(ui.esquerda.chave);
  const dir = especie(ui.direita.chave);
  if (!esq || !dir) return;
  montarLados(entradaDe("esquerda", esq), entradaDe("direita", dir));
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
    } else if (linha.tipo === "erro") {
      li.append(pedaco("log__erro", " errou"));
    } else if (linha.tipo === "dodge") {
      li.append(pedaco("log__dodge", " dodge"));
    } else if (linha.tipo === "cura") {
      li.append(pedaco("log__cura", ` +${linha.ganho}`));
    } else if (linha.tipo === "ataque") {
      li.append(pedaco("log__ataque", ` ataque +${linha.estagio}`));
    } else if (linha.tipo === "queda") {
      li.append(pedaco("log__queda", " caiu"));
    } else if (linha.tipo === "carregar") {
      li.append(pedaco("log__carregar", " carregando"));
    }
    logLista.appendChild(li);
  }
  logLista.scrollTop = logLista.scrollHeight;
}

function poseDoQuadro() {
  const e = estadoLuta();
  if (e.acabou && e.esquerda && e.direita) {
    return { tipo: "teatro", a: e.esquerda, b: e.direita, giro: Math.PI * 0.12 };
  }
  return enquadramentoTurno();
}

function andarRitmo(bruto) {
  if (!modoTurnos() || !estadoLuta().lutando) {
    ritmo = 1;
    return;
  }
  if (emFoco()) {
    ritmo = Math.max(0, ritmo - bruto / 0.5);
    if (ritmo <= 0.02) {
      ritmo = 0;
      concluirFoco();
      limparInterludio();
    }
    return;
  }
  if (pedidoEscolha()) {
    ritmo = 0;
    return;
  }
  if (ritmo < 1) ritmo = Math.min(1, ritmo + bruto / 0.4);
}

function quadro(t) {
  const bruto = ultimo ? (t - ultimo) / 1000 : 0;
  ultimo = t;
  andarRitmo(bruto);
  const pedido = pedidoEscolha();
  let resto = pedido ? 0 : Math.min(0.1, bruto * tempo * ritmo);
  if (!Number.isFinite(resto) || resto < 0) resto = 0;
  while (resto > 1e-4) {
    if (pedidoEscolha()) break;
    const passo = Math.min(0.05, resto);
    tickLuta(passo);
    resto -= passo;
  }
  definirOmbro(poseDoQuadro(), bruto);
  desenharArena(atoresArena());
  pintarTurno(pedidoEscolha(), avisoTurno());
  pintarLog();
  pintarVida("esquerda");
  pintarVida("direita");
  pintarRecarga("esquerda");
  pintarRecarga("direita");
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

function ligarMetades() {
  const lados = ["esquerda", "direita"];
  for (let i = 0; i < lados.length; i++) {
    const lado = lados[i];
    const el = document.getElementById(`metade-${lado}`);
    el.addEventListener("change", () => definirMetade(lado, el.value));
  }
  const semente = document.getElementById("semente-cobertura");
  semente.addEventListener("change", () => {
    const n = Math.max(0, Math.floor(Number(semente.value) || 0));
    semente.value = String(n);
    definirSemente(n);
  });
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

function ligarNivel() {
  const botoes = document.querySelectorAll(".nivel-ia button");
  botoes.forEach((el) => {
    el.addEventListener("click", () => {
      definirNivelIa(el.dataset.nivel);
      botoes.forEach((b) => b.classList.toggle("ativo", b === el));
    });
  });
  definirNivelIa("dificil");
}

let versaoMenu = -1;

function textoAcerto(acerto) {
  const n = Number(acerto);
  if (!Number.isFinite(n) || n > 100) return "sempre";
  return `${n}%`;
}

function pintarTurno(pedido, aviso) {
  const painel = document.getElementById("turno");
  if (aviso) {
    painel.hidden = false;
    if (aviso.versao === versaoMenu && painel.dataset.modo === "carregar") return;
    versaoMenu = aviso.versao;
    painel.dataset.modo = "carregar";
    document.getElementById("turno-titulo").textContent = aviso.titulo;
    document.getElementById("turno-golpes").replaceChildren();
    return;
  }
  if (!pedido) {
    painel.hidden = true;
    painel.dataset.modo = "";
    versaoMenu = -1;
    return;
  }
  painel.hidden = false;
  if (pedido.versao === versaoMenu && painel.dataset.modo === "escolha") return;
  versaoMenu = pedido.versao;
  painel.dataset.modo = "escolha";
  document.getElementById("turno-titulo").textContent = `Seu turno · PP ${Math.ceil(pedido.pp)}`;
  const caixa = document.getElementById("turno-golpes");
  caixa.replaceChildren();
  for (let i = 0; i < pedido.golpes.length; i++) {
    const golpeAtual = pedido.golpes[i];
    const botaoGolpe = document.createElement("button");
    botaoGolpe.type = "button";
    botaoGolpe.dataset.golpe = golpeAtual.chave;
    const nome = document.createElement("span");
    nome.className = "turno__nome";
    nome.textContent = golpeAtual.nome;
    const meta = document.createElement("span");
    meta.className = "turno__meta";
    const forma = FORMA[golpeAtual.forma] || golpeAtual.forma;
    const tipo = TIPO[golpeAtual.tipo] || golpeAtual.tipo;
    meta.textContent = `${tipo} · ${forma} · poder ${golpeAtual.poder} · ${textoAcerto(golpeAtual.acerto)} · PP ${golpeAtual.custo}`;
    botaoGolpe.append(nome, meta);
    caixa.appendChild(botaoGolpe);
  }
}

function ligarTurno() {
  const caixa = document.getElementById("turno-golpes");
  caixa.addEventListener("click", (ev) => {
    const botaoGolpe = ev.target.closest("button");
    if (!botaoGolpe || !caixa.contains(botaoGolpe)) return;
    escolherGolpeTurno(botaoGolpe.dataset.golpe);
  });
}

function ligarModo() {
  const botoes = document.querySelectorAll(".modo-luta button");
  botoes.forEach((el) => {
    el.addEventListener("click", () => {
      if (estadoLuta().lutando) return;
      definirModoLuta(el.dataset.modo);
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
  ligarNivel();
  ligarModo();
  ligarTurno();
  ligarMetades();
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
