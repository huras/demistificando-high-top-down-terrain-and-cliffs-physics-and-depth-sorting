import { carregarImagem } from "./atlas.js";
import { arquivoSprite, obterKits } from "../mundo/bioma/kits.js";

async function tentar(url) {
  if (!url) return null;
  try {
    return await carregarImagem(url);
  } catch (err) {
    console.warn("Asset de kit ausente:", url, err);
    return null;
  }
}

/** Sprites, centros de chão e cliffs repintados. */
export async function carregarVisuaisKits() {
  const dados = obterKits();
  const sprites = {};
  const centros = {};
  const cliffs = {};
  const tarefas = [];

  const ids = Object.keys(dados?.sprites || {});
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const arquivo = arquivoSprite(id);
    tarefas.push(
      tentar(arquivo).then((img) => {
        if (img) sprites[id] = img;
      }),
    );
  }

  const kits = dados?.kits || {};
  const chaoVisto = new Set();
  for (const id of Object.keys(kits)) {
    const kit = kits[id];
    if (kit.chao && kit.chaoArquivo && !chaoVisto.has(kit.chao)) {
      chaoVisto.add(kit.chao);
      const chave = kit.chao;
      tarefas.push(
        tentar(kit.chaoArquivo).then((img) => {
          if (img) centros[chave] = img;
        }),
      );
    }
    if (kit.cliffArquivo) {
      tarefas.push(
        tentar(kit.cliffArquivo).then((img) => {
          if (img) cliffs[id] = img;
        }),
      );
    }
  }

  await Promise.all(tarefas);
  return { sprites, centros, cliffs };
}
