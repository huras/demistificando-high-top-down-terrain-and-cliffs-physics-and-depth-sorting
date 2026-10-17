/** Fachada que o loop chama. Trava o mundo quando a interface ou a sala está aberta. */

import { teclaAgora, teclaBaixa } from "../entrada/teclado.js";
import { lerMixClima } from "../render/3d/ceu/clima.js";
import { obterClima } from "../render/3d/ceu/controleCeu.js";
import { zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { atualizarAudio, chaveBgm, definirBgm, destravarAudio } from "./audio.js";
import { tickBlocos } from "./blocos.js";
import { atualizarBillboardsBerry } from "./billboards.js";
import {
  celulaAlvo,
  dicaFerramenta,
  entradaPerto,
  plantarOuColher,
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
import { atualizarCuraMaquina, curaOcupada } from "./maquinaCura.js";
import { ORIGEM_LAB_X, ORIGEM_LAB_Y, promptDoLaboratorio } from "../mundo/cidade/laboratorio.js";
import { fecharCartaGanho, tickGanho } from "./ganhoItem.js";
import { avancarDialogo, atualizarLeve, definirCorpo, falarCom, ligarUi, pintar, promptDe } from "./ui.js";

let viewport = null;
let toastAte = 0;

function campoFocado() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

export function jogoTravaMundo() {
  return uiAberta();
}

export function montarJogo(opts) {
  viewport = opts.viewport;
  const overlay = document.getElementById("jogo-hud");
  ligarUi(overlay);
  ligarRoda();
  ligarSala(document.getElementById("jogo-sala"));
  carregar();
  aoMudar(pintar);
  pintar();
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
  registrarParty();
  soltarSlotVazio();
  tickCampo(dt);
  tickBlocos(corpo, dt);
  if (!campoFocado()) {
    tickRoda();
    lerTeclas(corpo);
  }
  if (estado.interior?.sala3d) {
    checarSaidaSala(corpo);
  } else if (estado.interior && !estado.dialogo && !estado.painel && !estado.construir && !estado.craft) {
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
  if (livre && !campoFocado()) {
    porta = entradaPerto(corpo.x, corpo.y);
    if (porta && teclaAgora("KeyE")) tentarEntrar(corpo, porta);
  }
  const alvo = estado.interior && !estado.interior.sala3d ? pertoDe(estado.interior) : null;
  const ferramenta = dicaFerramenta();
  const noLab = estado.interior?.sala3d && estado.interior.papel === "lab";
  const alvoLab = noLab && !estado.dialogo && !estado.painel && !estado.ganhoAberto ? alvoLaboratorio(corpo.x, corpo.y) : null;
  const curaPerto = alvoLab?.tipo === "cura" && !curaOcupada();
  const entrarPorta = !!porta && !estado.interior && !(estado.saidaGrace > 0);
  estado.promptEntrar = entrarPorta || curaPerto;
  estado.promptRotulo = curaPerto ? "Recuperar" : "Entrar";
  estado.promptAncora = curaPerto
    ? { x: ORIGEM_LAB_X + alvoLab.ref.x, y: ORIGEM_LAB_Y + alvoLab.ref.footY, z: corpo.z }
    : null;
  if (curaPerto && !campoFocado() && teclaAgora("KeyE")) executarAlvoLaboratorio(alvoLab);
  estado.prompt = curaPerto ? "" : alvoLab ? promptDoLaboratorio(alvoLab) : promptDe(alvo, ferramenta);
  const zona = zonaNoMundo(corpo.x, corpo.y);
  definirBgm(chaveBgm(zona, obterClima(), estado.interior?.sala?.kind));
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
  atualizarLeve();
  const rect = viewport?.getBoundingClientRect();
  const w = Math.floor(rect?.width || 960);
  const h = Math.floor(rect?.height || 540);
  const sala = document.getElementById("jogo-sala");
  if (sala && (sala.width !== w || sala.height !== h)) redimensionarSala(w, h);
  desenharSala(w, h);
}

function lerTeclas(corpo) {
  if (estado.ganhoAberto && teclaAgora("Escape")) {
    fecharCartaGanho();
    return;
  }
  if (
    (estado.painel || estado.dialogo || estado.roda || estado.construir || estado.craft) &&
    teclaAgora("Escape")
  ) {
    fecharTopo();
  }
  if (estado.ganhoAberto) return;
  if (teclaAgora("KeyI") || teclaAgora("KeyB")) {
    if (estado.dialogo || estado.roda) return;
    if (estado.painel === "mochila") fecharTopo();
    else abrirPainel("mochila");
  }
  if (teclaAgora("KeyR") && !estado.roda) interagir(corpo);
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
