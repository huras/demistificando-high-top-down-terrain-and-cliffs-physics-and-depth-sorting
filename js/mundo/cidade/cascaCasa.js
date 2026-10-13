/**
 * Colisão da casa = casca do OBJ.
 * Material door_only, e a face marcada como porta no editor, é o vão: não vira bloco.
 * O fundo do modelo não tem faces: vira parede, porque a porta não fica atrás.
 * h_kage é a sombra no chão: também não.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { ALTURA_PRACA, amostraKanto } from "../regiao/amostraKanto.js";
import { AREA_KANTO } from "../regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../regiao/kantoCidades.js";
import { montarLayout } from "../regiao/volumesCidade.js";
import { indiceLocal, invalidarFluxo, recalcularSuperficies } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";
import { idDaCasa, idsColisao, origemDoModelo, urlDoModelo } from "./catalogoCasas.js";
import { lerFacesObj, partirGrupos } from "./facesObj.js";

const FOLGA = 0.96;
const LADO_X = 6;
const LADO_Z = 5;
const IDS = idsColisao();

/** @type {Map<string, { celulas: Int16Array, minX: number, maxX: number, minZ: number, maxZ: number }>} */
const moldes = new Map();
/** @type {object[]} */
const colocacoes = [];
let pronto = false;
/** @type {Promise<boolean> | null} */
let carga = null;

function modeloDoPapel(papel, variante, cidade) {
  if (papel === "casa") return idDaCasa(cidade, variante);
  if (papel === "centro" || papel === "loja" || papel === "lab") return papel;
  return null;
}

