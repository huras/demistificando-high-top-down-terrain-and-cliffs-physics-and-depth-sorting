import { POKEMON } from "../config.js";

const QUER = new Set(["Idle", "Walk", "Attack", "Shoot", "Hurt"]);
const cache = new Map();
const fila = [];
let emVoo = 0;

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

export function idPack(dex, shiny) {
  const n = String(dex | 0).padStart(3, "0");
  return shiny ? `${n}s` : n;
}

function bombear() {
  while (emVoo < 2 && fila.length) {
    const item = fila.shift();
    if (!item || item.estado !== "fila") continue;
    item.estado = "carregando";
    emVoo++;
    carregar(item).finally(() => {
      emVoo--;
      bombear();
    });
  }
}

async function carregar(item) {
  try {
    const base = `/ref/sprites/pmd-atlas/v9/${item.id}`;
    const res = await fetch(`${base}/meta.json`);
    if (!res.ok) throw new Error("sem meta");
    const meta = await res.json();
    const img = await carregarImagem(`${base}/atlas.${meta.imageExt || "webp"}`);
    const quadros = new Map();
    const anims = {};
    const nomes = Object.keys(meta.anims || {});
    for (let i = 0; i < nomes.length; i++) {
      const nome = nomes[i];
      if (!QUER.has(nome)) continue;
      const anim = meta.anims[nome];
      anims[nome] = {
        frameCount: anim.frameCount | 0,
        dirCount: anim.dirCount || 8,
        durations: anim.durations || [],
      };
      const frames = anim.frames || [];
      for (let f = 0; f < frames.length; f++) {
        const fr = frames[f];
        quadros.set(`${nome}:${fr.dir}:${fr.frame}`, fr);
      }
    }
    item.img = img;
    item.anims = anims;
    item.quadros = quadros;
    item.atlasW = meta.atlasW | 0;
    item.atlasH = meta.atlasH | 0;
    item.estado = "pronto";
    encolher();
  } catch {
    item.estado = "falhou";
  }
}

function encolher() {
  if (cache.size <= POKEMON.CACHE_ATLAS) return;
  let velho = null;
  for (const item of cache.values()) {
    if (item.estado !== "pronto" && item.estado !== "falhou") continue;
    if (!velho || item.uso < velho.uso) velho = item;
  }
  if (velho) cache.delete(velho.id);
}

export function garantirAtlas(dex, shiny) {
  const id = idPack(dex, shiny);
  let item = cache.get(id);
  if (!item) {
    item = { id, estado: "fila", uso: 0 };
    cache.set(id, item);
    fila.push(item);
    bombear();
  }
  item.uso = performance.now();
  if (item.estado === "falhou" && shiny) return garantirAtlas(dex, false);
  return item;
}

export function direcao8(dx, dy) {
  if (!dx && !dy) return null;
  const a = Math.atan2(dy, dx);
  let d = Math.round((a - Math.PI / 2) / (Math.PI / 4));
  d = ((d % 8) + 8) % 8;
  return (8 - d) % 8;
}

/**
 * Mesma convenção do facing Ragnarok: yaw 0 = câmera ao sul, olhando o norte.
 * A direção do mundo vira direção na tela antes de escolher a linha do sheet.
 */
export function direcao8Camera(dx, dy, yawCam) {
  if (!dx && !dy) return null;
  if (!yawCam) return direcao8(dx, dy);
  const sin = Math.sin(yawCam);
  const cos = Math.cos(yawCam);
  const telaDir = dx * cos - dy * sin;
  const telaFrente = -dx * sin - dy * cos;
  return direcao8(telaDir, -telaFrente);
}

/**
 * Pé em (footX, footY), na base do recorte opaco — igual ao personagem.
 * O pivô X continua o da célula, pra o corpo não escorregar entre quadros.
 * O atlas só tem o recorte; ele entra na célula em (trimX, trimY).
 */
export function blitQuadro(ctx, img, atlasW, atlasH, fr, footX, footY, escala) {
  const dw = fr.w * escala;
  const base = (fr.trimY || 0) + (fr.trimH || fr.h);
  const dx = footX - fr.pivotX * dw;
  const dy = footY - base * escala;
  const sw = (fr.u1 - fr.u0) * atlasW;
  const sh = (fr.v1 - fr.v0) * atlasH;
  ctx.drawImage(
    img,
    fr.u0 * atlasW,
    fr.v0 * atlasH,
    sw,
    sh,
    dx + (fr.trimX || 0) * escala,
    dy + (fr.trimY || 0) * escala,
    (fr.trimW || fr.w) * escala,
    (fr.trimH || fr.h) * escala,
  );
}

export function tickVisual(ator, dt, agora) {
  if (!ator.visual) ator.visual = { anim: "Idle", dir: 0, frame: 0, t: 0 };
  const v = ator.visual;
  const d = direcao8(ator.dirX, ator.dirY);
  if (d != null) v.dir = d;
  let anim = "Idle";
  if (!ator.morto && agora < ator.poseAte && (ator.pose === "Attack" || ator.pose === "Shoot" || ator.pose === "Hurt")) {
    anim = ator.pose;
  } else if (!ator.morto && ator.andando) anim = "Walk";
  const pack = garantirAtlas(ator.especie.dex, ator.shiny);
  if (!pack.anims?.[anim]) anim = pack.anims?.Idle ? "Idle" : anim;
  if (v.anim !== anim) {
    v.anim = anim;
    v.frame = 0;
    v.t = 0;
  }
  const spec = pack.anims?.[v.anim];
  if (!spec) return pack;
  if (ator.morto) {
    v.frame = 0;
    v.t = 0;
    return pack;
  }
  const durMs = spec.durations[v.frame] || 80;
  v.t += dt;
  if (v.t >= durMs / 1000) {
    v.t = 0;
    v.frame++;
    if (v.frame >= spec.frameCount) {
      v.frame = 0;
      if (anim === "Attack" || anim === "Shoot" || anim === "Hurt") ator.poseAte = 0;
    }
  }
  return pack;
}

export function quadroDe(ator, pack) {
  if (!pack?.quadros || !ator.visual) return null;
  const v = ator.visual;
  return (
    pack.quadros.get(`${v.anim}:${v.dir}:${v.frame}`) ||
    pack.quadros.get(`${v.anim}:0:0`) ||
    pack.quadros.get("Idle:0:0")
  );
}
