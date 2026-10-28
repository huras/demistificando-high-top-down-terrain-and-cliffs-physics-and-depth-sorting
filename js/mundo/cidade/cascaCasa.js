/**
 * Colisão da casa = casca do OBJ.
 * Material door_only, e a face marcada como porta no editor, é o vão: não vira bloco.
 * O fundo do modelo não tem faces: vira parede, porque a porta não fica atrás.
 * h_kage é a sombra no chão: também não.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { deLocalKanto } from "../bounds.js";
import { ALTURA_PRACA, amostraKanto } from "../regiao/amostraKanto.js";
import { AREA_KANTO } from "../regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../regiao/kantoCidades.js";
import { ajusteDe, definirAjustes } from "./ajustesColisor.js";
import { corpoPadraoSprite, portaPadraoSprite } from "./caixaSprite.js";
import { chaveColisorSprite, medidaSprite, pontosGradeUsina } from "./spritesPredio.js";
import { caixaDoCorpo, faixaDaPorta, montarLayout } from "../regiao/volumesCidade.js";
import { yawDoEdificio } from "./orientacaoEdificio.js";
import { fatorYCasa } from "../../render/3d/escalaVertical.js";
import { indiceLocal, invalidarFluxo, recalcularSuperficies } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";
import { idDaCasa, idsColisao, origemDoModelo, urlDoModelo } from "./catalogoCasas.js";
import { lerFacesObj, partirGrupos } from "./facesObj.js";

const FOLGA = 0.96;
const LADO_X = 6;
const LADO_Z = 5;
const IDS = idsColisao();
/** O lote fica sólido. A única abertura é a porta da frente, quando a casa tem uma. */

/** @type {Map<string, { celulas: Int16Array, minX: number, maxX: number, minZ: number, maxZ: number }>} */
const moldes = new Map();
/** @type {object[]} */
const colocacoes = [];
let pronto = false;
/** @type {{ sprite: string, x: number, y: number, altura: number }[]} */
let gradeUsina = [];
/** @type {Map<string, { largura: number, altura: number }>} */
const medidaPorSprite = new Map();
/** @type {Promise<boolean> | null} */
let carga = null;

function medidaDoSprite(sprite) {
  if (!sprite) return null;
  if (medidaPorSprite.has(sprite)) return medidaPorSprite.get(sprite);
  const base = sprite.replace(/-(rock|water|electric|grass|poison|psychic|fire|ground)$/, "");
  return medidaPorSprite.get(base) || null;
}

function comMedidaSprite(casa, sprite) {
  const medida = medidaDoSprite(sprite);
  if (!medida) return casa;
  casa.larguraSprite = medida.largura;
  casa.alturaSprite = medida.altura;
  return casa;
}

function caixaDoEditor(casa, papel) {
  const ajuste = ajusteDe(casa);
  if (papel === "porta") {
    if (ajuste && Object.prototype.hasOwnProperty.call(ajuste, "porta")) return ajuste.porta;
    return portaPadraoSprite(casa.larguraSprite);
  }
  if (ajuste?.corpo) return ajuste.corpo;
  return corpoPadraoSprite(casa.larguraSprite);
}

function volumeCartao(casa, caixa) {
  if (!caixa) return null;
  return {
    cartao: true,
    px: casa.px,
    py: casa.py,
    x: Number(caixa.x) || 0,
    y: Number(caixa.y) || 0,
    lx: Number(caixa.lx) || 1,
    ly: Number(caixa.ly) || 1,
  };
}

function topoDoVolume(casa) {
  return Math.min(CHUNK_Y, ALTURA_PRACA + Math.max(3, casa.altura | 0));
}

function modeloDoPapel(papel, variante, cidade) {
  if (papel === "casa") return idDaCasa(cidade, variante);
  if (
    papel === "centro" ||
    papel === "loja" ||
    papel === "lab" ||
    papel === "ginasio" ||
    papel === "museu" ||
    papel === "coliseu" ||
    papel === "mansao" ||
    papel === "ruina"
  ) {
    return papel;
  }
  return null;
}

function giro(x, z, yaw) {
  const k = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  if (k === 1) return [z, -x];
  if (k === 2) return [-x, -z];
  if (k === 3) return [-z, x];
  return [x, z];
}

function ignorar(mtl) {
  const nome = (mtl || "").toLowerCase();
  return nome.includes("kage") || nome.startsWith("door_only");
}

function ehVao(mtl) {
  return (mtl || "").toLowerCase().startsWith("door_only");
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cruz(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function marcarCelula(marcas, limites, x, y, z) {
  if (y < 0) return;
  const chave = `${x},${y},${z}`;
  if (marcas.has(chave)) return;
  marcas.add(chave);
  if (x < limites.minX) limites.minX = x;
  if (x > limites.maxX) limites.maxX = x;
  if (z < limites.minZ) limites.minZ = z;
  if (z > limites.maxZ) limites.maxZ = z;
}

function caixaDosTri(tris) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    for (let k = 0; k < 3; k++) {
      const p = t.p[k];
      for (let a = 0; a < 3; a++) {
        if (p[a] < min[a]) min[a] = p[a];
        if (p[a] > max[a]) max[a] = p[a];
      }
    }
  }
  return { min, max };
}

