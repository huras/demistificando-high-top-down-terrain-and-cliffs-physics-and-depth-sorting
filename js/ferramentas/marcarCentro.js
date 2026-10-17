/**
 * Página para marcar o que cada pedaço do Centro Emerald é.
 * A marca do quadrado vale mais do que a marca do sprite repetido.
 */

const COLUNAS = 32;
const TILE = 16;
const LADO = 64;
const COLS = 14;
const ROWS = 9;

const CAMADA = [
  [7, 8, 66, 67, 9, 9, 9, 56, 57, 9, 10, 11, 12, 13],
  [14, 15, 72, 73, 54, 26, 27, 60, 61, 55, 0, 16, 17, 18],
  [19, 20, 74, 75, 58, 33, 34, 6, 64, 59, 28, 21, 22, 23],
  [24, 30, 39, 1, 62, 25, 25, 4, 25, 63, 45, 1, 1, 31],
  [24, 1, 1, 1, 65, 68, 69, 70, 71, 5, 29, 1, 1, 31],
  [76, 77, 1, 1, 1, 35, 36, 37, 38, 1, 1, 1, 1, 31],
  [78, 79, 1, 1, 1, 41, 42, 43, 44, 1, 39, 46, 47, 31],
  [80, 81, 1, 1, 1, 48, 49, 50, 51, 1, 30, 52, 53, 31],
  [32, 1, 1, 1, 1, 1, 2, 3, 1, 1, 1, 30, 39, 40],
];

const SOLIDO = [
  "##############",
  "##############",
  "....###.##....",
  "....######....",
  "..............",
  "..............",
  "#..........##.",
  "...........##.",
  "#............#",
];

const PINCEIS = [
  { id: "chao", nome: "Chão", cor: "rgba(120, 170, 110, 0.45)" },
  { id: "parede", nome: "Parede", cor: "rgba(243, 140, 170, 0.55)" },
  { id: "porta", nome: "Porta", cor: "rgba(90, 190, 140, 0.6)" },
  { id: "balcao", nome: "Balcão", cor: "rgba(120, 170, 230, 0.55)" },
  { id: "enfermeira", nome: "Enfermeira fica aqui", cor: "rgba(255, 120, 160, 0.65)" },
  { id: "maquina", nome: "Máquina de cura", cor: "rgba(230, 90, 170, 0.65)" },
  { id: "pc", nome: "Computador", cor: "rgba(90, 210, 220, 0.65)" },
  { id: "decoracao", nome: "Decoração", cor: "rgba(230, 190, 80, 0.5)" },
  { id: "", nome: "Apagar", cor: "transparent" },
];

const NOMES = Object.fromEntries(PINCEIS.map((p) => [p.id, p.nome]));
const CORES = Object.fromEntries(PINCEIS.map((p) => [p.id, p.cor]));

const urlFundo = "/ref/sprites/interiors/pokecenter-emerald-bg.png";
const urlFrente = "/ref/sprites/interiors/pokecenter-emerald-fg.png";

const celulas = {};
const sprites = {};
let pincel = "parede";
let pintando = false;
let fundo = null;
let frente = null;

const tela = document.getElementById("sala");
const ctx = tela.getContext("2d");
const mira = document.getElementById("mira");
const status = document.getElementById("status");

function imagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function leituraAtual(tx, ty) {
  const saida = (tx === 6 || tx === 7) && ty === 8;
  if (saida) return "porta";
  const solido = SOLIDO[ty][tx] === "#";
  const borda = tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1;
  if (borda || (ty < 2 && solido)) return "parede";
  if (solido) return "balcao";
  if (tx === 7 && ty === 3) return "enfermeira";
  if (tx === 7 && ty === 2) return "maquina";
  if (tx === 10 && ty === 2) return "pc";
  return "";
}

function folhaAtual() {
  const marcado = document.querySelector('input[name="folha"]:checked');
  return marcado ? marcado.value : "fundo";
}

function chaveSprite(id) {
  const folha = folhaAtual();
  if (folha === "frente") return `fg:${id}`;
  if (folha === "fundo") return `bg:${id}`;
  return "";
}

function papelDe(tx, ty) {
  const chave = `${tx},${ty}`;
  if (Object.prototype.hasOwnProperty.call(celulas, chave)) return celulas[chave];
  const id = CAMADA[ty][tx];
  const folha = folhaAtual();
  if (folha === "juntas") return sprites[`fg:${id}`] || sprites[`bg:${id}`] || sprites[String(id)] || "";
  const propria = folha === "frente" ? sprites[`fg:${id}`] : sprites[`bg:${id}`];
  return propria || "";
}

function desenharTile(img, id, x, y, lado) {
  if (!img) return;
  const sx = (id % COLUNAS) * TILE;
  const sy = Math.floor(id / COLUNAS) * TILE;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, TILE, TILE, x, y, lado, lado);
}

function pintar() {
  ctx.clearRect(0, 0, tela.width, tela.height);
  const mostrarLeitura = document.getElementById("leitura").checked;
  const folha = folhaAtual();
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const x = tx * LADO;
      const y = ty * LADO;
      const id = CAMADA[ty][tx];
      if (folha !== "frente") desenharTile(fundo, id, x, y, LADO);
      if (folha !== "fundo") desenharTile(frente, id, x, y, LADO);
      const papel = papelDe(tx, ty);
      if (papel && CORES[papel]) {
        ctx.fillStyle = CORES[papel];
        ctx.fillRect(x, y, LADO, LADO);
      } else if (mostrarLeitura) {
        const chute = leituraAtual(tx, ty);
        if (chute && CORES[chute]) {
          ctx.fillStyle = CORES[chute].replace("0.55", "0.22").replace("0.6", "0.22").replace("0.65", "0.22").replace("0.5", "0.22").replace("0.45", "0.22");
          ctx.fillRect(x, y, LADO, LADO);
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(x + 0.5, y + 0.5, LADO - 1, LADO - 1);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "11px Segoe UI";
      ctx.fillText(String(id), x + 4, y + 14);
    }
  }
}

