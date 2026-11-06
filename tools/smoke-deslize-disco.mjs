/**
 * Deslize sem atrito contra disco imóvel.
 * node tools/smoke-deslize-disco.mjs
 */
import { indexarBases, invadeDisco, limparBases } from "../js/fisica/obstaculos.js";
import {
  aplicarDeslizeVelocidade,
  deslizarDeltaDisco,
} from "../js/fisica/deslizeDisco.js";

const CX = -9912;
const CY = -9912;
const Z = 4;
let falhas = 0;

function ok(nome, cond, detalhe = "") {
  const pass = !!cond;
  if (!pass) falhas++;
  console[pass ? "log" : "error"](
    `${pass ? "OK" : "FAIL"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`,
  );
}

function livre(x, y, raio) {
  return !invadeDisco(x, y, Z, raio);
}

function passo(x, y, dx, dy, raio) {
  const d = deslizarDeltaDisco(x, y, dx, dy, Z, raio);
  return {
    x: x + d.dx,
    y: y + d.dy,
    dx: d.dx,
    dy: d.dy,
    tocou: d.tocou,
    n: d.n,
    n0x: d.n0x,
    n0y: d.n0y,
  };
}

indexarBases(CX, CY, [{ x: 10, y: 10, z: Z, r: 0.44, tipo: "pedra" }]);

const raio = 0.28;
const min = raio + 0.44;

const longe = passo(8, 10, 0.1, -0.05, raio);
ok("passo longe não encosta", longe.tocou === 0 && Math.abs(longe.dx - 0.1) < 1e-9);

const lado = passo(10 - min, 10, 0.45, 0.2, raio);
ok(
  "de raspão anda na tangente",
  lado.y > 10.05 && livre(lado.x, lado.y, raio),
  `→ (${lado.x.toFixed(3)}, ${lado.y.toFixed(3)}) tocou=${lado.tocou}`,
);
ok(
  "de raspão não entra no disco",
  Math.hypot(lado.x - 10, lado.y - 10) >= min - 1e-3,
);

const frente = passo(10 - min - 0.02, 10, 0.4, 0, raio);
ok(
  "de frente para na pele",
  frente.x <= 10 - min + 0.02 && Math.abs(frente.y - 10) < 0.02 && livre(frente.x, frente.y, raio),
  `→ (${frente.x.toFixed(3)}, ${frente.y.toFixed(3)})`,
);

const corpo = { vx: 4, vy: 1.5 };
const encosto = deslizarDeltaDisco(10 - min, 10, 0.3, 0.05, Z, raio);
aplicarDeslizeVelocidade(corpo, encosto);
ok(
  "velocidade perde a normal e guarda a tangente",
  corpo.vy > 0.2 && corpo.vx < 1.5,
  `v=(${corpo.vx.toFixed(3)}, ${corpo.vy.toFixed(3)}) n=${encosto.n}`,
);

let x = 10 - min - 0.05;
let y = 9.55;
let vx = 3.2;
let vy = 2.4;
let andou = 0;
for (let i = 0; i < 12; i++) {
  const movel = { vx, vy };
  const d = deslizarDeltaDisco(x, y, vx / 60, vy / 60, Z, raio);
  const nx = x + d.dx;
  const ny = y + d.dy;
  aplicarDeslizeVelocidade(movel, d);
  if (Math.hypot(nx - x, ny - y) > 1e-4) andou++;
  x = nx;
  y = ny;
  vx = movel.vx;
  vy = movel.vy;
}
ok(
  "segurar o passo não gruda",
  andou >= 8 && livre(x, y, raio),
  `andou ${andou}/12 → (${x.toFixed(3)}, ${y.toFixed(3)}) v=(${vx.toFixed(2)}, ${vy.toFixed(2)})`,
);

limparBases(CX, CY);
indexarBases(CX, CY, [
  { x: 20, y: 20, z: Z, r: 0.5, tipo: "pedra" },
  { x: 21.35, y: 20, z: Z, r: 0.5, tipo: "pedra" },
]);
const cunha = passo(20.67, 18.6, 0, 0.9, 0.2);
ok(
  "cunha entre duas pedras não penetra",
  livre(cunha.x, cunha.y, 0.2) && cunha.y > 18.6,
  `→ (${cunha.x.toFixed(3)}, ${cunha.y.toFixed(3)})`,
);

limparBases(CX, CY);
console.log(falhas ? `smoke-deslize-disco: ${falhas} falha(s)` : "smoke-deslize-disco: ok");
process.exit(falhas ? 1 : 0);
