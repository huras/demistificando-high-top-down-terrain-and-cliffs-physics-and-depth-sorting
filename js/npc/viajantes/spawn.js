/**
 * Spawn de viajantes além da câmera, preferindo eixo de estrada em rotas.
 */
import { deLocalKanto, paraLocalKanto } from "../../mundo/bounds.js";
import {
  AREA_KANTO,
  LADO_KANTO,
  zonaEm,
  zonaNoMundo,
} from "../../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import {
  linhasDaCidade,
  linhasDaRota,
  projetarEixoEstradaLocal,
} from "../../mundo/regiao/linhasEstrada.js";
import {
  ehElegivelViajante,
  idsElegiveisViajante,
} from "../catalogo/carregar.js";
import { falaCivil, nomeNpcUnico, resolverNpc } from "../catalogo/identidade.js";
import { sortearParty } from "../catalogo/parties.js";
import { alturaSpawnNpc } from "../locomocao.js";
import { hashStr, mulberry32, pickIndex } from "../rng.js";
import { OW_CFG, OW_LOD, OW_MODO } from "./config.js";

const nomesUsados = new Map();

function distCidadeMaisProxima(wx, wy) {
  let best = 1e9;
  for (let i = 0; i < CIDADES_KANTO.length; i++) {
    const c = CIDADES_KANTO[i];
    const p = deLocalKanto(
      c.ax * AREA_KANTO + AREA_KANTO * 0.5,
      c.ay * AREA_KANTO + AREA_KANTO * 0.5,
    );
    const d = Math.hypot(wx - p.x, wy - p.y);
    if (d < best) best = d;
  }
  return best;
}

function cityFalloff(wx, wy) {
  const d = distCidadeMaisProxima(wx, wy);
  return 1 / (1 + d / OW_CFG.CITY_FALLOFF);
}

function poolPeople() {
  const ids = idsElegiveisViajante().filter(ehElegivelViajante);
  return ids.length ? ids : ["pt-youngster", "pt-lass", "pt-hiker"];
}

function pickPeopleId(rng) {
  const pool = poolPeople();
  return pool[pickIndex(rng, pool.length)];
}

function pontoNaLinha(linhas, rng) {
  if (!linhas.length) return null;
  const [a, b] = linhas[pickIndex(rng, linhas.length)];
  const t = 0.15 + rng() * 0.7;
  return {
    lx: a[0] + (b[0] - a[0]) * t,
    ly: a[1] + (b[1] - a[1]) * t,
  };
}

function candidatosRota(ax, ay, rng) {
  const zona = zonaEm(ax, ay);
  if (!zona || zona.tipo === "cidade") return [];
  const linhas =
    zona.tipo === "rota" ? linhasDaRota(zona) : linhasDaCidade(zona);
  const out = [];
  for (let n = 0; n < 8; n++) {
    const p = pontoNaLinha(linhas, rng);
    if (!p) break;
    out.push(p);
  }
  // fallback: centro da área
  if (!out.length) {
    out.push({ lx: AREA_KANTO * 0.5, ly: AREA_KANTO * 0.5 });
  }
  return out;
}

function alemDaCamera(px, py, aabb, rng) {
  if (!aabb) return true;
  const padMin = OW_CFG.SPAWN_BEYOND_MIN;
  const padMax = OW_CFG.SPAWN_BEYOND_MAX;
  const d = padMin + rng() * (padMax - padMin);
  const side = pickIndex(rng, 4);
  if (side === 0) return { x: aabb.minX - d, y: py + (rng() - 0.5) * 10 };
  if (side === 1) return { x: aabb.maxX + d, y: py + (rng() - 0.5) * 10 };
  if (side === 2) return { x: px + (rng() - 0.5) * 10, y: aabb.minY - d };
  return { x: px + (rng() - 0.5) * 10, y: aabb.maxY + d };
}

function longeDemaisDeOutros(x, y, lista) {
  for (let i = 0; i < lista.length; i++) {
    const t = lista[i];
    if (Math.hypot(t.x - x, t.y - y) < OW_CFG.MIN_SPACING) return false;
  }
  return true;
}

/**
 * @param {{ x:number,y:number }} player
 * @param {object[]} lista
 * @param {{ minX:number,maxX:number,minY:number,maxY:number }|null} cameraAabb
 * @param {string} [periodo]
 */
