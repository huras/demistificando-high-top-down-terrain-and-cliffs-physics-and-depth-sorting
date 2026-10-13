/**
 * Salas de casa, loja e Centro. Grade de células, colisão e pontos de interação.
 * O desenho fica no jogo, não no canvas 2D de origem.
 */

function parede(cols, rows) {
  const celulas = [];
  for (let y = 0; y < rows; y++) {
    const linha = [];
    for (let x = 0; x < cols; x++) {
      const borda = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      linha.push(borda ? 1 : 0);
    }
    celulas.push(linha);
  }
  return celulas;
}

function abrir(grade, x, y) {
  if (grade[y] && grade[y][x] != null) grade[y][x] = 0;
}

function salaBase(cols, rows) {
  const grade = parede(cols, rows);
  const portaX = (cols / 2) | 0;
  abrir(grade, portaX, rows - 1);
  return {
    cols,
    rows,
    grade,
    spawn: { x: portaX, y: rows - 2 },
    saida: { x: portaX, y: rows - 1 },
    npcs: [],
    props: [],
    chao: "#d6c4a4",
    parede: "#8c7358",
  };
}

export function salaCasa() {
  const sala = salaBase(12, 10);
  sala.titulo = "Casa";
  sala.kind = "house";
  sala.chao = "#e7d3b0";
  sala.props.push({ key: "cama", nome: "Cama", x: 2, y: 2, cor: "#b45309", cura: true, fixo: true });
  sala.props.push({ key: "mesa", nome: "Mesa", x: 6, y: 3, cor: "#92400e", fixo: true });
  return sala;
}

export function salaLoja() {
  const sala = salaBase(14, 10);
  sala.titulo = "Poké Mart";
  sala.kind = "mart";
  sala.chao = "#f3e6c8";
  sala.parede = "#6b8f71";
  for (let x = 3; x <= 10; x++) sala.grade[4][x] = 1;
  sala.npcs.push({
    id: "clerk",
    nome: "Balconista",
    x: 7,
    y: 6,
    cor: "#2563eb",
    fala: ["Bem-vindo ao Poké Mart.", "O que vai querer?"],
    acao: "loja",
  });
  return sala;
}

export function salaCentro() {
  const sala = salaBase(16, 12);
  sala.titulo = "Centro Pokémon";
  sala.kind = "heal";
  sala.chao = "#f7efe4";
  sala.parede = "#d4a5a5";
  sala.npcs.push({
    id: "nurse",
    nome: "Enfermeira",
    x: 8,
    y: 3,
    cor: "#ec4899",
    fala: ["Bem-vindo ao Centro Pokémon.", "Quer que eu cure o seu time?"],
    acao: "curar",
    escolhas: [
      { id: "sim", rotulo: "Sim" },
      { id: "nao", rotulo: "Agora não" },
    ],
  });
  sala.props.push({
    key: "pc",
    nome: "PC",
    x: 2,
    y: 2,
    cor: "#64748b",
    acao: "pc",
    fixo: true,
  });
  sala.props.push({
    key: "maquina",
    nome: "Máquina",
    x: 13,
    y: 2,
    cor: "#f472b6",
    fixo: true,
  });
  return sala;
}

export function criarSala(papel) {
  if (papel === "loja") return salaLoja();
  if (papel === "centro") return salaCentro();
  if (papel === "casa") return salaCasa();
  return null;
}

export function celulaLivre(sala, x, y) {
  const ix = x | 0;
  const iy = y | 0;
  if (iy < 0 || ix < 0 || iy >= sala.rows || ix >= sala.cols) return false;
  return sala.grade[iy][ix] === 0;
}
