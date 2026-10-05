/**
 * Heightmap limpo — terraços retangulares (lê como Minecraft/Pokémon, não retalho).
 * - platô z=2 contínuo
 * - mirante z=3 com beiral sul sobre z=1 (pulo 3→1)
 * - terraço isolado (depth sort)
 * - escada 1→2→3
 */
export const COLUNAS = 24;
export const LINHAS = 18;

export const ALTURAS = (() => {
  const dados = [
    // y0-1: chão
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    // y2-5: platô z=2 contínuo (8×4)
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    // y6: mirante z=3 em cima do platô
    [1,1,1,1,2,2,2,3,3,3,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    // y7: beiral do mirante sobre o chão (queda 3→1)
    [1,1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    // y8-10: chão / corredor
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    // y11-13: terraço isolado (provar depth sort)
    [1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    // y15-16: escada larga 1→2→3
    [1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,3,3,3,3,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,3,3,3,3,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  if (dados.length !== LINHAS || dados[0].length !== COLUNAS) {
    throw new Error("Heightmap com dimensões inválidas");
  }
  return dados;
})();

export const SPAWN = { x: 3.5, y: 9.5, z: 1 };

export const PROPS = [
  { id: "pedra-a", x: 2.5, y: 4.6, tipo: "pedra" },
  { id: "pedra-b", x: 15.5, y: 8.4, tipo: "pedra" },
  { id: "arv-a", x: 20.2, y: 4.5, tipo: "arvore" },
  { id: "arv-b", x: 2.3, y: 15.2, tipo: "arvore" },
  { id: "placa", x: 8.5, y: 8.3, tipo: "placa" },
];