/**
 * A casca marca o voxel de dentro da superfície.
 * Na normal, e na borda da casa, a quina do bloco fica a no máximo meio bloco da malha.
 */
function marcarTriangulo(marcas, limites, caixa, a, b, c) {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const n = cruz(ab, ac);
  const nl = Math.hypot(n[0], n[1], n[2]);
  let eixo = 0;
  if (nl > 1e-8) {
    if (Math.abs(n[1]) > Math.abs(n[eixo])) eixo = 1;
    if (Math.abs(n[2]) > Math.abs(n[eixo])) eixo = 2;
  }
  const sinalNormal = nl > 1e-8 && n[eixo] < 0 ? -1 : 1;
  const margem = 0.9;
  const lab = Math.hypot(ab[0], ab[1], ab[2]);
  const lac = Math.hypot(ac[0], ac[1], ac[2]);
  const lbc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]);
  const passos = Math.max(1, Math.ceil(Math.max(lab, lac, lbc) / 0.25));
  for (let i = 0; i <= passos; i++) {
    const u = i / passos;
    for (let j = 0; j <= passos - i; j++) {
      const v = j / passos;
      const w = 1 - u - v;
      const p = [
        a[0] * w + b[0] * u + c[0] * v,
        a[1] * w + b[1] * u + c[1] * v,
        a[2] * w + b[2] * u + c[2] * v,
      ];
      const cel = [0, 0, 0];
      for (let eixoA = 0; eixoA < 3; eixoA++) {
        let sinal = 0;
        const naPeleMais = p[eixoA] >= caixa.max[eixoA] - margem;
        const naPeleMenos = p[eixoA] <= caixa.min[eixoA] + margem;
        if (eixoA === eixo) {
          const normalParaFora = (sinalNormal > 0 && naPeleMais) || (sinalNormal < 0 && naPeleMenos);
          const telhado = eixoA === 1 && sinalNormal > 0;
          if (normalParaFora || telhado) sinal = sinalNormal;
        } else if (naPeleMais) sinal = 1;
        else if (naPeleMenos) sinal = -1;
        cel[eixoA] = sinal ? Math.floor(p[eixoA] - 0.5 * sinal) : Math.floor(p[eixoA]);
      }
      marcarCelula(marcas, limites, cel[0], cel[1], cel[2]);
    }
  }
}

let partes = {};

function portasDo(id) {
  const lista = partes[id]?.porta;
  if (!Array.isArray(lista) || !lista.length) return null;
  return new Set(lista);
}

function faceEhPorta(f, portas) {
  if (ehVao(f.mtl)) return true;
  return !!(portas && portas.has(f.indice));
}

