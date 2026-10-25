/**
 * Guardiões tipados por sala (exceto entrada).
 */
import { criarAtor } from "../pokemon/ator.js";
import { especie, listarEspecies } from "../pokemon/dados.js";
import { nivelEm } from "../pokemon/distribuicao/forca.js";
import { filtrarPorNivel } from "../pokemon/distribuicao/nivelSelvagem.js";
import { resolverEspecieNoNivel } from "../pokemon/pack.js";
import { mulberry32, hashSeed } from "./dungeonGen.js";
import { ORIGEM_SANTUARIO_X, ORIGEM_SANTUARIO_Y, santuarioAtivo } from "./interior.js";

/** @type {object[]} */
const defensores = [];

/** @type {Map<string, string[]>} */
let poolPorTipo = null;

function garantirPools() {
  if (poolPorTipo) return poolPorTipo;
  poolPorTipo = new Map();
  const lista = listarEspecies();
  for (let i = 0; i < lista.length; i++) {
    const esp = lista[i];
    const tipos = esp?.tipos || [];
    for (let t = 0; t < tipos.length; t++) {
      const key = String(tipos[t]).toLowerCase();
      let arr = poolPorTipo.get(key);
      if (!arr) {
        arr = [];
        poolPorTipo.set(key, arr);
      }
      arr.push(esp.key);
    }
  }
  return poolPorTipo;
}

function poolPara(element, nivel) {
  const pools = garantirPools();
  const key = String(element || "normal").toLowerCase();
  const bruto = pools.get(key) || pools.get("normal") || ["eevee", "pidgey"];
  const ok = filtrarPorNivel(bruto, nivel);
  return ok.length ? ok : bruto;
}

export function limparDefensoresSantuario() {
  defensores.length = 0;
}

export function defensoresSantuario() {
  return defensores;
}

/**
 * @param {object} hub
 */
export function spawnDefensoresSantuario(hub) {
  limparDefensoresSantuario();
  if (!hub?.rooms?.length) return;
  const rng = mulberry32(hashSeed(`${hub.shrineId}:guards`));
  const outdoorX = hub.outdoorX ?? 0;
  const outdoorY = hub.outdoorY ?? 0;
  const level = Math.max(5, nivelEm(outdoorX, outdoorY) | 0);
  const typed = poolPara(hub.element, level);
  let index = 0;

  for (let i = 0; i < hub.rooms.length; i++) {
    const room = hub.rooms[i];
    if (!room || room.kind === "entrance") continue;
    const pad = 1.4;
    const x0 = room.x0 + pad;
    const x1 = room.x1 - pad;
    const y0 = room.y0 + pad;
    const y1 = room.y1 - pad;
    const wx = ORIGEM_SANTUARIO_X + (x0 + x1) * 0.5;
    const wy = ORIGEM_SANTUARIO_Y + (y0 + y1) * 0.5;
    const bruta = typed[Math.floor(rng() * typed.length)] || "eevee";
    const speciesKey =
      resolverEspecieNoNivel(bruta, level) || bruta;
    const esp = especie(speciesKey) || especie("eevee") || especie("pidgey");
    if (!esp) continue;
    const ator = criarAtor({
      id: `shrine-guard-${hub.shrineId}-${index}`,
      especie: esp,
      nivel: level,
      faccao: "selvagem",
      x: wx,
      y: wy,
      z: hub.spawn?.z ?? 1,
      casaX: wx,
      casaY: wy,
      casaZ: hub.spawn?.z ?? 1,
      hostil: true,
      efemero: true,
      agroPersistente: true,
      prefereParty: true,
      dormindo: 0,
      raioTerritorio: 22,
    });
    ator.modo = "agro";
    ator._santuario = true;
    defensores.push(ator);
    index++;
  }
}

export function tickDefensoresSantuario() {
  for (let i = defensores.length - 1; i >= 0; i--) {
    const a = defensores[i];
    if (a.capturado || (a.morto && a.mortoAte && performance.now() >= a.mortoAte)) {
      defensores.splice(i, 1);
    }
  }
  if (!santuarioAtivo()) limparDefensoresSantuario();
}
