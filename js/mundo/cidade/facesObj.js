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