function yawDaRua(mx, my) {
  const dx = mx - 64;
  const dy = my - 64;
  if (Math.abs(dy) <= Math.abs(dx)) return dy > 0 ? Math.PI : 0;
  return dx > 0 ? -Math.PI / 2 : Math.PI / 2;
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

function ladoDaPorta(vaos) {
  const normal = [0, 0, 0];
  for (let i = 0; i < vaos.length; i++) {
    const t = vaos[i];
    const n = cruz(sub(t.b, t.a), sub(t.c, t.a));
    normal[0] += n[0];
    normal[2] += n[2];
  }
  if (Math.abs(normal[0]) < 1e-6 && Math.abs(normal[2]) < 1e-6) return -1;
  if (Math.abs(normal[0]) >= Math.abs(normal[2])) return normal[0] > 0 ? 0 : 1;
  return normal[2] > 0 ? 2 : 3;
}

function fecharFundo(marcas, limites, solidos, vaos) {
  let lado = ladoAberto(solidos);
  const porta = ladoDaPorta(vaos);
  if (lado >= 0 && lado === porta) lado = lado ^ 1;
  if (lado < 0) return;
  const eixo = lado < 2 ? 0 : 2;
  const noMax = lado % 2 === 0;
  const outro = eixo === 0 ? 2 : 0;
  const celulas = [];
  let fundo = noMax ? -Infinity : Infinity;
  let minU = Infinity;
  let maxU = -Infinity;
  const teto = new Map();
  const solido = new Set();
  for (const chave of marcas) {
    const p = chave.split(",");
    const c = [+p[0], +p[1], +p[2]];
    celulas.push(c);
    if (noMax) {
      if (c[eixo] > fundo) fundo = c[eixo];
    } else if (c[eixo] < fundo) fundo = c[eixo];
  }
  if (!Number.isFinite(fundo)) return;
  for (let i = 0; i < celulas.length; i++) {
    const c = celulas[i];
    const u = c[outro];
    const alto = teto.get(u);
    if (alto == null || c[1] > alto) teto.set(u, c[1]);
    if (c[1] <= 1) {
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
    }
    if (c[eixo] === fundo) solido.add(`${u},${c[1]}`);
  }
  if (!Number.isFinite(minU)) return;
  for (let u = minU; u <= maxU; u++) {
    const topo = teto.get(u);
    if (topo == null) continue;
    let limite = topo;
    for (let y = 0; y <= topo; y++) {
      if (solido.has(`${u},${y}`)) {
        limite = y;
        break;
      }
    }
    for (let y = 0; y < limite; y++) {
      const cel = [0, y, 0];
      cel[eixo] = fundo;
      cel[outro] = u;
      marcarCelula(marcas, limites, cel[0], cel[1], cel[2]);
    }
  }
}

function abrirVao(marcas, vaos) {
  if (!vaos.length) return;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const normal = [0, 0, 0];
  for (let i = 0; i < vaos.length; i++) {
    const t = vaos[i];
    const n = cruz(sub(t.b, t.a), sub(t.c, t.a));
    normal[0] += n[0];
    normal[1] += n[1];
    normal[2] += n[2];
    for (let k = 0; k < 3; k++) {
      const p = t.p[k];
      for (let a = 0; a < 3; a++) {
        if (p[a] < min[a]) min[a] = p[a];
        if (p[a] > max[a]) max[a] = p[a];
      }
    }
  }
  let eixo = 0;
  if (Math.abs(normal[1]) > Math.abs(normal[eixo])) eixo = 1;
  if (Math.abs(normal[2]) > Math.abs(normal[eixo])) eixo = 2;
  for (let a = 0; a < 3; a++) {
    if (a === eixo) {
      min[a] -= 1;
      max[a] += 1;
    } else {
      min[a] += 0.2;
      max[a] -= 0.2;
    }
  }
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
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  function local(v) {
    return [(v[0] - cx) * escala, (v[1] - minY) * escala, (v[2] - cz) * escala];
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
  fecharFundo(marcas, limites, solidos, vaos);
  let minVX = limites.minX;
  let maxVX = limites.maxX;
  let minVZ = limites.minZ;
  let maxVZ = limites.maxZ;

  const celulas = new Int16Array(marcas.size * 3);
  let cursor = 0;
  for (const chave of marcas) {
    const p = chave.split(",");
    celulas[cursor++] = +p[0];
    celulas[cursor++] = +p[1];
    celulas[cursor++] = +p[2];
  }
  if (!Number.isFinite(minVX)) {
    minVX = 0;
    maxVX = 0;
    minVZ = 0;
    maxVZ = 0;
  }
  return { celulas, minX: minVX, maxX: maxVX, minZ: minVZ, maxZ: maxVZ, temPorta: vaos.length > 0 };
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

function montarColocacoes() {
  colocacoes.length = 0;
  for (let c = 0; c < CIDADES_KANTO.length; c++) {
    const def = CIDADES_KANTO[c];
    const layout = montarLayout(def);
    const ox = def.ax * AREA_KANTO;
    const oy = def.ay * AREA_KANTO;
    const volumes = layout.volumes;
    for (let i = 0; i < volumes.length; i++) {
      const v = volumes[i];
      const id = v.modelo || modeloDoPapel(v.papel, v.variante, def.key);
      if (!id || !moldes.has(id)) continue;
      const mx = (v.x0 + v.x1) * 0.5;
      const my = (v.y0 + v.y1) * 0.5;
      colocacoes.push({
        id,
        px: ox + mx,
        py: oy + my,
        yaw: v.papel === "casa" ? 0 : yawDaRua(mx, my),
        ox,
        oy,
        x0: v.x0,
        y0: v.y0,
        x1: v.x1,
        y1: v.y1,
        altura: v.altura,
      });
    }
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
    const molde = moldes.get(casa.id);
    if (!molde || !casaTocaChunk(casa, molde, x0, y0, x1, y1)) continue;
    const vx0 = Math.max(x0, Math.floor(casa.ox + casa.x0));
    const vx1 = Math.min(x1, Math.ceil(casa.ox + casa.x1));
    const vy0 = Math.max(y0, Math.floor(casa.oy + casa.y0));
    const vy1 = Math.min(y1, Math.ceil(casa.oy + casa.y1));
    const z0 = ALTURA_PRACA;
    const z1 = Math.min(CHUNK_Y, ALTURA_PRACA + (casa.altura | 0));
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
    const cel = molde.celulas;
    for (let k = 0; k < cel.length; k += 3) {
      const [gx, gy, gz] = mundoDaCelula(cel[k], cel[k + 1], cel[k + 2], casa);
      if (gx < x0 || gy < y0 || gx >= x1 || gy >= y1 || gz < 0 || gz >= CHUNK_Y) continue;
      const amostra = amostraKanto(gx, gy);
      if (amostra && gz < (amostra.h | 0)) continue;
      const li = indiceLocal(gx - x0, gy - y0, gz);
      if (chunk.blocos[li] === BLOCO.PEDRA) continue;
      chunk.blocos[li] = BLOCO.PEDRA;
      mudou = true;
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
  carga = garantirPartes().then(() => Promise.all(
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
