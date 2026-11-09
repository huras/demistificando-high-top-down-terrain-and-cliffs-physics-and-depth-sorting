/**
 * Packs selvagens no overworld (lares 2–3). Port enxuto do Pokemon AI wildPack.
 * Grama / santuário / efêmeros ficam solo.
 */
import { POKEMON } from "../config.js";
import { especie } from "./dados.js";
import { EVOLUCOES_HELD, EVOLUCOES_NIVEL, EVOLUCOES_OVERRIDE } from "./dados/evolucoesNivel.js";
import {
  nivelMinSelvagem,
  podeSpawnarNoNivel,
} from "./distribuicao/nivelSelvagem.js";

export const PACK_ROLE = Object.freeze({
  LEADER: "leader",
  MEMBER: "member",
});

/** @type {Map<string, string[]>|null} */
let linhasPorChave = null;

/**
 * Instala linhas evolutivas a partir de evolution-lines.json (dex "001"…).
 * @param {{ lines?: { species?: string[] }[] }} json
 * @param {Record<string, { key: string, dex: number }>|null} [mapaEspecies]
 */
export function instalarLinhasEvo(json, mapaEspecies = null) {
  const porDex = new Map();
  if (mapaEspecies) {
    const chaves = Object.keys(mapaEspecies);
    for (let i = 0; i < chaves.length; i++) {
      const esp = mapaEspecies[chaves[i]];
      if (!esp?.key || !esp.dex) continue;
      porDex.set(String(esp.dex | 0).padStart(3, "0"), esp.key);
    }
  }
  const mapa = new Map();
  const lines = json?.lines;
  if (!Array.isArray(lines)) {
    linhasPorChave = mapa;
    return;
  }
  for (let i = 0; i < lines.length; i++) {
    const dexes = lines[i]?.species;
    if (!Array.isArray(dexes) || !dexes.length) continue;
    const keys = [];
    for (let j = 0; j < dexes.length; j++) {
      const key = porDex.get(String(dexes[j]).padStart(3, "0"));
      if (key) keys.push(key);
    }
    if (keys.length < 1) continue;
    for (let j = 0; j < keys.length; j++) {
      mapa.set(keys[j], keys.slice());
    }
  }
  linhasPorChave = mapa;
}

/**
 * Junta a linha do JSON com a evolução por nível.
 * A forma base (ninguém evolui para ela) fica na frente.
 */
export function completarLinhasNivel() {
  if (!linhasPorChave) linhasPorChave = new Map();
  const entra = new Map();
  const viz = new Map();
  const nos = new Set();

  function ponta(a, b) {
    let s = viz.get(a);
    if (!s) {
      s = new Set();
      viz.set(a, s);
    }
    s.add(b);
  }

  function ligar(a, b) {
    if (!a || !b || a === b) return;
    nos.add(a);
    nos.add(b);
    let e = entra.get(b);
    if (!e) {
      e = new Set();
      entra.set(b, e);
    }
    e.add(a);
    ponta(a, b);
    ponta(b, a);
  }

  for (const linha of linhasPorChave.values()) {
    for (let i = 0; i + 1 < linha.length; i++) ligar(linha[i], linha[i + 1]);
    for (let i = 0; i < linha.length; i++) nos.add(linha[i]);
  }
  function ligarTabela(tabela) {
    const chaves = Object.keys(tabela);
    for (let i = 0; i < chaves.length; i++) {
      const regra = tabela[chaves[i]];
      if (Array.isArray(regra)) {
        for (let j = 0; j < regra.length; j++) ligar(chaves[i], regra[j]?.into);
      } else {
        ligar(chaves[i], regra?.into);
      }
    }
  }
  ligarTabela(EVOLUCOES_NIVEL);
  ligarTabela(EVOLUCOES_OVERRIDE);
  ligarTabela(EVOLUCOES_HELD);

  const visto = new Set();
  for (const inicio of nos) {
    if (visto.has(inicio)) continue;
    const comp = [];
    const fila = [inicio];
    visto.add(inicio);
    while (fila.length) {
      const u = fila.pop();
      comp.push(u);
      const vs = viz.get(u);
      if (!vs) continue;
      for (const v of vs) {
        if (visto.has(v)) continue;
        visto.add(v);
        fila.push(v);
      }
    }
    const raizes = [];
    const resto = [];
    for (let i = 0; i < comp.length; i++) {
      const k = comp[i];
      if (entra.get(k)?.size) resto.push(k);
      else raizes.push(k);
    }
    const ordem = raizes.concat(resto);
    for (let i = 0; i < ordem.length; i++) linhasPorChave.set(ordem[i], ordem);
  }
}