/** O lado com menos parede é o fundo aberto do modelo. A porta fica no lado oposto. */
function ladoAberto(solidos) {
  const area = [0, 0, 0, 0];
  for (let i = 0; i < solidos.length; i++) {
    const t = solidos[i];
    const n = cruz(sub(t.b, t.a), sub(t.c, t.a));
    const ax = Math.abs(n[0]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(n[2]);
    if (ay >= ax && ay >= az) continue;
    const lado = ax >= az ? (n[0] > 0 ? 0 : 1) : (n[2] > 0 ? 2 : 3);
    area[lado] += Math.hypot(n[0], n[1], n[2]);
  }
  let menor = 0;
  for (let i = 1; i < 4; i++) if (area[i] < area[menor]) menor = i;
  if (area[menor] > area[menor ^ 1] * 0.45) return -1;
  return menor;
}

function ladoDaPorta(vaos, caixa) {
  if (!vaos.length || !caixa) return -1;
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (let i = 0; i < vaos.length; i++) {
    const t = vaos[i];
    for (let k = 0; k < 3; k++) {
      sx += t.p[k][0];
      sz += t.p[k][2];
      n += 1;
    }
  }
  sx /= n;
  sz /= n;
  const dist = [
    Math.abs(sx - caixa.max[0]),
    Math.abs(sx - caixa.min[0]),
    Math.abs(sz - caixa.max[2]),
    Math.abs(sz - caixa.min[2]),
  ];
  let lado = 0;
  for (let i = 1; i < 4; i++) if (dist[i] < dist[lado]) lado = i;
  return lado;
}

function descreverFundo(solidos, vaos, caixa) {
  let lado = ladoAberto(solidos);
  const porta = ladoDaPorta(vaos, caixa);
  if (lado >= 0 && lado === porta) lado ^= 1;
  if (lado < 0) return null;
  const eixo = lado < 2 ? 0 : 2;
  const paraDentro = lado % 2 === 0 ? -1 : 1;
  const outro = eixo === 0 ? 2 : 0;
  const plano = paraDentro > 0 ? caixa.min[eixo] : caixa.max[eixo];
  if (!Number.isFinite(plano)) return null;
  const medido = Math.ceil(caixa.max[1] || 0);
  return {
    eixo,
    paraDentro,
    plano,
    minU: caixa.min[outro],
    maxU: caixa.max[outro],
    topo: Math.max(3, Math.ceil(1.75), medido),
  };
}

function caixaDoVao(vaos) {
  if (!vaos.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vaos.length; i++) {
    const t = vaos[i];
    for (let k = 0; k < 3; k++) {
      const p = t.p[k];
      for (let a = 0; a < 3; a++) {
        if (p[a] < min[a]) min[a] = p[a];
        if (p[a] > max[a]) max[a] = p[a];
      }
    }
  }
  if (max[1] < 1.75) max[1] = 1.75;
  return { min, max };
}

function encolherEixo(min, max) {
  const folga = 0.2;
  const a = min + folga;
  const b = max - folga;
  if (b - a < 0.5) return [min, max];
  for (let c = Math.floor(a); c <= Math.floor(b); c++) {
    const centro = c + 0.5;
    if (centro >= a && centro <= b) return [a, b];
  }
  return [min, max];
}

function abrirVao(marcas, vaos) {
  if (!vaos.length) return;
  const caixa = caixaDoVao(vaos);
  const min = caixa.min.slice();
  const max = caixa.max.slice();
  const normal = [0, 0, 0];
  for (let i = 0; i < vaos.length; i++) {
    const t = vaos[i];
    const n = cruz(sub(t.b, t.a), sub(t.c, t.a));
    normal[0] += n[0];
    normal[1] += n[1];
    normal[2] += n[2];
  }
  let eixo = 0;
  if (Math.abs(normal[1]) > Math.abs(normal[eixo])) eixo = 1;
  if (Math.abs(normal[2]) > Math.abs(normal[eixo])) eixo = 2;
  min[eixo] -= 1;
  max[eixo] += 1;
  for (let a = 0; a < 3; a++) {
    if (a === eixo) continue;
    const faixa = encolherEixo(min[a], max[a]);
    min[a] = faixa[0];
    max[a] = faixa[1];
  }
  if (eixo !== 1 && max[1] < 1.75) max[1] = 1.75;
  for (const chave of [...marcas]) {
    const p = chave.split(",");
    const c = [+p[0] + 0.5, +p[1] + 0.5, +p[2] + 0.5];
    if (c[0] < min[0] || c[0] > max[0] || c[1] < min[1] || c[1] > max[1] || c[2] < min[2] || c[2] > max[2]) {
      continue;
    }
    marcas.delete(chave);
  }
}

export function moldeDaMalha(objTexto, portas = null) {
  const obj = lerFacesObj(objTexto);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < obj.verts.length; i++) {
    const v = obj.verts[i];
    if (v[0] < minX) minX = v[0];
    if (v[1] < minY) minY = v[1];
    if (v[2] < minZ) minZ = v[2];
    if (v[0] > maxX) maxX = v[0];
    if (v[2] > maxZ) maxZ = v[2];
  }
  const escala = Math.min(LADO_X / (maxX - minX || 1), LADO_Z / (maxZ - minZ || 1)) * FOLGA;
  const escalaY = escala * fatorYCasa();
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  function local(v) {
    return [(v[0] - cx) * escala, (v[1] - minY) * escalaY, (v[2] - cz) * escala];
  }

  const solidos = [];
  const vaos = [];
  for (let i = 0; i < obj.faces.length; i++) {
    const f = obj.faces[i];
    if (ignorar(f.mtl) && !faceEhPorta(f, portas)) continue;
    const a = local(f.a);
    const b = local(f.b);
    const c = local(f.c);
    const tri = { a, b, c, p: [a, b, c] };
    if (faceEhPorta(f, portas)) vaos.push(tri);
    else solidos.push(tri);
  }

  const marcas = new Set();
  const limites = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const caixa = caixaDosTri(solidos);
  for (let i = 0; i < solidos.length; i++) {
    const t = solidos[i];
    marcarTriangulo(marcas, limites, caixa, t.a, t.b, t.c);
  }
  const grupos = partirGrupos(vaos);
  for (let i = 0; i < grupos.length; i++) abrirVao(marcas, grupos[i]);
  const fundo = descreverFundo(solidos, vaos, caixa);
  const vao = caixaDoVao(vaos);
  const predio = caixaLocal(obj.verts, local);
  const porta = alinharPortaNaFachada(descreverPorta(vao, predio), fundo, predio);
  let minVX = limites.minX;
  let maxVX = limites.maxX;
  let minVZ = limites.minZ;
  let maxVZ = limites.maxZ;

  const celulas = new Int16Array(marcas.size * 3);
  let cursor = 0;
  let maxAltura = 0;
  for (const chave of marcas) {
    const p = chave.split(",");
    const iy = +p[1];
    celulas[cursor++] = +p[0];
    celulas[cursor++] = iy;
    celulas[cursor++] = +p[2];
    if (iy + 1 > maxAltura) maxAltura = iy + 1;
  }
  if (!Number.isFinite(minVX)) {
    minVX = 0;
    maxVX = 0;
    minVZ = 0;
    maxVZ = 0;
  }
  if (fundo) {
    if (fundo.eixo === 0) {
      if (fundo.paraDentro > 0) minVX -= 1;
      else maxVX += 1;
    } else if (fundo.paraDentro > 0) minVZ -= 1;
    else maxVZ += 1;
    if (fundo.topo > maxAltura) maxAltura = fundo.topo;
  }
  const predioH = predio ? Math.ceil(predio.max[1] || 0) : 0;
  if (predioH > maxAltura) maxAltura = predioH;
  return {
    celulas,
    minX: minVX,
    maxX: maxVX,
    minZ: minVZ,
    maxZ: maxVZ,
    altura: Math.max(3, maxAltura),
    temPorta: vaos.length > 0,
    fundo,
    vao,
    porta,
  };
}

