/** Faces do OBJ na ordem do arquivo. O índice é o da linha `f`, igual no editor. */
export function lerFacesObj(texto) {
  const verts = [];
  const faces = [];
  let mtl = "";
  let indice = 0;
  const linhas = texto.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (linha.startsWith("usemtl ")) mtl = linha.slice(7).trim();
    else if (linha.startsWith("v ")) {
      const p = linha.split(/\s+/);
      verts.push([+p[1], +p[2], +p[3]]);
    } else if (linha.startsWith("f ")) {
      const idx = linha.trim().split(/\s+/).slice(1).map((t) => (+t.split("/")[0] || 0) - 1);
      const pontos = [];
      for (let k = 0; k < idx.length; k++) {
        if (idx[k] >= 0 && idx[k] < verts.length) pontos.push(verts[idx[k]]);
      }
      for (let k = 1; k < pontos.length - 1; k++) {
        faces.push({ mtl, a: pontos[0], b: pontos[k], c: pontos[k + 1], indice });
      }
      indice += 1;
    }
  }
  return { verts, faces, quantidade: indice };
}

function chavePonto(p) {
  return `${Math.round(p[0] * 50)},${Math.round(p[1] * 50)},${Math.round(p[2] * 50)}`;
}

/** Triângulos que se encostam viram um grupo. Várias faces de uma porta contam como uma. */
export function partirGrupos(faces) {
  const n = faces.length;
  const pai = new Array(n);
  for (let i = 0; i < n; i++) pai[i] = i;
  function achar(i) {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  }
  const mapa = new Map();
  for (let i = 0; i < n; i++) {
    const f = faces[i];
    const pontos = [f.a, f.b, f.c];
    for (let k = 0; k < 3; k++) {
      const chave = chavePonto(pontos[k]);
      const lista = mapa.get(chave);
      if (lista) lista.push(i);
      else mapa.set(chave, [i]);
    }
  }
  for (const lista of mapa.values()) {
    const raiz = achar(lista[0]);
    for (let i = 1; i < lista.length; i++) pai[achar(lista[i])] = raiz;
  }
  const grupos = new Map();
  for (let i = 0; i < n; i++) {
    const raiz = achar(i);
    const grupo = grupos.get(raiz);
    if (grupo) grupo.push(faces[i]);
    else grupos.set(raiz, [faces[i]]);
  }
  return [...grupos.values()];
}
