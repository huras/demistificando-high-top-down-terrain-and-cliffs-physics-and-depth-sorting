/** NPCs de história no overworld (soft list para tick/render/interação). */

/** @type {object[]} */
let atores = [];

export function listarAtoresScriptados() {
  return atores;
}

export function limparAtoresScriptados(predicado) {
  if (!predicado) {
    atores = [];
    return;
  }
  atores = atores.filter((a) => !predicado(a));
}

export function adicionarAtorScriptado(ator) {
  if (!ator?.id) return null;
  const i = atores.findIndex((a) => a.id === ator.id);
  if (i >= 0) atores[i] = ator;
  else atores.push(ator);
  return ator;
}

export function removerAtorScriptado(id) {
  atores = atores.filter((a) => a.id !== id);
}

export function atorScriptadoPerto(x, y, raio = 1.6) {
  let melhor = null;
  let melhorD = raio * raio;
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    if (!a || a.despawn || a.oculto) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    const d = dx * dx + dy * dy;
    if (d <= melhorD) {
      melhorD = d;
      melhor = a;
    }
  }
  return melhor;
}
