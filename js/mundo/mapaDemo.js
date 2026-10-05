/**
 * Heightmap de testes — muitas combinações de cliff.
 * Base z=1; duas montanhas Minecraft: norte ×1 e norte ×2, com vão entre elas.
 */

export const COLUNAS = 84;
export const LINHAS = 60;

function criarGrade(cols, rows, base = 1) {
  const g = new Array(rows);
  for (let y = 0; y < rows; y++) {
    const row = new Array(cols);
    for (let x = 0; x < cols; x++) row[x] = base;
    g[y] = row;
  }
  return g;
}

/** Retângulo inclusivo [x0..x1] × [y0..y1]. */
function preencher(g, x0, y0, x1, y1, z) {
  const rows = g.length;
  const cols = g[0].length;
  const xa = Math.max(0, Math.min(x0, x1));
  const xb = Math.min(cols - 1, Math.max(x0, x1));
  const ya = Math.max(0, Math.min(y0, y1));
  const yb = Math.min(rows - 1, Math.max(y0, y1));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) g[y][x] = z;
  }
}

function pilar(g, x, y, z) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = z;
}

/**
 * Montanha estilo Minecraft:
 * - topo ≥3×3 em `topZ` (base 1 → topZ=17 = 16 de altura)
 * - face leste do topo = parede contínua (queda topZ−1)
 * - oeste / sul = escadas de 1 célula por degrau
 * - norte = `passoNorte` células de chão por degrau (1 = clássico, 2 = mais fundo)
 */
function montanhaMinecraft(g, cx0, cy0, cx1, cy1, topZ, passoNorte = 1) {
  const degraus = topZ - 1; // 16 se topZ=17
  const passo = Math.max(1, passoNorte | 0);
  const yMin = cy0 - (degraus - 1) * passo;
  const yMax = cy1 + (degraus - 1);
  const xMin = cx0 - (degraus - 1);
  // sem expansão a leste — fatia leste = muro contínuo

  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= cx1; x++) {
      if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) continue;
      const dx = x < cx0 ? cx0 - x : 0; // só oeste
      const dyN = y < cy0 ? Math.ceil((cy0 - y) / passo) : 0;
      const dyS = y > cy1 ? y - cy1 : 0;
      const dist = Math.max(dx, dyN, dyS);
      const z = topZ - dist;
      if (z > 1) g[y][x] = Math.max(g[y][x], z);
    }
  }
  preencher(g, cx0, cy0, cx1, cy1, topZ);
}

export const ALTURAS = (() => {
  const g = criarGrade(COLUNAS, LINHAS, 1);

  // —— NO: platô z2 + torre z3 (convex / single→double) ——
  preencher(g, 3, 2, 12, 6, 2);
  preencher(g, 7, 5, 10, 8, 3);

  // —— N centro: L côncavo (inner corner climb) ——
  preencher(g, 16, 2, 24, 4, 2);
  preencher(g, 16, 2, 18, 8, 2);

  // —— NE: U / alcova ——
  preencher(g, 28, 2, 38, 8, 2);
  preencher(g, 30, 4, 36, 8, 1);

  // —— Oeste: degraus 1→2→3 (pirâmide) ——
  preencher(g, 2, 11, 8, 18, 2);
  preencher(g, 3, 12, 7, 17, 3);
  preencher(g, 4, 13, 6, 16, 4);

  // —— Centro: terraço isolado depth-sort (spawn) ——
  preencher(g, 14, 12, 20, 15, 2);

  // —— Centro-leste: parede plana single→double (face sul contínua) ——
  preencher(g, 24, 12, 30, 14, 2);
  preencher(g, 31, 12, 37, 14, 3);

  // —— SO: cruz / plus (4 faces + côncavos) ——
  preencher(g, 4, 22, 10, 24, 2);
  preencher(g, 6, 20, 8, 26, 2);

  // —— Sul centro: anel (buraco interno) ——
  preencher(g, 14, 20, 22, 27, 2);
  preencher(g, 16, 22, 20, 25, 1);

  // —— SE: cânion estreito + pilares ——
  preencher(g, 26, 20, 38, 28, 2);
  preencher(g, 28, 22, 36, 26, 1);
  pilar(g, 30, 23, 3);
  pilar(g, 33, 24, 3);
  pilar(g, 32, 22, 2);

  // —— Leste meio: escada de terraços (offset) ——
  preencher(g, 34, 10, 40, 11, 2);
  preencher(g, 35, 12, 40, 13, 2);
  preencher(g, 36, 14, 40, 15, 3);
  preencher(g, 37, 16, 40, 17, 3);

  // —— NO canto: pilares isolados (4 faces) ——
  pilar(g, 1, 1, 3);
  pilar(g, 40, 1, 2);
  pilar(g, 1, 30, 2);
  pilar(g, 40, 30, 3);

  // —— Faixa fina z2 (muro longo N-S) ——
  preencher(g, 12, 10, 12, 28, 2);

  // —— Montanha A (clássica): norte com 1 passo de chão ——
  // Topo mais ao sul pra B (norte ×2) caber com margem no y=0.
  // Topo 48..51 × 34..37. Muro leste em x=51.
  montanhaMinecraft(g, 48, 34, 51, 37, 17, 1);

  // Vão de 5 tiles (x=52..56) entre o muro da A e a escada oeste da B.
  // —— Montanha B: norte com 2 passos (precisa ~30 células ao norte do topo) ——
  // Oeste da B começa em x=57 → topo em 72..75.
  montanhaMinecraft(g, 72, 34, 75, 37, 17, 2);

  if (g.length !== LINHAS || g[0].length !== COLUNAS) {
    throw new Error("Heightmap com dimensões inválidas");
  }
  return g;
})();