function caixaLocal(verts, local) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.length; i++) {
    const p = local(verts[i]);
    for (let a = 0; a < 3; a++) {
      if (p[a] < min[a]) min[a] = p[a];
      if (p[a] > max[a]) max[a] = p[a];
    }
  }
  return { min, max };
}

/** Porta da malha, no espaço local do prédio. O vão do lote usa isso em vez do meio da fachada. */
function descreverPorta(vao, predio) {
  if (!vao || !predio) return null;
  const dx = vao.max[0] - vao.min[0];
  const dz = vao.max[2] - vao.min[2];
  const cx = (vao.min[0] + vao.max[0]) * 0.5;
  const cz = (vao.min[2] + vao.max[2]) * 0.5;
  const eixo = dz <= dx ? 2 : 0;
  let paraFora = 1;
  let u0 = 0;
  let u1 = 0;
  let plano = 0;
  if (eixo === 2) {
    const sul = Math.abs(cz - predio.max[2]);
    const norte = Math.abs(cz - predio.min[2]);
    paraFora = sul <= norte ? 1 : -1;
    u0 = vao.min[0];
    u1 = vao.max[0];
    plano = paraFora > 0 ? vao.max[2] : vao.min[2];
  } else {
    const leste = Math.abs(cx - predio.max[0]);
    const oeste = Math.abs(cx - predio.min[0]);
    paraFora = leste <= oeste ? 1 : -1;
    u0 = vao.min[2];
    u1 = vao.max[2];
    plano = paraFora > 0 ? vao.max[0] : vao.min[0];
  }
  const larguraMin = 1.05;
  if (u1 - u0 < larguraMin) {
    const meio = (u0 + u1) * 0.5;
    u0 = meio - larguraMin * 0.5;
    u1 = meio + larguraMin * 0.5;
  } else {
    u0 -= 0.2;
    u1 += 0.2;
  }
  return { eixo, u0, u1, plano, paraFora };
}

/** A fachada da rua é o lado oposto ao fundo aberto. O Centro já nasce assim. */
function alinharPortaNaFachada(porta, fundo, predio) {
  if (!porta || !fundo || porta.eixo !== fundo.eixo || !predio) return porta;
  const rua = fundo.paraDentro > 0 ? 1 : -1;
  if (porta.paraFora === rua) return porta;
  const eixo = porta.eixo === 0 ? 0 : 2;
  porta.paraFora = rua;
  porta.plano = rua > 0 ? predio.max[eixo] : predio.min[eixo];
  return porta;
}

export function portaDoModelo(id) {
  return moldes.get(id)?.porta || null;
}

const _vaosPerto = [];

function dist2Caixa(x, y, x0, y0, x1, y1) {
  const px = x < x0 ? x0 : x > x1 ? x1 : x;
  const py = y < y0 ? y0 : y > y1 ? y1 : y;
  const dx = x - px;
  const dy = y - py;
  return dx * dx + dy * dy;
}

/**
 * Portas cuja caixa chega no corpo.
 * null enquanto a casca não carregou. O array é reusado no próximo frame.
 */
