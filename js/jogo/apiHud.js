/**
 * Facade entre HUD DOM e estado/party/ride/dex.
 * UI não fala com Three.js direto.
 */

import {
  estado,
  avisar,
  contar,
  nomeDe,
  salvar,
  temChave,
  registrarEspecie,
} from "./estado.js";
import {
  alternarCampo,
  listaParty,
  pokemonDeployado,
  pokemonNoCampo,
} from "../pokemon/party.js";
import { abrirMapa } from "../ui/mapa/mapaMundo.js";
import {
  getSpeciesDexStatus,
  markSpeciesCaught,
  markSpeciesSeen,
  progressoDex,
  bootstrapDexDaParty,
} from "./pokedex/progresso.js";
import { alternarRide, indiceMontado, modoRideAtual, podeMontar } from "./ride.js";

let menuApi = null;
let dexApi = null;
let radarApi = null;
let statusApi = null;
let ouvintesHotbar = [];
let corpoRef = null;

estado._fecharHudExtra = () => {
  if (estado.dexAberta) {
    dexApi?.fechar?.() ?? dexApi?.close?.();
    estado.dexAberta = false;
  }
  if (estado.statusAberto) {
    statusApi?.close?.();
    estado.statusAberto = false;
  }
  if (estado.menuAberto) {
    menuApi?.close?.();
    estado.menuAberto = false;
  }
};

export function definirMenuApi(api) {
  menuApi = api;
}

export function definirDexApi(api) {
  dexApi = api;
}

export function definirRadarApi(api) {
  radarApi = api;
}

export function definirStatusApi(api) {
  statusApi = api;
}

export function statusHud() {
  return statusApi;
}

export function toggleStatus() {
  return statusApi?.toggle?.() ?? false;
}

export function definirCorpoHud(corpo) {
  corpoRef = corpo;
}

export function corpoHud() {
  return corpoRef;
}

export function menuJogo() {
  return menuApi;
}

export function dexHud() {
  return dexApi;
}

export function radarHud() {
  return radarApi;
}

export function aoMudarHotbar(fn) {
  ouvintesHotbar.push(fn);
  return () => {
    ouvintesHotbar = ouvintesHotbar.filter((f) => f !== fn);
  };
}

export function avisarHotbar() {
  for (let i = 0; i < ouvintesHotbar.length; i++) ouvintesHotbar[i]();
}

export function abrirMenu(pagina) {
  menuApi?.open?.(pagina || "party");
  estado.menuAberto = !!menuApi?.isOpen?.();
  avisar();
}

export function fecharMenu() {
  menuApi?.close?.();
  estado.menuAberto = false;
  avisar();
}

export function toggleMenu(pagina) {
  menuApi?.toggle?.(pagina);
  estado.menuAberto = !!menuApi?.isOpen?.();
  avisar();
}

export function menuAberto() {
  return !!menuApi?.isOpen?.() || !!estado.menuAberto;
}

export function abrirDex(chave) {
  if (!temChave("pokedex")) {
    estado.itemGet = "Você não tem a Pokédex.";
    avisar();
    return false;
  }
  let ok;
  if (chave) {
    ok =
      dexApi?.abrirEntrada?.(chave) ??
      dexApi?.openForEntry?.(chave) ??
      dexApi?.abrir?.() ??
      dexApi?.open?.();
  } else {
    ok = dexApi?.toggle?.() ?? false;
  }
  estado.dexAberta = !!(dexApi?.estaAberta?.() ?? dexApi?.isOpen?.());
  avisar();
  return ok;
}

export function fecharDex() {
  const r = dexApi?.fechar?.() ?? dexApi?.close?.();
  estado.dexAberta = false;
  avisar();
  return r;
}

export function dexAberta() {
  return !!(dexApi?.estaAberta?.() ?? dexApi?.isOpen?.() ?? estado.dexAberta);
}

export function toggleRadar() {
  return radarApi?.toggle?.() ?? false;
}

export function abrirMapaMundo() {
  const c = corpoRef;
  abrirMapa(c?.x || 0, c?.y || 0);
}

export function partyLista() {
  return listaParty();
}

export function monEmCampo() {
  return pokemonDeployado() || pokemonNoCampo();
}

export function deploySlot(i) {
  return alternarCampo(i);
}

export function toggleRideSlot(i) {
  return alternarRide(i);
}

export function rideSlot() {
  return indiceMontado();
}

export function rideModo() {
  return modoRideAtual();
}

export function slotPodeMontar(i) {
  return podeMontar(i);
}

export function dinheiroHud() {
  return estado.dinheiro;
}

export function hotbarSlots() {
  return estado.hotbar;
}

export function slotAtivoHud() {
  return estado.slotAtivo;
}

export function contarItemHud(tipo, key) {
  return contar(tipo, key);
}

export function nomeItemHud(tipo, key) {
  return nomeDe(tipo, key);
}

export function salvarJogo() {
  salvar();
  estado.itemGet = "Jogo salvo.";
  avisar();
}

export function statusDex(chave) {
  return getSpeciesDexStatus(chave);
}

export function marcarVisto(chave) {
  return markSpeciesSeen(chave);
}

export function marcarCapturado(chave) {
  return markSpeciesCaught(chave);
}

export function contagemDex() {
  return progressoDex();
}

export function semearDexParty() {
  bootstrapDexDaParty();
  for (const ator of listaParty()) {
    const key = ator?.especie?.key;
    if (key) {
      registrarEspecie(key);
      markSpeciesCaught(key);
    }
  }
}

export function questsAtivas() {
  return estado.quests.filter((q) => !q.feita).length;
}
