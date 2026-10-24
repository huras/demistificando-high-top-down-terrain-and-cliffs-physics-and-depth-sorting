/**
 * Clusters de floresta no anel horizonte (suave → horizonte).
 * Poucos InstancedMesh densos — silhueta AAA, não 10k billboards.
 */
import * as THREE from "three";
import { aplicarLuzBillboard } from "./ceu/luzBillboard.js";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import { aplicarVentoVeg } from "./vegetacao/ventoVeg.js";
import {
  ALTURA_BLOCO,
  CHUNK_XZ,
  CLUMP_HORIZONTE_CAP,
  VEG_ALPHA_TEST,
  VEG_YAW_EPS,
} from "../../config.js";
import {
  alturaDoRelevo,
  biomaDominante,
  nivelMarBlocos,
} from "../../mundo/bioma/catalogo.js";
import { hash2 } from "../../mundo/voxel/ruido.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { obterRaioSuave } from "./terrenoSuave.js";
import { obterRaioHorizonte } from "./terrenoHorizonte.js";
import { geometriaNoPe, poseCartao } from "./billboard/indice.js";
import { marcarStencilSolido } from "./silhuetaSprite.js";
import { registrarObjetoCena, removerObjetoCena } from "../../cena/registroCena.js";
import {
  aquecerClumps,
  biomaAceitaFloresta,
  familiaClumpDeBioma,
  liberarClumps,
  obterClump,
  sortearTamanhoClump,
} from "./vegetacao/clumpsFloresta.js";

/** Passo de amostra em blocos (grosso). */
const PASSO = 16;
/** Stride de chunks no anel — cobre o disco sem varrer ~20k células. */
const STRIDE_CHUNK = 3;
const CLUMP_CAP = CLUMP_HORIZONTE_CAP;
const ORCAMENTO_MS = 0.6;
/** Publica silhueta parcial enquanto o varredura ainda corre. */
const PUBLICAR_A_CADA = 48;
const TINT_FAR = new THREE.Color(0xb8c4a8);

const dummy = new THREE.Object3D();
dummy.rotation.order = "YXZ";

function yawDiferente(atual, aplicado) {
  const d = Math.atan2(Math.sin(atual - aplicado), Math.cos(atual - aplicado));
  return Math.abs(d) > VEG_YAW_EPS;
}

/**
 * Espalha candidatos no disco pra cobrir o anel inteiro.
 * @param {object[]} todos
 * @param {number} cap
 */
function espalhar(todos, cap) {
  if (todos.length <= cap) return todos;
  const raioB = Math.max(obterRaioStream(), obterRaioSuave());
  const raioE = obterRaioHorizonte();
  const area = Math.PI * Math.max(1, raioE * raioE - raioB * raioB) * CHUNK_XZ * CHUNK_XZ;
  const lado = Math.max(PASSO * 2, Math.sqrt(area / cap));
  const baldes = new Map();
  for (let i = 0; i < todos.length; i++) {
    const item = todos[i];
    const k = `${Math.floor(item.x / lado)},${Math.floor(item.y / lado)}`;
    let lista = baldes.get(k);
    if (!lista) {
      lista = [];
      baldes.set(k, lista);
    }
    lista.push(item);
  }
  const chaves = [...baldes.keys()].sort();
  for (let i = 0; i < chaves.length; i++) {
    baldes.get(chaves[i]).sort((a, b) => hash2(a.x | 0, a.y | 0, 3) - hash2(b.x | 0, b.y | 0, 3));
  }
  const saida = [];
  let rodada = 0;
  while (saida.length < cap) {
    let avancou = false;
    for (let i = 0; i < chaves.length; i++) {
      const lista = baldes.get(chaves[i]);
      if (rodada >= lista.length) continue;
      saida.push(lista[rodada]);
      avancou = true;
      if (saida.length >= cap) break;
    }
    if (!avancou) break;
    rodada += 1;
  }
  return saida;
}

function montarBanda(px, py) {
  const raioB = Math.max(obterRaioStream(), obterRaioSuave());
  const raioE = obterRaioHorizonte();
  const pcx = Math.floor(px / CHUNK_XZ);
  const pcy = Math.floor(py / CHUNK_XZ);
  const sig = `${pcx},${pcy},${raioB},${raioE},${STRIDE_CHUNK}`;
  const lista = [];
  if (!(raioE > raioB)) return { sig, lista };
  const dentroB = raioB * raioB + 1;
  const dentroE = raioE * raioE + 1;
  // Âncora estável no grid de stride — sem flicker ao andar 1 chunk.
  const ox = ((pcx % STRIDE_CHUNK) + STRIDE_CHUNK) % STRIDE_CHUNK;
  const oy = ((pcy % STRIDE_CHUNK) + STRIDE_CHUNK) % STRIDE_CHUNK;
  for (let dy = -raioE; dy <= raioE; dy++) {
    if (((dy + oy) % STRIDE_CHUNK) !== 0) continue;
    for (let dx = -raioE; dx <= raioE; dx++) {
      if (((dx + ox) % STRIDE_CHUNK) !== 0) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 <= dentroB || d2 > dentroE) continue;
      const cx = pcx + dx;
      const cy = pcy + dy;
      lista.push({ cx, cy, k: `${cx},${cy}`, d2 });
    }
  }
  lista.sort((a, b) => a.d2 - b.d2);
  return { sig, lista };
}