export function vaosPortaPerto(x, y, raio) {
  if (!pronto) return null;
  const r2 = raio * raio;
  const alcance = 36;
  _vaosPerto.length = 0;
  for (let i = 0; i < colocacoes.length; i++) {
    const casa = colocacoes[i];
    if (casa.porta === false) continue;
    const dx = x - casa.px;
    const dy = y - casa.py;
    if (dx * dx + dy * dy > alcance * alcance) continue;
    const faixa = faixaDoLote(casa);
    if (!faixa) continue;
    const x0 = casa.ox + faixa.x0;
    const x1 = casa.ox + faixa.x1;
    const y0 = casa.oy + faixa.y0;
    const y1 = casa.oy + faixa.y1;
    if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue;
    const d = dist2Caixa(x, y, x0, y0, x1, y1);
    if (d > r2) continue;
    _vaosPerto.push({
      d,
      papel: casa.papel,
      loteX0: casa.x0,
      loteY0: casa.y0,
    });
  }
  return _vaosPerto;
}

/** Vão que a porta deixa sem bloco. Mesma caixa que a colisão do lote usa. */
export function listarVaosPorta() {
  if (!pronto) return [];
  const saida = [];
  for (let i = 0; i < colocacoes.length; i++) {
    const casa = colocacoes[i];
    if (casa.sprite) {
      const volume = volumeCartao(casa, caixaDoEditor(casa, "porta"));
      if (volume) saida.push(volume);
      continue;
    }
    const molde = casa.base ? null : moldes.get(casa.id);
    const faixa = faixaDaPorta(casa, molde?.porta || null);
    if (!faixa) continue;
    const x0 = casa.ox + faixa.x0;
    const x1 = casa.ox + faixa.x1;
    const y0 = casa.oy + faixa.y0;
    const y1 = casa.oy + faixa.y1;
    if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue;
    saida.push({
      x0,
      x1,
      y0,
      y1,
      z0: ALTURA_PRACA,
      z1: topoDoVolume(casa),
    });
  }
  return saida;
}

/** Sólido do lote, o mesmo que a física lacra. A porta fica de fora. */
export function listarSolidosCasa() {
  if (!pronto) return [];
  const saida = [];
  for (let i = 0; i < colocacoes.length; i++) {
    const casa = colocacoes[i];
    if (casa.sprite) {
      const volume = volumeCartao(casa, caixaDoEditor(casa, "corpo"));
      if (volume) saida.push(volume);
      continue;
    }
    const corpo = caixaDoCorpo(casa);
    const x0 = casa.ox + corpo.x0;
    const x1 = casa.ox + corpo.x1;
    const y0 = casa.oy + corpo.y0;
    const y1 = casa.oy + corpo.y1;
    const z0 = ALTURA_PRACA;
    const z1 = topoDoVolume(casa);
    const molde = casa.base ? null : moldes.get(casa.id);
    const faixa = faixaDaPorta(casa, molde?.porta || null);
    if (!faixa) {
      empurrarSolido(saida, x0, x1, y0, y1, z0, z1);
      continue;
    }
    const dx0 = Math.max(x0, casa.ox + faixa.x0);
    const dx1 = Math.min(x1, casa.ox + faixa.x1);
    const dy0 = Math.max(y0, casa.oy + faixa.y0);
    const dy1 = Math.min(y1, casa.oy + faixa.y1);
    if (dx1 - dx0 < 0.05 || dy1 - dy0 < 0.05) {
      empurrarSolido(saida, x0, x1, y0, y1, z0, z1);
      continue;
    }
    empurrarSolido(saida, x0, dx0, y0, y1, z0, z1);
    empurrarSolido(saida, dx1, x1, y0, y1, z0, z1);
    empurrarSolido(saida, dx0, dx1, y0, dy0, z0, z1);
    empurrarSolido(saida, dx0, dx1, dy1, y1, z0, z1);
  }
  return saida;
}

function empurrarSolido(saida, x0, x1, y0, y1, z0, z1) {
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05 || z1 - z0 < 0.5) return;
  saida.push({ x0, x1, y0, y1, z0, z1 });
}

function localDoDelta(dx, dy, yaw) {
  const k = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  if (k === 1) return [-dy, dx];
  if (k === 2) return [-dx, -dy];
  if (k === 3) return [dy, -dx];
  return [dx, dy];
}

function faixaCruza(a0, a1, b0, b1) {
  return a1 > b0 && a0 < b1;
}