/** Spawn ao norte do terraço isolado — oclusão ATRÁS. */
export const SPAWN = { x: 17.5, y: 11.2, z: 1 };

export const PROPS = [
  { id: "arv-atras", x: 17.5, y: 11.4, tipo: "arvore" },
  { id: "mata-atras", x: 16.3, y: 11.5, tipo: "mata" },
  { id: "placa-sort", x: 17.5, y: 11.9, tipo: "placa", texto: "ATRÁS" },
  { id: "pedra-frente", x: 17.5, y: 16.3, tipo: "pedra" },
  { id: "placa-frente", x: 19.2, y: 16.3, tipo: "placa", texto: "FRENTE" },

  { id: "placa-torre", x: 8.5, y: 9.2, tipo: "placa", texto: "TORRE" },
  { id: "placa-L", x: 17.5, y: 9.2, tipo: "placa", texto: "L-CÔNC" },
  { id: "placa-U", x: 33.5, y: 9.2, tipo: "placa", texto: "ALCOVA" },
  { id: "placa-pir", x: 5.5, y: 19.2, tipo: "placa", texto: "PIRÂM" },
  { id: "placa-1-2", x: 28.5, y: 15.3, tipo: "placa", texto: "1→2 SUL" },
  { id: "placa-cruz", x: 7.5, y: 27.3, tipo: "placa", texto: "CRUZ" },
  { id: "placa-anel", x: 18.5, y: 28.3, tipo: "placa", texto: "ANEL" },
  { id: "placa-canion", x: 32.5, y: 29.3, tipo: "placa", texto: "CÂNION" },
  { id: "placa-escada", x: 38.5, y: 18.3, tipo: "placa", texto: "ESCADA" },
  { id: "placa-muro", x: 12.5, y: 14.5, tipo: "placa", texto: "MURO" },

  // Montanha A (norte ×1)
  { id: "placa-mc-leste", x: 52.4, y: 35.5, tipo: "placa", texto: "MURO×16" },
  { id: "placa-mc-cume", x: 49.5, y: 35.5, tipo: "placa", texto: "CUME×1" },
  { id: "placa-mc-n", x: 49.5, y: 20.4, tipo: "placa", texto: "ESC N×1" },
  { id: "placa-mc-s", x: 49.5, y: 50.4, tipo: "placa", texto: "ESC S" },

  // Montanha B (norte ×2) — 5 tiles a leste da A
  { id: "placa-mc2-leste", x: 76.4, y: 35.5, tipo: "placa", texto: "MURO×16" },
  { id: "placa-mc2-cume", x: 73.5, y: 35.5, tipo: "placa", texto: "CUME×2" },
  { id: "placa-mc2-n", x: 73.5, y: 5.4, tipo: "placa", texto: "ESC N×2" },
  { id: "placa-mc2-s", x: 73.5, y: 50.4, tipo: "placa", texto: "ESC S" },

  { id: "arv-a", x: 35.2, y: 3.5, tipo: "arvore" },
  { id: "mata-a", x: 34.2, y: 3.8, tipo: "mata" },
  { id: "pedra-a", x: 4.5, y: 4.6, tipo: "pedra" },
];
