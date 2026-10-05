/**
 * Heightmap limpo — terraços retangulares.
 * Terraço isolado (y≈11–13) = prova de Y-depth sort.
 */
export const COLUNAS = 24;
export const LINHAS = 18;

export const ALTURAS = (() => {
  const dados = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,2,2,2,3,3,3,2,2,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    // terraço isolado — depth sort (norte = atrás, sul = frente)
    [1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,3,3,3,3,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,3,3,3,3,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  if (dados.length !== LINHAS || dados[0].length !== COLUNAS) {
    throw new Error("Heightmap com dimensões inválidas");
  }
  return dados;
})();

/** Spawn ao norte do terraço amarelo — comece vendo oclusão. */
export const SPAWN = { x: 7.5, y: 10.2, z: 1 };

export const PROPS = [
  { id: "arv-atras", x: 7.5, y: 10.4, tipo: "arvore" },
  { id: "placa-sort", x: 7.5, y: 10.9, tipo: "placa", texto: "ATRÁS" },
  { id: "pedra-frente", x: 7.5, y: 14.3, tipo: "pedra" },
  { id: "placa-frente", x: 9.2, y: 14.3, tipo: "placa", texto: "FRENTE" },
  { id: "placa-pulo", x: 8.5, y: 8.3, tipo: "placa", texto: "3→1" },
  { id: "arv-a", x: 20.2, y: 4.5, tipo: "arvore" },
  { id: "pedra-a", x: 2.5, y: 4.6, tipo: "pedra" },
];