function selarFundoNoChunk(chunk, casa, fundo, x0, y0, x1, y1) {
  if (!fundo) return false;
  const alcance = 6;
  const wx0 = Math.max(x0, Math.floor(casa.px - alcance));
  const wx1 = Math.min(x1, Math.ceil(casa.px + alcance));
  const wy0 = Math.max(y0, Math.floor(casa.py - alcance));
  const wy1 = Math.min(y1, Math.ceil(casa.py + alcance));
  const plano0 = fundo.paraDentro > 0 ? fundo.plano - 0.02 : fundo.plano - 1;
  const plano1 = fundo.paraDentro > 0 ? fundo.plano + 1 : fundo.plano + 0.02;
  let mudou = false;
  for (let wy = wy0; wy < wy1; wy++) {
    for (let wx = wx0; wx < wx1; wx++) {
      const cantos = [
        localDoDelta(wx - casa.px, wy - casa.py, casa.yaw),
        localDoDelta(wx + 1 - casa.px, wy - casa.py, casa.yaw),
        localDoDelta(wx - casa.px, wy + 1 - casa.py, casa.yaw),
        localDoDelta(wx + 1 - casa.px, wy + 1 - casa.py, casa.yaw),
      ];
      let minE = Infinity;
      let maxE = -Infinity;
      let minU = Infinity;
      let maxU = -Infinity;
      for (let i = 0; i < 4; i++) {
        const e = fundo.eixo === 0 ? cantos[i][0] : cantos[i][1];
        const u = fundo.eixo === 0 ? cantos[i][1] : cantos[i][0];
        if (e < minE) minE = e;
        if (e > maxE) maxE = e;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
      }
      if (!faixaCruza(minE, maxE, plano0, plano1)) continue;
      if (!faixaCruza(minU, maxU, fundo.minU, fundo.maxU)) continue;
      const amostra = amostraKanto(wx, wy);
      // Quintal/rua: não vira parede de pedra (malha lia como terra atrás do lab).
      if (!amostra?.modelo) continue;
      for (let iy = 0; iy < fundo.topo; iy++) {
        const gz = ALTURA_PRACA + iy;
        if (gz < 0 || gz >= CHUNK_Y) continue;
        if (gz < (amostra.h | 0)) continue;
        const li = indiceLocal(wx - x0, wy - y0, gz);
        if (chunk.blocos[li] === BLOCO.PEDRA) continue;
        chunk.blocos[li] = BLOCO.PEDRA;
        mudou = true;
      }
    }
  }
  return mudou;
}

function mundoDaCelula(ix, iy, iz, casa) {
  const [rx, rz] = giro(ix + 0.5, iz + 0.5, casa.yaw);
  return [Math.floor(casa.px + rx), Math.floor(casa.py + rz), ALTURA_PRACA + iy];
}