function celulaNoPonto(ev) {
  const caixa = tela.getBoundingClientRect();
  const tx = Math.floor(((ev.clientX - caixa.left) / caixa.width) * COLS);
  const ty = Math.floor(((ev.clientY - caixa.top) / caixa.height) * ROWS);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
  return { tx, ty };
}

function aplicar(tx, ty) {
  const chave = `${tx},${ty}`;
  if (!pincel) delete celulas[chave];
  else celulas[chave] = pincel;
  pintar();
}

function descrever(tx, ty) {
  const id = CAMADA[ty][tx];
  const papel = papelDe(tx, ty);
  const nome = papel ? NOMES[papel] : "sem marca";
  const folha = folhaAtual() === "frente" ? "frente" : folhaAtual() === "fundo" ? "fundo" : "as duas";
  mira.textContent = `Quadrado ${tx}, ${ty} · ${folha} · sprite ${id} · ${nome}`;
}

function montarPinceis() {
  const caixa = document.getElementById("pinceis");
  caixa.replaceChildren();
  for (let i = 0; i < PINCEIS.length; i++) {
    const item = PINCEIS[i];
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "pincel" + (item.id === pincel ? " is-ativo" : "");
    botao.dataset.id = item.id;
    const cor = document.createElement("i");
    cor.style.background = item.cor === "transparent" ? "#101612" : item.cor;
    botao.append(cor, document.createTextNode(item.nome));
    botao.addEventListener("click", () => {
      pincel = item.id;
      montarPinceis();
      montarFolha();
    });
    caixa.append(botao);
  }
}

function idsUsados() {
  const vistos = [];
  const tem = new Set();
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const id = CAMADA[ty][tx];
      if (tem.has(id)) continue;
      tem.add(id);
      vistos.push(id);
    }
  }
  vistos.sort((a, b) => a - b);
  return vistos;
}

function recorte(id, img) {
  const telaSprite = document.createElement("canvas");
  telaSprite.width = TILE;
  telaSprite.height = TILE;
  const g = telaSprite.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (!img) return telaSprite;
  g.drawImage(img, (id % COLUNAS) * TILE, Math.floor(id / COLUNAS) * TILE, TILE, TILE, 0, 0, TILE, TILE);
  return telaSprite;
}

function montarFolha() {
  const caixa = document.getElementById("folha");
  caixa.replaceChildren();
  const ids = idsUsados();
  const folha = folhaAtual();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const chave = chaveSprite(id);
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "sprite" + (chave && sprites[chave] === pincel && pincel ? " is-ativo" : "");
    if (folha !== "frente") botao.append(recorte(id, fundo));
    if (folha !== "fundo") botao.append(recorte(id, frente));
    const marca = chave && sprites[chave] ? NOMES[sprites[chave]] : "sprite " + id;
    botao.append(document.createTextNode(folha === "juntas" ? `sprite ${id}` : marca));
    botao.disabled = folha === "juntas";
    botao.addEventListener("click", () => {
      if (!chave) return;
      if (!pincel) delete sprites[chave];
      else sprites[chave] = pincel;
      montarFolha();
      pintar();
    });
    caixa.append(botao);
  }
}

async function carregarMarcas() {
  try {
    const resposta = await fetch("/anotacoes/centro.json", { cache: "no-store" });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    Object.assign(celulas, dados.celulas || {});
    Object.assign(sprites, dados.sprites || {});
  } catch {
    /* ainda não existe arquivo */
  }
}

async function salvar() {
  status.textContent = "Salvando…";
  const resposta = await fetch("/api/centro-marcas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ celulas, sprites }),
  });
  if (!resposta.ok) {
    status.textContent = "Não salvou.";
    return;
  }
  const n = Object.keys(celulas).length + Object.keys(sprites).length;
  status.textContent = `Salvo. ${n} marcas.`;
}

tela.addEventListener("pointerdown", (ev) => {
  const celula = celulaNoPonto(ev);
  if (!celula) return;
  pintando = true;
  tela.setPointerCapture(ev.pointerId);
  aplicar(celula.tx, celula.ty);
  descrever(celula.tx, celula.ty);
});

tela.addEventListener("pointermove", (ev) => {
  const celula = celulaNoPonto(ev);
  if (!celula) return;
  descrever(celula.tx, celula.ty);
  if (pintando) aplicar(celula.tx, celula.ty);
});

tela.addEventListener("pointerup", () => {
  pintando = false;
});

document.getElementById("salvar").addEventListener("click", salvar);
document.getElementById("leitura").addEventListener("change", pintar);
for (const radio of document.querySelectorAll('input[name="folha"]')) {
  radio.addEventListener("change", () => {
    montarFolha();
    pintar();
  });
}

Promise.all([imagem(urlFundo), imagem(urlFrente).catch(() => null), carregarMarcas()]).then((imagens) => {
  fundo = imagens[0];
  frente = imagens[1];
  montarPinceis();
  montarFolha();
  pintar();
});
