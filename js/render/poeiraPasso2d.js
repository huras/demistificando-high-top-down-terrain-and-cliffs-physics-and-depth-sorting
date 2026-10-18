import { ESCALA, TILE } from "../config.js";
import { chaveEntidade, empilhar } from "./ordenacaoProfundidade.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import {
  amostraPoeira,
  poeiraPronta,
  puffsPasso,
  quadrosPoeira,
} from "../fx/poeiraPasso.js";

const CAP = 80;
const desenhos = new Array(CAP);

function desenharIndice(ctx, i) {
  if (!poeiraPronta()) return;
  const p = puffsPasso()[i];
  if (!p?.viva) return;
  const a = amostraPoeira(p);
  const q = quadrosPoeira()[a.quadro];
  if (!q) return;
  const s = a.tam * TILE * ESCALA;
  const x = mundoParaTelaX(p.x);
  const y = mundoParaTelaY(p.y, p.z, 0);
  ctx.globalAlpha = a.alfa;
  ctx.drawImage(q, x - s * 0.5, y - s * 0.9, s, s);
  ctx.globalAlpha = 1;
}

function desenhoDe(i) {
  let fn = desenhos[i];
  if (!fn) {
    fn = (ctx) => desenharIndice(ctx, i);
    desenhos[i] = fn;
  }
  return fn;
}

export function empilharPoeiraPasso(lista) {
  if (!poeiraPronta()) return;
  const puffs = puffsPasso();
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    if (!p.viva) continue;
    empilhar(lista, chaveEntidade(p.y - 0.04, p.z), 0, desenhoDe(i), 1, p.z);
  }
}
