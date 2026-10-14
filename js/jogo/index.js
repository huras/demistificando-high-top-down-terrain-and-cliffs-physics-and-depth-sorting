/** Fachada que o loop chama. Trava o mundo quando a interface ou a sala está aberta. */

import { teclaAgora, teclaBaixa } from "../entrada/teclado.js";
import { obterClima } from "../render/3d/ceu/controleCeu.js";
import { zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { chaveBgm, definirBgm, destravarAudio } from "./audio.js";
import { tickBlocos } from "./blocos.js";
import { atualizarBillboardsBerry } from "./billboards.js";
import {
  celulaAlvo,
  dicaFerramenta,
  plantarOuColher,
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
  window.addEventListener("beforeunload", () => salvar());
  const rect = viewport?.getBoundingClientRect();
  redimensionarSala(Math.floor(rect?.width || 960), Math.floor(rect?.height || 540));
}

export function tickJogo(dt, corpo) {
  definirCorpo(corpo);
  registrarParty();
  soltarSlotVazio();
  tickCampo(dt);
  tickBlocos(corpo, dt);
  if (!campoFocado()) {
    tickRoda();
    lerTeclas(corpo);
  }
  if (estado.interior && !estado.dialogo && !estado.painel && !estado.construir && !estado.craft) {
    moverSala(dt);
    if (estado.interior?.saindo) sairInterior(corpo);
  } else if (!estado.interior) {
    tentarEntrar(corpo);
  }
  const alvo = estado.interior ? pertoDe(estado.interior) : null;
  const ferramenta = dicaFerramenta();
  estado.prompt = promptDe(alvo, ferramenta);
  const zona = zonaNoMundo(corpo.x, corpo.y);
  definirBgm(chaveBgm(zona, obterClima(), estado.interior?.sala?.kind));
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
  if (
    (estado.painel || estado.dialogo || estado.roda || estado.construir || estado.craft) &&
    teclaAgora("Escape")
  ) {
    fecharTopo();
  }
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