export function tentarSpawnViajante(player, lista, cameraAabb, periodo = "day") {
  if (!player) return null;
  const chance =
    OW_CFG.BASE_SPAWN_CHANCE * (OW_CFG.TIME_MUL[periodo] ?? 0.7);
  const rng = mulberry32((Date.now() ^ hashStr(`${player.x|0}:${player.y|0}`)) >>> 0);
  if (rng() > chance) return null;

  const local = paraLocalKanto(player.x, player.y);
  const ax = Math.floor(local.x / AREA_KANTO);
  const ay = Math.floor(local.y / AREA_KANTO);
  if (ax < 0 || ay < 0 || ax >= LADO_KANTO || ay >= LADO_KANTO) return null;

  // Prefer área vizinha / borda
  const candAreas = [
    [ax, ay],
    [ax + 1, ay],
    [ax - 1, ay],
    [ax, ay + 1],
    [ax, ay - 1],
  ].filter(([x, y]) => x >= 0 && y >= 0 && x < LADO_KANTO && y < LADO_KANTO);

  for (let tries = 0; tries < 10; tries++) {
    const [sax, say] = candAreas[pickIndex(rng, candAreas.length)];
    const zona = zonaEm(sax, say);
    if (zona?.tipo === "cidade") continue;
    const cands = candidatosRota(sax, say, rng);
    const c = cands[pickIndex(rng, cands.length)];
    let mundo = deLocalKanto(sax * AREA_KANTO + c.lx, say * AREA_KANTO + c.ly);

    // Forçar além da câmera
    const beyond = alemDaCamera(player.x, player.y, cameraAabb, rng);
    if (beyond && cameraAabb) {
      // mistura: projeta no eixo da estrada perto do ponto beyond
      const z2 = zonaNoMundo(beyond.x, beyond.y);
      if (z2 && z2.tipo !== "cidade") {
        const loc2 = paraLocalKanto(beyond.x, beyond.y);
        const proj = projetarEixoEstradaLocal(loc2.x, loc2.y, z2);
        if (proj) {
          mundo = deLocalKanto(
            z2.ax * AREA_KANTO + proj.x,
            z2.ay * AREA_KANTO + proj.y,
          );
        } else {
          mundo = beyond;
        }
      } else {
        continue;
      }
    }

    if (Math.hypot(mundo.x - player.x, mundo.y - player.y) < OW_CFG.MIN_PLAYER_DIST) {
      continue;
    }
    if (!longeDemaisDeOutros(mundo.x, mundo.y, lista)) continue;
    if (cityFalloff(mundo.x, mundo.y) < 0.15 && rng() > 0.3) continue;

    const peopleId = pickPeopleId(rng);
    const seed = `ow:${Date.now()}:${tries}:${peopleId}`;
    const usados =
      nomesUsados.get(peopleId) ||
      (nomesUsados.set(peopleId, new Set()), nomesUsados.get(peopleId));
    const id = resolverNpc({ peopleId, seed });
    const nome = nomeNpcUnico(peopleId, seed, usados);
    usados.add(nome);
    const party = sortearParty(peopleId, seed);
    const moveMode =
      rng() < OW_CFG.MOVE_WANDER_WEIGHT ? OW_MODO.WANDER : OW_MODO.TRAVEL;

    const especieNomes = party
      .map((p) => {
        const n = String(p.especie || "?");
        return n.charAt(0).toUpperCase() + n.slice(1) + ` (Nv.${p.nivel})`;
      })
      .join(", ");
    const z0 = alturaSpawnNpc(mundo.x, mundo.y);
    return {
      id: seed,
      tipo: "viajante",
      escopo: "overworld",
      owTrainer: true,
      peopleId,
      nome,
      sexo: id.sexo,
      origem: id.origem,
      coluna: id.coluna,
      perfilAndar: id.perfilAndar,
      peopleSeed: seed,
      x: mundo.x,
      y: mundo.y,
      z: z0,
      elevacao: z0,
      facing: { x: 0, y: 1 },
      raio: OW_CFG.RAIO,
      modo: "viajante",
      moveMode,
      lod: OW_LOD.ACTIVE,
      party,
      fala: [
        falaCivil(`${seed}:v`, "viajante"),
        `Eu sou ${nome}. Meu time: ${especieNomes}.`,
      ],
      retrato: null,
      ax: Math.floor(paraLocalKanto(mundo.x, mundo.y).x / AREA_KANTO),
      ay: Math.floor(paraLocalKanto(mundo.x, mundo.y).y / AREA_KANTO),
      vx: 0,
      vy: 0,
      andando: false,
      animT: 0,
      frame: 0,
      visivel: true,
      wanderGoal: null,
      wanderIdle: 0,
      travelTarget: null,
      seenByPlayer: false,
      defeatedByPlayer: false,
      combatHold: false,
      path: null,
      pathI: 0,
    };
  }
  return null;
}