/** Linha evolutiva da espécie (ou só ela). */
export function linhaDaEspecie(chave) {
  const line = linhasPorChave?.get(chave);
  return line?.length ? line : chave ? [chave] : [];
}

/**
 * Demote forma ilegal no nível até a mais alta permitida (resolveWildSpeciesAtLevel).
 * @param {string|null|undefined} chave
 * @param {number} nivel
 * @returns {string|null}
 */
export function resolverEspecieNoNivel(chave, nivel) {
  if (!chave) return null;
  const lv = Math.max(1, nivel | 0);
  if (especie(chave) && podeSpawnarNoNivel(chave, lv)) return chave;
  const linha = linhaDaEspecie(chave);
  for (let i = linha.length - 1; i >= 0; i--) {
    const k = linha[i];
    if (k && especie(k) && podeSpawnarNoNivel(k, lv)) return k;
  }
  return null;
}

export function cfgPack() {
  const raw = POKEMON.PACK;
  if (!raw || raw.enabled === false) {
    return { enabled: false, groupedFraction: 0, sizes: [2, 3] };
  }
  const sizes = Array.isArray(raw.sizes)
    ? raw.sizes.filter((n) => n >= 2 && n <= 3)
    : [2, 3];
  return {
    enabled: true,
    groupedFraction: raw.groupedFraction ?? 0.5,
    sizes: sizes.length ? sizes : [2, 3],
    memberRadiusMin: raw.memberRadiusMin ?? 2,
    memberRadiusMax: raw.memberRadiusMax ?? 3.2,
    memberClearance: raw.memberClearance ?? 0.55,
    slotBack: raw.slotBack ?? 2,
    slotSide: raw.slotSide ?? 1.35,
    arriveRadius: raw.arriveRadius ?? 0.55,
    catchUpDistance: raw.catchUpDistance ?? 2.4,
    memberPlaceAttempts: raw.memberPlaceAttempts ?? 64,
    alertPackOnAgro: raw.alertPackOnAgro !== false,
  };
}

/** Tamanho do pack para um lar (1 = solo). Determinístico via unidade [0,1) e hash. */
export function planPackDoLar(unidade01, hashInt, packCfg = cfgPack()) {
  if (!packCfg?.enabled) return 1;
  const frac = Math.min(1, Math.max(0, packCfg.groupedFraction ?? 0.5));
  if (unidade01 >= frac) return 1;
  const sizes = packCfg.sizes?.length ? packCfg.sizes : [2, 3];
  return sizes[(hashInt >>> 0) % sizes.length];
}

/**
 * Mate na linha evolutiva do líder (nível com jitter; só formas legais no band).
 * @param {{ chave: string, nivel: number }} lider
 * @param {() => number} rng
 */
export function escolherMate(lider, rng) {
  const base = Math.max(1, lider.nivel | 0);
  const minL = Math.max(1, base - 3);
  const maxL = base + 3;
  const keys = linhaDaEspecie(lider.chave);
  const candidates = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!especie(k)) continue;
    if (nivelMinSelvagem(k) > maxL) continue;
    candidates.push(k);
  }
  if (!candidates.length) {
    const segura =
      resolverEspecieNoNivel(lider.chave, base) || lider.chave;
    return { chave: segura, nivel: base };
  }
  const others = [];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i] !== lider.chave) others.push(candidates[i]);
  }
  let pick;
  if (others.length && rng() < 0.7) {
    pick = others[(rng() * others.length) | 0];
  } else {
    pick = candidates[(rng() * candidates.length) | 0];
  }
  const lo = Math.max(minL, nivelMinSelvagem(pick));
  const hi = Math.max(lo, maxL);
  const nivel = lo + ((rng() * (hi - lo + 1)) | 0);
  return { chave: pick, nivel: Math.max(1, nivel) };
}

