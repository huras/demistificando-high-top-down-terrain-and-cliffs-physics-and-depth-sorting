const lista = [];

export function flutuar(alvo, texto, cor) {
  if (!alvo || texto == null) return;
  if (lista.length > 28) lista.shift();
  lista.push({
    x: alvo.x,
    y: alvo.y,
    z: (alvo.z ?? alvo.elevacao ?? 0) + 1.7,
    texto: String(texto),
    cor: cor || "#fff",
    idade: 0,
  });
}

export function tickFlutuantes(dt) {
  for (let i = lista.length - 1; i >= 0; i--) {
    const f = lista[i];
    f.idade += dt;
    f.z += dt * 0.55;
    if (f.idade > 0.85) lista.splice(i, 1);
  }
}

export function flutuantes() {
  return lista;
}
