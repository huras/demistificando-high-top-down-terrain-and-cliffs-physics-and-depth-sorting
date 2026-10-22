import { POKEMON } from "../config.js";

const QUER = new Set(["Idle", "Walk", "Attack", "Shoot", "Hurt", "Strike", "Sleep", "FlapAround"]);
const POSE_GOLPE = new Set(["Attack", "Shoot", "Hurt", "Strike"]);
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

const SEM_ATLAS = Object.freeze({ id: "", estado: "falhou", uso: 0, anims: null });

export function garantirAtlas(dex, shiny) {
  if ((dex | 0) <= 0) return SEM_ATLAS;
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
  return ((d % 8) + 8) % 8;
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
 * O atlas PMD entra espelhado; o pivô X vira (1 − pivot) pra o pé não escorregar.
 */
export function blitQuadro(ctx, img, atlasW, atlasH, fr, footX, footY, escala, ajuste) {
  const trimX = fr.trimX || 0;
  const trimW = fr.trimW || fr.w;
  const trimH = fr.trimH || fr.h;
  const dw = fr.w * escala;
  const destW = trimW * escala;
  const destH = trimH * escala;
  // O atlas PMD vem espelhado no X. O desenho desvira, como o pmdSpriteUv.
  const pivotX = 1 - (fr.pivotX ?? 0.5);
  const trimEsq = fr.w - trimX - trimW;
  const ox = Number(ajuste?.dx);
  const oy = Number(ajuste?.dy);
  const dx = footX - pivotX * dw + trimEsq * escala + (Number.isFinite(ox) ? ox : 0) * escala;
  const dy = footY - trimH * escala + (Number.isFinite(oy) ? oy : 0) * escala;
  const sw = (fr.u1 - fr.u0) * atlasW;
  const sh = (fr.v1 - fr.v0) * atlasH;
  ctx.save();
  ctx.translate(dx + destW, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(img, fr.u0 * atlasW, fr.v0 * atlasH, sw, sh, 0, 0, destW, destH);
  ctx.restore();
}

/**
 * Centro do recorte, em px do canvas 1:1, relativo ao pé.
 * x para a direita, y para cima. Sem quadro, o círculo de fallback.
 */
export function centroDoQuadro(fr, ajuste) {
  if (!fr || !(fr.w > 0)) return { x: 0, y: 18 };
  const trimX = fr.trimX || 0;
  const trimW = fr.trimW || fr.w;
  const trimH = fr.trimH || fr.h;
  const pivotX = 1 - (fr.pivotX ?? 0.5);
  const trimEsq = fr.w - trimX - trimW;
  const ox = Number(ajuste?.dx);
  const oy = Number(ajuste?.dy);
  const dx = Number.isFinite(ox) ? ox : 0;
  const dy = Number.isFinite(oy) ? oy : 0;
  const esquerda = -pivotX * fr.w + trimEsq + dx;
  const topo = -trimH + dy;
  return {
    x: esquerda + trimW * 0.5,
    y: -(topo + trimH * 0.5),
  };
}

export function medidaSprite(ator) {
  const escala = Number(ator?.especie?.escala);
  const offsetY = Number(ator?.especie?.offsetY);
  const dx = Number(ator?.especie?.pivoDx);
  const dy = Number(ator?.especie?.pivoDy);
  return {
    escala: escala > 0 ? escala : 1,
    offsetY: Number.isFinite(offsetY) ? offsetY : 0,
    dx: Number.isFinite(dx) ? dx : 0,
    dy: Number.isFinite(dy) ? dy : 0,
  };
}

function duracaoFaixa(pack, nome) {
  const spec = pack?.anims?.[nome];
  if (!spec) return 0.55;
  const n = spec.frameCount || spec.durations?.length || 1;
  let ms = 0;
  for (let i = 0; i < n; i++) ms += spec.durations?.[i] || spec.durations?.[0] || 80;
  return Math.max(0.2, ms / 1000);
}

function faixaDoGolpe(pack, nome) {
  if (nome === "Attack" && pack?.anims && !pack.anims.Attack && pack.anims.Strike) return "Strike";
  return nome;
}

/** Tempo real da folha: Attack + Strike quando as duas existem. */
export function tempoClipGolpe(ator, nome) {
  const pack = garantirAtlas(ator?.especie?.dex, ator?.shiny);
  const faixa = faixaDoGolpe(pack, nome);
  let t = duracaoFaixa(pack, faixa);
  if (nome === "Attack" && faixa === "Attack" && pack?.anims?.Strike) {
    t += duracaoFaixa(pack, "Strike");
  }
  return t;
}

/** Hurt na folha → desmaio depois do clipe. Atlas ainda carregando → espera curta. */
export function agendarDesmaio(ator, agora) {
  const pack = garantirAtlas(ator?.especie?.dex, ator?.shiny);
  if (pack?.anims?.Hurt) {
    ator.desmaioEm = agora + duracaoFaixa(pack, "Hurt");
    return true;
  }
  // Sem Hurt pronto: ainda agenda um beat pra não sumir no frame do kill.
  if (!pack || pack.estado === "fila" || pack.estado === "carregando" || !pack.anims) {
    ator.desmaioEm = agora + 0.55;
    return true;
  }
  ator.desmaioEm = 0;
  return false;
}

export function marcarPose(ator, nome, agora) {
  const pack = garantirAtlas(ator.especie?.dex, ator.shiny);
  const faixa = faixaDoGolpe(pack, nome);
  ator.pose = faixa;
  ator.poseMedida = !!pack?.anims?.[faixa];
  let ate = agora + duracaoFaixa(pack, faixa);
  if (nome === "Attack" && faixa === "Attack" && pack?.anims?.Strike) {
    ator.poseSeguinte = "Strike";
    ate += duracaoFaixa(pack, "Strike");
  } else {
    ator.poseSeguinte = "";
  }
  ator.poseAte = ate;
  if (!ator.visual) return;
  ator.visual.anim = faixa;
  ator.visual.frame = 0;
  ator.visual.t = 0;
}

function velocidadePlana(ator) {
  return Math.hypot(ator.vx || 0, ator.vy || 0);
}

/** Ciclo real mínimo. O atlas de voo cabe em ~60 ms e o de andar dispara no sprint. */
const CICLO_ANDAR = 0.453;
const CICLO_VOO = 0.42;

function cicloDaFaixa(spec) {
  const n = spec.frameCount || spec.durations?.length || 1;
  let ms = 0;
  for (let i = 0; i < n; i++) ms += spec.durations?.[i] || spec.durations?.[0] || 80;
  return Math.max(0.05, ms / 1000);
}

function ritmoLocomocao(spec, nome, ator) {
  const ciclo = cicloDaFaixa(spec);
  const piso = nome === "FlapAround" ? CICLO_VOO : CICLO_ANDAR;
  const base = Math.min(1, ciclo / piso);
  const vel = velocidadePlana(ator);
  const acompanha = Math.min(1.15, Math.max(0.8, vel / POKEMON.VEL_ROAM));
  return base * (vel > 0.2 ? acompanha : 0.8);
}

function marcarPasso(ator) {
  const sp = velocidadePlana(ator);
  const ativo = !!ator.visual?.passo;
  const passo = ativo ? sp > 0.22 : sp > 0.48;
  ator.visual.passo = passo;
  return passo;
}

function voa(ator, passo) {
  if ((ator.hopLift || 0) > 0.12) return true;
  if (!passo) return false;
  const tipos = ator.tipos || ator.especie?.tipos;
  if (!tipos) return false;
  for (let i = 0; i < tipos.length; i++) {
    if (tipos[i] === "flying") return true;
  }
  return false;
}

function escolherFaixa(ator, pack, agora, passo) {
  if (ator.morto) return pack.anims?.Sleep ? "Sleep" : "Idle";
  if ((ator.desmaioEm || 0) > agora && pack.anims?.Hurt) return "Hurt";
  if ((ator.recuoRestante || 0) > 0 && pack.anims?.Hurt) return "Hurt";
  const noGolpe = (ator.conjuroRestante || 0) > 0 || (ator.golpeRecRestante || 0) > 0 || (ator.jatoDur || 0) > 0;
  if (noGolpe && ator.golpePose && pack.anims?.[ator.golpePose]) return ator.golpePose;
  if ((ator.conjuroRestante || 0) > 0 && pack.anims?.Shoot) return "Shoot";
  if (agora < ator.poseAte && POSE_GOLPE.has(ator.pose)) return faixaDoGolpe(pack, ator.pose);
  if (voa(ator, passo) && pack.anims?.FlapAround) return "FlapAround";
  if (passo && pack.anims?.Walk) return "Walk";
  return "Idle";
}

export function tickVisual(ator, dt, agora) {
  if (!ator.visual) ator.visual = { anim: "Idle", dir: 0, frame: 0, t: 0 };
  const v = ator.visual;
  const d = direcao8(ator.dirX, ator.dirY);
  if (d != null) v.dir = d;
  const pack = garantirAtlas(ator.especie.dex, ator.shiny);
  const passo = marcarPasso(ator);
  let anim = escolherFaixa(ator, pack, agora, passo);
  if (POSE_GOLPE.has(anim) && pack.anims?.[anim] && !ator.poseMedida) {
    ator.poseMedida = true;
    ator.poseAte = agora + duracaoFaixa(pack, anim);
  }
  if (!pack.anims?.[anim]) anim = pack.anims?.Idle ? "Idle" : anim;
  if (v.anim !== anim) {
    v.anim = anim;
    v.frame = 0;
    v.t = 0;
  }
  let spec = pack.anims?.[v.anim];
  if (!spec) return pack;
  const noGolpe = (ator.conjuroRestante || 0) > 0 || (ator.golpeRecRestante || 0) > 0;
  const estica = noGolpe && ator.golpeClip > 0 && !ator.poseSeguinte;
  const ritmo = v.anim === "Walk" || v.anim === "FlapAround"
    ? ritmoLocomocao(spec, v.anim, ator)
    : estica
      ? duracaoFaixa(pack, v.anim) / ator.golpeClip
      : 1;
  if ((ator.recuoTrava || 0) > 0) return pack;
  v.t += dt * ritmo;
  for (let i = 0; i < 6; i++) {
    const dur = (spec.durations[v.frame] || spec.durations[0] || 80) / 1000;
    if (v.t < dur) break;
    v.t -= dur;
    v.frame++;
    if (v.frame < spec.frameCount) continue;
    v.frame = 0;
    if (!POSE_GOLPE.has(anim)) continue;
    const prox = ator.poseSeguinte;
    if (prox && pack.anims?.[prox]) {
      ator.poseSeguinte = "";
      ator.pose = prox;
      ator.golpePose = prox;
      ator.poseMedida = true;
      anim = prox;
      v.anim = prox;
      v.frame = 0;
      v.t = 0;
      spec = pack.anims[prox];
      continue;
    }
    if ((ator.conjuroRestante || 0) > 0 || (ator.golpeRecRestante || 0) > 0) {
      v.frame = Math.max(0, spec.frameCount - 1);
      v.t = 0;
      break;
    }
    if (anim === "Hurt" && (ator.desmaioEm || 0) > agora) {
      v.frame = Math.max(0, spec.frameCount - 1);
      v.t = 0;
      break;
    }
    if (anim === "Hurt" && (ator.recuoRestante || 0) > 0) continue;
    ator.poseAte = 0;
    ator.poseMedida = false;
    break;
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