export function vivoPack(ator) {
  return !!(ator && !ator.morto && !ator.capturado && (ator.hp == null || ator.hp > 0));
}

export function ehMembroPack(ator) {
  return !!(ator && ator.packId != null && ator.packRole === PACK_ROLE.MEMBER);
}

export function liderPackVivo(itens, packId) {
  if (packId == null) return null;
  for (let i = 0; i < itens.length; i++) {
    const a = itens[i];
    if (a.packId !== packId) continue;
    if (a.packRole !== PACK_ROLE.LEADER) continue;
    if (vivoPack(a)) return a;
  }
  return null;
}

export function matesVivos(itens, packId, out = []) {
  out.length = 0;
  if (packId == null) return out;
  for (let i = 0; i < itens.length; i++) {
    const a = itens[i];
    if (a.packId !== packId) continue;
    if (!vivoPack(a)) continue;
    out.push(a);
  }
  return out;
}

/** Carimba pack nos membros (líder primeiro). */
export function amarrarPack(membros, packId) {
  if (!membros || membros.length < 2) return;
  const lider = membros[0];
  const homeX = lider.casaX ?? lider.x;
  const homeY = lider.casaY ?? lider.y;
  for (let i = 0; i < membros.length; i++) {
    const a = membros[i];
    a.packId = packId;
    a.packRole = i === 0 ? PACK_ROLE.LEADER : PACK_ROLE.MEMBER;
    a.packSlot = i;
    a.packHomeX = homeX;
    a.packHomeY = homeY;
  }
}

export function promoverLider(itens, packId, nearX, nearY) {
  if (packId == null) return null;
  const living = [];
  for (let i = 0; i < itens.length; i++) {
    const a = itens[i];
    if (a.packId !== packId) continue;
    if (!vivoPack(a)) {
      a.packRole = PACK_ROLE.MEMBER;
      continue;
    }
    living.push(a);
  }
  if (!living.length) return null;

  let lider = living[0];
  let best = Infinity;
  for (let i = 0; i < living.length; i++) {
    const a = living[i];
    const d = Math.hypot(a.x - nearX, a.y - nearY);
    if (d < best) {
      best = d;
      lider = a;
    }
  }

  lider.packRole = PACK_ROLE.LEADER;
  lider.packSlot = 0;
  let slot = 1;
  for (let i = 0; i < living.length; i++) {
    const a = living[i];
    if (a === lider) continue;
    a.packRole = PACK_ROLE.MEMBER;
    a.packSlot = slot++;
  }
  if (living.length === 1) {
    lider.packRole = PACK_ROLE.LEADER;
    lider.packSlot = 0;
  }
  return lider;
}

export function reempilharLideranca(itens, packId) {
  if (packId == null) return null;
  const lider = liderPackVivo(itens, packId);
  if (lider) return promoverLider(itens, packId, lider.x, lider.y);
  for (let i = 0; i < itens.length; i++) {
    const a = itens[i];
    if (a.packId !== packId || !vivoPack(a)) continue;
    return promoverLider(itens, packId, a.x, a.y);
  }
  return null;
}

/**
 * Ponto andável perto do líder para spawn do membro.
 * @param {{ x: number, y: number }} lider
 * @param {(x: number, y: number) => number} pisoSeco
 * @param {(x: number, y: number, min: number) => boolean} longeDe
 * @param {() => number} rng
 * @param {object} [packCfg]
 */