function* clumpsDoChunk(cx, cy) {
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  const nivel = nivelMarBlocos();
  /** @type {object[]} */
  const itens = [];
  let n = 0;
  for (let ly = 0; ly < CHUNK_XZ; ly += PASSO) {
    for (let lx = 0; lx < CHUNK_XZ; lx += PASSO) {
      const wx = baseX + lx + (PASSO >> 1);
      const wy = baseY + ly + (PASSO >> 1);
      const h = alturaDoRelevo(wx, wy);
      if (!(h > nivel)) {
        if ((++n & 3) === 0) yield;
        continue;
      }
      const bioma = biomaDominante(wx, wy);
      const id = bioma?.id || "";
      if (!biomaAceitaFloresta(id)) {
        if ((++n & 3) === 0) yield;
        continue;
      }
      const familia = familiaClumpDeBioma(id);
      const densBase =
        familia === "lush" ? 0.62 : familia === "autum" ? 0.5 : familia === "light" ? 0.44 : 0.28;
      if (hash2(wx, wy, 0xc1a55) > densBase) {
        if ((++n & 3) === 0) yield;
        continue;
      }
      // Cliff grosseiro: vizinho 1 passo mais baixo.
      const hE = alturaDoRelevo(wx + PASSO, wy);
      if (h - hE >= 3) {
        if ((++n & 3) === 0) yield;
        continue;
      }
      const tamanho = sortearTamanhoClump(wx, wy);
      itens.push({
        x: wx,
        y: wy,
        h,
        familia,
        tamanho,
        chave: `${familia}:${tamanho}`,
      });
      if ((++n & 3) === 0) yield;
    }
  }
  return itens;
}

