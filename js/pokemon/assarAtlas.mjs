/**
 * Empacota as sheets PMD (overworld) num atlas que o cliente já sabe ler:
 * meta.json + atlas.png em .cache/pmd-atlas/v9/<id>/.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const TICK_MS = 16;
const DIR_COUNT = 8;
const LARGURA_MAX = 2048;
const ALFA_CORTE = 16;
const QUER = ["Idle", "Walk", "Attack", "Shoot", "Hurt", "Strike", "Sleep", "FlapAround"];
const OPCIONAIS = new Set(["Hurt", "Sleep", "Attack", "Shoot", "Strike", "FlapAround"]);
const SEM_DIRECAO = new Set(["Sleep"]);

const emCurso = new Map();

function tag(bloco, nome) {
  const m = bloco.match(new RegExp(`<${nome}>\\s*([^<]+?)\\s*</${nome}>`));
  return m ? m[1].trim() : "";
}

function nomeAsset(name, anims) {
  const visto = new Set();
  let n = name;
  while (n && !visto.has(n)) {
    visto.add(n);
    const prox = anims[n]?.copyOf;
    if (!prox) break;
    n = prox;
  }
  return n || name;
}

function resolverCopia(anims, name, visto = new Set()) {
  const a = anims[name];
  if (!a || visto.has(name)) return a || null;
  visto.add(name);
  if (!a.copyOf || a.durations.length) return a;
  const src = resolverCopia(anims, a.copyOf, visto);
  if (!src) return a;
  a.frameW = src.frameW;
  a.frameH = src.frameH;
  a.durations = src.durations.slice();
  a.directionless = src.directionless;
  return a;
}

function lerAnimData(xml) {
  const anims = Object.create(null);
  const re = /<Anim>([\s\S]*?)<\/Anim>/g;
  let m;
  while ((m = re.exec(xml))) {
    const bloco = m[1];
    const name = tag(bloco, "Name");
    if (!name) continue;
    const durations = [];
    const durRe = /<Duration>\s*(\d+)\s*<\/Duration>/g;
    let d;
    while ((d = durRe.exec(bloco))) durations.push(Number(d[1]) * TICK_MS);
    anims[name] = {
      name,
      copyOf: tag(bloco, "CopyOf") || null,
      directionless: SEM_DIRECAO.has(name),
      frameW: Number(tag(bloco, "FrameWidth")) || 0,
      frameH: Number(tag(bloco, "FrameHeight")) || 0,
      durations,
    };
  }
  const nomes = Object.keys(anims);
  for (let i = 0; i < nomes.length; i++) resolverCopia(anims, nomes[i]);
  return anims;
}

function deveEmpacotar(name, anims) {
  if (!anims[name]) return false;
  const asset = nomeAsset(name, anims);
  if (asset !== name && QUER.includes(asset)) return false;
  return true;
}

function lerPng(arquivo) {
  return PNG.sync.read(fs.readFileSync(arquivo));
}

function indice(data, sheetW, x, y) {
  return (y * sheetW + x) * 4;
}

function assinatura(data, sheetW, sx, sy, fw, fh) {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x += 4) {
      const i = indice(data, sheetW, sx + x, sy + y);
      if (data[i + 3] < 8) continue;
      sum = (sum * 33 + data[i] + data[i + 1] * 3 + data[i + 2] * 7) >>> 0;
      n += 1;
    }
  }
  return `${n}:${sum.toString(16)}`;
}

function quadrosPorGiro(data, sheetW, fw, fh, cols, rows) {
  if (rows < DIR_COUNT || cols < DIR_COUNT) return null;
  const dirRows = Math.min(DIR_COUNT, rows);
  const hashes = [];
  for (let dir = 0; dir < dirRows; dir++) {
    const row = [];
    for (let f = 0; f < cols; f++) {
      row.push(assinatura(data, sheetW, f * fw, dir * fh, fw, fh));
    }
    hashes.push(row);
  }
  let iguais = 0;
  const limite = Math.min(cols, 24);
  for (let c = 0; c < limite; c++) {
    for (let d = 0; d < dirRows; d++) {
      if (hashes[0][c] === hashes[d][0]) {
        iguais += 1;
        break;
      }
    }
  }
  if (iguais < 6) return null;
  for (let c = 1; c < cols; c++) {
    for (let d = 1; d < dirRows; d++) {
      if (hashes[0][c] === hashes[d][0]) return c <= 6 ? c : null;
    }
  }
  return null;
}

function recorte(data, sheetW, sx, sy, fw, fh) {
  let minX = fw;
  let minY = fh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const a = data[indice(data, sheetW, sx + x, sy + y) + 3];
      if (a <= ALFA_CORTE) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return { trimX: 0, trimY: 0, trimW: fw, trimH: fh, vazio: true };
  return {
    trimX: minX,
    trimY: minY,
    trimW: maxX - minX + 1,
    trimH: maxY - minY + 1,
    vazio: false,
  };
}

function pivo(data, sheetW, sx, sy, fw, fh) {
  const limX = Math.min(fw, sheetW - sx);
  const limY = Math.min(fh, data.length / 4 / sheetW - sy);
  for (let y = 0; y < limY; y++) {
    for (let x = 0; x < limX; x++) {
      const i = indice(data, sheetW, sx + x, sy + y);
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > ALFA_CORTE && g > 180 && r < 100 && b < 100) {
        return { x: x / fw, y: y / fh };
      }
    }
  }
  return { x: 0.5, y: 0.5 };
}

function fatiar(anim, off, meta) {
  const fw = meta.frameW;
  const fh = meta.frameH;
  const cols = Math.max(1, Math.round(anim.width / fw));
  const rows = Math.max(1, Math.round(anim.height / fh));
  let frameCount = cols;
  if (!meta.directionless && meta.name === "FlapAround") {
    const giro = quadrosPorGiro(anim.data, anim.width, fw, fh, cols, rows);
    if (giro) frameCount = giro;
  }
  const dirs = meta.directionless ? 1 : Math.min(DIR_COUNT, rows);
  const frames = [];
  for (let dir = 0; dir < dirs; dir++) {
    for (let f = 0; f < frameCount; f++) {
      const sx = f * fw;
      const sy = dir * fh;
      const caixa = recorte(anim.data, anim.width, sx, sy, fw, fh);
      const pivot = off
        ? pivo(off.data, off.width, sx, sy, fw, fh)
        : { x: 0.5, y: 0.5 };
      frames.push({
        dir,
        frame: f,
        w: fw,
        h: fh,
        trimX: caixa.trimX,
        trimY: caixa.trimY,
        trimW: caixa.trimW,
        trimH: caixa.trimH,
        vazio: caixa.vazio,
        pivotX: pivot.x,
        src: anim,
        sx,
        sy,
      });
    }
  }
  const ultima = meta.durations.at(-1) || TICK_MS * 4;
  const durations =
    meta.durations.length >= frameCount
      ? meta.durations.slice(0, frameCount)
      : meta.durations.concat(Array(frameCount - meta.durations.length).fill(ultima));
  return { name: meta.name, frameCount, dirCount: dirs, durations, frames };
}

function medirAtlas(frames) {
  let x = 0;
  let y = 0;
  let rowH = 0;
  let atlasW = 1;
  let atlasH = 1;
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i];
    const tw = fr.vazio ? 1 : fr.trimW;
    const th = fr.vazio ? 1 : fr.trimH;
    if (x > 0 && x + tw > LARGURA_MAX) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    fr.ax = x;
    fr.ay = y;
    fr.pw = tw;
    fr.ph = th;
    rowH = Math.max(rowH, th);
    x += tw;
    atlasW = Math.max(atlasW, x);
    atlasH = Math.max(atlasH, y + rowH);
  }
  return { atlasW, atlasH };
}

function pintar(png, fr) {
  if (fr.vazio) return;
  const src = fr.src;
  for (let y = 0; y < fr.ph; y++) {
    for (let x = 0; x < fr.pw; x++) {
      const s = indice(src.data, src.width, fr.sx + fr.trimX + x, fr.sy + fr.trimY + y);
      const d = indice(png.data, png.width, fr.ax + x, fr.ay + y);
      png.data[d] = src.data[s];
      png.data[d + 1] = src.data[s + 1];
      png.data[d + 2] = src.data[s + 2];
      png.data[d + 3] = src.data[s + 3];
    }
  }
}

function serializar(fr, atlasW, atlasH) {
  return {
    dir: fr.dir,
    frame: fr.frame,
    w: fr.w,
    h: fr.h,
    trimX: fr.vazio ? 0 : fr.trimX,
    trimW: fr.vazio ? fr.pw : fr.trimW,
    trimH: fr.vazio ? fr.ph : fr.trimH,
    pivotX: fr.pivotX,
    u0: fr.ax / atlasW,
    v0: fr.ay / atlasH,
    u1: (fr.ax + fr.pw) / atlasW,
    v1: (fr.ay + fr.ph) / atlasH,
  };
}

function clonarAnim(anim) {
  return {
    frameCount: anim.frameCount,
    dirCount: anim.dirCount,
    durations: anim.durations.slice(),
    frames: anim.frames.map((fr) => ({ ...fr })),
  };
}

function assarId(raizRef, pastaCache, id) {
  const base = path.join(raizRef, "sprites", "pokemon", "overworld", id);
  const xmlPath = path.join(base, "AnimData.xml");
  if (!fs.existsSync(xmlPath)) throw new Error("sem AnimData " + id);
  const anims = lerAnimData(fs.readFileSync(xmlPath, "utf8"));
  const defs = [];
  for (let i = 0; i < QUER.length; i++) {
    const name = QUER[i];
    if (!deveEmpacotar(name, anims)) continue;
    const meta = anims[name];
    if (!(meta.frameW > 0) || !(meta.frameH > 0)) {
      if (OPCIONAIS.has(name)) continue;
      throw new Error(`${id} sem tamanho ${name}`);
    }
    const asset = nomeAsset(name, anims);
    const folha = path.join(base, `${asset}-Anim.png`);
    if (!fs.existsSync(folha)) {
      if (OPCIONAIS.has(name)) continue;
      throw new Error(`${id} sem ${asset}-Anim.png`);
    }
    const offsets = path.join(base, `${asset}-Offsets.png`);
    const anim = lerPng(folha);
    const off = fs.existsSync(offsets) ? lerPng(offsets) : null;
    defs.push(fatiar(anim, off, { ...meta, name }));
  }
  if (!defs.length) throw new Error("sem anim " + id);

  const todos = [];
  for (let i = 0; i < defs.length; i++) {
    const frames = defs[i].frames;
    for (let f = 0; f < frames.length; f++) todos.push(frames[f]);
  }
  const { atlasW, atlasH } = medirAtlas(todos);
  const png = new PNG({ width: atlasW, height: atlasH });
  for (let i = 0; i < todos.length; i++) pintar(png, todos[i]);

  const saida = Object.create(null);
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    saida[def.name] = {
      frameCount: def.frameCount,
      dirCount: def.dirCount,
      durations: def.durations,
      frames: def.frames.map((fr) => serializar(fr, atlasW, atlasH)),
    };
  }
  for (let i = 0; i < QUER.length; i++) {
    const name = QUER[i];
    if (saida[name] || !anims[name]) continue;
    const packed = saida[nomeAsset(name, anims)];
    if (packed) saida[name] = clonarAnim(packed);
  }

  const pasta = path.join(pastaCache, id);
  fs.mkdirSync(pasta, { recursive: true });
  const atlasPath = path.join(pasta, "atlas.png");
  const metaPath = path.join(pasta, "meta.json");
  const tmp = atlasPath + ".tmp";
  fs.writeFileSync(tmp, PNG.sync.write(png));
  fs.renameSync(tmp, atlasPath);
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ imageExt: "png", atlasW, atlasH, anims: saida })
  );
  return pasta;
}

export function interpretarPedidoAtlas(pathname) {
  const m = /^\/ref\/sprites\/pmd-atlas\/v9\/(\d{3}s?)\/(meta\.json|atlas\.png)$/.exec(pathname);
  if (!m) return null;
  return { id: m[1], arquivo: m[2] };
}

export function garantirAtlasPmd(raizRef, pastaCache, id) {
  const pasta = path.join(pastaCache, id);
  const meta = path.join(pasta, "meta.json");
  const atlas = path.join(pasta, "atlas.png");
  if (fs.existsSync(meta) && fs.existsSync(atlas)) return Promise.resolve(pasta);
  const chave = `${pastaCache}\0${id}`;
  const pendente = emCurso.get(chave);
  if (pendente) return pendente;
  const promessa = Promise.resolve()
    .then(() => assarId(raizRef, pastaCache, id))
    .finally(() => emCurso.delete(chave));
  emCurso.set(chave, promessa);
  return promessa;
}