export function pontoMembro(lider, pisoSeco, longeDe, rng, packCfg = cfgPack()) {
  const minR = packCfg.memberRadiusMin ?? 2;
  const maxR = Math.max(minR, packCfg.memberRadiusMax ?? 3.2);
  const attempts = packCfg.memberPlaceAttempts ?? 64;
  const clearance = packCfg.memberClearance ?? 0.55;
  const preferred = (minR + maxR) * 0.5;

  const tryPoint = (x, y) => {
    const z = pisoSeco(Math.floor(x), Math.floor(y));
    if (!z) return null;
    if (!longeDe(x, y, clearance + 0.8)) return null;
    return { x, y, z };
  };

  for (let k = 0; k < 8; k++) {
    const angle = (k / 8) * Math.PI * 2 + rng() * 0.15;
    const hit = tryPoint(
      lider.x + Math.cos(angle) * preferred,
      lider.y + Math.sin(angle) * preferred,
    );
    if (hit) return hit;
  }
  for (let i = 0; i < attempts; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = minR + rng() * (maxR - minR);
    const hit = tryPoint(
      lider.x + Math.cos(angle) * dist,
      lider.y + Math.sin(angle) * dist,
    );
    if (hit) return hit;
  }
  return {
    x: lider.x + 1.2,
    y: lider.y + 0.4,
    z: pisoSeco(Math.floor(lider.x), Math.floor(lider.y)) || lider.z || 1,
  };
}

/** Slot de formação atrás do líder. */
export function pontoSlot(lider, slot, packCfg = cfgPack()) {
  const faceX = lider.dirX ?? 0;
  const faceY = lider.dirY ?? 1;
  const len = Math.hypot(faceX, faceY) || 1;
  const fx = faceX / len;
  const fy = faceY / len;
  const backX = -fx;
  const backY = -fy;
  const leftX = -fy;
  const leftY = fx;
  const back = packCfg.slotBack ?? 2;
  const side = packCfg.slotSide ?? 1.35;
  const index = Math.max(1, slot | 0);
  const sideSign = index % 2 === 1 ? 1 : -1;
  const ring = Math.ceil(index / 2);
  return {
    x: lider.x + backX * back * ring + leftX * side * sideSign,
    y: lider.y + backY * back * ring + leftY * side * sideSign,
  };
}

/**
 * Trava mate no alvo com lock duro (não some no próximo tick se !hostil).
 * Acorda sono natural / dormindo de campo; sleep de status major fica.
 */
export function travarAgroPack(mate, alvo) {
  if (!mate || !alvo) return;
  if (mate.status === "sleep") return;
  if (mate.sonoNatural) mate.sonoNatural = false;
  if ((mate.dormindo || 0) > 0) mate.dormindo = 0;
  mate.modo = "agro";
  mate.alvo = alvo;
  mate.pendenteAtacante = alvo;
  mate.agroPersistente = true;
}

function dist2Xy(a, b) {
  if (!a || !b) return Infinity;
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return dx * dx + dy * dy;
}

/**
 * Alerta mates no raio de lealdade (perto da fonte ou do atacante).
 * @param {object[]} itens
 * @param {object} fonte
 * @param {object} alvo
 * @param {(mate: object, alvo: object) => void} [travarAgro]
 */
export function alertarPackAgro(itens, fonte, alvo, travarAgro = travarAgroPack) {
  const packCfg = cfgPack();
  if (!packCfg.alertPackOnAgro) return;
  if (!fonte || fonte.packId == null || !alvo) return;
  if (fonte._packAlertando) return;
  fonte._packAlertando = true;
  const lim = POKEMON.RAIO_AGRO * POKEMON.RAIO_AGRO;
  for (let i = 0; i < itens.length; i++) {
    const mate = itens[i];
    if (mate === fonte) continue;
    if (mate.packId !== fonte.packId) continue;
    if (!vivoPack(mate)) continue;
    // Sleep major: só sai com hit próprio / cura.
    if (mate.status === "sleep") continue;
    // Longe do ninho E do atacante → não puxa o mapa inteiro.
    if (dist2Xy(mate, fonte) > lim && dist2Xy(mate, alvo) > lim) continue;
    travarAgro(mate, alvo);
  }
  fonte._packAlertando = false;
}
