import { mundoParaTelaX, mundoParaTelaY } from "../render/camera.js";
import { chaveEntidade, empilhar } from "../render/ordenacaoProfundidade.js";
import { obterBola } from "./captura.js";
import { dropsNoChao } from "./drops.js";
import { projeteisVivos } from "./combate/projeteis.js";
import { blitQuadro, quadroDe, garantirAtlas } from "./sprites.js";
import { atoresVisiveis } from "./sistema.js";
import { COR_TIPO } from "./tipos.js";

const PX = 1.85;

function desenharSombra(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function desenharCorpo(ctx, ator) {
  const footX = mundoParaTelaX(ator.x);
  const footY = mundoParaTelaY(ator.y, ator.z, ator.hopLift || 0);
  desenharSombra(ctx, footX, footY);
  const pack = garantirAtlas(ator.especie.dex, ator.shiny);
  const fr = quadroDe(ator, pack);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (ator.morto) ctx.filter = "grayscale(1) brightness(0.82)";
  if (fr && pack.img && pack.estado === "pronto") {
    blitQuadro(ctx, pack.img, pack.atlasW, pack.atlasH, fr, footX, footY, PX);
  } else {
    const cor = ator.especie.cor || COR_TIPO[ator.tipos?.[0]] || "#94a3b8";
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(footX, footY - 16, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function desenharDrop(ctx, item) {
  const x = mundoParaTelaX(item.x);
  const y = mundoParaTelaY(item.y, item.z, 0);
  ctx.save();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x + 6, y - 4);
  ctx.lineTo(x, y + 2);
  ctx.lineTo(x - 6, y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function desenharProjetil(ctx, p) {
  const x = mundoParaTelaX(p.x);
  const y = mundoParaTelaY(p.y, p.z, 0);
  ctx.save();
  ctx.fillStyle = p.cor || "#fff";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function desenharBola(ctx, bola) {
  const x = mundoParaTelaX(bola.x);
  const y = mundoParaTelaY(bola.y, bola.z, 0);
  const pulo = bola.fase === "tremendo" ? Math.sin(bola.faseT * 18) * 3 : 0;
  ctx.save();
  ctx.translate(x, y + pulo);
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(0, 0, 7, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function empilharPokemon(lista) {
  const atores = atoresVisiveis();
  for (let i = 0; i < atores.length; i++) {
    const ator = atores[i];
    empilhar(lista, chaveEntidade(ator.y, ator.z), 0, (ctx) => desenharCorpo(ctx, ator), 7, ator.z);
  }
  const drops = dropsNoChao();
  for (let i = 0; i < drops.length; i++) {
    const item = drops[i];
    empilhar(lista, chaveEntidade(item.y, item.z), 0, (ctx) => desenharDrop(ctx, item), 4, item.z);
  }
  const tiros = projeteisVivos();
  for (let i = 0; i < tiros.length; i++) {
    const p = tiros[i];
    empilhar(lista, chaveEntidade(p.y, p.z), 0, (ctx) => desenharProjetil(ctx, p), 8, p.z);
  }
  const bola = obterBola();
  if (bola) {
    empilhar(lista, chaveEntidade(bola.y, bola.z), 0, (ctx) => desenharBola(ctx, bola), 9, bola.z);
  }
}
