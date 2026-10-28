/**
 * Mesher puro a partir de snapshot (Worker-safe, sem store/Three).
 * Gera lotes tipados: tops por kit, paredes unificadas, água/espuma/queda.
 */
import {
  criarLoteTipado,
  pushLedge,
  pushQuadAgua,
  pushQuadEspuma,
  pushQuadQueda,
  q6Tipado,
} from "./loteTipado.js";

const UV = [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1];
const ESPUMA_LARGO = 0.46;

function hexRgb(hex) {
  const h = String(hex || "#ffffff").replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255 || 1,
    g: parseInt(h.slice(2, 4), 16) / 255 || 1,
    b: parseInt(h.slice(4, 6), 16) / 255 || 1,
  };
}

function tintaLago(prof) {
  const t = Math.max(0, Math.min(1, ((prof || 1) - 1) / 3));
  const v = Math.round(255 - t * 55);
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(v)}${h(v)}${h(255)}`;
}

/**
 * @param {object} snap payload de capturarSnapshotChunk
 * @returns {{ lotes: object, meta: object }}
 */
export function malharDeSnapshot(snap) {
  const halo = snap.halo | 0;
  const lado = snap.lado | 0;
  const xz = snap.chunkXz | 0;
  const kitNomes = snap.kitNomes || ["_"];
  const grade = snap.grade;
  const nGrade = xz + 2;

  function alturaGrade(lx, ly) {
    // gradeDoChunk: (CHUNK_XZ+2)^2 com origem (cx*XZ-1, cy*XZ-1)
    const gx = lx + 1;
    const gy = ly + 1;
    if (gx < 0 || gy < 0 || gx >= nGrade || gy >= nGrade) return 0;
    return grade[gy * nGrade + gx] | 0;
  }

  function iaHalo(lx, ly) {
    return (ly + halo) * lado + (lx + halo);
  }

  const sacosTopo = new Map();
  const loteParedes = criarLoteTipado(true, false);
  const loteLedges = criarLoteTipado(true, false);
  const loteAguas = criarLoteTipado(true, false);
  const loteAguasPantano = criarLoteTipado(true, false);
  const loteAguasLava = criarLoteTipado(true, false);
  const loteEspumas = criarLoteTipado(true, false);
  const loteQuedas = criarLoteTipado(true, false);
  const loteQuedasLava = criarLoteTipado(true, false);

  function sacoTopo(kit) {
    let s = sacosTopo.get(kit);
    if (!s) {
      s = criarLoteTipado(true, true);
      sacosTopo.set(kit, s);
    }
    return s;
  }

  function pushTopo(lote, wx, wy, y) {
    lote._n = [0, 1, 0];
    lote._rgb = [1, 1, 1];
    q6Tipado(
      lote,
      [
        wx, y, wy,
        wx, y, wy + 1,
        wx + 1, y, wy,
        wx, y, wy + 1,
        wx + 1, y, wy + 1,
        wx + 1, y, wy,
      ],
      UV,
    );
  }

  function pushParede(wx, wy, y0, y1, dir) {
    if (y1 - y0 < 1e-3) return;
    loteParedes._rgb = [0.75, 0.75, 0.75];
    const uvs = [0, y1 - y0, 0, 0, 1, y1 - y0, 0, 0, 1, 0, 1, y1 - y0];
    // Winding = pushCuboLote / pushFace* (CCW visto de fora → FrontSide).
    if (dir === "s") {
      loteParedes._n = [0, 0, 1];
      q6Tipado(
        loteParedes,
        [
          wx, y1, wy + 1,
          wx, y0, wy + 1,
          wx + 1, y1, wy + 1,
          wx, y0, wy + 1,
          wx + 1, y0, wy + 1,
          wx + 1, y1, wy + 1,
        ],
        uvs,
      );
    } else if (dir === "n") {
      loteParedes._n = [0, 0, -1];
      q6Tipado(
        loteParedes,
        [
          wx + 1, y1, wy,
          wx + 1, y0, wy,
          wx, y1, wy,
          wx + 1, y0, wy,
          wx, y0, wy,
          wx, y1, wy,
        ],
        uvs,
      );
    } else if (dir === "e") {
      loteParedes._n = [1, 0, 0];
      q6Tipado(
        loteParedes,
        [
          wx + 1, y0, wy,
          wx + 1, y1, wy,
          wx + 1, y1, wy + 1,
          wx + 1, y0, wy,
          wx + 1, y1, wy + 1,
          wx + 1, y0, wy + 1,
        ],
        uvs,
      );
    } else {
      loteParedes._n = [-1, 0, 0];
      q6Tipado(
        loteParedes,
        [
          wx, y0, wy + 1,
          wx, y1, wy + 1,
          wx, y1, wy,
          wx, y0, wy + 1,
          wx, y1, wy,
          wx, y0, wy,
        ],
        uvs,
      );
    }
  }

  function terraSecaHalo(lx, ly) {
    const ia = iaHalo(lx, ly);
    if (ia < 0 || ia >= snap.aguaSurf.length) return false;
    return (snap.aguaSurf[ia] | 0) <= 0;
  }

  function empurrarEspuma(lx, ly, wx, wy, y) {
    const norte = terraSecaHalo(lx, ly - 1);
    const sul = terraSecaHalo(lx, ly + 1);
    const oeste = terraSecaHalo(lx - 1, ly);
    const leste = terraSecaHalo(lx + 1, ly);
    if (!norte && !sul && !oeste && !leste) return;
    const x0 = wx;
    const x1 = wx + 1;
    const z0 = wy;
    const z1 = wy + 1;
    const xa = oeste ? x0 + ESPUMA_LARGO : x0;
    const xb = leste ? x1 - ESPUMA_LARGO : x1;
    const za = norte ? z0 + ESPUMA_LARGO : z0;
    const zb = sul ? z1 - ESPUMA_LARGO : z1;
    if (sul && xb - xa > 1e-3) pushQuadEspuma(loteEspumas, xa, z1 - ESPUMA_LARGO, xb, z1, y, 0, 0, 1, 1);
    if (norte && xb - xa > 1e-3) pushQuadEspuma(loteEspumas, xa, z0, xb, z0 + ESPUMA_LARGO, y, 1, 1, 0, 0);
    if (leste && zb - za > 1e-3) pushQuadEspuma(loteEspumas, x1 - ESPUMA_LARGO, za, x1, zb, y, 0, 1, 1, 0);
    if (oeste && zb - za > 1e-3) pushQuadEspuma(loteEspumas, x0, za, x0 + ESPUMA_LARGO, zb, y, 1, 0, 0, 1);
  }

  const baseX = snap.cx * xz;
  const baseY = snap.cy * xz;
  let precisaSync = false;

  for (let ly = 0; ly < xz; ly++) {
    for (let lx = 0; lx < xz; lx++) {
      const ia = iaHalo(lx, ly);
      if (snap.temAr[ia]) {
        precisaSync = true;
        continue;
      }
      const wx = baseX + lx;
      const wy = baseY + ly;
      const h = alturaGrade(lx, ly);
      if (h <= 0) continue;
      const kit = kitNomes[snap.kitIdx[ia] | 0] || "_";
      const loteTop = sacoTopo(kit);
      pushTopo(loteTop, wx, wy, h);

      const viz = [
        [0, 1, "s"],
        [0, -1, "n"],
        [1, 0, "e"],
        [-1, 0, "w"],
      ];
      for (let v = 0; v < 4; v++) {
        const nx = lx + viz[v][0];
        const ny = ly + viz[v][1];
        const hv = alturaGrade(nx, ny);
        if (h > hv + 0.01) {
          pushParede(wx, wy, hv, h, viz[v][2]);
          if (h - hv >= 1) {
            pushLedge(loteLedges, wx, wy, h, viz[v][2], "#c8e6a0", "#8b7355");
          }
        }
      }

      const sup = snap.aguaSurf[ia] | 0;
      if (sup > 0) {
        const fam = snap.fluido[ia] | 0;
        // FLUIDO: AGUA=1 PANTANO=2 LAVA=3
        const loteA =
          fam === 3 ? loteAguasLava : fam === 2 ? loteAguasPantano : loteAguas;
        const cor = fam > 1 ? "#ffffff" : tintaLago(snap.aguaProf[ia] | 1);
        const rgb = hexRgb(cor);
        pushQuadAgua(
          loteA,
          wx,
          wy,
          sup - 0.04,
          snap.fluxoX[ia] | 0,
          snap.fluxoY[ia] | 0,
          rgb.r,
          rgb.g,
          rgb.b,
        );
        empurrarEspuma(lx, ly, wx, wy, sup + 0.16);
        const loteQ = fam === 3 ? loteQuedasLava : loteQuedas;
        const lados = viz;
        for (let d = 0; d < 4; d++) {
          const nia = iaHalo(lx + lados[d][0], ly + lados[d][1]);
          if (nia < 0 || nia >= snap.aguaSurf.length) continue;
          const dest = snap.aguaSurf[nia] | 0;
          if (!(dest > 0)) continue;
          if (sup - dest < 1) continue;
          pushQuadQueda(loteQ, wx, wy, dest, sup, lados[d][2]);
        }
      }
    }
  }

  function serializarLote(lote) {
    if (!lote || lote.nVerts <= 0) return null;
    const n = lote.nVerts;
    return {
      nVerts: n,
      pos: lote.pos.slice(0, n * 3),
      uv: lote.uv.slice(0, n * 2),
      nor: lote.nor.slice(0, n * 3),
      cor: lote.cor ? lote.cor.slice(0, n * 3) : null,
      splat: lote.splat ? lote.splat.slice(0, n) : null,
      pele: lote.pele ? lote.pele.slice(0, n * 2) : null,
    };
  }

  const topos = {};
  for (const [kit, lote] of sacosTopo) {
    const s = serializarLote(lote);
    if (s) topos[kit] = s;
  }

  return {
    meta: { cx: snap.cx, cy: snap.cy, rev: snap.rev, precisaSync },
    lotes: {
      topos,
      paredes: serializarLote(loteParedes),
      ledges: serializarLote(loteLedges),
      agua: serializarLote(loteAguas),
      pantano: serializarLote(loteAguasPantano),
      lava: serializarLote(loteAguasLava),
      espuma: serializarLote(loteEspumas),
      queda: serializarLote(loteQuedas),
      quedaLava: serializarLote(loteQuedasLava),
    },
  };
}

/** Reconstrói BufferGeometry-ready lotes no main a partir do serializado. */
export function hidratarLotes(serial) {
  if (!serial) return null;
  function hidratar(s) {
    if (!s) return null;
    const lote = criarLoteTipado(!!s.cor, !!s.splat);
    const n = s.nVerts | 0;
    lote.pos = s.pos;
    lote.uv = s.uv;
    lote.nor = s.nor;
    if (s.cor) lote.cor = s.cor;
    if (s.splat) lote.splat = s.splat;
    if (s.pele) lote.pele = s.pele;
    lote.nVerts = n;
    return lote;
  }
  const topos = {};
  for (const [kit, s] of Object.entries(serial.topos || {})) {
    topos[kit] = hidratar(s);
  }
  return {
    topos,
    paredes: hidratar(serial.paredes),
    ledges: hidratar(serial.ledges),
    agua: hidratar(serial.agua),
    pantano: hidratar(serial.pantano),
    lava: hidratar(serial.lava),
    espuma: hidratar(serial.espuma),
    queda: hidratar(serial.queda),
    quedaLava: hidratar(serial.quedaLava),
  };
}
