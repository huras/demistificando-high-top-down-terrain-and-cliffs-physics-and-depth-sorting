/**
 * Worker de malha — recebe snapshot, devolve lotes tipados serializados.
 */
import { malharDeSnapshot } from "./mesherSnapshot.js";

self.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || msg.tipo !== "malhar") return;
  try {
    const out = malharDeSnapshot(msg.snap);
    const transfer = [];
    const lotes = out.lotes;
    function coletar(s) {
      if (!s) return;
      if (s.pos?.buffer) transfer.push(s.pos.buffer);
      if (s.uv?.buffer) transfer.push(s.uv.buffer);
      if (s.nor?.buffer) transfer.push(s.nor.buffer);
      if (s.cor?.buffer) transfer.push(s.cor.buffer);
      if (s.splat?.buffer) transfer.push(s.splat.buffer);
      if (s.pele?.buffer) transfer.push(s.pele.buffer);
    }
    coletar(lotes.paredes);
    coletar(lotes.ledges);
    coletar(lotes.agua);
    coletar(lotes.pantano);
    coletar(lotes.lava);
    coletar(lotes.espuma);
    coletar(lotes.queda);
    coletar(lotes.quedaLava);
    for (const s of Object.values(lotes.topos || {})) coletar(s);
    self.postMessage(
      { tipo: "pronto", id: msg.id, meta: out.meta, lotes },
      transfer,
    );
  } catch (err) {
    self.postMessage({
      tipo: "erro",
      id: msg.id,
      erro: String(err?.message || err),
    });
  }
};