function casaTocaChunk(casa, molde, x0, y0, x1, y1) {
  const cantos = [
    [molde.minX, molde.minZ],
    [molde.maxX + 1, molde.minZ],
    [molde.minX, molde.maxZ + 1],
    [molde.maxX + 1, molde.maxZ + 1],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < cantos.length; i++) {
    const [rx, rz] = giro(cantos[i][0], cantos[i][1], casa.yaw);
    const wx = casa.px + rx;
    const wy = casa.py + rz;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  return maxX > x0 && minX < x1 && maxY > y0 && minY < y1;
}

function faixaDoLote(casa) {
  return faixaDaPorta(casa, casa.base ? null : moldes.get(casa.id)?.porta);
}

function naFaixaMundo(wx, wy, casa, faixa) {
  return centroNaFaixa(wx, casa.ox + faixa.x0, casa.ox + faixa.x1)
    && centroNaFaixa(wy, casa.oy + faixa.y0, casa.oy + faixa.y1);
}

function centroNaFaixa(i, a0, a1) {
  const c = i + 0.5;
  return c >= a0 && c < a1;
}

function limparLoteNoChunk(chunk, casa, x0, y0, x1, y1) {
  const vx0 = Math.max(x0, Math.floor(casa.ox + casa.x0));
  const vx1 = Math.min(x1, Math.ceil(casa.ox + casa.x1));
  const vy0 = Math.max(y0, Math.floor(casa.oy + casa.y0));
  const vy1 = Math.min(y1, Math.ceil(casa.oy + casa.y1));
  const z0 = ALTURA_PRACA;
  // Folga alta: some placeholder/lacrar antigo (ex.: lab em 8) acima da altura nova.
  const z1 = Math.min(CHUNK_Y, ALTURA_PRACA + Math.max(16, (casa.altura | 0) + 8));
  let mudou = false;
  for (let wy = vy0; wy < vy1; wy++) {
    for (let wx = vx0; wx < vx1; wx++) {
      const lx = wx - casa.ox;
      const ly = wy - casa.oy;
      if (lx < casa.x0 || lx >= casa.x1 || ly < casa.y0 || ly >= casa.y1) continue;
      for (let z = z0; z < z1; z++) {
        const li = indiceLocal(wx - x0, wy - y0, z);
        if (chunk.blocos[li] === BLOCO.AR) continue;
        chunk.blocos[li] = BLOCO.AR;
        mudou = true;
      }
    }
  }
  return mudou;
}

function lacrarLoteNoChunk(chunk, casa, x0, y0, x1, y1) {
  const corpo = caixaDoCorpo(casa);
  const wx0 = casa.ox + corpo.x0;
  const wx1 = casa.ox + corpo.x1;
  const wy0 = casa.oy + corpo.y0;
  const wy1 = casa.oy + corpo.y1;
  const faixa = faixaDoLote(casa);
  const z0 = ALTURA_PRACA;
  const z1 = Math.min(CHUNK_Y, ALTURA_PRACA + Math.max(3, casa.altura | 0));
  let mudou = false;
  const ix0 = Math.max(x0, Math.floor(wx0));
  const ix1 = Math.min(x1, Math.ceil(wx1));
  const iy0 = Math.max(y0, Math.floor(wy0));
  const iy1 = Math.min(y1, Math.ceil(wy1));
  for (let wy = iy0; wy < iy1; wy++) {
    if (!centroNaFaixa(wy, wy0, wy1)) continue;
    for (let wx = ix0; wx < ix1; wx++) {
      if (!centroNaFaixa(wx, wx0, wx1)) continue;
      const naPorta = !!faixa
        && centroNaFaixa(wx, casa.ox + faixa.x0, casa.ox + faixa.x1)
        && centroNaFaixa(wy, casa.oy + faixa.y0, casa.oy + faixa.y1);
      for (let z = z0; z < z1; z++) {
        const amostra = amostraKanto(wx, wy);
        if (amostra && z < (amostra.h | 0)) continue;
        const li = indiceLocal(wx - x0, wy - y0, z);
        const id = naPorta ? BLOCO.AR : BLOCO.PEDRA;
        if (chunk.blocos[li] === id) continue;
        chunk.blocos[li] = id;
        mudou = true;
      }
    }
  }
  return mudou;
}

function montarColocacoes() {
  colocacoes.length = 0;
  for (let c = 0; c < CIDADES_KANTO.length; c++) {
    const def = CIDADES_KANTO[c];
    const layout = montarLayout(def);
    const origem = deLocalKanto(def.ax * AREA_KANTO, def.ay * AREA_KANTO);
    const ox = origem.x;
    const oy = origem.y;
    const volumes = layout.volumes;
    for (let i = 0; i < volumes.length; i++) {
      const v = volumes[i];
      const mx = (v.x0 + v.x1) * 0.5;
      const my = (v.y0 + v.y1) * 0.5;
      if (v.cartao) {
        colocacoes.push({
          base: true,
          px: ox + mx,
          py: oy + my,
          ox,
          oy,
          x0: v.x0,
          y0: v.y0,
          x1: v.x1,
          y1: v.y1,
          altura: v.altura,
          papel: v.papel,
          cartao: true,
          folha: v.folha,
          porta: v.porta !== false,
        });
        continue;
      }
      const sprite = chaveColisorSprite(v.papel, def.ginasio);
      const id = v.modelo || modeloDoPapel(v.papel, v.variante, def.key);
      if (!id || !moldes.has(id)) {
        if (!sprite) continue;
        colocacoes.push(comMedidaSprite({
          base: true,
          soSprite: true,
          sprite,
          px: ox + mx,
          py: oy + my,
          ox,
          oy,
          x0: v.x0,
          y0: v.y0,
          x1: v.x1,
          y1: v.y1,
          altura: v.altura,
          papel: v.papel,
          cartao: false,
          porta: false,
        }, sprite));
        continue;
      }
      const moldeAlt = moldes.get(id)?.altura | 0;
      colocacoes.push(comMedidaSprite({
        id,
        sprite: sprite || undefined,
        px: ox + mx,
        py: oy + my,
        yaw: yawDoEdificio(v.papel, mx, my),
        ox,
        oy,
        x0: v.x0,
        y0: v.y0,
        x1: v.x1,
        y1: v.y1,
        // Altura do colisor = casca do OBJ (não a tabela de papel).
        altura: moldeAlt > 0 ? moldeAlt : v.altura | 0,
        papel: v.papel,
        cartao: false,
        porta: v.porta !== false,
      }, sprite));
    }
  }
  for (let i = 0; i < gradeUsina.length; i++) {
    const ponto = gradeUsina[i];
    colocacoes.push(comMedidaSprite({
      base: true,
      soSprite: true,
      sprite: ponto.sprite,
      px: ponto.x,
      py: ponto.y,
      ox: 0,
      oy: 0,
      x0: ponto.x - 1,
      y0: ponto.y - 1,
      x1: ponto.x + 1,
      y1: ponto.y + 1,
      altura: Math.max(3, ponto.altura | 0),
      papel: "usina",
      cartao: false,
      porta: false,
    }, ponto.sprite));
  }
}

export function cascasProntas() {
  return pronto;
}

export function aplicarCascaNoChunk(chunk) {
  if (!pronto) return false;
  const x0 = chunk.cx * CHUNK_XZ;
  const y0 = chunk.cy * CHUNK_XZ;
  const x1 = x0 + CHUNK_XZ;
  const y1 = y0 + CHUNK_XZ;
  let mudou = false;

  for (let i = 0; i < colocacoes.length; i++) {
    const casa = colocacoes[i];
    const corpoSalvo = !!ajusteDe(casa)?.corpo;
    if (casa.soSprite && !ajusteDe(casa)) continue;
    if (casa.soSprite || casa.base || corpoSalvo) {
      if (limparLoteNoChunk(chunk, casa, x0, y0, x1, y1)) mudou = true;
      if (lacrarLoteNoChunk(chunk, casa, x0, y0, x1, y1)) mudou = true;
      continue;
    }
    const molde = moldes.get(casa.id);
    if (!molde || !casaTocaChunk(casa, molde, x0, y0, x1, y1)) continue;
    if (limparLoteNoChunk(chunk, casa, x0, y0, x1, y1)) mudou = true;
    if (selarFundoNoChunk(chunk, casa, molde.fundo, x0, y0, x1, y1)) mudou = true;
    const faixa = faixaDoLote(casa);
    const cel = molde.celulas;
    for (let k = 0; k < cel.length; k += 3) {
      const [gx, gy, gz] = mundoDaCelula(cel[k], cel[k + 1], cel[k + 2], casa);
      if (faixa && naFaixaMundo(gx, gy, casa, faixa)) continue;
      if (gx < x0 || gy < y0 || gx >= x1 || gy >= y1 || gz < 0 || gz >= CHUNK_Y) continue;
      const amostra = amostraKanto(gx, gy);
      if (amostra && gz < (amostra.h | 0)) continue;
      // Casca só no corpo do modelo — quintal não vira coluna de pedra.
      if (amostra && !amostra.modelo) continue;
      const li = indiceLocal(gx - x0, gy - y0, gz);
      if (chunk.blocos[li] === BLOCO.PEDRA) continue;
      chunk.blocos[li] = BLOCO.PEDRA;
      mudou = true;
    }
  }

  // Remove pedra velha de quintal/lote que sobrou de casca/lacrar anterior.
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = x0 + lx;
      const wy = y0 + ly;
      const amostra = amostraKanto(wx, wy);
      if (!amostra?.entradaLab) continue;
      const chao = amostra.h | 0;
      for (let z = chao; z < CHUNK_Y; z++) {
        const li = indiceLocal(lx, ly, z);
        if (chunk.blocos[li] === BLOCO.AR) continue;
        chunk.blocos[li] = BLOCO.AR;
        mudou = true;
      }
    }
  }

  if (mudou) {
    recalcularSuperficies(chunk);
    invalidarFluxo(chunk);
  }
  return mudou;
}

