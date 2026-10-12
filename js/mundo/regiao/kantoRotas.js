/**
 * Rodovias de Kanto. Cada path é uma lista de áreas;
 * o trecho entre waypoints é ortogonal (horizontal primeiro).
 */
export const ROTAS_KANTO = Object.freeze([
  Object.freeze({
    id: "route-1",
    nome: "Rota 1",
    path: Object.freeze([
      [10, 16],
      [10, 12],
    ]),
  }),
  Object.freeze({
    id: "route-2",
    nome: "Rota 2",
    floresta: true,
    path: Object.freeze([
      [10, 10],
      [10, 9],
      [9, 9],
      [9, 8],
      [10, 8],
      [11, 8],
      [11, 7],
      [10, 7],
      [10, 6],
    ]),
  }),
  Object.freeze({
    id: "route-3",
    nome: "Rota 3",
    montanha: true,
    path: Object.freeze([
      [11, 5],
      [14, 5],
    ]),
  }),
  Object.freeze({
    id: "route-4",
    nome: "Rota 4",
    montanha: true,
    path: Object.freeze([
      [20, 5],
      [21, 5],
    ]),
  }),
  Object.freeze({
    id: "route-5",
    nome: "Rota 5",
    path: Object.freeze([
      [22, 6],
      [22, 10],
      [20, 10],
    ]),
  }),
  Object.freeze({
    id: "route-6",
    nome: "Rota 6",
    path: Object.freeze([
      [20, 12],
      [20, 16],
    ]),
  }),
  Object.freeze({
    id: "route-7",
    nome: "Rota 7",
    path: Object.freeze([
      [17, 11],
      [19, 11],
    ]),
  }),
  Object.freeze({
    id: "route-8",
    nome: "Rota 8",
    path: Object.freeze([
      [21, 11],
      [25, 11],
    ]),
  }),
  Object.freeze({
    id: "route-9",
    nome: "Rota 9",
    montanha: true,
    path: Object.freeze([
      [23, 5],
      [25, 5],
      [25, 8],
    ]),
  }),
  Object.freeze({
    id: "route-10",
    nome: "Rota 10",
    montanha: true,
    path: Object.freeze([[26, 10]]),
  }),
  Object.freeze({
    id: "route-24",
    nome: "Rota 24",
    path: Object.freeze([
      [22, 4],
      [22, 3],
      [24, 3],
    ]),
  }),
  Object.freeze({
    id: "route-25",
    nome: "Rota 25",
    path: Object.freeze([
      [25, 3],
      [27, 3],
    ]),
  }),
  Object.freeze({
    id: "route-11",
    nome: "Rota 11",
    path: Object.freeze([
      [21, 17],
      [25, 17],
      [26, 17],
      [26, 12],
    ]),
  }),
  Object.freeze({
    id: "route-12",
    nome: "Rota 12",
    path: Object.freeze([
      [26, 13],
      [26, 18],
    ]),
  }),
  Object.freeze({
    id: "route-13",
    nome: "Rota 13",
    path: Object.freeze([
      [26, 19],
      [26, 22],
    ]),
  }),
  Object.freeze({
    id: "route-14",
    nome: "Rota 14",
    path: Object.freeze([
      [26, 23],
      [23, 23],
      [23, 24],
    ]),
  }),
  Object.freeze({
    id: "route-15",
    nome: "Rota 15",
    path: Object.freeze([
      [22, 24],
      [21, 24],
    ]),
  }),
  Object.freeze({
    id: "route-16",
    nome: "Rota 16",
    path: Object.freeze([
      [15, 11],
      [13, 11],
    ]),
  }),
  Object.freeze({
    id: "route-17",
    nome: "Rota 17",
    agua: true,
    path: Object.freeze([
      [13, 12],
      [13, 24],
    ]),
  }),
  Object.freeze({
    id: "route-18",
    nome: "Rota 18",
    path: Object.freeze([
      [13, 24],
      [19, 24],
    ]),
  }),
  Object.freeze({
    id: "route-19",
    nome: "Rota 19",
    agua: true,
    path: Object.freeze([
      [20, 25],
      [20, 26],
    ]),
  }),
  Object.freeze({
    id: "route-20",
    nome: "Rota 20",
    agua: true,
    path: Object.freeze([
      [19, 26],
      [16, 26],
    ]),
  }),
  Object.freeze({
    id: "route-20-west",
    nome: "Rota 20",
    agua: true,
    path: Object.freeze([
      [14, 26],
      [11, 26],
    ]),
  }),
  Object.freeze({
    id: "route-21",
    nome: "Rota 21",
    agua: true,
    path: Object.freeze([
      [10, 25],
      [10, 18],
    ]),
  }),
  Object.freeze({
    id: "route-22",
    nome: "Rota 22",
    montanha: true,
    path: Object.freeze([
      [9, 11],
      [7, 11],
      [7, 6],
    ]),
  }),
  Object.freeze({
    id: "victory-road",
    nome: "Estrada da Vitória",
    montanha: true,
    path: Object.freeze([
      [7, 4],
      [8, 4],
    ]),
  }),
]);
