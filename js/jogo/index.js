/** Fachada que o loop chama. Trava o mundo quando a interface ou a sala está aberta. */

import { teclaAgora, teclaBaixa } from "../entrada/teclado.js";
import { lerMixClima } from "../render/3d/ceu/clima.js";
import { obterClima } from "../render/3d/ceu/controleCeu.js";
import { zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { alternarMudo, atualizarAudio, chaveBgm, definirBgm, destravarAudio, estaMudo } from "./audio.js";
import { tickBlocos } from "./blocos.js";
import { atualizarBillboardsBerry } from "./billboards.js";
import {
  celulaAlvo,
  dicaFerramenta,
  entradaPerto,
  plantarOuColher,
  colherSilvestre,
  checarSaidaSala,
  sairInterior,
  tentarEntrar,
  tickCampo,
} from "./campo.js";
import {
  abrirPainel,
  alternarSlot,
  aoMudar,
  carregar,
  estado,
  fecharTopo,
  registrarParty,
  salvar,
  soltarSlotVazio,
  uiAberta,
} from "./estado.js";
import { ligarRoda, tickRoda } from "./roda.js";
import { desenharSala, ligarSala, moverSala, pertoDe, redimensionarSala } from "./sala.js";
import { alvoLaboratorio, executarAlvoLaboratorio } from "./laboratorio.js";
import { alvoDoHub, executarAlvoHub, promptDoHub } from "./hub.js";
import { atualizarCuraMaquina, curaOcupada } from "./maquinaCura.js";
import { promptDoLaboratorio } from "../mundo/cidade/laboratorio.js";
import { fecharCartaGanho, tickGanho } from "./ganhoItem.js";
import { acaoContexto, acaoConsomeE } from "./acaoContexto.js";
import { tentarEntrarSantuario } from "../santuario/entrar.js";
import { reclamarTotem } from "../santuario/gemas.js";
import { tickFeixe, feixeAtivo } from "../santuario/feixe.js";
import { atualizarBussolaSantuario } from "../santuario/bussolaHud.js";
import { puzzleSantuarioAberto } from "../santuario/puzzleModal.js";
import { tickDescobertaMapa } from "../mapa/descoberta.js";
import { avancarDialogo, atualizarLeve, definirCorpo, falarCom, lerPlaca, ligarUi, pintar, promptDe } from "./ui.js";
import {
  abrirMapa,
  cancelarConfirmacaoMapa,
  fecharMapa,
  mapaAberto,
  mapaViajando,
  zoomMapa,
} from "../ui/mapa/mapaMundo.js";
import { teleporteOcupado } from "./teleporte.js";
import { toggleMenu, semearDexParty } from "./apiHud.js";
import { bootHudCompleto, tickHudCampo } from "./hud/bootHud.js";
import { jogadorMorto } from "./hud/morte.js";
import { tickRide } from "./ride.js";
import { FORCA } from "../config.js";
import {
  iniciarForca,
  tickForca,
  promptForca,
  definirPonteiroForca,
} from "../forca/tickForca.js";
import { t } from "./i18n.js";

let viewport = null;
let toastAte = 0;

function campoFocado() {
  const el = document.activeElement;
  if (el?.tagName === "TEXTAREA") return true;
  if (el?.tagName !== "INPUT") return false;
  const tipo = el.type;
  return tipo === "text" || tipo === "search" || tipo === "number" || tipo === "password";
}

export function jogoTravaMundo() {
  // uiAberta() já inclui menu/dex/status
  return uiAberta() || mapaAberto() || teleporteOcupado();
}

function pintarBotaoSom(botao) {
  const off = estaMudo();
  botao.setAttribute("aria-pressed", off ? "true" : "false");
  botao.setAttribute(
    "aria-label",
    off ? "Ligar música e efeitos sonoros" : "Desligar música e efeitos sonoros",
  );
  botao.title = off ? "Som desligado" : "Música e efeitos";
}

function ligarBotaoSom() {
  const botao = document.getElementById("btn-som");
  if (!botao) return;
  pintarBotaoSom(botao);
  botao.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  botao.addEventListener("click", () => {
    alternarMudo();
    pintarBotaoSom(botao);
  });
}

export function montarJogo(opts) {
  viewport = opts.viewport;
  const overlay = document.getElementById("jogo-hud");
  ligarUi(overlay);
  ligarRoda();
  ligarSala(document.getElementById("jogo-sala"));
  bootHudCompleto();
  carregar();
  semearDexParty();
  iniciarForca(FORCA);
  aoMudar(pintar);
  pintar();
  ligarBotaoSom();
  window.addEventListener("pointerdown", destravarAudio, { once: true });
  window.addEventListener("keydown", destravarAudio, { once: true });
  window.addEventListener("beforeunload", () => salvar());
  const rect = viewport?.getBoundingClientRect();
  redimensionarSala(Math.floor(rect?.width || 960), Math.floor(rect?.height || 540));
}

export function tickJogo(dt, corpo) {
  atualizarCuraMaquina(dt);
  tickGanho(dt);
  definirCorpo(corpo);
  tickRide(dt);
  tickHudCampo(dt, corpo);
  registrarParty();
  soltarSlotVazio();
  tickCampo(dt);
  if (!campoFocado() && !jogadorMorto()) {
    tickForca(dt, corpo, { trava: jogoTravaMundo() || !!estado.interior });
  }
  tickDescobertaMapa(corpo, { interior: !!estado.interior });
  tickBlocos(corpo, dt);
  if (!campoFocado()) {
    tickRoda();
    lerTeclas(corpo);
  }
  if (estado.interior?.sala3d) {
    checarSaidaSala(corpo);
  } else if (
    estado.interior &&
    !estado.dialogo &&
    !estado.painel &&
    !estado.construir &&
    !estado.craft &&
    !mapaAberto()
  ) {
    moverSala(dt);
    if (estado.interior?.saindo) sairInterior(corpo);
  }
  let porta = null;
  const livre =
    !estado.interior &&
    !estado.dialogo &&
    !estado.painel &&
    !estado.construir &&
    !estado.craft &&
    !corpo.escalando &&
    !corpo.voando;
  if (livre && !campoFocado()) porta = entradaPerto(corpo.x, corpo.y);
  const alvo = estado.interior && !estado.interior.sala3d ? pertoDe(estado.interior) : null;
  const ferramenta = dicaFerramenta();
  const noLab = estado.interior?.sala3d && estado.interior.papel === "lab";
  const papelHub = estado.interior?.sala3d ? estado.interior.papel : "";
  const alvoLab = noLab && !estado.dialogo && !estado.painel && !estado.ganhoAberto ? alvoLaboratorio(corpo.x, corpo.y) : null;
  const alvoHub =
    (papelHub === "centro" || papelHub === "loja") && !estado.dialogo && !estado.painel && !estado.ganhoAberto
      ? alvoDoHub(papelHub, corpo.x, corpo.y)
      : null;
  const curaPerto = (alvoLab?.tipo === "cura" || alvoHub?.tipo === "cura") && !curaOcupada();
  const entrarPorta = !!porta && !estado.interior && !(estado.saidaGrace > 0);
  const acao = acaoContexto({
    corpo,
    entrarPorta,
    curaPerto,
    alvoLab,
    alvoHub,
    papelHub,
    interior: estado.interior,
  });
  const pf = !jogadorMorto() ? promptForca(corpo) : null;
  if (jogadorMorto()) {
    estado.promptEntrar = false;
    estado.promptRotulo = "";
    estado.promptAncora = null;
    estado.prompt = "";
  } else if (acao) {
    // Mesmo chip do Escalar / Entrar / Colher.
    estado.promptEntrar = true;
    estado.promptRotulo = acao.rotulo || "Entrar";
    estado.promptAncora = acao.ancora || null;
  } else if (pf?.kind === "grab" || pf?.kind === "place") {
    estado.promptEntrar = true;
    estado.promptRotulo = pf.kind === "place" ? "Soltar" : "Pegar";
    const alvo = pf.target?.prop || pf.target?.enemy || null;
    estado.promptAncora = alvo
      ? { x: alvo.x, y: alvo.y, z: alvo.z ?? corpo.z ?? 0 }
      : null;
  } else {
    estado.promptEntrar = false;
    estado.promptRotulo = "";
    estado.promptAncora = null;
  }
  const livreDeMenu =
    !estado.painel &&
    !estado.roda &&
    !estado.construir &&
    !estado.craft &&
    !estado.ganhoAberto &&
    !jogadorMorto();
  if (!mapaAberto() && !campoFocado() && !jogadorMorto() && estado.dialogo && teclaAgora("KeyE")) {
    avancarDialogo();
  } else if (
    !mapaAberto() &&
    !campoFocado() &&
    !puzzleSantuarioAberto() &&
    !feixeAtivo() &&
    livreDeMenu &&
    acaoConsomeE(acao) &&
    teclaAgora("KeyE")
  ) {
    executarAcaoE(acao, corpo, porta, alvoLab, alvoHub);
  }
  tickFeixe(dt);
  atualizarBussolaSantuario(corpo, !!estado.interior);
  if (!jogadorMorto()) {
    // Chip de ação (Pegar/Soltar) já cuida do feedback principal.
    // Texto secundário: pesado / laboratório / hub / ferramenta.
    let texto = "";
    if (pf?.kind === "place" && pf.mobility?.kind === "heavy") {
      texto = t("forca.pesado");
    } else if (!estado.promptEntrar) {
      texto = alvoLab
        ? promptDoLaboratorio(alvoLab)
        : alvoHub
          ? promptDoHub(papelHub, alvoHub)
          : promptDe(alvo, ferramenta);
    }
    estado.prompt = acaoConsomeE(acao) ? "" : texto;
  }
  const zona = zonaNoMundo(corpo.x, corpo.y);
  definirBgm(
    chaveBgm(
      zona,
      obterClima(),
      estado.interior?.papel === "santuario"
        ? "santuario"
        : estado.interior?.sala?.kind
    )
  );
  atualizarAudio(dt, lerMixClima(), !!estado.interior);
  atualizarBillboardsBerry();
  if (estado.itemGet) {
    if (toastAte <= 0) toastAte = 2.4;
    toastAte -= dt;
    if (toastAte <= 0) {
      estado.itemGet = "";
      toastAte = 0;
    }
  }
  atualizarLeve(dt);
  const rect = viewport?.getBoundingClientRect();
  const w = Math.floor(rect?.width || 960);
  const h = Math.floor(rect?.height || 540);
  const sala = document.getElementById("jogo-sala");
  if (sala && (sala.width !== w || sala.height !== h)) redimensionarSala(w, h);
  desenharSala(w, h);
}

function executarAcaoE(acao, corpo, porta, alvoLab, alvoHub) {
  if (acao.id === "entrar") tentarEntrar(corpo, porta);
  else if (acao.id === "falarSantuario" || acao.id === "entrarSantuario") {
    tentarEntrarSantuario(corpo, acao.stone);
  } else if (acao.id === "totemSantuario") {
    if (acao.totem?.cleared) mostrar("O totem já entregou sua gema.");
    else {
      const r = reclamarTotem();
      if (r.msg) mostrar(r.msg);
    }
  } else if (acao.id === "cura") {
    if (alvoHub?.tipo === "cura") executarAlvoHub(alvoHub);
    else executarAlvoLaboratorio(alvoLab);
  } else if (acao.id === "pc") executarAlvoHub(alvoHub);
  else if (acao.id === "loja") executarAlvoHub(alvoHub);
  else if (acao.id === "capsula") executarAlvoLaboratorio(alvoLab);
  else if (acao.id === "placa") lerPlaca(acao.placa);
  else if (acao.id === "colher") {
    const msg = colherSilvestre(acao.arbusto);
    if (msg) mostrar(msg);
  }
}

function lerTeclas(corpo) {
  if (jogadorMorto()) return;
  if (mapaAberto()) {
    if (mapaViajando()) {
      teclaAgora("Escape");
      teclaAgora("KeyM");
      teclaAgora("Equal");
      teclaAgora("NumpadAdd");
      teclaAgora("Minus");
      teclaAgora("NumpadSubtract");
      return;
    }
    if (teclaAgora("Escape")) {
      if (!cancelarConfirmacaoMapa()) fecharMapa();
    } else if (teclaAgora("KeyM")) fecharMapa();
    if (teclaAgora("Equal") || teclaAgora("NumpadAdd")) zoomMapa(1.18);
    if (teclaAgora("Minus") || teclaAgora("NumpadSubtract")) zoomMapa(1 / 1.18);
    return;
  }
  if (estado.ganhoAberto && teclaAgora("Escape")) {
    fecharCartaGanho();
    return;
  }
  if (
    (estado.painel ||
      estado.menuAberto ||
      estado.dexAberta ||
      estado.statusAberto ||
      estado.dialogo ||
      estado.roda ||
      estado.construir ||
      estado.craft) &&
    teclaAgora("Escape")
  ) {
    fecharTopo();
  }
  if (estado.ganhoAberto) return;

  if (teclaAgora("Tab")) {
    toggleMenu();
    return;
  }
  if (teclaAgora("KeyP")) {
    toggleMenu("party");
    return;
  }
  if (teclaAgora("KeyI") || teclaAgora("KeyB")) {
    if (estado.dialogo || estado.roda) return;
    toggleMenu("bag");
    return;
  }
  if (teclaAgora("KeyR") && !estado.roda) interagir(corpo);
  if (
    estado.painel ||
    estado.menuAberto ||
    estado.dexAberta ||
    estado.statusAberto ||
    estado.dialogo ||
    estado.roda ||
    estado.construir ||
    estado.craft
  ) {
    return;
  }
  if (teleporteOcupado()) teclaAgora("KeyM");
  else if (teclaAgora("KeyM")) abrirMapa(corpo.x, corpo.y);
}

function interagir(corpo) {
  destravarAudio();
  if (estado.dialogo) {
    avancarDialogo();
    return;
  }
  if (estado.painel || estado.construir || estado.craft || estado.roda) return;
  if (estado.interior?.sala3d && estado.interior.papel === "lab") {
    const perto = alvoLaboratorio(corpo.x, corpo.y);
    if (perto) executarAlvoLaboratorio(perto);
    return;
  }
  if (estado.interior?.sala3d && (estado.interior.papel === "centro" || estado.interior.papel === "loja")) {
    const perto = alvoDoHub(estado.interior.papel, corpo.x, corpo.y);
    if (perto) executarAlvoHub(perto);
    return;
  }
  if (estado.interior) {
    const perto = pertoDe(estado.interior);
    if (perto) {
      falarCom(perto);
      return;
    }
    return;
  }
  const madura = plantarOuColher(celulaAlvo(corpo), null);
  if (madura) mostrar(madura);
}

function mostrar(msg) {
  estado.itemGet = msg;
  toastAte = 2.4;
  atualizarLeve();
}

export function teclaBaixaJogo(codigo) {
  return teclaBaixa(codigo);
}