export function criarVegetacaoHorizonte() {
  const grupo = new THREE.Group();
  grupo.name = "vegetacao-horizonte";
  grupo.visible = false;

  /** @type {Map<string, { mesh: THREE.InstancedMesh, material: THREE.Material, geo: THREE.BufferGeometry, itens: object[], clump: object }>} */
  const lotes = new Map();
  /** @type {Map<string, { itens: object[] }>} */
  const cache = new Map();
  let atlasAtual = null;
  let trabalho = null;
  let sigBanda = "";
  let geracao = 0;
  let geracaoPublicada = -1;
  let yawAplicado = null;
  let inclinacaoAplicada = 0;

  function soltarLote(lote) {
    removerObjetoCena(lote.mesh?.userData?.cenaId);
    grupo.remove(lote.mesh);
    lote.material.dispose();
    lote.geo.dispose();
  }

  function montarLote(chave, clump) {
    const anterior = lotes.get(chave);
    if (anterior) soltarLote(anterior);
    const geo = geometriaNoPe(0.5, 1);
    const material = aplicarVentoVeg(
      aplicarSombraNuvem(
        aplicarLuzBillboard(
          new THREE.MeshStandardMaterial({
            map: clump.tex,
            color: TINT_FAR,
            roughness: 1,
            metalness: 0,
            transparent: false,
            alphaTest: VEG_ALPHA_TEST,
            depthWrite: true,
            depthTest: true,
            side: THREE.FrontSide,
          }),
        ),
        { clareia: true },
      ),
      "clump",
    );
    marcarStencilSolido(material);
    const mesh = new THREE.InstancedMesh(geo, material, CLUMP_CAP);
    mesh.name = `clump-${chave}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.count = 0;
    grupo.add(mesh);
    const lote = { chave, mesh, material, geo, itens: [], clump };
    lotes.set(chave, lote);
    registrarObjetoCena(mesh, {
      id: mesh.name,
      pasta: "Vegetação",
      rotulo: mesh.name,
      tipo: "instâncias",
    });
    return lote;
  }

  function escrever(yaw, inclinacao) {
    let algum = false;
    for (const lote of lotes.values()) {
      const itens = lote.itens;
      const clump = lote.clump;
      lote.mesh.count = itens.length;
      lote.mesh.visible = itens.length > 0;
      if (!itens.length) continue;
      algum = true;
      for (let i = 0; i < itens.length; i++) {
        const p = itens[i];
        poseCartao(dummy, {
          x: p.x,
          y: p.h * ALTURA_BLOCO,
          z: p.y,
          largura: clump.largura,
          altura: clump.altura,
          yaw,
          inclinacao,
          pivotY: 1,
          opacoY: 1,
          dz: 0,
          elevado: true,
        });
        lote.mesh.setMatrixAt(i, dummy.matrix);
      }
      lote.mesh.instanceMatrix.needsUpdate = true;
      lote.mesh.computeBoundingSphere();
    }
    grupo.visible = algum;
  }

  function publicar(banda) {
    const todos = [];
    for (let i = 0; i < banda.lista.length; i++) {
      const ch = banda.lista[i];
      const salvo = cache.get(ch.k);
      if (!salvo) continue;
      const itens = salvo.itens;
      for (let j = 0; j < itens.length; j++) todos.push(itens[j]);
    }
    const escolhidos = espalhar(todos, CLUMP_CAP);
    const grupos = new Map();
    for (let i = 0; i < escolhidos.length; i++) {
      const item = escolhidos[i];
      let lista = grupos.get(item.chave);
      if (!lista) {
        lista = [];
        grupos.set(item.chave, lista);
      }
      lista.push(item);
    }

    for (const [chave, itens] of grupos) {
      const [familia, tamanho] = chave.split(":");
      const clump = obterClump(atlasAtual, familia, tamanho);
      if (!clump) continue;
      let lote = lotes.get(chave);
      if (!lote || lote.clump !== clump) lote = montarLote(chave, clump);
      lote.itens = itens.slice(0, CLUMP_CAP);
    }
    for (const [chave, lote] of lotes) {
      if (grupos.has(chave)) continue;
      lote.itens = [];
      lote.mesh.count = 0;
      lote.mesh.visible = false;
    }
    geracaoPublicada = geracao;
    yawAplicado = null;
  }

  function faltaCache(banda) {
    for (let i = 0; i < banda.lista.length; i++) {
      if (!cache.has(banda.lista[i].k)) return true;
    }
    return false;
  }

  function podarCache(banda) {
    const fica = new Set();
    for (let i = 0; i < banda.lista.length; i++) fica.add(banda.lista[i].k);
    for (const k of cache.keys()) {
      if (!fica.has(k)) cache.delete(k);
    }
  }

  function* varrer(banda) {
    for (let i = 0; i < banda.lista.length; i++) {
      const ch = banda.lista[i];
      if (cache.has(ch.k)) continue;
      const gen = clumpsDoChunk(ch.cx, ch.cy);
      let passo = gen.next();
      while (!passo.done) {
        yield;
        passo = gen.next();
      }
      cache.set(ch.k, { itens: passo.value });
      geracao += 1;
      yield;
    }
  }

  function desligar() {
    trabalho = null;
    cache.clear();
    for (const lote of lotes.values()) soltarLote(lote);
    lotes.clear();
    grupo.visible = false;
    sigBanda = "";
    geracao = 0;
    geracaoPublicada = -1;
    yawAplicado = null;
    inclinacaoAplicada = 0;
  }

  function tick(px, py, yawCam, inclinacao = 0) {
    const raioE = obterRaioHorizonte();
    const raioB = Math.max(obterRaioStream(), obterRaioSuave());
    if (!(raioE > raioB) || !atlasAtual) {
      if (grupo.visible || lotes.size || cache.size || trabalho) desligar();
      return;
    }

    const banda = montarBanda(px, py);
    if (banda.sig !== sigBanda) {
      sigBanda = banda.sig;
      trabalho = null;
      podarCache(banda);
    }
    if (!trabalho && faltaCache(banda)) {
      trabalho = varrer(banda);
    }
    if (trabalho) {
      const t0 = performance.now();
      let passo;
      while (performance.now() - t0 < ORCAMENTO_MS) {
        passo = trabalho.next();
        if (passo.done) break;
      }
      if (passo?.done) trabalho = null;
    }

    const deltaGeracao = geracao - geracaoPublicada;
    if (
      geracao !== geracaoPublicada &&
      (!trabalho || deltaGeracao >= PUBLICAR_A_CADA || geracaoPublicada < 0)
    ) {
      publicar(banda);
    }

    const yaw = Number.isFinite(yawCam) ? yawCam : 0;
    const tilt = Number.isFinite(inclinacao) ? inclinacao : 0;
    const mudouTilt = Math.abs(tilt - inclinacaoAplicada) > VEG_YAW_EPS;
    if (yawAplicado == null || yawDiferente(yaw, yawAplicado) || mudouTilt) {
      yawAplicado = yaw;
      inclinacaoAplicada = tilt;
      escrever(yaw, tilt);
    }
  }

  function aplicarAtlas(atlas) {
    atlasAtual = atlas;
    liberarClumps();
    aquecerClumps(atlas);
    geracaoPublicada = -1;
    for (const lote of lotes.values()) soltarLote(lote);
    lotes.clear();
  }

  return {
    grupo,
    tick,
    aplicarAtlas,
    liberar() {
      desligar();
      liberarClumps();
      atlasAtual = null;
    },
  };
}