async function carregarUm(id) {
  const origem = origemDoModelo(id);
  const base = origem ? urlDoModelo(origem.base) : `assets/models/cidade/${id}/`;
  const arquivo = urlDoModelo(origem?.arquivo || "modelo.obj");
  const res = await fetch(`${base}${arquivo}`);
  if (!res.ok) throw new Error(id);
  return moldeDaMalha(await res.text(), portasDo(id));
}

async function garantirUsina() {
  const res = await fetch("assets/sprites/predios/manifesto.json", { cache: "no-store" });
  if (!res.ok) return;
  const json = await res.json();
  const predios = json.buildings || {};
  medidaPorSprite.clear();
  const ids = Object.keys(predios);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    medidaPorSprite.set(id, medidaSprite(id, predios[id]));
  }
  const usina = predios["usina-eletrica"];
  if (!usina) return;
  const gestao = predios["eletrical-management-building"];
  gradeUsina = pontosGradeUsina(
    medidaSprite("usina-eletrica", usina),
    gestao ? medidaSprite("eletrical-management-building", gestao) : null,
  );
}

async function garantirAjustes() {
  const res = await fetch("assets/models/colisores.json", { cache: "no-store" });
  if (!res.ok) {
    definirAjustes({});
    return;
  }
  const json = await res.json();
  definirAjustes(json && typeof json === "object" ? json : {});
}

async function garantirPartes() {
  const res = await fetch("assets/models/partes.json", { cache: "no-store" });
  if (!res.ok) {
    partes = {};
    return;
  }
  const json = await res.json();
  partes = json && typeof json === "object" ? json : {};
}

export function carregarCascasCidade() {
  if (carga) return carga;
  carga = Promise.all([garantirPartes(), garantirAjustes(), garantirUsina()]).then(() => Promise.all(
    IDS.map(async (id) => {
      try {
        return [id, await carregarUm(id)];
      } catch (erro) {
        console.error("casca", id, erro);
        return null;
      }
    }),
  ).then((pares) => {
    for (let i = 0; i < pares.length; i++) {
      if (!pares[i]) continue;
      moldes.set(pares[i][0], pares[i][1]);
    }
    if (!moldes.size) return false;
    montarColocacoes();
    pronto = true;
    return true;
  }));
  return carga;
}
