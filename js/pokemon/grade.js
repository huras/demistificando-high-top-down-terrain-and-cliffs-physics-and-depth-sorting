/** Grade grosseira dos atores ativos. N é pequeno; a grade evita varrer todo mundo. */

const CEL = 3;
const baldes = new Map();
const pertoBuf = [];

export function montarGrade(atores) {
  baldes.clear();
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    if (!a || a.capturado) continue;
    const k = `${Math.floor(a.x / CEL)},${Math.floor(a.y / CEL)}`;
    let lista = baldes.get(k);
    if (!lista) {
      lista = [];
      baldes.set(k, lista);
    }
    lista.push(a);
  }
}

export function atoresPerto(x, y, raio) {
  pertoBuf.length = 0;
  const r = Math.ceil(raio / CEL);
  const cx = Math.floor(x / CEL);
  const cy = Math.floor(y / CEL);
  const r2 = raio * raio;
  for (let iy = -r; iy <= r; iy++) {
    for (let ix = -r; ix <= r; ix++) {
      const lista = baldes.get(`${cx + ix},${cy + iy}`);
      if (!lista) continue;
      for (let i = 0; i < lista.length; i++) {
        const a = lista[i];
        const dx = a.x - x;
        const dy = a.y - y;
        if (dx * dx + dy * dy <= r2) pertoBuf.push(a);
      }
    }
  }
  return pertoBuf;
}
